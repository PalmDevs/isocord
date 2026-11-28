import { useEffect, useState } from 'react'
import { View } from 'react-native'
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../../../core/react'
import { Avatar } from '../../../../design/components/avatars/Avatar'
import { RipplePressable } from '../../../../design/components/buttons/RipplePressable'
import { Text } from '../../../../design/components/Text'
import { VOICE_SPEAKING_SPRING } from '../../../../design/tokens/motion'
import { t } from '../../../../i18n'
import { usersStore } from '../../../../stores/users'
import { useCallChannelName } from '../../channelTitle'
import { DeafenButton } from '../../controls/DeafenButton'
import { DisconnectButton } from '../../controls/DisconnectButton'
import { MuteButton } from '../../controls/MuteButton'
import {
    PushToTalkButton,
    usePushToTalk,
} from '../../controls/PushToTalkButton'
import { rtcStore } from '../../rtc'
import { PIP_PADDING } from './dockConstants'
import type { PipSize } from './useDockMotion'

/** The last speaker's avatar. */
const AVATAR_SIZE = 32
/** The avatar's opacity once its user has stopped speaking. */
const SILENT_OPACITY = 0.5

/**
 * VoicePanelPIP's contents: the last speaker's avatar and the channel's name over mute, deafen and disconnect.
 * Push to talk puts a small hold button in mute's place (VoicePanelPIPPushToTalkOverlay holds the whole PIP). The
 * buttons set the width, and the name is cut to it. The dock's card shrinks around them as it minimizes, so they
 * report their size. Tapping the name calls `onPress`. The call overlay shows it too, without a dock.
 */
export function VoicePip({
    channelId,
    onPress,
    onSize,
}: {
    channelId: string
    onPress: () => void
    onSize?: (size: PipSize) => void
}) {
    const channelName = useCallChannelName(channelId)
    const [buttonsWidth, setButtonsWidth] = useState(0)
    const pushToTalk = usePushToTalk(channelId)
    return (
        <View
            style={styles.pip}
            onLayout={event => {
                const { width, height } = event.nativeEvent.layout
                onSize?.({ width, height })
            }}
        >
            <RipplePressable
                accessibilityRole="button"
                accessibilityLabel={t('voice.expand')}
                onPress={onPress}
                style={styles.info(buttonsWidth)}
            >
                <SpeakerAvatar />
                <Text
                    variant="text-sm/semibold"
                    lineClamp={1}
                    style={styles.name}
                >
                    {channelName}
                </Text>
            </RipplePressable>
            <View
                style={styles.buttons}
                onLayout={event =>
                    setButtonsWidth(event.nativeEvent.layout.width)
                }
            >
                {pushToTalk ? (
                    <PushToTalkButton compact />
                ) : (
                    <MuteButton channelId={channelId} />
                )}
                <DeafenButton />
                <DisconnectButton />
            </View>
        </View>
    )
}

/**
 * VoicePanelPIPContent's User: the last user who spoke, or us before anyone has. Full opacity while they speak,
 * dimmed after.
 */
function SpeakerAvatar() {
    const session = useSession()
    const userId = useSessionStore(
        rtcStore,
        state => state.lastSpeaker ?? session.userId,
    )
    const speaking = useSessionStore(rtcStore, state =>
        state.speaking.includes(userId),
    )
    const user = useSessionStore(usersStore, state => state.users[userId])
    const opacity = useSharedValue(speaking ? 1 : SILENT_OPACITY)
    useEffect(() => {
        opacity.set(
            withSpring(speaking ? 1 : SILENT_OPACITY, VOICE_SPEAKING_SPRING),
        )
    }, [opacity, speaking])
    const style = useAnimatedStyle(() => ({ opacity: opacity.get() }))
    return (
        <Animated.View style={style}>
            <Avatar
                user={user ?? { id: userId, avatar: null }}
                size={AVATAR_SIZE}
            />
        </Animated.View>
    )
}

const styles = StyleSheet.create(theme => ({
    pip: {
        gap: theme.space.PX_4,
        padding: theme.space[PIP_PADDING],
    },
    info: (width: number) => ({
        width,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_8,
        padding: theme.space.PX_4,
        borderRadius: theme.modules.button.BORDER_RADIUS,
    }),
    name: { flexShrink: 1 },
    buttons: { flexDirection: 'row', gap: theme.space.PX_4 },
}))
