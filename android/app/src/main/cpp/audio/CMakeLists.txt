# libisocord_audio.so: RNNoise, fetched by vendor/rnnoise/fetch.sh, plus its JNI bridge.
set(RNNOISE_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/../../../../../../vendor/rnnoise/src)
if(NOT EXISTS ${RNNOISE_ROOT}/src/rnnoise_data.c)
    message(FATAL_ERROR "RNNoise is missing. Run vendor/rnnoise/fetch.sh")
endif()

# librnnoise_la_SOURCES in RNNoise's Makefile.am, without x86 run-time CPU detection.
add_library(rnnoise STATIC
    ${RNNOISE_ROOT}/src/denoise.c
    ${RNNOISE_ROOT}/src/rnn.c
    ${RNNOISE_ROOT}/src/pitch.c
    ${RNNOISE_ROOT}/src/kiss_fft.c
    ${RNNOISE_ROOT}/src/celt_lpc.c
    ${RNNOISE_ROOT}/src/nnet.c
    ${RNNOISE_ROOT}/src/nnet_default.c
    ${RNNOISE_ROOT}/src/parse_lpcnet_weights.c
    ${RNNOISE_ROOT}/src/rnnoise_data.c
    ${RNNOISE_ROOT}/src/rnnoise_tables.c)
target_include_directories(rnnoise PUBLIC ${RNNOISE_ROOT}/include PRIVATE ${RNNOISE_ROOT}/src)
# configure.ac defaults: int8 weights only, no float debug copies.
target_compile_definitions(rnnoise PRIVATE RNNOISE_BUILD DISABLE_DEBUG_FLOAT)
set_target_properties(rnnoise PROPERTIES POSITION_INDEPENDENT_CODE ON)
target_compile_options(rnnoise PRIVATE -O3)
if(ANDROID_ABI STREQUAL "x86_64")
    # The x86_64 ABI guarantees SSE4.2. nnet.h warns that AVX2 is off, which is fine for the emulator.
    target_compile_options(rnnoise PRIVATE -msse4.1 "-Wno-#warnings")
endif()

add_library(isocord_audio SHARED audio_jni.cpp)
set_target_properties(isocord_audio PROPERTIES CXX_STANDARD 20 CXX_STANDARD_REQUIRED ON)
target_link_libraries(isocord_audio PRIVATE rnnoise log m)
target_link_options(isocord_audio PRIVATE -Wl,--exclude-libs,ALL -Wl,--gc-sections)
