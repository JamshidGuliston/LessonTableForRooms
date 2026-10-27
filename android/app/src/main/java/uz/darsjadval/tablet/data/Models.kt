package uz.darsjadval.tablet.data

import java.time.LocalDate
import java.time.LocalDateTime

// Backend `api/services.py` dagi room_day() natijasining Kotlin ko'rinishi.

enum class DayStatus { LESSON, EXAM, HOLIDAY, WEEKEND, NO_TERM }

enum class EntryKind { LESSON, EXAM, COFFEE_BREAK, LUNCH, CLUB }

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
)
