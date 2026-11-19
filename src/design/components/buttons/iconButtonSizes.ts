import type { ButtonSize } from './Button'

// ButtonConstants: pill height, icon size and the 44px minimum hit area.
export const ICON_BUTTON_SIZES: Record<
    ButtonSize,
    { height: number; icon: number }
> = {
    sm: { height: 32, icon: 18 },
    md: { height: 40, icon: 20 },
    lg: { height: 48, icon: 24 },
}
