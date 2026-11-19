package me.palmdevs.isocord.chat

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import me.palmdevs.isocord.chat.list.ChatViewManager
import me.palmdevs.isocord.chat.media.ProxyImageViewManager
import me.palmdevs.isocord.chat.search.SearchResultsViewManager
import me.palmdevs.isocord.chat.viewer.MediaViewerViewManager

class ChatPackage : ReactPackage {
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
    listOf(
      ChatViewManager(),
      SearchResultsViewManager(),
      MessagePreviewViewManager(),
      ReactionsViewManager(),
      SpanTextViewManager(),
      MediaViewerViewManager(),
      ProxyImageViewManager(),
      me.palmdevs.isocord.expressions.ExpressionGridViewManager(),
      me.palmdevs.isocord.expressions.gifs.GifGridViewManager(),
    )
}
