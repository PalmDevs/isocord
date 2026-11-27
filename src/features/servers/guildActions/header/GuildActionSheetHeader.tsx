import { useEffect, useState } from 'react'
import { PixelRatio, View } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { guildBannerUrl } from '../../../../core/discord/cdn'
import { GuildFeature } from '../../../../core/discord/guild'
import { useSession } from '../../../../core/react'
import { Text } from '../../../../design/components/Text'
import { Icon } from '../../../../design/icons/Icon'
import { fetchGuildPreview } from '../../../../stores/guildActions'
import { GuildHeaderBanner, GuildHeaderIcon } from './GuildHeaderMedia'
import { GuildHeaderMeta } from './GuildHeaderMeta'
import type { GuildPreview } from '../../../../stores/guildActions'
import type { Guild } from '../../../../stores/guilds'

const BANNER_CDN_WIDTH = 420

/** Fetches the public preview, which fills in what the guild in the store lacks. */
function useGuildPreview(guildId: string): GuildPreview | null {
    const session = useSession()
    const [preview, setPreview] = useState<GuildPreview | null>(null)
    useEffect(() => {
        let cancelled = false
        setPreview(null)
        fetchGuildPreview(session, guildId).then(data => {
            if (!cancelled && data) setPreview(data)
        })
        return () => {
            cancelled = true
        }
    }, [session, guildId])
    return preview
}

/**
 * GuildActionSheetHeader: banner, cutout server icon, name, badges, description, community pill,
 * boost count, and online/total member counts.
 */
export function GuildActionSheetHeader({ guild }: { guild: Guild }) {
    const reducedMotion = useReducedMotion()
    const preview = useGuildPreview(guild.id)

    const features = guild.features ?? preview?.features ?? []
    const isVerified = features.includes(GuildFeature.VERIFIED)
    const isPartnered = features.includes(GuildFeature.PARTNERED)
    const description = guild.description ?? preview?.description
    const bannerSize =
        2 ** Math.ceil(Math.log2(BANNER_CDN_WIDTH * PixelRatio.get()))
    const animateBanner =
        !reducedMotion && features.includes(GuildFeature.ANIMATED_BANNER)
    const bannerSource = guild.banner
        ? guildBannerUrl(guild.id, guild.banner, bannerSize, animateBanner)
        : undefined

    return (
        <View>
            {bannerSource && (
                <GuildHeaderBanner guild={guild} source={bannerSource} />
            )}
            <View style={styles.content(Boolean(bannerSource))}>
                <GuildHeaderIcon
                    guild={guild}
                    overlapsBanner={Boolean(bannerSource)}
                />

                <View style={styles.nameRow}>
                    {(isVerified || isPartnered) && (
                        <Icon
                            name={
                                isPartnered ? 'SparklesIcon' : 'CircleCheckIcon'
                            }
                            size="sm"
                            color="TEXT_BRAND"
                        />
                    )}
                    <Text
                        accessibilityRole="header"
                        variant="heading-xl/semibold"
                        color="MOBILE_TEXT_HEADING_PRIMARY"
                        lineClamp={2}
                        style={styles.name}
                    >
                        {guild.name}
                    </Text>
                </View>

                {Boolean(description) && (
                    <Text
                        variant="text-sm/medium"
                        color="TEXT_DEFAULT"
                        style={styles.description}
                    >
                        {description}
                    </Text>
                )}

                <GuildHeaderMeta
                    isCommunity={features.includes(GuildFeature.COMMUNITY)}
                    isDiscoverable={features.includes(
                        GuildFeature.DISCOVERABLE,
                    )}
                    memberCount={
                        guild.memberCount > 0
                            ? guild.memberCount
                            : (preview?.approximate_member_count ?? 0)
                    }
                    onlineCount={preview?.approximate_presence_count}
                    boostCount={guild.premiumSubscriberCount ?? 0}
                    boostTier={guild.premiumTier ?? 0}
                />
            </View>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    content: (hasBanner: boolean) => ({
        paddingHorizontal: theme.space.PX_16,
        paddingTop: hasBanner ? 0 : theme.space.PX_4,
        paddingBottom: theme.space.PX_12,
    }),
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_8,
        marginTop: theme.space.PX_8,
    },
    name: { flexShrink: 1 },
    description: { marginTop: theme.space.PX_8 },
}))
