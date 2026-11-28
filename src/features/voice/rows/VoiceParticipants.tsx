import { useEffect } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../../core/react'
import {
    AnimatedEnterExitItem,
    useEnterExitItems,
} from '../../../design/components/AnimatedEnterExitItem'
import { Avatar } from '../../../design/components/avatars/Avatar'
import { RipplePressable } from '../../../design/components/buttons/RipplePressable'
import { Text } from '../../../design/components/Text'
import { Icon } from '../../../design/icons/Icon'
import { t } from '../../../i18n'
import { guildsStore } from '../../../stores/guilds'
import { membersStore, requestMembers } from '../../../stores/members'
import { displayName, usersStore } from '../../../stores/users'
import {
    channelVoiceStates,
    voiceStatesStore,
} from '../../../stores/voiceStates'
import { authorStyle } from '../../chat/author'
import { localVolumesStore } from '../localVolumes'
import { rtcStore } from '../rtc'
import { watchStream } from '../streamActions'
import { LiveTag } from './LiveTag'
import { VoiceStateIcons } from './VoiceStateIcons'
import { VoiceUserName } from './VoiceUserName'
import type { VoiceState } from '../../../stores/voiceStates'

/** VoiceChannel's `voiceStates` margin, before the row's own margin. */
const PARTICIPANTS_MARGIN = 36
/** VOICE_USERS_MARGIN_BOTTOM. */
const PARTICIPANTS_MARGIN_BOTTOM = 2
/** VoiceUserItem voiceState: paddingVertical. */
const PARTICIPANT_PADDING = 5
/** AvatarSizes.XSMALL_20. */
const AVATAR_SIZE = 20
/** The speaking ring's width, drawn outside the avatar so the row keeps its height. */
const SPEAKING_RING = 2
/** VoiceUserItem voiceStateIcon: makeSizeStyle(14). */
const STATE_ICON_SIZE = 14

/**
 * VoiceUserItem: avatar, name and server tag, then mute, deafen, video and LIVE. A streaming user in our channel
 * can be watched (StreamingUserRow).
 */
function VoiceParticipant({ voice }: { voice: VoiceState }) {
    const session = useSession()
    const user = useSessionStore(usersStore, state => state.users[voice.userId])
    const member = useSessionStore(membersStore, state =>
        voice.guildId
            ? state.members[voice.guildId]?.[voice.userId]
            : undefined,
    )
    const guild = useSessionStore(guildsStore, state =>
        voice.guildId ? state.guilds[voice.guildId] : undefined,
    )
    const localMute = useSessionStore(
        localVolumesStore,
        state => state.default[voice.userId]?.muted === true,
    )
    const speaking = useSessionStore(rtcStore, state =>
        state.speaking.includes(voice.userId),
    )
    const watchable = useSessionStore(
        rtcStore,
        state =>
            voice.selfStream &&
            voice.userId !== session.userId &&
            state.channelId === voice.channelId,
    )
    return (
        <View style={styles.participant}>
            <View>
                <Avatar
                    user={user ?? { id: voice.userId, avatar: null }}
                    size={AVATAR_SIZE}
                />
                {speaking && <View style={styles.speaking} />}
            </View>
            <VoiceUserName
                user={user}
                name={displayName(user, member?.nick)}
                color={authorStyle(guild, member).color}
            />
            <VoiceStateIcons
                voice={voice}
                color="REDESIGN_CHANNEL_NAME_MUTED_TEXT"
                localMute={localMute}
                style={styles.stateIcon}
            />
            {voice.selfVideo && (
                <Icon
                    name="VideoIcon"
                    size="xs"
                    color="REDESIGN_CHANNEL_NAME_MUTED_TEXT"
                    style={styles.stateIcon}
                />
            )}
            {voice.selfStream && (
                <View style={styles.trailing}>
                    <LiveTag />
                </View>
            )}
            {watchable && (
                <RipplePressable
                    accessibilityRole="button"
                    onPress={() => watchStream(session, voice.userId)}
                    style={[styles.trailing, styles.watch]}
                >
                    <Text variant="text-xs/semibold" color="TEXT_LINK">
                        {t('voice.watchStream')}
                    </Text>
                </RipplePressable>
            )}
        </View>
    )
}

/**
 * VoiceUsers: who is in a voice channel, under its row in the channel list. They sit inside the reference's
 * channel pressable, so a tap or long press acts on the channel. Rows grow in as users join and shrink out as they
 * leave (our addition).
 */
export function VoiceParticipants({
    guildId,
    channelId,
    onPress,
    onLongPress,
}: {
    guildId: string
    channelId: string
    onPress: () => void
    onLongPress: () => void
}) {
    const session = useSession()
    const states = useSessionStore(voiceStatesStore, state =>
        channelVoiceStates(state, channelId),
    )
    const { entries, onExited } = useEnterExitItems(
        states,
        voice => voice.userId,
        channelId,
    )
    const userIds = states.map(state => state.userId).join()
    // Voice states carry no names, so members the client has not loaded are asked for.
    useEffect(() => {
        if (userIds) requestMembers(session, guildId, userIds.split(','))
    }, [session, guildId, userIds])
    if (entries.length === 0) return null
    return (
        <RipplePressable
            accessibilityRole="button"
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.list}
        >
            {entries.map(entry => (
                <AnimatedEnterExitItem
                    key={entry.key}
                    animateHeight
                    entering={entry.enter ? undefined : null}
                    leaving={entry.leaving}
                    onExited={() => onExited(entry.key)}
                >
                    <VoiceParticipant voice={entry.item} />
                </AnimatedEnterExitItem>
            ))}
        </RipplePressable>
    )
}

const styles = StyleSheet.create(theme => ({
    // VoiceChannel voiceStates (VOICE_USERS_MARGIN_TOP and _BOTTOM), and VoiceUsersItem's paddingRight inside the
    // channel's horizontal margin.
    list: {
        marginLeft: PARTICIPANTS_MARGIN + theme.space.PX_8,
        marginTop: -theme.space.PX_4,
        marginBottom: PARTICIPANTS_MARGIN_BOTTOM,
        marginRight: theme.space.PX_8,
        paddingRight: theme.space.PX_8,
        borderRadius: theme.modules.mobile.CHANNEL_ITEM_RADIUS,
    },
    participant: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: PARTICIPANT_PADDING,
    },
    speaking: {
        position: 'absolute',
        top: -SPEAKING_RING,
        left: -SPEAKING_RING,
        right: -SPEAKING_RING,
        bottom: -SPEAKING_RING,
        borderRadius: theme.radii.round,
        borderWidth: SPEAKING_RING,
        borderColor: theme.colors.STATUS_SPEAKING,
    },
    // VoiceUserItem voiceStateIcon and legacyVoiceStateIcon.
    stateIcon: {
        width: STATE_ICON_SIZE,
        height: STATE_ICON_SIZE,
        marginLeft: theme.space.PX_6,
    },
    trailing: { marginLeft: theme.space.PX_6 },
    watch: {
        paddingHorizontal: theme.space.PX_8,
        paddingVertical: theme.space.PX_4,
        borderRadius: theme.radii.sm,
    },
}))
