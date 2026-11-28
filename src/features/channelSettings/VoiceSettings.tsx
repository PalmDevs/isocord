import { useNavigation } from '@react-navigation/native'
import { useEffect } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import {
    BITRATE_DEFAULT,
    BITRATE_MAX,
    BITRATE_MIN,
    BOOSTED_TIER_BITRATES,
    MAX_STAGE_VOICE_USER_LIMIT,
    MAX_VOICE_USER_LIMIT,
    TOP_BOOST_TIER,
} from '../../core/discord/channelLimits'
import { ChannelType } from '../../core/discord/channelType'
import { GuildFeature } from '../../core/discord/guild'
import { VideoQualityMode } from '../../core/discord/videoQualityMode'
import { useSession, useSessionStore } from '../../core/react'
import { Slider } from '../../design/components/inputs/Slider'
import { Card } from '../../design/components/layout/Card'
import { Text } from '../../design/components/Text'
import {
    TableRadioGroup,
    TableRadioRow,
} from '../../design/components/table/TableControlRows'
import {
    TableRow,
    TableRowTrailingText,
} from '../../design/components/table/TableRow'
import { TableRowGroup } from '../../design/components/table/TableRowGroup'
import { t } from '../../i18n'
import { guildsStore } from '../../stores/guilds'
import {
    fetchRegions,
    pickableRegions,
    voiceRegionsStore,
} from '../../stores/voiceRegions'
import { openChannelRegion } from './routes'
import type { Channel } from '../../stores/channels/channels'
import type { Guild } from '../../stores/guilds'

/** The voice fields of the edit form. */
export interface VoiceForm {
    bitrate: number
    userLimit: number
    videoQualityMode: number
}

/** The voice fields a channel holds, with the reference's defaults. */
export const voiceFormOf = (channel: Channel): VoiceForm => ({
    bitrate: channel.bitrate ?? BITRATE_DEFAULT,
    userLimit: channel.user_limit ?? 0,
    videoQualityMode: channel.video_quality_mode ?? VideoQualityMode.AUTO,
})

const isStage = (channel: Channel) =>
    channel.type === ChannelType.GUILD_STAGE_VOICE

/** ChannelUtils.getBitrateLimit: the boost tier's bitrate, the top tier's with VIP_REGIONS. A stage keeps the default. */
function bitrateLimit(channel: Channel, guild: Guild | undefined): number {
    if (isStage(channel)) return BITRATE_DEFAULT
    if (!guild) return BITRATE_MAX
    const vip = guild.features?.includes(GuildFeature.VIP_REGIONS)
        ? (BOOSTED_TIER_BITRATES[TOP_BOOST_TIER] ?? BITRATE_MAX)
        : BITRATE_MAX
    return Math.max(
        vip,
        BOOSTED_TIER_BITRATES[guild.premiumTier ?? 0] ?? BITRATE_MAX,
    )
}

/** A title and its value over a slider, in a card (renderBitrateSettings, renderUserLimitSettings). */
function SliderSetting({
    title,
    valueLabel,
    helperText,
    value,
    minimumValue,
    maximumValue,
    onChange,
}: {
    title: string
    valueLabel: string
    helperText: string
    value: number
    minimumValue: number
    maximumValue: number
    onChange: (value: number) => void
}) {
    return (
        <TableRowGroup helperText={helperText}>
            <Card border="none">
                <View style={styles.header}>
                    <Text
                        variant="text-md/semibold"
                        color="MOBILE_TEXT_HEADING_PRIMARY"
                        style={styles.title}
                    >
                        {title}
                    </Text>
                    <Text variant="text-md/medium" color="TEXT_MUTED">
                        {valueLabel}
                    </Text>
                </View>
                <Slider
                    style={styles.slider}
                    value={Math.min(value, maximumValue)}
                    minimumValue={minimumValue}
                    maximumValue={maximumValue}
                    onValueChange={next => onChange(Math.round(next))}
                />
            </Card>
        </TableRowGroup>
    )
}

