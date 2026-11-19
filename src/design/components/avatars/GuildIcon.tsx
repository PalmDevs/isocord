import { Image } from 'expo-image'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { CDN_BASE } from '../../../core/constants'
import { Text } from '../Text'
import { guildAcronym } from './guildAcronym'

export interface GuildIconProps {
    guild: { id: string; name: string; icon: string | null }
    size?: number
    /** Corner radius; defaults to the rounded square used across the refreshed client. */
    radius?: number
    /** CDN folder; group DM icons live under `channel-icons`. */
    cdnPath?: 'icons' | 'channel-icons'
    /** The icon is on screen (or failed to load): an image takes a frame or more to show, even from the cache. */
    onDisplay?: () => void
}

export function GuildIcon({
    guild,
    size = 48,
    radius = Math.round(size * 0.3),
    cdnPath = 'icons',
    onDisplay,
}: GuildIconProps) {
    if (!guild.icon) {
        return (
            <View style={styles.fallback(size, radius)}>
                <Text
                    variant={
                        size >= 40 ? 'text-md/semibold' : 'text-xxs/semibold'
                    }
                    color="TEXT_DEFAULT"
                    lineClamp={1}
                >
                    {size >= 40
                        ? guildAcronym(guild.name)
                        : guildAcronym(guild.name).slice(0, 1)}
                </Text>
            </View>
        )
    }
    const cdnSize = 2 ** Math.ceil(Math.log2(size * 3))
    return (
        <Image
            source={`${CDN_BASE}/${cdnPath}/${guild.id}/${guild.icon}.webp?size=${cdnSize}`}
            recyclingKey={guild.id}
            cachePolicy="memory-disk"
            onDisplay={onDisplay}
            onError={onDisplay}
            style={styles.icon(size, radius)}
        />
    )
}

const styles = StyleSheet.create(theme => ({
    icon: (size: number, radius: number) => ({
        width: size,
        height: size,
        borderRadius: radius,
    }),
    fallback: (size: number, radius: number) => ({
        width: size,
        height: size,
        borderRadius: radius,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.BACKGROUND_MOD_NORMAL,
    }),
}))
