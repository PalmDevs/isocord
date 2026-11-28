import { TableRadioRow } from '../../../design/components/table/TableControlRows'
import { TableRowIcon } from '../../../design/components/table/TableRow'
import { t } from '../../../i18n'
import { deviceIcon, deviceLabel } from './audioDevices'
import type { AudioDeviceKey } from '../../../native/voiceTypes'

/** The value of the row: never a device id, so it is never the checked one. */
const MISSING_VALUE = 'missing'

/**
 * Isocord's own: the remembered device while it is disconnected, disabled. Native switches to it once it
 * connects (AudioDevices.kt).
 */
export function MissingDeviceRow({ device }: { device: AudioDeviceKey }) {
    return (
        <TableRadioRow
            value={MISSING_VALUE}
            disabled
            icon={<TableRowIcon name={deviceIcon(device)} />}
            label={deviceLabel(device)}
            subLabel={t('voice.devices.notConnected')}
        />
    )
}
