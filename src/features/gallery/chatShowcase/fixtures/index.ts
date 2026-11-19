import { compareSnowflakes } from '../../../../core/discord/snowflake'
import { componentMessages } from './components'
import { embedMessages } from './embeds'
import { expressionMessages } from './expression'
import { mediaMessages } from './media'
import { pollMessages } from './polls'
import { replyMessages } from './replies'
import { systemMessages } from './system'
import { textMessages } from './text'
import { threadMessages } from './threads'

/**
 * Every sample message, oldest first. To show a new feature, add a sample to the file of its domain (or a new
 * file, spread in here). The list sorts itself, so a file never needs to know where it sits.
 */
export const showcaseMessages = [
    ...textMessages,
    ...mediaMessages,
    ...embedMessages,
    ...expressionMessages,
    ...replyMessages,
    ...systemMessages,
    ...componentMessages,
    ...pollMessages,
    ...threadMessages,
].sort((left, right) => compareSnowflakes(left.id, right.id))

/** The NEW divider sits before the first message of the components domain. */
export const showcaseAckedId = componentMessages[0]
    ? showcaseMessages[showcaseMessages.indexOf(componentMessages[0]) - 1]?.id
    : undefined

export * from './world'
