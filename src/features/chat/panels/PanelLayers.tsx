import { useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { ForumSearchBar } from '../../forum/ForumSearchBar'
import { ForumSkeleton } from '../../forum/ForumSkeleton'
import { CreateThreadPanel } from '../../threads/CreateThreadPanel'
import { ChatHeader } from '../ChatPanel'
import { ChannelDetails } from '../details/ChannelDetails'
import { ChannelPanel } from './ChannelPanel'
import { PanelLayer } from './PanelLayer'
import type { ComponentProps } from 'react'
import type { ChatPanelState } from './useChatPanel'
import type { DetailsPanel } from './useDetailsPanel'
import type { PanelStyles } from './usePanelStyles'
import type { StackedChat } from './useStackedChat'
import type { ThreadCreation } from './useThreadCreation'

/** The layers over the tab: its chat, the stacked chat, the thread creation and the channel details. */
export function PanelLayers({
    chat,
    details,
    stack,
    create,
    styles,
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
    closeGesture: ComponentProps<typeof PanelLayer>['gesture']
    detailsChannelId?: string
    detailsOnSwipe: boolean
    active: boolean
    onBack: () => void
    onStackRowsDrawn: (channelId: string) => void
}) {
    const { channelId } = chat
    const [detailsPrepared, setDetailsPrepared] = useState<string>()
    if (detailsPrepared && (!chat.open || !detailsOnSwipe))
        setDetailsPrepared(undefined)
    else if (
        detailsOnSwipe &&
        chat.drawn &&
        chat.settled &&
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
            {stack.stack && stack.hasChannel && (
                <PanelLayer
                    scrimStyle={styles.scrims.stack}
                    style={styles.stack}
                    accessible={stack.open && !create.open && !details.open}
                >
                    <ChannelPanel
                        channelId={stack.stack.channelId}
                        onBack={stack.close}
                        onRowsDrawn={onStackRowsDrawn}
                        visible={stack.open && active}
                        panelX={stack.x}
                        jump={stack.stack.jump}
                        onOpenDetails={details.show}
                        swipeOpensDetails={detailsOnSwipe}
                    />
                </PanelLayer>
            )}
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
