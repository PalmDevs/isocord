import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { RipplePressable } from '../../../../design/components/buttons/RipplePressable'
import { Text } from '../../../../design/components/Text'
import { VoiceStateIcons } from '../../rows/VoiceStateIcons'
import type { VoiceState } from '../../../../stores/voiceStates'

/**
 * FloatingParticipantLabel: the name pill at the bottom of every panel card, camera or stream. Pressing it opens the
 * profile. A participant's card adds their mute and deafen marks.
 */
export function ParticipantLabel({
    name,
    voice,
    onPress,
}: {
    name: string
    voice?: VoiceState
    onPress: () => void
}) {
    return (
        <View pointerEvents="box-none" style={styles.footer}>
            <RipplePressable
                accessibilityRole="button"
                accessibilityLabel={name}
                onPress={onPress}
                style={styles.pill}
            >
                <Text
                    variant="text-sm/semibold"
                    color="WHITE"
                    lineClamp={1}
                    style={styles.name}
                >
                    {name}
                </Text>
                {voice && <VoiceStateIcons voice={voice} color="WHITE" />}
            </RipplePressable>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    footer: {
        position: 'absolute',
        left: theme.space.PX_8,
        right: theme.space.PX_8,
        bottom: theme.space.PX_8,
        flexDirection: 'row',
    },
    pill: {
        flexShrink: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_4,
        paddingHorizontal: theme.space.PX_8,
        paddingVertical: theme.space.PX_4,
        borderRadius: theme.radii.round,
        backgroundColor: theme.colors.BACKGROUND_SCRIM,
    },
    name: { flexShrink: 1 },
}))
