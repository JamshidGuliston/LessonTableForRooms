package uz.darsjadval.tablet

import android.app.AlarmManager
import android.app.Application
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Process
import android.os.SystemClock
import android.util.Log
import kotlin.system.exitProcess

/**
 * Kiosk ilovasi hech qachon "yopilib qolmasligi" kerak: kutilmagan xato bo'lsa,
 * 3 soniyadan keyin ilova qayta ochiladi.
 */
class TabletApp : Application() {

    override fun onCreate() {
        super.onCreate()
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            Log.e(TAG, "Kutilmagan xato, ilova qayta ishga tushiriladi", error)
            try {
                scheduleRestart(this, delayMs = 3_000)
            } catch (_: Throwable) {
                previous?.uncaughtException(thread, error)
            }
            Process.killProcess(Process.myPid())
            exitProcess(10)
        }
    }

    companion object {
        private const val TAG = "DarsJadval"

        fun mainIntent(context: Context) = Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)

        fun launchMain(context: Context) {
            context.startActivity(mainIntent(context))
        }

        fun scheduleRestart(context: Context, delayMs: Long) {
            val pending = PendingIntent.getActivity(
                context, 0, mainIntent(context),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            alarm.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, SystemClock.elapsedRealtime() + delayMs, pending)
        }
    }
}
