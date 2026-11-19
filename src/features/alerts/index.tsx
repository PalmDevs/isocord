import { AlertHost } from '../../design/components/modals/AlertHost'
import type { Feature } from '../../core/feature'

/** Mounts the host for `belowSheets` alerts opened with `openAlert` / `showConfirmModal`. */
export const alertsFeature: Feature = {
    name: 'alerts',
    overlays: { alerts: () => <AlertHost layer="belowSheets" /> },
}

/** Mounts the host for `aboveSheets` alerts. Register it after sheetsFeature. */
export const alertsAboveSheetsFeature: Feature = {
    name: 'alertsAboveSheets',
    overlays: { alertsAboveSheets: () => <AlertHost layer="aboveSheets" /> },
}
