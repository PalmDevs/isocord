package me.palmdevs.isocord.voice.rtc

import android.util.Log

private const val TAG = "IsocordVoice"

/** Epoch of a freshly created MLS group (libdave DaveSessionManager.ts `MLS_NEW_GROUP_EXPECTED_EPOCH`). */
private const val NEW_GROUP_EPOCH = 1L

/** Transition applied at once, without a ready/execute round trip (`kInitTransitionId`). */
private const val INIT_TRANSITION_ID = 0

/** Protocol version meaning no E2EE (`kDisabledVersion`). */
private const val DISABLED_VERSION = 0

/** Outgoing voice gateway messages the MLS flow produces. */
interface DaveTransport {
  fun sendReadyForTransition(transitionId: Int)
  fun sendKeyPackage(keyPackage: ByteArray)
  fun sendCommitWelcome(commitWelcome: ByteArray)
  fun sendInvalidCommitWelcome(transitionId: Int)
}

/**
 * One call's DAVE state: the MLS session, our encryptor and a decryptor per remote user.
 * Ports libdave's samples/typescript/DaveSessionManager.ts. Not thread-safe: call from one thread.
 */
class DaveSession(
  private val selfUserId: String,
  private val groupId: Long,
  private val transport: DaveTransport,
) {
  private val session = DaveNative.sessionCreate()
  val encryptor = DaveNative.encryptorCreate()
  private val decryptors = mutableMapOf<String, Long>()
  private val userIds = mutableSetOf<String>()
  private val transitions = mutableMapOf<Int, Int>()
  private var latestPreparedVersion = DISABLED_VERSION

  /** The protocol version in use. 0 is not end-to-end encrypted. */
  val protocolVersion get() = DaveNative.sessionProtocolVersion(session)

  /** Returns the user's decryptor, created on first use. */
  fun decryptorFor(userId: String): Long =
    decryptors.getOrPut(userId) {
      DaveNative.decryptorCreate().also { setRatchet(it, userId, latestPreparedVersion) }
    }

  fun createUser(userId: String) {
    if (!userIds.add(userId)) return
    DaveNative.addUser(session, userId)
    decryptors[userId]?.let {
      // Rejoined user: reopens passthrough, since their client sends plaintext until its transition executes.
      DaveNative.decryptorSetUser(it, session, null)
      setRatchet(it, userId, latestPreparedVersion)
    }
  }

  fun destroyUser(userId: String) {
    userIds.remove(userId)
    DaveNative.removeUser(session, userId)
  }

  /** Session Description's `dave_protocol_version`. */
  fun onSelectProtocolAck(version: Int) = handleInit(version)

  fun onPrepareTransition(transitionId: Int, version: Int) {
    prepareRatchets(transitionId, version)
    maybeSendReady(transitionId)
  }

  fun onExecuteTransition(transitionId: Int) {
    val version = transitions.remove(transitionId) ?: return
    Log.i(TAG, "DAVE execute transition $transitionId, version $version")
    if (version == DISABLED_VERSION) DaveNative.sessionReset(session)
    setSelfRatchet(version)
  }

  fun onPrepareEpoch(epoch: Long, version: Int) {
    prepareEpoch(epoch, version)
    if (epoch == NEW_GROUP_EPOCH) sendKeyPackage()
  }

  fun onExternalSender(data: ByteArray) = DaveNative.setExternalSender(session, data)

  fun onProposals(proposals: ByteArray) {
    DaveNative.processProposals(session, proposals)?.let(transport::sendCommitWelcome)
  }

  fun onAnnounceCommit(transitionId: Int, commit: ByteArray) {
    when (DaveNative.processCommit(session, commit)) {
      DaveNative.COMMIT_IGNORED -> return
      DaveNative.COMMIT_JOINED -> {
        prepareRatchets(transitionId, DaveNative.sessionProtocolVersion(session))
        maybeSendReady(transitionId)
      }
      else -> {
        Log.w(TAG, "DAVE commit failed for transition $transitionId")
        transport.sendInvalidCommitWelcome(transitionId)
        handleInit(DaveNative.sessionProtocolVersion(session))
      }
    }
  }

  fun onWelcome(transitionId: Int, welcome: ByteArray) {
    if (DaveNative.processWelcome(session, welcome)) {
      prepareRatchets(transitionId, DaveNative.sessionProtocolVersion(session))
      maybeSendReady(transitionId)
    } else {
      Log.w(TAG, "DAVE welcome failed for transition $transitionId")
      transport.sendInvalidCommitWelcome(transitionId)
      sendKeyPackage()
    }
  }

  /** Returns "user: success/failure/passthrough/missingKey" counters for logging. */
  fun stats(): String {
    val self = "audio ${DaveNative.encryptorStats(encryptor, false).joinToString("/")} " +
      "video ${DaveNative.encryptorStats(encryptor, true).joinToString("/")}"
    val others = decryptors.entries.joinToString { (user, decryptor) ->
      val audio = DaveNative.decryptorStats(decryptor, false).joinToString("/")
      val video = DaveNative.decryptorStats(decryptor, true).joinToString("/")
      "$user=audio $audio video $video"
    }
    return "encrypt $self, decrypt [$others]"
  }

  fun close() {
    DaveNative.encryptorRelease(encryptor)
    decryptors.values.forEach(DaveNative::decryptorRelease)
    DaveNative.sessionDestroy(session)
  }

  private fun handleInit(version: Int) {
    Log.i(TAG, "DAVE init, version $version")
    if (version > DISABLED_VERSION) {
      prepareEpoch(NEW_GROUP_EPOCH, version)
      sendKeyPackage()
    } else {
      prepareRatchets(INIT_TRANSITION_ID, version)
      onExecuteTransition(INIT_TRANSITION_ID)
    }
  }

  private fun prepareEpoch(epoch: Long, version: Int) {
    if (epoch == NEW_GROUP_EPOCH) DaveNative.sessionInit(session, version, groupId, selfUserId)
  }

  private fun prepareRatchets(transitionId: Int, version: Int) {
    for ((userId, decryptor) in decryptors) setRatchet(decryptor, userId, version)
    if (transitionId == INIT_TRANSITION_ID) setSelfRatchet(version) else transitions[transitionId] = version
    latestPreparedVersion = version
  }

  private fun setRatchet(decryptor: Long, userId: String, version: Int) {
    if (userId !in userIds && version != DISABLED_VERSION) return
    DaveNative.decryptorSetUser(decryptor, session, userId.takeIf { version != DISABLED_VERSION })
  }

  private fun setSelfRatchet(version: Int) {
    DaveNative.encryptorSetUser(encryptor, session, selfUserId.takeIf { version != DISABLED_VERSION })
  }

  private fun maybeSendReady(transitionId: Int) {
    if (transitionId != INIT_TRANSITION_ID) transport.sendReadyForTransition(transitionId)
  }

  private fun sendKeyPackage() {
    DaveNative.keyPackage(session)?.let(transport::sendKeyPackage)
  }
}
