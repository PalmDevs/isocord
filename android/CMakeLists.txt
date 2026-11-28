cmake_minimum_required(VERSION 3.13)

# React Native's appmodules library (autolinked TurboModules, Fabric components, and IsocordSpec).
project(appmodules)
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# NitroIsocord C++ library (Nitrogen-generated HybridObjects and JNI registration).
add_library(NitroIsocord SHARED
  app/src/main/cpp/cpp-adapter.cpp
)
set_target_properties(NitroIsocord PROPERTIES
  CXX_STANDARD 20
  CXX_STANDARD_REQUIRED ON
  CXX_EXTENSIONS OFF
)
target_compile_options(NitroIsocord PRIVATE
  -frtti
  -fexceptions
  -fstack-protector-all
)
set_source_files_properties(app/src/main/cpp/cpp-adapter.cpp PROPERTIES
  COMPILE_OPTIONS "-Wall;-Wextra"
)
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/NitroIsocord+autolinking.cmake)

get_target_property(NITRO_SOURCES NitroIsocord SOURCES)
list(FILTER NITRO_SOURCES INCLUDE REGEX "nitrogen/generated/")
set_source_files_properties(${NITRO_SOURCES} PROPERTIES
  COMPILE_OPTIONS "-w"
)

# Voice: libisocord_dave.so (DAVE end-to-end encryption) and libisocord_audio.so (RNNoise).
add_subdirectory(${CMAKE_SOURCE_DIR}/app/src/main/cpp/dave ${CMAKE_CURRENT_BINARY_DIR}/dave)
add_subdirectory(${CMAKE_SOURCE_DIR}/app/src/main/cpp/audio ${CMAKE_CURRENT_BINARY_DIR}/audio)

find_library(LOG_LIB log)

target_link_libraries(
  NitroIsocord
  ${LOG_LIB}
  android
)
