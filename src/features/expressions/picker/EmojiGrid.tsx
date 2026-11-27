import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../../core/react'
import { ToggleIconButton } from '../../../design/components/buttons/IconButton'
import { RipplePressable } from '../../../design/components/buttons/RipplePressable'
import { Emoji } from '../../../design/components/Emoji'
import { Text } from '../../../design/components/Text'
import { t } from '../../../i18n'
import { expressionGrid } from '../../../native/IsocordConstants'
import { channelsStore } from '../../../stores/channels/channels'
import { expressionsStore } from '../../../stores/expressions'
import { guildsStore } from '../../../stores/guilds'
import { settingsStore } from '../../../stores/settings/settingsStore'
import { openEmojiInfo } from '../../chat/sheets/emojiInfoSheet'
import {
    applySkinTone,
    getEmojiUnavailableReason,
    getExpressionContext,
    getFavoriteEmojiKeys,
    getFrequentEmojis,
    getUnicodeEmojis,
    listEmojis,
    loadUnicodeEmojis,
    SKIN_TONE_SURROGATES,
    searchEmojis,
} from '../index'
import { ExpressionGrid } from './ExpressionGrid'
import { emojiImageUrl, twemojiUrl } from './emojiImage'
import { useSkinTone } from './useSkinTone'
import type { MessageKey } from '../../../i18n'
import type { Guild } from '../../../stores/guilds'
import type {
    ExpressionContext,
    SearchEmoji,
    UnicodeEmoji,
    UnicodeEmojiData,
} from '../index'
import type { RailSection } from './CategoryRail'
import type { GridItem, GridSection } from './ExpressionGrid'

interface Section extends RailSection {
    emojis: SearchEmoji[]
}

/** What the grid depends on in the servers: names, the user's roles and how many roles there are. */
function guildsKeyOf(state: { guilds: Record<string, Guild> }): string {
    let key = ''
    for (const id in state.guilds) {
        const guild = state.guilds[id]
        if (guild)
            key += `${id}:${guild.name}:${guild.myRoles.join(',')}:${Object.keys(guild.roles).length};`
    }
    return key
}

const keyOf = (emoji: SearchEmoji) =>
    emoji.type === 'custom' ? emoji.id : emoji.uniqueName

export interface EmojiGridProps {
    /** Channel whose permissions decide which emojis are locked; omitted, emojis of other servers count as external. */
    channelId?: string | null
    /** Search text; empty shows the sections. */
    query?: string
    /** Called with the emoji (the skin toned variant when one was chosen) when an unlocked emoji is tapped. */
    onSelect: (emoji: SearchEmoji) => void
    /** Called when a locked emoji is tapped. */
    onSelectLocked?: (emoji: SearchEmoji) => void
}

/**
 * The emoji grid: Favorites, Frequently Used, each server's emojis, then the Unicode categories, or the search
 * results. Reusable (reactions sheet): it only reports taps through `onSelect`. Holding an emoji opens its
 * info sheet (the reference's openEmojiActionSheet).
 */
