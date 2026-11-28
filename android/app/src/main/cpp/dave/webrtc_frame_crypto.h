// Mirrors libwebrtc M150's frame crypto interfaces (api/crypto/frame_*_interface.h).
// Only the vtable layout matters: the prebuilt org.webrtc library calls these through a raw pointer.
// On arm64 that layout is Chromium's relative vtables: see this folder's CMakeLists.txt.
#pragma once

#include <cstddef>
#include <cstdint>
#include <span>
#include <vector>

namespace webrtc {

enum class MediaType { AUDIO, VIDEO, DATA, UNSUPPORTED, ANY };

enum class RefCountReleaseStatus { kDroppedLastRef, kOtherRefsRemained };

class RefCountInterface {
 public:
    virtual void AddRef() const = 0;
    virtual RefCountReleaseStatus Release() const = 0;

 protected:
    virtual ~RefCountInterface() {}
};

class FrameEncryptorInterface : public RefCountInterface {
 public:
    ~FrameEncryptorInterface() override {}
    virtual int Encrypt(MediaType media_type,
                        uint32_t ssrc,
                        std::span<const uint8_t> additional_data,
                        std::span<const uint8_t> frame,
                        std::span<uint8_t> encrypted_frame,
                        size_t* bytes_written) = 0;
    virtual size_t GetMaxCiphertextByteSize(MediaType media_type, size_t frame_size) = 0;
};

class FrameDecryptorInterface : public RefCountInterface {
 public:
    enum class Status { kOk, kRecoverable, kFailedToDecrypt, kUnknown };
    struct Result {
        Result(Status status, size_t bytes_written) : status(status), bytes_written(bytes_written) {}
        const Status status;
        const size_t bytes_written;
    };
    ~FrameDecryptorInterface() override {}
    virtual Result Decrypt(MediaType media_type,
                           const std::vector<uint32_t>& csrcs,
                           std::span<const uint8_t> additional_data,
                           std::span<const uint8_t> encrypted_frame,
                           std::span<uint8_t> frame) = 0;
    virtual size_t GetMaxPlaintextByteSize(MediaType media_type, size_t encrypted_frame_size) = 0;
};

}  // namespace webrtc
