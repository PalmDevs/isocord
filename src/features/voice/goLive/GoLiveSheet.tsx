import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useStore } from 'zustand'
import { StreamPreset } from '../../../core/discord/streams'
import { useSession, useSessionStore } from '../../../core/react'
import { Button } from '../../../design/components/buttons/Button'
import {
    ActionSheet,
    BottomSheetTitleHeader,
} from '../../../design/components/sheets/Sheet'
import {
    hideActionSheet,
    openActionSheet,
} from '../../../design/components/sheets/sheetStore'
import { Text } from '../../../design/components/Text'
import {
    TableRadioGroup,
    TableRadioRow,
    TableSwitchRow,
} from '../../../design/components/table/TableControlRows'
import { TableRowIcon } from '../../../design/components/table/TableRow'
import { TableRowGroup } from '../../../design/components/table/TableRowGroup'
import { Icon } from '../../../design/icons/Icon'
import { t } from '../../../i18n'
import { guildsStore } from '../../../stores/guilds'
import { usersStore } from '../../../stores/users'
import { PremiumType } from '../../expressions/data/availability'
import { showToast } from '../../toasts'
import { rtcStore } from '../rtc'
import { setVoiceSetting, voiceSettingsStore } from '../settings/voiceSettings'
import { goLive } from '../streamActions'
import { maxSettingForPreset, streamSettingForPreset } from './streamQuality'
import type { IconName } from '../../../design/icons/Icon'
import type { MessageKey } from '../../../i18n'

const SHEET_KEY = 'MobileGoLiveActionSheet'

/** MobileGoLiveActionSheet's stream modes, in its order. Performance is left out on iOS only. */
const MODES: {
    preset: number
    icon: IconName
    label: MessageKey
    subLabel: MessageKey
}[] = [
    {
        preset: StreamPreset.MOBILE_DEFAULT,
        icon: 'MobilePhoneIcon',
        label: 'voice.goLive.default',
        subLabel: 'voice.goLive.defaultDescription',
    },
    {
        preset: StreamPreset.MOBILE_PERFORMANCE,
        icon: 'SpeedometerIcon',
        label: 'voice.goLive.performance',
        subLabel: 'voice.goLive.performanceDescription',
    },
    {
        preset: StreamPreset.MOBILE_HIGH_QUALITY,
        icon: 'ImageSparkleIcon',
        label: 'voice.goLive.highQuality',
        subLabel: 'voice.goLive.highQualityDescription',
    },
]

/** Returns whether the user may stream with a preset in the call's guild (canStreamWithPreset). */
function useCanStreamWithPreset(): (preset: number) => boolean {
    const session = useSession()
    const guildId = useSessionStore(rtcStore, state => state.guildId)
    const premiumType = useSessionStore(
        usersStore,
        state => state.users[session.userId]?.premium_type ?? PremiumType.NONE,
    )
    const guildPremiumTier = useSessionStore(guildsStore, state =>
        guildId ? (state.guilds[guildId]?.premiumTier ?? 0) : 0,
    )
    return preset =>
        streamSettingForPreset(preset, premiumType, guildPremiumTier) !== null
}

/** The High Quality label with its Nitro mark. Other modes pass a string, which TableRow styles itself. */
function NitroLabel({ label }: { label: string }) {
    return (
        <View style={styles.highQualityLabel}>
            <Text variant="text-md/semibold" color="TEXT_STRONG">
                {label}
            </Text>
            <Icon name="NitroWheelIcon" size="xs" />
        </View>
    )
}

/** The Stream Mode radio group. A locked mode shows the Nitro upsell's line instead. */
function StreamModes() {
    const preset = useStore(voiceSettingsStore, state => state.streamPreset)
    const canStream = useCanStreamWithPreset()
    return (
        <TableRadioGroup
            title={t('voice.goLive.streamMode')}
            hasIcons
            value={String(preset)}
            onChange={value => {
                const next = Number(value)
                if (canStream(next)) setVoiceSetting('streamPreset', next)
                else showToast({ content: t('voice.goLive.upsell') })
            }}
        >
            {MODES.map(mode => {
                const max = maxSettingForPreset(mode.preset)
                return (
                    <TableRadioRow
                        key={mode.preset}
                        value={String(mode.preset)}
                        icon={<TableRowIcon name={mode.icon} />}
                        label={
                            mode.preset === StreamPreset.MOBILE_HIGH_QUALITY ? (
                                <NitroLabel label={t(mode.label)} />
                            ) : (
                                t(mode.label)
                            )
                        }
                        subLabel={max ? t(mode.subLabel, { ...max }) : ''}
                    />
                )
            })}
        </TableRadioGroup>
    )
}

/**
 * MobileGoLiveActionSheet: the stream mode and app audio, then Start Streaming. Changing them mid-stream is
 * left out: our stream's quality is fixed at its connect.
 */
function GoLiveSheet() {
    const session = useSession()
    const soundshare = useStore(voiceSettingsStore, state => state.soundshare)
    return (
        <ActionSheet
            header={<BottomSheetTitleHeader title={t('voice.goLive.title')} />}
        >
            <StreamModes />
            <TableRowGroup title={t('voice.goLive.streamAudio')}>
                <TableSwitchRow
                    label={t('voice.goLive.shareAppAudio')}
                    value={soundshare}
                    onValueChange={value =>
                        setVoiceSetting('soundshare', value)
                    }
                />
            </TableRowGroup>
            <Button
                size="lg"
                variant="primary"
                text={t('voice.goLive.start')}
                grow
                onPress={() => {
                    hideActionSheet(SHEET_KEY)
                    goLive(session)
                }}
            />
        </ActionSheet>
    )
}

/** showMobileGoLiveActionSheet */
export function showGoLiveSheet(): void {
    openActionSheet(SHEET_KEY, <GoLiveSheet />)
}

const styles = StyleSheet.create(theme => ({
    highQualityLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_4,
    },
}))
