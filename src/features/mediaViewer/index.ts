import { MediaViewerHost } from './MediaViewerHost'
import { registerViewerSheet } from './store'
import type { Feature } from '../../core/feature'

export { closeMediaViewer, openMediaViewer } from './store'

registerViewerSheet(MediaViewerHost)

/** The full-screen media viewer (the reference's media_viewer module), drawn as a sheet by ModalStack. */
export const mediaViewerFeature: Feature = { name: 'mediaViewer' }
