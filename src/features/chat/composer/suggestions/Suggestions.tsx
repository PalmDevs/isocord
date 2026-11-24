import { Image } from 'expo-image'
import { useEffect, useState } from 'react'
import { PixelRatio, ScrollView, View } from 'react-native'
import Animated, {
    FadeIn,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import { StickerFormat } from '../../../../core/discord/expressionTypes'
import { useSession, useSessionStore } from '../../../../core/react'
import { Avatar } from '../../../../design/components/avatars/Avatar'
import { RipplePressable } from '../../../../design/components/buttons/RipplePressable'
import { Emoji } from '../../../../design/components/Emoji'
import { Text } from '../../../../design/components/Text'
import { Icon } from '../../../../design/icons/Icon'
import {
    FADE_TIMING,
    STANDARD_EASING,
    SUGGESTION_ENTRANCE_SPRING,
    TIMING_STANDARD,
} from '../../../../design/tokens/motion'
import { t } from '../../../../i18n'
import { isVoice } from '../../../../stores/channels/channels'
import { settingsStore } from '../../../../stores/settings/settingsStore'
import {
    ensureExpressionData,
    recordEmojiUsage,
    recordStickerUsage,
} from '../../../expressions'
import {
    emojiImageUrl,
    stickerUrl,
} from '../../../expressions/picker/emojiImage'
import { hexColor } from '../../color'
import { useComposer, useComposerState } from '../state/useComposer'
import { toast } from '../toast'
import { useSteadyRows } from './useSteadyRows'
import type { ReactNode } from 'react'
import type { SearchEmoji, Sticker } from '../../../expressions'
import type { Item, Suggestion } from './search'

/** AUTOCOMPLETE_ROW_HEIGHT of the reference. */
const ROW_HEIGHT = 48
const MAX_VISIBLE_ROWS = 5
/** Rows of the `:name` autocomplete's emoji section on screen at once; the rest scroll. */
const MAX_VISIBLE_EMOJI_ROWS = 3
/** Autocomplete's AUTOCOMPLETE_STICKER_NODE_SIZE and _MARGIN, and the sticker drawn in it. */
const STICKER_NODE_SIZE = 56
const STICKER_NODE_MARGIN = 4
const STICKER_SIZE = 40
/** EmojiSuggestionBarSmall's emoji: EmojiPickerListConstants.IMAGE_SIZE. */
const BAR_EMOJI_SIZE = 33

const emojiName = (emoji: SearchEmoji) =>
    emoji.type === 'custom' ? emoji.name : emoji.uniqueName

function EmojiGlyph({ emoji }: { emoji: SearchEmoji }) {
    return emoji.type === 'custom' ? (
        <Emoji emoji={emoji} style={styles.emoji} />
    ) : (
        <Text variant="text-lg/normal">{emoji.surrogates}</Text>
    )
}

function ItemContent({ item }: { item: Item }) {
    switch (item.kind) {
        case 'emoji':
            return (
                <>
                    <EmojiGlyph emoji={item.emoji} />
                    <Text variant="text-md/medium" lineClamp={1}>
                        :{emojiName(item.emoji)}:
                    </Text>
                </>
            )
        case 'user':
            return (
                <>
                    <Avatar user={item.user} size={28} />
                    <Text variant="text-md/medium" lineClamp={1}>
                        {item.name}
                    </Text>
                    <Text
                        variant="text-sm/normal"
                        color="TEXT_MUTED"
                        lineClamp={1}
                    >
                        {item.user.username}
                    </Text>
                </>
            )
        case 'role':
            // Autocomplete's Role: the role's colour, or the label's INTERACTIVE_TEXT_ACTIVE when it has none. A
            // style with an undefined colour would override the Text's own and draw it black.
            return (
                <Text
                    variant="text-md/medium"
                    color="INTERACTIVE_TEXT_ACTIVE"
                    lineClamp={1}
                    style={item.color ? { color: hexColor(item.color) } : null}
                >
                    @{item.name}
                </Text>
            )
        case 'special':
            return (
                <>
                    <Text variant="text-md/medium">@{item.name}</Text>
                    <Text variant="text-sm/normal" color="TEXT_MUTED">
                        {item.name === 'everyone'
                            ? 'Notify everyone in this channel'
                            : 'Notify online members in this channel'}
                    </Text>
                </>
            )
        case 'channel':
            return (
                <>
                    <Text variant="text-md/semibold" color="TEXT_MUTED">
                        {isVoice(item.channel) ? '\u{1F50A}' : '#'}
                    </Text>
                    <Text variant="text-md/medium" lineClamp={1}>
                        {item.channel.name}
                    </Text>
                </>
            )
    }
}

/** AutocompleteWrapper's section title: the message with its `{prefix}` (what was typed) in bold. */
function SectionTitle({
    message,
    prefix,
}: {
    message: string
    prefix: string
}) {
    const [before, after] = message.split('{prefix}')
    return (
        <View style={styles.sectionTitle}>
            <Text variant="text-sm/semibold" lineClamp={1}>
                {before}
                <Text variant="text-sm/bold">{prefix}</Text>
                {after}
            </Text>
        </View>
    )
}

/**
 * Suggested emoji in the bar: EmojiSuggestionBarUtils.EmojiEntranceAnimation, a spring in of scale and opacity,
 * 20 ms after the one before it.
 */
function EmojiEntrance({
    index,
    children,
}: {
    index: number
    children: ReactNode
}) {
    const progress = useSharedValue(0)
    useEffect(() => {
        progress.set(
            withDelay(20 * index, withSpring(1, SUGGESTION_ENTRANCE_SPRING)),
        )
    }, [index, progress])
    const style = useAnimatedStyle(() => ({
        opacity: progress.get(),
        transform: [{ scale: progress.get() }],
    }))
    return <Animated.View style={style}>{children}</Animated.View>
}

/**
 * AutocompleteWrapper's autocompleteContainer: useAutocompleteAnimatedHeightStyles times its height towards
 * `height` (withTiming with timingPresets.timingStandard) whenever that changes, so it rises from the top of the
 * accessories when it opens and grows and shrinks with its results. `height` is worked out from the rows rather than
 * measured, as there: the rows have fixed heights.
 * Unlike the reference, which sinks it back to nothing, it fades out at the height it had when `height` drops to 0,
 * keeping what it last showed without taking touches, and unmounts once it is gone.
 */
function AutocompleteBox({
    height,
    children,
}: {
    height: number
    children: ReactNode
}) {
    const open = height > 0
    const [mounted, setMounted] = useState(open)
    const [shown, setShown] = useState(children)
    if (open && !mounted) setMounted(true)
    if (open && shown !== children) setShown(children)
    const animated = useSharedValue(0)
    const opacity = useSharedValue(1)

    useEffect(() => {
        if (!mounted) {
            // Gone: the next open rises from nothing again.
            animated.set(0)
            opacity.set(1)
            return
        }
        if (open) {
            // A new height takes over from wherever the last one had got to; a fade out under way turns back.
            animated.set(withTiming(height, TIMING_STANDARD))
            opacity.set(withTiming(1, FADE_TIMING))
        } else
            opacity.set(
                withTiming(0, FADE_TIMING, finished => {
                    if (finished) scheduleOnRN(setMounted, false)
                }),
            )
    }, [height, open, mounted, animated, opacity])

    const style = useAnimatedStyle(() => ({
        height: animated.get(),
        opacity: opacity.get(),
    }))
    if (!mounted) return null

    return (
        <Animated.View
            pointerEvents={open ? 'auto' : 'none'}
            style={[styles.list, style]}
        >
            {/* The theme's colours on a plain View: the compiler caches the animated view's style array, which kept
                the theme it first mounted with. */}
            <View style={styles.listFrame}>
                {/* Absolute, so it keeps its own height rather than being squeezed into the room it has so far. */}
                <View style={styles.listContent}>
                    {open ? children : shown}
                </View>
            </View>
        </Animated.View>
    )
}

/**
 * Renders the autocomplete for `:emoji`, `@` mentions and `#` channels, and the emoji bar for the plain word typed.
 * Both float over the chat, down to `listAnchor` and `barAnchor`: the tops of the accessories and of the card.
 * `suggestion` comes from useSuggestion, which the composer also reads to hide typing.
 */
export function Suggestions({
    suggestion,
    listAnchor,
    barAnchor,
}: {
    suggestion: Suggestion | null
    listAnchor: number
    barAnchor: number
}) {
    const session = useSession()
    const composer = useComposer()
    const { theme } = useUnistyles()
    const animate = useSessionStore(
        settingsStore,
        state => state.textAndImages.animateEmoji ?? true,
    )

    useEffect(() => {
        void ensureExpressionData(session)
    }, [session])

    // What was typed for the suggestion, trigger included: the query useSteadyRows holds the rows for.
    const typed = useComposerState(state =>
        suggestion ? state.text.slice(suggestion.start, suggestion.end) : null,
    )

    const range = suggestion && {
        location: suggestion.start,
        length: suggestion.end - suggestion.start,
    }

    const pickSticker = (sticker: Sticker) => {
        if (!range) return
        composer.replaceRange(range, '')
        void composer.sendSticker(sticker.id).then(ok => {
            if (ok) recordStickerUsage(session, sticker)
            else toast('Could not send the sticker')
        })
    }

    const pick = (item: Item) => {
        if (!range) return
        switch (item.kind) {
            case 'emoji':
                recordEmojiUsage(session, item.emoji)
                // Custom emojis stay `:name:` until sent (resolveEmoji); unicode ones are the character.
                composer.replaceRange(
                    range,
                    `${item.emoji.type === 'custom' ? `:${item.emoji.name}:` : item.emoji.surrogates} `,
                )
                return
            case 'user':
                composer.replaceRange(range, `@${item.name} `)
                return
            case 'role':
                composer.replaceRange(range, `@${item.name} `)
                return
            case 'special':
                composer.replaceRange(range, `@${item.name} `)
                return
            case 'channel': {
                const name = item.channel.name ?? ''
                composer.replaceRange(
                    range,
                    /^[^\s#@<>"]+$/.test(name)
                        ? `#${name} `
                        : `#"${name.replace(/(["\\])/g, '\\$1')}" `,
                )
            }
        }
    }

    const bar = suggestion?.bar ? suggestion.items : null
    const query = suggestion?.query
    const visibleRows =
        query === undefined ? MAX_VISIBLE_ROWS : MAX_VISIBLE_EMOJI_ROWS
    const list = useSteadyRows(
        suggestion && !suggestion.bar ? suggestion.items : null,
        typed,
        visibleRows,
    )
    const stickers = suggestion?.stickers ?? []
    const rows = (items: Item[]) =>
        items.map(item => (
            <RipplePressable
                key={item.key}
                onPress={() => pick(item)}
                style={styles.row}
            >
                <ItemContent item={item} />
            </RipplePressable>
        ))
    // AutocompleteWrapper's container height: the rows on screen, and for EMOJIS_AND_STICKERS each section's title
    // (a scaled line of text and 24 of margin), the stickers' row with its 12 below, and the divider between them.
    const mobile = theme.modules.mobile
    const titleHeight =
        theme.text['text-sm/semibold'].lineHeight * PixelRatio.getFontScale() +
        24
    let listHeight = 0
    if (list && query === undefined)
        listHeight = Math.min(list.length, MAX_VISIBLE_ROWS) * ROW_HEIGHT
    else if (list) {
        if (stickers.length > 0)
            listHeight += titleHeight + STICKER_NODE_SIZE + 12
        if (stickers.length > 0 && list.length > 0) listHeight += 1
        if (list.length > 0)
            listHeight +=
                titleHeight +
                Math.min(list.length, MAX_VISIBLE_EMOJI_ROWS) * ROW_HEIGHT
    }
    if (listHeight > 0)
        listHeight +=
            mobile.CHAT_INPUT_FLOATING_ACCESSORY_TOP_BORDER_WIDTH +
            mobile.CHAT_INPUT_FLOATING_ACCESSORY_BORDER_WIDTH
    // getEmojiEntranceKey: a new set of emojis springs in again.
    const barKey = bar?.map(item => item.key).join(',')

    return (
        <>
            <View
                pointerEvents="box-none"
                style={[styles.layer, { height: listAnchor }]}
            >
                <AutocompleteBox height={listHeight}>
                    {list && query === undefined && (
                        <ScrollView
                            keyboardShouldPersistTaps="always"
                            style={{
                                maxHeight: ROW_HEIGHT * MAX_VISIBLE_ROWS,
                            }}
                        >
                            {rows(list)}
                        </ScrollView>
                    )}
                    {/* AutocompleteWrapper's EMOJIS_AND_STICKERS sections: stickers in a row, then the emojis. */}
                    {list && query !== undefined && (
                        <>
                            {stickers.length > 0 && (
                                <>
                                    <SectionTitle
                                        message={t(
                                            'composer.autocomplete.stickers',
                                        )}
                                        prefix={query}
                                    />
                                    <ScrollView
                                        horizontal
                                        keyboardShouldPersistTaps="always"
                                        showsHorizontalScrollIndicator={false}
                                        style={styles.stickers}
                                        contentContainerStyle={
                                            styles.stickersContent
                                        }
                                    >
                                        {stickers.map(sticker => (
                                            <RipplePressable
                                                key={sticker.id}
                                                accessibilityRole="button"
                                                accessibilityLabel={
                                                    sticker.name
                                                }
                                                onPress={() =>
                                                    pickSticker(sticker)
                                                }
                                                style={styles.sticker}
                                            >
                                                {sticker.format_type ===
                                                StickerFormat.LOTTIE ? (
                                                    <Icon
                                                        name="StickerIcon"
                                                        size="md"
                                                        color="TEXT_MUTED"
                                                    />
                                                ) : (
                                                    <Image
                                                        source={stickerUrl(
                                                            sticker,
                                                            96,
                                                        )}
                                                        contentFit="contain"
                                                        autoplay={false}
                                                        style={
                                                            styles.stickerImage
                                                        }
                                                    />
                                                )}
                                            </RipplePressable>
                                        ))}
                                    </ScrollView>
                                </>
                            )}
                            {stickers.length > 0 && list.length > 0 && (
                                <View style={styles.divider} />
                            )}
                            {list.length > 0 && (
                                <>
                                    <SectionTitle
                                        message={t(
                                            'composer.autocomplete.emoji',
                                        )}
                                        prefix={`:${query}`}
                                    />
                                    <ScrollView
                                        keyboardShouldPersistTaps="always"
                                        nestedScrollEnabled
                                        style={{
                                            maxHeight:
                                                ROW_HEIGHT *
                                                MAX_VISIBLE_EMOJI_ROWS,
                                        }}
                                    >
                                        {rows(list)}
                                    </ScrollView>
                                </>
                            )}
                        </>
                    )}
                </AutocompleteBox>
            </View>
            <View
                pointerEvents="box-none"
                style={[styles.layer, { height: barAnchor }]}
            >
                {/* EmojiSuggestionBarSmallAnimated: its opacity follows the room it takes (useSuggestionBarHeight,
                    SUGGESTION_BAR_HEIGHT_TIMING: 250 ms with the standard easing), so it fades in and out over it. */}
                {bar && (
                    <Animated.View
                        entering={FadeIn.duration(FADE_TIMING.duration).easing(
                            STANDARD_EASING,
                        )}
                        exiting={FadeOut.duration(FADE_TIMING.duration).easing(
                            STANDARD_EASING,
                        )}
                        style={styles.bar}
                    >
                        {bar.map((item, index) =>
                            item.kind === 'emoji' ? (
                                <EmojiEntrance
                                    key={`${barKey}:${item.key}`}
                                    index={index}
                                >
                                    <RipplePressable
                                        borderless
                                        accessibilityLabel={`:${emojiName(item.emoji)}:`}
                                        onPress={() => pick(item)}
                                    >
                                        <Emoji
                                            source={emojiImageUrl(
                                                item.emoji,
                                                animate,
                                            )}
                                            style={styles.barEmoji}
                                        />
                                    </RipplePressable>
                                </EmojiEntrance>
                            ) : null,
                        )}
                    </Animated.View>
                )}
            </View>
        </>
    )
}

const styles = StyleSheet.create(theme => {
    const mobile = theme.modules.mobile
    return {
        // Fills the wrapper from the top of the window down to the anchor; what it holds sits at its bottom.
        layer: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            justifyContent: 'flex-end',
        },
        // AutocompleteWrapper's autocompleteWrapper and autocompleteContainer, floating variant. Its height is
        // animated; what it holds is pinned to its bottom, so the rows stay put while it grows and shrinks.
        // listFrame fills it with the border and background.
        list: {
            marginHorizontal:
                mobile.CHAT_INPUT_FLOATING_ACCESSORY_MARGIN_HORIZONTAL,
            marginBottom: mobile.CHAT_INPUT_FLOATING_ACCESSORY_MARGIN_BOTTOM,
            overflow: 'hidden',
            borderRadius: mobile.CHAT_INPUT_FLOATING_BORDER_RADIUS,
        },
        listFrame: {
            flex: 1,
            overflow: 'hidden',
            borderRadius: mobile.CHAT_INPUT_FLOATING_BORDER_RADIUS,
            borderWidth: mobile.CHAT_INPUT_FLOATING_ACCESSORY_BORDER_WIDTH,
            borderTopWidth:
                mobile.CHAT_INPUT_FLOATING_ACCESSORY_TOP_BORDER_WIDTH,
            borderColor: theme.colors.MOBILE_FLOATING_ACCESSORY_BORDER,
            backgroundColor: theme.colors.MOBILE_FLOATING_ACCESSORY_BACKGROUND,
        },
        listContent: { position: 'absolute', bottom: 0, left: 0, right: 0 },
        row: {
            height: ROW_HEIGHT,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.PX_10,
            paddingHorizontal: theme.space.PX_16,
        },
        // EmojiSuggestionBarSmall's containerSmall: on the right, PX_8 above the card.
        bar: {
            alignSelf: 'flex-end',
            marginRight: mobile.CHAT_INPUT_CONTAINER_HORIZONTAL_PADDING,
            marginBottom: theme.space.PX_8,
            height: BAR_EMOJI_SIZE + 2 * theme.space.PX_8 + 2,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.PX_8,
            paddingHorizontal: theme.space.PX_8,
            borderWidth: 1,
            borderColor: theme.colors.MOBILE_FLOATING_ACCESSORY_BORDER,
            borderRadius: theme.radii.lg,
            backgroundColor: theme.colors.MOBILE_FLOATING_ACCESSORY_BACKGROUND,
            boxShadow: theme.shadows.SHADOW_HIGH,
        },
        barEmoji: { width: BAR_EMOJI_SIZE, height: BAR_EMOJI_SIZE },
        sectionTitle: {
            paddingLeft: theme.space.PX_12,
            marginVertical: theme.space.PX_12,
        },
        divider: {
            height: 1,
            backgroundColor: theme.colors.MOBILE_FLOATING_ACCESSORY_BORDER,
        },
        stickers: {
            flexGrow: 0,
            height: STICKER_NODE_SIZE,
            marginBottom: theme.space.PX_12,
        },
        stickersContent: {
            paddingHorizontal: theme.space.PX_12 - STICKER_NODE_MARGIN,
        },
        sticker: {
            width: STICKER_NODE_SIZE,
            height: STICKER_NODE_SIZE,
            marginHorizontal: STICKER_NODE_MARGIN,
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            borderRadius: theme.radii.sm,
            backgroundColor: theme.colors.BACKGROUND_MOD_NORMAL,
        },
        stickerImage: { width: STICKER_SIZE, height: STICKER_SIZE },
        emoji: { width: 28, height: 28 },
    }
})
