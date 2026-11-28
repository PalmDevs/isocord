import { useEffect, useState } from 'react'
import { PixelRatio, ScrollView } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { streamOwnerId } from '../../../../core/discord/streams'
import { useSession, useSessionStore } from '../../../../core/react'
import { requestMembers } from '../../../../stores/members'
import {
    channelVoiceStates,
    voiceStatesStore,
} from '../../../../stores/voiceStates'
import { watchStream } from '../../streamActions'
import { streamsStore } from '../../streams'
import { GridCard } from './GridCard'
import { layoutCards } from './gridLayout'
import { ParticipantCard } from './ParticipantCard'
import {
    STREAM_ASPECT_RATIO,
    StreamCard,
    WatchedStreamCard,
} from './StreamCard'
import { useLeavingCards } from './useLeavingCards'
import { focusKey } from './usePanelFocus'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import type { VoiceState } from '../../../../stores/voiceStates'
import type { GridCardSpec } from './gridLayout'
import type { ShownCard } from './useLeavingCards'
import type { PanelFocus, Rect } from './usePanelFocus'

/** One scroll event a frame, to know when the grid reaches its top. */
const SCROLL_EVENT_THROTTLE = 16

/** A grid card: a participant, the stream we watch or own, or a stream we could watch. */
type GridItem =
    | { kind: 'camera'; voice: VoiceState }
    | { kind: 'stream'; userId: string; watched: boolean }

interface GridProps {
    guildId: string | null
    channelId: string
    width: number
    height: number
    focus: PanelFocus
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
}

/** Returns the grid's items: the stream we watch or own, the other streams, then a card per participant. */
function useGridItems(guildId: string | null, channelId: string): GridItem[] {
    const session = useSession()
    const states = useSessionStore(voiceStatesStore, state =>
        channelVoiceStates(state, channelId),
    )
    const watchedOwner = useSessionStore(streamsStore, state =>
        state.streamKey ? streamOwnerId(state.streamKey) : null,
    )
    const userIds = states.map(state => state.userId).join()
    // Voice states carry no names, so members the client has not loaded are asked for.
    useEffect(() => {
        if (guildId && userIds)
            requestMembers(session, guildId, userIds.split(','))
    }, [session, guildId, userIds])
    const streamers = states.filter(
        state =>
            state.selfStream &&
            state.userId !== session.userId &&
            state.userId !== watchedOwner,
    )
    return [
        ...(watchedOwner === null
            ? []
            : [
                  {
                      kind: 'stream' as const,
                      userId: watchedOwner,
                      watched: true,
                  },
              ]),
        ...streamers.map(state => ({
            kind: 'stream' as const,
            userId: state.userId,
            watched: false,
        })),
        ...states.map(voice => ({ kind: 'camera' as const, voice })),
    ]
}

const itemUserId = (item: GridItem) =>
    item.kind === 'camera' ? item.voice.userId : item.userId

/**
 * VoicePanelCardView: the panel's cards, laid out by VoicePanelCardLayoutManager in the `width` by `height` area.
 * The content is centered and shrinks to fit. Cameras and the watched stream open in `focus`.
 */
