import { registerComposerSlots } from '../chat/composer'
import { SharePreviewPanel } from './SharePreview'
import { ShareScreen } from './ShareScreen'
import type { Feature } from '../../core/feature'

export { canForwardMessage } from './canForward'
export { useSharedContent } from './inbox'
export type { ShareParams } from './params'

// The forwarded message, above the composer's card and its files.
registerComposerSlots({
    panels: {
        sharePreview: {
            placement: 'above',
            order: -10,
            Component: SharePreviewPanel,
        },
    },
})

/** Forwarding a message and sharing from other apps (ForwardModal, ShareScreen), on one screen. */
export const shareFeature: Feature = {
    name: 'share',
    screens: { share: ShareScreen },
}
