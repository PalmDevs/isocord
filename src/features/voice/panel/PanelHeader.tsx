import { View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StyleSheet } from 'react-native-unistyles'
import { streamOwnerId } from '../../../core/discord/streams'
import { useSession, useSessionStore } from '../../../core/react'
import { IconButton } from '../../../design/components/buttons/IconButton'
import { NAV_BAR_HEIGHT } from '../../../design/components/layout/navBarHeight'
import { Text } from '../../../design/components/Text'
import { t } from '../../../i18n'
import native from '../../../native/IsocordVoice'
import { guildsStore } from '../../../stores/guilds'
import { useCallChannelName } from '../channelTitle'
import { rtcStore } from '../rtc'
import { stopStream } from '../streamActions'
import { streamsStore } from '../streams'
import { useDockPan } from './dock/useDockPan'
import { useParticipantName } from './grid/useParticipantName'
import type { DockMotion } from './dock/useDockMotion'

/** Between the channel's name and the stream it watches. */
const TITLE_SEPARATOR = ' • '

/**
 * VoicePanelHeader: the minimize button and the channel's title under the status bar, the camera switch while our
 * camera is on, and Stop Watching while we watch a stream. A drag down closes the panel.
 */
export function PanelHeader({ motion }: { motion: DockMotion }) {
    const insets = useSafeAreaInsets()
    const session = useSession()
    const pan = useDockPan(motion)
    const selfVideo = useSessionStore(rtcStore, state => state.selfVideo)
    // The stream we watch: our own is not "watched".
    const watching = useSessionStore(streamsStore, state =>
        state.streamKey !== null && !state.own
            ? streamOwnerId(state.streamKey)
            : null,
    )
    return (
        <GestureDetector gesture={pan}>
            <View style={styles.header(insets.top)}>
                <IconButton
                    size="md"
                    variant="icon-only"
                    icon="ChevronLargeDownIcon"
                    accessibilityLabel={t('voice.minimize')}
                    onPress={motion.collapse}
                />
                <PanelTitle watching={watching} />
                {selfVideo && (
                    // VoicePanelHeader: the camera switch, while our camera is on. The reference's icon is unresolved.
                    <IconButton
                        size="md"
                        variant="icon-only"
                        icon="RefreshIcon"
                        accessibilityLabel={t('voice.changeCamera')}
                        onPress={() => native?.switchCamera()}
                    />
                )}
                {watching !== null && (
                    <IconButton
                        size="md"
                        variant="destructive"
                        icon="ScreenXIcon"
                        accessibilityLabel={t('voice.stopWatching')}
                        onPress={() => stopStream(session)}
                    />
                )}
            </View>
        </GestureDetector>
    )
}

/** The channel's name, and whose stream we watch beside it, over the server's name. */
function PanelTitle({ watching }: { watching: string | null }) {
    const channelId = useSessionStore(rtcStore, state => state.channelId)
    const channelName = useCallChannelName(channelId)
    const guildId = useSessionStore(rtcStore, state => state.guildId)
    const guildName = useSessionStore(guildsStore, state =>
        guildId ? state.guilds[guildId]?.name : undefined,
    )
    const streamer = useParticipantName(watching ?? '', guildId ?? '')
    return (
        <View style={styles.title}>
            <Text
                variant="heading-md/semibold"
                lineClamp={1}
                accessibilityRole="header"
            >
                {channelName}
                {watching !== null && (
                    <Text variant="heading-md/semibold" color="TEXT_MUTED">
                        {TITLE_SEPARATOR}
                        {/* "Watching {username}" with "{username}'s stream" (VoicePanelTitleButton StreamButton). */}
                        {t('voice.watchingUser', {
                            username: t('voice.userStream', {
                                username: streamer,
                            }),
                        })}
                    </Text>
                )}
            </Text>
            <Text variant="text-sm/medium" color="TEXT_MUTED" lineClamp={1}>
                {guildName}
            </Text>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    header: (top: number) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_8,
        height: top + theme.space.PX_4 + NAV_BAR_HEIGHT,
        paddingTop: top + theme.space.PX_4,
        paddingHorizontal: theme.space.PX_8,
    }),
    title: { flex: 1 },
}))