export function ParticipantGrid({
    guildId,
    channelId,
    width,
    height,
    focus,
    onScroll,
}: GridProps) {
    const { theme } = useUnistyles()
    const items = useGridItems(guildId, channelId)
    const specs: GridCardSpec[] = items.map(item => ({
        key: focusKey({ kind: item.kind, userId: itemUserId(item) }),
        kind: item.kind,
        // A stream's target dimensions: the watched video's shape, else the default square card.
        aspectRatio:
            item.kind === 'stream' && item.watched ? STREAM_ASPECT_RATIO : 1,
    }))
    const verticalPadding = theme.space.PX_8
    const innerHeight = Math.max(0, height - 2 * verticalPadding)
    const layout = layoutCards({
        cards: specs,
        gutter: theme.space.PX_12,
        width,
        height: innerHeight,
    })
    // VoicePanelCardView: content taller than the area shrinks to fit. Ours scales the frames, not the text.
    const scale = layout.height > innerHeight ? innerHeight / layout.height : 1
    // calculateContentCenterOffset and the cards' xOffset: centered.
    const left = Math.max(0, (width - layout.width * scale) / 2)
    const top = PixelRatio.roundToNearestPixel(
        verticalPadding + (innerHeight - layout.height * scale) / 2,
    )
    const cards: ShownCard<GridItem>[] = items.map((item, index) => {
        const key = specs[index]?.key ?? ''
        const frame = layout.frames[key] ?? { x: 0, y: 0, width: 0, height: 0 }
        return {
            key,
            item,
            frame: {
                x: frame.x * scale + left,
                y: frame.y * scale + top,
                width: frame.width * scale,
                height: frame.height * scale,
            },
            leaving: false,
        }
    })
    const { shown, remove } = useLeavingCards(cards)
    // Staying cards only: a video focused on a leaving one leaves with it.
    useFocusTiles(focus, cards, theme.space.PX_12)
    const watch = useWatchAndFocus(focus, items)
    // Cards of the first render are already there. Later ones join with VoicePanelCard's entrance.
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])
    return (
        <ScrollView
            contentContainerStyle={styles.content(height)}
            onScroll={onScroll}
            scrollEventThrottle={SCROLL_EVENT_THROTTLE}
        >
            {shown.map(card => (
                <GridCard
                    key={card.key}
                    frame={card.frame}
                    appears={mounted}
                    leaving={card.leaving}
                    onGone={() => remove(card.key)}
                >
                    <GridItemCard
                        item={card.item}
                        guildId={guildId}
                        width={card.frame.width}
                        height={card.frame.height}
                        focus={focus}
                        onWatch={() => watch(itemUserId(card.item))}
                    />
                </GridCard>
            ))}
        </ScrollView>
    )
}

/**
 * AnimatedStreamCard's press: watches the stream, then focuses it once its card has its new frame. Returns the
 * watch.
 */
function useWatchAndFocus(focus: PanelFocus, items: readonly GridItem[]) {
    const session = useSession()
    const [pending, setPending] = useState<string | null>(null)
    const watched =
        items.find(item => item.kind === 'stream' && item.watched) ?? null
    const watchedId = watched ? itemUserId(watched) : null
    const { open } = focus
    // After useFocusTiles: the tile's frame is current by now.
    useEffect(() => {
        if (pending === null || pending !== watchedId) return
        setPending(null)
        open({ kind: 'stream', userId: pending })
    }, [pending, watchedId, open])
    return (userId: string) => {
        watchStream(session, userId)
        setPending(userId)
    }
}

/** Keeps `focus.tiles` at the cards' frames in the grid's view, past its side gutter. */
function useFocusTiles(
    focus: PanelFocus,
    cards: readonly ShownCard<GridItem>[],
    gutter: number,
) {
    const { tiles } = focus
    // A string dependency: the cards array is new on each render.
    const frames = JSON.stringify(
        Object.fromEntries(
            cards.map(card => [
                card.key,
                { ...card.frame, x: card.frame.x + gutter },
            ]),
        ),
    )
    useEffect(() => {
        tiles.set(JSON.parse(frames) as Record<string, Rect>)
    }, [tiles, frames])
}

/** One card's content, by its kind. */
function GridItemCard({
    item,
    guildId,
    width,
    height,
    focus,
    onWatch,
}: {
    item: GridItem
    guildId: string | null
    width: number
    height: number
    focus: PanelFocus
    onWatch: () => void
}) {
    if (item.kind === 'camera')
        return (
            <ParticipantCard
                voice={item.voice}
                width={width}
                height={height}
                covered={focus.covered}
                onFocus={() =>
                    focus.open({ kind: 'camera', userId: item.voice.userId })
                }
            />
        )
    if (item.watched)
        return (
            <WatchedStreamCard
                userId={item.userId}
                guildId={guildId}
                width={width}
                height={height}
                covered={focus.covered}
                onFocus={() =>
                    focus.open({ kind: 'stream', userId: item.userId })
                }
            />
        )
    return (
        <StreamCard
            userId={item.userId}
            guildId={guildId}
            width={width}
            height={height}
            onWatch={onWatch}
        />
    )
}

const styles = StyleSheet.create(theme => ({
    content: (height: number) => ({
        height,
        marginHorizontal: theme.space.PX_12,
    }),
}))
