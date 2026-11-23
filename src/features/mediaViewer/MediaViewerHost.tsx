import { useContext, useEffect, useState } from 'react'
import { StyleSheet as NativeStyleSheet, Share, View } from 'react-native'
import { SystemBars } from 'react-native-edge-to-edge'
import Animated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StyleSheet } from 'react-native-unistyles'
import { GifFormat } from '../../core/frecency'
import { useSession, useSessionStore } from '../../core/react'
import { IconButton } from '../../design/components/buttons/IconButton'
import { NAV_BAR_HEIGHT } from '../../design/components/layout/navBarHeight'
import {
    ContextMenu,
    ContextMenuPanel,
} from '../../design/components/overlays/ContextMenu'
import { AnchoredPopover } from '../../design/components/overlays/Popover'
import { BottomSheet } from '../../design/components/sheets/Sheet'
import { SheetContext } from '../../design/components/sheets/sheetContext'
import { Text } from '../../design/components/Text'
import { Icon } from '../../design/icons/Icon'
import { rawColors } from '../../design/tokens/generated/rawColors'
import { STANDARD_EASING } from '../../design/tokens/motion'
import { t } from '../../i18n'
import MediaViewerView from '../../native/MediaViewerViewNativeComponent'
import { viewerAction, viewerMotion } from '../../native/NativeIsocordConstants'
import { findMessage, messagesStore } from '../../stores/messages/messages'
import { parseChatLink } from '../chat/links/chatLink'
import { handleChatLink } from '../chat/links/links'
import { openChannel } from '../chat/links/openChannel'
import {
    buildMessageRow,
    standaloneRow,
    useChatTheme,
} from '../chat/rows/rowEncoder'
import { useIsFavoriteGif } from '../expressions/gifs/favorites'
import { toggleFavorite } from '../expressions/picker/gifActionsSheet'
import { openActionSheet, showSimpleActionSheet } from '../sheets'
import { copyMediaLink, openMediaLink, saveMedia } from './actions'
import { closeMediaViewer, mediaViewerStore } from './store'
import type { AnchorRect } from '../../design/components/overlays/popoverHooks'
import type { SimpleActionSheetOption } from '../../design/components/sheets/SimpleActionSheet'
import type { ViewerSource } from './sources'
import type { OpenMediaViewer } from './store'

/** Available playback speed options in the viewer. */
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

/** The sheet `openMediaViewer` opens. Drops itself once the viewer is closed or the account switched. */
export function MediaViewerHost() {
    const open = useSessionStore(mediaViewerStore, state => state.open)
    const { onClosed } = useContext(SheetContext)
    useEffect(() => {
        if (!open) onClosed()
    }, [open, onClosed])
    return open ? <MediaViewer key={open.key} open={open} /> : null
}

/**
 * MediaShareActions: Save, Share, Copy Media Link, Open in Browser, and Jump to Message from search. Share sends the
 * link (the reference shares the file itself). The header's More Options shows them in a context menu by the button
 * (the reference opens an action sheet), a long press on the media in the action sheet.
 */
function mediaOptions(
    source: ViewerSource,
    jump: (() => void) | undefined,
): SimpleActionSheetOption[] {
    return [
        {
            label: t('mediaViewer.save'),
            icon: 'DownloadIcon',
            onPress: () => void saveMedia(source.link, source.kind),
        },
        {
            label: t('mediaViewer.share'),
            icon: 'ShareIcon',
            onPress: () =>
                void Share.share({ message: source.link }).catch(() => {}),
        },
        {
            label: t('mediaViewer.copyMediaLink'),
            icon: 'LinkIcon',
            onPress: () => copyMediaLink(source.link),
        },
        ...(source.proxyUrl && source.proxyUrl !== source.link
            ? ([
                  {
                      label: t('mediaViewer.copyProxiedMediaLink'),
                      icon: 'LinkIcon',
                      onPress: () => copyMediaLink(source.proxyUrl!),
                  },
              ] as const)
            : []),
        {
            label: t('mediaViewer.openInBrowser'),
            icon: 'WindowLaunchIcon',
            onPress: () => openMediaLink(source.link),
        },
        ...(jump
            ? [
                  {
                      label: t('mediaViewer.jumpToMessage'),
                      icon: 'ChatArrowRightIcon' as const,
                      onPress: jump,
                  },
              ]
            : []),
    ]
}

