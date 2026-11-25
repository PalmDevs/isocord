import { useStore } from 'zustand'
import { useSession, useSessionStore } from '../../core/react'
import { TableRowTrailingText } from '../../design/components/table/TableRow'
import { themeStore } from '../../design/tokens'
import { chatGesturesStore } from '../../stores/settings/chatGestures'
import { settingsStore } from '../../stores/settings/settingsStore'
import { systemNotificationsStore } from '../systemNotifications'
import { useSettingSearchStore } from './search'
import type { SettingContext } from './config'

export const trailingText = (text: string | undefined) =>
    text ? <TableRowTrailingText text={text} /> : undefined

export function useSettingContext(): SettingContext {
    const session = useSession()
    const settings = useSessionStore(settingsStore, state => state)
    const themeState = useStore(themeStore)
    const systemNotifications = useStore(systemNotificationsStore)
    const chatGestures = useStore(chatGesturesStore)
    return {
        session,
        settings,
        themeState,
        systemNotifications,
        chatGestures,
    }
}

export const clearSelected = () =>
    useSettingSearchStore.setState({ selected: null })
