import { Image } from 'expo-image'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSessionStore } from '../../../core/react'
import { GuildIcon } from '../../../design/components/avatars/GuildIcon'
import { ActionSheet } from '../../../design/components/sheets/Sheet'
import { openActionSheet } from '../../../design/components/sheets/sheetStore'
import { Text } from '../../../design/components/Text'
import { t } from '../../../i18n'
import { guildsStore } from '../../../stores/guilds'
import { stickerPacksStore } from '../../../stores/stickerPacks'
import { stickerUrl } from './emojiImage'
import type { Sticker } from '../index'

/**
 * A held sticker in the picker (StickerDetailActionSheet). Temporary: the sticker, its name and where it is from,
 * without the favorite, join server, Nitro and "View More Stickers" actions.
 */
export function openStickerInfo(sticker: Sticker): void {
    openActionSheet('sticker-info', <StickerInfoSheet sticker={sticker} />)
}

function StickerInfoSheet({ sticker }: { sticker: Sticker }) {
    const packName = useSessionStore(
        stickerPacksStore,
        state =>
            state.packs.find(pack => pack.id === sticker.pack_id)?.name ?? null,
    )
    const guild = useSessionStore(guildsStore, state =>
        sticker.guild_id ? state.guilds[sticker.guild_id] : undefined,
    )
    return (
        <ActionSheet>
            {/* guildEmojiTopContainer: a 48px sticker, 16 before the name and description. */}
            <View style={styles.row}>
                <Image source={stickerUrl(sticker)} style={styles.sticker} />
                <View style={styles.text}>
                    <Text
                        variant="heading-md/extrabold"
                        color="MOBILE_TEXT_HEADING_PRIMARY"
                    >
                        {sticker.name}
                    </Text>
                    {packName ? (
                        <Text
                            variant="text-sm/medium"
                            style={styles.description}
                        >
                            {t('expressions.stickerInfo.pack', {
                                stickerPackName: packName,
                            })}
                        </Text>
                    ) : null}
                </View>
            </View>
            {guild ? (
                <View style={styles.guild}>
                    <GuildIcon guild={guild} size={40} />
                    <Text
                        variant="text-md/semibold"
                        color="MOBILE_TEXT_HEADING_PRIMARY"
                        lineClamp={1}
                        style={styles.text}
                    >
                        {guild.name}
                    </Text>
                </View>
            ) : null}
        </ActionSheet>
    )
}

const styles = StyleSheet.create(theme => ({
    row: { flexDirection: 'row', alignItems: 'center' },
    sticker: { width: 48, height: 48 },
    text: { flex: 1, paddingLeft: theme.space.PX_16 },
    description: { lineHeight: 18, marginTop: theme.space.PX_4 },
    guild: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: theme.space.PX_16,
    },
}))
