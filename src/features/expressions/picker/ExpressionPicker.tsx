import { memo, useDeferredValue, useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSession } from '../../../core/react'
import { SearchField } from '../../../design/components/inputs/SearchField'
import { SegmentedControl } from '../../../design/components/inputs/SegmentedControl'
import { useSegmentedControlState } from '../../../design/components/inputs/useSegmentedControlState'
import { SheetDrag } from '../../../design/components/sheets/SheetDrag'
import { t } from '../../../i18n'
import {
    SHEET_HANDLE_HEIGHT,
    useComposer,
    usePanelSheet,
} from '../../chat/composer'
import { toast } from '../../chat/composer/toast'
import { trackGifSelect } from '../gifs/load'
import { recordEmojiUsage, recordStickerUsage } from '../index'
import { EmojiGrid, SkinToneSelector, TonePickerButton } from './EmojiGrid'
import { emojiText } from './emojiImage'
import { GifHeader, GifPicker } from './GifPicker'
import { openGifActions } from './gifActionsSheet'
import { StickerGrid } from './StickerGrid'
import type { ReactNode } from 'react'
import type { ComposerSlotProps } from '../../chat/composer'
import type { Gif } from '../gifs/providers'
import type { SearchEmoji, Sticker } from '../index'
import type { GifView } from './GifPicker'

const TAB_IDS = ['emoji', 'gifs', 'stickers'] as const
type TabId = (typeof TAB_IDS)[number]

/**
 * The `expression` panel of the composer's keyboard area (reference: `expression_picker/native/ExpressionPicker`).
 * A SegmentedControl switches Emoji, GIFs and Stickers, above a search field and the grids.
 * Picking an emoji inserts it and keeps the panel open. Picking a sticker or a GIF sends it.
 *
 * A tab's grid is built on first show and stays mounted, invisible at its real size.
 * The area keeps this mounted between openings.
 * The panel is a draggable sheet (see KeyboardArea). The search field expands it above the keyboard.
 */
