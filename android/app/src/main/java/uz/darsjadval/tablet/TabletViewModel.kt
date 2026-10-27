package uz.darsjadval.tablet

import android.app.Application
import android.os.SystemClock
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import uz.darsjadval.tablet.data.PairStatus
import uz.darsjadval.tablet.data.PairingExpiredException
import uz.darsjadval.tablet.data.TabletApi
import uz.darsjadval.tablet.data.TabletConfig
import uz.darsjadval.tablet.data.TabletData
import uz.darsjadval.tablet.data.TokenRejectedException
import java.time.LocalDateTime
import java.time.LocalTime

enum class Problem { NOT_CONFIGURED, TOKEN_REJECTED, OFFLINE }

data class UiState(
    val config: TabletConfig,
    val data: TabletData? = null,
    /** Maktab vaqti (server vaqtidan + qurilmaning monoton soati bilan yuritiladi) */
    val now: LocalDateTime? = null,
    val problem: Problem? = null,
    /** Oxirgi muvaffaqiyatli yangilanish (maktab vaqti bo'yicha) */
    val lastUpdated: LocalTime? = null,
    /** Ekrandagi ulash kodi (planshet xonaga biriktirilmagan yoki tokeni rad etilgan bo'lsa) */
    val pairCode: String? = null,
)

class TabletViewModel(app: Application) : AndroidViewModel(app) {

    private val _state = MutableStateFlow(UiState(TabletConfig.load(app)))
    val state: StateFlow<UiState> = _state.asStateFlow()

    // Planshet soati (RTC) noto'g'ri bo'lishi mumkin — shuning uchun server vaqtini
    // olib, qurilmaning yuklangandan beri o'tgan vaqti (elapsedRealtime) bilan yuritamiz.
    private var anchorServer: LocalDateTime? = null
    private var anchorElapsed = 0L
    private var pollJob: Job? = null
    private var pairJob: Job? = null
    private var rolloverRequested: java.time.LocalDate? = null

    init {
        viewModelScope.launch {
            while (isActive) {
                tick()
                delay(1_000 - (SystemClock.elapsedRealtime() % 1_000))
            }
        }
        restartPolling()
    }

    fun reloadConfig() {
        _state.update { UiState(TabletConfig.load(getApplication())) }
        anchorServer = null
        pairJob?.cancel() // server o'zgargan bo'lishi mumkin
        pairJob = null
        restartPolling()
        updatePairing()
    }

    private fun restartPolling() {
        pollJob?.cancel()
        pollJob = viewModelScope.launch {
            while (isActive) {
                val wait = poll()
                delay(wait)
            }
        }
    }

    /** Bitta so'rov; keyingi so'rovgacha kutish vaqtini qaytaradi. */
    private suspend fun poll(): Long = pollOnce().also { updatePairing() }

    private suspend fun pollOnce(): Long {
        val config = _state.value.config
        if (!config.isComplete) {
            _state.update { it.copy(problem = Problem.NOT_CONFIGURED) }
            return 60_000
        }
        return try {
            val data = TabletApi.fetch(config)
            anchorServer = data.serverNow
            anchorElapsed = SystemClock.elapsedRealtime()
            _state.update { it.copy(data = data, problem = null, lastUpdated = data.serverNow.toLocalTime()) }
            tick()
            POLL_MS
        } catch (e: CancellationException) {
            throw e
        } catch (e: TokenRejectedException) {
            _state.update { it.copy(problem = Problem.TOKEN_REJECTED) }
            60_000
        } catch (e: Exception) {
            // Wi-Fi yo'q, server o'chiq va h.k. — eski jadval qoladi, tezroq qayta urinamiz.
            _state.update { it.copy(problem = Problem.OFFLINE) }
            RETRY_MS
        }
    }

    /**
     * Token yo'q yoki rad etilgan bo'lsa — ekranda kod ko'rsatib, admin uni xonaga bog'lashini kutamiz.
     * Rad etilgan eski token bilan so'rash ham davom etadi: u qayta ishlasa, ulash to'xtaydi.
     */
    private fun updatePairing() {
        val s = _state.value
        val needed = s.config.server.isNotBlank() && (s.config.token.isBlank() || s.problem == Problem.TOKEN_REJECTED)
        if (needed) {
            if (pairJob?.isActive != true) pairJob = viewModelScope.launch { pairLoop(s.config.server) }
        } else if (pairJob != null) {
            pairJob?.cancel()
            pairJob = null
            _state.update { it.copy(pairCode = null) }
        }
    }

    private suspend fun pairLoop(server: String) {
        while (true) {
            val start = try {
                TabletApi.pairStart(server)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _state.update { it.copy(pairCode = null) }
                delay(RETRY_MS)
                continue
            }
            _state.update { it.copy(pairCode = start.code) }
            while (true) {
                delay(PAIR_POLL_MS)
                val status = try {
                    TabletApi.pairStatus(server, start.secret)
                } catch (e: CancellationException) {
                    throw e
                } catch (e: PairingExpiredException) {
                    break // yangi kod
                } catch (e: Exception) {
                    continue
                }
                if (status is PairStatus.Paired) {
                    TabletConfig.update(getApplication(), server = null, token = status.token)
                    pairJob = null
                    reloadConfig()
                    return
                }
            }
        }
    }

    private fun tick() {
        val anchor = anchorServer ?: return
        val now = anchor.plusNanos((SystemClock.elapsedRealtime() - anchorElapsed) * 1_000_000)
        _state.update { it.copy(now = now) }
        // Kun almashdi (yarim tun) — yangi kun jadvalini darhol so'raymiz.
        val day = _state.value.data?.day?.date
        val today = now.toLocalDate()
        if (day != null && today.isAfter(day) && rolloverRequested != today) {
            rolloverRequested = today
            restartPolling()
        }
    }

    companion object {
        const val POLL_MS = 30_000L
        const val RETRY_MS = 10_000L
        const val PAIR_POLL_MS = 3_000L
    }
}
