package me.palmdevs.isocord.voice.telecom

/** Text of the call screen and the ring notification, translated by JS (`configure.ts`) and kept in `AccountConfig`. */
data class RingStrings(
  /** The call text under the caller's name. */
  val incoming: String,
  val accept: String,
  val decline: String,
  /** Content descriptions of the round buttons. */
  val answerLabel: String,
  val declineLabel: String,
)

/** A DM or group DM call that rings the account: what its call screen and notification show. */
data class IncomingRing(
  val channelId: String,
  /** The caller, else the group's name. */
  val name: String,
  /** The group's name under the call text. Null in a 1:1 DM, whose name is already the caller's. */
  val group: String?,
  val avatarUrl: String?,
  val strings: RingStrings,
)
