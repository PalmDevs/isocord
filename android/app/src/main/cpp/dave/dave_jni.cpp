// JNI bridge from DaveNative.kt to libdave's C API, plus libwebrtc frame encryptor/decryptor adapters.
#include <android/log.h>
#include <dave/dave.h>
#include <jni.h>

#include <atomic>
#include <string>

#include "webrtc_frame_crypto.h"

#define LOG_TAG "IsocordDave"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace {

DAVEMediaType ToDave(webrtc::MediaType type) {
    return type == webrtc::MediaType::VIDEO ? DAVE_MEDIA_TYPE_VIDEO : DAVE_MEDIA_TYPE_AUDIO;
}

/** Ref counting shared by both adapters. Kotlin holds the first reference. */
template <typename Interface>
class RefCounted : public Interface {
 public:
    void AddRef() const override { refs_.fetch_add(1); }
    webrtc::RefCountReleaseStatus Release() const override {
        if (refs_.fetch_sub(1) == 1) {
            delete this;
            return webrtc::RefCountReleaseStatus::kDroppedLastRef;
        }
        return webrtc::RefCountReleaseStatus::kOtherRefsRemained;
    }

 private:
    mutable std::atomic<int> refs_{1};
};

/** Non-zero Encrypt result: libwebrtc drops the frame before packetizing it (audio/channel_send.cc). */
constexpr int kFrameDropped = -1;

/** Encrypts our outgoing frames with libdave's encryptor. */
class DaveFrameEncryptor : public RefCounted<webrtc::FrameEncryptorInterface> {
 public:
    DAVEEncryptorHandle dave = daveEncryptorCreate();
    /** Voice activity gate: audio frames between speech bursts are dropped, so nothing is sent. */
    std::atomic<bool> transmitting{false};
    ~DaveFrameEncryptor() override { daveEncryptorDestroy(dave); }

    int Encrypt(webrtc::MediaType media_type,
                uint32_t ssrc,
                std::span<const uint8_t>,
                std::span<const uint8_t> frame,
                std::span<uint8_t> encrypted_frame,
                size_t* bytes_written) override {
        if (media_type == webrtc::MediaType::AUDIO && !transmitting.load(std::memory_order_relaxed)) {
            return kFrameDropped;
        }
        auto result = daveEncryptorEncrypt(dave, ToDave(media_type), ssrc, frame.data(), frame.size(),
                                           encrypted_frame.data(), encrypted_frame.size(), bytes_written);
        return result == DAVE_ENCRYPTOR_RESULT_CODE_SUCCESS ? 0 : static_cast<int>(result);
    }

    size_t GetMaxCiphertextByteSize(webrtc::MediaType media_type, size_t frame_size) override {
        return daveEncryptorGetMaxCiphertextByteSize(dave, ToDave(media_type), frame_size);
    }
};

/** Decrypts one remote user's frames with libdave's decryptor. */
class DaveFrameDecryptor : public RefCounted<webrtc::FrameDecryptorInterface> {
 public:
    DAVEDecryptorHandle dave = daveDecryptorCreate();
    ~DaveFrameDecryptor() override { daveDecryptorDestroy(dave); }

    Result Decrypt(webrtc::MediaType media_type,
                   const std::vector<uint32_t>&,
                   std::span<const uint8_t>,
                   std::span<const uint8_t> encrypted_frame,
                   std::span<uint8_t> frame) override {
        size_t written = 0;
        auto result = daveDecryptorDecrypt(dave, ToDave(media_type), encrypted_frame.data(),
                                           encrypted_frame.size(), frame.data(), frame.size(), &written);
        if (result == DAVE_DECRYPTOR_RESULT_CODE_SUCCESS) return {Status::kOk, written};
        return {Status::kFailedToDecrypt, 0};
    }

