package me.palmdevs.isocord.voice

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import me.palmdevs.isocord.voice.video.VideoViewManager

/** The call's video view. The voice modules are Nitro HybridObjects (HybridIsocordVoice.kt and its neighbours). */
class VoicePackage : ReactPackage {
  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    listOf(VideoViewManager())
}
