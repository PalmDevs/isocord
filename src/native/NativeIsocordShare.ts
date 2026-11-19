import { TurboModuleRegistry } from 'react-native'
import type { CodegenTypes, TurboModule } from 'react-native'

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

/** Content shared to the app with a SEND or SEND_MULTIPLE intent (ShareModule.kt). */
export interface Spec extends TurboModule {
    /** Returns the pending share as SharedContent JSON, once. Null when there is none. */
    takeShared(): Promise<string | null>
    /** A share arrived; `takeShared` returns it. */
    readonly onShared: CodegenTypes.EventEmitter<void>
}

export default TurboModuleRegistry.getEnforcing<Spec>('IsocordShare')
