import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { ChannelType } from '../../../core/discord/channelType'
import { Permission } from '../../../core/discord/permissions'
import { useSessionStore } from '../../../core/react'
import { Text } from '../../../design/components/Text'
import { Icon } from '../../../design/icons/Icon'
import { channelsStore } from '../../../stores/channels/channels'
import { guildsStore } from '../../../stores/guilds'
import { useChannelPermissions } from '../../../stores/permissions'
import {
    channelVoiceStates,
    voiceStatesStore,
} from '../../../stores/voiceStates'
import { channelVideoLimit } from '../joinChecks'
import { rtcStore } from '../rtc'

/** VoiceChannelUserLimit: the pill's height, also the slant's. */
const PILL_HEIGHT = 20
/** VoiceChannelUserLimit wrapper borderRadius. */
const PILL_RADIUS = 10
/** VoiceChannelUserLimit mid: the slant between the two halves. */
const SLANT_WIDTH = 6
/** VoiceChannelUserLimit mid paddingRight and right paddingLeft. */
const SLANT_GAP = 2
/** VoiceChannelUserLimit pads both counts to two digits. */
const COUNT_DIGITS = 2

/** ConnectedUserLimit: the user limit of a channel without one. */
const NO_USER_LIMIT = -1

const pad = (count: number) => count.toString().padStart(COUNT_DIGITS, '0')

/**
 * ConnectedUserLimit: the channel's user limit, or the guild's video limit when video is on and it is lower.
 * A total of 0 or less means no limit.
 */
function connectedUserLimit(
    userLimit: number,
    videoLimit: number,
    video: boolean,
): { total: number; videoLimit: boolean } {
    const limit = userLimit > 0 ? userLimit : NO_USER_LIMIT
    if (!video || videoLimit <= 0) return { total: limit, videoLimit: false }
    return {
        total: limit > 0 ? Math.min(limit, videoLimit) : videoLimit,
        videoLimit: limit < 0 || videoLimit < limit,
    }
}

/** VoiceChannelUserLimit: users and total in two halves split by a slant. A camera marks the video limit. */
function VoiceChannelUserLimit({
    users,
    total,
    videoLimit,
}: {
    users: number
    total: number
    videoLimit: boolean
}) {
    return (
        <View style={styles.wrapper}>
            <View style={styles.left}>
                {videoLimit && (
                    <Icon
                        name="VideoIcon"
                        size="xs"
                        color="VOICE_CHANNEL_USER_LIMIT_ICON"
                        style={styles.videoIcon}
                    />
                )}
                <Text
                    variant="text-xs/medium"
                    color="VOICE_CHANNEL_USER_LIMIT_TEXT"
                    lineClamp={1}
                >
                    {pad(users)}
                </Text>
            </View>
            <View style={styles.mid} />
            <View style={styles.right}>
                <Text
                    variant="text-xs/medium"
                    color="VOICE_CHANNEL_USER_LIMIT_TEXT"
                    lineClamp={1}
                >
                    {pad(total)}
                </Text>
            </View>
        </View>
    )
}

/**
 * ChannelInfo's LimitAndDurationInfo with ConnectedUserLimit: the pill on a voice channel with a limit. Hidden
 * without CONNECT and on the channel we are in (useShowConnectedUserLimit). A stage shows it only with media.
 */
export function ConnectedUserLimit({
    guildId,
    channelId,
}: {
    guildId: string
    channelId: string
}) {
    const type = useSessionStore(
        channelsStore,
        state => state.channels[channelId]?.type,
    )
    const userLimit = useSessionStore(
        channelsStore,
        state => state.channels[channelId]?.user_limit ?? 0,
    )
    const users = useSessionStore(
        voiceStatesStore,
        state => channelVoiceStates(state, channelId).length,
    )
    const hasVideo = useSessionStore(voiceStatesStore, state =>
        channelVoiceStates(state, channelId).some(voice => voice.selfVideo),
    )
    const hasStream = useSessionStore(voiceStatesStore, state =>
        channelVoiceStates(state, channelId).some(voice => voice.selfStream),
    )
    const videoLimit = useSessionStore(guildsStore, state =>
        channelVideoLimit(
            state.guilds[guildId],
            type ?? ChannelType.GUILD_VOICE,
        ),
    )
    const selected = useSessionStore(
        rtcStore,
        state => state.channelId === channelId,
    )
    const locked =
        (useChannelPermissions(channelId) & Permission.CONNECT) === 0n
    const stage = type === ChannelType.GUILD_STAGE_VOICE
    // StageMediaHooks.getStageHasMedia: video or a stream on the stage.
    const video = hasVideo || (stage && hasStream)
    // StageVoiceChannel: enableConnectedUserLimit only while the stage has media.
    if (stage && !video) return null
    const limit = connectedUserLimit(userLimit, videoLimit, video)
    if (limit.total <= 0 || locked || selected) return null
    return (
        <VoiceChannelUserLimit
            users={users}
            total={limit.total}
            videoLimit={limit.videoLimit}
        />
    )
}

const styles = StyleSheet.create(theme => ({
    wrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: PILL_RADIUS,
        borderWidth: theme.modules.mobile.VOICE_CHANNEL_USER_LIMIT_BORDER_WIDTH,
        borderColor: theme.colors.BORDER_SUBTLE,
        overflow: 'hidden',
        backgroundColor: theme.colors.VOICE_CHANNEL_USER_LIMIT_BACKGROUND,
    },
    left: {
        height: PILL_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: theme.space.PX_6,
        backgroundColor: theme.colors.VOICE_CHANNEL_USER_LIMIT_BACKGROUND,
    },
    videoIcon: { marginRight: theme.space.PX_4 },
    // A right border on a box with only a top border draws a triangle: the slant into the accent half.
    mid: {
        borderTopWidth: PILL_HEIGHT,
        borderBottomWidth: 0,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderRightWidth: SLANT_WIDTH,
        borderRightColor:
            theme.colors.VOICE_CHANNEL_USER_LIMIT_ACCENT_BACKGROUND,
        paddingRight: SLANT_GAP,
    },
    right: {
        height: PILL_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: SLANT_GAP,
        paddingRight: theme.space.PX_6,
        backgroundColor:
            theme.colors.VOICE_CHANNEL_USER_LIMIT_ACCENT_BACKGROUND,
    },
}))
