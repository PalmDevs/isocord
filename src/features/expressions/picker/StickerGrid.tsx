import { useDeferredValue, useEffect, useMemo } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StyleSheet } from 'react-native-unistyles'
import { StickerAnimation } from '../../../core/discord/expressionTypes'
import { useSession, useSessionStore } from '../../../core/react'
import { Text } from '../../../design/components/Text'
import { t } from '../../../i18n'
import { expressionGrid } from '../../../native/NativeIsocordConstants'
import { expressionsStore } from '../../../stores/expressions'
import { settingsStore } from '../../../stores/settings/settingsStore'
import { stickerPacksStore } from '../../../stores/stickerPacks'
import {
    ensureStickerPacks,
    getExpressionContext,
    getFavoriteStickerIds,
    getFrequentStickerIds,
    getStickerSendability,
    StickerFormat,
    StickerSendability,
    searchStickers,
} from '../index'
import { ExpressionGrid } from './ExpressionGrid'
import { stickerUrl } from './emojiImage'
import { openStickerInfo } from './stickerInfoSheet'
import type { Sticker } from '../index'
import type { RailSection } from './CategoryRail'
import type { GridSection } from './ExpressionGrid'

export interface StickerGridProps {
    channelId: string
    query?: string
    /** Called with a sendable sticker when it is tapped. */
    onSelect: (sticker: Sticker, flightId: string) => void
    /** Called when a sticker the user cannot send (needs Nitro or a boost) is tapped. */
    onSelectLocked?: (sticker: Sticker) => void
}

/**
 * Favorites, frequently used, each server's stickers and the standard packs, or the search results. Holding a
 * sticker opens its info sheet (showStickerDetailActionSheet).
 */
export function StickerGrid({
    channelId,
    query: liveQuery = '',
    onSelect,
    onSelectLocked,
}: StickerGridProps) {
    const session = useSession()
    const query = useDeferredValue(liveQuery)
    const { bottom } = useSafeAreaInsets()
    const expressions = useSessionStore(expressionsStore, state => state.guilds)
    const packs = useSessionStore(stickerPacksStore, state => state.packs)
    // StickerPickerListRow: shouldAnimateSticker with the user's AnimateStickers setting. On interaction only
    // animates the focused sticker there; here it stays still.
    const animate =
        (useSessionStore(
            settingsStore,
            state => state.textAndImages.animateStickers,
        ) ?? StickerAnimation.ALWAYS_ANIMATE) ===
        StickerAnimation.ALWAYS_ANIMATE

    useEffect(() => {
        ensureStickerPacks(session).catch(() => {})
    }, [session])

    // An explicit memo: the store values are only rebuild triggers, which the compiler would not see.
    const { rail, json, byKey } = useMemo(() => {
        void expressions
        void packs
        const context = getExpressionContext(session, channelId)
        const sendable = (sticker: Sticker) =>
            getStickerSendability(sticker, context, { packKnown: true }) ===
            StickerSendability.SENDABLE
        const groups: (RailSection & { stickers: Sticker[] })[] = []
        const q = query.trim()
        if (q) {
            const stickers = searchStickers(q, context, { show: 'all' })
                .sort((a, b) => b.sendability - a.sendability)
                .map(result => result.sticker)
            groups.push({ key: 'search', title: '', stickers })
        } else {
            const byId = new Map<string, Sticker>()
            for (const guild of context.guilds)
                for (const sticker of guild.stickers)
                    byId.set(sticker.id, sticker)
            for (const sticker of context.standardStickers ?? [])
                byId.set(sticker.id, sticker)
            const pick = (ids: string[]) =>
                ids.flatMap(id => {
                    const sticker = byId.get(id)
                    return sticker ? [sticker] : []
                })
            groups.push({
                key: 'favorites',
                title: t('expressions.favorites'),
                railIcon: 'StarIcon',
                stickers: pick(getFavoriteStickerIds(session)),
            })
            groups.push({
                key: 'frequent',
                title: t('expressions.frequent'),
                railIcon: 'ClockIcon',
                stickers: pick(getFrequentStickerIds(session)).filter(sendable),
            })
            for (const guild of context.guilds)
                groups.push({
                    key: `guild:${guild.id}`,
                    title: guild.name,
                    guildId: guild.id,
                    stickers: guild.stickers,
                })
            for (const pack of packs)
                groups.push({
                    key: `pack:${pack.id}`,
                    title: pack.name,
                    railImage: pack.stickers[0]
                        ? stickerUrl(pack.stickers[0], 48)
                        : undefined,
                    stickers: pack.stickers,
                })
        }
        // Only sections with stickers; the rail has one entry per section, in the same order.
        const shown = groups.filter(group => group.stickers.length > 0)
        const byKey = new Map<string, { sticker: Sticker; locked: boolean }>()
        const grid: GridSection[] = shown.map(group => ({
            key: group.key,
            title: group.title,
            items: group.stickers.map(sticker => {
                const locked = !sendable(sticker)
                byKey.set(sticker.id, { sticker, locked })
                const moving =
                    animate &&
                    (sticker.format_type === StickerFormat.APNG ||
                        sticker.format_type === StickerFormat.GIF)
                return [
                    sticker.id,
                    stickerUrl(sticker),
                    (moving ? expressionGrid.itemAnimated : 0) |
                        (locked ? expressionGrid.itemLocked : 0),
                    sticker.name,
                ]
            }),
        }))
        return {
            rail: q ? undefined : shown,
            json: JSON.stringify(grid),
            byKey,
        }
    }, [session, channelId, query, expressions, packs, animate])

    return (
        <ExpressionGrid
            kind={expressionGrid.kindSticker}
            sections={json}
            rail={rail}
            animate={animate}
            // The rail keeps clear of the system bar itself.
            bottomPadding={rail?.length ? 0 : bottom}
            empty={
                byKey.size === 0 ? (
                    <View style={styles.empty}>
                        <Text color="TEXT_MUTED">
                            {t('expressions.noResults')}
                        </Text>
                    </View>
                ) : undefined
            }
            onPressItem={(key, flightId) => {
                const hit = byKey.get(key)
                if (!hit) return
                if (hit.locked) onSelectLocked?.(hit.sticker)
                else onSelect(hit.sticker, flightId)
            }}
            onLongPressItem={key => {
                const hit = byKey.get(key)
                if (hit) openStickerInfo(hit.sticker)
            }}
        />
    )
}

const styles = StyleSheet.create({
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
