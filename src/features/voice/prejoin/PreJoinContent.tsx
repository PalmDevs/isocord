import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { RelationshipType } from '../../../core/discord/relationships'
import { useSessionStore } from '../../../core/react'
import { Text } from '../../../design/components/Text'
import { t } from '../../../i18n'
import { channelsStore } from '../../../stores/channels/channels'
import { guildsStore } from '../../../stores/guilds'
import { relationshipsStore } from '../../../stores/relationships'
import {
    channelVoiceStates,
    voiceStatesStore,
} from '../../../stores/voiceStates'
import { PreJoinBlockedWarning } from './PreJoinBlockedWarning'
import { PreJoinMemberSection, PreJoinMembers } from './PreJoinMembers'
import { PreJoinStreamPreview } from './PreJoinStreamPreview'
import { useSortedVoiceStates } from './useSortedVoiceStates'
import type { VoiceState } from '../../../stores/voiceStates'

/** VoicePanelHeader's title in the pre-join state: the channel's name over the server's. */
export function PreJoinHeader({
    guildId,
    channelId,
}: {
    guildId: string
    channelId: string
}) {
    const channelName = useSessionStore(
        channelsStore,
        state => state.channels[channelId]?.name,
    )
    const guildName = useSessionStore(
        guildsStore,
        state => state.guilds[guildId]?.name,
    )
    return (
        <View style={styles.header}>
            <Text
                variant="heading-md/semibold"
                lineClamp={1}
                accessibilityRole="header"
            >
                {channelName}
            </Text>
            <Text variant="text-sm/medium" color="TEXT_MUTED" lineClamp={1}>
                {guildName}
            </Text>
        </View>
    )
}

/** VoicePanelPreJoinContent ChannelInfo: the empty channel's invitation. */
function ChannelInfo() {
    return (
        <View style={styles.channelInfo}>
            <Text
                variant="text-sm/medium"
                color="TEXT_DEFAULT"
                style={styles.subheading}
            >
                {t('voice.preJoin.empty')}
            </Text>
        </View>
    )
}

/**
 * VoiceChannelBlockedUserStore: the members we block and ignore. The selector returns ids joined, so it stays a
 * primitive.
 */
function useHiddenMembers(members: readonly VoiceState[]) {
    const ids = members.map(voice => voice.userId)
    const blockedIds = useSessionStore(relationshipsStore, state =>
        ids
            .filter(id => state.byId[id]?.type === RelationshipType.BLOCKED)
            .join(','),
    )
    const ignoredIds = useSessionStore(relationshipsStore, state =>
        ids
            .filter(
                id =>
                    state.byId[id]?.type !== RelationshipType.BLOCKED &&
                    state.byId[id]?.user_ignored === true,
            )
            .join(','),
    )
    const blocked = new Set(blockedIds.split(',').filter(Boolean))
    const ignored = new Set(ignoredIds.split(',').filter(Boolean))
    return {
        blocked: members.filter(voice => blocked.has(voice.userId)),
        ignored: members.filter(voice => ignored.has(voice.userId)),
        others: members.filter(
            voice => !blocked.has(voice.userId) && !ignored.has(voice.userId),
        ),
    }
}

/** RoomMembers' blocked and ignored sections, each titled with its count. */
function HiddenSections({
    blocked,
    ignored,
}: {
    blocked: readonly VoiceState[]
    ignored: readonly VoiceState[]
}) {
    return (
        <>
            {blocked.length > 0 && (
                <PreJoinMemberSection
                    title={t(
                        blocked.length === 1
                            ? 'voice.preJoin.blockedSection.one'
                            : 'voice.preJoin.blockedSection.other',
                        { count: blocked.length },
                    )}
                    members={blocked}
                />
            )}
            {ignored.length > 0 && (
                <PreJoinMemberSection
                    title={t(
                        ignored.length === 1
                            ? 'voice.preJoin.ignoredSection.one'
                            : 'voice.preJoin.ignoredSection.other',
                        { count: ignored.length },
                    )}
                    members={ignored}
                />
            )}
        </>
    )
}

/**
 * VoicePanelPreJoinContentInner: the empty state, the blocked warning, a preview per stream, then who is in the
 * channel, blocked and ignored people apart (RoomMembers). Activities and games are not ported.
 */
export function PreJoinContent({
    guildId,
    channelId,
}: {
    guildId: string
    channelId: string
}) {
    const states = useSessionStore(voiceStatesStore, state =>
        channelVoiceStates(state, channelId),
    )
    const members = useSortedVoiceStates(guildId, states)
    const { blocked, ignored, others } = useHiddenMembers(members)
    const hidden = blocked.length + ignored.length
    return (
        <View style={styles.content}>
            {members.length === 0 && <ChannelInfo />}
            {hidden > 0 && (
                <PreJoinBlockedWarning
                    blocked={blocked.length}
                    ignored={ignored.length}
                />
            )}
            {members
                .filter(voice => voice.selfStream)
                .map(voice => (
                    <PreJoinStreamPreview
                        key={voice.userId}
                        guildId={guildId}
                        channelId={channelId}
                        ownerId={voice.userId}
                    />
                ))}
            <HiddenSections blocked={blocked} ignored={ignored} />
            {others.length > 0 && (
                <PreJoinMembers members={others} others={hidden > 0} />
            )}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    header: {
        paddingHorizontal: theme.space.PX_16,
        paddingBottom: theme.space.PX_8,
    },
    // VoicePanelPreJoinContent contentWrapper, below our header.
    content: { gap: theme.space.PX_24, paddingBottom: theme.space.PX_16 },
    channelInfo: { paddingHorizontal: theme.space.PX_16 },
    subheading: { textAlign: 'center', paddingVertical: theme.space.PX_16 },
}))
