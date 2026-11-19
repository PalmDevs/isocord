import { emojiUrl } from '../../core/discord/cdn'
import { twemojiUrl } from '../chat/emoji'
import type { ForumTag } from '../../core/discord/forum'

/** Custom emoji are requested at a power of two above their size at 3x density. */
export const TAG_EMOJI_CDN_SIZE = 64

/** Returns a tag's emoji image: a custom one from the CDN, else the Unicode one as Twemoji. */
export const tagEmojiUrl = (tag: ForumTag) =>
    tag.emoji_id
        ? emojiUrl(tag.emoji_id, false, TAG_EMOJI_CDN_SIZE)
        : tag.emoji_name
          ? twemojiUrl(tag.emoji_name)
          : undefined
