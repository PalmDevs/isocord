package me.palmdevs.isocord.voice.telecom

import android.Manifest
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/**
 * Keeps the process, the microphone, the camera and screen capture alive in the background. Android stops them
 * without a foreground service of the matching type. Reference: `com.discord.foreground_service.ForegroundService`.
 * It shows the call notification, so every change of [CallFlags] or [CallDetails] goes through [refresh].
 */
class CallService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    running = this
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!promote()) stopSelf()
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    running = null
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }

  /** Goes to the foreground, or updates the notification and the service types. Returns false if Android refused. */
  private fun promote(): Boolean {
    val call = CallTelecom.active
    // A call that ended before the service started still owes Android a foreground notification.
    val notification =
      if (call == null) CallNotification.placeholder(this) else CallNotification.build(this, call.details, call.flags)
    val flags = call?.flags ?: CallFlags()
    val telecom = call?.usesTelecom ?: false
    try {
      ServiceCompat.startForeground(this, CallNotification.ID, notification, serviceTypes(flags, telecom))
      return call != null
    } catch (e: SecurityException) {
      // A type whose permission or state Android refuses (a camera type without the permission crashes the process).
      Log.w(CALL_TAG, "service types ${serviceTypes(flags, telecom)} refused, falling back", e)
    } catch (e: IllegalStateException) {
      // Android 12+ ForegroundServiceStartNotAllowedException: started while the app was not allowed to.
      Log.w(CALL_TAG, "foreground start refused", e)
      return false
    }
    return try {
      ServiceCompat.startForeground(this, CallNotification.ID, notification, baseTypes(telecom))
      call != null
    } catch (e: SecurityException) {
      Log.e(CALL_TAG, "foreground start refused even with the base types", e)
      false
    }
  }

  /** The base types, plus camera while it runs and is allowed, plus mediaProjection while the screen is shared. */
  private fun serviceTypes(flags: CallFlags, telecom: Boolean): Int {
    var types = baseTypes(telecom)
    // Camera and microphone types exist from API 30, mediaProjection from 29. Earlier, a service needs none.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && flags.camera && cameraAllowed(this)) {
      types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && flags.screen) {
      types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
    }
    return types
  }

  /**
   * The microphone always. From API 34 also phoneCall for a Telecom call, which core-telecom's foreground support
   * asks for. A call without Telecom is no phone call, so it keeps the microphone type, as the reference's service.
   */
  private fun baseTypes(telecom: Boolean): Int {
    var types = 0
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
    if (telecom && Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL
    }
    return types
  }

  private fun cameraAllowed(context: Context) =
    ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

  companion object {
    @Volatile private var running: CallService? = null

    /** Starts the service. Call while the app is in front: Android 12+ refuses it from the background. */
    fun start(context: Context) {
      try {
        ContextCompat.startForegroundService(context, Intent(context, CallService::class.java))
      } catch (e: IllegalStateException) {
        // ForegroundServiceStartNotAllowedException: the call goes on, but nothing keeps it alive in the background.
        Log.e(CALL_TAG, "call service start refused", e)
      }
    }

    /** Re-reads the call and updates the notification and the types. Allowed in the background: it is already running. */
    fun refresh() {
      if (CallTelecom.active != null) running?.promote()
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, CallService::class.java))
      NotificationManagerCompat.from(context).cancel(CallNotification.ID)
    }
  }
}
