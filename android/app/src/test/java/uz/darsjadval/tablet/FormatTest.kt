package uz.darsjadval.tablet

import org.junit.Assert.assertEquals
import org.junit.Test
import uz.darsjadval.tablet.ui.Format
import java.time.LocalDate
import java.time.LocalDateTime

class FormatTest {

    @Test
    fun dateLabelIsUzbekWeekdayAndMonth() {
        assertEquals("Payshanba, 22-oktabr", Format.dateLabel(LocalDate.of(2026, 10, 22)))
        assertEquals("Dushanba, 1-sentabr", Format.dateLabel(LocalDate.of(2025, 9, 1)))
        assertEquals("Yakshanba, 3-may", Format.dateLabel(LocalDate.of(2026, 5, 3)))
    }

    @Test
    fun resumeLabel() {
        assertEquals("Darslar 10-noyabrdan davom etadi", Format.resumeLabel(LocalDate.of(2025, 11, 10)))
    }

    @Test
    fun clockAndMinutes() {
        assertEquals("09:05", Format.clock(LocalDateTime.of(2025, 1, 1, 9, 5, 59)))
        assertEquals("08:30", Format.hm(8 * 60 + 30))
        assertEquals("10:20–11:05", Format.range(10 * 60 + 20, 11 * 60 + 5))
    }
}
