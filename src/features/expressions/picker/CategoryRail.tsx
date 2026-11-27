import { memo, useEffect, useRef } from 'react'
import { ScrollView } from 'react-native'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Animated, {
    useAnimatedStyle,
    useSharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StyleSheet } from 'react-native-unistyles'
import { useSessionStore } from '../../../core/react'
import { GuildIcon } from '../../../design/components/avatars/GuildIcon'
import { RipplePressable } from '../../../design/components/buttons/RipplePressable'
import { Emoji } from '../../../design/components/Emoji'
import { Icon } from '../../../design/icons/Icon'
import { guildsStore } from '../../../stores/guilds'
import { usePanelSheet } from '../../chat/composer'
import { twemojiUrl } from './emojiImage'
import { RAIL_HEIGHT } from './railHeight'
import type { ComponentRef } from 'react'
import type { IconName } from '../../../design/icons/Icon'

const ITEM_WIDTH = 36
const PADDING = 8

/** A category the rail jumps to: drawn as a server's icon, an icon, an emoji or an image, in that order. */
export interface RailSection {
    key: string
    title: string
    guildId?: string
    railIcon?: IconName
    railEmoji?: string
    railImage?: string
}

/**
 * The category strip under a picker grid. It stays at the bottom of the sheet the picker is in while the sheet
 * is dragged (the grid is laid out at the sheet's resting or full height, not every height in between), and
 * scrolls the active category into view. It keeps clear of the system bar, except while the keyboard covers that.
 */
export function CategoryRail({
    sections,
    active,
    onPress,
}: {
    sections: RailSection[]
    active: number
    onPress: (index: number) => void
}) {
    const { bottom } = useSafeAreaInsets()
    const keyboard = useReanimatedKeyboardAnimation()
    const sheet = usePanelSheet()
    const fallback = useSharedValue(0)
    const height = sheet?.height ?? fallback
    const min = sheet?.min ?? 0
    const max = sheet?.max ?? 0
    const sticky = useAnimatedStyle(() => {
        // The keyboard sits over the system bar, so the rail on top of it (a sheet the keyboard lifts) needs no inset.
        const inset = bottom * (1 - keyboard.progress.get())
        const size = { height: RAIL_HEIGHT + inset, paddingBottom: inset }
        if (max === 0 || (sheet?.closingFrom.get() ?? 0) > 0) return size
        const current = height.get()
        // The content is `max` tall once the sheet leaves its resting height (see KeyboardArea's SheetFrame).
        const content = current > min + 1 ? max : min
        const shown = Math.min(max, Math.max(min, current))
        return { ...size, transform: [{ translateY: shown - content }] }
    })

    const ref = useRef<ComponentRef<typeof ScrollView>>(null)
    const view = useRef({ x: 0, width: 0 })
    useEffect(() => {
        const { x, width } = view.current
        if (width === 0) return
        const start = PADDING + active * ITEM_WIDTH
        const end = start + ITEM_WIDTH
        if (start >= x && end <= x + width) return
        ref.current?.scrollTo({
            x: Math.max(0, start - (width - ITEM_WIDTH) / 2),
            animated: true,
        })
    }, [active])

    return (
        <Animated.View style={[styles.rail, sticky]}>
            <ScrollView
                ref={ref}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                onLayout={event => {
                    view.current.width = event.nativeEvent.layout.width
                }}
                onScroll={event => {
                    view.current.x = event.nativeEvent.contentOffset.x
                }}
                scrollEventThrottle={32}
            >
                {sections.map((section, index) => (
                    <RailItem
                        key={section.key}
                        section={section}
                        index={index}
                        active={index === active}
                        onPress={onPress}
                    />
                ))}
            </ScrollView>
        </Animated.View>
    )
}

/** One category button; only the one that becomes or stops being active is drawn again as the list scrolls. */
const RailItem = memo(function RailItem({
    section,
    index,
    active,
    onPress,
}: {
    section: RailSection
    index: number
    active: boolean
    onPress: (index: number) => void
}) {
    return (
        <RipplePressable
            style={[styles.item, active && styles.active]}
            onPress={() => onPress(index)}
            accessibilityRole="button"
            accessibilityLabel={section.title}
        >
            <RailIcon section={section} />
        </RipplePressable>
    )
})

function RailIcon({ section }: { section: RailSection }) {
    const guild = useSessionStore(guildsStore, state =>
        section.guildId ? state.guilds[section.guildId] : undefined,
    )
    if (guild)
        return (
            <GuildIcon
                guild={{ id: guild.id, name: guild.name, icon: guild.icon }}
                size={24}
                radius={12}
            />
        )
    if (section.railIcon) return <Icon name={section.railIcon} size="sm" />
    const url =
        section.railImage ??
        (section.railEmoji ? twemojiUrl(section.railEmoji) : undefined)
    return <Emoji source={url} style={styles.image} />
}

const styles = StyleSheet.create(theme => ({
    rail: {
        borderTopWidth: 1,
        borderTopColor: theme.colors.BORDER_SUBTLE,
        backgroundColor: theme.colors.MOBILE_KEYBOARD_PANEL_BACKGROUND,
    },
    content: { paddingHorizontal: PADDING, alignItems: 'center' },
    item: {
        width: ITEM_WIDTH,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    active: { backgroundColor: theme.colors.BACKGROUND_MOD_NORMAL },
    image: { width: 22, height: 22 },
}))
