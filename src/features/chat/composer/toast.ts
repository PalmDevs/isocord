import { showToast } from '../../../design/components/overlays/toastStore'

/**
 * A short in-app toast with just text (the reference shows Mana toasts, never Android's system ones). Pass a `key`
 * when tapping the same thing again should replace the toast instead of queueing another.
 */
export function toast(message: string, key?: string): void {
    showToast({ content: message, key })
}
