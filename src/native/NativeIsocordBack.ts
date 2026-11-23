import { Platform, TurboModuleRegistry } from 'react-native'
import type { CodegenTypes, TurboModule } from 'react-native'

export interface BackPreviewFrame {
    owner: string
    offset: number
    finished: boolean
    committed: boolean
}

export interface Spec extends TurboModule {
    watch(owner: string, enabled: boolean, overlay: boolean): void
    setSheetScrollOverflow(reactTag: number, visible: boolean): void
    readonly onBackPreview: CodegenTypes.EventEmitter<BackPreviewFrame>
}

export default Platform.OS === 'android'
    ? TurboModuleRegistry.getEnforcing<Spec>('IsocordBack')
    : null
