import { NitroModules } from 'react-native-nitro-modules'
import type { IsocordShare } from './specs/IsocordShare.nitro'

/** A file another app shared (SharedFile in SharedContent.kt). */
export interface SharedFile {
    uri: string
    filename?: string
    mimeType?: string
}

/** What another app shared: its text and files (SharedContent in SharedContent.kt). */
export interface SharedContent {
    text: string
    files: SharedFile[]
}

export type { IsocordShare }

export default NitroModules.createHybridObject<IsocordShare>('IsocordShare')