export function EmojiGrid({
    channelId,
    query: liveQuery = '',
    onSelect,
    onSelectLocked,
}: EmojiGridProps) {
    const session = useSession()
    // Typing stays responsive: the grid follows the text a render behind.
    const query = useDeferredValue(liveQuery)
    const [unicodeReady, setUnicodeReady] = useState(
        getUnicodeEmojis() !== undefined,
    )

    const settings = useSessionStore(
        settingsStore,
        state => state.textAndImages,
    )
    const animate = settings.animateEmoji ?? true
    const tone = useSkinTone(state =>
        state.tone === undefined
            ? settings.diversitySurrogate || null
            : state.tone,
    )
    // Rebuild when what the grid shows changes: the servers' names, the user's roles in them (which decide which
    // emojis are usable), their emojis and the user's Nitro. Not on every change of a guild (member counts, ...).
    const guildsKey = useSessionStore(guildsStore, guildsKeyOf)
    const emojis = useSessionStore(expressionsStore, state => state.guilds)
    const premiumType = useSessionStore(
        expressionsStore,
        state => state.premiumType,
    )
    const channelGuildId = useSessionStore(channelsStore, state =>
        channelId ? state.channels[channelId]?.guild_id : undefined,
    )

    useEffect(() => {
        if (unicodeReady) return
        loadUnicodeEmojis().then(() => setUnicodeReady(true))
    }, [unicodeReady])

    // An explicit memo: the store values below are only rebuild triggers, which the compiler would not see.
    const { sections, json, byKey } = useMemo(() => {
        const byKey = new Map<string, { emoji: SearchEmoji; locked: boolean }>()
        // The grid is drawn once, with the Unicode emojis in it, not first without them.
        if (!unicodeReady)
            return { sections: [] as Section[], json: '[]', byKey }
        void guildsKey
        void emojis
        void premiumType
        void channelGuildId
        const context: ExpressionContext = {
            ...getExpressionContext(session, channelId),
            skinTone: tone,
        }
        const sections = buildSections(session, context, query, tone)
        const grid: GridSection[] = sections.map(section => ({
            key: section.key,
            title: section.title,
            items: gridItems(section, context, animate, byKey),
        }))
        return { sections, json: JSON.stringify(grid), byKey }
    }, [
        session,
        channelId,
        query,
        tone,
        animate,
        guildsKey,
        emojis,
        premiumType,
        channelGuildId,
        unicodeReady,
    ])

    const searching = query.trim() !== ''
    return (
        <ExpressionGrid
            kind={expressionGrid.kindEmoji}
            sections={json}
            rail={searching ? undefined : sections}
            animate={animate}
            empty={
                sections.length === 0 ? (
                    <View style={styles.empty}>
                        {unicodeReady && (
                            <Text color="TEXT_MUTED">
                                {t('expressions.noResults')}
                            </Text>
                        )}
                    </View>
                ) : undefined
            }
            onPressItem={key => {
                const hit = byKey.get(key)
                if (!hit) return
                if (hit.locked) onSelectLocked?.(hit.emoji)
                else onSelect(hit.emoji)
            }}
            onLongPressItem={key => {
                const emoji = byKey.get(key)?.emoji
                if (!emoji) return
                void openEmojiInfo(
                    emoji.type === 'custom'
                        ? {
                              kind: 'custom',
                              id: emoji.id,
                              name: emoji.originalName ?? emoji.name,
                              animated: !!emoji.animated,
                          }
                        : { kind: 'unicode', text: emoji.surrogates },
                )
            }}
        />
    )
}

/** The Unicode sections' items, built once per section (they are cached per skin tone and never locked). */
const unicodeItems = new WeakMap<Section, GridItem[]>()

/** A section's grid items; fills `byKey` with what each key is and whether it is locked. */
function gridItems(
    section: Section,
    context: ExpressionContext,
    animate: boolean,
    byKey: Map<string, { emoji: SearchEmoji; locked: boolean }>,
): GridItem[] {
    const cached = unicodeItems.get(section)
    if (cached) {
        section.emojis.forEach((emoji, index) =>
            byKey.set(cached[index]?.[0] ?? '', { emoji, locked: false }),
        )
        return cached
    }
    const items = section.emojis.map((emoji): GridItem => {
        const key = keyOf(emoji)
        const locked = getEmojiUnavailableReason(emoji, context) !== null
        byKey.set(key, { emoji, locked })
        const moving = emoji.type === 'custom' && emoji.animated && animate
        return [
            key,
            emojiImageUrl(emoji, animate),
            (moving ? expressionGrid.itemAnimated : 0) |
                (locked ? expressionGrid.itemLocked : 0),
            // The emoji's name, as EmojiPickerViewHolder's contentDescription.
            emoji.type === 'custom'
                ? (emoji.originalName ?? emoji.name)
                : emoji.uniqueName,
        ]
    })
    if (section.key.startsWith('unicode:')) unicodeItems.set(section, items)
    return items
}

function buildSections(
    session: ReturnType<typeof useSession>,
    context: ExpressionContext,
    query: string,
    tone: string | null | undefined,
): Section[] {
    const q = query.trim()
    if (q !== '') {
        const { unlocked, locked } = searchEmojis(q, context)
        const emojis = [...unlocked, ...locked]
        return emojis.length ? [{ key: 'search', title: '', emojis }] : []
    }
    const sections: Section[] = []
    const all = listEmojis(context)
    const favoriteKeys = getFavoriteEmojiKeys(session)
    // Only built when there are favorites to look up.
    const byKey = favoriteKeys.length
        ? new Map(all.map(emoji => [keyOf(emoji), emoji]))
        : undefined

    const favorites = favoriteKeys.flatMap(key => {
        const emoji = byKey?.get(key)
        return emoji ? [emoji] : []
    })
    if (favorites.length)
        sections.push({
            key: 'favorites',
            title: t('expressions.favorites'),
            railIcon: 'StarIcon',
            emojis: favorites,
        })
    const frequent = getFrequentEmojis(session, context)
    if (frequent.length)
        sections.push({
            key: 'frequent',
            title: t('expressions.frequent'),
            railIcon: 'ClockIcon',
            emojis: frequent,
        })

    // One pass over the list rather than one per server.
    const byGuild = new Map<string, SearchEmoji[]>()
    for (const emoji of all) {
        if (emoji.type !== 'custom') continue
        const list = byGuild.get(emoji.guildId)
        if (list) list.push(emoji)
        else byGuild.set(emoji.guildId, [emoji])
    }
    for (const guild of context.guilds) {
        const emojis = byGuild.get(guild.id)
        if (emojis?.length)
            sections.push({
                key: `guild:${guild.id}`,
                title: guild.name,
                guildId: guild.id,
                emojis,
            })
    }
    if (context.unicode)
        sections.push(...unicodeSections(context.unicode, tone))
    return sections
}

