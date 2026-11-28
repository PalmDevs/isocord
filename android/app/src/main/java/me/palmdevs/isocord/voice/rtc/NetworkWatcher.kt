package me.palmdevs.isocord.voice.rtc

import android.content.Context
import android.net.ConnectivityManager
import android.net.LinkProperties
import android.net.Network
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Watches the default network. [online] is false between losing one and getting the next. [onChanged] fires when
 * the media path is likely broken: another network became the default, or the default one got a new address
 * (RTCConnection.tsx `_handleNetworkOnline`, `_handleNetworkOffline`).
 */
class NetworkWatcher(context: Context, private val tag: String, private val onChanged: () -> Unit) {
  private val manager = context.getSystemService(ConnectivityManager::class.java)
  private val _online = MutableStateFlow(true)
  val online: StateFlow<Boolean> = _online

  // Callback thread only.
  private var current: Network? = null
  private var addresses: Set<String> = emptySet()
  private var lost = false

  private val callback = object : ConnectivityManager.NetworkCallback() {
    override fun onAvailable(network: Network) {
      // The first call reports the network we are already on.
      val changed = current != null && (current != network || lost)
      // A new network's first addresses are no change of their own: one switch starts one recovery.
      if (current != network) addresses = emptySet()
      current = network
      lost = false
      _online.value = true
      if (changed) {
        Log.i(tag, "default network changed")
        onChanged()
      }
    }

    override fun onLinkPropertiesChanged(network: Network, properties: LinkProperties) {
      val next = properties.linkAddresses.mapTo(mutableSetOf()) { it.address.hostAddress.orEmpty() }
      val changed = network == current && addresses.isNotEmpty() && next != addresses
      addresses = next
      if (changed) {
        Log.i(tag, "network address changed")
        onChanged()
      }
    }

    override fun onLost(network: Network) {
      if (network != current) return
      Log.i(tag, "default network lost")
      lost = true
      _online.value = false
    }
  }

  fun start() {
    try {
      manager.registerDefaultNetworkCallback(callback)
    } catch (e: RuntimeException) {
      // Without the callback the peer's own state changes still drive recovery.
      Log.e(tag, "network callback not registered", e)
    }
  }

  fun stop() {
    try {
      manager.unregisterNetworkCallback(callback)
    } catch (e: IllegalArgumentException) {
      Log.w(tag, "network callback was not registered", e)
    }
  }
}