export const ExpressionPicker = memo(function ExpressionPicker({
    channelId,
}: ComposerSlotProps) {
    const session = useSession()
    const composer = useComposer()
    const sheet = usePanelSheet()
    const items = TAB_IDS.map(id => ({ id, label: t(`expressions.tab.${id}`) }))
    const control = useSegmentedControlState({ items })
    const tab: TabId = TAB_IDS[control.selectedIndex] ?? 'emoji'
    // Each tab keeps its own search, and only the tabs seen so far are built.
    const [queries, setQueries] = useState<Record<TabId, string>>({
        emoji: '',
        stickers: '',
        gifs: '',
    })
    const [seen, setSeen] = useState<Record<TabId, boolean>>({
        emoji: true,
        stickers: false,
        gifs: false,
    })
    if (!seen[tab]) setSeen(current => ({ ...current, [tab]: true }))
    const [tones, setTones] = useState(false)
    const [gifView, setGifView] = useState<GifView>('search')
    const [favoritesQuery, setFavoritesQuery] = useState('')
    // The first opening draws the header at once and builds the grid right after, at low priority, instead of
    // holding the keyboard's hand-over up while thousands of emojis are laid out.
    const gridReady = useDeferredValue(true, false)

    const {
        insertText,
        setPanelTyping,
        sendSticker,
        sendGif,
        openSystemKeyboard,
    } = composer
    const setQuery = (text: string) =>
        setQueries(current => ({ ...current, [tab]: text }))
    // The keyboard that comes up for a search field must not close the panel it is in.
    const onSearchFocus = () => {
        setPanelTyping(true)
        sheet?.expand()
    }
    const onSearchBlur = () => setPanelTyping(false)

    const pickEmoji = (emoji: SearchEmoji) => {
        insertText(emojiText(emoji))
        recordEmojiUsage(
            session,
            emoji.type === 'unicode' ? (emoji.parent ?? emoji) : emoji,
        )
    }
    const pickSticker = async (sticker: Sticker) => {
        recordStickerUsage(session, sticker)
        if (!(await sendSticker(sticker.id)))
            toast(t('expressions.stickerFailed'))
    }
    const pickGif = async (gif: Gif) => {
        trackGifSelect(session, gif, queries.gifs)
        if (!(await sendGif(gif.url))) toast(t('expressions.gifFailed'))
    }
    // The link goes in the message being written, and the keyboard comes back to finish it.
    const insertGif = (gif: Gif) => {
        insertText(gif.url, { space: true })
        openSystemKeyboard()
    }

    return (
        <View style={styles.root}>
            <SheetDrag>
                <View
                    style={[
                        styles.tabs,
                        // The sheet's handle sits over the top of the panel.
                        sheet && { paddingTop: SHEET_HANDLE_HEIGHT },
                    ]}
                >
                    <SegmentedControl state={control} />
                </View>
                {tab === 'gifs' ? (
                    <GifHeader
                        view={gifView}
                        query={queries.gifs}
                        onQueryChange={setQuery}
                        favoritesQuery={favoritesQuery}
                        onFavoritesQueryChange={setFavoritesQuery}
                        onBack={() => {
                            setGifView('search')
                            setFavoritesQuery('')
                        }}
                        onFocus={onSearchFocus}
                        onBlur={onSearchBlur}
                    />
                ) : (
                    <View style={styles.search}>
                        <View style={styles.searchField}>
                            <SearchField
                                size="md"
                                value={queries[tab]}
                                onChangeText={setQuery}
                                onFocus={onSearchFocus}
                                onBlur={onSearchBlur}
                                placeholder={t(
                                    tab === 'emoji'
                                        ? 'expressions.searchEmoji'
                                        : 'expressions.searchStickers',
                                )}
                            />
                        </View>
                        {tab === 'emoji' && (
                            <TonePickerButton
                                pressed={tones}
                                onPress={() => setTones(on => !on)}
                            />
                        )}
                    </View>
                )}
            </SheetDrag>
            {tab === 'emoji' && tones && (
                <SkinToneSelector onDone={() => setTones(false)} />
            )}
            <View style={styles.body}>
                <Page shown={tab === 'emoji'}>
                    {gridReady && (
                        <EmojiGrid
                            channelId={channelId}
                            query={queries.emoji}
                            onSelect={pickEmoji}
                            onSelectLocked={() =>
                                toast(t('expressions.locked'))
                            }
                        />
                    )}
                </Page>
                {seen.gifs && (
                    <Page shown={tab === 'gifs'}>
                        <GifPicker
                            view={gifView}
                            query={queries.gifs}
                            favoritesQuery={favoritesQuery}
                            onSearch={query => {
                                setQueries(current => ({
                                    ...current,
                                    gifs: query,
                                }))
                                sheet?.expand()
                            }}
                            onView={view => {
                                setGifView(view)
                                sheet?.expand()
                            }}
                            onSelect={pickGif}
                            onHold={gif =>
                                openGifActions(gif, () => insertGif(gif))
                            }
                        />
                    </Page>
                )}
                {seen.stickers && (
                    <Page shown={tab === 'stickers'}>
                        <StickerGrid
                            channelId={channelId}
                            query={queries.stickers}
                            onSelect={pickSticker}
                            onSelectLocked={() =>
                                toast(t('expressions.stickerLocked'))
                            }
                        />
                    </Page>
                )}
            </View>
        </View>
    )
})

/** A tab's page: fills the body, and when not shown stays laid out but invisible and untouchable. */
function Page({ shown, children }: { shown: boolean; children: ReactNode }) {
    return (
        <View
            pointerEvents={shown ? 'auto' : 'none'}
            style={[styles.page, !shown && styles.hidden]}
        >
            {children}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    root: { flex: 1 },
    body: { flex: 1 },
    // Every tab fills the body; the ones not shown are invisible but keep their size, so their lists stay laid out.
    page: { ...StyleSheet.absoluteFillObject },
    hidden: { opacity: 0 },
    tabs: {
        paddingHorizontal: theme.space.PX_12,
        paddingTop: theme.space.PX_8,
        paddingBottom: theme.space.PX_8,
    },
    search: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.space.PX_12,
        paddingBottom: theme.space.PX_4,
        gap: theme.space.PX_8,
    },
    searchField: { flex: 1 },
}))
