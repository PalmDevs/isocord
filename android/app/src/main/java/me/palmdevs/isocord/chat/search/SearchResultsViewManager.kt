package me.palmdevs.isocord.chat.search

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.IsocordSearchResultsViewManagerDelegate
import com.facebook.react.viewmanagers.IsocordSearchResultsViewManagerInterface
import me.palmdevs.isocord.chat.rows.parseTheme

/** Exposes [SearchResultsView] to React as `IsocordSearchResultsView` (src/native/SearchResultsViewNativeComponent.ts). */
@ReactModule(name = SearchResultsViewManager.NAME)
class SearchResultsViewManager :
  SimpleViewManager<SearchResultsView>(),
  IsocordSearchResultsViewManagerInterface<SearchResultsView> {
  private val delegate = IsocordSearchResultsViewManagerDelegate<SearchResultsView, SearchResultsViewManager>(this)

  override fun getDelegate(): ViewManagerDelegate<SearchResultsView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): SearchResultsView = SearchResultsView(context)

  @ReactProp(name = "rows")
  override fun setRows(view: SearchResultsView, value: String?) {
    view.updateRows(parseSearchRows(value))
  }

  @ReactProp(name = "theme")
  override fun setTheme(view: SearchResultsView, value: String?) {
    view.updateTheme(parseTheme(value))
  }

  @ReactProp(name = "lineClamp", defaultInt = 4)
  override fun setLineClamp(view: SearchResultsView, value: Int) {
    view.lineClamp = value
  }

  @ReactProp(name = "inertContent", defaultBoolean = false)
  override fun setInertContent(view: SearchResultsView, value: Boolean) {
    view.inertContent = value
  }

  @ReactProp(name = "maxContentHeight", defaultFloat = 0f)
  override fun setMaxContentHeight(view: SearchResultsView, value: Float) {
    view.maxContentHeight = value
  }

  @ReactProp(name = "topPadding", defaultFloat = 0f)
  override fun setTopPadding(view: SearchResultsView, value: Float) {
    view.topPadding = value
  }

  @ReactProp(name = "bottomPadding", defaultFloat = 0f)
  override fun setBottomPadding(view: SearchResultsView, value: Float) {
    view.bottomPadding = value
  }

  @ReactProp(name = "resultLongPress", defaultBoolean = false)
  override fun setResultLongPress(view: SearchResultsView, value: Boolean) {
    view.resultLongPress = value
  }

  @ReactProp(name = "refreshable", defaultBoolean = false)
  override fun setRefreshable(view: SearchResultsView, value: Boolean) {
    view.refreshable = value
  }

  @ReactProp(name = "refreshing", defaultBoolean = false)
  override fun setRefreshing(view: SearchResultsView, value: Boolean) {
    view.refreshing = value
  }

  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
    listOf("LinkPress", "ResultLongPress", "EndReached", "Refresh", "ScrollDrag").associate { "top$it" to mapOf("registrationName" to "on$it") }

  companion object {
    const val NAME = "IsocordSearchResultsView"
  }
}
