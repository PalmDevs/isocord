import { useEffect } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StyleSheet } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../../core/react'
import {
    ActionSheet,
    ActionSheetRow,
    ActionSheetRowGroup,
    ActionSheetRowIcon,
} from '../../../design/components/sheets/Sheet'
import { useCloseSheet } from '../../../design/components/sheets/sheetContext'
import { openActionSheet } from '../../../design/components/sheets/sheetStore'
import ProxyImageView from '../../../native/ProxyImageViewNativeComponent'
import { findMessage, messagesStore } from '../../../stores/messages/messages'
import { recordEmojiUsage } from '../../expressions'
import { heldMedia } from '../../mediaViewer/store'
import { toggleReaction } from '../reactions'
import { canReact, mediaActions, messageActionGroups } from './actions'
import { EmojiRow } from './EmojiRow'
import { fileActions, heldFile } from './fileActions'
import { ReactionPickerSheet } from './ReactionPickerSheet'
import type { SearchEmoji } from '../../expressions'
import type { ViewerSource } from '../../mediaViewer/sources'
import type { ComposerApi } from '../composer'
import type { ReactionEmoji } from '../reactions'
import type { MessageAction } from './actions'

export interface LongPressMessageActionSheetProps {
    channelId: string
    messageId: string
    /** Absent in a message preview, which has no composer. */
    composer?: ComposerApi
    /** Opens another chat (a thread, or the DM of "Message"). */
    openChannel: (channelId: string) => void
    /**
     * The held media tile's or file card's link (`isocord://media/<id>/<index>`, `isocord://file/<id>/<index>`), or ""
     * when the message was held elsewhere.
     */
    media: string
}

/** The emoji a reaction is made with (`ReactionUtils.toReactionEmoji`). */
const toReactionEmoji = (emoji: SearchEmoji): ReactionEmoji =>
    emoji.type === 'custom'
        ? {
              id: emoji.id,
              name: emoji.originalName ?? emoji.name,
              animated: emoji.animated,
          }
        : { id: null, name: emoji.surrogates }

// Sizes of what the sheet lays out, to tell whether it fits the screen: a TableRow's minimum height, its divider,
// the gap between groups, the handle, and the emoji row with the gap under the header.
const ROW_HEIGHT = 56
const DIVIDER = 1
const GROUP_GAP = 24
const HANDLE = 28
const EMOJI_ROW = 52
const HEADER_GAP = 16
/** The held media's preview. */
const PREVIEW_HEIGHT = 120
const BOTTOM_PADDING = 16 + 4
/** BottomSheet never reaches higher than this below the status bar. */
const TOP_GAP = 56

/**
 * The sheet a long press on a message opens (modules/messages/native/long_press/LongPressMessageActionSheet).
 * It shows the quick reactions row, then the message's actions in groups (`messageActionGroups`).
 * A pressed row closes the sheet, then runs. The sheet scrolls when its rows do not fit.
 *
 * A held media tile (the reference's selectedMedia) adds a preview on top, then its rows (`mediaActions`).
 * Then come the reactions and the message's rows.
 * The reference has no preview and mixes the media rows into the message's first group.
 */
