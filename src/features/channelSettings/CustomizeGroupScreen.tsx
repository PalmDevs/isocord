import { useNavigation, useRoute } from '@react-navigation/native'
import { Image } from 'expo-image'
import { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native-unistyles'
import { ApiError } from '../../core/api/rest'
import { MAX_CHANNEL_NAME_LENGTH } from '../../core/discord/channelLimits'
import { useSession, useSessionStore } from '../../core/react'
import { Button } from '../../design/components/buttons/Button'
import { RipplePressable } from '../../design/components/buttons/RipplePressable'
import { TextInput } from '../../design/components/inputs/TextInput'
import { Text } from '../../design/components/Text'
import { t } from '../../i18n'
import {
    isManagedChannel,
    updateChannel,
} from '../../stores/channels/channelActions'
import { computeChannelName } from '../../stores/channels/channelName'
import { channelsStore } from '../../stores/channels/channels'
import { usersStore } from '../../stores/users'
import { GroupAvatar } from '../messages/GroupAvatar'
import { showToast } from '../toasts'
import { pickGroupIcon } from './pickGroupIcon'
import { ChannelSettingsScaffold } from './Scaffold'
import type { Channel } from '../../stores/channels/channels'
import type { PickedIcon } from './pickGroupIcon'
import type { ChannelRouteParams } from './routes'

const ICON_SIZE = 96
const MILLISECONDS_PER_SECOND = 1000

/** The icon change: nothing, a new image or removal (CLEARED_ICON). */
type IconChange = PickedIcon | 'cleared' | undefined

/** ChatGDMCustomize's icon uploader: the group's icon, or the new one. It opens the photo picker unless an app manages the group. */
function IconPicker({
    channel,
    change,
    onPick,
}: {
    channel: Channel
    change: IconChange
    onPick: (icon: PickedIcon) => void
}) {
    return (
        <RipplePressable
            style={styles.icon}
            disabled={isManagedChannel(channel)}
            accessibilityRole="imagebutton"
            onPress={async () => {
                const icon = await pickGroupIcon()
                if (icon) onPick(icon)
            }}
        >
            {typeof change === 'object' ? (
                <Image source={change.uri} style={styles.picked} />
            ) : (
                <GroupAvatar
                    id={channel.id}
                    name={channel.name ?? ''}
                    icon={change === 'cleared' ? null : channel.icon}
                    size={ICON_SIZE}
                />
            )}
        </RipplePressable>
    )
}

/**
 * ChatGDMCustomize's save: setIcon, then setName. A rate limit shows how long to wait, and any other failure is a
 * toast.
 */
function useSaveGroup(channel: Channel, name: string, icon: IconChange) {
    const session = useSession()
    const navigation = useNavigation()
    const [submitting, setSubmitting] = useState(false)
    /** Seconds the server asked to wait. */
    const [retryAfter, setRetryAfter] = useState<number>()
    useEffect(() => {
        if (retryAfter === undefined) return
        const timer = setTimeout(
            () => setRetryAfter(undefined),
            retryAfter * MILLISECONDS_PER_SECOND,
        )
        return () => clearTimeout(timer)
    }, [retryAfter])

    const save = async () => {
        setSubmitting(true)
        try {
            if (icon !== undefined)
                await updateChannel(session, channel.id, {
                    icon: icon === 'cleared' ? null : icon.dataUri,
                })
            if (name !== (channel.name ?? ''))
                await updateChannel(session, channel.id, { name })
            navigation.goBack()
            showToast({ content: t('groupCustomize.saved') })
        } catch (error) {
            const wait = error instanceof ApiError && error.body?.retry_after
            if (wait) setRetryAfter(wait)
            else
                showToast({
                    variant: 'critical',
                    content:
                        error instanceof ApiError
                            ? t('channelSettings.errorCode', {
                                  code: error.code ?? error.status,
                              })
                            : t('channelSettings.saveError'),
                })
        } finally {
            setSubmitting(false)
        }
    }
    return { save, submitting, rateLimited: retryAfter !== undefined }
}

function CustomizeGroupForm({ channel }: { channel: Channel }) {
    const [name, setName] = useState(channel.name ?? '')
    const [icon, setIcon] = useState<IconChange>()
    // useComputedGroupDmName: the names of the members stand in for a name that is not set.
    const placeholder = useSessionStore(usersStore, state =>
        computeChannelName({ ...channel, name: undefined }, state.users),
    )
    const { save, submitting, rateLimited } = useSaveGroup(channel, name, icon)
    const hasChanges = name !== (channel.name ?? '') || icon !== undefined
    const hasIcon = icon === undefined ? !!channel.icon : icon !== 'cleared'
    return (
        <ChannelSettingsScaffold title={t('groupCustomize.title')}>
            <IconPicker channel={channel} change={icon} onPick={setIcon} />
            {hasIcon && !isManagedChannel(channel) && (
                <RipplePressable
                    style={styles.removeIcon}
                    accessibilityRole="button"
                    onPress={() => setIcon('cleared')}
                >
                    <Text variant="text-sm/semibold" color="TEXT_LINK">
                        {t('groupCustomize.removeIcon')}
                    </Text>
                </RipplePressable>
            )}
            <TextInput
                label={t('groupCustomize.groupName')}
                clearable
                value={name}
                placeholder={placeholder}
                maxLength={MAX_CHANNEL_NAME_LENGTH}
                editable={!submitting}
                onChangeText={setName}
            />
            <Button
                text={t('groupCustomize.saveChanges')}
                variant={hasChanges ? 'primary' : 'secondary'}
                disabled={!hasChanges || rateLimited}
                loading={submitting}
                onPress={save}
            />
            {rateLimited && (
                <Text variant="text-sm/semibold" color="TEXT_FEEDBACK_CRITICAL">
                    {t('groupCustomize.rateLimited')}
                </Text>
            )}
        </ChannelSettingsScaffold>
    )
}

/**
 * ChatGDMCustomize, opened by showChatGDMCustomizeActionSheet: a group DM's icon and name. The icon is cropped
 * square with the photo picker.
 */
export function CustomizeGroupScreen() {
    const { channelId } = useRoute().params as ChannelRouteParams
    const channel = useSessionStore(
        channelsStore,
        state => state.channels[channelId],
    )
    return channel && <CustomizeGroupForm channel={channel} />
}

const styles = StyleSheet.create(theme => ({
    icon: {
        alignSelf: 'center',
        borderRadius: ICON_SIZE / 2,
        overflow: 'hidden',
    },
    picked: { width: ICON_SIZE, height: ICON_SIZE },
    removeIcon: {
        alignSelf: 'center',
        marginTop: -theme.space.PX_16,
        padding: theme.space.PX_8,
    },
}))
