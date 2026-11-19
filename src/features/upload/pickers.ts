import { getDocumentAsync } from 'expo-document-picker'
import {
    launchCameraAsync,
    launchImageLibraryAsync,
    requestCameraPermissionsAsync,
} from 'expo-image-picker'
import type { AttachmentInput } from './store'

/** Everything a picker returns can go straight to `addAttachments`. */
export type PickedItem = AttachmentInput

interface PickerAsset {
    uri: string
    fileName?: string | null
    mimeType?: string
    width?: number
    height?: number
    /** Milliseconds. */
    duration?: number | null
    fileSize?: number
}

const toItem = (asset: PickerAsset): PickedItem => ({
    uri: asset.uri,
    filename: asset.fileName ?? undefined,
    mimeType: asset.mimeType,
    size: asset.fileSize,
    width: asset.width,
    height: asset.height,
    durationSecs: asset.duration ? asset.duration / 1000 : undefined,
})

/** Photos and videos from the system photo picker, which needs no storage permission. */
export async function pickFromGallery(
    options: { multiple?: boolean; limit?: number } = {},
): Promise<PickedItem[]> {
    const result = await launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: options.multiple ?? true,
        selectionLimit: options.limit ?? 10,
        // Files are uploaded as they are; compression is done natively when a file is too big.
        quality: 1,
    })
    return result.canceled ? [] : result.assets.map(toItem)
}

/**
 * Takes a photo or video with the system camera. Returns an empty list when the user backs out or
 * denies the camera permission.
 */
export async function pickFromCamera(
    options: { video?: boolean } = {},
): Promise<PickedItem[]> {
    const permission = await requestCameraPermissionsAsync()
    if (!permission.granted) return []
    const result = await launchCameraAsync({
        mediaTypes: options.video ? ['images', 'videos'] : ['images'],
        quality: 1,
    })
    return result.canceled ? [] : result.assets.map(toItem)
}

/** Any files, as `content://` uris that are read in place, never copied to the cache. */
export async function pickFiles(
    options: { multiple?: boolean; type?: string | string[] } = {},
): Promise<PickedItem[]> {
    const result = await getDocumentAsync({
        multiple: options.multiple ?? true,
        type: options.type ?? '*/*',
        copyToCacheDirectory: false,
    })
    if (result.canceled) return []
    return result.assets.map(asset => ({
        uri: asset.uri,
        filename: asset.name,
        mimeType: asset.mimeType,
        size: asset.size,
    }))
}
