import { useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { MAX_FORUM_TAG_NAME_LENGTH } from '../../core/discord/forum'
import { IconButton } from '../../design/components/buttons/IconButton'
import { RipplePressable } from '../../design/components/buttons/RipplePressable'
import { Checkbox } from '../../design/components/inputs/Checkbox'
import { SplitTextInput } from '../../design/components/inputs/SplitTextInput'
import {
    AlertActionButton,
    AlertActions,
    AlertModal,
} from '../../design/components/modals/AlertModal'
import {
    dismissAlert,
    openAlert,
} from '../../design/components/modals/alertStore'
import { openActionSheet } from '../../design/components/sheets/sheetStore'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'
import { ReactionPickerSheet } from '../chat/longPress/ReactionPickerSheet'
import { TagEmoji } from '../forum/ForumPostTags'
import type { ForumTag } from '../../core/discord/forum'
import type { SearchEmoji } from '../expressions'

const ALERT_KEY = 'forum-tag'
const PICKER_KEY = 'forum-tag-emoji'

export interface ForumTagDraft {
    name: string
    emoji_id: string | null
    emoji_name: string | null
    moderated: boolean
}

interface TagEmojiValue {
    emoji_id: string | null
    emoji_name: string | null
}

const tagEmojiOf = (emoji: SearchEmoji): TagEmojiValue =>
    emoji.type === 'custom'
        ? { emoji_id: emoji.id, emoji_name: null }
        : { emoji_id: null, emoji_name: emoji.surrogates }

/** Opens the create or edit forum tag AlertModal, modelled after CustomStatusAlert. */
export function openForumTagAlert({
    channelId,
    tag,
    onSave,
    onDelete,
}: {
    channelId: string
    tag?: ForumTag
    onSave: (draft: ForumTagDraft) => void | Promise<void>
    onDelete?: () => void
}): void {
    openAlert(
        ALERT_KEY,
        <ForumTagAlert
            channelId={channelId}
            tag={tag}
            onSave={onSave}
            onDelete={onDelete}
        />,
    )
}

function ForumTagAlert({
    channelId,
    tag,
    onSave,
    onDelete,
}: {
    channelId: string
    tag?: ForumTag
    onSave: (draft: ForumTagDraft) => void | Promise<void>
    onDelete?: () => void
}) {
    const [name, setName] = useState(tag?.name ?? '')
    const [emoji, setEmoji] = useState<TagEmojiValue>({
        emoji_id: tag?.emoji_id ?? null,
        emoji_name: tag?.emoji_name ?? null,
    })
    const [moderated, setModerated] = useState(tag?.moderated ?? false)

    const pickEmoji = () =>
        openActionSheet(
            PICKER_KEY,
            <ReactionPickerSheet
                channelId={channelId}
                onPickEmoji={choice => setEmoji(tagEmojiOf(choice))}
            />,
            { stackingBehavior: 'stack' },
        )

    const handleDelete = () => {
        onDelete?.()
        dismissAlert(ALERT_KEY)
    }

    const trimmed = name.trim()
    const hasEmoji = Boolean(emoji.emoji_id || emoji.emoji_name)

    return (
        <AlertModal
            title={t(
                tag ? 'channelSettings.editTag' : 'channelSettings.createTag',
            )}
            extraContent={
                <View style={styles.content}>
                    <SplitTextInput
                        value={name}
                        onChangeText={setName}
                        placeholder={t('channelSettings.tagNamePlaceholder')}
                        maxLength={MAX_FORUM_TAG_NAME_LENGTH}
                        clearable={!onDelete}
                        trailing={
                            onDelete ? (
                                <IconButton
                                    accessibilityLabel={t(
                                        'channelSettings.deleteTag',
                                    )}
                                    icon="TrashIcon"
                                    variant="icon-only"
                                    onPress={handleDelete}
                                />
                            ) : undefined
                        }
                        leading={
                            <RipplePressable
                                accessibilityRole="button"
                                accessibilityLabel={t(
                                    'channelSettings.selectTagEmoji',
                                )}
                                borderless
                                onPress={pickEmoji}
                            >
                                {hasEmoji ? (
                                    <TagEmoji
                                        tag={{
                                            id: '',
                                            name: '',
                                            emoji_id: emoji.emoji_id,
                                            emoji_name: emoji.emoji_name,
                                        }}
                                    />
                                ) : (
                                    <Icon
                                        name="ReactionIcon"
                                        size="sm"
                                        color="ICON_SUBTLE"
                                    />
                                )}
                            </RipplePressable>
                        }
                    />
                    <Checkbox
                        checked={moderated}
                        onToggle={setModerated}
                        label={t('channelSettings.tagModeratorOnly')}
                        description={t(
                            'channelSettings.tagModeratorOnlyDescription',
                        )}
                    />
                </View>
            }
            actions={
                <AlertActions>
                    <AlertActionButton
                        text={t('settings.save')}
                        disabled={trimmed.length === 0}
                        onPress={() =>
                            onSave({
                                name: trimmed,
                                emoji_id: emoji.emoji_id,
                                emoji_name: emoji.emoji_name,
                                moderated,
                            })
                        }
                    />
                    <AlertActionButton
                        variant="secondary"
                        text={t('common.cancel')}
                    />
                </AlertActions>
            }
        />
    )
}

const styles = StyleSheet.create(theme => ({
    content: { gap: theme.space.PX_16 },
}))
