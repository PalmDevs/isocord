import { MessageType } from '../../../core/discord/messages'
import { authorValues } from './types'
import type { MessageKey } from '../../../i18n'
import type { SystemIcon, SystemTint } from '../rows/rows'
import type { SystemHandler, SystemHandlers } from './types'

/** A Stage message: the author, and the topic the content holds. */
const stage = (
    key: MessageKey,
    icon: SystemIcon,
    tint: SystemTint = 'normal',
): SystemHandler => ({
    icon,
    tint,
    content: (message, env) => ({
        key,
        values: { ...authorValues(message, env), topic: message.content ?? '' },
    }),
})

/** Stage events. The request to speak has no "Invite to Speak" button: that is a write. */
export const stageHandlers: SystemHandlers = {
    // createStageStartSystemMessage.
    [MessageType.STAGE_START]: stage(
        'chat.system.stage.start',
        'stage',
        'positive',
    ),
    // createStageEndSystemMessage.
    [MessageType.STAGE_END]: stage('chat.system.stage.end', 'stage'),
    // createStageTopicSystemMessage.
    [MessageType.STAGE_TOPIC]: stage('chat.system.stage.topic', 'stage'),
    // createStageSpeakerSystemMessage.
    [MessageType.STAGE_SPEAKER]: stage(
        'chat.system.stage.speaker',
        'microphoneArrowRight',
    ),
    // createStageRaiseHandSystemMessage.
    [MessageType.STAGE_RAISE_HAND]: stage(
        'chat.system.stage.raiseHand',
        'handRequestSpeak',
    ),
}
