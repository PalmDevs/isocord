import { useEffect, useMemo, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../../core/react'
import { Emoji } from '../../../design/components/Emoji'
import { Icon } from '../../../design/icons/Icon'
import { t } from '../../../i18n'
import { frecencyStore, loadFrecency } from '../../../stores/frecency'
import {
    EmojiIntention,
    getExpressionContext,
    getFrequentReactionEmojis,
    getUnicodeEmojis,
    loadUnicodeEmojis,
} from '../../expressions'
import { emojiImageUrl } from '../../expressions/picker/emojiImage'
import { PressableOpacity } from '../composer/floating'
import type { SearchEmoji } from '../../expressions'

/** ACTION_SHEET_MAX_WIDTH: the row never counts more width than the sheet has. */
const SHEET_MAX_WIDTH = 500

interface Props {
    channelId: string
    /** Called with the tapped emoji; the sheet has closed by then. */
    onPressEmoji: (emoji: SearchEmoji) => void
    /** Called by the last button, which opens the full emoji picker. */
    onPressPicker: () => void
}

/**
 * EmojiRow (action_sheet/native/components/EmojiRow): the user's most used reaction emojis in round buttons, as
 * many as fit the screen minus one, then the add reaction button. Slots without an emoji stay empty.
 */
export function EmojiRow({ channelId, onPressEmoji, onPressPicker }: Props) {
    const session = useSession()
    const { theme } = useUnistyles()
    const { width } = useWindowDimensions()
    const mobile = theme.modules.mobile
    const container = mobile.EMOJI_ROW_EMOJI_CONTAINER_SIZE
    // The reference counts from the window's width, not the sheet's.
    const count = Math.floor(
        Math.min(width, SHEET_MAX_WIDTH) /
            (container + mobile.EMOJI_ROW_EMOJI_MIN_SPACING),
    )

    // The history and the Unicode data load lazily; the row fills in when they arrive.
    const history = useSessionStore(
        frecencyStore,
        state => state.emojiReactions,
    )
    const [unicodeReady, setUnicodeReady] = useState(
        getUnicodeEmojis() !== undefined,
    )
    useEffect(() => {
        loadFrecency(session).catch(() => {})
        if (!unicodeReady) loadUnicodeEmojis().then(() => setUnicodeReady(true))
    }, [session, unicodeReady])

    // Memoised: ranks the whole frecency history.
    // biome-ignore lint/correctness/useExhaustiveDependencies: the session's stores are read inside
    const emojis = useMemo(() => {
        const context = getExpressionContext(session, channelId)
        return getFrequentReactionEmojis(
            session,
            { ...context, intention: EmojiIntention.REACTION },
            Math.max(count - 1, 0),
        )
    }, [session, channelId, count, history, unicodeReady])

    const slots = Array.from(
        { length: Math.max(count - 1, 0) },
        (_, index) => emojis[index],
    )
    return (
        <View style={styles.row}>
            {slots.map((emoji, index) => (
                <PressableOpacity
                    key={
                        emoji
                            ? emoji.type === 'custom'
                                ? emoji.id
                                : emoji.uniqueName
                            : index
                    }
                    accessibilityRole="button"
                    accessibilityLabel={
                        emoji
                            ? t('chat.actions.reaction', {
                                  name:
                                      emoji.type === 'custom'
                                          ? emoji.name
                                          : emoji.uniqueName,
                              })
                            : undefined
                    }
                    disabled={!emoji}
                    hitSlop={4}
                    onPress={() => emoji && onPressEmoji(emoji)}
                    style={styles.button(container)}
                >
                    {emoji && (
                        <Emoji
                            source={emojiImageUrl(emoji, false)}
                            size={mobile.EMOJI_ROW_EMOJI_SIZE}
                        />
                    )}
                </PressableOpacity>
            ))}
            <PressableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('chat.actions.addReaction')}
                hitSlop={4}
                onPress={onPressPicker}
                style={styles.button(container)}
            >
                <Icon name="ReactionIcon" color="INTERACTIVE_TEXT_DEFAULT" />
            </PressableOpacity>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    // In line with the row groups under it: the sheet's header slot has no side padding of its own.
    row: {
        height: 52,
        paddingHorizontal: theme.space.PX_16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    button: (size: number) => ({
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.MOBILE_EMOJI_BUTTON_BACKGROUND,
        borderRadius: theme.modules.button.BORDER_RADIUS,
        overflow: 'hidden',
    }),
    emoji: (size: number) => ({ width: size, height: size }),
}))
