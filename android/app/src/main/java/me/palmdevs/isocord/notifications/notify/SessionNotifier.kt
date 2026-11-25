package me.palmdevs.isocord.notifications.notify

import android.content.Context
import me.palmdevs.isocord.network.RelationshipType
import me.palmdevs.isocord.network.ScheduledEventStatus
import me.palmdevs.isocord.notifications.Handover
import me.palmdevs.isocord.notifications.gateway.AppVisibility
import me.palmdevs.isocord.notifications.gateway.CallEvent
import me.palmdevs.isocord.notifications.gateway.GatewayDispatch
import me.palmdevs.isocord.notifications.gateway.RawChannel
import me.palmdevs.isocord.notifications.gateway.RawMessage
import me.palmdevs.isocord.notifications.gateway.RawRelationship
import me.palmdevs.isocord.notifications.gateway.ReactionAdd
import me.palmdevs.isocord.notifications.gateway.ScheduledEvent
import me.palmdevs.isocord.notifications.gateway.ScheduledEventUser

/**
 * What a session's dispatches notify, by one set of rules for both sessions: the background one (GatewayService) and
 * the app's, which JS forwards while in front ([AppSession]). Holds the session's started events.
 */
class SessionNotifier(
  private val context: Context,
  private val inApp: Boolean,
  private val handover: Handover = Handover.shared,
) {
  /** Events already announced as starting: GUILD_SCHEDULED_EVENT_UPDATE repeats while one is active. */
  private val startedEvents = HashSet<String>()

  /** This session serves the notifications now: the app's while it is in front, the background one otherwise. */
  private val live get() = AppVisibility.foreground == inApp

  /**
   * Notifies about a dispatch, if it calls for one. [state] already knows the dispatch's place. Events heard again by
   * the resume after the hand-over were the other session's to notify ([Handover]). Returns whether a MESSAGE_CREATE
   * notifies, posted or not (system notifications off).
   */
  fun onDispatch(dispatch: GatewayDispatch, state: NotificationState, account: AccountConfig): Boolean {
    val replayed = !live || handover.replaying(inApp)
    when (dispatch.type) {
      "MESSAGE_CREATE" -> return onMessage(dispatch.decode(RawMessage.serializer()), state, account)
      "THREAD_CREATE" -> onThread(dispatch.decode(RawChannel.serializer()), state, account, replayed)
      "CALL_CREATE", "CALL_UPDATE" -> onCall(dispatch.decode(CallEvent.serializer()), state, account)
      "CALL_DELETE" -> cancel(AlertTag.call(dispatch.decode(CallEvent.serializer()).channel_id))
      "RELATIONSHIP_ADD", "RELATIONSHIP_UPDATE" ->
        onRelationship(dispatch.decode(RawRelationship.serializer()), dispatch.type == "RELATIONSHIP_ADD", state, account, replayed)
      "RELATIONSHIP_REMOVE" -> {
        val id = dispatch.decode(RawRelationship.serializer()).id
        state.onRelationshipRemove(id)
        cancel(AlertTag.friend(id))
      }
      "MESSAGE_REACTION_ADD" -> onReaction(dispatch.decode(ReactionAdd.serializer()), state, account, replayed)
      "GUILD_SCHEDULED_EVENT_USER_ADD", "GUILD_SCHEDULED_EVENT_USER_REMOVE" ->
        state.onEventUser(dispatch.decode(ScheduledEventUser.serializer()), dispatch.type == "GUILD_SCHEDULED_EVENT_USER_ADD")
      "GUILD_SCHEDULED_EVENT_UPDATE" -> onEvent(dispatch.decode(ScheduledEvent.serializer()), state, account, replayed)
    }
    return false
  }

  private fun onMessage(message: RawMessage, state: NotificationState, account: AccountConfig): Boolean {
    // Replayed by the resume: the other session notified it, or it came while the app was away.
    if (!live || handover.replayed(snowflakeTime(message.id), inApp)) return false
    val channel = state.channels[message.channel_id] ?: return false
    if (!state.shouldNotify(message, channel)) return false
    if (NotificationPrefs.enabled(context))
      MessageNotifier.post(context, describe(message, channel, state, account), NotificationPrefs.everyMessage(context), inApp)
    return true
  }

  /** A new post in a forum set to notify on all messages ([NotificationState.forumPostNotifies]). */
  private fun onThread(thread: RawChannel, state: NotificationState, account: AccountConfig, replayed: Boolean) {
    state.onChannel(thread)
    if (replayed || !state.forumPostNotifies(thread)) return
    val forum = state.channels[thread.parent_id] ?: return
    alert(forumAlert(thread, forum, state, account))
  }

  /** "Incoming call" while it rings the account; gone once it doesn't. Not held back by a replay. */
  private fun onCall(call: CallEvent, state: NotificationState, account: AccountConfig) {
    if (state.selfId !in call.ringing) return cancel(AlertTag.call(call.channel_id))
    val channel = state.channels[call.channel_id] ?: return
    if (!live || state.dnd || state.muted(channel)) return
    alert(callAlert(call, channel, state, account))
  }

  /** An incoming request, or an outgoing one that became a friend. A request answered elsewhere goes. */
  private fun onRelationship(
    relationship: RawRelationship,
    added: Boolean,
    state: NotificationState,
    account: AccountConfig,
    replayed: Boolean,
  ) {
    val previous = state.onRelationship(relationship)
    if (relationship.type != RelationshipType.INCOMING_REQUEST) cancel(AlertTag.friend(relationship.id))
    if (!added || replayed || state.dnd) return
    val user = state.users[relationship.id] ?: return
    when {
      relationship.type == RelationshipType.INCOMING_REQUEST -> alert(friendAlert(user, false, account))
      relationship.type == RelationshipType.FRIEND && previous == RelationshipType.OUTGOING_REQUEST ->
        alert(friendAlert(user, true, account))
    }
  }

  /** ReactionNotification, for the account's own messages. */
  private fun onReaction(reaction: ReactionAdd, state: NotificationState, account: AccountConfig, replayed: Boolean) {
    if (reaction.message_author_id != state.selfId || reaction.user_id == state.selfId) return
    val channel = state.channels[reaction.channel_id] ?: return
    if (replayed || state.dnd || state.muted(channel)) return
    alert(reactionAlert(reaction, channel, state, account))
  }

  private fun onEvent(event: ScheduledEvent, state: NotificationState, account: AccountConfig, replayed: Boolean) {
    // An event that is over (or recurs) may start again.
    if (event.status != ScheduledEventStatus.ACTIVE) {
      startedEvents.remove(event.id)
      return
    }
    if (!startedEvents.add(event.id) || replayed || state.dnd || state.guildMuted(event.guild_id)) return
    alert(eventAlert(event, state, account))
  }

  private fun alert(alert: Alert) {
    if (NotificationPrefs.enabled(context)) MessageNotifier.alert(context, alert, inApp)
  }

  private fun cancel(tag: String) = MessageNotifier.cancelAlert(context, tag)
}
