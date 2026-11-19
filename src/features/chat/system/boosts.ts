import { MessageType } from '../../../core/discord/messages'
import { t } from '../../../i18n'
import { authorValues } from './types'
import type { MessageKey } from '../../../i18n'
import type { Message } from '../../../stores/readStates'
import type {
    SystemContent,
    SystemEnv,
    SystemHandler,
    SystemHandlers,
} from './types'

/** GuildBoostingUtils.getTierName for the tiers a boost can reach. */
const TIER_NAMES: Record<number, MessageKey> = {
    [MessageType.GUILD_BOOST_TIER_1]: 'chat.system.boostLevel.1',
    [MessageType.GUILD_BOOST_TIER_2]: 'chat.system.boostLevel.2',
    [MessageType.GUILD_BOOST_TIER_3]: 'chat.system.boostLevel.3',
}

/** getNumSubscriptionsPurchasedFromSystemMessage: the content holds the count, 1 when absent or zero. */
const boostCount = (message: Message) => Number(message.content) || 1

/** createUserPremiumGuildSubscriptionSystemMessage. */
function boostContent(message: Message, env: SystemEnv): SystemContent {
    const count = boostCount(message)
    return count > 1
        ? {
              key: 'chat.system.boostMany',
              values: {
                  ...authorValues(message, env),
                  numSubscriptions: count,
              },
          }
        : { key: 'chat.system.boost', values: authorValues(message, env) }
}

/** createUserPremiumGuildSubscriptionTierAchievedSystemMessage: a plain boost without the server. */
function tierContent(message: Message, env: SystemEnv): SystemContent {
    const tier = TIER_NAMES[message.type ?? MessageType.DEFAULT]
    if (!env.guild || !tier) return boostContent(message, env)
    const count = boostCount(message)
    const values = {
        ...authorValues(message, env),
        guildName: env.guild.name,
        newTierName: t(tier),
    }
    return count > 1
        ? {
              key: 'chat.system.boostTierMany',
              values: { ...values, numSubscriptions: count },
          }
        : { key: 'chat.system.boostTier', values }
}

const boost: SystemHandler = {
    icon: 'boost',
    tint: 'boost',
    content: boostContent,
}
const tier: SystemHandler = { ...boost, content: tierContent }

/** Server boosts, and the boosts that reach a new level. */
export const boostHandlers: SystemHandlers = {
    [MessageType.GUILD_BOOST]: boost,
    [MessageType.GUILD_BOOST_TIER_1]: tier,
    [MessageType.GUILD_BOOST_TIER_2]: tier,
    [MessageType.GUILD_BOOST_TIER_3]: tier,
}
