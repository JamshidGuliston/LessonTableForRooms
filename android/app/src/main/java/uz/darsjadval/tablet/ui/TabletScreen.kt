package uz.darsjadval.tablet.ui

import androidx.compose.animation.Crossfade
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import uz.darsjadval.tablet.Problem
import uz.darsjadval.tablet.UiState
import uz.darsjadval.tablet.data.DayEntry
import uz.darsjadval.tablet.data.DayStatus
import uz.darsjadval.tablet.data.EntryKind
import uz.darsjadval.tablet.data.EntryStatus
import uz.darsjadval.tablet.data.Schedule
import uz.darsjadval.tablet.data.TabletData

/**
 * O'lchamlar dizayndagi 1280×800 landshaft uchun berilgan (xona raqami 88, fan 60, soat 64 …).
 * Boshqa ekranlarda qisqa tomon bo'yicha masshtablanadi: portret 720×1280 dp → 0.9.
 */
private class Dims(val s: Float, val fontScale: Float) {
    fun dp(v: Number): Dp = (v.toFloat() * s).dp
    fun sp(v: Number): TextUnit = (v.toFloat() * s / fontScale).sp
}

private val LocalDims = staticCompositionLocalOf { Dims(1f, 1f) }

private val tabular = TextStyle(fontFamily = Inter, fontFeatureSettings = "tnum")

@Composable
fun TabletScreen(state: UiState) {
    BoxWithConstraints(
        Modifier
            .fillMaxSize()
            .background(Palette.bg),
    ) {
        val short = minOf(maxWidth.value, maxHeight.value)
        val dims = Dims((short / 800f).coerceIn(0.6f, 1.6f), LocalDensity.current.fontScale)
        CompositionLocalProvider(LocalDims provides dims) {
            val data = state.data
            when {
                data != null && state.problem != Problem.TOKEN_REJECTED && state.now != null ->
                    Schedule(data, state)
                state.problem == Problem.NOT_CONFIGURED || state.problem == Problem.TOKEN_REJECTED ->
                    SetupScreen(state)
                else -> Connecting(state)
            }
        }
    }
}

@Composable
private fun Schedule(data: TabletData, state: UiState) {
    val d = LocalDims.current
    val now = state.now!!
    val day = data.day
    val snap = Schedule.snapshot(day, now)

    Column(
        Modifier
            .fillMaxSize()
            .padding(horizontal = d.dp(32), vertical = d.dp(28)),
    ) {
        TopBar(data, state)
        Spacer(Modifier.height(d.dp(24)))

        when (day.status) {
            DayStatus.LESSON, DayStatus.EXAM -> {
                if (day.status == DayStatus.EXAM) {
                    ExamBanner(day.title)
                    Spacer(Modifier.height(d.dp(16)))
                }
                Crossfade(targetState = snap.current?.entry, label = "hero") { cur ->
                    if (cur != null) {
                        Hero(snap.current!!.copy(entry = cur), snap.next)
                    } else {
                        FreeHero(snap.next)
                    }
                }
                Spacer(Modifier.height(d.dp(20)))
                DayList(snap)
            }
            else -> DayOff(day.status, day.title, day.resumesOn)
        }
    }
}

// ───────────────────────────── Yuqori panel ─────────────────────────────

@Composable
private fun TopBar(data: TabletData, state: UiState) {
    val d = LocalDims.current
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            data.roomName,
            style = tabular,
            fontSize = d.sp(88),
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = (-0.03).em,
            color = Palette.text,
            maxLines = 1,
        )
        Spacer(Modifier.width(d.dp(28)))
        Box(
            Modifier
                .width(1.dp)
                .height(d.dp(72))
                .background(Palette.border),
        )
        Spacer(Modifier.width(d.dp(28)))
        Column(Modifier.weight(1f)) {
            Text(
                data.schoolName,
                fontFamily = Inter,
                fontSize = d.sp(26),
                fontWeight = FontWeight.SemiBold,
                color = Palette.text,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(d.dp(4)))
            Text(
                Format.dateLabel(state.now!!.toLocalDate()),
                fontFamily = Inter,
                fontSize = d.sp(21),
                color = Palette.muted,
                maxLines = 1,
            )
        }
        if (state.problem == Problem.OFFLINE) {
            OfflinePill(state)
            Spacer(Modifier.width(d.dp(20)))
        }
        Text(
            Format.clock(state.now!!),
            style = tabular,
            fontSize = d.sp(64),
            fontWeight = FontWeight.SemiBold,
            color = if (state.problem == Problem.OFFLINE) Palette.faint else Palette.text,
        )
    }
}

