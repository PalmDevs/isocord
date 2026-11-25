import { useState } from 'react'
import { View } from 'react-native'
import { useAnimatedStyle } from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { useSessionStore } from '../../../core/react'
import { panelBackStyle } from '../../../design/components/overlays/usePanelBackPreview'
import { channelsStore } from '../../../stores/channels/channels'
import { ForumSearchBar } from '../../forum/ForumSearchBar'
import { ForumSkeleton } from '../../forum/ForumSkeleton'
import { CreateThreadPanel } from '../../threads/CreateThreadPanel'
import { ChatHeader } from '../ChatPanel'
import { ChannelDetails } from '../details/ChannelDetails'
import { ChannelPanel } from './ChannelPanel'
import { PanelLayer } from './PanelLayer'
import { scrimOpacity } from './usePanelStyles'
import type { ComponentProps } from 'react'
import type { SharedValue } from 'react-native-reanimated'
import type { PanelBackPreview } from '../../../design/components/overlays/usePanelBackPreview'
import type { ChatPanelState } from './useChatPanel'
import type { DetailsPanel } from './useDetailsPanel'
import type { PanelStyles } from './usePanelStyles'
import type { StackedChat, StackedEntry } from './useStackedChat'
import type { ThreadCreation } from './useThreadCreation'

function StackedPanelLayer({
    entry,
    aboveXs,
    isTopOpen,
    width,
    dragging,
    backPreview,
    accessible,
    visible,
    detailsOnSwipe,
    onBack,
    onRowsDrawn,
    onOpenDetails,
}: {
    entry: StackedEntry
    aboveXs: SharedValue<number>[]
    isTopOpen: boolean
    width: number
    dragging: SharedValue<boolean>
    backPreview: PanelBackPreview
    accessible: boolean
    visible: boolean
    detailsOnSwipe: boolean
    onBack: (key: number) => void
    onRowsDrawn: (key: number, channelId: string) => void
    onOpenDetails: DetailsPanel['show']
}) {
    const hasChannel = useSessionStore(
        channelsStore,
        state => entry.channelId in state.channels,
    )
    const { layer, offset } = backPreview
    const panelStyle = useAnimatedStyle(() => {
        let covered = false
        for (let i = 0; i < aboveXs.length; i++) {
            if (aboveXs[i]!.get() === 0) {
                covered = true
                break
            }
        }
        return {
            ...panelBackStyle(
                entry.x.get(),
                isTopOpen && layer.get() === 'stack' ? offset.get() : 0,
            ),
            opacity: !dragging.get() && offset.get() === 0 && covered ? 0 : 1,
        }
    })
    const scrimStyle = useAnimatedStyle(() => ({
        opacity: scrimOpacity(entry.x, width),
    }))
    if (!hasChannel) return null
    return (
        <PanelLayer
            scrimStyle={scrimStyle}
            style={panelStyle}
            accessible={accessible}
        >
            <ChannelPanel
                channelId={entry.channelId}
                onBack={() => onBack(entry.key)}
                onRowsDrawn={id => onRowsDrawn(entry.key, id)}
                visible={visible}
                panelX={entry.x}
                jump={entry.jump}
                onOpenDetails={onOpenDetails}
                swipeOpensDetails={detailsOnSwipe}
            />
        </PanelLayer>
    )
}

