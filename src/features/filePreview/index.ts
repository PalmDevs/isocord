import { PlaintextFilePreviewScreen } from './PlaintextFilePreviewScreen'
import type { Feature } from '../../core/feature'

/** A text file attachment's contents (openPlaintextFilePreview). */
export const filePreviewFeature: Feature = {
    name: 'filePreview',
    screens: { plaintextFilePreview: PlaintextFilePreviewScreen },
}