@Composable
private fun OfflinePill(state: UiState) {
    val d = LocalDims.current
    val last = state.lastUpdated?.let { " · oxirgi yangilanish %02d:%02d".format(it.hour, it.minute) } ?: ""
    Row(
        Modifier
            .clip(RoundedCornerShape(50))
            .background(Palette.surface)
            .border(1.dp, Palette.border, RoundedCornerShape(50))
            .padding(horizontal = d.dp(14), vertical = d.dp(8)),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(d.dp(10))
                .clip(CircleShape)
                .background(Palette.offline),
        )
        Spacer(Modifier.width(d.dp(8)))
        Text("Aloqa yo'q$last", fontFamily = Inter, fontSize = d.sp(15), color = Palette.muted, maxLines = 1)
    }
}

// ───────────────────────────── Hero kartasi ─────────────────────────────

@Composable
private fun Hero(current: Schedule.Current, next: DayEntry?) {
    val d = LocalDims.current
    val e = current.entry
    val c = kindColors(e.kind)
    val isBreak = e.kind == EntryKind.COFFEE_BREAK || e.kind == EntryKind.LUNCH
    val shape = RoundedCornerShape(d.dp(16))
    val bg = if (e.kind == EntryKind.LESSON) Palette.surface else c.tint
    val borderWidth = if (e.kind == EntryKind.EXAM) 3.dp else 2.dp

    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(bg)
            .border(borderWidth, c.accent, shape)
            .padding(horizontal = d.dp(40), vertical = d.dp(30)),
    ) {
        Text(
            "${kindLabel(e.kind)} · ${Format.range(e.startMin, e.endMin)}",
            style = tabular,
            fontSize = d.sp(20),
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.12.em,
            color = c.text,
        )
        Spacer(Modifier.height(d.dp(6)))
        Text(
            e.title,
            fontFamily = Inter,
            fontSize = d.sp(60),
            fontWeight = FontWeight.Bold,
            letterSpacing = (-0.01).em,
            color = if (isBreak) c.text else Palette.text,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        val sub = heroSubline(e)
        if (sub != null) {
            Spacer(Modifier.height(d.dp(6)))
            Text(sub, fontFamily = Inter, fontSize = d.sp(30), maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.height(d.dp(22)))
        ProgressBar(current.progress, c.accent)
        Spacer(Modifier.height(d.dp(16)))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "${current.minutesLeft} daqiqa qoldi",
                style = tabular,
                fontSize = d.sp(24),
                fontWeight = FontWeight.SemiBold,
                color = Palette.text,
            )
            Spacer(Modifier.weight(1f))
            NextLabel(next)
        }
    }
}

private fun heroSubline(e: DayEntry) = when {
    e.group == null && e.teacher == null -> null
    else -> buildAnnotatedString {
        e.group?.let {
            withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = Palette.text)) { append(it) }
            append("  ")
        }
        e.teacher?.let {
            withStyle(SpanStyle(color = Palette.muted)) {
                append(if (e.kind == EntryKind.EXAM) "Nazoratchi: $it" else it)
            }
        }
    }
}

@Composable
private fun FreeHero(next: DayEntry?) {
    val d = LocalDims.current
    val shape = RoundedCornerShape(d.dp(16))
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Palette.surface)
            .border(1.dp, Palette.border, shape)
            .padding(horizontal = d.dp(40), vertical = d.dp(30)),
    ) {
        Text(
            "HOZIR",
            fontFamily = Inter,
            fontSize = d.sp(20),
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.12.em,
            color = Palette.muted,
        )
        Spacer(Modifier.height(d.dp(6)))
        Text(
            "Xona bo'sh",
            fontFamily = Inter,
            fontSize = d.sp(60),
            fontWeight = FontWeight.Bold,
            color = Palette.muted,
        )
        Spacer(Modifier.height(d.dp(16)))
        Row {
            Spacer(Modifier.weight(1f))
            NextLabel(next, emptyText = "Bugun boshqa mashg'ulot yo'q")
        }
    }
}

