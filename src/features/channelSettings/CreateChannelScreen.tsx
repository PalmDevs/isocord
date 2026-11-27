import { useNavigation, useRoute } from '@react-navigation/native'
import { useEffect, useState } from 'react'
import { fieldErrors } from '../../core/api/auth'
import { MAX_CHANNEL_NAME_LENGTH } from '../../core/discord/channelLimits'
import { ChannelType } from '../../core/discord/channelType'
import { GuildFeature } from '../../core/discord/guild'
import {
    computePermissions,
    OverwriteType,
    Permission,
} from '../../core/discord/permissions'
import { useSession, useSessionStore } from '../../core/react'
import { TextInput } from '../../design/components/inputs/TextInput'
import {
    TableRadioGroup,
    TableRadioRow,
    TableSwitchRow,
} from '../../design/components/table/TableControlRows'
import { TableRowIcon } from '../../design/components/table/TableRow'
import { TableRowGroup } from '../../design/components/table/TableRowGroup'
import { t } from '../../i18n'
import { createGuildChannel } from '../../stores/channels/channelActions'
import { guildsStore } from '../../stores/guilds'
import { openChannel } from '../chat/links/openChannel'
import { channelIcon } from '../servers/channelIcon'
import { showToast } from '../toasts'
import { ChannelSettingsScaffold, HeaderSubmit } from './Scaffold'
import { sanitizeChannelName } from './sanitizeChannelName'
import type { PermissionOverwrite } from '../../core/discord/permissions'
import type { MessageKey } from '../../i18n'
import type { Guild } from '../../stores/guilds'
import type { CreateChannelRouteParams } from './routes'

const OPENABLE_TYPES: ReadonlySet<number> = new Set([
    ChannelType.GUILD_TEXT,
    ChannelType.GUILD_ANNOUNCEMENT,
    ChannelType.GUILD_FORUM,
    ChannelType.GUILD_MEDIA,
])

interface ChannelTypeOption {
    type: number
    labelKey: MessageKey
    descriptionKey: MessageKey
}

const BASE_TYPES: ChannelTypeOption[] = [
    {
        type: ChannelType.GUILD_TEXT,
        labelKey: 'createChannel.type.text',
        descriptionKey: 'createChannel.type.textDescription',
    },
    {
        type: ChannelType.GUILD_VOICE,
        labelKey: 'createChannel.type.voice',
        descriptionKey: 'createChannel.type.voiceDescription',
    },
]

const ANNOUNCEMENT_OPTION: ChannelTypeOption = {
    type: ChannelType.GUILD_ANNOUNCEMENT,
    labelKey: 'createChannel.type.announcement',
    descriptionKey: 'createChannel.type.announcementDescription',
}

const COMMUNITY_TYPES: ChannelTypeOption[] = [
    {
        type: ChannelType.GUILD_FORUM,
        labelKey: 'createChannel.type.forum',
        descriptionKey: 'createChannel.type.forumDescription',
    },
    {
        type: ChannelType.GUILD_MEDIA,
        labelKey: 'createChannel.type.media',
        descriptionKey: 'createChannel.type.mediaDescription',
    },
]

function availableTypes(guild: Guild): ChannelTypeOption[] {
    const list = [...BASE_TYPES]
    if (guild.features?.includes(GuildFeature.NEWS))
        list.splice(1, 0, ANNOUNCEMENT_OPTION)
    if (guild.features?.includes(GuildFeature.COMMUNITY))
        list.push(...COMMUNITY_TYPES)
    return list
}

function privateOverwrites(
    guildId: string,
    userId: string,
): PermissionOverwrite[] {
    const view = String(Permission.VIEW_CHANNEL)
    return [
        { id: guildId, type: OverwriteType.ROLE, allow: '0', deny: view },
        { id: userId, type: OverwriteType.MEMBER, allow: view, deny: '0' },
    ]
}

