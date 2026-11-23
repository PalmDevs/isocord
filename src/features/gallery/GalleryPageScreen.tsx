import { useRoute } from '@react-navigation/native'
import { GalleryScaffold } from './GalleryPage'
import { galleryPages } from './registry'

export function GalleryPageScreen() {
    const { id } = useRoute().params as { id: string }
    const entry = galleryPages.find(page => page.id === id)
    if (!entry) return null
    return (
        <GalleryScaffold title={entry.title} fill={entry.fill}>
            <entry.Component />
        </GalleryScaffold>
    )
}
