import { MessageType } from '../../../core/discord/messages'
import { snowflakeTimestamp } from '../../../core/discord/snowflake'
import { humanizeDuration } from '../timestamp'
import { automodAuthor } from './automod'
import { authorValues } from './types'
import type { MessageKey } from '../../../i18n'
import type { Message } from '../../../stores/readStates'
import type {
    SystemContent,
    SystemEnv,
    SystemHandler,
    SystemHandlers,
} from './types'

/** A discovery message: with the server's name in bold, or the line for an unknown server. */
const discovery = (
    named: MessageKey,
    unknown: MessageKey,
    icon: SystemHandler['icon'],
    tint: SystemHandler['tint'],
): SystemHandler => ({
    icon,
    tint,
    // The chat's server. The reference falls back to the server the reference names, which is the same one.
    content: (_message, env): SystemContent => {
        const guildName = env.guild?.name
        return guildName
            ? { key: named, values: { guildName } }
            : { key: unknown, values: {} }
    },
})

/** createGuildStreamSystemMessage. Join Stream stays text: the app does not join streams. */
function streamContent(message: Message, env: SystemEnv): SystemContent {
    const ended = message.call?.ended_timestamp
    return ended
        ? {
              key: 'chat.system.stream.ended',
              values: {
                  ...authorValues(message, env),
                  duration: humanizeDuration(
                      Date.parse(ended) - snowflakeTimestamp(message.id),
                  ),
              },
          }
        : { key: 'chat.system.stream.live', values: authorValues(message, env) }
}

/** The time security actions last until: the content holds it (toLocaleString with hour and minute). */
const alertUntil = (message: Message) =>
    message.content
        ? new Date(message.content).toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
          })
        : ''

/** An incident message: sent as AutoMod, with the author named in the text. */
const incident = (
    content: SystemHandler['content'],
    icon: SystemHandler['icon'],
): SystemHandler => ({
    icon,
    tint: 'normal',
    content,
    parts: () => ({ automod: automodAuthor() }),
})

/** Server events: followed channels, Server Discovery, streams and security incidents. */
export const guildHandlers: SystemHandlers = {
    // createChannelFollowAddSystemMessage. The followed server's name opens nothing (bindGuildMenu is not ported).
    [MessageType.CHANNEL_FOLLOW_ADD]: {
        icon: 'announcements',
        tint: 'normal',
        content: (message, env) => ({
            key: 'chat.system.followAdd',
            values: {
                ...authorValues(message, env),
                webhookName: message.content ?? '',
            },
        }),
    },
    // createGuildDiscovery*SystemMessage.
    [MessageType.GUILD_DISCOVERY_DISQUALIFIED]: discovery(
        'chat.system.discovery.disqualified',
        'chat.system.discovery.disqualifiedUnknown',
        'x',
        'danger',
    ),
    [MessageType.GUILD_DISCOVERY_REQUALIFIED]: {
        icon: 'checkmark',
        tint: 'positive',
        content: () => ({
            key: 'chat.system.discovery.requalified',
            values: {},
        }),
    },
    [MessageType.GUILD_DISCOVERY_GRACE_PERIOD_INITIAL_WARNING]: discovery(
        'chat.system.discovery.initialWarning',
        'chat.system.discovery.initialWarningUnknown',
        'circleError',
        'warning',
    ),
    [MessageType.GUILD_DISCOVERY_GRACE_PERIOD_FINAL_WARNING]: discovery(
        'chat.system.discovery.finalWarning',
        'chat.system.discovery.finalWarningUnknown',
        'circleError',
        'warning',
    ),
    [MessageType.GUILD_STREAM]: {
        icon: 'arrowRight',
        tint: 'positive',
        content: streamContent,
    },
    // createGuildAlertModeEnabledSystemMessage and the others below are ordinary messages from AutoMod.
    [MessageType.GUILD_INCIDENT_ALERT_MODE_ENABLED]: incident(
        (message, env) => ({
            key: 'chat.system.alertMode.enabled',
            values: {
                ...authorValues(message, env),
                time: alertUntil(message),
            },
        }),
        'lock',
    ),
    [MessageType.GUILD_INCIDENT_ALERT_MODE_DISABLED]: incident(
        (message, env) => ({
            key: 'chat.system.alertMode.disabled',
            values: authorValues(message, env),
        }),
        'lockUnlocked',
    ),
    // createGuildReportRaidSystemMessage.
    [MessageType.GUILD_INCIDENT_REPORT_RAID]: incident(
        (message, env) => ({
            key: 'chat.system.reportRaid',
            values: {
                ...authorValues(message, env),
                guildName: env.guild?.name ?? '',
            },
        }),
        'circleError',
    ),
    // createGuildReportFalseAlarmSystemMessage.
    [MessageType.GUILD_INCIDENT_REPORT_FALSE_ALARM]: incident(
        (message, env) => ({
            key: 'chat.system.reportFalseAlarm',
            values: authorValues(message, env),
        }),
        'checkmark',
    ),
}
