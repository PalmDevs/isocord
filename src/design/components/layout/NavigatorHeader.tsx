import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Icon } from '../../icons/Icon'
import { RipplePressable } from '../buttons/RipplePressable'
import { Text } from '../Text'
import { NAV_BAR_HEIGHT } from './navBarHeight'
import type { ReactNode } from 'react'
import type { SemanticColor } from '../../tokens'

interface NavigatorHeaderProps {
    title?: string
    subtitle?: string
    /** GenericHeaderTitle's `subtitleColor`, e.g. a warning. */
    subtitleColor?: SemanticColor
    /** Replaces the title and subtitle, e.g. an avatar with a name. */
    children?: ReactNode
    /** Shown before the title, e.g. a channel icon. */
    titleIcon?: ReactNode
    onBack?: () => void
    backIcon?: 'ArrowLargeLeftIcon' | 'XLargeIcon'
    backLabel?: string
    /**
     * Makes the whole bar tappable (the back and trailing buttons keep their own taps) and draws the arrow after the
     * title (ChannelTitle's `disableArrow: false`), for headers that open a details screen.
     */
    onTitlePress?: () => void
    titleLabel?: string
    trailing?: ReactNode
    /** Pads the bar below the status bar; off when the parent already does. */
    safeArea?: boolean
}

/** The stack header of the reference client (design/components/Navigator/native/NavigatorHeader). */
export function NavigatorHeader({
    title,
    subtitle,
    subtitleColor = 'TEXT_MUTED',
    children,
    titleIcon,
    onBack,
    backIcon = 'ArrowLargeLeftIcon',
    backLabel,
    onTitlePress,
    titleLabel,
    trailing,
    safeArea = true,
}: NavigatorHeaderProps) {
    const Bar = onTitlePress ? RipplePressable : View
    return (
        <View style={styles.container(safeArea)}>
            <Bar
                style={styles.bar(safeArea)}
                {...(onTitlePress && {
                    // The title is the accessible button; the bar only widens the touch target.
                    accessible: false,
                    onPress: onTitlePress,
                })}
            >
                {onBack && (
                    <RipplePressable
                        borderless
                        radius={20}
                        accessibilityRole="button"
                        accessibilityLabel={backLabel}
                        hitSlop={12}
                        onPress={onBack}
                    >
                        <Icon name={backIcon} color="ICON_SUBTLE" />
                    </RipplePressable>
                )}
                <View
                    style={styles.title}
                    {...(onTitlePress && {
                        accessible: true,
                        accessibilityRole: 'button' as const,
                        accessibilityLabel: titleLabel,
                        accessibilityActions: [{ name: 'activate' }],
                        onAccessibilityAction: onTitlePress,
                    })}
                >
                    {children ?? (
                        <>
                            <View style={styles.titleRow}>
                                {titleIcon}
                                <Text
                                    accessibilityRole="header"
                                    variant="redesign/heading-18/bold"
                                    color="MOBILE_TEXT_HEADING_PRIMARY"
                                    lineClamp={1}
                                    style={styles.titleText}
                                >
                                    {title}
                                </Text>
                                {onTitlePress && (
                                    <Icon
                                        name="ChevronSmallRightIcon"
                                        size="xs"
                                        color="INTERACTIVE_TEXT_DEFAULT"
                                        style={styles.arrow}
                                    />
                                )}
                            </View>
                            {subtitle ? (
                                <Text
                                    variant="text-xs/medium"
                                    color={subtitleColor}
                                    lineClamp={1}
                                    style={styles.subtitle}
                                >
                                    {subtitle}
                                </Text>
                            ) : null}
                        </>
                    )}
                </View>
                {trailing}
            </Bar>
        </View>
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    container: (safeArea: boolean) => ({
        height: (safeArea ? runtime.insets.top : 0) + NAV_BAR_HEIGHT,
        backgroundColor: theme.colors.BACKGROUND_BASE_LOWER,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.BORDER_SUBTLE,
    }),
    // The bar takes the status bar's room too, so a pressable title's ripple fills the header up to the top.
    bar: (safeArea: boolean) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_16,
        paddingTop: safeArea ? runtime.insets.top : 0,
        paddingHorizontal: theme.space.PX_16,
    }),
    title: { flex: 1, justifyContent: 'center' },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_4,
    },
    titleText: { flexShrink: 1 },
    // ChannelHeaderShared arrowIcon.
    arrow: { marginTop: 2, marginLeft: 2 },
    subtitle: { marginTop: -2 },
}))
