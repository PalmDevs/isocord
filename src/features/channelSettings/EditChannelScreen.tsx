import { useNavigation, useRoute } from '@react-navigation/native'
import { useState } from 'react'
import { fieldErrors } from '../../core/api/auth'
import {
    MAX_CHANNEL_NAME_LENGTH,
    MAX_CHANNEL_TOPIC_LENGTH,
    MAX_FORUM_CHANNEL_TOPIC_LENGTH,
} from '../../core/discord/channelLimits'
import {
    ChannelType,
    DEFAULT_AUTO_ARCHIVE_CHANNEL_TYPES,
    NSFW_CHANNEL_TYPES,
    SLOWMODE_CHANNEL_TYPES,
    THREADS_ONLY_CHANNEL_TYPES,
    TOGGLE_ANNOUNCEMENT_CHANNEL_TYPES,
} from '../../core/discord/channelType'
import { Permission } from '../../core/discord/permissions'
import { DEFAULT_AUTO_ARCHIVE_DURATION } from '../../core/discord/threads'
import { useSession } from '../../core/react'
import { TextAreaField } from '../../design/components/inputs/TextAreaField'
import { TextInput } from '../../design/components/inputs/TextInput'
import { TableSwitchRow } from '../../design/components/table/TableControlRows'
import { TableRowGroup } from '../../design/components/table/TableRowGroup'
import { t } from '../../i18n'
import { updateChannel } from '../../stores/channels/channelActions'
import { isThread } from '../../stores/channels/channels'
import { threadMetadataOf } from '../../stores/channels/threadModeration'
import { useChannelPermissions } from '../../stores/permissions'
import { showToast } from '../toasts'
import {
    AnnouncementSetting,
    DeleteChannelRow,
    InvitesRow,
    PermissionsRow,
} from './ChannelSettings'
import { threadAccess, useIsForumPost, useManagedChannel } from './permissions'
import { ChannelSettingsScaffold, HeaderSubmit } from './Scaffold'
import { SlowmodeSetting } from './SlowmodeSetting'
import { sanitizeChannelName, sanitizeThreadName } from './sanitizeChannelName'
import {
    AutoArchiveSetting,
    InvitableSetting,
    ThreadActionRows,
} from './ThreadSettings'
import { isPostPinned } from './threadActions'
import { useCanToggleAnnouncement } from './useCanToggleAnnouncement'
import type { MessageKey } from '../../i18n'
import type { ChannelEdit } from '../../stores/channels/channelActions'
import type { Channel } from '../../stores/channels/channels'
import type { ThreadAccess } from './permissions'
import type { ChannelRouteParams } from './routes'

/** The fields of the form. */
interface Form {
    name: string
    topic: string
    nsfw: boolean
    type: number
    slowmode: number
    autoArchive: number
    defaultAutoArchive: number
    invitable: boolean
}

const formOf = (channel: Channel): Form => ({
    name: channel.name ?? '',
    topic: channel.topic ?? '',
    nsfw: channel.nsfw ?? false,
    type: channel.type,
    slowmode: channel.rate_limit_per_user ?? 0,
    autoArchive:
        threadMetadataOf(channel)?.auto_archive_duration ??
        DEFAULT_AUTO_ARCHIVE_DURATION,
    // ThreadAutoArchive.getAutoArchiveDuration.
    defaultAutoArchive:
        channel.default_auto_archive_duration ?? DEFAULT_AUTO_ARCHIVE_DURATION,
    invitable: threadMetadataOf(channel)?.invitable ?? false,
})

/** The fields of the form that differ from the channel. A channel without a field does not show it, so it is left out. */
function changesOf(channel: Channel, form: Form): ChannelEdit {
    const held = formOf(channel)
    const edit: ChannelEdit = {}
    // handleBlurName: a thread name is trimmed.
    const name = isThread(channel) ? form.name.trim() : form.name
    if (name !== held.name) edit.name = name
    if (form.topic !== held.topic) edit.topic = form.topic
    if (form.nsfw !== held.nsfw) edit.nsfw = form.nsfw
    if (form.type !== held.type) edit.type = form.type
    if (form.slowmode !== held.slowmode)
        edit.rate_limit_per_user = form.slowmode
    if (form.autoArchive !== held.autoArchive)
        edit.auto_archive_duration = form.autoArchive
    if (form.defaultAutoArchive !== held.defaultAutoArchive)
        edit.default_auto_archive_duration = form.defaultAutoArchive
    if (form.invitable !== held.invitable) edit.invitable = form.invitable
    return edit
}

