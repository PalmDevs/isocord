import * as Clipboard from 'expo-clipboard'
import { File, Paths } from 'expo-file-system'
import {
    requestPermissionsAsync,
    saveToLibraryAsync,
} from 'expo-media-library/legacy'
import { openLink } from '../../core/openLink'
import { t } from '../../i18n'
import { toast } from '../chat/composer/toast'
import type { ViewerSource } from './sources'

/** ToastUtils.presentImageSaved, presentVideoSaved, presentGifSaved. */
const SAVED = {
    image: 'mediaViewer.imageSaved',
    video: 'mediaViewer.videoSaved',
    gif: 'mediaViewer.gifSaved',
} as const

/**
 * MediaSourceUtil.downloadMediaAsset: the file at `url` into the device's media library, with the toast for its
 * kind. Used by the media viewer and the long press sheet.
 */
export async function saveMedia(
    url: string,
    kind: ViewerSource['kind'],
): Promise<void> {
    try {
        const permission = await requestPermissionsAsync(true)
        if (!permission.granted) throw new Error('No media library access')
        const name =
            decodeURIComponent(url.split('?', 1)[0]?.split('/').pop() ?? '') ||
            'media'
        const file = await File.downloadFileAsync(
            url,
            new File(Paths.cache, name),
            { idempotent: true },
        )
        await saveToLibraryAsync(file.uri)
        file.delete()
        toast(t(SAVED[kind]))
    } catch {
        toast(t('mediaViewer.saveFailed'))
    }
}

/** Copy Media Link (MediaShareActions). */
export function copyMediaLink(url: string): void {
    Clipboard.setStringAsync(url).catch(() => {})
    toast(t('mediaViewer.linkCopied'))
}

/** Open in Browser (MediaShareActions). */
export function openMediaLink(url: string): void {
    void openLink(url)
}
