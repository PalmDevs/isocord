# libisocord_dave.so: libdave + mlspp + BoringSSL, prebuilt by vendor/dave/build.sh.
set(DAVE_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/../../../../../../vendor/dave/out/${ANDROID_ABI})

add_library(isocord_dave SHARED dave_jni.cpp)
set_target_properties(isocord_dave PROPERTIES CXX_STANDARD 20 CXX_STANDARD_REQUIRED ON)
target_include_directories(isocord_dave PRIVATE ${DAVE_ROOT}/include)
target_link_libraries(isocord_dave PRIVATE
    -Wl,--start-group
    ${DAVE_ROOT}/lib/libdave.a
    ${DAVE_ROOT}/lib/libmlspp.a
    ${DAVE_ROOT}/lib/libhpke.a
    ${DAVE_ROOT}/lib/libtls_syntax.a
    ${DAVE_ROOT}/lib/libbytes.a
    ${DAVE_ROOT}/lib/libcrypto.a
    -Wl,--end-group
    log)
target_link_options(isocord_dave PRIVATE -Wl,--exclude-libs,ALL -Wl,--gc-sections)
if(ANDROID_ABI STREQUAL "arm64-v8a")
    # The prebuilt arm64 libjingle_peerconnection_so uses Chromium's relative vtables (use_relative_vtables_abi):
    # it calls our frame encryptor and decryptor through 32-bit vtable offsets. Without this it jumps to garbage.
    # No RTTI: nothing here needs it, and relative RTTI would not match libc++abi's.
    target_compile_options(isocord_dave PRIVATE -fexperimental-relative-c++-abi-vtables -fno-rtti)
endif()
