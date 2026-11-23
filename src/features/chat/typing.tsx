import { StyleSheet } from 'react-native-unistyles'
import { useShallow } from 'zustand/react/shallow'
import { useSessionStore } from '../../core/react'
import { Text } from '../../design/components/Text'
import { t } from '../../i18n'
import { channelsStore } from '../../stores/channels/channels'
import { membersStore } from '../../stores/members'
import { displayName, usersStore } from '../../stores/users'
import type { SemanticColor, TextVariant } from '../../design/tokens'

/**
 * useTypingText: "<a> is typing...", up to three names, then "Several people are typing...". Names are the
 * server nickname or the display name, in bold like the reference's `$b`. Users the client doesn't know are left
 * out, as useTypingUserIds does.
 */
export function TypingText({
    channelId,
    userIds,
    variant,
    boldVariant,
    color,
}: {
    channelId: string
    userIds: readonly string[]
    variant: TextVariant
    boldVariant: TextVariant
    color: SemanticColor
}) {
    const guildId = useSessionStore(
        channelsStore,
        state => state.channels[channelId]?.guild_id,
    )
    // Arrays of strings, per typer: a user or member elsewhere changing re-renders nothing.
    const displayNames = useSessionStore(
        usersStore,
        useShallow(state =>
            userIds.map(id => {
                const user = state.users[id]
                return user ? displayName(user) : undefined
            }),
        ),
    )
    const nicks = useSessionStore(
        membersStore,
        useShallow(state =>
            userIds.map(id =>
                guildId ? state.members[guildId]?.[id]?.nick : undefined,
            ),
        ),
    )
    const names = displayNames.flatMap((name, index) =>
        name === undefined ? [] : [nicks[index] ?? name],
    )
    const [a, b, c, d] = names
    if (a === undefined) return null
    const key =
        b === undefined
            ? 'typing.one'
            : c === undefined
              ? 'typing.two'
              : d === undefined
                ? 'typing.three'
                : 'typing.several'
    const values: Record<string, string | undefined> = { a, b, c }

    return (
        <Text variant={variant} color={color} lineClamp={1} style={styles.text}>
            {t(key)
                .split(/\{(\w+)\}/)
                .map((part, index) =>
                    // Odd parts are the placeholders the split captured.
                    index % 2 === 1 ? (
                        // biome-ignore lint/suspicious/noArrayIndexKey: the parts of a fixed message
                        <Text key={index} variant={boldVariant} color={color}>
                            {values[part]}
                        </Text>
                    ) : (
                        part
                    ),
                )}
        </Text>
    )
}

const styles = StyleSheet.create({ text: { flexShrink: 1 } })
