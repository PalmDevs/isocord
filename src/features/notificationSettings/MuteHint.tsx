import { UserNotificationSettings } from '../../core/discord/notificationSettings'
import { Text } from '../../design/components/Text'
import { t } from '../../i18n'
import type { SemanticColor } from '../../design/tokens'
import type { MessageKey } from '../../i18n'

/** A hook in a message: `{mutedHook:{$b:muted}}`, the part the reference's hook function colours. */
const HOOK = /\{\w+:\{\$b:([^}]*)\}\}/

/** Renders a message whose hook is drawn in `color` (the reference's mutedHook and notificationHook). */
function HookedText({
    message,
    color,
    textColor,
}: {
    message: MessageKey
    color: SemanticColor
    textColor: SemanticColor
}) {
    const [before, hook, after] = t(message).split(HOOK)
    return (
        <Text variant="text-sm/medium" color={textColor}>
            {before}
            <Text variant="text-sm/medium" color={color}>
                {hook}
            </Text>
            {after}
        </Text>
    )
}

/**
 * The server-level notice of ChannelSettingsNotifications.render: the server is muted, or set to Nothing, and
 * channel settings do not get around that. Nothing for the other levels.
 */
export function ServerNotice({
    guildMuted,
    guildLevel,
    textColor = 'TEXT_MUTED',
}: {
    guildMuted: boolean
    guildLevel: number
    textColor?: SemanticColor
}) {
    if (guildMuted)
        return (
            <HookedText
                message="muteSettings.serverMuted"
                color="TEXT_FEEDBACK_CRITICAL"
                textColor={textColor}
            />
        )
    if (guildLevel === UserNotificationSettings.NO_MESSAGES)
        return (
            <HookedText
                message="muteSettings.serverNothing"
                color="TEXT_FEEDBACK_WARNING"
                textColor={textColor}
            />
        )
    return null
}

/** MuteSettingsHint: the channel's own mute, else the server notice, else the server's level. */
export function MuteSettingsHint({
    muted,
    guildMuted,
    guildLevel,
}: {
    muted: boolean
    guildMuted: boolean
    guildLevel: number
}) {
    if (muted)
        return (
            <Text variant="text-sm/medium">
                {t('muteSettings.channelMuted')}
            </Text>
        )
    if (guildMuted || guildLevel === UserNotificationSettings.NO_MESSAGES)
        return (
            <ServerNotice
                guildMuted={guildMuted}
                guildLevel={guildLevel}
                textColor="TEXT_DEFAULT"
            />
        )
    if (guildLevel === UserNotificationSettings.ALL_MESSAGES)
        return (
            <Text variant="text-sm/medium">
                {t('muteSettings.serverAllMessages')}
            </Text>
        )
    if (guildLevel === UserNotificationSettings.ONLY_MENTIONS)
        return (
            <Text variant="text-sm/medium">
                {t('muteSettings.serverOnlyMentions')}
            </Text>
        )
    return null
}