/** renderUserLimitSettings's value: "No Limit" or the count of users. */
function userLimitLabel(limit: number): string {
    if (limit === 0) return t('channelSettings.userLimitNone')
    return t(
        limit === 1
            ? 'channelSettings.userLimitOne'
            : 'channelSettings.userLimitOther',
        { num: limit },
    )
}

/** renderRegionOverride: the channel's region, opening ChannelSettingsChangeRTCRegion. Not for a stage. */
function RegionOverrideRow({ channel }: { channel: Channel }) {
    const session = useSession()
    const navigation = useNavigation()
    const guildId = channel.guild_id ?? ''
    const regions = useSessionStore(
        voiceRegionsStore,
        state => state.byGuild[guildId],
    )
    // ChannelSettingsOverview's componentDidMount fetches the server's regions.
    useEffect(() => {
        void fetchRegions(session, guildId)
    }, [session, guildId])
    const name =
        regions?.find(region => region.id === channel.rtc_region)?.name ??
        t('channelSettings.regionAutomatic')
    return (
        <TableRowGroup
            title={t('channelSettings.regionOverride')}
            description={t('channelSettings.regionOverrideHelper')}
        >
            <TableRow
                label={t('channelSettings.regionOverride')}
                trailing={<TableRowTrailingText text={name} />}
                arrow
                disabled={!regions || pickableRegions(regions).length === 0}
                onPress={() => openChannelRegion(navigation, channel.id)}
            />
        </TableRowGroup>
    )
}

/**
 * ChannelSettingsOverview's voice settings (showVoiceSettings): bitrate, video quality, user limit and the region
 * override. The screen already needs MANAGE_CHANNELS.
 */
export function VoiceSettings({
    channel,
    form,
    onChange,
}: {
    channel: Channel
    form: VoiceForm
    onChange: (form: VoiceForm) => void
}) {
    const guild = useSessionStore(guildsStore, state =>
        channel.guild_id ? state.guilds[channel.guild_id] : undefined,
    )
    const stage = isStage(channel)
    return (
        <>
            <SliderSetting
                title={t('channelSettings.bitrate')}
                valueLabel={`${Math.round(form.bitrate / 1000)}kbps`}
                helperText={t('channelSettings.bitrateHelper', {
                    bitrate: BITRATE_DEFAULT / 1000,
                })}
                value={form.bitrate}
                minimumValue={BITRATE_MIN}
                maximumValue={bitrateLimit(channel, guild)}
                onChange={bitrate => onChange({ ...form, bitrate })}
            />
            <TableRadioGroup
                title={t('channelSettings.videoQuality')}
                description={t('channelSettings.videoQualityHelper')}
                value={String(form.videoQualityMode)}
                onChange={value =>
                    onChange({ ...form, videoQualityMode: Number(value) })
                }
            >
                <TableRadioRow
                    label={t('channelSettings.videoQualityAuto')}
                    value={String(VideoQualityMode.AUTO)}
                />
                <TableRadioRow
                    label={t('channelSettings.videoQualityFull')}
                    value={String(VideoQualityMode.FULL)}
                />
            </TableRadioGroup>
            <SliderSetting
                title={t('channelSettings.userLimit')}
                valueLabel={userLimitLabel(form.userLimit)}
                helperText={t(
                    stage
                        ? 'channelSettings.userLimitStageHelper'
                        : 'channelSettings.userLimitHelper',
                )}
                value={form.userLimit}
                minimumValue={0}
                maximumValue={
                    stage ? MAX_STAGE_VOICE_USER_LIMIT : MAX_VOICE_USER_LIMIT
                }
                onChange={userLimit => onChange({ ...form, userLimit })}
            />
            {!stage && channel.guild_id && (
                <RegionOverrideRow channel={channel} />
            )}
        </>
    )
}

const styles = StyleSheet.create(theme => ({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    title: { flexShrink: 1 },
    // renderBitrateSettings's slider offset, as SlowmodeSetting.
    slider: { marginStart: -theme.space.PX_4, marginTop: theme.space.PX_8 },
}))
