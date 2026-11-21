import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSessionStore } from '../../../core/react'
import { GuildIcon } from '../../../design/components/avatars/GuildIcon'
import { Emoji } from '../../../design/components/Emoji'
import { ActionSheet } from '../../../design/components/sheets/Sheet'
import { openActionSheet } from '../../../design/components/sheets/sheetStore'
import { Text } from '../../../design/components/Text'
import { t } from '../../../i18n'
import { expressionsStore } from '../../../stores/expressions'
import { guildsStore } from '../../../stores/guilds'
import { loadUnicodeEmojis, surrogatesToShortcode } from '../../expressions'

/** A tapped emoji, decoded from its `emoji` link (chatLink.ts). */
export type EmojiInfo =
    | { kind: 'custom'; id: string; name: string; animated: boolean }
    | { kind: 'unicode'; text: string }

/**
 * A tapped emoji in a message (MessageEmojiActionSheet). Temporary: the emoji, its `:name:` and where it is from,
 * without the favorite, join server and Nitro actions of StandardEmojiContent / CustomEmojiContent.
 */
export async function openEmojiInfo(emoji: EmojiInfo): Promise<void> {
    // The shortcode comes from the unicode dataset.
    if (emoji.kind === 'unicode')
        await loadUnicodeEmojis().catch(() => undefined)
    openActionSheet('emoji-info', <EmojiInfoSheet emoji={emoji} />)
}

function EmojiInfoSheet({ emoji }: { emoji: EmojiInfo }) {
    const custom = emoji.kind === 'custom'
    const emojiData = custom
        ? { id: emoji.id, animated: emoji.animated }
        : emoji.text
    const title = custom ? `:${emoji.name}:` : surrogatesToShortcode(emoji.text)
    return (
        <ActionSheet>
            {/* useSharedMessageEmojiStyles: a 40px emoji, 12 before the name and description. */}
            <View style={styles.row}>
                {emojiData ? (
                    <Emoji
                        emoji={emojiData}
                        cdnSize={96}
                        style={styles.emoji}
                    />
                ) : (
                    <Text variant="text-md/medium" style={styles.surrogate}>
                        {custom ? '' : emoji.text}
                    </Text>
                )}
                <View style={styles.description}>
                    <Text
                        variant="text-md/bold"
                        color="MOBILE_TEXT_HEADING_PRIMARY"
                    >
                        {title}
                    </Text>
                    {custom ? null : (
                        <Text variant="text-sm/medium">
                            {t('chat.emojiInfo.standard')}
                        </Text>
                    )}
                </View>
            </View>
            {custom ? <EmojiSource emojiId={emoji.id} /> : null}
        </ActionSheet>
    )
}

/** CustomEmojiContent's "This emoji is from" and the server, when it is one the user is in. */
function EmojiSource({ emojiId }: { emojiId: string }) {
    const guildId = useSessionStore(expressionsStore, state => {
        for (const [id, guild] of Object.entries(state.guilds))
            if (guild.emojis.some(emoji => emoji.id === emojiId)) return id
        return undefined
    })
    const guild = useSessionStore(guildsStore, state =>
        guildId ? state.guilds[guildId] : undefined,
    )
    if (!guild) return null
    return (
        <View>
            <View style={styles.divider} />
            <Text variant="text-sm/medium" color="TEXT_MUTED">
                {t('chat.emojiInfo.from')}
            </Text>
            <View style={styles.guild}>
                <GuildIcon guild={guild} size={40} />
                <Text
                    variant="text-md/semibold"
                    color="MOBILE_TEXT_HEADING_PRIMARY"
                    lineClamp={1}
                    style={styles.description}
                >
                    {guild.name}
                </Text>
            </View>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    row: { flexDirection: 'row', alignItems: 'center' },
    emoji: {
        width: 40,
        height: 40,
        marginRight: theme.space.PX_12,
        borderRadius: theme.radii.sm,
    },
    // StandardEmojiContent's emojiSurrogate, for an emoji without art.
    surrogate: { fontSize: 40, lineHeight: 48, margin: theme.space.PX_8 },
    description: { flex: 1 },
    divider: {
        marginVertical: theme.space.PX_16,
        height: 1,
        backgroundColor: theme.colors.BORDER_SUBTLE,
    },
    guild: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_12,
        marginTop: theme.space.PX_8,
    },
}))
