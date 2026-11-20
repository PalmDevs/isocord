import { RelationshipType } from '../../core/discord/relationships'
import { openActionSheet } from '../../design/components/sheets/sheetStore'
import { membersStore } from '../../stores/members'
import { relationshipsStore } from '../../stores/relationships'
import { settingsStore } from '../../stores/settings/settingsStore'
import { displayName, usersStore } from '../../stores/users'
import { PROFILE_SHEET_KEY } from './constants'
import { SpeedBumpSheet } from './safety/SpeedBumpSheet'
import type { ComponentType } from 'react'
import type { Session } from '../../core/session'
import type { Restriction } from './safety/SafetyParts'

interface ProfileSheetProps {
    userId: string
    guildId?: string
}

/** getUserProfileIgnoredSpeedBumpActionSheetKey, for blocked users too as in showUserProfileActionSheet. */
const SPEED_BUMP_KEY = 'UserProfileIgnoredSpeedBump'

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

/** Returns the speed bump a user's profile opens behind, if any: blocked, or ignored unless turned off. */
function speedBumpOf(
    session: Session,
    userId: string,
): Restriction | undefined {
    const relationship = session.get(relationshipsStore).getState().byId[userId]
    if (relationship?.type === RelationshipType.BLOCKED) return 'block'
    const disabled = session
        .get(settingsStore)
        .getState().ignoreProfileSpeedbumpDisabled
    if (relationship?.user_ignored && !disabled) return 'ignore'
    return undefined
}

/**
 * showUserProfileActionSheet: opens the profile sheet of a user, on the server's profile when `guildId` is given.
 * Replaces a profile open. A user you blocked or ignored gets "Show Profile?" first.
 */
export function openProfileSheet(
    session: Session,
    userId: string,
    guildId?: string,
): void {
    if (!ProfileSheet) throw new Error('The profile sheet is not registered')
    const Sheet = ProfileSheet
    const open = () =>
        openActionSheet(
            PROFILE_SHEET_KEY,
            <Sheet userId={userId} guildId={guildId} />,
        )
    const user = session.get(usersStore).getState().users[userId]
    const restriction = speedBumpOf(session, userId)
    // The speed bump draws nothing without the user, and would never close.
    if (!restriction || !user) {
        open()
        return
    }
    const nick = guildId
        ? session.get(membersStore).getState().members[guildId]?.[userId]?.nick
        : undefined
    openActionSheet(
        `${SPEED_BUMP_KEY}${userId}`,
        <SpeedBumpSheet
            userId={userId}
            name={displayName(user, nick)}
            restriction={restriction}
            onShow={open}
        />,
    )
}
