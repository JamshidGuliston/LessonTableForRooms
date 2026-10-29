package uz.darsjadval.tablet.data

import java.time.LocalDate
import java.time.LocalDateTime

// Backend `api/services.py` dagi room_day() natijasining Kotlin ko'rinishi.

enum class DayStatus { LESSON, EXAM, HOLIDAY, WEEKEND, NO_TERM }

/** FREE — dars soati, lekin xonada hech narsa yo'q ("Xona bo'sh") */
enum class EntryKind { LESSON, EXAM, COFFEE_BREAK, LUNCH, CLUB, FREE }

enum class EntryStatus { PAST, ACTIVE, UPCOMING }

data class DayEntry(
    val kind: EntryKind,
    val title: String,
    /** Kun boshidan daqiqalar: 08:30 → 510 */
    val startMin: Int,
    val endMin: Int,
    val group: String?,
    /** Dars — o'qituvchi, imtihon — nazoratchi, to'garak — rahbar */
    val teacher: String?,
    /** Fan/to'garak rangi "#RRGGBB" */
    val color: String?,
    /** Guruh (alloma) rasmi — to'liq URL */
    val image: String? = null,
)

data class RoomDay(
    val date: LocalDate,
    val status: DayStatus,
    val title: String,
    val resumesOn: LocalDate?,
    val entries: List<DayEntry>,
)

data class TabletData(
    val schoolName: String,
    val roomName: String,
    /** Maktab vaqt zonasi bo'yicha server vaqti (zonasiz) */
    val serverNow: LocalDateTime,
    val day: RoomDay,
    /** Hikmatli so'z — darslar ro'yxatidan keyin ko'rsatiladi; admin qo'shmagan bo'lsa null */
    val quote: Quote? = null,
)

/** `image` — muallif rasmi (bo'lmasa bog'langan guruhniki), to'liq URL */
data class Quote(val text: String, val author: String?, val image: String? = null)

/** Kompyutersiz ulash: ekranda `code`, tokenni faqat `secret` bilan olamiz. */
data class PairStart(val secret: String, val code: String)

sealed interface PairStatus {
    data class Pending(val code: String) : PairStatus
    data class Paired(val token: String) : PairStatus
}
