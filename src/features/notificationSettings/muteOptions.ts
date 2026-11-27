import { MuteUntilSeconds } from '../../core/discord/notificationSettings'
import type { MessageKey } from '../../i18n'

/** MuteSettingsUtils.getMuteOptions: shared mute durations for channels, categories, threads and servers. */
export const MUTE_OPTIONS = [
    {
        label: 'muteSettings.for15Minutes',
        seconds: MuteUntilSeconds.MINUTES_15,
    },
    { label: 'muteSettings.for1Hour', seconds: MuteUntilSeconds.HOURS_1 },
    { label: 'muteSettings.for3Hours', seconds: MuteUntilSeconds.HOURS_3 },
    { label: 'muteSettings.for8Hours', seconds: MuteUntilSeconds.HOURS_8 },
    { label: 'muteSettings.for24Hours', seconds: MuteUntilSeconds.HOURS_24 },
    { label: 'muteSettings.untilTurnedOn', seconds: MuteUntilSeconds.ALWAYS },
] as const satisfies readonly { label: MessageKey; seconds: number }[]
