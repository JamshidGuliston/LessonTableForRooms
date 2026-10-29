package uz.darsjadval.tablet

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import uz.darsjadval.tablet.data.DayStatus
import uz.darsjadval.tablet.data.EntryKind
import uz.darsjadval.tablet.data.PairStart
import uz.darsjadval.tablet.data.PairStatus
import uz.darsjadval.tablet.data.TabletJson
import java.time.LocalDate
import java.time.LocalDateTime

class TabletJsonTest {

    private val sample = """
        {
          "school": {"slug": "demo", "name": "Demo maktab", "timezone": "Asia/Tashkent", "working_days": "0,1,2,3,4,5"},
          "room": {"id": 1, "name": "101", "floor": "1"},
          "now": "2025-10-20T10:42:05",
          "day": {
            "date": "2025-10-20", "weekday": 0, "status": "lesson", "title": "1-chorak", "resumes_on": null,
            "entries": [
              {"kind": "lesson", "title": "Tarix", "start_time": "10:20", "end_time": "11:05",
               "group": "9-A", "teacher": "Nazarova Gulnora", "subject_color": "#F97316", "status": "active",
               "image": "/media/groups/beruniy.jpg", "group_ids": [3]},
              {"kind": "lunch", "title": "Tushlik", "start_time": "11:05", "end_time": "11:45",
               "group": null, "teacher": null, "subject_color": null, "status": "upcoming"},
              {"kind": "club", "title": "Shaxmat", "start_time": "14:30", "end_time": "16:00",
               "group": null, "teacher": "Rahimov S.", "subject_color": null, "status": "upcoming"},
              {"kind": "free", "title": "Xona bo'sh", "start_time": "16:00", "end_time": "16:45",
               "group": null, "teacher": null, "subject_color": null, "status": "upcoming"}
            ],
            "current": null, "next": null
          },
          "quote": {"text": "Yoshlar bizning tayanchimiz", "author": "Sh. Mirziyoyev", "image": null}
        }
    """.trimIndent()

    @Test
    fun parsesSchoolRoomAndServerTime() {
        val data = TabletJson.parse(sample)
        assertEquals("Demo maktab", data.schoolName)
        assertEquals("101", data.roomName)
        assertEquals(LocalDateTime.of(2025, 10, 20, 10, 42, 5), data.serverNow)
    }

    @Test
    fun parsesDayAndEntries() {
        val day = TabletJson.parse(sample).day
        assertEquals(LocalDate.of(2025, 10, 20), day.date)
        assertEquals(DayStatus.LESSON, day.status)
        assertEquals(4, day.entries.size)

        val tarix = day.entries[0]
        assertEquals(EntryKind.LESSON, tarix.kind)
        assertEquals("Tarix", tarix.title)
        assertEquals(10 * 60 + 20, tarix.startMin)
        assertEquals(11 * 60 + 5, tarix.endMin)
        assertEquals("9-A", tarix.group)
        assertEquals("Nazarova Gulnora", tarix.teacher)
        assertEquals("#F97316", tarix.color)

        val lunch = day.entries[1]
        assertEquals(EntryKind.LUNCH, lunch.kind)
        assertNull(lunch.group)
        assertNull(lunch.teacher)
        assertNull(lunch.color)

        assertEquals(EntryKind.CLUB, day.entries[2].kind)
    }

    @Test
    fun parsesFreePeriodAndQuote() {
        val data = TabletJson.parse(sample)
        assertEquals(EntryKind.FREE, data.day.entries.last().kind)
        assertEquals("Yoshlar bizning tayanchimiz", data.quote?.text)
        assertEquals("Sh. Mirziyoyev", data.quote?.author)
    }

    @Test
    fun resolvesImageUrlsAgainstServer() {
        val data = TabletJson.parse(sample, "https://timetable.gulistanps.uz/")
        assertEquals("https://timetable.gulistanps.uz/media/groups/beruniy.jpg", data.day.entries[0].image)
        assertNull(data.day.entries[1].image)
        assertNull(data.quote?.image)

        val withPhoto = sample.replace("\"image\": null}", "\"image\": \"/media/quotes/navoiy.png\"}")
        assertEquals(
            "https://timetable.gulistanps.uz/media/quotes/navoiy.png",
            TabletJson.parse(withPhoto, "https://timetable.gulistanps.uz").quote?.image,
        )
    }

    @Test
    fun nullQuoteIsNull() {
        assertNull(TabletJson.parse(sample.replace(Regex("\"quote\": \\{[^}]*\\}"), "\"quote\": null")).quote)
    }

    @Test
    fun parsesHolidayResumeDate() {
        val json = """
            {"school": {"name": "S"}, "room": {"name": "101"}, "now": "2025-11-05T09:00:00",
             "day": {"date": "2025-11-05", "weekday": 2, "status": "holiday", "title": "Kuzgi ta'til",
                     "resumes_on": "2025-11-10", "entries": [], "current": null, "next": null}}
        """.trimIndent()
        val day = TabletJson.parse(json).day
        assertEquals(DayStatus.HOLIDAY, day.status)
        assertEquals("Kuzgi ta'til", day.title)
        assertEquals(LocalDate.of(2025, 11, 10), day.resumesOn)
    }

    @Test
    fun unknownKindAndStatusFallBackSafely() {
        val json = """
            {"school": {"name": "S"}, "room": {"name": "101"}, "now": "2025-11-05T09:00:00",
             "day": {"date": "2025-11-05", "weekday": 2, "status": "something_new", "title": "",
                     "entries": [{"kind": "assembly", "title": "Yig'ilish", "start_time": "08:00", "end_time": "08:20"}]}}
        """.trimIndent()
        val day = TabletJson.parse(json).day
        assertEquals(DayStatus.LESSON, day.status)
        assertEquals(EntryKind.LESSON, day.entries[0].kind)
        assertNull(day.resumesOn)
    }

    @Test
    fun parsesPairing() {
        assertEquals(
            PairStart(secret = "s3cr3t", code = "482913"),
            TabletJson.parsePairStart("""{"secret": "s3cr3t", "code": "482913", "expires_in": 900}"""),
        )
        assertEquals(
            PairStatus.Pending("482913"),
            TabletJson.parsePairStatus("""{"status": "pending", "code": "482913", "expires_in": 880}"""),
        )
        assertEquals(
            PairStatus.Paired("TOKEN"),
            TabletJson.parsePairStatus("""{"status": "paired", "token": "TOKEN", "room": {"id": 1, "name": "104"}}"""),
        )
    }
}
