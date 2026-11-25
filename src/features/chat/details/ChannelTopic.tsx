import { useEffect, useState } from 'react'
import { View } from 'react-native'
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import { useSession, useSessionStore } from '../../../core/react'
import { RipplePressable } from '../../../design/components/buttons/RipplePressable'
import { SPRING_CHANNEL_DETAILS } from '../../../design/tokens/motion'
import SpanTextView from '../../../native/SpanTextViewNativeComponent'
import { channelsStore } from '../../../stores/channels/channels'
import { guildsStore } from '../../../stores/guilds'
import { membersStore } from '../../../stores/members'
import { usersStore } from '../../../stores/users'
import { handleChatLink } from '../links/links'
import { jumpFromDetails } from '../links/openChannel'
import { mentionResolver } from '../rows/buildRows'
import { parseMarkdown, toSpans } from '../rows/markdown'
import { useChatTheme } from '../rows/rowEncoder'
import { CHANNEL_TOPIC_LINE_CLAMP } from './constants'
import type { SharedValue } from 'react-native-reanimated'
import type { User } from '../../../stores/users'
import type { MarkdownNode } from '../rows/markdown'

/** Line breaks of a topic, which the folded topic reads as spaces (ChannelDetailsTopic). */
const LINE_BREAKS = /\r\n|\n|\r/g

/**
 * Returns the topic's markup as span JSON, with mentions resolved in the channel's guild: whole, and folded onto
 * running lines for the cut preview. The markdown is parsed once per topic. Mentions resolve in a users selector
 * that returns strings, so other users changing does not re-render the topic.
 */
function useTopicSpans(
    channelId: string,
    topic: string,
): { full: string; folded: string } {
    const session = useSession()
    const fullNodes = parseMarkdown(topic)
    const foldedNodes = parseMarkdown(topic.replace(LINE_BREAKS, ' '))
    const resolve = (nodes: MarkdownNode[], users: Record<string, User>) => {
        const { channels } = session.get(channelsStore).getState()
        const guildId = channels[channelId]?.guild_id
        const guild = guildId
            ? session.get(guildsStore).getState().guilds[guildId]
            : undefined
        const members = guildId
            ? session.get(membersStore).getState().members[guildId]
            : undefined
        return JSON.stringify(
            toSpans(
                nodes,
                mentionResolver({ guild, members, users, channels }),
            ),
        )
    }
    return {
        full: useSessionStore(usersStore, ({ users }) =>
            resolve(fullNodes, users),
        ),
        folded: useSessionStore(usersStore, ({ users }) =>
            resolve(foldedNodes, users),
        ),
    }
}

/**
 * ChannelDetailsTopic: the topic's markdown in heading-sm/normal, three lines of it until tapped, then springing open
 * to its full height. Like the reference, a hidden unclamped copy measures that height. The native text has no
 * height until it reports one: `onReady` fires once both are known.
 */
export function ChannelTopic({
    channelId,
    topic,
    onReady,
    onBack,
    height,
}: {
    channelId: string
    topic: string
    /** The topic's shown height, springing; the details size their header by it. */
    height: SharedValue<number | undefined>
    /** The topic's height is known. */
    onReady: () => void
    /** Closes the details, for a link that leaves them. */
    onBack: () => void
}) {
    const session = useSession()
    const { theme } = useUnistyles()
    const chatTheme = useChatTheme('transparent')
    const spans = useTopicSpans(channelId, topic)
    const [expanded, setExpanded] = useState(false)
    // The cut, folded text. Folding back waits for the spring to close, so the full text never leaves a gap.
    const [folded, setFolded] = useState(true)
    const [clampedHeight, setClampedHeight] = useState<number>()
    const [fullHeight, setFullHeight] = useState<number>()
    const variant = theme.text['heading-sm/normal']
    const truncated =
        clampedHeight !== undefined &&
        fullHeight !== undefined &&
        fullHeight > clampedHeight
    const target = expanded ? fullHeight : clampedHeight
    const toggle = () => {
        if (!expanded) setFolded(false)
        setExpanded(!expanded)
    }

    // The first height is set at once; later ones spring there.
    useEffect(() => {
        if (target === undefined) return
        const fold = !expanded
        height.set(
            height.get() === undefined
                ? target
                : withSpring(target, SPRING_CHANNEL_DETAILS, finished => {
                      if (finished && fold) scheduleOnRN(setFolded, true)
                  }),
        )
    }, [target, expanded, height])
    const animatedStyle = useAnimatedStyle(() => ({
        height: height.get() ?? 0,
    }))

    const ready = clampedHeight !== undefined && fullHeight !== undefined
    useEffect(() => {
        if (ready) onReady()
    }, [ready, onReady])

    const text = {
        markdown: true,
        theme: chatTheme,
        color: theme.colors.INTERACTIVE_TEXT_DEFAULT,
        fontSize: variant.fontSize,
        lineHeight: variant.lineHeight,
    }
    return (
        <View>
            <SpanTextView
                {...text}
                spans={spans.full}
                lineClamp={0}
                onContentHeight={event => {
                    setFullHeight(event.nativeEvent.height)
                }}
                pointerEvents="none"
                importantForAccessibility="no-hide-descendants"
                style={styles.hidden}
            />
            <Animated.View style={[styles.clip, animatedStyle]}>
                <RipplePressable
                    accessibilityRole="button"
                    disabled={!truncated}
                    onPress={toggle}
                >
                    <SpanTextView
                        {...text}
                        spans={folded ? spans.folded : spans.full}
                        lineClamp={folded ? CHANNEL_TOPIC_LINE_CLAMP : 0}
                        onContentHeight={event => {
                            // Unfolded, it reports the full height, which the hidden copy already has.
                            if (folded)
                                setClampedHeight(event.nativeEvent.height)
                        }}
                        onLinkPress={event =>
                            handleChatLink(event.nativeEvent.url, {
                                session,
                                channelId,
                                openChannel: (id, messageId) =>
                                    jumpFromDetails(id, messageId, onBack),
                            })
                        }
                        style={{
                            height: (folded ? clampedHeight : fullHeight) ?? 0,
                        }}
                    />
                </RipplePressable>
            </Animated.View>
        </View>
    )
}

const styles = StyleSheet.create({
    hidden: { position: 'absolute', left: 0, right: 0, opacity: 0 },
    clip: { overflow: 'hidden' },
})