/**
 * ChannelSettingsOverview's save: PATCHes the changed fields of the channel and goes back. The reference sends the
 * whole record. The gateway's CHANNEL_UPDATE brings the result to the store.
 */
function useSaveChannel(channel: Channel, form: Form) {
    const session = useSession()
    const navigation = useNavigation()
    const [submitting, setSubmitting] = useState(false)
    const [errors, setErrors] = useState<{ name?: string; topic?: string }>({})
    const edit = changesOf(channel, form)
    const save = async () => {
        setSubmitting(true)
        try {
            await updateChannel(session, channel.id, edit)
            navigation.goBack()
            showToast({
                content: t(
                    isThread(channel)
                        ? 'channelSettings.threadSaved'
                        : 'channelSettings.saved',
                ),
            })
        } catch (error) {
            const { name, topic, ...other } = fieldErrors(error)
            setErrors({ name, topic })
            // Errors of fields that are not shown, and failures without a field, go to a toast.
            showToast({
                key: 'channel-settings-error',
                variant: 'critical',
                content:
                    Object.values(other)[0] ?? t('channelSettings.saveError'),
            })
        } finally {
            setSubmitting(false)
        }
    }
    return {
        save,
        submitting,
        errors,
        hasChanges: Object.keys(edit).length > 0,
    }
}

/** updateNavigation's title: the settings of a post, a thread, a category or a channel. */
function titleKey(channel: Channel, forumPost: boolean): MessageKey {
    if (isThread(channel))
        return forumPost
            ? 'channelSettings.postSettingsTitle'
            : 'channelSettings.threadSettingsTitle'
    return channel.type === ChannelType.GUILD_CATEGORY
        ? 'channelSettings.categoryTitle'
        : 'channelSettings.title'
}

/** renderChannelInfo's label of the name field. */
function nameLabelKey(channel: Channel, forumPost: boolean): MessageKey {
    if (isThread(channel))
        return forumPost ? 'channelSettings.postTitle' : 'threads.name'
    return channel.type === ChannelType.GUILD_CATEGORY
        ? 'channelSettings.categoryName'
        : 'channelSettings.channelName'
}

/** The thread-only settings under the shared ones: auto-hide, invitable and the close, lock and delete rows. */
function ThreadFields({
    channel,
    form,
    access,
    forumPost,
    onChange,
}: {
    channel: Channel
    form: Form
    access: ThreadAccess
    forumPost: boolean
    onChange: (form: Form) => void
}) {
    return (
        <>
            {access.manage && (
                <AutoArchiveSetting
                    minutes={form.autoArchive}
                    description={
                        forumPost
                            ? 'channelSettings.hidePostsDescription'
                            : 'channelSettings.hideThreadsDescription'
                    }
                    disabled={forumPost && isPostPinned(channel)}
                    onChange={autoArchive => onChange({ ...form, autoArchive })}
                />
            )}
            {channel.type === ChannelType.PRIVATE_THREAD && (
                <InvitableSetting
                    invitable={form.invitable}
                    disabled={!access.manage}
                    onChange={invitable => onChange({ ...form, invitable })}
                />
            )}
            <ThreadActionRows thread={channel} forumPost={forumPost} />
        </>
    )
}

/** ChannelSettingsOverview's renderChannelInfo: the name, and the topic or post guidelines. */
function NameFields({
    channel,
    form,
    errors,
    editable,
    forumPost,
    onChange,
}: {
    channel: Channel
    form: Form
    errors: { name?: string; topic?: string }
    editable: boolean
    forumPost: boolean
    onChange: (form: Form) => void
}) {
    const forumLike = THREADS_ONLY_CHANNEL_TYPES.has(channel.type)
    // Voice channels have no topic in the reference.
    const hasTopic =
        forumLike ||
        channel.type === ChannelType.GUILD_TEXT ||
        channel.type === ChannelType.GUILD_ANNOUNCEMENT
    return (
        <>
            <TextInput
                label={t(nameLabelKey(channel, forumPost))}
                value={form.name}
                maxLength={MAX_CHANNEL_NAME_LENGTH}
                errorMessage={errors.name}
                editable={editable}
                onChangeText={text =>
                    onChange({
                        ...form,
                        name: sanitizeThreadName(
                            sanitizeChannelName(text, channel.type),
                        ),
                    })
                }
            />
            {hasTopic && (
                <TextAreaField
                    label={t(
                        forumLike
                            ? 'channelSettings.postGuidelines'
                            : 'channelSettings.channelTopic',
                    )}
                    value={form.topic}
                    maxLength={
                        forumLike
                            ? MAX_FORUM_CHANNEL_TOPIC_LENGTH
                            : MAX_CHANNEL_TOPIC_LENGTH
                    }
                    errorMessage={errors.topic}
                    onChangeText={topic => onChange({ ...form, topic })}
                />
            )}
        </>
    )
}

