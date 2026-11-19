package me.palmdevs.isocord.notifications

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import kotlinx.serialization.SerializationException
import kotlinx.serialization.decodeFromString
import me.palmdevs.isocord.core.AppJson
import me.palmdevs.isocord.notifications.gateway.GatewayService
import me.palmdevs.isocord.notifications.notify.AccountConfig
import me.palmdevs.isocord.notifications.notify.AppSession
import me.palmdevs.isocord.notifications.notify.MessageNotifier
import me.palmdevs.isocord.notifications.notify.NotificationPrefs
import me.palmdevs.isocord.notifications.notify.DispatchContext
import me.palmdevs.isocord.specs.NativeIsocordNotificationsSpec

private const val TAG = "IsocordNotifications"

/** JS side of the background notifications (src/native/NativeIsocordNotifications.ts). */
@ReactModule(name = NotificationsModule.NAME)
class NotificationsModule(private val context: ReactApplicationContext) : NativeIsocordNotificationsSpec(context) {
  override fun getName() = NAME

  /** The app's own session, for the account [configure] last set. */
  @Volatile private var app: AppSession? = null

  override fun configure(account: String) {
    val next = AppJson.decodeFromString<AccountConfig>(account)
    val previous = NotificationPrefs.account(context)
    if (previous != null && previous.userId != next.userId) MessageNotifier.cancelAll(context)
    NotificationPrefs.setAccount(context, next)
    app = app?.takeIf { it.account.userId == next.userId }?.also { it.account = next } ?: AppSession(context, next)
    MessageNotifier.ensureChannels(context, next)
    // A running service reconnects only when the account or its token changed.
    GatewayService.sync(context)
  }

  override fun clearAccount() {
    app = null
    NotificationPrefs.setAccount(context, null)
    MessageNotifier.cancelAll(context)
    GatewayService.sync(context)
  }

  override fun dispatch(type: String, event: String, dispatchContext: String, promise: Promise) {
    val app = app
    if (app == null) {
      promise.resolve(false)
      return
    }
    try {
      promise.resolve(app.dispatch(type, event, AppJson.decodeFromString<DispatchContext>(dispatchContext)))
    } catch (e: SerializationException) {
      Log.w(TAG, "forwarded $type failed: ${e.javaClass.simpleName}")
      promise.resolve(false)
    }
  }

  override fun ack(channelId: String, messageId: String) = MessageNotifier.ack(context, channelId, messageId)

  override fun kindEnabled(kind: String) = NotificationPrefs.kindEnabled(context, kind)

  override fun setKindEnabled(kind: String, enabled: Boolean) = NotificationPrefs.setKindEnabled(context, kind, enabled)

  override fun isEnabled() = NotificationPrefs.enabled(context)

  override fun setEnabled(enabled: Boolean) {
    NotificationPrefs.setEnabled(context, enabled)
    GatewayService.sync(context)
  }

  override fun notifyEveryMessage() = NotificationPrefs.everyMessage(context)

  override fun setNotifyEveryMessage(enabled: Boolean) = NotificationPrefs.setEveryMessage(context, enabled)

  override fun isIgnoringBatteryOptimizations() =
    context.getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(context.packageName)

  @SuppressLint("BatteryLife") // A sideloaded client with a gateway of its own is the case this intent is for.
  override fun requestIgnoreBatteryOptimizations() {
    val intent =
      Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    (context.currentActivity ?: context).startActivity(intent)
  }

  companion object {
    const val NAME = "IsocordNotifications"
  }
}

class NotificationsPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == NotificationsModule.NAME) NotificationsModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      NotificationsModule.NAME to
        ReactModuleInfo(
          NotificationsModule.NAME,
          NotificationsModule::class.java.name,
          false, // canOverrideExistingModule
          false, // needsEagerInit
          false, // isCxxModule
          true, // isTurboModule
        )
    )
  }
}