    size_t GetMaxPlaintextByteSize(webrtc::MediaType media_type, size_t encrypted_frame_size) override {
        return daveDecryptorGetMaxPlaintextByteSize(dave, ToDave(media_type), encrypted_frame_size);
    }
};

DAVESessionHandle Session(jlong handle) { return reinterpret_cast<DAVESessionHandle>(handle); }
DaveFrameEncryptor* Encryptor(jlong handle) { return reinterpret_cast<DaveFrameEncryptor*>(handle); }
DaveFrameDecryptor* Decryptor(jlong handle) { return reinterpret_cast<DaveFrameDecryptor*>(handle); }

std::string ToString(JNIEnv* env, jstring value) {
    const char* chars = env->GetStringUTFChars(value, nullptr);
    std::string result(chars);
    env->ReleaseStringUTFChars(value, chars);
    return result;
}

/** Copies a libdave-allocated buffer into a Java byte array and frees it. */
jbyteArray TakeBytes(JNIEnv* env, uint8_t* data, size_t length) {
    if (data == nullptr) return nullptr;
    jbyteArray array = env->NewByteArray(static_cast<jsize>(length));
    env->SetByteArrayRegion(array, 0, static_cast<jsize>(length), reinterpret_cast<const jbyte*>(data));
    daveFree(data);
    return array;
}

struct Bytes {
    JNIEnv* env;
    jbyteArray array;
    jbyte* data;
    jsize length;
    Bytes(JNIEnv* env, jbyteArray array)
        : env(env), array(array), data(env->GetByteArrayElements(array, nullptr)),
          length(env->GetArrayLength(array)) {}
    ~Bytes() { env->ReleaseByteArrayElements(array, data, JNI_ABORT); }
    const uint8_t* ptr() const { return reinterpret_cast<const uint8_t*>(data); }
};

void OnMlsFailure(const char* source, const char* reason, void*) { LOGE("MLS failure %s: %s", source, reason); }

/**
 * Forwards libdave's log to logcat. Release builds (NDEBUG) drop its verbose and info lines: they print MLS
 * commits, key packages and ratchets in hex, which any reader of logcat could take.
 */
void OnLog(DAVELoggingSeverity severity, const char* file, int line, const char* message) {
#ifdef NDEBUG
    if (severity < DAVE_LOGGING_SEVERITY_WARNING) return;
#endif
    int priority = severity >= DAVE_LOGGING_SEVERITY_ERROR     ? ANDROID_LOG_ERROR
                   : severity == DAVE_LOGGING_SEVERITY_WARNING ? ANDROID_LOG_WARN
                                                               : ANDROID_LOG_DEBUG;
    __android_log_print(priority, LOG_TAG, "%s:%d %s", file, line, message);
}

}  // namespace

#define FN(name) Java_me_palmdevs_isocord_voice_rtc_DaveNative_##name

