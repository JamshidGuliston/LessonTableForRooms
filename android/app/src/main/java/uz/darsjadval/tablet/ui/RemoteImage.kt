package uz.darsjadval.tablet.ui

import android.graphics.BitmapFactory
import android.util.LruCache
import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

/**
 * Alloma / muallif rasmlari uchun oddiy yuklovchi — tashqi kutubxonasiz (APK kichik qolsin).
 * Server rasmni 800 px gacha kichraytirib beradi; xotirada oxirgi bir nechtasi saqlanadi,
 * shuning uchun aloqa uzilsa ham ko'rinib turgan rasm yo'qolmaydi.
 */
object ImageLoader {
    private val cache = LruCache<String, ImageBitmap>(12)

    fun cached(url: String): ImageBitmap? = cache.get(url)

    suspend fun load(url: String): ImageBitmap? = cache.get(url) ?: withContext(Dispatchers.IO) {
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 10_000
            conn.readTimeout = 15_000
            if (conn.responseCode != 200) return@withContext null
            val bytes = conn.inputStream.use { it.readBytes() }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()?.also { cache.put(url, it) }
        } catch (e: Exception) {
            null
        } finally {
            conn.disconnect()
        }
    }
}

/** Rasm yuklanguncha (yoki yuklanmasa) hech narsa chizmaydi — joy ham egallamaydi. */
@Composable
fun RemoteImage(url: String, modifier: Modifier = Modifier, contentDescription: String? = null) {
    val bitmap by produceState(ImageLoader.cached(url), url) {
        while (value == null) {
            value = ImageLoader.load(url)
            if (value == null) delay(30_000) // Wi-Fi uzilgan bo'lishi mumkin — keyinroq yana
        }
    }
    bitmap?.let { Image(it, contentDescription, modifier, contentScale = ContentScale.Crop) }
}
