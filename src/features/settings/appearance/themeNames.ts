import { t } from '../../../i18n'
import type { CustomThemes, ThemeChoice, ThemeId } from '../../../design/tokens'
import type { MessageKey } from '../../../i18n'

/** The reference's mobile theme picker offers Light, Dark and Onyx; Ash is the desktop one and Isocord's default. */
export const BASE_THEMES: { id: ThemeId; name: MessageKey }[] = [
    { id: 'light', name: 'settings.theme.light' },
    { id: 'dark', name: 'settings.theme.ash' },
    { id: 'darker', name: 'settings.theme.dark' },
    { id: 'midnight', name: 'settings.theme.onyx' },
]

/** ClientThemesConstants: each preset's getName(). */
const PRESET_NAMES: Record<string, MessageKey> = {
    BLURPLE_TWILIGHT: 'settings.theme.preset.blurpleTwilight',
    SUNSET: 'settings.theme.preset.sunset',
    CHROMA_GLOW: 'settings.theme.preset.chromaGlow',
    FOREST: 'settings.theme.preset.forest',
    CRIMSON_MOON: 'settings.theme.preset.crimsonMoon',
    MIDNIGHT_BLURPLE: 'settings.theme.preset.midnightBlurple',
    MARS: 'settings.theme.preset.mars',
    DUSK: 'settings.theme.preset.dusk',
    UNDER_THE_SEA: 'settings.theme.preset.underTheSea',
    RETRO_STORM: 'settings.theme.preset.retroStorm',
    NEON_NIGHTS: 'settings.theme.preset.neonNights',
    STRAWBERRY_LEMONADE: 'settings.theme.preset.strawberryLemonade',
    AURORA: 'settings.theme.preset.aurora',
    SEPIA: 'settings.theme.preset.sepia',
    MINT_APPLE: 'settings.theme.preset.mintApple',
    CITRUS_SHERBERT: 'settings.theme.preset.citrusSherbert',
    RETRO_RAINCLOUD: 'settings.theme.preset.retroRaincloud',
    HANAMI: 'settings.theme.preset.hanami',
    SUNRISE: 'settings.theme.preset.sunrise',
    COTTON_CANDY: 'settings.theme.preset.cottonCandy',
    LOFI_VIBES: 'settings.theme.preset.lofiVibes',
    DESERT_KHAKI: 'settings.theme.preset.desertKhaki',
}

/** Returns a theme choice's display name, or undefined for an unknown id. Custom themes are numbered in order. */
export function themeName(
    choice: ThemeChoice,
    customs: CustomThemes,
): string | undefined {
    const custom = Object.keys(customs).indexOf(choice)
    if (custom !== -1)
        return t('settings.theme.custom.numbered', { number: custom + 1 })
    const key =
        BASE_THEMES.find(theme => theme.id === choice)?.name ??
        PRESET_NAMES[choice]
    return key && t(key)
}
