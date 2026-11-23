import { TurboModuleRegistry } from 'react-native'
import type { CodegenTypes, TurboModule } from 'react-native'

export interface BackPreviewFrame {
    owner: string
    offset: number
    finished: boolean
}

export interface Spec extends TurboModule {
    watch(owner: string, enabled: boolean, overlay: boolean): void
    readonly onBackPreview: CodegenTypes.EventEmitter<BackPreviewFrame>
}

export default TurboModuleRegistry.getEnforcing<Spec>('IsocordBack')
