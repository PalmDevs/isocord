import { HelpdeskArticle, helpArticleUrl } from '../../../core/discord/helpdesk'
import { MessageType } from '../../../core/discord/messages'
import { chatLink } from '../links/chatLink'
import { authorValues } from './types'
import type { MessageKey } from '../../../i18n'
import type { Message } from '../../../stores/readStates'
import type { SystemContent, SystemEnv, SystemHandlers } from './types'

/** PurchaseNotificationType.GUILD_PRODUCT. */
const GUILD_PRODUCT = 0

/** getRoleSubscriptionPurchaseSystemMessageContentMobile's lines: joined or renewed, with or without the months. */
const ROLE_SUBSCRIPTION_KEYS: Record<
    'joined' | 'renewed',
    { none: MessageKey; one: MessageKey; other: MessageKey }
> = {
    joined: {
        none: 'chat.system.roleSubscription.joined',
        one: 'chat.system.roleSubscription.joinedMonth',
        other: 'chat.system.roleSubscription.joinedMonths',
    },
    renewed: {
        none: 'chat.system.roleSubscription.renewed',
        one: 'chat.system.roleSubscription.renewedMonth',
        other: 'chat.system.roleSubscription.renewedMonths',
    },
}

/**
 * createRoleSubscriptionPurchaseSystemMessage. The server name opens nothing (the role subscription overview is
 * not ported), and the welcome card and sticker under a first month are not drawn.
 */
function roleSubscriptionContent(
    message: Message,
    env: SystemEnv,
): SystemContent | undefined {
    const data = message.role_subscription_data
    if (!data) return undefined
    const months = data.total_months_subscribed
    const keys = ROLE_SUBSCRIPTION_KEYS[data.is_renewal ? 'renewed' : 'joined']
    return {
        key: months <= 0 ? keys.none : months === 1 ? keys.one : keys.other,
        values: {
            ...authorValues(message, env),
            tierName: data.tier_name,
            guildName: env.guild?.name ?? '',
            months,
        },
    }
}

/** The app named in a group DM integration message, opening its bot's profile. */
function appValues(message: Message, env: SystemEnv) {
    const app = message.application
    return {
        ...authorValues(message, env),
        helpCenterLink: {
            url: helpArticleUrl(HelpdeskArticle.PRIVATE_CHANNEL_INTEGRATIONS),
        },
        ...(app && {
            otherUsername: app.name,
            ...(app.bot && {
                otherUsernameOnClick: { url: chatLink.user(app.bot.id) },
            }),
        }),
    }
}

/** createPrivateChannelIntegrationSystemMessage: an app added to or removed from a group DM. */
const integration =
    (named: MessageKey, deleted: MessageKey) =>
    (message: Message, env: SystemEnv): SystemContent => ({
        key: message.application ? named : deleted,
        values: appValues(message, env),
    })

/** Role subscriptions, server products, premium apps and group DM apps. */
export const purchaseHandlers: SystemHandlers = {
    [MessageType.ROLE_SUBSCRIPTION_PURCHASE]: {
        icon: 'arrowRight',
        tint: 'positive',
        content: roleSubscriptionContent,
    },
    // createPurchaseNotificationSystemMessage: only server products, drawn as a role subscription purchase.
    [MessageType.PURCHASE_NOTIFICATION]: {
        icon: 'arrowRight',
        tint: 'positive',
        content: (message, env) => {
            const purchase = message.purchase_notification
            const productName = purchase?.guild_product_purchase?.product_name
            if (purchase?.type !== GUILD_PRODUCT || !productName)
                return undefined
            return {
                key: 'chat.system.productPurchase',
                values: { ...authorValues(message, env), productName },
            }
        },
    },
    // createApplicationSubscriptionPurchaseSystemMessage.
    [MessageType.GUILD_APPLICATION_PREMIUM_SUBSCRIPTION]: {
        icon: 'ticket',
        tint: 'normal',
        content: (message, env) =>
            message.application
                ? {
                      key: 'chat.system.appPremium',
                      values: {
                          ...authorValues(message, env),
                          applicationName: message.application.name,
                      },
                  }
                : {
                      key: 'chat.system.appPremiumDeleted',
                      values: authorValues(message, env),
                  },
    },
    [MessageType.PRIVATE_CHANNEL_INTEGRATION_ADDED]: {
        icon: 'arrowRight',
        tint: 'positive',
        content: integration(
            'chat.system.integrationAdded',
            'chat.system.integrationAddedDeleted',
        ),
    },
    [MessageType.PRIVATE_CHANNEL_INTEGRATION_REMOVED]: {
        icon: 'arrowLeft',
        tint: 'danger',
        content: integration(
            'chat.system.integrationRemoved',
            'chat.system.integrationRemovedDeleted',
        ),
    },
}
