package uz.darsjadval.tablet

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Planshet har kuni yoqilganda (yoki ilova yangilanganda) jadval ekranini ochadi.
 * Android 7.1 da fon qabul qiluvchidan activity ochishga ruxsat bor.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            "android.intent.action.QUICKBOOT_POWERON",
            "com.htc.intent.action.QUICKBOOT_POWERON",
            -> TabletApp.launchMain(context)
        }
    }
}
