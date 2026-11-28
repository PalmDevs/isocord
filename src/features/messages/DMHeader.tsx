import { View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { StatusAvatar } from '../../design/components/avatars/StatusAvatar'
import { NavigatorHeader } from '../../design/components/layout/NavigatorHeader'
import { Text } from '../../design/components/Text'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'
import { CallHeaderButton, VideoCallHeaderButton } from '../calls'
import { HeaderSearchButton } from '../chat/details/HeaderSearchButton'
import { GroupAvatar } from './GroupAvatar'
import { useDm } from './useDm'

const AVATAR_SIZE = 32

/**
 * Header of a DM or group DM chat: back button, avatar (with status dot in a 1:1 DM), name and a
 * subtitle (status for 1:1, member count for groups). Sits inside ChatPanel, whose NavigatorHeader owns the top safe-area inset.
 */
export function DMHeader({
    channelId,
    onBack,
    onOpenDetails,
}: {
    channelId: string
    onBack: () => void
    /** Opens the channel details, searching when asked to (the title and the search button). */
    onOpenDetails?: (search?: boolean) => void
}) {
    const dm = useDm(channelId)
    const { theme } = useUnistyles()
    if (!dm) return null
    const status = dm.presence?.status ?? 'offline'
    const subtitle = dm.isGroup
        ? t('messages.members', { count: dm.memberCount })
        : (dm.presence?.customStatus ??
          t(`messages.status.${status === 'invisible' ? 'offline' : status}`))

    return (
        <NavigatorHeader
            onBack={onBack}
            backLabel={t('messages.back')}
            onTitlePress={onOpenDetails && (() => onOpenDetails())}
            titleLabel={t('details.open')}
            trailing={
                onOpenDetails && (
                    <View style={styles.buttons}>
                        <CallHeaderButton channelId={channelId} />
                        <VideoCallHeaderButton channelId={channelId} />
                        <HeaderSearchButton
                            onPress={() => onOpenDetails(true)}
                        />
                    </View>
                )
            }
        >
            <View style={styles.row}>
                {dm.recipient ? (
                    <StatusAvatar
                        user={dm.recipient}
                        size={AVATAR_SIZE}
                        status={status}
                        mobile={dm.presence?.mobile}
                        streaming={dm.presence?.streaming}
                        // CutoutBackgroundProvider: NavigatorHeader's background (pressing the title is a ripple).
                        cutoutBackground={theme.colors.BACKGROUND_BASE_LOWER}
                    />
                ) : (
                    <GroupAvatar
                        id={channelId}
                        name={dm.name}
                        icon={dm.icon}
                        size={AVATAR_SIZE}
                    />
                )}
                <View style={styles.label}>
                    <View style={styles.nameRow}>
                        <Text
                            variant="redesign/heading-18/bold"
                            color="MOBILE_TEXT_HEADING_PRIMARY"
                            lineClamp={1}
                            style={styles.name}
                        >
                            {dm.name}
                        </Text>
                        {onOpenDetails && (
                            <Icon
                                name="ChevronSmallRightIcon"
                                size="xs"
                                color="INTERACTIVE_TEXT_DEFAULT"
                            />
                        )}
                    </View>
                    <Text
                        variant="text-xs/medium"
                        color="TEXT_MUTED"
                        lineClamp={1}
                        style={styles.subtitle}
                    >
                        {subtitle}
                    </Text>
                </View>
            </View>
        </NavigatorHeader>
    )
}

const styles = StyleSheet.create(theme => ({
    buttons: { flexDirection: 'row', alignItems: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.space.PX_12 },
    label: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    name: { flexShrink: 1 },
    subtitle: { marginTop: -2 },
}))
