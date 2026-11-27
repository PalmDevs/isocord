import type { HybridObject } from 'react-native-nitro-modules'

/**
 * System notifications from a background gateway session (notifications/GatewayService.kt). Discord's push
 * notifications only reach the official app, so a foreground service keeps a gateway connection of its own.
 */
export interface IsocordNotifications
    extends HybridObject<{ android: 'kotlin' }> {
    /**
     * The current account, as JSON of `AccountConfig` (NotificationPrefs.kt): token, IDENTIFY properties, account headers
     * and the notifications' translated text. Saved, so the service can start without JS after a reboot.
     */
    configure(account: string): void
    /** No account is logged in: the service stops and every message notification goes. */
    clearAccount(): void
    /**
     * A dispatch the app's session hears in front (AppSession.kt). `event` is its `d` and `dispatchContext` what the
     * stores know around it (`DispatchContext`, whose guild and settings JS leaves out once native holds them), both as
     * JSON. The background session's rules decide it and post what
     * it notifies, on channels that sound but don't pop up. Resolves whether a MESSAGE_CREATE notifies, even with
     * system notifications off: the in-app notifications follow it.
     */
    dispatch(
        type: string,
        event: string,
        dispatchContext: string,
    ): Promise<boolean>
    /** A channel read up to a message (MESSAGE_ACK): its notification drops what is read. */
    ack(channelId: string, messageId: string): void
    /** "Notify me about": one kind of notification (NotificationKind in NotificationPrefs.kt), on unless turned off. */
    kindEnabled(kind: string): boolean
    setKindEnabled(kind: string, enabled: boolean): void
    /** "Get notifications outside of Discord." */
    isEnabled(): boolean
    setEnabled(enabled: boolean): void
    /** "Notify on every new message in conversations": without it, only a conversation's first message alerts. */
    notifyEveryMessage(): boolean
    setNotifyEveryMessage(enabled: boolean): void
    isIgnoringBatteryOptimizations(): boolean
    /** Asks the system to let the app run unrestricted in the background (ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS). */
    requestIgnoreBatteryOptimizations(): void
}