let unicodeCache:
    | { data: UnicodeEmojiData; tones: Map<string, Section[]> }
    | undefined

/** The Unicode categories as sections, built once per skin tone: they do not depend on anything else. */
function unicodeSections(
    data: UnicodeEmojiData,
    tone: string | null | undefined,
): Section[] {
    if (unicodeCache?.data !== data) unicodeCache = { data, tones: new Map() }
    const key = tone ?? ''
    let sections = unicodeCache.tones.get(key)
    if (!sections) {
        sections = data.categories.map(category => ({
            key: `unicode:${category.name}`,
            title: t(`expressions.category.${category.name}` as MessageKey),
            railEmoji: category.emojis[0]?.surrogates,
            emojis: category.emojis.map(
                emoji =>
                    applySkinTone(emoji, tone) as UnicodeEmoji as SearchEmoji,
            ),
        }))
        unicodeCache.tones.set(key, sections)
    }
    return sections
}

/** The skin tone selector: the default and the five tones, as a row of buttons. */
export function SkinToneSelector({ onDone }: { onDone?: () => void }) {
    const tone = useSkinTone(state => state.tone)
    const settingsTone = useSessionStore(
        settingsStore,
        state => state.textAndImages.diversitySurrogate,
    )
    const current = tone === undefined ? settingsTone || null : tone
    const options: (string | null)[] = [null, ...SKIN_TONE_SURROGATES]
    const hand = twemojiUrl('\u{1F44B}')
    return (
        <View
            style={styles.tones}
            accessibilityLabel={t('expressions.skinTone')}
        >
            {options.map(option => {
                const url = option ? twemojiUrl(`\u{1F44B}${option}`) : hand
                return (
                    <RipplePressable
                        key={option ?? 'none'}
                        style={[
                            styles.tone,
                            option === current && styles.railActive,
                        ]}
                        onPress={() => {
                            useSkinTone.setState({ tone: option })
                            onDone?.()
                        }}
                    >
                        <Emoji source={url} style={styles.railEmoji} />
                    </RipplePressable>
                )
            })}
        </View>
    )
}

/**
 * The skin tone toggle: a waving hand in the chosen tone, on while the selector is open. The reference shows the
 * saved tone (EmojiStore.diversitySurrogate, written by EmojiActionCreators.setDiversityColor); with no settings
 * writer yet, the picker's own choice (useSkinTone) stands in for it, as in SkinToneSelector.
 */
export function TonePickerButton({
    pressed,
    onPress,
}: {
    pressed: boolean
    onPress: () => void
}) {
    const chosen = useSkinTone(state => state.tone)
    const settingsTone = useSessionStore(
        settingsStore,
        state => state.textAndImages.diversitySurrogate,
    )
    const tone = chosen === undefined ? settingsTone || null : chosen

    return (
        <ToggleIconButton
            pressed={pressed}
            onPress={onPress}
            accessibilityLabel={t('expressions.skinTone')}
            icon={
                <Emoji
                    emoji={`\u{1F44B}${tone ?? ''}`}
                    style={styles.toneImage}
                />
            }
        />
    )
}

const styles = StyleSheet.create(theme => ({
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    railActive: { backgroundColor: theme.colors.BACKGROUND_MOD_NORMAL },
    railEmoji: { width: 22, height: 22 },
    toneImage: { width: 24, height: 24 },
    tones: {
        flexDirection: 'row',
        paddingHorizontal: theme.space.PX_12,
        gap: theme.space.PX_4,
        paddingBottom: theme.space.PX_4,
    },
    tone: {
        width: 36,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
}))
