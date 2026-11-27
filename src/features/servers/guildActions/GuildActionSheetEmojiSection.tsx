import { useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { emojiUrl } from '../../../core/discord/cdn'
import { useSessionStore } from '../../../core/react'
import { RipplePressable } from '../../../design/components/buttons/RipplePressable'
import { Emoji } from '../../../design/components/Emoji'
import { ActionSheetRowGroup } from '../../../design/components/sheets/Sheet'
import { Text } from '../../../design/components/Text'
import { Icon } from '../../../design/icons/Icon'
import { t } from '../../../i18n'
import { expressionsStore } from '../../../stores/expressions'
import { showToast } from '../../toasts'
import type { GuildEmoji } from '../../../core/discord/expressionTypes'

const EMOJI_SIZE = 24
const EMOJI_CELL_SIZE = 32
const EMOJI_GAP = 8
const COLLAPSED_ROWS = 2
const MAX_OVERFLOW_LABEL = 99
const EMPTY_EMOJIS: GuildEmoji[] = []

/**
 * GuildActionSheetEmojiSection: wrapping grid of the server's custom emojis. Tapping an emoji
 * toasts its name and image; "+N" expands the full list.
 */
export function GuildActionSheetEmojiSection({ guildId }: { guildId: string }) {
    const emojis = useSessionStore(
        expressionsStore,
        state => state.guilds[guildId]?.emojis ?? EMPTY_EMOJIS,
    )
    const hasNitro = useSessionStore(
        expressionsStore,
        state => state.premiumType > 0,
    )
    const [expanded, setExpanded] = useState(false)
    const [width, setWidth] = useState(0)

    if (emojis.length === 0) return null

    const columns = Math.max(
        1,
        Math.floor((width + EMOJI_GAP) / (EMOJI_CELL_SIZE + EMOJI_GAP)),
    )
    const collapsedLimit = columns * COLLAPSED_ROWS
    const overflow = expanded ? 0 : emojis.length - collapsedLimit
    const shownCount =
        overflow > 0 ? Math.max(0, collapsedLimit - 1) : emojis.length
    const shown = emojis.slice(0, shownCount)

    return (
        <ActionSheetRowGroup
            title={
                <View style={styles.header}>
                    <Text
                        accessibilityRole="header"
                        variant="text-md/medium"
                        color="TEXT_SUBTLE"
                    >
                        {t('guildActions.serverEmoji')}
                    </Text>
                    {!hasNitro && (
                        <View style={styles.nitroBadge}>
                            <View style={styles.dot} />
                            <Icon
                                name="NitroWheelIcon"
                                size="xxs"
                                color="PREMIUM_NITRO_PINK_TEXT"
                            />
                            <Text
                                variant="text-xs/semibold"
                                color="PREMIUM_NITRO_PINK_TEXT"
                            >
                                {t('guildActions.useAnywhereWithNitro')}
                            </Text>
                        </View>
                    )}
                </View>
            }
        >
            <View
                style={styles.grid}
                onLayout={event => setWidth(event.nativeEvent.layout.width)}
            >
                {shown.map(emoji => (
                    <RipplePressable
                        key={emoji.id}
                        borderless
                        radius={EMOJI_CELL_SIZE / 2}
                        accessibilityRole="imagebutton"
                        accessibilityLabel={emoji.name}
                        onPress={() => {
                            showToast({
                                key: `guild-emoji-${emoji.id}`,
                                content: `:${emoji.name}:`,
                                iconUrl: emojiUrl(emoji.id, emoji.animated, 48),
                            })
                        }}
                        style={styles.cell}
                    >
                        <Emoji emoji={emoji} size={EMOJI_SIZE} cdnSize={48} />
                    </RipplePressable>
                ))}
                {overflow > 0 && (
                    <RipplePressable
                        borderless
                        radius={EMOJI_CELL_SIZE / 2}
                        accessibilityRole="button"
                        accessibilityLabel={t('guildActions.moreEmojis')}
                        onPress={() => setExpanded(true)}
                        style={styles.cell}
                    >
                        <Text variant="text-xs/bold" color="TEXT_SUBTLE">
                            +{Math.min(overflow + 1, MAX_OVERFLOW_LABEL)}
                        </Text>
                    </RipplePressable>
                )}
            </View>
        </ActionSheetRowGroup>
    )
}

const styles = StyleSheet.create(theme => ({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: theme.space.PX_8,
    },
    nitroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_4,
    },
    dot: {
        width: 4,
        height: 4,
        marginHorizontal: theme.space.PX_8,
        borderRadius: theme.radii.round,
        backgroundColor: theme.colors.TEXT_SUBTLE,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: EMOJI_GAP,
        padding: theme.space.PX_12,
        backgroundColor: theme.colors.CARD_MUTED_BG,
    },
    cell: {
        width: EMOJI_CELL_SIZE,
        height: EMOJI_CELL_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
}))
