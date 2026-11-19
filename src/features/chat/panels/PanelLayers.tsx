import { CreateThreadPanel } from '../../threads/CreateThreadPanel'
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
    const { builtChannelId } = chat
    return (
        <>
            {/* The selected channel's chat is built as soon as it is selected and stays mounted offscreen,
            so swiping to it costs nothing and swiping back and forth keeps its content. */}
            {chat.hasBuiltChannel && builtChannelId && chat.built && (
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
                    <ChannelPanel
                        channelId={builtChannelId}
                        onBack={onBack}
                        onRowsDrawn={chat.onRowsDrawn}
                        visible={chat.open && active && !stack.open}
                        jump={
                            chat.jump?.channelId === builtChannelId
                                ? chat.jump
                                : undefined
                        }
                        onOpenDetails={details.show}
                        swipeOpensDetails={detailsOnSwipe}
                    />
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
                (details.mounted || (detailsOnSwipe && chat.open)) && (
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
                        />
                    </PanelLayer>
                )}
        </>
    )
}
