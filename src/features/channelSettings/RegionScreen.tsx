import { useRoute } from '@react-navigation/native'
import { useSession, useSessionStore } from '../../core/react'
import {
    TableRadioGroup,
    TableRadioRow,
} from '../../design/components/table/TableControlRows'
import { t } from '../../i18n'
import { updateChannel } from '../../stores/channels/channelActions'
import { pickableRegions, voiceRegionsStore } from '../../stores/voiceRegions'
import { showToast } from '../toasts'
import { useManagedChannel } from './permissions'
import { ChannelSettingsScaffold } from './Scaffold'
import type { Channel } from '../../stores/channels/channels'
import type { ChannelRouteParams } from './routes'

/** ChannelSettingsChangeRTCRegion's AUTOMATIC_RTC_REGION: the row that clears the override. */
const AUTOMATIC_RTC_REGION = 'AUTOMATIC_RTC_REGION'

function RegionList({ channel }: { channel: Channel }) {
    const session = useSession()
    const regions = useSessionStore(
        voiceRegionsStore,
        state => state.byGuild[channel.guild_id ?? ''],
    )
    const pickable = pickableRegions(regions ?? [])
    const selected = pickable.some(region => region.id === channel.rtc_region)
        ? (channel.rtc_region ?? AUTOMATIC_RTC_REGION)
        : AUTOMATIC_RTC_REGION
    // handleSetRegion: saves at once.
    const pick = (id: string) =>
        updateChannel(session, channel.id, {
            rtc_region: id === AUTOMATIC_RTC_REGION ? null : id,
        }).catch(() =>
            showToast({
                key: 'channel-settings-error',
                variant: 'critical',
                content: t('channelSettings.saveError'),
            }),
        )
    return (
        <TableRadioGroup value={selected} onChange={pick}>
            <TableRadioRow
                label={t('channelSettings.regionAutomatic')}
                value={AUTOMATIC_RTC_REGION}
            />
            {pickable.map(region => (
                <TableRadioRow
                    key={region.id}
                    label={region.name}
                    value={region.id}
                />
            ))}
        </TableRadioGroup>
    )
}

/** ChannelSettingsChangeRTCRegion: picks a voice channel's region, Automatic first. */
export function RegionScreen() {
    const { channelId } = useRoute().params as ChannelRouteParams
    const channel = useManagedChannel(channelId)
    return (
        channel && (
            <ChannelSettingsScaffold
                title={t('channelSettings.regionOverride')}
            >
                <RegionList channel={channel} />
            </ChannelSettingsScaffold>
        )
    )
}