/** MediaViewerAltTextSheet: the picture's description under "Image Description (Alt Text)". */
function showAltText(description: string) {
    openActionSheet(
        'media-viewer-alt-text',
        <BottomSheet
            header={
                <Text variant="heading-lg/bold" style={styles.altTitle}>
                    {t('mediaViewer.altTextTitle')}
                </Text>
            }
        >
            <Text variant="text-md/normal" style={styles.altText}>
                {description}
            </Text>
        </BottomSheet>,
    )
}

/**
 * MediaViewerOverlayButtonFavoriteGIF: a star that adds or removes the GIF as a favorite. Only GIFs get one;
 * a GIFV is saved as a video.
 */
function FavoriteGifButton({ source }: { source: ViewerSource }) {
    const session = useSession()
    const favorite = useIsFavoriteGif(source.link)
    if (source.kind !== 'gif') return null
    return (
        <IconButton
            variant="secondary-overlay"
            size="lg"
            icon={
                favorite ? (
                    <Icon
                        name="StarIcon"
                        style={{ tintColor: rawColors.YELLOW_300 }}
                    />
                ) : (
                    <Icon name="StarOutlineIcon" />
                )
            }
            accessibilityLabel={t(
                favorite
                    ? 'expressions.gifActions.removeFavorite'
                    : 'expressions.gifActions.addFavorite',
            )}
            onPress={() =>
                void toggleFavorite(
                    session,
                    {
                        id: source.link,
                        url: source.link,
                        src: source.url,
                        width: source.width,
                        height: source.height,
                    },
                    favorite,
                    source.gifv ? GifFormat.VIDEO : GifFormat.IMAGE,
                )
            }
        />
    )
}

/**
 * MediaModal: the native pager, footer and gestures (IsocordMediaViewerView), with the header drawn here on top.
 * The header follows the native side: it comes in over the last quarter of the entrance (useOverlayLayoutDriver),
 * hides while the media is tapped away or dragged, and goes at once when the viewer closes (MediaViewerTsx6).
 */
