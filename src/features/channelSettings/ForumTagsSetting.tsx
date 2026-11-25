import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { MAX_APPLIED_TAGS, MAX_FORUM_TAGS } from '../../core/discord/forum'
import { Permission } from '../../core/discord/permissions'
import { useSession, useSessionStore } from '../../core/react'
import { Text } from '../../design/components/Text'
import { TableRowGroupTitle } from '../../design/components/table/TableRowGroup'
import { t } from '../../i18n'
import { updateChannel } from '../../stores/channels/channelActions'
import { channelsStore } from '../../stores/channels/channels'
import { useChannelPermissions } from '../../stores/permissions'
import { ForumTagAddChip, ForumTagChips } from '../forum/ForumTagChips'
import { showToast } from '../toasts'
import { openForumTagAlert } from './ForumTagAlert'
import type { ForumTag, ForumTagPayload } from '../../core/discord/forum'
import type { Channel } from '../../stores/channels/channels'
import type { ForumTagDraft } from './ForumTagAlert'

const NEW_TAG_PREFIX = 'new-tag-'
let nextTempTagId = 0

/** Converts local ForumTag entries into `PATCH /channels/{id}` payloads, omitting temporary IDs. */
export function toTagPayloads(tags: ForumTag[]): ForumTagPayload[] {
    return tags.map(tag => ({
        ...(tag.id.startsWith(NEW_TAG_PREFIX) ? {} : { id: tag.id }),
        name: tag.name,
        emoji_id: tag.emoji_id ?? null,
        emoji_name: tag.emoji_name ?? null,
        moderated: tag.moderated ?? false,
    }))
}

/** True when two `available_tags` lists differ in order, IDs, name, emoji or moderated flag. */
export function areAvailableTagsEqual(a: ForumTag[], b: ForumTag[]): boolean {
    if (a.length !== b.length) return false
    return a.every((tag, index) => {
        const other = b[index]
        return (
            other !== undefined &&
            tag.id === other.id &&
            tag.name === other.name &&
            (tag.emoji_id ?? null) === (other.emoji_id ?? null) &&
            (tag.emoji_name ?? null) === (other.emoji_name ?? null) &&
            Boolean(tag.moderated) === Boolean(other.moderated)
        )
    })
}

/** True when two `applied_tags` ID lists contain the same tag IDs. */
export function areAppliedTagsEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false
    const set = new Set(a)
    return b.every(id => set.has(id))
}

const applyDraft = (id: string, draft: ForumTagDraft): ForumTag => ({
    id,
    name: draft.name,
    emoji_id: draft.emoji_id,
    emoji_name: draft.emoji_name,
    moderated: draft.moderated,
})

/** Forum and media channel settings: view, edit, delete and add `available_tags`. */
export function ForumChannelTagsSetting({
    channelId,
    tags,
    onChange,
}: {
    channelId: string
    tags: ForumTag[]
    onChange: (tags: ForumTag[]) => void
}) {
    const editTag = (id: string) => {
        const tag = tags.find(item => item.id === id)
        if (!tag) return
        openForumTagAlert({
            channelId,
            tag,
            onSave: draft =>
                onChange(
                    tags.map(item =>
                        item.id === id ? applyDraft(id, draft) : item,
                    ),
                ),
            onDelete: () => onChange(tags.filter(item => item.id !== id)),
        })
    }

    const addTag = () =>
        openForumTagAlert({
            channelId,
            onSave: draft => {
                const id = `${NEW_TAG_PREFIX}${++nextTempTagId}`
                onChange([...tags, applyDraft(id, draft)])
            },
        })

    return (
        <View style={styles.section}>
            <TableRowGroupTitle
                title={t('channelSettings.tags')}
                style={styles.title}
            />
            <ForumTagChips
                tags={tags}
                onToggle={editTag}
                trailing={
                    tags.length < MAX_FORUM_TAGS && (
                        <ForumTagAddChip onPress={addTag} />
                    )
                }
            />
            <Text variant="text-sm/normal" color="TEXT_SUBTLE">
                {t('channelSettings.tagsHelper', { count: MAX_FORUM_TAGS })}
            </Text>
        </View>
    )
}

/** Forum post settings: apply or remove tags, and create new tags when the user can manage the parent forum. */
export function ForumPostTagsSetting({
    post,
    appliedTags,
    moderator,
    onChange,
}: {
    post: Channel
    appliedTags: string[]
    moderator: boolean
    onChange: (appliedTags: string[]) => void
}) {
    const session = useSession()
    const parent = useSessionStore(channelsStore, state =>
        post.parent_id ? state.channels[post.parent_id] : undefined,
    )
    const parentPermissions = useChannelPermissions(parent?.id ?? '')
    const availableTags = parent?.available_tags ?? []
    const canAddTag =
        parent !== undefined &&
        (parentPermissions & Permission.MANAGE_CHANNELS) ===
            Permission.MANAGE_CHANNELS &&
        availableTags.length < MAX_FORUM_TAGS

    if (availableTags.length === 0 && !canAddTag) return null

    const disabledIds = moderator
        ? undefined
        : new Set(availableTags.filter(tag => tag.moderated).map(tag => tag.id))

    const toggleTag = (id: string) => {
        if (appliedTags.includes(id)) {
            onChange(appliedTags.filter(other => other !== id))
            return
        }
        if (appliedTags.length >= MAX_APPLIED_TAGS) {
            showToast({
                key: 'max-applied-tags',
                content: t('channelSettings.maxAppliedTags', {
                    count: MAX_APPLIED_TAGS,
                }),
            })
            return
        }
        onChange([...appliedTags, id])
    }

    const addTag = () => {
        if (!parent) return
        openForumTagAlert({
            channelId: parent.id,
            onSave: async draft => {
                try {
                    const updated = await updateChannel(session, parent.id, {
                        available_tags: [
                            ...toTagPayloads(availableTags),
                            draft,
                        ],
                    })
                    const existingIds = new Set(
                        availableTags.map(tag => tag.id),
                    )
                    const created = (updated.available_tags ?? []).find(
                        tag => !existingIds.has(tag.id),
                    )
                    if (created && appliedTags.length < MAX_APPLIED_TAGS)
                        onChange([...appliedTags, created.id])
                } catch (error) {
                    showToast({
                        key: 'forum-tag-save-error',
                        variant: 'critical',
                        content: t('channelSettings.saveError'),
                    })
                    throw error
                }
            },
        })
    }

    return (
        <View style={styles.section}>
            <TableRowGroupTitle
                title={t('channelSettings.tags')}
                style={styles.title}
            />
            <ForumTagChips
                tags={availableTags}
                selectedIds={appliedTags}
                disabledIds={disabledIds}
                onToggle={toggleTag}
                trailing={canAddTag && <ForumTagAddChip onPress={addTag} />}
            />
            <Text variant="text-sm/normal" color="TEXT_SUBTLE">
                {t('channelSettings.postTagsHelper', {
                    count: MAX_APPLIED_TAGS,
                })}
            </Text>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    section: { gap: theme.space.PX_12 },
    title: { marginBottom: 0 },
}))
