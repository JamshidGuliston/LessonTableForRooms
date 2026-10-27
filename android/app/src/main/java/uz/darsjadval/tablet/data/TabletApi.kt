package uz.darsjadval.tablet.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

class TokenRejectedException : IOException("Xona tokeni qabul qilinmadi")

object TabletApi {

    /** Tashqi kutubxonasiz — eski planshetda APK kichik va oddiy bo'lsin. */
    suspend fun fetch(config: TabletConfig): TabletData = withContext(Dispatchers.IO) {
        val conn = URL(config.tabletUrl).openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 10_000
            conn.readTimeout = 15_000
            conn.setRequestProperty("Accept", "application/json")
            when (val code = conn.responseCode) {
                200 -> TabletJson.parse(conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() })
                404 -> throw TokenRejectedException()
                else -> throw IOException("HTTP $code")
            }
        } finally {
            conn.disconnect()
        }
    }
}