function MediaViewer({ open }: { open: OpenMediaViewer }) {
    const session = useSession()
    const insets = useSafeAreaInsets()
    // Back and the close button close the sheet. The native side then animates out.
    const { closing: closeRequested, close } = useContext(SheetContext)
    const [headerShown, setHeaderShown] = useState(true)
    const [index, setIndex] = useState(open.initialIndex)
    const [speed, setSpeed] = useState(1)
    const [speedAnchor, setSpeedAnchor] = useState<AnchorRect | null>(null)
    const viewed = open.sources[index]
    const opened = open.messages[index] ?? open.messages[0]
    // Reactions added while the viewer is open show up when the message is one the chat has loaded.
    const latest = useSessionStore(messagesStore, state =>
        opened ? findMessage(state, opened.channel_id, opened.id) : undefined,
    )
    const message = latest ?? opened
    const row = message && buildMessageRow(session, message)
    const messageJson = row
        ? JSON.stringify(standaloneRow(row, { reactions: true }))
        : ''
    const footerTheme = useChatTheme('mediaFooter')
    // Leaving for a channel or message closes the viewer first.
    const leave = (channelId: string, messageId?: string) => {
        closeMediaViewer(session)
        if (open.jump && messageId) open.jump(channelId, messageId)
        else openChannel(channelId, messageId)
    }
    const options = (at: number) => {
        const source = open.sources[at]
        const of = open.messages[at]
        return source
            ? mediaOptions(
                  source,
                  open.jump && of
                      ? () => leave(of.channel_id, of.id)
                      : undefined,
              )
            : []
    }

    const entrance = useSharedValue(0)
    const overlay = useSharedValue(1)
    const closing = useSharedValue(false)
    useEffect(() => {
        entrance.set(
            withTiming(1, {
                duration: viewerMotion.entranceMs,
                easing: STANDARD_EASING,
            }),
        )
    }, [entrance])
    const headerStyle = useAnimatedStyle(() => ({
        opacity: closing.get()
            ? 0
            : interpolate(entrance.get(), [0, 0.75, 1], [0, 0, 1]) *
              overlay.get(),
        transform: [
            {
                translateY: interpolate(
                    entrance.get(),
                    [0, 0.75, 1],
                    [-50, -50, 0],
                ),
            },
        ],
    }))

    return (
        <View style={NativeStyleSheet.absoluteFill}>
            {/* Light icons over the black backdrop while the viewer is up. */}
            <SystemBars style="light" />
            <MediaViewerView
                style={NativeStyleSheet.absoluteFill}
                sources={JSON.stringify(open.sources)}
                initialIndex={open.initialIndex}
                origin={open.origin}
                message={messageJson}
                theme={footerTheme}
                reactLabel={t('mediaViewer.react')}
                altLabel={t('chat.media.alt')}
                closeRequested={closeRequested}
                bottomInset={insets.bottom}
                speed={speed}
                onIndexChange={event => setIndex(event.nativeEvent.index)}
                onOverlayChange={event => {
                    const { visible } = event.nativeEvent
                    setHeaderShown(visible)
                    overlay.set(
                        withTiming(visible ? 1 : 0, {
                            duration: visible
                                ? viewerMotion.overlayInMs
                                : viewerMotion.overlayOutMs,
                            easing: Easing.linear,
                        }),
                    )
                }}
                onClosing={() => closing.set(true)}
                onClosed={() => closeMediaViewer(session)}
                onLinkPress={event => {
                    const { url } = event.nativeEvent
                    const link = parseChatLink(url)
                    if (link?.kind === 'viewer') {
                        if (link.action === viewerAction.speed && link.origin) {
                            setSpeedAnchor(link.origin)
                            return
                        }
                        if (link.action === viewerAction.options)
                            showSimpleActionSheet({
                                key: 'media-viewer-options',
                                options: options(link.index),
                            })
                        const description =
                            open.sources[link.index]?.description
                        if (link.action === viewerAction.alt && description)
                            showAltText(description)
                        return
                    }
                    if (!message) return
                    handleChatLink(url, {
                        session,
                        channelId: message.channel_id,
                        openChannel: leave,
                        scrollToMessage: id => leave(message.channel_id, id),
                    })
                }}
            />
            {speedAnchor && (
                <AnchoredPopover
                    dim
                    anchor={speedAnchor}
                    align="above"
                    minWidth={140}
                    onClose={() => setSpeedAnchor(null)}
                >
                    <ContextMenuPanel
                        items={SPEEDS.map(s => ({
                            label: `${s}x`,
                            trailingIndicator:
                                s === speed ? (
                                    <Icon name="CheckmarkSmallIcon" />
                                ) : undefined,
                            onPress: () => setSpeed(s),
                        }))}
                    />
                </AnchoredPopover>
            )}
            <Animated.View
                pointerEvents={headerShown ? 'box-none' : 'none'}
                style={[styles.header(insets), headerStyle]}
            >
                <IconButton
                    variant="secondary-overlay"
                    size="lg"
                    icon="XSmallIcon"
                    accessibilityLabel={t('common.close')}
                    onPress={close}
                />
                <View style={styles.actions}>
                    {viewed && <FavoriteGifButton source={viewed} />}
                    <ContextMenu
                        triggerOnLongPress={false}
                        items={options(index).map(option => ({
                            label: option.label,
                            icon: option.icon,
                            action: option.onPress,
                        }))}
                    >
                        {({ open: openMenu }) => (
                            <IconButton
                                variant="secondary-overlay"
                                size="lg"
                                icon="MoreVerticalIcon"
                                accessibilityLabel={t(
                                    'mediaViewer.moreOptions',
                                )}
                                onPress={openMenu}
                            />
                        )}
                    </ContextMenu>
                </View>
            </Animated.View>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    // MediaModalOverlayHeaderWrapper: a nav bar below the status bar, 6dp in from the safe area; the close button
    // on the left, the options on the right (MediaModalOverlayHeader navbarInner: space-between).
    header: (insets: { top: number; left: number; right: number }) => ({
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: NAV_BAR_HEIGHT + insets.top,
        paddingTop: insets.top,
        paddingLeft: insets.left + 6,
        paddingRight: insets.right + 6,
    }),
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_4,
    },
    // MediaModalOverlayAltTextSheet: 16 around the title and the text.
    altTitle: { padding: theme.space.PX_16 },
    altText: {
        paddingHorizontal: theme.space.PX_16,
        paddingBottom: theme.space.PX_16,
    },
}))
