import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import { useSession, useSessionStore } from '../../../core/react'
import { Text } from '../../../design/components/Text'
import { Icon } from '../../../design/icons/Icon'
import { CONTEXT_BAR_HEIGHT_TIMING } from '../../../design/tokens/motion'
import { t } from '../../../i18n'
import { channelsStore } from '../../../stores/channels/channels'
import { guildsStore } from '../../../stores/guilds'
import { membersStore } from '../../../stores/members'
import { displayName, usersStore } from '../../../stores/users'
import { authorStyle } from '../author'
import { hexColor } from '../color'
import { openUserProfile } from '../headerActions'
import { PressableOpacity } from './floating'
import { composerStore } from './state/composerStore'
import { useComposer, useComposerState } from './state/useComposer'

/** The cap the reference animates the bar's maxHeight to: more than the bar needs, so no measuring. */
const MAX_HEIGHT = 60

/**
 * ChatInputContextBar (floating variant): the top of the input card. Who is being replied to, with the ping
 * toggle, a divider and the close button on the right, or that a message is being edited.
 */
export function ContextBar() {
    const composer = useComposer()
    const session = useSession()
    const { channelId } = composer
    const reply = useSessionStore(
        composerStore,
        state => state.replies[channelId],
    )
    const editing = useSessionStore(
        composerStore,
        state => state.editing[channelId],
    )
    const guildId = useSessionStore(
        channelsStore,
        state => state.channels[channelId]?.guild_id,
    )
    const author = useSessionStore(usersStore, state =>
        reply ? state.users[reply.authorId] : undefined,
    )
    const member = useSessionStore(membersStore, state =>
        reply && guildId ? state.members[guildId]?.[reply.authorId] : undefined,
    )
    const guild = useSessionStore(guildsStore, state =>
        guildId ? state.guilds[guildId] : undefined,
    )
    // A thread's first message, a forward's or a share's text replies to nothing. The reply and edit are the chat's.
    const apart = useComposerState(
        state => state.creatingThread || state.attached,
    )
    const visible = !apart && Boolean(reply || editing)
    const reducedMotion = useReducedMotion()
    // Its maxHeight grows and shrinks (never on the first mount); the content stays through the exit.
    const progress = useSharedValue(visible ? 1 : 0)
    const [mounted, setMounted] = useState(visible)
    const name = member?.nick ?? displayName(author)
    const color = authorStyle(guild, member).color
    const last = useRef({ reply, editing, name, color })
    if (visible) last.current = { reply, editing, name, color }
    const shown = last.current
    const shownReply = shown.reply
    if (visible && !mounted) setMounted(true)
    const first = useRef(true)
    useEffect(() => {
        if (first.current) {
            first.current = false
            return
        }
        const target = visible ? 1 : 0
        if (reducedMotion) {
            progress.set(target)
            if (!visible) setMounted(false)
            return
        }
        progress.set(
            withTiming(target, CONTEXT_BAR_HEIGHT_TIMING, finished => {
                if (finished && target === 0) scheduleOnRN(setMounted, false)
            }),
        )
    }, [visible, reducedMotion, progress])
    const wrap = useAnimatedStyle(() => ({
        maxHeight: MAX_HEIGHT * progress.get(),
    }))
    if (!mounted) return null

    return (
        <Animated.View style={[styles.wrap, wrap]}>
            <View style={styles.bar}>
                {shown.editing ? (
                    <Text
                        variant="text-sm/medium"
                        color="TEXT_MUTED"
                        lineClamp={1}
                        style={styles.label}
                    >
                        {t('composer.editing')}
                    </Text>
                ) : (
                    <ReplyLabel
                        name={shown.name}
                        color={shown.color}
                        onPressName={() =>
                            shownReply &&
                            openUserProfile(
                                session,
                                shownReply.authorId,
                                guildId,
                            )
                        }
                    />
                )}
                <View style={styles.actions}>
                    {shown.reply && (
                        <>
                            <PressableOpacity
                                accessibilityRole="switch"
                                accessibilityState={{
                                    checked: shown.reply.shouldMention,
                                }}
                                accessibilityLabel={t(
                                    shown.reply.shouldMention
                                        ? 'composer.mentionOn'
                                        : 'composer.mentionOff',
                                )}
                                hitSlop={8}
                                onPress={() =>
                                    composer.setReplyMention(
                                        !shownReply?.shouldMention,
                                    )
                                }
                                style={styles.mention}
                            >
                                <Icon
                                    name="AtIcon"
                                    size="xs"
                                    color={
                                        shown.reply.shouldMention
                                            ? 'CONTROL_BRAND_FOREGROUND'
                                            : 'TEXT_MUTED'
                                    }
                                />
                                <Text
                                    variant="text-sm/semibold"
                                    color={
                                        shown.reply.shouldMention
                                            ? 'CONTROL_BRAND_FOREGROUND'
                                            : 'TEXT_MUTED'
                                    }
                                >
                                    {t(
                                        shown.reply.shouldMention
                                            ? 'composer.on'
                                            : 'composer.off',
                                    )}
                                </Text>
                            </PressableOpacity>
                            <View style={styles.divider} />
                        </>
                    )}
                    <PressableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={t('composer.cancel')}
                        hitSlop={14}
                        onPress={() =>
                            shown.editing
                                ? composer.setEditing(null)
                                : composer.setReplyTo(null)
                        }
                    >
                        <Icon
                            name="XSmallIcon"
                            size="xs"
                            color="INTERACTIVE_ICON_DEFAULT"
                        />
                    </PressableOpacity>
                </View>
            </View>
        </Animated.View>
    )
}

// ChatInputReplyBar: inline semibold name in the author's role colour.
function ReplyLabel({
    name,
    color,
    onPressName,
}: {
    name: string
    color?: number
    onPressName: () => void
}) {
    const [before, after] = t('composer.replyingTo').split('{name}')
    return (
        <Text
            variant="text-sm/medium"
            color="TEXT_MUTED"
            lineClamp={1}
            style={styles.label}
        >
            {before}
            <Text
                variant="text-sm/semibold"
                color="TEXT_STRONG"
                onPress={onPressName}
                style={
                    color !== undefined ? { color: hexColor(color) } : undefined
                }
            >
                {name}
            </Text>
            {after}
        </Text>
    )
}

const styles = StyleSheet.create(theme => ({
    wrap: { overflow: 'hidden' },
    bar: {
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.modules.mobile.CHAT_INPUT_CONTEXT_BAR_GAP,
        paddingHorizontal:
            theme.modules.mobile.CHAT_INPUT_CONTEXT_BAR_PADDING_HORIZONTAL,
        paddingVertical:
            theme.modules.mobile.CHAT_INPUT_CONTEXT_BAR_PADDING_VERTICAL,
        backgroundColor: theme.colors.MOBILE_FLOATING_ACCESSORY_BACKGROUND,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.BORDER_MUTED,
    },
    label: { flexShrink: 1, minWidth: 0 },
    actions: {
        flexGrow: 1,
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: theme.space.PX_8,
    },
    mention: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    divider: {
        width: 1,
        alignSelf: 'stretch',
        backgroundColor: theme.colors.BORDER_SUBTLE,
    },
}))