@Composable
private fun NextLabel(next: DayEntry?, emptyText: String? = null) {
    val d = LocalDims.current
    val text = when {
        next != null -> "Keyingi: ${next.title} · ${Format.hm(next.startMin)}"
        else -> emptyText ?: return
    }
    Text(text, style = tabular, fontSize = d.sp(24), color = Palette.muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
}

@Composable
private fun ProgressBar(progress: Float, color: Color) {
    val d = LocalDims.current
    Box(
        Modifier
            .fillMaxWidth()
            .height(d.dp(8))
            .clip(RoundedCornerShape(50))
            .background(Palette.border),
    ) {
        Box(
            Modifier
                .fillMaxWidth(progress)
                .fillMaxHeight()
                .clip(RoundedCornerShape(50))
                .background(color),
        )
    }
}

// ───────────────────────────── Kun ro'yxati ─────────────────────────────

@Composable
private fun DayList(snap: Schedule.Snapshot) {
    val d = LocalDims.current
    if (snap.entries.isEmpty()) {
        Text(
            "Bu xonada bugun mashg'ulot yo'q",
            fontFamily = Inter,
            fontSize = d.sp(24),
            color = Palette.muted,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = d.dp(40)),
            textAlign = TextAlign.Center,
        )
        return
    }
    // Ekran sensorsiz — ro'yxat o'zi joriy qatorga suriladi (bitta o'tgan qator ko'rinib turadi).
    val listState = rememberLazyListState()
    LaunchedEffect(snap.focusIndex) {
        listState.animateScrollToItem((snap.focusIndex - 1).coerceAtLeast(0))
    }
    LazyColumn(
        state = listState,
        userScrollEnabled = false,
        verticalArrangement = Arrangement.spacedBy(d.dp(8)),
        modifier = Modifier.fillMaxSize(),
    ) {
        itemsIndexed(snap.entries, key = { i, it -> "$i-${it.entry.startMin}-${it.entry.title}" }) { _, item ->
            EntryRow(item)
        }
    }
}

