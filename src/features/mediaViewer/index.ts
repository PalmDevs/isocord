import { MediaViewerHost } from './MediaViewerHost'
import type { Feature } from '../../core/feature'

export { closeMediaViewer, openMediaViewer } from './store'

/** The full-screen media viewer (the reference's media_viewer module). */
export const mediaViewerFeature: Feature = {
    name: 'mediaViewer',
    overlays: { mediaViewer: MediaViewerHost },
}
