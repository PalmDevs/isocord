import { Image } from 'expo-image'
import { StyleSheet } from 'react-native-unistyles'
import { emojiUrl } from '../../core/discord/cdn'
import { twemojiUrl } from '../../core/discord/twemoji'
import type { ImageProps, ImageStyle } from 'expo-image'
import type { StyleProp } from 'react-native'

const DEFAULT_CDN_SIZE = 48

const isUrlOrAsset = (value: string) =>
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('file://') ||
    value.startsWith('asset:/') ||
    value.startsWith('data:')

export interface EmojiData {
    id?: string | null
    name?: string | null
    animated?: boolean
}

export interface EmojiProps extends Omit<ImageProps, 'source'> {
    /** Emoji data object, raw image URL string, or Unicode emoji character. */
    emoji?: EmojiData | string | null
    /** Direct image source. Used when given, or as a fallback. */
    source?: ImageProps['source']
    /** Size in dp for width and height. */
    size?: number
    /** Size to request from Discord CDN for custom emojis. Default is 48. */
    cdnSize?: number
    /** Image style. */
    style?: StyleProp<ImageStyle>
}

/** Resolves the image source from an emoji object, URL string, or Unicode character. */
function resolveSource(
    emoji?: EmojiData | string | null,
    source?: ImageProps['source'],
    cdnSize = DEFAULT_CDN_SIZE,
): ImageProps['source'] | undefined {
    if (source) return source
    if (!emoji) return undefined
    if (typeof emoji === 'string') {
        return isUrlOrAsset(emoji) ? emoji : twemojiUrl(emoji)
    }
    if (emoji.id) {
        return emojiUrl(emoji.id, emoji.animated, cdnSize)
    }
    if (emoji.name) {
        return isUrlOrAsset(emoji.name) ? emoji.name : twemojiUrl(emoji.name)
    }
    return undefined
}

/**
 * Renders an emoji image scaled to fit within its bounds without cropping.
 * Supports custom server emojis, Twemoji Unicode assets, and raw image URLs.
 */
export function Emoji({
    emoji,
    source,
    size,
    cdnSize = DEFAULT_CDN_SIZE,
    contentFit = 'contain',
    style,
    accessibilityLabel,
    ...props
}: EmojiProps) {
    const resolved = resolveSource(emoji, source, cdnSize)
    if (!resolved) return null

    const label =
        accessibilityLabel ??
        (typeof emoji === 'object' && emoji?.name
            ? emoji.name
            : typeof emoji === 'string' && !isUrlOrAsset(emoji)
              ? emoji
              : undefined)

    return (
        <Image
            source={resolved}
            contentFit={contentFit}
            accessibilityLabel={label}
            style={[size !== undefined ? styles.emoji(size) : null, style]}
            {...props}
        />
    )
}

const styles = StyleSheet.create({
    emoji: (size: number) => ({ width: size, height: size }),
})
