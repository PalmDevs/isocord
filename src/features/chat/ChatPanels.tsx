import { useIsFocused } from '@react-navigation/native'
import { useEffect, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { logger } from '../../core/log'
import { useSessionStore } from '../../core/react'
import {
    settingsStore,
    swipeOpensDetails,
} from '../../stores/settings/settingsStore'
import { dismissComposers } from './composer'
import { PanelLayers } from './panels/PanelLayers'
import { useChatPanel } from './panels/useChatPanel'
import { useDetailsPanel } from './panels/useDetailsPanel'
import { usePanelDrag } from './panels/usePanelDrag'
import { usePanelStyles } from './panels/usePanelStyles'
import {
    usePanelsBackHandler,
    usePanelsLifecycle,
    usePanelsOpeners,
} from './panels/usePanelsLifecycle'
import { useStackedChat } from './panels/useStackedChat'
import { useThreadCreation } from './panels/useThreadCreation'
import type { Context, ReactNode } from 'react'

// DIAG: stuck Servers chat panel. Remove once found.
const diag = logger('PanelsDiag')

export interface ChatPanelsApi {
    /**
     * Slides the chat panel in over the tabs. Pass a channel when the panels do not get one as a prop, and a
     * message to scroll to. While the owning tab is not selected yet, the panel opens once it is.
     */
    openChat: (channelId?: string, messageId?: string) => void
    closeChat: () => void
    /** The owning tab reports whether it is the selected tab. */
    setTabFocused: (focused: boolean) => void
    /**
     * The server header's search: the selected channel's details, searching, on the Channels tab. They slide in over
     * whatever is showing, the tab or the chat. Does nothing without a selected channel.
     */
    openGuildSearch: () => void
    /**
     * The tab is fully covered by the chat or the details and nothing is moving them: it cannot be seen, so its
     * animations can pause. False again as soon as a drag starts.
     */
    listCovered: boolean
}

/**
 * Layers of a chat tab: the tab content, with the selected channel's chat above it.
 * The chat is a full-width panel that covers the tab bar, as in the reference.
 * Swiping it right reveals the tab. Swiping left returns to the last open chat.
 * Without `channelId`, the channel passed to `openChat` is used.
 * The channel details slide in over the chat from its header, or by swiping left
 * when the swipe setting says so (SwipeForMemberListWrapper).
 */
export function ChatPanels({
    context: PanelsContext,
    channelId: selectedChannelId,
    children,
}: {
    context: Context<ChatPanelsApi | null>
    channelId?: string
    children: ReactNode
}) {
    const { width } = useWindowDimensions()
    const [tabFocused, setTabFocused] = useState(false)
    const stackFocused = useIsFocused()
    const active = tabFocused && stackFocused
    const detailsOnSwipe = useSessionStore(settingsStore, swipeOpensDetails)
    const details = useDetailsPanel(width)
    const stack = useStackedChat(width, details.reset)
    const create = useThreadCreation(width, details, stack)
    const chat = useChatPanel({
        width,
        selectedChannelId,
        tabFocused,
        dropOverlays: () => {
            create.drop()
            stack.drop()
        },
    })
    const panels = { chat, details, stack, create }
    // The details are those of the chat on top: the stacked one while it shows.
    const detailsChannelId =
        stack.stack && stack.open ? stack.stack.channelId : chat.channelId
    // Another channel, or the chat going away, takes the details with it.
    // biome-ignore lint/correctness/useExhaustiveDependencies: reset on every channel change
    useEffect(details.reset, [detailsChannelId])
    usePanelsLifecycle(width, tabFocused, panels)
    usePanelsBackHandler(active, panels)
    usePanelsOpeners(active, panels)
    const { pan, closePan, dragging } = usePanelDrag({
        width,
        enabled: active && chat.hasChannel,
        detailsOnSwipe,
        ...panels,
    })
    const animated = usePanelStyles(width, dragging, {
        chat: chat.x,
        details: details.x,
        stack: stack.x,
        create: create.x,
    })
    const closeChat = () => {
        dismissComposers()
        details.reset()
        create.drop()
        stack.drop()
        chat.close()
    }
    const covered = chat.open || details.open
    // DIAG: every change of what gates opening and swiping.
    const diagState = `${selectedChannelId === undefined ? 'messages' : 'servers'} tab=${tabFocused} stack=${stackFocused} chat=${chat.channelId} has=${chat.hasChannel} open=${chat.open} x=${Math.round(chat.x.get())} built=${chat.built}/${chat.builtChannelId}/${chat.hasBuiltChannel} details=${details.open}/${details.mounted} stacked=${stack.open} create=${create.open} width=${width}`
    useEffect(() => diag.debug(diagState), [diagState])

    return (
        <PanelsContext
            value={{
                openChat: chat.openChat,
                closeChat,
                setTabFocused,
                openGuildSearch: () => {
                    if (chat.hasChannel) details.show(true, true)
                },
                listCovered: animated.listCovered,
            }}
        >
            <GestureDetector gesture={pan}>
                <View style={styles.root}>
                    {/* Never flattened: toggling importantForAccessibility on a flattenable view makes Fabric remove
                    and re-insert the whole tab subtree, which re-lays out and redraws everything mid-swipe. */}
                    <Animated.View
                        collapsable={false}
                        style={[styles.fill, animated.children]}
                        importantForAccessibility={
                            covered ? 'no-hide-descendants' : 'auto'
                        }
                    >
                        {children}
                    </Animated.View>
                    <PanelLayers
                        {...panels}
                        styles={animated}
                        closeGesture={closePan}
                        detailsChannelId={detailsChannelId}
                        detailsOnSwipe={detailsOnSwipe}
                        active={active}
                        onBack={closeChat}
                        onStackRowsDrawn={id => {
                            stack.onRowsDrawn(id)
                            create.onStackRowsDrawn(id)
                        }}
                    />
                </View>
            </GestureDetector>
        </PanelsContext>
    )
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    fill: { flex: 1 },
})
