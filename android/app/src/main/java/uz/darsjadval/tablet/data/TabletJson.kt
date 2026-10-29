package uz.darsjadval.tablet.data

import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalDateTime

object TabletJson {

    fun parsePairStart(body: String): PairStart {
        val root = JSONObject(body)
        return PairStart(secret = root.getString("secret"), code = root.getString("code"))
    }

    fun parsePairStatus(body: String): PairStatus {
        val root = JSONObject(body)
        return if (root.optString("status") == "paired") {
            PairStatus.Paired(token = root.getString("token"))
        } else {
            PairStatus.Pending(code = root.optString("code"))
        }
    }

    /** `server` — rasmlarning nisbiy manzili (/media/...) shunga qo'shiladi. */
    fun parse(body: String, server: String = ""): TabletData {
        val root = JSONObject(body)
        val base = server.trimEnd('/')
        fun url(o: JSONObject) = o.nullableString("image")?.let { if (it.startsWith("http")) it else base + it }
        val day = root.getJSONObject("day")
        val entries = day.optJSONArray("entries")
        return TabletData(
            schoolName = root.getJSONObject("school").optString("name"),
            roomName = root.getJSONObject("room").optString("name"),
            serverNow = LocalDateTime.parse(root.getString("now")),
            day = RoomDay(
                date = LocalDate.parse(day.getString("date")),
                status = dayStatus(day.optString("status")),
                title = day.optString("title"),
                resumesOn = day.nullableString("resumes_on")?.let(LocalDate::parse),
                entries = (0 until (entries?.length() ?: 0)).map {
                    val o = entries!!.getJSONObject(it)
                    entry(o).copy(image = url(o))
                },
            ),
            quote = root.optJSONObject("quote")?.let {
                Quote(text = it.optString("text"), author = it.nullableString("author"), image = url(it))
            },
        )
    }

    private fun entry(o: JSONObject) = DayEntry(
        kind = entryKind(o.optString("kind")),
        title = o.optString("title"),
        startMin = minutes(o.getString("start_time")),
        endMin = minutes(o.getString("end_time")),
        group = o.nullableString("group"),
        teacher = o.nullableString("teacher"),
        color = o.nullableString("subject_color"),
    )

    private fun minutes(hhmm: String): Int {
        val (h, m) = hhmm.split(":").map { it.toInt() }
        return h * 60 + m
    }

    // Backend yangi tur qo'shsa ham ilova yiqilmasin — oddiy dars sifatida ko'rsatiladi.
    private fun entryKind(s: String) = when (s) {
        "exam" -> EntryKind.EXAM
        "coffee_break" -> EntryKind.COFFEE_BREAK
        "lunch" -> EntryKind.LUNCH
        "club" -> EntryKind.CLUB
        "free" -> EntryKind.FREE
        else -> EntryKind.LESSON
    }

    private fun dayStatus(s: String) = when (s) {
        "exam" -> DayStatus.EXAM
        "holiday" -> DayStatus.HOLIDAY
        "weekend" -> DayStatus.WEEKEND
        "no_term" -> DayStatus.NO_TERM
        else -> DayStatus.LESSON
    }

    private fun JSONObject.nullableString(key: String): String? =
        if (!has(key) || isNull(key)) null else optString(key).takeIf { it.isNotEmpty() }
}
