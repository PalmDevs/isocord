import { openActionSheet } from '../../design/components/sheets/sheetStore'
import { PROFILE_SHEET_KEY } from './constants'
import type { ComponentType } from 'react'

interface ProfileSheetProps {
    userId: string
    guildId?: string
}

/**
 * The sheet component, set once by the app's features list. The sheet opens other profiles (mutuals, bio links),
 * so importing it here would close an import cycle that breaks Fast Refresh.
 */
let ProfileSheet: ComponentType<ProfileSheetProps> | undefined

export function registerProfileSheet(
    component: ComponentType<ProfileSheetProps>,
): void {
    ProfileSheet = component
}

/** Opens the profile sheet of a user, on the server's profile when `guildId` is given. Replaces a profile open. */
export function openProfileSheet(userId: string, guildId?: string): void {
    if (!ProfileSheet) throw new Error('The profile sheet is not registered')
    openActionSheet(
        PROFILE_SHEET_KEY,
        <ProfileSheet userId={userId} guildId={guildId} />,
    )
}
