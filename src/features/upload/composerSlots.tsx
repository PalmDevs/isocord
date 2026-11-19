import { useEffect, useState } from 'react'
import { Image, ScrollView, View } from 'react-native'
import {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { registerFeature } from '../../core/feature'
import { useSession } from '../../core/react'
import { ActivityIndicator } from '../../design/components/ActivityIndicator'
import {
    IconButton,
    ToggleIconButton,
} from '../../design/components/buttons/IconButton'
import { RipplePressable } from '../../design/components/buttons/RipplePressable'
import { TextInput } from '../../design/components/inputs/TextInput'
import {
    AlertActionButton,
    AlertActions,
    AlertModal,
} from '../../design/components/modals/AlertModal'
import { openAlert } from '../../design/components/modals/alertStore'
import { Text } from '../../design/components/Text'
import { Icon } from '../../design/icons/Icon'
import { ICON_TURN_TIMING } from '../../design/tokens/motion'
import { t } from '../../i18n'
import { channelsStore } from '../../stores/channels/channels'
import { guildsStore } from '../../stores/guilds'
import { usersStore } from '../../stores/users'
import { ActionSlot } from '../chat/composer/ActionButton'
import { actionButtonStyles } from '../chat/composer/actionButtonStyles'
import { Reveal } from '../chat/composer/floating'
import { registerComposerSlots } from '../chat/composer/parsing/slots'
import {
    useComposer,
    useComposerState,
} from '../chat/composer/state/useComposer'
import { toast } from '../chat/composer/toast'
import { MAX_UPLOAD_COUNT, maxUploadSize } from './limits'
import { pickFiles, pickFromCamera, pickFromGallery } from './pickers'
import {
    addAttachments,
    removeAttachment,
    retryAttachment,
    setDescription,
    setSpoiler,
    uploadsFeature,
    useAttachments,
} from './store'
import type { IconName } from '../../design/icons/Icon'
import type {
    AttachmentTarget,
    ComposerSlotProps,
} from '../chat/composer/parsing/slots'
import type { AttachmentInput, PendingAttachment } from './store'

/** Adds files to a composer's pending list within the limits of the user's Nitro and the guild's boosts. */
function add(target: AttachmentTarget, inputs: AttachmentInput[]) {
    const { session, channelId } = target
    if (inputs.length === 0) return
    const channel = session.get(channelsStore).getState().channels[channelId]
    const guild = channel?.guild_id
        ? session.get(guildsStore).getState().guilds[channel.guild_id]
        : undefined
    const premiumType = session.get(usersStore).getState().users[
        session.userId
    ]?.premium_type
    const result = addAttachments(session, target.key, inputs, {
        maxFileSize: maxUploadSize({
            premiumType,
            guildFeatures: guild?.features,
        }),
        defer: target.defer,
    })
    if (result.rejected.length > 0)
        toast(t('composer.tooManyFiles', { max: MAX_UPLOAD_COUNT }))
}

/** No files are picked for a forward or a share: a share brings its own (ForwardMessageFooter, ShareChatInput). */
function PlusSlot() {
    const attached = useComposerState(state => state.attached)
    return attached ? null : <PlusButton />
}

/** MediaKeyboardButtonIcon: the plus button left of the input, turned into an x while the media row is open. */
function PlusButton() {
    const composer = useComposer()
    const active = useComposerState(state => state.mediaRowOpen)
    const rotation = useSharedValue(active ? 45 : 0)
    useEffect(() => {
        rotation.set(withTiming(active ? 45 : 0, ICON_TURN_TIMING))
    }, [active, rotation])
    const turn = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.get()}deg` }],
    }))
    // Only the icon turns; the pill and its pressed background stay upright.
    return (
        <ActionSlot>
            <ToggleIconButton
                icon="PlusLargeIcon"
                variant="icon-only"
                pressed={active}
                accessibilityLabel={t('composer.add')}
                onPress={composer.toggleMediaRow}
                iconStyle={turn}
                style={actionButtonStyles.button}
            />
        </ActionSlot>
    )
}

/** The row above the input while the plus button is toggled: where files can come from. */
function MediaRow({ channelId }: ComposerSlotProps) {
    const open = useComposerState(state => state.mediaRowOpen)
    return (
        <Reveal open={open}>
            <MediaSources channelId={channelId} />
        </Reveal>
    )
}

function MediaSources({ channelId }: ComposerSlotProps) {
    const session = useSession()
    const { attachmentsKey } = useComposer()
    const defer = useComposerState(state => state.creatingThread)
    const target = { session, channelId, key: attachmentsKey, defer }
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rowContent}
            style={styles.row}
            keyboardShouldPersistTaps="handled"
        >
            <IconButton
                icon="ImagesIcon"
                variant="secondary"
                size="lg"
                label={t('composer.media.photos')}
                style={styles.action}
                onPress={() => void pickFromGallery().then(i => add(target, i))}
            />
            <IconButton
                icon="CameraIcon"
                variant="secondary"
                size="lg"
                label={t('composer.media.camera')}
                style={styles.action}
                onPress={() =>
                    void pickFromCamera({ video: true }).then(i =>
                        add(target, i),
                    )
                }
            />
            <IconButton
                icon="FileIcon"
                variant="secondary"
                size="lg"
                label={t('composer.media.files')}
                style={styles.action}
                onPress={() => void pickFiles().then(i => add(target, i))}
            />
        </ScrollView>
    )
}

function DescriptionAlert({
    channelId,
    item,
}: {
    channelId: string
    item: PendingAttachment
}) {
    const session = useSession()
    const [value, setValue] = useState(item.description)
    return (
        <AlertModal
            title={t('composer.attachment.descriptionTitle')}
            extraContent={
                <TextInput
                    value={value}
                    onChangeText={setValue}
                    placeholder={t(
                        'composer.attachment.descriptionPlaceholder',
                    )}
                    maxLength={1024}
                    multiline
                />
            }
            actions={
                <AlertActions>
                    <AlertActionButton
                        text={t('composer.attachment.save')}
                        onPress={() =>
                            setDescription(
                                session,
                                channelId,
                                item.id,
                                value.trim(),
                            )
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

function Preview({ item }: { item: PendingAttachment }) {
    const visual =
        item.mimeType.startsWith('image/') || item.mimeType.startsWith('video/')
    return (
        <View style={styles.preview}>
            {visual ? (
                <Image
                    source={{ uri: item.previewUri }}
                    style={styles.image}
                    blurRadius={item.spoiler ? 24 : 0}
                />
            ) : (
                <View style={styles.file}>
                    <Icon name="FileIcon" size="lg" color="TEXT_MUTED" />
                    <Text
                        variant="text-xs/medium"
                        color="TEXT_DEFAULT"
                        lineClamp={2}
                        style={styles.fileName}
                    >
                        {item.filename}
                    </Text>
                </View>
            )}
        </View>
    )
}

function SmallButton({
    icon,
    label,
    onPress,
    active,
}: {
    icon: IconName
    label: string
    onPress: () => void
    active?: boolean
}) {
    return (
        <RipplePressable
            borderless
            radius={16}
            accessibilityRole="button"
            accessibilityLabel={label}
            hitSlop={4}
            onPress={onPress}
            style={[styles.small, active && styles.smallActive]}
        >
            <Icon name={icon} size="xs" color="TEXT_STRONG" />
        </RipplePressable>
    )
}

function AttachmentItem({ item }: { item: PendingAttachment }) {
    const session = useSession()
    const { channelId, id } = item
    const failed = item.state === 'error'
    const busy = item.state === 'preparing' || item.state === 'uploading'
    return (
        <View style={styles.item}>
            <Preview item={item} />
            {(busy || failed) && (
                <View style={styles.overlay}>
                    {failed ? (
                        <RipplePressable
                            accessibilityRole="button"
                            accessibilityLabel={t('composer.attachment.retry')}
                            onPress={() =>
                                retryAttachment(session, channelId, id)
                            }
                            style={styles.overlayFill}
                        >
                            <Icon
                                name="RetryIcon"
                                size="md"
                                color="TEXT_STRONG"
                            />
                        </RipplePressable>
                    ) : (
                        <View style={styles.overlayFill}>
                            <ActivityIndicator />
                            {item.state === 'uploading' && (
                                <Text
                                    variant="text-xs/semibold"
                                    color="TEXT_STRONG"
                                    tabularNumbers
                                >
                                    {Math.round(item.progress * 100)}%
                                </Text>
                            )}
                        </View>
                    )}
                </View>
            )}
            <View style={styles.actions}>
                <SmallButton
                    icon="EyeSlashIcon"
                    label={t(
                        item.spoiler
                            ? 'composer.attachment.unspoiler'
                            : 'composer.attachment.spoiler',
                    )}
                    active={item.spoiler}
                    onPress={() =>
                        setSpoiler(session, channelId, id, !item.spoiler)
                    }
                />
                <SmallButton
                    icon="PencilIcon"
                    label={t('composer.attachment.edit')}
                    active={item.description !== ''}
                    onPress={() =>
                        openAlert(
                            `attachment-description:${id}`,
                            <DescriptionAlert
                                channelId={channelId}
                                item={item}
                            />,
                        )
                    }
                />
                <SmallButton
                    icon="CircleXIcon"
                    label={t('composer.attachment.remove')}
                    onPress={() => removeAttachment(session, channelId, id)}
                />
            </View>
        </View>
    )
}

/** Pending files above the input, each with its upload state and spoiler, description and remove buttons. */
function Attachments() {
    const items = useAttachments(useComposer().attachmentsKey)
    // Given the items rather than reading them, so a closing strip keeps showing the last ones.
    return (
        <Reveal open={items.length > 0}>
            <AttachmentStrip items={items} />
        </Reveal>
    )
}

function AttachmentStrip({ items }: { items: readonly PendingAttachment[] }) {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stripContent}
            keyboardShouldPersistTaps="handled"
        >
            {items.map(item => (
                <AttachmentItem key={item.id} item={item} />
            ))}
        </ScrollView>
    )
}

/** The uploader's part of the composer and its progress listener. Imported once by the app's features list. */
registerFeature(uploadsFeature)
registerComposerSlots({
    // The pending files above the media row.
    panels: {
        attachments: { placement: 'above', order: 0, Component: Attachments },
        mediaRow: { placement: 'above', order: 10, Component: MediaRow },
    },
    // First on the input's left.
    actionButtons: { plus: { side: 'start', order: 0, Component: PlusSlot } },
    addAttachments: (target, attachments) => add(target, attachments),
})

const SIZE = 96

const styles = StyleSheet.create(theme => ({
    row: { flexGrow: 0 },
    // Above the floating input's card: its horizontal inset, and the accessory margin between them.
    rowContent: {
        paddingHorizontal:
            theme.modules.mobile.CHAT_INPUT_CONTAINER_HORIZONTAL_PADDING,
        paddingTop: theme.space.PX_8,
        paddingBottom:
            theme.modules.mobile.CHAT_INPUT_FLOATING_ACCESSORY_MARGIN_BOTTOM,
        gap: theme.space.PX_16,
    },
    action: { width: 72 },
    stripContent: {
        paddingHorizontal:
            theme.modules.mobile.CHAT_INPUT_CONTAINER_HORIZONTAL_PADDING,
        paddingTop: theme.space.PX_8,
        paddingBottom:
            theme.modules.mobile.CHAT_INPUT_FLOATING_ACCESSORY_MARGIN_BOTTOM,
        gap: theme.space.PX_8,
    },
    item: {
        width: SIZE,
        height: SIZE,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: theme.colors.BACKGROUND_SURFACE_HIGH,
    },
    preview: { flex: 1 },
    image: { width: '100%', height: '100%' },
    file: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.space.PX_6,
    },
    fileName: { textAlign: 'center' },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    overlayFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    actions: {
        position: 'absolute',
        top: 4,
        right: 4,
        flexDirection: 'row',
        gap: theme.space.PX_4,
    },
    small: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    smallActive: { backgroundColor: theme.colors.STATUS_DANGER },
}))
