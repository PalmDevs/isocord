import { useEffect } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSessionStore } from '../../../core/react'
import {
    ActionSheet,
    ActionSheetHeaderBar,
} from '../../../design/components/sheets/Sheet'
import { useCloseSheet } from '../../../design/components/sheets/sheetContext'
import { guildsStore } from '../../../stores/guilds'
import { GuildActionSheetEmojiSection } from './GuildActionSheetEmojiSection'
import { GuildDeveloperActions } from './GuildDeveloperActions'
import { GuildLeaveActions } from './GuildLeaveActions'
import { GuildProfileActions } from './GuildProfileActions'
import { GuildQuickActions } from './GuildQuickActions'
import { GuildReadActions } from './GuildReadActions'
import { GuildActionSheetHeader } from './header/GuildActionSheetHeader'
import type { GuildActionNavigation } from './types'

/**
 * GuildActionSheet: server overview, quick action buttons, reading & channel tools,
 * per-server profile/privacy preferences, custom emojis, developer options, and leave server.
 */
export function GuildActionSheet({
    guildId,
    navigation,
    onOpenSearch,
}: {
    guildId: string
    navigation?: GuildActionNavigation
    onOpenSearch?: () => void
}) {
    const close = useCloseSheet()
    const guild = useSessionStore(guildsStore, state => state.guilds[guildId])

    useEffect(() => {
        if (!guild) close()
    }, [guild, close])
    if (!guild) return null

    const hasBanner = Boolean(guild.banner)

    return (
        <ActionSheet
            scrollable
            startExpanded
            handleDisabled={hasBanner}
            contentStyles={styles.sheet}
            bodyStyles={styles.body}
        >
            <View>
                <GuildActionSheetHeader guild={guild} />
                {hasBanner && (
                    <View style={styles.floatingHandle}>
                        <ActionSheetHeaderBar onPress={close} />
                    </View>
                )}
            </View>

            <View style={styles.actionsBody}>
                <GuildQuickActions guild={guild} onOpenSearch={onOpenSearch} />
                <GuildReadActions guild={guild} navigation={navigation} />
                <GuildProfileActions guild={guild} />
                <GuildActionSheetEmojiSection guildId={guild.id} />
                <GuildDeveloperActions guild={guild} />
                <GuildLeaveActions guild={guild} />
            </View>
        </ActionSheet>
    )
}

const styles = StyleSheet.create(theme => ({
    sheet: { paddingHorizontal: 0 },
    body: { gap: theme.space.PX_16 },
    floatingHandle: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    actionsBody: {
        paddingHorizontal: theme.space.PX_16,
        gap: theme.space.PX_24,
    },
}))
