import { useEffect, useState } from 'react'
import { useSession, useSessionStore } from '../../../core/react'
import { serversUiStore } from '../../servers/store'
import { dismissPreJoin } from './preJoinStore'

/**
 * Dismisses the pre-join card of `guildId`'s channel when it loses its place: a chat sliding in or a pushed screen
 * takes the tab bar it stands on (`noBar`), or another server is selected. `guildId` is null while no pre-join shows.
 */
export function useAutoDismissPreJoin(
    guildId: string | null,
    noBar: boolean,
): void {
    const session = useSession()
    const selectedGuildId = useSessionStore(
        serversUiStore,
        state => state.selectedGuildId,
    )
    // The server selected when this pre-join opened. A change, not a mismatch: the tab may show a fallback server.
    const [openedIn, setOpenedIn] = useState({ guildId, selectedGuildId })
    if (openedIn.guildId !== guildId) setOpenedIn({ guildId, selectedGuildId })
    const away =
        guildId !== null &&
        (noBar || selectedGuildId !== openedIn.selectedGuildId)
    useEffect(() => {
        if (away) dismissPreJoin(session)
    }, [away, session])
}
