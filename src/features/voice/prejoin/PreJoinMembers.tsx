import { useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../../core/react'
import { Avatar } from '../../../design/components/avatars/Avatar'
import { Text } from '../../../design/components/Text'
import { TableRow } from '../../../design/components/table/TableRow'
import { TableRowGroup } from '../../../design/components/table/TableRowGroup'
import { Icon } from '../../../design/icons/Icon'
import { t } from '../../../i18n'
import { usersStore } from '../../../stores/users'
import { openProfileSheet } from '../../userProfile/openProfileSheet'
import { useParticipantName } from '../panel/grid/useParticipantName'
import { LiveTag } from '../rows/LiveTag'
import type { IconName } from '../../../design/icons/Icon'
import type { VoiceState } from '../../../stores/voiceStates'

/** RoomMembers: rows shown at first, and how many more each "Load more" adds. */
const MEMBERS_PAGE = 20
/** MemberRowItem: AvatarSizes.REFRESH_MEDIUM_32. */
const AVATAR_SIZE = 32
/**
 * VoiceStateIconUtils.useMuteDeafenIconState and MuteDeafenIcon: the one mute or deafen badge a row shows, the
 * strongest first. A moderator's is critical red.
 */
function muteDeafenIcon(
    voice: VoiceState,
): { name: IconName; critical: boolean } | null {
    if (voice.deaf) return { name: 'HeadphonesDenyIcon', critical: true }
    if (voice.selfDeaf) return { name: 'HeadphonesSlashIcon', critical: false }
    if (voice.mute) return { name: 'MicrophoneDenyIcon', critical: true }
    if (voice.selfMute) return { name: 'MicrophoneSlashIcon', critical: false }
    return null
}

/** FormComponents VoiceBadges: a round badge per icon. */
function VoiceBadge({ icon, critical }: { icon: IconName; critical: boolean }) {
    return (
        <View style={styles.badge}>
            <Icon
                name={icon}
                size="xs"
                color={
                    critical
                        ? 'ICON_FEEDBACK_CRITICAL'
                        : 'INTERACTIVE_TEXT_DEFAULT'
                }
            />
        </View>
    )
}

/**
 * FormComponents VoiceBadges: mute or deafen, then video. The LIVE tag after them is ours: the reference shows a
 * streamer's preview above the list instead.
 */
function VoiceBadges({ voice }: { voice: VoiceState }) {
    const muteDeafen = muteDeafenIcon(voice)
    return (
        <View style={styles.badges}>
            {muteDeafen && (
                <VoiceBadge
                    icon={muteDeafen.name}
                    critical={muteDeafen.critical}
                />
            )}
            {voice.selfVideo && (
                <VoiceBadge icon="VideoIcon" critical={false} />
            )}
            {voice.selfStream && (
                <View style={styles.live}>
                    <LiveTag />
                </View>
            )}
        </View>
    )
}

/** FormComponents MemberRowItem: avatar, name and voice badges. Opens the user's profile. */
function MemberRow({ voice }: { voice: VoiceState }) {
    const session = useSession()
    const user = useSessionStore(usersStore, state => state.users[voice.userId])
    const name = useParticipantName(voice.userId, voice.guildId)
    return (
        <TableRow
            icon={
                <Avatar
                    user={user ?? { id: voice.userId, avatar: null }}
                    size={AVATAR_SIZE}
                />
            }
            label={
                <Text
                    variant="text-md/semibold"
                    color="TEXT_DEFAULT"
                    lineClamp={1}
                >
                    {name}
                </Text>
            }
            trailing={<VoiceBadges voice={voice} />}
            onPress={() =>
                openProfileSheet(
                    session,
                    voice.userId,
                    voice.guildId ?? undefined,
                )
            }
        />
    )
}

/** RoomMembers' title: "N People in Voice", or "N Other People" when blocked or ignored people are listed apart. */
function membersTitle(count: number, others: boolean): string {
    if (others)
        return t(
            count === 1
                ? 'voice.preJoin.othersInVoice.one'
                : 'voice.preJoin.othersInVoice.other',
            { count },
        )
    return t(
        count === 1
            ? 'voice.preJoin.inVoice.one'
            : 'voice.preJoin.inVoice.other',
        { count },
    )
}

/** RoomMembersSection: the people we have blocked or ignored, all at once. */
export function PreJoinMemberSection({
    title,
    members,
}: {
    title: string
    members: readonly VoiceState[]
}) {
    return (
        <View style={styles.section}>
            <TableRowGroup hasIcons title={title}>
                {members.map(voice => (
                    <MemberRow key={voice.userId} voice={voice} />
                ))}
            </TableRowGroup>
        </View>
    )
}

/** RoomMembers: the channel's other members, 20 at a time. `others` when some are listed apart. */
export function PreJoinMembers({
    members,
    others,
}: {
    members: readonly VoiceState[]
    others: boolean
}) {
    const [shown, setShown] = useState(MEMBERS_PAGE)
    const count = members.length
    return (
        <View style={styles.section}>
            <TableRowGroup hasIcons title={membersTitle(count, others)}>
                {members.slice(0, shown).map(voice => (
                    <MemberRow key={voice.userId} voice={voice} />
                ))}
                {count > shown && (
                    <TableRow
                        label={t('voice.preJoin.loadMore')}
                        onPress={() => setShown(shown + MEMBERS_PAGE)}
                    />
                )}
            </TableRowGroup>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    // VoicePanelFormSection container.
    section: { marginHorizontal: theme.space.PX_16 },
    badges: { flexDirection: 'row', alignItems: 'center' },
    badge: {
        marginLeft: theme.space.PX_8,
        padding: theme.space.PX_6,
        borderRadius: theme.radii.round,
        backgroundColor: theme.colors.MOBILE_VOICE_PANEL_BADGE_BACKGROUND,
    },
    live: { marginLeft: theme.space.PX_8 },
}))
