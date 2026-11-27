import { Image } from 'expo-image'
import { View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { guildBannerUrl, guildIconUrl } from '../../../../core/discord/cdn'
import { useSession } from '../../../../core/react'
import { GuildIcon } from '../../../../design/components/avatars/GuildIcon'
import { RipplePressable } from '../../../../design/components/buttons/RipplePressable'
import { useSurfaceColor } from '../../../../design/surfaceTint'
import { openImageViewer } from '../../../mediaViewer/store'
import { VIEWER_IMAGE_SIZE } from '../../../userProfile/constants'
import type { Guild } from '../../../../stores/guilds'

const BANNER_HEIGHT = 136
const ICON_SIZE = 64
const ICON_PADDING = 4
const ICON_RADIUS = 18

/** Banner image over the header; tapping opens the media viewer. */
export function GuildHeaderBanner({
    guild,
    source,
}: {
    guild: Guild
    source: string
}) {
    const session = useSession()
    return (
        <RipplePressable
            accessibilityRole="imagebutton"
            onPress={() => {
                if (!guild.banner) return
                openImageViewer(
                    session,
                    guildBannerUrl(
                        guild.id,
                        guild.banner,
                        VIEWER_IMAGE_SIZE,
                        true,
                    ),
                )
            }}
            style={styles.banner}
        >
            <Image
                source={source}
                contentFit="cover"
                cachePolicy="memory-disk"
                style={styles.fill}
            />
        </RipplePressable>
    )
}

/** Server icon in a cutout of the sheet background, overlapping the banner. */
export function GuildHeaderIcon({
    guild,
    overlapsBanner,
}: {
    guild: Guild
    overlapsBanner: boolean
}) {
    const session = useSession()
    const { theme } = useUnistyles()
    const cutoutBg = useSurfaceColor(theme.colors.MOBILE_ACTIONSHEET_BACKGROUND)
    return (
        <View
            style={[
                styles.iconCutout(cutoutBg),
                overlapsBanner && styles.iconOverlap,
            ]}
        >
            <RipplePressable
                accessibilityRole="imagebutton"
                disabled={!guild.icon}
                radius={ICON_RADIUS}
                onPress={() => {
                    if (!guild.icon) return
                    openImageViewer(
                        session,
                        guildIconUrl(guild.id, guild.icon, VIEWER_IMAGE_SIZE),
                        VIEWER_IMAGE_SIZE,
                        VIEWER_IMAGE_SIZE,
                    )
                }}
            >
                <GuildIcon
                    guild={guild}
                    size={ICON_SIZE}
                    radius={ICON_RADIUS}
                />
            </RipplePressable>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    banner: {
        height: BANNER_HEIGHT,
        width: '100%',
        backgroundColor: theme.colors.BACKGROUND_BASE_LOWER,
    },
    fill: { width: '100%', height: '100%' },
    iconCutout: (backgroundColor: string) => ({
        alignSelf: 'flex-start',
        padding: ICON_PADDING,
        marginLeft: -ICON_PADDING,
        borderRadius: ICON_RADIUS + ICON_PADDING,
        backgroundColor,
    }),
    iconOverlap: {
        marginTop: -(ICON_SIZE / 2 + ICON_PADDING),
    },
}))
