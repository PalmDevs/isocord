import { Emoji } from '../../design/components/Emoji'
import type { EmojiProps } from '../../design/components/Emoji'
import type { Presence } from '../../stores/presences'

const EMOJI_SIZE = 20

/** A custom status emoji: a server emoji from the CDN, or the Twemoji art of a Unicode one. */
export function StatusEmoji({
    emoji,
    size = EMOJI_SIZE,
    ...props
}: Omit<EmojiProps, 'emoji'> & {
    emoji: NonNullable<Presence['customEmoji']>
}) {
    return <Emoji emoji={emoji} size={size} {...props} />
}

export { Emoji }
export type { EmojiProps }
