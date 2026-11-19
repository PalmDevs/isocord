import { Image } from 'expo-image'
import { StyleSheet } from 'react-native-unistyles'
import { emojiUrl } from '../../core/discord/cdn'
import { twemojiUrl } from '../chat/emoji'
import type { Presence } from '../../stores/presences'

/** EMOJI_URL_BASE_SIZE: the CDN size of a custom emoji. */
const EMOJI_CDN_SIZE = 48
/** The emoji beside status text (EditCustomStatusWithPreview's emoji size). */
const EMOJI_SIZE = 20

/** A custom status emoji: a server emoji from the CDN, or the Twemoji art of a Unicode one. */
export function StatusEmoji({
    emoji,
    size = EMOJI_SIZE,
}: {
    emoji: NonNullable<Presence['customEmoji']>
    size?: number
}) {
    return (
        <Image
            source={
                emoji.id
                    ? emojiUrl(emoji.id, emoji.animated, EMOJI_CDN_SIZE)
                    : twemojiUrl(emoji.name)
            }
            accessibilityLabel={emoji.name}
            style={styles.emoji(size)}
        />
    )
}

const styles = StyleSheet.create({
    emoji: (size: number) => ({ width: size, height: size }),
})