/** EasyChannelPermissionSettings: private toggle helper text by channel type. */
function privateDescriptionKey(type: number): MessageKey {
    if (type === ChannelType.GUILD_CATEGORY)
        return 'createChannel.privateCategoryDescription'
    if (type === ChannelType.GUILD_VOICE)
        return 'createChannel.privateVoiceDescription'
    return 'createChannel.privateChannelDescription'
}

function CreateChannelForm({
    guild,
    initialType,
    parentId,
}: {
    guild: Guild
    initialType?: number
    parentId?: string
}) {
    const session = useSession()
    const navigation = useNavigation()
    const isCategory = initialType === ChannelType.GUILD_CATEGORY
    const [type, setType] = useState(initialType ?? ChannelType.GUILD_TEXT)
    const [name, setName] = useState('')
    const [isPrivateChannel, setIsPrivateChannel] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string>()

    const types = availableTypes(guild)
    const create = async () => {
        const trimmed = name.trim()
        if (!trimmed) return
        setSubmitting(true)
        try {
            const created = await createGuildChannel(session, guild.id, {
                type,
                name: trimmed,
                permission_overwrites: isPrivateChannel
                    ? privateOverwrites(guild.id, session.userId)
                    : [],
                ...(parentId ? { parent_id: parentId } : {}),
            })
            navigation.goBack()
            if (OPENABLE_TYPES.has(created.type)) openChannel(created.id)
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
            title={t(
                isCategory
                    ? 'createChannel.createCategory'
                    : 'channelActions.createChannel',
            )}
            trailing={
                <HeaderSubmit
                    label={t('channelActions.duplicateCreate')}
                    enabled={name.trim() !== ''}
                    submitting={submitting}
                    onPress={create}
                />
            }
        >
            <TextInput
                label={t(
                    isCategory
                        ? 'channelSettings.categoryName'
                        : 'channelSettings.channelName',
                )}
                autoFocus
                value={name}
                maxLength={MAX_CHANNEL_NAME_LENGTH}
                errorMessage={error}
                onChangeText={text => {
                    setError(undefined)
                    setName(sanitizeChannelName(text, type))
                }}
            />
            {!isCategory && (
                <TableRadioGroup
                    title={t('createChannel.channelType')}
                    hasIcons
                    value={String(type)}
                    onChange={value => {
                        const next = Number(value)
                        setType(next)
                        setName(current => sanitizeChannelName(current, next))
                    }}
                >
                    {types.map(option => (
                        <TableRadioRow
                            key={option.type}
                            value={String(option.type)}
                            icon={
                                <TableRowIcon name={channelIcon(option.type)} />
                            }
                            label={t(option.labelKey)}
                            subLabel={t(option.descriptionKey)}
                        />
                    ))}
                </TableRadioGroup>
            )}
            <TableRowGroup hasIcons helperText={t(privateDescriptionKey(type))}>
                <TableSwitchRow
                    icon={<TableRowIcon name="LockIcon" />}
                    label={t(
                        isCategory
                            ? 'createChannel.privateCategory'
                            : 'createChannel.privateChannel',
                    )}
                    value={isPrivateChannel}
                    onValueChange={setIsPrivateChannel}
                />
            </TableRowGroup>
        </ChannelSettingsScaffold>
    )
}

/**
 * CreateChannelModal: creates a channel or category in a server. Needs MANAGE_CHANNELS.
 */
export function CreateChannelScreen() {
    const navigation = useNavigation()
    const session = useSession()
    const { guildId, initialType, parentId } = useRoute()
        .params as CreateChannelRouteParams
    const guild = useSessionStore(guildsStore, state => state.guilds[guildId])
    const allowed =
        guild !== undefined &&
        (computePermissions(guild, undefined, session.userId) &
            Permission.MANAGE_CHANNELS) !==
            0n
    useEffect(() => {
        if (!allowed) navigation.goBack()
    }, [allowed, navigation])
    if (!allowed) return null
    return (
        <CreateChannelForm
            guild={guild}
            initialType={initialType}
            parentId={parentId}
        />
    )
}
