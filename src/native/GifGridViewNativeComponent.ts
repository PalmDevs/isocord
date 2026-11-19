import { codegenNativeComponent } from 'react-native'
import type { CodegenTypes, HostComponent, ViewProps } from 'react-native'

export interface NativeProps extends ViewProps {
    /**
     * JSON array of tiles, in order. See `GifTile` in src/features/expressions/picker/GifGrid.tsx (decoded as
     * GifTile in GifTiles.kt). The view lays them out in two columns, three on a wide screen.
     */
    tiles: string
    /** JSON object of `ChatTheme` (src/features/chat/theme.ts). */
    theme: string
    /** dp below the last row. */
    bottomPadding?: CodegenTypes.Float
    /** A tile was tapped. */
    onPressItem?: CodegenTypes.DirectEventHandler<{ key: string }>
    /** A GIF (not a category or placeholder) was held. */
    onLongPressItem?: CodegenTypes.DirectEventHandler<{ key: string }>
    /** Whether the grid is scrolled to its top (the sheet it is in drags from it then). */
    onAtTop?: CodegenTypes.DirectEventHandler<{ atTop: boolean }>
}

export default codegenNativeComponent<NativeProps>(
    'IsocordGifGridView',
) as HostComponent<NativeProps>
