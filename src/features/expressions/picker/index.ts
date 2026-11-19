import { accountsStore, currentAccount } from '../../../core/accounts'
import { sessionFor } from '../../../core/react'
import { registerComposerSlots } from '../../chat/composer'
import {
    getEmojiUnavailableReason,
    getExpressionContext,
    getUnicodeEmojiByName,
    getUnicodeEmojis,
    listEmojis,
} from '../index'
import { ExpressionButton } from './ExpressionButton'
import { ExpressionPicker } from './ExpressionPicker'
import type { SearchEmoji } from '../index'

export {
    EmojiGrid,
    SkinToneSelector,
    TonePickerButton,
} from './EmojiGrid'
export { ExpressionPicker } from './ExpressionPicker'
export { StickerGrid } from './StickerGrid'
export type { EmojiGridProps } from './EmojiGrid'

/**
 * Fills the composer's `expression` panel (the keyboard area's picker), the button that opens it and the
 * `resolveEmoji` slot. Imported once by the app's features list.
 */
registerComposerSlots({
    panels: {
        expression: { placement: 'keyboard', Component: ExpressionPicker },
    },
    // First on the input's right, before the slowmode and send button.
    actionButtons: {
        expression: { side: 'end', order: 0, Component: ExpressionButton },
    },
    // A typed `:name:` or `:name~N:` becomes the custom emoji with that disambiguated name (EmojiDisambiguations,
    // the names the picker and suggestions insert). A plain `:name:` whose emoji can't be used here falls back
    // to the first usable one with that real name (the current server's first).
    // A typed `:sob:` becomes 😭 once its closing colon is typed.
    unicodeEmoji: name => getUnicodeEmojiByName(name)?.surrogates,
    resolveEmoji(channel, name) {
        const account = currentAccount(accountsStore.getState())
        const session = sessionFor(account?.id, account?.token)
        if (!session || getUnicodeEmojis()?.byName.has(name)) return undefined
        const context = getExpressionContext(session, channel?.id)
        let fallback: CustomSearchEmoji | undefined
        for (const emoji of listEmojis(context)) {
            if (emoji.type !== 'custom') continue
            const exact = emoji.name === name
            if (!exact && (fallback || emoji.originalName !== name)) continue
            if (getEmojiUnavailableReason(emoji, context) !== null) continue
            if (exact) return resolved(emoji)
            fallback = emoji
        }
        return fallback && resolved(fallback)
    },
})

type CustomSearchEmoji = Extract<SearchEmoji, { type: 'custom' }>

/** What a resolved emoji is sent as: `<:name:id>` with its real name. */
const resolved = (emoji: CustomSearchEmoji) => ({
    id: emoji.id,
    name: emoji.originalName ?? emoji.name,
    animated: emoji.animated,
})