@Composable
private fun EntryRow(item: Schedule.Item) {
    val d = LocalDims.current
    val e = item.entry
    val c = kindColors(e.kind)
    val isBreak = e.kind == EntryKind.COFFEE_BREAK || e.kind == EntryKind.LUNCH
    val active = item.status == EntryStatus.ACTIVE
    val radius = d.dp(12)
    val shape = RoundedCornerShape(radius)

    val base = Modifier
        .fillMaxWidth()
        .alpha(if (item.status == EntryStatus.PAST) 0.4f else 1f)
        .clip(shape)
        .background(
            when {
                active && e.kind == EntryKind.EXAM -> c.tint
                active || !isBreak -> Palette.surface
                else -> Palette.surface2
            },
        )
    val bordered = when {
        active -> base.border(2.dp, c.accent, shape)
        isBreak -> base.dashedBorder(Palette.border, radius)
        else -> base.border(1.dp, Palette.border, shape)
    }

    Row(
        bordered.padding(horizontal = d.dp(28), vertical = d.dp(12)),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.width(d.dp(120))) {
            Text(
                Format.hm(e.startMin),
                style = tabular,
                fontSize = d.sp(22),
                fontWeight = FontWeight.SemiBold,
                color = Palette.text,
            )
            Text(Format.hm(e.endMin), style = tabular, fontSize = d.sp(15), color = Palette.muted)
        }
        Box(
            Modifier
                .size(d.dp(12))
                .clip(CircleShape)
                .background(e.color?.let(::parseColor) ?: c.accent),
        )
        Spacer(Modifier.width(d.dp(28)))
        Column(Modifier.weight(1f)) {
            Text(
                e.title,
                fontFamily = Inter,
                fontSize = d.sp(22),
                fontWeight = FontWeight.SemiBold,
                color = if (isBreak) c.text else Palette.text,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            val sub = listOfNotNull(e.group, e.teacher?.let { if (e.kind == EntryKind.EXAM) "Nazoratchi: $it" else it })
            if (sub.isNotEmpty()) {
                Text(
                    sub.joinToString(" · "),
                    fontFamily = Inter,
                    fontSize = d.sp(16),
                    color = Palette.muted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Spacer(Modifier.width(d.dp(16)))
        Text(
            kindLabel(e.kind),
            fontFamily = Inter,
            fontSize = d.sp(15),
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.12.em,
            color = c.text,
        )
    }
}

private fun Modifier.dashedBorder(color: Color, radius: Dp) = drawBehind {
    val r = radius.toPx()
    val w = 1.dp.toPx()
    drawRoundRect(
        color = color,
        topLeft = androidx.compose.ui.geometry.Offset(w / 2, w / 2),
        size = androidx.compose.ui.geometry.Size(size.width - w, size.height - w),
        cornerRadius = CornerRadius(r, r),
        style = Stroke(width = w, pathEffect = PathEffect.dashPathEffect(floatArrayOf(6.dp.toPx(), 4.dp.toPx()))),
    )
}

private fun parseColor(hex: String): Color? = try {
    Color(android.graphics.Color.parseColor(hex))
} catch (e: IllegalArgumentException) {
    null
}

// ───────────────────────────── Imtihon / ta'til ─────────────────────────────

@Composable
private fun ExamBanner(title: String) {
    val d = LocalDims.current
    val c = kindColors(EntryKind.EXAM)
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(d.dp(14)))
            .background(c.accent)
            .padding(horizontal = d.dp(28), vertical = d.dp(14)),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("⚠", fontSize = d.sp(26), color = Palette.text)
        Spacer(Modifier.width(d.dp(14)))
        Text(
            dayStateTitle(DayStatus.EXAM, title),
            fontFamily = Inter,
            fontSize = d.sp(26),
            fontWeight = FontWeight.Bold,
            color = Palette.text,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun DayOff(status: DayStatus, title: String, resumesOn: java.time.LocalDate?) {
    val d = LocalDims.current
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                Modifier
                    .size(d.dp(96))
                    .clip(RoundedCornerShape(d.dp(24)))
                    .background(Palette.surface)
                    .border(1.dp, Palette.border, RoundedCornerShape(d.dp(24))),
                contentAlignment = Alignment.Center,
            ) {
                Text("📅", fontSize = d.sp(44))
            }
            Spacer(Modifier.height(d.dp(32)))
            Text(
                dayStateTitle(status, title),
                fontFamily = Inter,
                fontSize = d.sp(56),
                fontWeight = FontWeight.Bold,
                color = Palette.text,
                textAlign = TextAlign.Center,
            )
            if (resumesOn != null) {
                Spacer(Modifier.height(d.dp(14)))
                Text(
                    Format.resumeLabel(resumesOn),
                    fontFamily = Inter,
                    fontSize = d.sp(28),
                    color = Palette.muted,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

// ───────────────────────────── Sozlash / ulanish ─────────────────────────────

@Composable
private fun SetupScreen(state: UiState) {
    val d = LocalDims.current
    val rejected = state.problem == Problem.TOKEN_REJECTED
    val canPair = state.config.server.isNotBlank()
    Column(
        Modifier
            .fillMaxSize()
            .padding(d.dp(56)),
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            if (rejected) "Xona topilmadi" else "Planshetni xonaga ulash",
            fontFamily = Inter,
            fontSize = d.sp(56),
            fontWeight = FontWeight.Bold,
            color = Palette.text,
        )
        Spacer(Modifier.height(d.dp(16)))
        Text(
            when {
                !canPair -> "Server manzili berilmagan. Maktab adminiga murojaat qiling."
                rejected -> "Planshet tokeni bekor qilingan. Qayta ulash uchun admin panelda quyidagi kodni kiriting."
                else -> "Admin panel → Planshetlar → xonani tanlang → «Kod bilan ulash» ga shu kodni kiriting."
            },
            fontFamily = Inter,
            fontSize = d.sp(26),
            color = Palette.muted,
        )
        Spacer(Modifier.height(d.dp(40)))
        val shape = RoundedCornerShape(d.dp(14))
        Column(
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(Palette.surface)
                .border(1.dp, Palette.border, shape)
                .padding(d.dp(28)),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (canPair) {
                Text("Ulash kodi", fontFamily = Inter, fontSize = d.sp(22), color = Palette.muted)
                Spacer(Modifier.height(d.dp(8)))
                val code = state.pairCode
                Text(
                    if (code != null) "${code.take(3)} ${code.drop(3)}" else "…",
                    style = tabular,
                    fontSize = d.sp(120),
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.08.em,
                    color = Palette.text,
                )
                Spacer(Modifier.height(d.dp(8)))
                Text(
                    if (code != null) "Kod 15 daqiqa amal qiladi, keyin o'zi yangilanadi" else "Serverga ulanmoqda…",
                    fontFamily = Inter,
                    fontSize = d.sp(18),
                    color = Palette.faint,
                )
            } else {
                Text(
                    "adb shell am start -n uz.darsjadval.tablet/.MainActivity --es server https://SERVER --es token XONA_TOKENI",
                    style = tabular,
                    fontSize = d.sp(18),
                    color = Palette.text,
                )
            }
        }
        Spacer(Modifier.height(d.dp(16)))
        Text(
            "Server: ${state.config.server.ifBlank { "—" }}",
            style = tabular,
            fontSize = d.sp(16),
            color = Palette.faint,
        )
    }
}

@Composable
private fun Connecting(state: UiState) {
    val d = LocalDims.current
    Column(
        Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            if (state.problem == Problem.OFFLINE) "Server bilan aloqa yo'q" else "Ulanmoqda…",
            fontFamily = Inter,
            fontSize = d.sp(44),
            fontWeight = FontWeight.Bold,
            color = Palette.text,
        )
        Spacer(Modifier.height(d.dp(12)))
        Text(
            if (state.problem == Problem.OFFLINE) "Qayta urinilmoqda · ${state.config.server}" else state.config.server,
            style = tabular,
            fontSize = d.sp(22),
            color = Palette.muted,
        )
    }
}
