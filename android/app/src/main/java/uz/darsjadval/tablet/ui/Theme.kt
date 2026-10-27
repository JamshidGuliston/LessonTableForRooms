package uz.darsjadval.tablet.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import uz.darsjadval.tablet.R
import uz.darsjadval.tablet.data.DayStatus
import uz.darsjadval.tablet.data.EntryKind

/** docs/design "Dizayn tokenlari" — light mavzu. */
object Palette {
    val bg = Color(0xFFF3F5F9)
    val surface = Color(0xFFFFFFFF)
    val surface2 = Color(0xFFF6F8FB)
    val border = Color(0xFFE2E8F0)
    val text = Color(0xFF0F172A)
    val muted = Color(0xFF5B6577)
    val faint = Color(0xFF78839A)

    val primary = Color(0xFF2563EB)
    val primaryText = Color(0xFF1F56CF)

    val offline = Color(0xFFEF4444)
    val offlineText = Color(0xFFDC2626)
    val holiday = Color(0xFF64748B)
}

/** Yozuv turi ranglari: asosiy (chegara, nuqta, progress) va light fonda o'qiladigan matn rangi. */
data class KindColors(val accent: Color, val text: Color, val tint: Color)

fun kindColors(kind: EntryKind): KindColors = when (kind) {
    EntryKind.LESSON -> KindColors(Palette.primary, Palette.primaryText, Palette.surface)
    EntryKind.COFFEE_BREAK -> KindColors(Color(0xFF34D399), Color(0xFF047857), Color(0xFFE3F7EF))
    EntryKind.LUNCH -> KindColors(Color(0xFF2DD4BF), Color(0xFF0F766E), Color(0xFFE0F7F4))
    EntryKind.EXAM -> KindColors(Color(0xFFF59E0B), Color(0xFFB45309), Color(0xFFFEF3DC))
    EntryKind.CLUB -> KindColors(Color(0xFFA78BFA), Color(0xFF6D28D9), Color(0xFFF1ECFE))
}

fun kindLabel(kind: EntryKind) = when (kind) {
    EntryKind.LESSON -> "DARS"
    EntryKind.EXAM -> "IMTIHON"
    EntryKind.COFFEE_BREAK -> "TANAFFUS"
    EntryKind.LUNCH -> "TUSHLIK"
    EntryKind.CLUB -> "TO'GARAK"
}

fun dayStateTitle(status: DayStatus, title: String) = when (status) {
    DayStatus.HOLIDAY -> "Ta'til: $title"
    DayStatus.WEEKEND -> "Dam olish kuni"
    DayStatus.NO_TERM -> "O'quv davri emas"
    DayStatus.EXAM -> "Imtihon davri: $title"
    DayStatus.LESSON -> title
}

val Inter = FontFamily(
    Font(R.font.inter_regular, FontWeight.Normal),
    Font(R.font.inter_medium, FontWeight.Medium),
    Font(R.font.inter_semibold, FontWeight.SemiBold),
    Font(R.font.inter_bold, FontWeight.Bold),
    Font(R.font.inter_extrabold, FontWeight.ExtraBold),
)
