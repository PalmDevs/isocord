import { isImageFile, isVideoFile } from '../../../core/discord/mediaFormats'
import { MessageFlag, MessageType } from '../../../core/discord/messages'
import { t } from '../../../i18n'
import type { Message } from '../../../stores/readStates'
import type { Span } from './rows'

/** ChannelRowPreview's PreviewIcon names. */
export type PreviewIcon =
    | 'image'
    | 'video'
    | 'audio'
    | 'attachment'
    | 'link'
    | 'sticker'
    | 'call-active'
    | 'call-ended'

export interface MessagePreview {
    spans: Span[]
    trailingIcon?: PreviewIcon
}

// MediaFormatTesters.isAudioFile, Android variant.
const AUDIO = /\.(mp3|wav|ogg|oga|opus|flac|m4a|aac)$/i
const isAudioFile = (name: string) => AUDIO.test(name)

const plain = (text: string): Span[] => [{ text }]

/** "{count} image(s)" and the like: the reference's plural messages, one key per form. */
function counted(
    count: number,
    one: Parameters<typeof t>[0],
    many: Parameters<typeof t>[0],
): Span[] {
    return plain(t(count === 1 ? one : many, { count }))
}

/** The icon and label of a list of media, by what all of them are (attachments by file name, embeds by url). */
function mediaPreview(
    names: string[],
    others: 'attachment' | 'link',
): MessagePreview {
    const count = names.length
    if (names.every(isImageFile))
        return {
            spans: counted(
                count,
                'messages.preview.image',
                'messages.preview.images',
            ),
            trailingIcon: 'image',
        }
    if (names.every(isVideoFile))
        return {
            spans: counted(
                count,
                'messages.preview.video',
                'messages.preview.videos',
            ),
            trailingIcon: 'video',
        }
    if (names.every(isAudioFile))
        return {
            spans: counted(
                count,
                'messages.preview.audio',
                'messages.preview.audios',
            ),
            trailingIcon: 'audio',
        }
    return others === 'attachment'
        ? {
              spans: counted(
                  count,
                  'messages.preview.file',
                  'messages.preview.files',
              ),
              trailingIcon: 'attachment',
          }
        : {
              spans: counted(
                  count,
                  'messages.preview.link',
                  'messages.preview.links',
              ),
              trailingIcon: 'link',
          }
}

/** The CALL line (formatMessagePreview): ongoing, missed or ended, with a phone icon. */
function callPreview(
    message: Message,
    selfId: string | undefined,
): MessagePreview {
    const call = (
        message as {
            call?: { participants?: string[]; ended_timestamp?: string | null }
        }
    ).call
    const active = !!call && !call.ended_timestamp
    const missed = !active && !!selfId && !call?.participants?.includes(selfId)
    return {
        spans: plain(
            t(
                active
                    ? 'messages.preview.callOngoing'
                    : missed
                      ? 'messages.preview.callMissed'
                      : 'messages.preview.callEnded',
            ),
        ),
        trailingIcon: active ? 'call-active' : 'call-ended',
    }
}

/**
 * formatMessagePreview (useFormattedMessagePreview): what a chat message reads as in one line, and the icon after
 * it. `spansOf` parses markup (its content, an embed's title) into spans. Undefined when it has nothing to show.
 */
export function messagePreview(
    message: Message,
    spansOf: (markup: string) => Span[],
    selfId?: string,
): MessagePreview | undefined {
    if (message.type === MessageType.CALL) return callPreview(message, selfId)
    const content = (message.content ?? '').trim()
    const embeds = message.embeds ?? []
    // A lone embed of the message's own link reads as its title.
    const lone = embeds.length === 1 ? embeds[0] : undefined
    const attachments = message.attachments ?? []
    const media = attachments.length
        ? mediaPreview(
              attachments.map(attachment => attachment.filename),
              'attachment',
          )
        : undefined
    // Departs from the reference, which drops the icon once there is text: text with attachments keeps theirs.
    if (lone?.title && lone.url === message.content)
        return { spans: spansOf(lone.title), trailingIcon: media?.trailingIcon }
    if (content)
        return { spans: spansOf(content), trailingIcon: media?.trailingIcon }
    if ((message.flags ?? 0) & MessageFlag.IS_VOICE_MESSAGE)
        return { spans: plain(t('messages.preview.voiceMessage')) }
    if (media) return media
    if (embeds.length) {
        const linked = mediaPreview(
            embeds.map(embed => embed.url ?? ''),
            'link',
        )
        if (linked.trailingIcon !== 'link') return linked
        const markup = embeds[0]?.title ?? embeds[0]?.description
        return markup ? { spans: spansOf(markup) } : linked
    }
    const sticker = message.sticker_items?.[0]
    if (sticker) return { spans: plain(sticker.name), trailingIcon: 'sticker' }
    if (message.poll)
        return {
            spans: plain(
                t('messages.preview.poll', {
                    question: message.poll.question.text ?? '',
                }),
            ),
        }
    if (
        (message as { message_snapshots?: unknown[] }).message_snapshots?.length
    )
        return { spans: plain(t('messages.preview.forwarded')) }
    return undefined
}
