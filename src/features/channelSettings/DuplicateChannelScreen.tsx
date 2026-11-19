import { useNavigation, useRoute } from '@react-navigation/native'
import { useState } from 'react'
import { fieldErrors } from '../../core/api/auth'
import {
    BITRATE_DEFAULT,
    MAX_CHANNEL_NAME_LENGTH,
} from '../../core/discord/channelLimits'
import { ChannelType } from '../../core/discord/channelType'
import { useSession, useSessionStore } from '../../core/react'
import { TextInput } from '../../design/components/inputs/TextInput'
import { t } from '../../i18n'
import { createGuildChannel } from '../../stores/channels/channelActions'
import { computeChannelName } from '../../stores/channels/channelName'
import { usersStore } from '../../stores/users'
import { openChannel } from '../chat/links/openChannel'
import { systemPlain } from '../chat/system/format'
import { showToast } from '../toasts'
import { useManagedChannel } from './permissions'
import { ChannelSettingsScaffold, HeaderSubmit } from './Scaffold'
import { sanitizeChannelName } from './sanitizeChannelName'
import type { NewChannel } from '../../stores/channels/channelActions'
import type { Channel } from '../../stores/channels/channels'
import type { ChannelRouteParams } from './routes'

/**
 * useCreateChannelSubmit and CreateChannelActionCreators.createChannel: the clone's type, permissions, category, and
 * the bitrate and user limit when they are not the defaults.
 */
function cloneOf(channel: Channel, name: string): NewChannel {
    const clone: NewChannel = {
        type: channel.type,
        name,
        permission_overwrites: channel.permission_overwrites ?? [],
    }
    if (channel.bitrate != null && channel.bitrate !== BITRATE_DEFAULT)
        clone.bitrate = channel.bitrate
    if (channel.user_limit != null && channel.user_limit > 0)
        clone.user_limit = channel.user_limit
    if (channel.parent_id != null) clone.parent_id = channel.parent_id
    return clone
}

function DuplicateChannelForm({ channel }: { channel: Channel }) {
    const session = useSession()
    const navigation = useNavigation()
    const displayName = useSessionStore(usersStore, state =>
        computeChannelName(channel, state.users, true),
    )
    const [name, setName] = useState(channel.name ?? '')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string>()
    const create = async () => {
        if (!channel.guild_id) return
        setSubmitting(true)
        try {
            const created = await createGuildChannel(
                session,
                channel.guild_id,
                cloneOf(channel, name),
            )
            navigation.goBack()
            // onChannelCreated: opens the channel, once the gateway's CHANNEL_CREATE has brought it to the store.
            if (created.type !== ChannelType.GUILD_VOICE)
                openChannel(created.id)
        } catch (failure) {
            const errors = fieldErrors(failure)
            setError(errors.name)
            if (!errors.name)
                showToast({
                    key: 'channel-settings-error',
                    variant: 'critical',
                    content: errors._ ?? t('channelSettings.saveError'),
                })
        } finally {
            setSubmitting(false)
        }
    }
    return (
        <ChannelSettingsScaffold
            title={t('channelActions.duplicateChannel')}
            trailing={
                <HeaderSubmit
                    label={t('channelActions.duplicateCreate')}
                    enabled={name !== ''}
                    submitting={submitting}
                    onPress={create}
                />
            }
        >
            <TextInput
                label={t('channelSettings.channelName')}
                autoFocus
                value={name}
                maxLength={MAX_CHANNEL_NAME_LENGTH}
                errorMessage={error}
                description={systemPlain({
                    key: 'channelActions.duplicateDescription',
                    values: { name: displayName },
                })}
                onChangeText={text =>
                    setName(sanitizeChannelName(text, channel.type))
                }
            />
        </ChannelSettingsScaffold>
    )
}

/**
 * CreateChannelModal with `cloneChannelId`: a new channel with the permissions, user limit and bitrate of this one,
 * in the same category. Needs MANAGE_CHANNELS.
 */
export function DuplicateChannelScreen() {
    const { channelId } = useRoute().params as ChannelRouteParams
    const channel = useManagedChannel(channelId)
    return channel && <DuplicateChannelForm channel={channel} />
}
