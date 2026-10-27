package uz.darsjadval.tablet.data

import android.content.Context
import uz.darsjadval.tablet.BuildConfig

/**
 * Server manzili va xona tokeni. Planshet sensorsiz bo'lgani uchun ular
 * adb orqali beriladi va saqlanib qoladi:
 *
 *   adb shell am start -n uz.darsjadval.tablet/.MainActivity \
 *       --es server http://192.168.1.10:8000 --es token <xona tokeni>
 *
 * Yoki build paytida: -PdefaultServer=... -PdefaultToken=...
 */
data class TabletConfig(val server: String, val token: String) {

    val isComplete get() = server.isNotBlank() && token.isNotBlank()

    val tabletUrl get() = "${server.trimEnd('/')}/api/tablet/$token/"

    companion object {
        private const val PREFS = "tablet"

        fun load(context: Context): TabletConfig {
            val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            return TabletConfig(
                server = p.getString("server", null) ?: BuildConfig.DEFAULT_SERVER,
                token = p.getString("token", null) ?: BuildConfig.DEFAULT_TOKEN,
            )
        }

        /** Faqat berilgan qiymatlarni yangilaydi. O'zgargan bo'lsa true. */
        fun update(context: Context, server: String?, token: String?): Boolean {
            if (server.isNullOrBlank() && token.isNullOrBlank()) return false
            val before = load(context)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().apply {
                if (!server.isNullOrBlank()) putString("server", server.trim())
                if (!token.isNullOrBlank()) putString("token", token.trim())
            }.commit()
            return load(context) != before
        }
    }
}
