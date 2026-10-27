package uz.darsjadval.tablet

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import uz.darsjadval.tablet.data.TabletConfig
import uz.darsjadval.tablet.ui.TabletScreen

/**
 * Yagona ekran. Kiosk sifatida ishlaydi: to'liq ekran, ekran doim yoqiq,
 * qulf ekrani ustida ko'rinadi. Launcher (HOME) sifatida ham belgilanishi mumkin.
 */
class MainActivity : ComponentActivity() {

    private val viewModel: TabletViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        @Suppress("DEPRECATION")
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
        )
        hideSystemBars()
        applyConfigFrom(intent)

        setContent {
            val state = viewModel.state.collectAsStateWithLifecycle()
            TabletScreen(state.value)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        applyConfigFrom(intent)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    /** adb: am start ... --es server URL --es token TOKEN */
    private fun applyConfigFrom(intent: Intent?) {
        val changed = TabletConfig.update(
            this,
            server = intent?.getStringExtra(EXTRA_SERVER),
            token = intent?.getStringExtra(EXTRA_TOKEN),
        )
        if (changed) viewModel.reloadConfig()
    }

    /**
     * Navigatsiya panelini yashirsak, Android birinchi marta "Viewing full screen — Got it"
     * oynasini chiqaradi. Sensorsiz planshetda uni hech kim yopa olmaydi, shuning uchun:
     * - adb orqali WRITE_SECURE_SETTINGS berilgan bo'lsa — tasdiqni o'chirib, to'liq ekran;
     * - aks holda faqat status bar yashiriladi (bu oyna chiqmaydi).
     */
    private fun hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        @Suppress("DEPRECATION")
        window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
        val immersive = markImmersiveConfirmed()
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(if (immersive) WindowInsetsCompat.Type.systemBars() else WindowInsetsCompat.Type.statusBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun markImmersiveConfirmed(): Boolean = try {
        Settings.Secure.putString(contentResolver, "immersive_mode_confirmations", "confirmed")
    } catch (e: SecurityException) {
        false
    }

    companion object {
        const val EXTRA_SERVER = "server"
        const val EXTRA_TOKEN = "token"
    }
}
