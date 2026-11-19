import { Image, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { duotoneIconSources, iconSources } from './generated'
import type { ImageStyle, StyleProp } from 'react-native'
import type { SemanticColor } from '../tokens'

export type IconName =
    | keyof typeof iconSources
    | keyof typeof duotoneIconSources

const resolved = new Map<string, unknown>()
/** Runs an icon's lazy require() once and caches the result. */
function resolve<T>(name: string, thunk: () => T): T {
    if (!resolved.has(name)) resolved.set(name, thunk())
    return resolved.get(name) as T
}

const SIZES = { xxs: 12, xs: 16, sm: 18, md: 24, lg: 32 } as const

export interface IconProps {
    name: IconName
    size?: keyof typeof SIZES
    color?: SemanticColor
    /** Fill for the back layer of two-layer icons. Transparent when omitted. */
    secondaryColor?: SemanticColor
    style?: StyleProp<ImageStyle>
    accessibilityLabel?: string
}

export function Icon({
    name,
    size = 'md',
    color = 'INTERACTIVE_ICON_DEFAULT',
    secondaryColor,
    style,
    accessibilityLabel,
}: IconProps) {
    const accessibility = {
        accessible: accessibilityLabel !== undefined,
        accessibilityLabel,
    }
    const iconStyle = [styles.icon(SIZES[size], color), style]

    if (name in duotoneIconSources) {
        const layers = resolve(
            name,
            duotoneIconSources[name as keyof typeof duotoneIconSources],
        )
        return (
            <View {...accessibility}>
                {secondaryColor && (
                    <Image
                        source={layers.secondary}
                        fadeDuration={0}
                        style={[
                            styles.icon(SIZES[size], secondaryColor),
                            style,
                        ]}
                    />
                )}
                <Image
                    source={layers.primary}
                    fadeDuration={0}
                    style={[iconStyle, secondaryColor && styles.overlay]}
                />
            </View>
        )
    }
    return (
        <Image
            source={resolve(
                name,
                iconSources[name as keyof typeof iconSources],
            )}
            fadeDuration={0}
            {...accessibility}
            style={iconStyle}
        />
    )
}

const styles = StyleSheet.create(theme => ({
    icon: (size: number, color: SemanticColor) => ({
        width: size,
        height: size,
        tintColor: theme.colors[color],
    }),
    overlay: { position: 'absolute', top: 0 },
}))
