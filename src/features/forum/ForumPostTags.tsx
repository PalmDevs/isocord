import { Image } from 'expo-image'
import { StyleSheet } from 'react-native-unistyles'
import { TagGroup } from '../../design/components/TagGroup'
import { tagEmojiUrl } from './tagEmojiUrl'
import type { ForumTag } from '../../core/discord/forum'

const TAG_EMOJI_SIZE = 14

/** AppliedForumTag's emoji. */
export function TagEmoji({ tag }: { tag: ForumTag }) {
    const source = tagEmojiUrl(tag)
    return source ? <Image source={source} style={styles.emoji} /> : null
}

/** ForumPostAppliedTags: the tags of a post, each with its emoji. */
export function ForumPostTags({ tags }: { tags: ForumTag[] }) {
    return (
        <TagGroup
            size="xs"
            items={tags.map(tag => ({
                id: tag.id,
                label: tag.name,
                icon: <TagEmoji tag={tag} />,
            }))}
        />
    )
}

const styles = StyleSheet.create({
    emoji: { width: TAG_EMOJI_SIZE, height: TAG_EMOJI_SIZE },
})
