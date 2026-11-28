package me.palmdevs.isocord.voice.audio

import java.nio.ByteBuffer

/** JNI bindings to libisocord_audio.so (audio_jni.cpp), which wraps RNNoise. */
object NativeAudio {
  init {
    System.loadLibrary("isocord_audio")
  }

  /** Slots of [process]'s output. */
  const val OUT_VOICE = 0
  const val OUT_LEVEL = 1

  /** Samples RNNoise takes per frame: 10 ms at 48 kHz. */
  external fun frameSize(): Int

  /** Size of [process]'s output array. */
  external fun outSize(): Int

  external fun create(): Long

  external fun destroy(handle: Long)

  /**
   * Processes one frame of float samples in [buffer] in place. [model] runs RNNoise, [denoise] keeps its output.
   * Then [gain] applies. Writes the voice probability, or -1 without the model, and the level in dBFS into [out].
   */
  external fun process(
    handle: Long,
    buffer: ByteBuffer,
    frames: Int,
    model: Boolean,
    denoise: Boolean,
    gain: Float,
    out: FloatArray,
  )
}
