package uz.darsjadval.tablet.data

import java.time.LocalDateTime

/**
 * Hozirgi vaqtga nisbatan holatlarni planshetning o'zida hisoblaydi — server har 30 soniyada
 * so'raladi, lekin faol dars aynan daqiqasida almashishi kerak (internet uzilganda ham).
 */
object Schedule {

    data class Item(val entry: DayEntry, val status: EntryStatus)

    data class Current(val entry: DayEntry, val minutesLeft: Int, val progress: Float)

    data class Snapshot(
        val entries: List<Item>,
        val current: Current?,
        val next: DayEntry?,
        /** Ro'yxatni shu qatorga aylantirish kerak: joriy, bo'lmasa keyingi, bo'lmasa oxirgi */
        val focusIndex: Int,
    )

    fun snapshot(day: RoomDay, now: LocalDateTime): Snapshot {
        val sorted = day.entries.sortedBy { it.startMin }
        val today = now.toLocalDate() == day.date
        val nowSec = now.toLocalTime().toSecondOfDay()

        val items = sorted.map { e ->
            val status = when {
                !today -> EntryStatus.UPCOMING
                nowSec < e.startMin * 60 -> EntryStatus.UPCOMING
                nowSec < e.endMin * 60 -> EntryStatus.ACTIVE
                else -> EntryStatus.PAST
            }
            Item(e, status)
        }

        // Bo'sh soat "hozir"/"keyingi" emas — hero "Xona bo'sh" va keyingi haqiqiy mashg'ulotni ko'rsatadi
        val busy = items.filter { it.entry.kind != EntryKind.FREE }
        val current = busy.firstOrNull { it.status == EntryStatus.ACTIVE }?.entry?.let { e ->
            val total = (e.endMin - e.startMin) * 60
            val left = e.endMin * 60 - nowSec
            Current(
                entry = e,
                minutesLeft = (left + 59) / 60,
                progress = if (total <= 0) 1f else ((total - left).toFloat() / total).coerceIn(0f, 1f),
            )
        }
        val nextIndex = items.indexOfFirst { it.status == EntryStatus.UPCOMING }
        val currentIndex = items.indexOfFirst { it.status == EntryStatus.ACTIVE }
        val next = busy.firstOrNull { it.status == EntryStatus.UPCOMING }?.entry

        return Snapshot(
            entries = items,
            current = current,
            next = next,
            focusIndex = when {
                currentIndex >= 0 -> currentIndex
                nextIndex >= 0 -> nextIndex
                else -> (items.size - 1).coerceAtLeast(0)
            },
        )
    }
}
