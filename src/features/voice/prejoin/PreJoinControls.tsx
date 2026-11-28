import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSession } from '../../../core/react'
import { Button } from '../../../design/components/buttons/Button'
import { IconButton } from '../../../design/components/buttons/IconButton'
import { t } from '../../../i18n'
import { openChannel } from '../../chat/links/openChannel'
import { MuteButton } from '../controls/MuteButton'
import { joinFromPreJoin } from './preJoinActions'

/**
 * The pre-join card's controls. First useControlsButtons' disconnected row: the mic, Join Voice
 * (VoicePanelConnectButton) filling the rest, and the channel's chat. Then camera, screen share and soundboard,
 * shown disabled until the call starts.
 */
export function PreJoinControls({
    guildId,
    channelId,
}: {
    guildId: string
    channelId: string
}) {
    const session = useSession()
    return (
        <View style={styles.controls}>
            <View style={styles.main}>
                <MuteButton channelId={channelId} />
                <Button
                    variant="active"
                    text={t('voice.joinVoice')}
                    accessibilityLabel={t('voice.joinVoice')}
                    onPress={() => joinFromPreJoin(session, guildId, channelId)}
                    style={styles.join}
                />
                <IconButton
                    size="md"
                    variant="secondary"
                    icon="ChatIcon"
                    accessibilityLabel={t('voice.openChat')}
                    // The chat slides over the tab bar, which dismisses the card.
                    onPress={() => openChannel(channelId)}
                />
            </View>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    // VoiceControls' padding and gaps, so the call's controls take the same place.
    controls: {
        gap: theme.space.PX_8,
        paddingHorizontal: theme.space.PX_8,
        paddingBottom: theme.space.PX_8,
    },
    main: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_8,
    },
    join: { flex: 1 },
}))
