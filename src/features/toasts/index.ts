import { ToastHost } from '../../design/components/overlays/ToastHost'
import type { Feature } from '../../core/feature'

export {
    hideToast,
    showToast,
    type ToastOptions,
    type ToastVariant,
} from '../../design/components/overlays/toastStore'

/** Mounts the host that renders toasts shown with `showToast`. */
export const toastsFeature: Feature = {
    name: 'toasts',
    overlays: { toasts: ToastHost },
}
