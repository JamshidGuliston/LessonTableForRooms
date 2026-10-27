package uz.darsjadval.tablet.ui

import java.time.LocalDate
import java.time.LocalDateTime

object Format {

    private val weekdays = listOf("Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba")
    private val months = listOf(
        "yanvar", "fevral", "mart", "aprel", "may", "iyun",
        "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
    )

    /** "Payshanba, 22-oktabr" */
    fun dateLabel(d: LocalDate) = "${weekdays[d.dayOfWeek.value - 1]}, ${d.dayOfMonth}-${months[d.monthValue - 1]}"

    /** "Darslar 10-noyabrdan davom etadi" */
    fun resumeLabel(d: LocalDate) = "Darslar ${d.dayOfMonth}-${months[d.monthValue - 1]}dan davom etadi"

    fun clock(t: LocalDateTime) = "%02d:%02d".format(t.hour, t.minute)

    fun hm(minutes: Int) = "%02d:%02d".format(minutes / 60, minutes % 60)

    fun range(start: Int, end: Int) = "${hm(start)}–${hm(end)}"
}