extern "C" {

JNIEXPORT jint JNICALL FN(maxProtocolVersion)(JNIEnv*, jobject) {
    daveSetLogSinkCallback(OnLog);
    return daveMaxSupportedProtocolVersion();
}

JNIEXPORT jlong JNICALL FN(sessionCreate)(JNIEnv*, jobject) {
    return reinterpret_cast<jlong>(daveSessionCreate(nullptr, "", OnMlsFailure, nullptr));
}

JNIEXPORT void JNICALL FN(sessionDestroy)(JNIEnv*, jobject, jlong session) { daveSessionDestroy(Session(session)); }

JNIEXPORT void JNICALL FN(sessionInit)(JNIEnv* env, jobject, jlong session, jint version, jlong groupId,
                                       jstring selfUserId) {
    daveSessionInit(Session(session), static_cast<uint16_t>(version), static_cast<uint64_t>(groupId),
                    ToString(env, selfUserId).c_str());
}

JNIEXPORT void JNICALL FN(sessionReset)(JNIEnv*, jobject, jlong session) { daveSessionReset(Session(session)); }

JNIEXPORT jint JNICALL FN(sessionProtocolVersion)(JNIEnv*, jobject, jlong session) {
    return daveSessionGetProtocolVersion(Session(session));
}

JNIEXPORT void JNICALL FN(setExternalSender)(JNIEnv* env, jobject, jlong session, jbyteArray data) {
    Bytes bytes(env, data);
    daveSessionSetExternalSender(Session(session), bytes.ptr(), bytes.length);
}

JNIEXPORT void JNICALL FN(addUser)(JNIEnv* env, jobject, jlong session, jstring userId) {
    daveSessionAddRecognizedUser(Session(session), ToString(env, userId).c_str());
}

JNIEXPORT void JNICALL FN(removeUser)(JNIEnv* env, jobject, jlong session, jstring userId) {
    daveSessionRemoveRecognizedUser(Session(session), ToString(env, userId).c_str());
}

JNIEXPORT jbyteArray JNICALL FN(keyPackage)(JNIEnv* env, jobject, jlong session) {
    uint8_t* data = nullptr;
    size_t length = 0;
    daveSessionGetMarshalledKeyPackage(Session(session), &data, &length);
    return TakeBytes(env, data, length);
}

JNIEXPORT jbyteArray JNICALL FN(processProposals)(JNIEnv* env, jobject, jlong session, jbyteArray proposals) {
    Bytes bytes(env, proposals);
    uint8_t* data = nullptr;
    size_t length = 0;
    daveSessionProcessProposals(Session(session), bytes.ptr(), bytes.length, &data, &length);
    return TakeBytes(env, data, length);
}

/** Returns 0 when the commit joined us to the group, 1 when ignored, 2 when failed. */
JNIEXPORT jint JNICALL FN(processCommit)(JNIEnv* env, jobject, jlong session, jbyteArray commit) {
    Bytes bytes(env, commit);
    auto result = daveSessionProcessCommit(Session(session), bytes.ptr(), bytes.length);
    jint status = daveCommitResultIsIgnored(result) ? 1 : daveCommitResultIsFailed(result) ? 2 : 0;
    daveCommitResultDestroy(result);
    return status;
}

JNIEXPORT jboolean JNICALL FN(processWelcome)(JNIEnv* env, jobject, jlong session, jbyteArray welcome) {
    Bytes bytes(env, welcome);
    auto result = daveSessionProcessWelcome(Session(session), bytes.ptr(), bytes.length);
    if (result == nullptr) return JNI_FALSE;
    daveWelcomeResultDestroy(result);
    return JNI_TRUE;
}

JNIEXPORT jlong JNICALL FN(encryptorCreate)(JNIEnv*, jobject) {
    auto* encryptor = new DaveFrameEncryptor();
    daveEncryptorSetPassthroughMode(encryptor->dave, true);
    return reinterpret_cast<jlong>(encryptor);
}

/** Returns the FrameEncryptorInterface pointer for org.webrtc.FrameEncryptor. */
JNIEXPORT jlong JNICALL FN(encryptorWebrtcPointer)(JNIEnv*, jobject, jlong encryptor) {
    return reinterpret_cast<jlong>(static_cast<webrtc::FrameEncryptorInterface*>(Encryptor(encryptor)));
}

JNIEXPORT void JNICALL FN(encryptorRelease)(JNIEnv*, jobject, jlong encryptor) { Encryptor(encryptor)->Release(); }

/** Tells the encryptor which codec an SSRC carries. `codec` is a DAVECodec value. */
JNIEXPORT void JNICALL FN(encryptorAssignCodec)(JNIEnv*, jobject, jlong encryptor, jint ssrc, jint codec) {
    daveEncryptorAssignSsrcToCodec(Encryptor(encryptor)->dave, static_cast<uint32_t>(ssrc), static_cast<DAVECodec>(codec));
}

/** Opens or closes the voice activity gate for audio frames. */
JNIEXPORT void JNICALL FN(encryptorSetTransmitting)(JNIEnv*, jobject, jlong encryptor, jboolean on) {
    Encryptor(encryptor)->transmitting.store(on, std::memory_order_relaxed);
}

/** Sets the ratchet for `userId`, or passthrough when `userId` is null. */
JNIEXPORT void JNICALL FN(encryptorSetUser)(JNIEnv* env, jobject, jlong encryptor, jlong session, jstring userId) {
    auto dave = Encryptor(encryptor)->dave;
    if (userId == nullptr) {
        daveEncryptorSetPassthroughMode(dave, true);
        return;
    }
    auto ratchet = daveSessionGetKeyRatchet(Session(session), ToString(env, userId).c_str());
    daveEncryptorSetKeyRatchet(dave, ratchet);
    daveEncryptorSetPassthroughMode(dave, false);
    daveKeyRatchetDestroy(ratchet);
}

JNIEXPORT jlongArray JNICALL FN(encryptorStats)(JNIEnv* env, jobject, jlong encryptor, jboolean video) {
    DAVEEncryptorStats stats{};
    daveEncryptorGetStats(Encryptor(encryptor)->dave, video ? DAVE_MEDIA_TYPE_VIDEO : DAVE_MEDIA_TYPE_AUDIO, &stats);
    jlong values[] = {static_cast<jlong>(stats.encryptSuccessCount), static_cast<jlong>(stats.encryptFailureCount),
                      static_cast<jlong>(stats.passthroughCount), static_cast<jlong>(stats.encryptMissingKeyCount)};
    jlongArray array = env->NewLongArray(4);
    env->SetLongArrayRegion(array, 0, 4, values);
    return array;
}

JNIEXPORT jlong JNICALL FN(decryptorCreate)(JNIEnv*, jobject) {
    auto* decryptor = new DaveFrameDecryptor();
    daveDecryptorTransitionToPassthroughMode(decryptor->dave, true);
    return reinterpret_cast<jlong>(decryptor);
}

JNIEXPORT jlong JNICALL FN(decryptorWebrtcPointer)(JNIEnv*, jobject, jlong decryptor) {
    return reinterpret_cast<jlong>(static_cast<webrtc::FrameDecryptorInterface*>(Decryptor(decryptor)));
}

JNIEXPORT void JNICALL FN(decryptorRelease)(JNIEnv*, jobject, jlong decryptor) { Decryptor(decryptor)->Release(); }

/** Sets the ratchet for `userId`, or passthrough when `userId` is null. */
JNIEXPORT void JNICALL FN(decryptorSetUser)(JNIEnv* env, jobject, jlong decryptor, jlong session, jstring userId) {
    auto dave = Decryptor(decryptor)->dave;
    if (userId == nullptr) {
        daveDecryptorTransitionToPassthroughMode(dave, true);
        return;
    }
    auto ratchet = daveSessionGetKeyRatchet(Session(session), ToString(env, userId).c_str());
    daveDecryptorTransitionToKeyRatchet(dave, ratchet);
    daveDecryptorTransitionToPassthroughMode(dave, false);
    daveKeyRatchetDestroy(ratchet);
}

JNIEXPORT jlongArray JNICALL FN(decryptorStats)(JNIEnv* env, jobject, jlong decryptor, jboolean video) {
    DAVEDecryptorStats stats{};
    daveDecryptorGetStats(Decryptor(decryptor)->dave, video ? DAVE_MEDIA_TYPE_VIDEO : DAVE_MEDIA_TYPE_AUDIO, &stats);
    jlong values[] = {static_cast<jlong>(stats.decryptSuccessCount), static_cast<jlong>(stats.decryptFailureCount),
                      static_cast<jlong>(stats.passthroughCount), static_cast<jlong>(stats.decryptMissingKeyCount)};
    jlongArray array = env->NewLongArray(4);
    env->SetLongArrayRegion(array, 0, 4, values);
    return array;
}

}  // extern "C"