/**
 * The channel-only rows above the age restriction: renderPermissions, renderCommonSettingsSection's Invites and
 * renderAnnouncement. The screen already needs MANAGE_CHANNELS.
 */
function ChannelRows({
    channel,
    form,
    permissions,
    onChange,
}: {
    channel: Channel
    form: Form
    permissions: bigint
    onChange: (form: Form) => void
}) {
    const canToggleAnnouncement = useCanToggleAnnouncement(channel)
    return (
        <>
            {(permissions & Permission.MANAGE_ROLES) ===
                Permission.MANAGE_ROLES && <PermissionsRow channel={channel} />}
            {channel.type !== ChannelType.GUILD_CATEGORY && <InvitesRow />}
            {TOGGLE_ANNOUNCEMENT_CHANNEL_TYPES.has(channel.type) &&
                canToggleAnnouncement && (
                    <AnnouncementSetting
                        announcement={
                            form.type === ChannelType.GUILD_ANNOUNCEMENT
                        }
                        onChange={announcement =>
                            onChange({
                                ...form,
                                type: announcement
                                    ? ChannelType.GUILD_ANNOUNCEMENT
                                    : ChannelType.GUILD_TEXT,
                            })
                        }
                    />
                )}
        </>
    )
}

function EditChannelForm({ channel }: { channel: Channel }) {
    const session = useSession()
    const [form, setForm] = useState(() => formOf(channel))
    const { save, submitting, errors, hasChanges } = useSaveChannel(
        channel,
        form,
    )
    const thread = isThread(channel)
    const forumPost = useIsForumPost(channel)
    const permissions = useChannelPermissions(channel.id)
    const access = threadAccess(channel, permissions, session.userId, forumPost)
    const forumLike = THREADS_ONLY_CHANNEL_TYPES.has(channel.type)
    return (
        <ChannelSettingsScaffold
            title={t(titleKey(channel, forumPost))}
            trailing={
                <HeaderSubmit
                    label={t('settings.save')}
                    enabled={hasChanges}
                    submitting={submitting}
                    onPress={save}
                />
            }
        >
            <NameFields
                channel={channel}
                form={form}
                errors={errors}
                editable={!thread || access.nameEditable}
                forumPost={forumPost}
                onChange={setForm}
            />
            {!thread && (
                <ChannelRows
                    channel={channel}
                    form={form}
                    permissions={permissions}
                    onChange={setForm}
                />
            )}
            {NSFW_CHANNEL_TYPES.has(channel.type) && (
                <TableRowGroup
                    helperText={t('channelSettings.ageRestrictedHelper')}
                >
                    <TableSwitchRow
                        label={t('channelSettings.ageRestricted')}
                        value={form.nsfw}
                        onValueChange={nsfw => setForm({ ...form, nsfw })}
                    />
                </TableRowGroup>
            )}
            {SLOWMODE_CHANNEL_TYPES.has(channel.type) &&
                (!thread || access.moderator) && (
                    <SlowmodeSetting
                        seconds={form.slowmode}
                        kind={
                            thread ? 'thread' : forumLike ? 'forum' : 'channel'
                        }
                        onChange={slowmode => setForm({ ...form, slowmode })}
                    />
                )}
            {!thread &&
                DEFAULT_AUTO_ARCHIVE_CHANNEL_TYPES.has(channel.type) && (
                    <AutoArchiveSetting
                        minutes={form.defaultAutoArchive}
                        description={
                            forumLike
                                ? 'channelSettings.hideNewPostsDescription'
                                : 'channelSettings.hideNewThreadsDescription'
                        }
                        onChange={defaultAutoArchive =>
                            setForm({ ...form, defaultAutoArchive })
                        }
                    />
                )}
            {thread && (
                <ThreadFields
                    channel={channel}
                    form={form}
                    access={access}
                    forumPost={forumPost}
                    onChange={setForm}
                />
            )}
            {!thread && <DeleteChannelRow channel={channel} />}
        </ChannelSettingsScaffold>
    )
}

/**
 * ChannelSettingsOverview for a channel, a category, a thread or a forum post: what the long press sheet's Edit Channel
 * and Edit Category rows open. A channel needs MANAGE_CHANNELS, a thread useCanManageThread. Voice settings, forum
 * tags and the category are not here yet.
 */
export function EditChannelScreen() {
    const { channelId } = useRoute().params as ChannelRouteParams
    const channel = useManagedChannel(channelId)
    return channel && <EditChannelForm channel={channel} />
}
