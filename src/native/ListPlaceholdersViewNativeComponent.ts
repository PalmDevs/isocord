import { codegenNativeComponent } from 'react-native'
import type {
    CodegenTypes,
    ColorValue,
    HostComponent,
    ViewProps,
} from 'react-native'

/**
 * Wraps a list (ListPlaceholders.kt). Draws static placeholder rows behind its scroll view in the gaps between the
 * rows that are mounted, as FastestList's FEED_ITEM placeholder. Sizes are dp.
 */
export interface NativeProps extends ViewProps {
    /** The row card. None when unset. */
    cardColor?: ColorValue
    /** The avatar and the label bar. */
    shapeColor: ColorValue
    rowHeight: CodegenTypes.Float
    /** Space between the list's sides and the rows. */
    sideInset: CodegenTypes.Float
    /** The list content's bottom padding: no placeholders below the last row. */
    endInset: CodegenTypes.Float
    /** Space before the avatar. */
    rowPaddingStart: CodegenTypes.Float
    /** Space between the avatar and the label bar. */
    labelGap: CodegenTypes.Float
    /** Space after the label bar's widest extent. */
    rowPaddingEnd: CodegenTypes.Float
    avatarSize: CodegenTypes.Float
    avatarRadius: CodegenTypes.Float
    labelHeight: CodegenTypes.Float
    labelRadius: CodegenTypes.Float
    /** Range of the label bar's width, as fractions of the space after the avatar. Varies by row. */
    labelWidthMin: CodegenTypes.Float
    labelWidthMax: CodegenTypes.Float
}

export default codegenNativeComponent<NativeProps>(
    'IsocordListPlaceholdersView',
) as HostComponent<NativeProps>
