package uz.darsjadval.tablet

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import uz.darsjadval.tablet.data.DayEntry
import uz.darsjadval.tablet.data.DayStatus
import uz.darsjadval.tablet.data.EntryKind
import uz.darsjadval.tablet.data.EntryStatus
import uz.darsjadval.tablet.data.RoomDay
import uz.darsjadval.tablet.data.Schedule
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

class ScheduleTest {

    private val date = LocalDate.of(2025, 10, 20)

    private fun e(title: String, start: String, end: String, kind: EntryKind = EntryKind.LESSON) = DayEntry(
        kind = kind, title = title,
        startMin = LocalTime.parse(start).let { it.hour * 60 + it.minute },
        endMin = LocalTime.parse(end).let { it.hour * 60 + it.minute },
        group = null, teacher = null, color = null,
    )

    private val day = RoomDay(
        date = date, status = DayStatus.LESSON, title = "1-chorak", resumesOn = null,
        entries = listOf(
            e("Matematika", "08:30", "09:15"),
            e("Tanaffus", "09:15", "09:25", EntryKind.COFFEE_BREAK),
            e("Fizika", "09:25", "10:10"),
        ),
    )

    private fun at(time: String) = LocalDateTime.of(date, LocalTime.parse(time))

    @Test
    fun entryInProgressIsActiveAndOthersArePastOrUpcoming() {
        val snap = Schedule.snapshot(day, at("09:20"))
        assertEquals(listOf(EntryStatus.PAST, EntryStatus.ACTIVE, EntryStatus.UPCOMING), snap.entries.map { it.status })
        assertEquals("Tanaffus", snap.current?.entry?.title)
        assertEquals("Fizika", snap.next?.title)
    }

    @Test
    fun startIsInclusiveEndIsExclusive() {
        assertEquals("Matematika", Schedule.snapshot(day, at("08:30")).current?.entry?.title)
        assertEquals("Tanaffus", Schedule.snapshot(day, at("09:15")).current?.entry?.title)
    }

    @Test
    fun beforeFirstEntryNothingIsCurrent() {
        val snap = Schedule.snapshot(day, at("07:00"))
        assertNull(snap.current)
        assertEquals("Matematika", snap.next?.title)
    }

    @Test
    fun afterLastEntryNothingIsCurrentOrNext() {
        val snap = Schedule.snapshot(day, at("12:00"))
        assertNull(snap.current)
        assertNull(snap.next)
        assertEquals(EntryStatus.PAST, snap.entries.last().status)
    }

    @Test
    fun minutesLeftRoundsUpAndProgressIsFraction() {
        // Fizika 09:25–10:10 (45 daq), hozir 09:47:30 → 22.5 daq qoldi → 23; o'tgan 22.5/45 = 0.5
        val snap = Schedule.snapshot(day, LocalDateTime.of(date, LocalTime.of(9, 47, 30)))
        assertEquals(23, snap.current?.minutesLeft)
        assertEquals(0.5f, snap.current!!.progress, 0.001f)
    }

    @Test
    fun anotherDayLeavesEverythingUpcoming() {
        val snap = Schedule.snapshot(day, LocalDateTime.of(date.plusDays(1), LocalTime.of(9, 0)))
        assertEquals(List(3) { EntryStatus.UPCOMING }, snap.entries.map { it.status })
        assertNull(snap.current)
    }

    @Test
    fun indexOfFocusPointsAtCurrentOrNext() {
        assertEquals(1, Schedule.snapshot(day, at("09:20")).focusIndex)
        assertEquals(0, Schedule.snapshot(day, at("07:00")).focusIndex)
        assertEquals(2, Schedule.snapshot(day, at("12:00")).focusIndex)
    }
}
