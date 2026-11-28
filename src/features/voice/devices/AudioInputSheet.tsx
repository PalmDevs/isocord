import { useStore } from 'zustand'
import { useSession } from '../../../core/react'
import {
    ActionSheet,
    BottomSheetTitleHeader,
} from '../../../design/components/sheets/Sheet'
import {
    hideActionSheet,
    openActionSheet,
} from '../../../design/components/sheets/sheetStore'
import {
    TableRadioGroup,
    TableRadioRow,
} from '../../../design/components/table/TableControlRows'
import { TableRowIcon } from '../../../design/components/table/TableRow'
import { t } from '../../../i18n'
import native from '../../../native/IsocordVoice'
import { rtcStore } from '../rtc'
import { setVoiceSetting, voiceSettingsStore } from '../settings/voiceSettings'
import {
    deviceIcon,
    deviceKey,
    deviceLabel,
    deviceSubLabel,
    useAudioDevices,
} from './audioDevices'
import { MissingDeviceRow } from './MissingDeviceRow'
import type { Session } from '../../../core/session'
import type { AudioInputDevice } from '../../../native/voiceTypes'

const SHEET_KEY = 'AudioInputActionSheet'

/** The Default row's value: no remembered input, the system picks. */
const DEFAULT_INPUT = 'default'

/**
 * A Bluetooth mic needs the headset's SCO link, which runs only while the call plays to it. Picking one in a
 * call also routes the output there.
 */
function routeToHeadset(session: Session, input: AudioInputDevice): void {
    const { endpoints, currentEndpoint } = session.get(rtcStore).getState()
    const headsets = endpoints.filter(endpoint => endpoint.kind === 'bluetooth')
    const headset =
        headsets.find(endpoint => endpoint.name === input.name) ?? headsets[0]
    if (headset && headset.id !== currentEndpoint)
        native?.setEndpoint(headset.id)
}

/**
 * Isocord's own: Discord's mobile client has no input picker. Built like VoicePanelAudioOutputActionSheet, with
 * a Default row first that leaves the choice to the system. A pick is remembered (`inputDevice`).
 */
function AudioInputSheet() {
    const session = useSession()
    const devices = useAudioDevices()
    const inputs = devices?.inputs ?? []
    const remembered = useStore(voiceSettingsStore, state => state.inputDevice)
    const missing = devices && devices.input === null ? remembered : null
    const pick = (id: string) => {
        const input = inputs.find(device => device.id === id)
        setVoiceSetting('inputDevice', input ? deviceKey(input) : null)
        if (input?.kind === 'bluetooth') routeToHeadset(session, input)
        hideActionSheet(SHEET_KEY)
    }
    return (
        <ActionSheet
            header={
                <BottomSheetTitleHeader
                    title={t('voice.settings.microphone')}
                />
            }
        >
            <TableRadioGroup
                title={t('voice.devices.thisPhone')}
                hasIcons
                value={devices?.input ?? DEFAULT_INPUT}
                onChange={pick}
            >
                <TableRadioRow
                    value={DEFAULT_INPUT}
                    icon={<TableRowIcon name="MicrophoneIcon" />}
                    label={t('voice.devices.default')}
                />
                {inputs.map(input => (
                    <TableRadioRow
                        key={input.id}
                        value={input.id}
                        icon={<TableRowIcon name={deviceIcon(input)} />}
                        label={deviceLabel(input)}
                        subLabel={deviceSubLabel(input)}
                    />
                ))}
                {missing && <MissingDeviceRow device={missing} />}
            </TableRadioGroup>
        </ActionSheet>
    )
}

export function showAudioInputSheet(): void {
    openActionSheet(SHEET_KEY, <AudioInputSheet />)
}
