import { useStore } from 'zustand'
import { useSessionStore } from '../../../core/react'
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
import type { AudioDeviceKey, AudioEndpoint } from '../../../native/voiceTypes'

/** VoicePanelHeaderConstants' VOICE_PANEL_AUDIO_OUTPUT_ACTION_SHEET_KEY. */
const SHEET_KEY = 'VoicePanelAudioOutputActionSheet'

/**
 * Returns the outputs to offer. In a call, the call's endpoints (Telecom's, or `AudioRoutes`' without it). Outside
 * one, the phone's outputs: a pick there is only remembered for the next call.
 */
function useOutputs(): {
    outputs: readonly AudioEndpoint[]
    current: string | null
    inCall: boolean
    missing: AudioDeviceKey | null
} {
    const endpoints = useSessionStore(rtcStore, state => state.endpoints)
    const current = useSessionStore(rtcStore, state => state.currentEndpoint)
    const inCall = useSessionStore(rtcStore, state => state.channelId !== null)
    const devices = useAudioDevices()
    const remembered = useStore(voiceSettingsStore, state => state.outputDevice)
    // Native names the remembered output's id only while it is connected.
    const missing = devices && devices.output === null ? remembered : null
    if (inCall) return { outputs: endpoints, current, inCall, missing }
    return {
        outputs: devices?.outputs ?? [],
        current: devices?.output ?? null,
        inCall,
        missing,
    }
}

/**
 * VoicePanelAudioOutputActionSheet's VoicePanelAudioPhoneOutputSection: a "This Phone" radio group of the outputs,
 * each with its kind's icon and label and the device's name. A pick switches and closes the sheet. Isocord also
 * remembers it (`outputDevice`). The External Device section (game consoles) is left out.
 */
function AudioOutputSheet() {
    const { outputs, current, inCall, missing } = useOutputs()
    const pick = (id: string) => {
        const output = outputs.find(endpoint => endpoint.id === id)
        if (!output) return
        setVoiceSetting('outputDevice', deviceKey(output))
        if (inCall) native?.setEndpoint(id)
        hideActionSheet(SHEET_KEY)
    }
    return (
        <ActionSheet
            header={<BottomSheetTitleHeader title={t('voice.output.select')} />}
        >
            {outputs.length > 0 && (
                <TableRadioGroup
                    title={t('voice.devices.thisPhone')}
                    hasIcons
                    value={current}
                    onChange={pick}
                >
                    {outputs.map(output => (
                        <TableRadioRow
                            key={output.id}
                            value={output.id}
                            icon={<TableRowIcon name={deviceIcon(output)} />}
                            label={deviceLabel(output)}
                            subLabel={deviceSubLabel(output)}
                        />
                    ))}
                    {missing && <MissingDeviceRow device={missing} />}
                </TableRadioGroup>
            )}
        </ActionSheet>
    )
}

/** showAudioOutputSelector's Android branch. */
export function showAudioOutputSheet(): void {
    openActionSheet(SHEET_KEY, <AudioOutputSheet />)
}
