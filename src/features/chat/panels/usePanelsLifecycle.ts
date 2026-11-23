import { useEffect } from 'react'
import { BackHandler } from 'react-native'
import { logger } from '../../../core/log'
import { dismissComposers } from '../composer'
import { openChannel, setOpener } from '../links/openChannel'
import type { PanelBackPreview } from '../../../design/components/overlays/usePanelBackPreview'
import type { ChatPanelState } from './useChatPanel'
import type { DetailsPanel } from './useDetailsPanel'
import type { StackedChat } from './useStackedChat'
import type { ThreadCreation } from './useThreadCreation'

// DIAG: stuck Servers chat panel. Remove once found.
const diag = logger('PanelsDiag')

interface Panels {
    chat: ChatPanelState
    details: DetailsPanel
    stack: StackedChat
    create: ThreadCreation
}

/**
 * Keeps the layers consistent with the window and the app: the closed position follows the width (rotation,
 * fold), and the chat's channel going away or the tab losing focus (by navigation) takes every layer with it.
 */
export function usePanelsLifecycle(
    width: number,
    tabFocused: boolean,
    { chat, details, stack, create }: Panels,
) {
    // biome-ignore lint/correctness/useExhaustiveDependencies: only a width change should resync the position
    useEffect(() => {
        for (const layer of [chat, details, stack, create])
            layer.x.set(layer.openRef.current ? 0 : width)
    }, [width])
    // biome-ignore lint/correctness/useExhaustiveDependencies: drop and reset only use refs, setters and shared values
    useEffect(() => {
        if (
            (!chat.hasChannel || !tabFocused) &&
            (chat.open || details.open || stack.stack || create.create)
        ) {
            diag.debug(
                `reset ${chat.channelId} hasChannel=${chat.hasChannel} tabFocused=${tabFocused}`,
            )
            chat.setShown(false)
            chat.x.set(width)
            details.reset()
            create.drop()
            stack.drop()
        }
    }, [
        chat.hasChannel,
        tabFocused,
        chat.open,
        details.open,
        stack.stack,
        create.create,
        width,
    ])
}

/** The hardware back button closes the details, then the thread creation, the stacked chat and the chat. */
export function usePanelsBackHandler(
    active: boolean,
    panels: Panels,
    takeOffset: PanelBackPreview['takeOffset'],
) {
    const { chat, details, stack, create } = panels
    // biome-ignore lint/correctness/useExhaustiveDependencies: the handlers only use refs, shared values and setters
    useEffect(() => {
        // The details can also be open over the tab alone (the server header's search).
        if (
            !(chat.open || details.open || stack.open || create.open) ||
            !active
        )
            return
        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                const target = details.openRef.current
                    ? 'details'
                    : create.openRef.current
                      ? 'create'
                      : stack.openRef.current
                        ? 'stack'
                        : 'chat'
                const panel = panels[target]
                takeOffset(target, panel.x)
                panel.close()
                return true
            },
        )
        return () => subscription.remove()
    }, [chat.open, details.open, stack.open, create.open, active])
}

/** Registers what the chat on screen can open: stacked channels, thread creation, a channel from the details. */
export function usePanelsOpeners(
    active: boolean,
    { chat, details, stack, create }: Panels,
) {
    const openFromDetails = (id: string) => {
        dismissComposers()
        details.slideAway(() => {
            if (stack.openRef.current) stack.show(id)
            else openChannel(id)
        })
    }
    // Channel links in the chat on screen stack their channel over it (links.ts `channel`).
    useEffect(() => {
        if (chat.open && active) return setOpener('stackedChat', stack.show)
    })
    // The details can be open over the tab alone (the server header's search), with their Threads page.
    useEffect(() => {
        if ((chat.open || details.open) && active)
            return setOpener('threadCreation', create.show)
    })
    useEffect(() => {
        if (details.open && active)
            return setOpener('detailsChannel', openFromDetails)
    })
}