/** The layers over the tab: its chat, the stacked chats, the thread creation and the channel details. */
export function PanelLayers({
    chat,
    details,
    stack,
    create,
    styles,
    width,
    dragging,
    backPreview,
    closeGesture,
    detailsChannelId,
    detailsOnSwipe,
    active,
    onBack,
    onStackRowsDrawn,
}: {
    chat: ChatPanelState
    details: DetailsPanel
    stack: StackedChat
    create: ThreadCreation
    styles: PanelStyles
    width: number
    dragging: SharedValue<boolean>
    backPreview: PanelBackPreview
    closeGesture: ComponentProps<typeof PanelLayer>['gesture']
    detailsChannelId?: string
    detailsOnSwipe: boolean
    active: boolean
    onBack: () => void
    onStackRowsDrawn: (key: number, channelId: string) => void
}) {
    const { channelId } = chat
    const [detailsPrepared, setDetailsPrepared] = useState<string>()
    if (detailsPrepared && (!chat.open || !detailsOnSwipe))
        setDetailsPrepared(undefined)
    else if (
        detailsOnSwipe &&
        chat.drawn &&
        chat.settled &&
        !stack.waiting &&
        detailsPrepared !== detailsChannelId
    )
        setDetailsPrepared(detailsChannelId)
    return (
        <>
            {chat.hasChannel &&
                channelId &&
                (active || chat.built || chat.listChannelId || chat.open) && (
                    <PanelLayer
                        scrimStyle={styles.scrims.chat}
                        style={styles.chat}
                        accessible={
                            chat.open &&
                            !stack.open &&
                            !create.open &&
                            !details.open
                        }
                    >
                        {(!chat.forum || chat.built) && (
                            <ChannelPanel
                                channelId={channelId}
                                onBack={onBack}
                                onRowsDrawn={chat.onRowsDrawn}
                                visible={
                                    chat.drawn &&
                                    chat.open &&
                                    active &&
                                    !stack.open
                                }
                                panelX={chat.x}
                                prepareComposer
                                mountList={chat.listChannelId !== undefined}
                                listChannelId={chat.listChannelId}
                                showRows={chat.drawn}
                                showSkeleton={chat.showSkeleton}
                                jump={
                                    chat.jump?.channelId === channelId
                                        ? chat.jump
                                        : undefined
                                }
                                onOpenDetails={details.show}
                                swipeOpensDetails={detailsOnSwipe}
                            />
                        )}
                        {chat.forum && !chat.drawn && (
                            <View style={contentStyles.forumPlaceholder}>
                                <ChatHeader
                                    channelId={channelId}
                                    onBack={onBack}
                                />
                                {/* ForumPanel's list padding, search bar header and skeleton. */}
                                <View style={contentStyles.forumList}>
                                    <ForumSearchBar channelId={channelId} />
                                    {chat.showSkeleton && <ForumSkeleton />}
                                </View>
                            </View>
                        )}
                    </PanelLayer>
                )}
            {stack.entries.map((entry, index) => {
                const isTopOpen = entry.key === stack.topOpen?.key
                return (
                    <StackedPanelLayer
                        key={entry.key}
                        entry={entry}
                        aboveXs={[
                            ...stack.entries
                                .slice(index + 1)
                                .map(item => item.x),
                            create.x,
                            details.x,
                        ]}
                        isTopOpen={isTopOpen}
                        width={width}
                        dragging={dragging}
                        backPreview={backPreview}
                        accessible={isTopOpen && !create.open && !details.open}
                        visible={isTopOpen && active}
                        detailsOnSwipe={detailsOnSwipe}
                        onBack={stack.close}
                        onRowsDrawn={onStackRowsDrawn}
                        onOpenDetails={details.show}
                    />
                )
            })}
            {create.create && (
                <PanelLayer
                    scrimStyle={styles.scrims.create}
                    style={styles.create}
                    accessible={create.open && !details.open}
                >
                    <CreateThreadPanel
                        key={create.create.key}
                        channelId={create.create.channelId}
                        messageId={create.create.messageId}
                        onBack={create.close}
                        onCreated={create.onCreated}
                    />
                </PanelLayer>
            )}
            {/* Built when asked for, or ahead of a swipe while the chat is open and swiping opens it. */}
            {chat.hasChannel &&
                detailsChannelId &&
                (details.mounted || detailsPrepared === detailsChannelId) && (
                    <PanelLayer
                        scrimStyle={styles.scrims.details}
                        style={styles.details}
                        accessible={details.open}
                        gesture={closeGesture}
                    >
                        <ChannelDetails
                            key={`${detailsChannelId}:${details.key}`}
                            channelId={detailsChannelId}
                            initialSearch={details.search}
                            guildSearch={details.guildSearch}
                            initialTab={details.tab}
                            onBack={details.close}
                            onReady={details.startSlide}
                            deferPages={details.waiting}
                            active={active && details.open}
                        />
                    </PanelLayer>
                )}
        </>
    )
}

const contentStyles = StyleSheet.create(theme => ({
    forumPlaceholder: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: theme.colors.BACKGROUND_BASE_LOWER,
    },
    forumList: {
        flex: 1,
        paddingHorizontal: theme.space.PX_8,
        paddingTop: theme.space.PX_8,
    },
}))
