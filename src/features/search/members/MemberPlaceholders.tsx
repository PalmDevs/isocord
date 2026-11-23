import { useUnistyles } from 'react-native-unistyles'
import { ListPlaceholders } from '../../../design/components/ListPlaceholders'
import {
    MEMBER_AVATAR_SIZE,
    MEMBER_PLACEHOLDER_ROW_HEIGHT,
    PLACEHOLDER_LABEL,
} from './MemberRow'
import { contentEndPadding } from './styles'
import type { ComponentProps } from 'react'

/**
 * UsersFastList's placeholderConfig (useFastestListTableRowPlaceholderConfig), drawn as MemberPlaceholderRow: a
 * card with an avatar and a name bar.
 */
export function MemberPlaceholders({
    children,
}: Omit<ComponentProps<typeof ListPlaceholders>, 'config'>) {
    const { theme, rt } = useUnistyles()
    const padding = theme.modules.mobile.TABLE_ROW_PADDING
    return (
        <ListPlaceholders
            config={{
                cardColor: theme.colors.CARD_MUTED_BG,
                shapeColor: theme.colors.BORDER_SUBTLE,
                rowHeight: MEMBER_PLACEHOLDER_ROW_HEIGHT,
                // The list content's side padding (styles.content).
                sideInset: theme.space.PX_16,
                endInset: contentEndPadding(theme, rt.insets.bottom),
                rowPaddingStart: padding,
                labelGap: padding,
                rowPaddingEnd: padding,
                avatarSize: MEMBER_AVATAR_SIZE,
                avatarRadius: MEMBER_AVATAR_SIZE / 2,
                labelHeight: PLACEHOLDER_LABEL.height,
                labelRadius: PLACEHOLDER_LABEL.radius,
                labelWidthMin: PLACEHOLDER_LABEL.widthRatio,
                labelWidthMax: PLACEHOLDER_LABEL.widthRatio,
            }}
        >
            {children}
        </ListPlaceholders>
    )
}
