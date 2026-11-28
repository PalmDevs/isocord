import { useStore } from 'zustand'
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
import { cameraLabel, sameCamera, useCameras } from '../cameras'
import { setVoiceSetting, voiceSettingsStore } from './voiceSettings'
import type { SettingNode } from '../../settings/config'

const SHEET_KEY = 'CameraActionSheet'

/** The Default row's value: no remembered camera, the front one. */
const DEFAULT_CAMERA = 'default'

/**
 * Isocord's own: Discord's mobile client only flips to the other camera. Built like AudioInputSheet, with a
 * Default row first. A pick is remembered (`camera`) and moves a running camera to it.
 */
function CameraSheet() {
    const cameras = useCameras() ?? []
    const remembered = useStore(voiceSettingsStore, state => state.camera)
    const selected = cameras.find(camera => sameCamera(camera, remembered))
    const pick = (id: string) => {
        const camera = cameras.find(device => device.id === id)
        setVoiceSetting('camera', camera ?? null)
        hideActionSheet(SHEET_KEY)
    }
    return (
        <ActionSheet
            header={<BottomSheetTitleHeader title={t('voice.camera.title')} />}
        >
            <TableRadioGroup
                hasIcons
                value={selected?.id ?? DEFAULT_CAMERA}
                onChange={pick}
            >
                <TableRadioRow
                    value={DEFAULT_CAMERA}
                    icon={<TableRowIcon name="VideoIcon" />}
                    label={t('voice.devices.default')}
                />
                {cameras.map(camera => (
                    <TableRadioRow
                        key={camera.id}
                        value={camera.id}
                        icon={<TableRowIcon name="VideoIcon" />}
                        label={cameraLabel(camera, cameras)}
                    />
                ))}
            </TableRadioGroup>
        </ActionSheet>
    )
}

export function showCameraSheet(): void {
    openActionSheet(SHEET_KEY, <CameraSheet />)
}

/** The Voice settings' camera row: the remembered camera, a tap opens the picker. */
export const cameraSetting: SettingNode = {
    type: 'pressable',
    parent: 'VOICE',
    title: () => t('voice.camera.title'),
    trailing: ({ voice }) =>
        voice.camera ? cameraLabel(voice.camera) : t('voice.devices.default'),
    onPress: showCameraSheet,
}
