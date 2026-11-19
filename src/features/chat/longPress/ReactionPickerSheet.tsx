import { useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StyleSheet } from 'react-native-unistyles'
import { SearchField } from '../../../design/components/inputs/SearchField'
import { BottomSheet } from '../../../design/components/sheets/Sheet'
import { useCloseSheet } from '../../../design/components/sheets/sheetContext'
import { t } from '../../../i18n'
import {
    EmojiGrid,
    SkinToneSelector,
    TonePickerButton,
} from '../../expressions/picker'
import { toast } from '../composer/toast'
import type { SearchEmoji } from '../../expressions'

/** Share of the window the picker sheet takes. */
const HEIGHT_RATIO = 0.65
/** The drag handle's area (4 high, 24 below) and the gap under the header, which BottomSheet lays out itself. */
const HANDLE_AREA = 28
const HEADER_GAP = 16
const SEARCH_HEIGHT = 40
/** Bottom padding BottomSheet gives a footer: the larger of the inset and 16, plus 4. */
const MIN_BOTTOM_PADDING = 16
const FOOTER_PADDING_EXTRA = 4

interface Props {
    /** The channel whose server emojis are usable. None outside a chat, such as for a custom status. */
    channelId?: string
    /** Called with the picked emoji; the sheet is closing by then. */
    onPickEmoji: (emoji: SearchEmoji) => void
    /** Called once the sheet has closed, picked or not. */
    onDismiss?: () => void
}

/**
 * The emoji picker action sheet (`openEmojiPickerActionSheet`, `EmojiPickerActionSheet`) of the add reaction button.
 * A search field and skin tone toggle sit over the emoji grid, with the category rail at the bottom, like ExpressionPicker.
 * The sheet has one fixed height. The grid sits in its footer, outside the dragging and scrolling part.
 * Under the keyboard, the sheet stops at the top safe area and the grid shrinks.
 * Tapping an emoji picks it and closes the sheet.
 */
export function ReactionPickerSheet({
    channelId,
    onPickEmoji,
    onDismiss,
}: Props) {
    const close = useCloseSheet()
    const insets = useSafeAreaInsets()
    const { height: windowHeight } = useWindowDimensions()
    const [query, setQuery] = useState('')
    const [tones, setTones] = useState(false)
    const height = Math.round(windowHeight * HEIGHT_RATIO)
    // The category rail keeps clear of the system bar itself and sits on the sheet's bottom edge, as the
    // reference's category bar does, so the grid takes the footer's bottom padding too.
    const footerPadding =
        Math.max(insets.bottom, MIN_BOTTOM_PADDING) + FOOTER_PADDING_EXTRA
    const gridHeight = height - HANDLE_AREA - SEARCH_HEIGHT - HEADER_GAP

    return (
        <BottomSheet
            scrollable
            startHeight={height}
            maxHeight={height}
            onDismiss={onDismiss}
            header={
                <View style={styles.search}>
                    <View style={styles.searchField}>
                        <SearchField
                            size="md"
                            value={query}
                            onChangeText={setQuery}
                            placeholder={t('expressions.searchEmoji')}
                        />
                    </View>
                    <TonePickerButton
                        pressed={tones}
                        onPress={() => setTones(on => !on)}
                    />
                </View>
            }
            footer={
                <View
                    style={{
                        height: gridHeight,
                        flexShrink: 1,
                        marginBottom: -footerPadding,
                    }}
                >
                    {tones && (
                        <SkinToneSelector onDone={() => setTones(false)} />
                    )}
                    <EmojiGrid
                        channelId={channelId}
                        query={query}
                        onSelect={emoji => {
                            close()
                            onPickEmoji(emoji)
                        }}
                        onSelectLocked={() => toast(t('expressions.locked'))}
                    />
                </View>
            }
        />
    )
}

const styles = StyleSheet.create(theme => ({
    search: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.space.PX_16,
        gap: theme.space.PX_8,
    },
    searchField: { flex: 1 },
}))
