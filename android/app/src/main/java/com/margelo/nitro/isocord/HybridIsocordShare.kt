package com.margelo.nitro.isocord

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise
import java.util.concurrent.CopyOnWriteArrayList
import me.palmdevs.isocord.share.SharedContentInbox

/** Hands JS what other apps share to Isocord (src/native/specs/IsocordShare.nitro.ts). */
@DoNotStrip
@Keep
class HybridIsocordShare : HybridIsocordShareSpec() {
  private val listeners = CopyOnWriteArrayList<() -> Unit>()
  private val inboxListener = {
    for (listener in listeners) listener()
  }

  init {
    SharedContentInbox.onReceived = inboxListener
  }

  override fun takeShared(): Promise<String?> = Promise.resolved(SharedContentInbox.take())

  override fun onShared(listener: () -> Unit): () -> Unit {
    listeners.add(listener)
    return { listeners.remove(listener) }
  }

  override fun dispose() {
    listeners.clear()
    if (SharedContentInbox.onReceived === inboxListener) SharedContentInbox.onReceived = null
    super.dispose()
  }
}
