// JNI bridge from NativeAudio.kt to RNNoise. Runs on WebRTC's capture thread, one 10 ms frame per call.
#include <jni.h>
#include <rnnoise.h>

#include <algorithm>
#include <cmath>
#include <vector>

namespace {

/** AudioBuffer samples are floats on the 16-bit scale (modules/audio_processing/audio_buffer.h). */
constexpr float kFullScale = 32768.0f;
constexpr float kMaxSample = 32767.0f;
constexpr double kDecibelsPerDecade = 20.0;
constexpr float kUnityGain = 1.0f;

/** Slots of process's `out` array (NativeAudio.kt). */
constexpr int kOutVoice = 0;
constexpr int kOutLevel = 1;
constexpr int kOutSize = 2;
/** Voice probability when the model did not run. */
constexpr float kNoVoice = -1.0f;

/** One RNNoise stream. The default model is compiled in (rnnoise_data.c). */
struct Denoiser {
    DenoiseState* state = rnnoise_create(nullptr);
    /** Model output for frames that are only analysed. */
    std::vector<float> scratch = std::vector<float>(rnnoise_get_frame_size());
    ~Denoiser() { rnnoise_destroy(state); }
};

Denoiser* FromHandle(jlong handle) { return reinterpret_cast<Denoiser*>(handle); }

/** Returns the RMS level in dBFS. Digital silence is -infinity. */
double LevelDbfs(const float* samples, int count) {
    double sum = 0;
    for (int i = 0; i < count; i++) {
        double sample = samples[i] / kFullScale;
        sum += sample * sample;
    }
    return kDecibelsPerDecade * std::log10(std::sqrt(sum / count));
}

void ApplyGain(float* samples, int count, float gain) {
    if (gain == kUnityGain) return;
    for (int i = 0; i < count; i++) samples[i] = std::clamp(samples[i] * gain, -kFullScale, kMaxSample);
}

}  // namespace

#define FN(name) Java_me_palmdevs_isocord_voice_audio_NativeAudio_##name

extern "C" {

JNIEXPORT jint JNICALL FN(frameSize)(JNIEnv*, jobject) { return rnnoise_get_frame_size(); }

JNIEXPORT jint JNICALL FN(outSize)(JNIEnv*, jobject) { return kOutSize; }

JNIEXPORT jlong JNICALL FN(create)(JNIEnv*, jobject) { return reinterpret_cast<jlong>(new Denoiser()); }

JNIEXPORT void JNICALL FN(destroy)(JNIEnv*, jobject, jlong handle) { delete FromHandle(handle); }

/**
 * Processes one frame of `buffer` in place. `model` runs RNNoise, which needs exactly frameSize samples.
 * `denoise` keeps its output, else the frame is only analysed. Then `gain` applies.
 * Writes the voice probability and the output level into `out`.
 */
JNIEXPORT void JNICALL FN(process)(JNIEnv* env, jobject, jlong handle, jobject buffer, jint frames, jboolean model,
                                   jboolean denoise, jfloat gain, jfloatArray out) {
    auto* samples = static_cast<float*>(env->GetDirectBufferAddress(buffer));
    jlong capacity = env->GetDirectBufferCapacity(buffer) / static_cast<jlong>(sizeof(float));
    float result[kOutSize] = {kNoVoice, -INFINITY};
    if (samples != nullptr && frames > 0 && capacity >= frames) {
        auto* denoiser = FromHandle(handle);
        if (model && frames == rnnoise_get_frame_size()) {
            float* output = denoise ? samples : denoiser->scratch.data();
            result[kOutVoice] = rnnoise_process_frame(denoiser->state, output, samples);
        }
        ApplyGain(samples, frames, gain);
        result[kOutLevel] = static_cast<float>(LevelDbfs(samples, frames));
    }
    env->SetFloatArrayRegion(out, 0, kOutSize, result);
}

}  // extern "C"
