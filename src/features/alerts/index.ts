import { ModalStack } from '../../design/components/overlays/ModalStack'
import type { Feature } from '../../core/feature'

/** Mounts the stack that draws alerts and sheets in the order they were opened. */
export const alertsFeature: Feature = {
    name: 'alerts',
    overlays: { modals: ModalStack },
}
