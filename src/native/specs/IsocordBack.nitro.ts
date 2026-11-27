import type { HybridObject } from 'react-native-nitro-modules'

export interface BackPreviewFrame {
    owner: string
    offset: number
    finished: boolean
    committed: boolean
}

/** AndroidX Back progress for panels managed by JS (HybridIsocordBack.kt). */
export interface IsocordBack extends HybridObject<{ android: 'kotlin' }> {
    watch(owner: string, enabled: boolean, overlay: boolean): void
    setSheetScrollOverflow(reactTag: number, visible: boolean): void
    onBackPreview(listener: (frame: BackPreviewFrame) => void): () => void
}
