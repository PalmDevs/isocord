package me.palmdevs.isocord.notifications.gateway

import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.ConnectivityManager
import android.net.Network
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import kotlinx.serialization.builtins.ListSerializer
import me.palmdevs.isocord.MainActivity
import me.palmdevs.isocord.R
import me.palmdevs.isocord.network.ReadStateType
import me.palmdevs.isocord.notifications.notify.AccountConfig
import me.palmdevs.isocord.notifications.notify.MessageNotifier
import me.palmdevs.isocord.notifications.notify.NotificationPrefs
import me.palmdevs.isocord.notifications.notify.NotificationState
import me.palmdevs.isocord.notifications.notify.SessionNotifier

private const val TAG = "IsocordGatewayService"

/**
 * Whether the app is in front (resumed, see [me.palmdevs.isocord.notifications.Handover] for returns). Then its own gateway connection is the only one: JS forwards its dispatches
 * ([me.palmdevs.isocord.notifications.notify.AppSession]) and [GatewayService] pauses its session.
 */
object AppVisibility {
  @Volatile var foreground = false
    private set
  @Volatile var listener: ((foreground: Boolean) -> Unit)? = null

  fun set(foreground: Boolean) {
    this.foreground = foreground
    listener?.invoke(foreground)
  }
}

/**
 * Keeps the background gateway session ([NotificationGateway]) open while system notifications are on and the app is not in front.
 * Discord's push only reaches the official app, so messages arrive over the gateway and are filtered ([NotificationState.shouldNotify]).
 * In front, the session pauses, resumable, so one connection is open at a time.
 * A `remoteMessaging` foreground service: unlike `dataSync`, Android 15 sets no daily time limit.
 */
class GatewayService : Service(), GatewayListener {
  private var gateway: NotificationGateway? = null
  // Read on the gateway thread.
  @Volatile private var state = NotificationState()
  @Volatile private var account: AccountConfig? = null
  @Volatile private var notifier = SessionNotifier(this, inApp = false)
  /** The last state the gateway reported, so a new start doesn't show a connected session as connecting. */
  @Volatile private var connected = false
  private val network =
    object : ConnectivityManager.NetworkCallback() {
      override fun onAvailable(network: Network) {
        gateway?.networkAvailable()
      }
    }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    getSystemService(ConnectivityManager::class.java).registerDefaultNetworkCallback(network)
    AppVisibility.listener = { foreground ->
      gateway?.setPaused(foreground)
      // Paused, the app's own connection serves the notifications.
      onConnected(connected)
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val next = NotificationPrefs.account(this)
    // A service started with startForegroundService must go to the foreground even if it stops right away.
    next?.let { MessageNotifier.ensureChannels(this, it) }
    try {
      ServiceCompat.startForeground(
        this,
        STATUS_ID,
        statusNotification(next, connected),
        // Before Android 14 there is no such type, and a service needs none.
        if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING else 0,
      )
    } catch (e: IllegalStateException) {
      // Android 12+ (ForegroundServiceStartNotAllowedException): restarted by the system (START_STICKY) while the
      // app is in the background and not exempt from battery optimisation. The app starts it again when opened.
      Log.w(TAG, "foreground start refused: ${e.javaClass.simpleName}")
      stopSelf()
      return START_NOT_STICKY
    }
    if (next == null || !NotificationPrefs.enabled(this)) {
      stopSelf()
      return START_NOT_STICKY
    }
    account = next
    val current = gateway
    if (current == null || current.userId != next.userId || current.token != next.token) {
      if (current != null && current.userId != next.userId) MessageNotifier.cancelAll(this)
      current?.close()
      state = NotificationState()
      notifier = SessionNotifier(this, inApp = false)
      gateway = NotificationGateway(next, this).also { it.connect(paused = AppVisibility.foreground) }
    }
    // Restarted by the system after it kills the process for memory.
    return START_STICKY
  }

  override fun onDestroy() {
    // The closing gateway still reports itself disconnected; that must not post the ongoing status again.
    account = null
    AppVisibility.listener = null
    getSystemService(ConnectivityManager::class.java).unregisterNetworkCallback(network)
    gateway?.close()
    gateway = null
    super.onDestroy()
  }

