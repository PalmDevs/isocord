import { useUnistyles } from 'react-native-unistyles'
import { rawColors } from '../../design/tokens/generated/rawColors'
import { hexColor } from '../chat/color'

/** GuildsBarConstants.DEFAULT_FOLDER_COLOR: BRAND_500, which a folder shows as "no colour". */
const DEFAULT_FOLDER_COLOR = rawColors.BRAND_500

const alpha = (opacity: number) =>
    Math.round(opacity * 255)
        .toString(16)
        .padStart(2, '0')

/** `foreground` (#rrggbb or #rrggbbaa) laid over the opaque `base`. */
function over(foreground: string, base: string): `#${string}` {
    const channel = (value: string, at: number) =>
        Number.parseInt(value.slice(1 + at * 2, 3 + at * 2), 16)
    const a = foreground.length > 7 ? channel(foreground, 3) / 255 : 1
    const mixed = [0, 1, 2].map(at =>
        Math.round(channel(foreground, at) * a + channel(base, at) * (1 - a))
            .toString(16)
            .padStart(2, '0'),
    )
    return `#${mixed.join('')}`
}

/** The colours a folder paints, from its synced colour (the default brand colour counts as none). */
export function useFolderColors(color?: number) {
    const { theme } = useUnistyles()
    const { GUILD_FOLDER_COLOR_OPACITY, GUILD_FOLDER_PREVIEW_OPACITY } =
        theme.modules.mobile
    const custom =
        color != null && hexColor(color) !== DEFAULT_FOLDER_COLOR
            ? hexColor(color)
            : null
    const background = custom
        ? `${custom}${alpha(GUILD_FOLDER_COLOR_OPACITY)}`
        : theme.colors.GUILD_FOLDER_BACKGROUND
    return {
        background,
        /** The closed folder's tile. */
        preview: custom
            ? `${custom}${alpha(GUILD_FOLDER_PREVIEW_OPACITY)}`
            : theme.colors.GUILD_FOLDER_BACKGROUND,
        /** What the folder background looks like over the bar, for a badge cut-out. */
        ring: over(background, theme.colors.BACKGROUND_BASE_LOWEST),
        icon: color != null ? hexColor(color) : DEFAULT_FOLDER_COLOR,
    }
}
