package me.palmdevs.isocord.core

import android.view.Choreographer
import android.view.View
import androidx.compose.ui.platform.AbstractComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.findViewTreeLifecycleOwner

/** Visibility moves outgoing views into its overlay on the next draw. */
internal object DisposeAfterDetach : ViewCompositionStrategy {
  override fun installFor(view: AbstractComposeView): () -> Unit {
    val frames = Choreographer.getInstance()
    var compositionLifecycle = view.findViewTreeLifecycleOwner()?.lifecycle
    val dispose = Choreographer.FrameCallback {
      if (!view.isAttachedToWindow) {
        compositionLifecycle = null
        view.disposeComposition()
      }
    }
    val allowRelocation = Choreographer.FrameCallback { frames.postFrameCallback(dispose) }
    val cancelDisposal = {
      frames.removeFrameCallback(allowRelocation)
      frames.removeFrameCallback(dispose)
    }
    val listener = object : View.OnAttachStateChangeListener {
      override fun onViewAttachedToWindow(v: View) {
        cancelDisposal()
        val lifecycle = view.findViewTreeLifecycleOwner()?.lifecycle ?: return
        if (lifecycle.currentState == Lifecycle.State.DESTROYED) return

        val previous = compositionLifecycle
        if (previous != null && previous.currentState != Lifecycle.State.DESTROYED) return
        compositionLifecycle = lifecycle
        if (previous != null) {
          // WrappedComposition is disposed by its lifecycle. AbstractComposeView retains its reference.
          view.disposeComposition()
          view.createComposition()
        }
      }

      override fun onViewDetachedFromWindow(v: View) = frames.postFrameCallback(allowRelocation)
    }
    view.addOnAttachStateChangeListener(listener)
    return {
      view.removeOnAttachStateChangeListener(listener)
      cancelDisposal()
    }
  }
}
