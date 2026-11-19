import type { SemanticColor } from '../../tokens'

export type ButtonVariant =
    | 'primary'
    | 'secondary'
    | 'tertiary'
    | 'destructive'
    | 'critical-primary'
    | 'active'
    | 'critical-secondary'
    | 'primary-overlay'
    | 'secondary-overlay'

export interface VariantColors {
    text: SemanticColor
    background: SemanticColor
    backgroundPressed: SemanticColor
    border?: SemanticColor
    borderPressed?: SemanticColor
}

// getButtonColorTokens() in the reference client.
export const VARIANTS: Record<ButtonVariant, VariantColors> = {
    primary: {
        text: 'CONTROL_PRIMARY_TEXT_DEFAULT',
        background: 'CONTROL_PRIMARY_BACKGROUND_DEFAULT',
        backgroundPressed: 'CONTROL_PRIMARY_BACKGROUND_ACTIVE',
        border: 'CONTROL_PRIMARY_BORDER_DEFAULT',
        borderPressed: 'CONTROL_PRIMARY_BORDER_ACTIVE',
    },
    secondary: {
        text: 'CONTROL_SECONDARY_TEXT_DEFAULT',
        background: 'CONTROL_SECONDARY_BACKGROUND_DEFAULT',
        backgroundPressed: 'CONTROL_SECONDARY_BACKGROUND_ACTIVE',
        border: 'CONTROL_SECONDARY_BORDER_DEFAULT',
        borderPressed: 'CONTROL_SECONDARY_BORDER_ACTIVE',
    },
    tertiary: {
        text: 'REDESIGN_BUTTON_TERTIARY_TEXT',
        background: 'REDESIGN_BUTTON_TERTIARY_BACKGROUND',
        backgroundPressed: 'REDESIGN_BUTTON_TERTIARY_PRESSED_BACKGROUND',
    },
    destructive: {
        text: 'CONTROL_CRITICAL_PRIMARY_TEXT_DEFAULT',
        background: 'CONTROL_CRITICAL_PRIMARY_BACKGROUND_DEFAULT',
        backgroundPressed: 'CONTROL_CRITICAL_PRIMARY_BACKGROUND_ACTIVE',
        border: 'CONTROL_CRITICAL_PRIMARY_BORDER_DEFAULT',
        borderPressed: 'CONTROL_CRITICAL_PRIMARY_BORDER_ACTIVE',
    },
    'critical-primary': {
        text: 'CONTROL_CRITICAL_PRIMARY_TEXT_DEFAULT',
        background: 'CONTROL_CRITICAL_PRIMARY_BACKGROUND_DEFAULT',
        backgroundPressed: 'CONTROL_CRITICAL_PRIMARY_BACKGROUND_ACTIVE',
        border: 'CONTROL_CRITICAL_PRIMARY_BORDER_DEFAULT',
        borderPressed: 'CONTROL_CRITICAL_PRIMARY_BORDER_ACTIVE',
    },
    active: {
        text: 'CONTROL_CONNECTED_TEXT_DEFAULT',
        background: 'CONTROL_CONNECTED_BACKGROUND_DEFAULT',
        backgroundPressed: 'CONTROL_CONNECTED_BACKGROUND_ACTIVE',
        border: 'CONTROL_CONNECTED_BORDER_DEFAULT',
        borderPressed: 'CONTROL_CONNECTED_BORDER_ACTIVE',
    },
    'primary-overlay': {
        text: 'CONTROL_OVERLAY_PRIMARY_TEXT_DEFAULT',
        background: 'CONTROL_OVERLAY_PRIMARY_BACKGROUND_DEFAULT',
        backgroundPressed: 'CONTROL_OVERLAY_PRIMARY_BACKGROUND_ACTIVE',
        border: 'CONTROL_OVERLAY_PRIMARY_BORDER_DEFAULT',
        borderPressed: 'CONTROL_OVERLAY_PRIMARY_BORDER_DEFAULT',
    },
    'secondary-overlay': {
        text: 'CONTROL_OVERLAY_SECONDARY_TEXT_DEFAULT',
        background: 'CONTROL_OVERLAY_SECONDARY_BACKGROUND_DEFAULT',
        backgroundPressed: 'CONTROL_OVERLAY_SECONDARY_BACKGROUND_ACTIVE',
        border: 'CONTROL_OVERLAY_SECONDARY_BORDER_DEFAULT',
        borderPressed: 'CONTROL_OVERLAY_SECONDARY_BORDER_DEFAULT',
    },
    'critical-secondary': {
        text: 'CONTROL_CRITICAL_SECONDARY_TEXT_DEFAULT',
        background: 'CONTROL_CRITICAL_SECONDARY_BACKGROUND_DEFAULT',
        backgroundPressed: 'CONTROL_CRITICAL_SECONDARY_BACKGROUND_ACTIVE',
        border: 'CONTROL_CRITICAL_SECONDARY_BORDER_DEFAULT',
        borderPressed: 'CONTROL_CRITICAL_SECONDARY_BORDER_ACTIVE',
    },
}
