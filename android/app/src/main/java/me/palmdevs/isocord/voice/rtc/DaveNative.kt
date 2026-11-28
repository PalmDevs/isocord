package me.palmdevs.isocord.voice.rtc

/** JNI bindings to libisocord_dave.so (dave_jni.cpp), which wraps libdave's C API. */
object DaveNative {
  init {
    System.loadLibrary("isocord_dave")
  }

  external fun maxProtocolVersion(): Int

  external fun sessionCreate(): Long
  external fun sessionDestroy(session: Long)
  external fun sessionInit(session: Long, version: Int, groupId: Long, selfUserId: String)
  external fun sessionReset(session: Long)
  external fun sessionProtocolVersion(session: Long): Int
  external fun setExternalSender(session: Long, data: ByteArray)
  external fun addUser(session: Long, userId: String)
  external fun removeUser(session: Long, userId: String)
  external fun keyPackage(session: Long): ByteArray?
  external fun processProposals(session: Long, proposals: ByteArray): ByteArray?
  external fun processCommit(session: Long, commit: ByteArray): Int
  external fun processWelcome(session: Long, welcome: ByteArray): Boolean

  external fun encryptorCreate(): Long
  external fun encryptorWebrtcPointer(encryptor: Long): Long
  external fun encryptorRelease(encryptor: Long)
  /** `codec` is one of the CODEC_ values. */
  external fun encryptorAssignCodec(encryptor: Long, ssrc: Int, codec: Int)
  /** Opens or closes the voice activity gate: closed, audio frames are dropped unsent. Any thread. */
  external fun encryptorSetTransmitting(encryptor: Long, on: Boolean)
  external fun encryptorSetUser(encryptor: Long, session: Long, userId: String?)
  external fun encryptorStats(encryptor: Long, video: Boolean): LongArray

  external fun decryptorCreate(): Long
  external fun decryptorWebrtcPointer(decryptor: Long): Long
  external fun decryptorRelease(decryptor: Long)
  external fun decryptorSetUser(decryptor: Long, session: Long, userId: String?)
  external fun decryptorStats(decryptor: Long, video: Boolean): LongArray

  /** DAVECodec values (dave.h). */
  const val CODEC_OPUS = 1
  const val CODEC_VP8 = 2
  const val CODEC_VP9 = 3
  const val CODEC_H264 = 4
  const val CODEC_AV1 = 6

  /** `processCommit` results. */
  const val COMMIT_JOINED = 0
  const val COMMIT_IGNORED = 1
}
