import { launchImageLibraryAsync } from 'expo-image-picker'

/** The icon is square. */
const ICON_ASPECT: [number, number] = [1, 1]
/** Keeps the data URI small. A group icon is shown at a few dozen pixels. */
const ICON_QUALITY = 0.8
const FALLBACK_MIME_TYPE = 'image/jpeg'

export interface PickedIcon {
    /** For the preview. */
    uri: string
    /** What the API takes as an icon. */
    dataUri: string
}

/** Lets the user pick and crop a square image from the photo picker. Returns nothing when they back out. */
export async function pickGroupIcon(): Promise<PickedIcon | undefined> {
    const result = await launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: ICON_ASPECT,
        quality: ICON_QUALITY,
        base64: true,
    })
    const asset = result.canceled ? undefined : result.assets[0]
    if (!asset?.base64) return undefined
    return {
        uri: asset.uri,
        dataUri: `data:${asset.mimeType ?? FALLBACK_MIME_TYPE};base64,${asset.base64}`,
    }
}
