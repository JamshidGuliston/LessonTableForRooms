package uz.darsjadval.tablet.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

class TokenRejectedException : IOException("Xona tokeni qabul qilinmadi")

/** Ulash kodi muddati o'tdi — yangisini so'rash kerak. */
class PairingExpiredException : IOException("Ulash kodi muddati o'tdi")

object TabletApi {

    /** Tashqi kutubxonasiz — eski planshetda APK kichik va oddiy bo'lsin. */
    suspend fun fetch(config: TabletConfig): TabletData =
        request(config.tabletUrl, "GET") { code, body ->
            when (code) {
                200 -> TabletJson.parse(body, config.server)
                404 -> throw TokenRejectedException()
                else -> throw IOException("HTTP $code")
            }
        }

    suspend fun pairStart(server: String): PairStart =
        request("${server.trimEnd('/')}/api/tablet/pair/", "POST") { code, body ->
            if (code == 201) TabletJson.parsePairStart(body) else throw IOException("HTTP $code")
        }

    suspend fun pairStatus(server: String, secret: String): PairStatus =
        request("${server.trimEnd('/')}/api/tablet/pair/$secret/", "GET") { code, body ->
            when (code) {
                200 -> TabletJson.parsePairStatus(body)
                404 -> throw PairingExpiredException()
                else -> throw IOException("HTTP $code")
            }
        }

    private suspend fun <T> request(url: String, method: String, handle: (Int, String) -> T): T =
        withContext(Dispatchers.IO) {
            val conn = URL(url).openConnection() as HttpURLConnection
            try {
                conn.connectTimeout = 10_000
                conn.readTimeout = 15_000
                conn.requestMethod = method
                conn.setRequestProperty("Accept", "application/json")
                if (method == "POST") {
                    conn.doOutput = true
                    conn.setFixedLengthStreamingMode(0)
                }
                val code = conn.responseCode
                val stream = if (code < 400) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
                handle(code, body)
            } finally {
                conn.disconnect()
            }
        }
}
