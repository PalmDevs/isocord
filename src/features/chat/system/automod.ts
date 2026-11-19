import { MessageType } from '../../../core/discord/messages'
import { t } from '../../../i18n'
import { chatLink } from '../links/chatLink'
import type { MessageKey } from '../../../i18n'
import type { Message } from '../../../stores/readStates'
import type { AutomodRow } from '../rows/rows'
import type { SystemEnv, SystemHandler, SystemHandlers } from './types'

/** MessageEmbedTypes: the embed an AutoMod action carries its details in. */
const AUTOMOD_MESSAGE_EMBED = 'auto_moderation_message'

/** AutomodMessageEmbedKeys: the names of that embed's fields. */
const Field = {
    RULE_NAME: 'rule_name',
    CHANNEL_ID: 'channel_id',
    KEYWORD: 'keyword',
    FLAGGED_MESSAGE_ID: 'flagged_message_id',
    DECISION_OUTCOME: 'decision_outcome',
    APPLICATION_NAME: 'application_name',
} as const

/** AutomodDecisionOutcomeEmbedKeys.BLOCKED. */
const BLOCKED = 'blocked'

/** The flagged author's avatar: 32dp (flagged_message_embed_view.xml), asked for at twice that. */
const FLAGGED_AVATAR_SIZE = 64

/** AutoMod's author line, shared with the incident messages it sends (getAutomodAvatarURL, "OFFICIAL"). */
export const automodAuthor = (): AutomodRow => ({
    name: t('chat.system.automod.name'),
    badge: t('chat.system.automod.badge'),
})

/** A field of the AutoMod embed (extractAutomodMessageFields), or undefined when the embed is another type. */
function automodField(message: Message, name: string): string | undefined {
    const embed = message.embeds?.[0]
    if (embed?.type !== AUTOMOD_MESSAGE_EMBED) return undefined
    return embed.fields?.find(field => field.name === name)?.value
}

/** getActionHeaderTextMobile: flagged or blocked, naming the app when an app's message was caught. */
function headerKey(message: Message): MessageKey {
    const blocked = automodField(message, Field.DECISION_OUTCOME) === BLOCKED
    if (automodField(message, Field.APPLICATION_NAME))
        return blocked
            ? 'chat.system.automod.appBlocked'
            : 'chat.system.automod.appFlagged'
    return blocked
        ? 'chat.system.automod.blocked'
        : 'chat.system.automod.flagged'
}

/** The flagged message's card, its channel, and AutoMod's author line. */
function automodParts(message: Message, env: SystemEnv) {
    const channelId =
        automodField(message, Field.CHANNEL_ID) ?? message.channel_id
    const channel = env.channel(channelId)
    const keyword = automodField(message, Field.KEYWORD)
    const ruleName = automodField(message, Field.RULE_NAME)
    const link = env.userLink(message.author)
    return {
        automod: {
            ...automodAuthor(),
            channel: channel?.name && `#${channel.name}`,
            flagged: {
                authorName: env.name(message.author),
                authorColor: link.color,
                avatarUrl: env.avatarUrl(message.author, FLAGGED_AVATAR_SIZE),
                content: env.spans(message.embeds?.[0]?.description ?? ''),
                keyword:
                    keyword && t('chat.system.automod.keyword', { keyword }),
                rule: ruleName && t('chat.system.automod.rule', { ruleName }),
                // The card jumps to the flagged message.
                url: chatLink.channel(
                    channel?.guild_id ?? env.guild?.id,
                    channelId,
                    automodField(message, Field.FLAGGED_MESSAGE_ID) ??
                        message.id,
                ),
            },
        },
    }
}

/** createAutoModerationActionSystemMessage. Notifications (raid alerts) are not ported: they have no handler here. */
const automodAction: SystemHandler = {
    // Not drawn: an AutoMod row has its own author line in place of the icon.
    icon: 'circleError',
    tint: 'warning',
    content: message =>
        message.embeds?.[0]?.type !== AUTOMOD_MESSAGE_EMBED
            ? undefined
            : {
                  key: headerKey(message),
                  values: {
                      applicationName:
                          automodField(message, Field.APPLICATION_NAME) ?? '',
                      integrationOwner: message.author.username,
                  },
              },
    parts: automodParts,
}

/** Messages AutoMod flagged or blocked. */
export const automodHandlers: SystemHandlers = {
    [MessageType.AUTO_MODERATION_ACTION]: automodAction,
}