  override fun onConnected(connected: Boolean) {
    this.connected = connected
    val notification = statusNotification(account ?: return, connected)
    try {
      NotificationManagerCompat.from(this).notify(STATUS_ID, notification)
    } catch (e: SecurityException) {
      Log.w(TAG, "status notification refused: ${e.javaClass.simpleName}")
    }
  }

  override fun onAuthenticationFailed() {
    // The token is no longer valid; the app logs the account out when its own gateway hears the same.
    stopSelf()
  }

  override fun onDispatch(dispatch: GatewayDispatch) {
    when (dispatch.type) {
      "READY" -> {
        val ready = dispatch.decode(Ready.serializer())
        state.onReady(ready)
        state.self?.let { MessageNotifier.setSelf(it.id, it.name) }
        // A new session missed the acks of the old one: what was read meanwhile goes now.
        MessageNotifier.reconcile(
          this,
          ready.read_state?.entries.orEmpty()
            .filter { it.read_state_type == ReadStateType.CHANNEL }
            .mapNotNull { entry -> entry.lastMessageId()?.let { entry.id to it } }
            .toMap(),
        )
      }
      "GUILD_CREATE", "GUILD_UPDATE" -> state.onGuild(dispatch.decode(RawGuild.serializer()))
      "GUILD_DELETE" -> dispatch.decode(RawGuild.serializer()).let { if (!it.unavailable) state.onGuildDelete(it.id) }
      "CHANNEL_CREATE", "CHANNEL_UPDATE", "THREAD_UPDATE" -> state.onChannel(dispatch.decode(RawChannel.serializer()))
      "CHANNEL_DELETE", "THREAD_DELETE" -> state.onChannelDelete(dispatch.decode(ChannelRef.serializer()).id)
      "THREAD_LIST_SYNC" -> dispatch.decode(ThreadListSync.serializer()).let { sync -> sync.threads.forEach { state.onChannel(it, sync.guild_id) } }
      "GUILD_MEMBER_UPDATE" -> state.onMemberUpdate(dispatch.decode(MemberUpdate.serializer()))
      "GUILD_ROLE_CREATE", "GUILD_ROLE_UPDATE", "GUILD_ROLE_DELETE" -> state.onRole(dispatch.decode(RoleEvent.serializer()))
      "USER_GUILD_SETTINGS_UPDATE" -> state.onGuildSettings(dispatch.decode(RawGuildSettings.serializer()))
      "SESSIONS_REPLACE" -> state.onSessions(dispatch.decode(ListSerializer(RawSession.serializer())))
      // Read on another device or in the app: its notification goes (handleMessageAck).
      "MESSAGE_ACK" -> dispatch.decode(MessageAck.serializer()).let { MessageNotifier.ack(this, it.channel_id, it.message_id) }
      else -> account?.let { notifier.onDispatch(dispatch, state, it) }
    }
  }

  private fun statusNotification(account: AccountConfig?, connected: Boolean) =
    NotificationCompat.Builder(this, MessageNotifier.CHANNEL_CONNECTION)
      .setSmallIcon(R.drawable.ic_notification)
      .setContentTitle(account?.string(if (connected || AppVisibility.foreground) "connected" else "connecting"))
      .setPriority(NotificationCompat.PRIORITY_MIN)
      .setOngoing(true)
      .setShowWhen(false)
      .setSilent(true)
      .setContentIntent(
        PendingIntent.getActivity(
          this,
          0,
          Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
          PendingIntent.FLAG_IMMUTABLE,
        )
      )
      .build()

  companion object {
    private const val STATUS_ID = 1001

    /** Starts or stops the service to match the settings and the account. */
    fun sync(context: Context) {
      val intent = Intent(context, GatewayService::class.java)
      if (NotificationPrefs.enabled(context) && NotificationPrefs.account(context) != null)
        try {
          ContextCompat.startForegroundService(context, intent)
        } catch (e: IllegalStateException) {
          // Android 12+ refuses it from the background (ForegroundServiceStartNotAllowedException), as when JS
          // reconfigures on a READY that arrives after the app left the screen. A running service keeps running.
          Log.w(TAG, "service start refused: ${e.javaClass.simpleName}")
        }
      else context.stopService(intent)
    }
  }
}

/** Starts the background connection again after a reboot or an app update. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED)
      GatewayService.sync(context)
  }
}
