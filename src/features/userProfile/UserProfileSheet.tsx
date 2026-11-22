import { useContext, useState } from 'react'
import { View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { IconButton } from '../../design/components/buttons/IconButton'
import { ContextMenu } from '../../design/components/overlays/ContextMenu'
import {
    ActionSheet,
    ActionSheetHeaderBar,
} from '../../design/components/sheets/Sheet'
import {
    SheetContext,
    useCloseSheet,
} from '../../design/components/sheets/sheetContext'
import { t } from '../../i18n'
import { profileBackground } from './profileColors'
import { ProfileThemeScope } from './profileTheme'
import { UserProfile } from './UserProfile'
import { useProfileMenu } from './useProfileMenu'
import { useProfileView } from './useProfileView'
import type { ProfileView } from './useProfileView'

/** A start height past the limit: the sheet has one snap, its full height, and cannot collapse. */
const FULL_HEIGHT = Number.POSITIVE_INFINITY

/**
 * UserProfileActionSheet with the main tab only. Opens on the server's profile when given a server, which the more
 * menu switches to the main one and back.
 */
export function UserProfileSheet({
    userId,
    guildId: contextGuildId,
}: {
    userId: string
    guildId?: string
}) {
    const { theme } = useUnistyles()
    const closeSheet = useCloseSheet()
    const { closing } = useContext(SheetContext)
    const [guildId, setGuildId] = useState(contextGuildId)
    // Reopened in place on another user or server, such as from the mutuals sheet: start on the new server.
    const opened = `${userId}:${contextGuildId}`
    const [shown, setShown] = useState(opened)
    if (shown !== opened) {
        setShown(opened)
        setGuildId(contextGuildId)
    }
    const view = useProfileView(userId, guildId)
    if (!view) return null
    return (
        <ActionSheet
            scrollable
            startHeight={FULL_HEIGHT}
            handleDisabled
            contentStyles={styles.sheet}
            bodyStyles={styles.body}
            backgroundStyles={
                view.themeColors
                    ? profileBackground(view.themeColors)
                    : undefined
            }
        >
            <View>
                <UserProfile
                    userId={userId}
                    guildId={guildId}
                    background={theme.colors.MOBILE_ACTIONSHEET_BACKGROUND}
                    active={!closing}
                    action={
                        <ProfileMoreButton
                            view={view}
                            contextGuildId={contextGuildId}
                            onToggleServer={() =>
                                setGuildId(guildId ? undefined : contextGuildId)
                            }
                        />
                    }
                />
                <View style={styles.handle}>
                    <ProfileThemeScope colors={view.themeColors}>
                        <ActionSheetHeaderBar onPress={closeSheet} />
                    </ProfileThemeScope>
                </View>
            </View>
        </ActionSheet>
    )
}

/** UserProfileHeader's more button and its menu. */
function ProfileMoreButton({
    view,
    contextGuildId,
    onToggleServer,
}: {
    view: ProfileView
    contextGuildId: string | undefined
    onToggleServer: () => void
}) {
    const menu = useProfileMenu(view, onToggleServer, contextGuildId)
    return (
        <ContextMenu items={menu} triggerOnLongPress={false}>
            {({ open }) => (
                <IconButton
                    icon="MoreHorizontalIcon"
                    variant="secondary-overlay"
                    size="sm"
                    accessibilityLabel={t('userProfile.moreOptions')}
                    onPress={open}
                />
            )}
        </ContextMenu>
    )
}

const styles = StyleSheet.create({
    sheet: { paddingHorizontal: 0 },
    body: { gap: 0 },
    handle: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
})