export function LongPressMessageActionSheet({
    channelId,
    messageId,
    composer,
    openChannel,
    media,
}: LongPressMessageActionSheetProps) {
    const session = useSession()
    const close = useCloseSheet()
    const insets = useSafeAreaInsets()
    const { height: windowHeight } = useWindowDimensions()
    const message = useSessionStore(messagesStore, state =>
        findMessage(state, channelId, messageId),
    )

    // The message was deleted while the sheet was open.
    useEffect(() => {
        if (!message) close()
    }, [message, close])

    const groups = message
        ? messageActionGroups({ session, message, composer, openChannel })
        : []
    if (!message) return null

    const held = media ? heldMedia(message, media) : undefined
    const file = media && !held ? heldFile(message, media) : undefined
    // A held file card's rows lead like a media tile's, without a preview (our own addition, see fileActions).
    const mediaGroup = held
        ? mediaActions(held)
        : file
          ? fileActions(session, file)
          : undefined
    const allGroups = mediaGroup ? [mediaGroup, ...groups] : groups
    // A spoiler stays covered: its rows are offered without the picture.
    const preview = held && !held.source.spoiler ? held.source : undefined
    const showEmojiRow = canReact(session, message)
    const react = (emoji: SearchEmoji) => {
        recordEmojiUsage(
            session,
            emoji.type === 'unicode' ? (emoji.parent ?? emoji) : emoji,
            { reaction: true },
        )
        toggleReaction(session, channelId, messageId, toReactionEmoji(emoji))
    }
    const openPicker = () => {
        close()
        openActionSheet(
            'message-reaction-picker',
            <ReactionPickerSheet channelId={channelId} onPickEmoji={react} />,
            { stackingBehavior: 'stack' },
        )
    }

    const rows = allGroups.reduce((sum, group) => sum + group.length, 0)
    const height =
        HANDLE +
        // The emoji row is the header, or with media a section of the body.
        (showEmojiRow ? EMOJI_ROW + (held ? GROUP_GAP : HEADER_GAP) : 0) +
        (preview ? PREVIEW_HEIGHT + GROUP_GAP : 0) +
        rows * ROW_HEIGHT +
        (rows - allGroups.length) * DIVIDER +
        (allGroups.length - 1) * GROUP_GAP +
        Math.max(insets.bottom, BOTTOM_PADDING)
    const scrollable = height > windowHeight - insets.top - TOP_GAP

    const emojiRow = showEmojiRow && (
        <EmojiRow
            channelId={channelId}
            onPressEmoji={emoji => {
                close()
                react(emoji)
            }}
            onPressPicker={openPicker}
        />
    )
    const renderGroup = (group: MessageAction[]) => (
        <ActionSheetRowGroup
            key={group.map(action => action.key).join()}
            hasIcons
        >
            {group.map(action => (
                <ActionSheetRow
                    key={action.key}
                    label={action.label}
                    variant={action.isDestructive ? 'danger' : 'default'}
                    icon={
                        <ActionSheetRowIcon
                            name={action.icon}
                            variant={
                                action.isDestructive ? 'danger' : 'default'
                            }
                        />
                    }
                    onPress={() => {
                        close()
                        action.onPress()
                    }}
                />
            ))}
        </ActionSheetRowGroup>
    )

    // With held media the preview and its rows come first, and the reactions follow them.
    return (
        <ActionSheet
            scrollable={scrollable}
            header={held ? undefined : emojiRow}
        >
            {preview && <MediaPreview source={preview} />}
            {mediaGroup && renderGroup(mediaGroup)}
            {held && <View style={styles.divider} />}
            {held && emojiRow && (
                <View style={styles.bodyEmojiRow}>{emojiRow}</View>
            )}
            {groups.map(renderGroup)}
        </ActionSheet>
    )
}

/**
 * The held picture, or a video's still, at a fixed height. Drawn by the chat's image loader, so it shows the copy
 * the chat already holds.
 */
function MediaPreview({ source }: { source: ViewerSource }) {
    const ratio =
        source.width > 0 && source.height > 0 ? source.width / source.height : 1
    return (
        <View style={styles.preview(ratio)}>
            <ProxyImageView
                url={source.url}
                sourceWidth={source.width}
                sourceHeight={source.height}
                style={styles.fill}
            />
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    // Very tall pictures are cropped rather than drawn as a sliver; wide ones stop at the sheet's width.
    preview: (ratio: number) => ({
        height: PREVIEW_HEIGHT,
        aspectRatio: Math.max(ratio, 1 / 2),
        maxWidth: '100%',
        alignSelf: 'center',
        borderRadius: theme.radii.sm,
        overflow: 'hidden',
        backgroundColor: theme.colors.BORDER_SUBTLE,
    }),
    fill: { width: '100%', height: '100%' },
    // EmojiRow pads itself for the header slot, which has no side padding; the body already has the sheet's.
    bodyEmojiRow: { marginHorizontal: -theme.space.PX_16 },
    divider: {
        height: 1,
        backgroundColor: theme.colors.BORDER_SUBTLE,
    },
}))
