# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Readable stack traces with build/outputs/mapping/release/mapping.txt.
-keepattributes SourceFile,LineNumberTable

# Library consumer rules cover the rest: React Native (modules, @ReactProp, @DoNotStrip, JNI), Expo, Reanimated,
# Worklets, Screens, Svg, expo-image, Nitro (@Keep), kotlinx.serialization, OkHttp, Coil, Media3 and Lottie.
# Only lookups by name that no library rule keeps follow.

# react-native-keyboard-controller (ReactNestedScrollViewCompat): Class.forName with a class loader.
-keepnames class com.facebook.react.views.scroll.ReactNestedScrollView
# react-native-unistyles (NativePlatform.checkEdgeToEdge): Class.forName to detect react-native-edge-to-edge.
-keepnames class com.zoontek.rnedgetoedge.EdgeToEdgePackage
