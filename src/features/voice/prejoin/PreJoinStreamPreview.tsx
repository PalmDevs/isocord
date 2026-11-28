import { Image } from 'expo-image'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Permission } from '../../../core/discord/permissions'
import { useSession, useSessionStore } from '../../../core/react'
import { Button } from '../../../design/components/buttons/Button'
import { RipplePressable } from '../../../design/components/buttons/RipplePressable'
import { Text } from '../../../design/components/Text'
import { t } from '../../../i18n'
import { useChannelPermissions } from '../../../stores/permissions'
import { STREAM_ASPECT_RATIO } from '../panel/grid/StreamCard'
import { useParticipantName } from '../panel/grid/useParticipantName'
import { streamsStore } from '../streams'
import { watchFromPreJoin } from './preJoinActions'
import { useStreamPreview } from './streamPreviews'

/** VoicePanelStreamPreview streamPreviewImage: the thumbnail is dimmed under the button. */
const PREVIEW_OPACITY = 0.5

/**
 * VoicePanelStreamPreview: a stream's thumbnail with Watch Stream over it. Our own stream, sent from another device,
 * cannot be watched here: a notice replaces the button.
 */
function StreamPreview({
    guildId,
    channelId,
    ownerId,
    disabled,
    onPress,
}: {
    guildId: string
    channelId: string
    ownerId: string
    disabled: boolean
    onPress: () => void
}) {
    const session = useSession()
    const url = useStreamPreview(guildId, channelId, ownerId)
    const ownElsewhere = useSessionStore(
        streamsStore,
        state => ownerId === session.userId && !state.own,
    )
    return (
        <RipplePressable
            accessible={false}
            disabled={disabled || ownElsewhere}
            onPress={onPress}
            style={styles.card}
        >
            {url !== null && (
                <Image source={url} contentFit="cover" style={styles.image} />
            )}
            {ownElsewhere ? (
                <View style={styles.ownNotice}>
                    <Text
                        variant="text-sm/semibold"
                        color="TEXT_OVERLAY_LIGHT"
                        style={styles.ownText}
                    >
                        {t('voice.ownStreamElsewhere')}
                    </Text>
                </View>
            ) : (
                <Button
                    size="sm"
                    variant="primary-overlay"
                    text={t('voice.watchStream')}
                    disabled={disabled}
                    onPress={onPress}
                />
            )}
        </RipplePressable>
    )
}

/**
 * VoicePanelPreJoinContent StreamPreview: "{username}'s stream" over its preview. Pressing it joins the channel and
 * watches the stream. Without CONNECT it is disabled.
 */
export function PreJoinStreamPreview({
    guildId,
    channelId,
    ownerId,
}: {
    guildId: string
    channelId: string
    ownerId: string
}) {
    const session = useSession()
    const name = useParticipantName(ownerId, guildId)
    const canConnect =
        (useChannelPermissions(channelId) & Permission.CONNECT) !== 0n
    return (
        <View style={styles.wrapper}>
            <Text
                variant="text-sm/semibold"
                color="TEXT_DEFAULT"
                style={styles.title}
            >
                {t('voice.userStream', { username: name })}
            </Text>
            <View style={styles.frame}>
                <StreamPreview
                    guildId={guildId}
                    channelId={channelId}
                    ownerId={ownerId}
                    disabled={!canConnect}
                    onPress={() =>
                        void watchFromPreJoin(
                            session,
                            guildId,
                            channelId,
                            ownerId,
                        )
                    }
                />
            </View>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    wrapper: { paddingHorizontal: theme.space.PX_16 },
    title: { marginBottom: theme.space.PX_8 },
    frame: {
        width: '100%',
        aspectRatio: STREAM_ASPECT_RATIO,
        borderRadius: theme.radii.lg,
        overflow: 'hidden',
        justifyContent: 'center',
        backgroundColor: theme.colors.BLACK,
    },
    card: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.VOICE_VIDEO_VIDEO_TILE_BACKGROUND,
    },
    image: { ...StyleSheet.absoluteFillObject, opacity: PREVIEW_OPACITY },
    ownNotice: {
        marginHorizontal: theme.space.PX_16,
        borderRadius: theme.radii.sm,
        backgroundColor: theme.colors.BACKGROUND_SCRIM,
    },
    ownText: { textAlign: 'center', padding: theme.space.PX_16 },
}))
