import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { maxMessageLength } from '../../../core/discord/messages'
import { useSession, useSessionStore } from '../../../core/react'
import { Button } from '../../../design/components/buttons/Button'
import { Text } from '../../../design/components/Text'
import { Icon } from '../../../design/icons/Icon'
import { t } from '../../../i18n'
import { usersStore } from '../../../stores/users'
import { useAttachments } from '../../upload'
import { ActionSlot } from './ActionButton'
import { ContextBar } from './ContextBar'
import { PressableOpacity } from './floating'
import { serializeMessage } from './parsing/parse'
import { parseContext } from './parsing/parseContext'
import { registerComposerSlots } from './parsing/slots'
import { composerStore } from './state/composerStore'
import { useComposer, useComposerState } from './state/useComposer'
import { toast } from './toast'
import type { ComposerSlotProps } from './parsing/slots'

/**
 * ChatInputSendButton: the brand square, muted while nothing can be sent or slowmode holds it.
 * Like the reference, slowmode does not hold an edit (`!isOnCooldown || hasPendingEdit`).
 * Unlike it, an edit with unchanged content is muted too. `send` compares the same serialized content.
 *
 * While a thread is created it is never muted, as in the reference (`requireTextContent` is off).
 * Unlike the reference, an empty input shows the thread icon and the "Create Thread" label.
 *
 * A forward's text may be empty: the button is live once a destination is picked. A share also needs text or files.
 * The reference has its own "Send" button beside the input there (ShareFooterLayout).
 */
function SendButton({ channelId }: ComposerSlotProps) {
    const composer = useComposer()
    const hasText = useComposerState(state => state.text.trim().length > 0)
    const creatingThread = useComposerState(state => state.creatingThread)
    const attached = useComposerState(state => state.attached)
    const attachedReady = useComposerState(state => state.attachedReady)
    const allowsEmpty = useComposerState(state => state.attachedAllowsEmpty)
    const session = useSession()
    const editContent = useSessionStore(composerStore, state => {
        const message = state.editing[channelId]
        return message ? (message.content ?? '') : undefined
    })
    // The channel's edit is not a thread's first message.
    const editing = !creatingThread && !attached && editContent !== undefined
    const unchanged = useComposerState(
        state =>
            editing &&
            serializeMessage(state.text, parseContext(session, channelId))
                .content === editContent,
    )
    const waiting = useComposerState(state => state.slowmode > 0) && !editing
    const hasFiles = useAttachments(composer.attachmentsKey).length > 0
    const enabled = attached
        ? attachedReady && (allowsEmpty || hasText || hasFiles)
        : (hasText || hasFiles || creatingThread) && !waiting && !unchanged
    const createOnly = creatingThread && !hasText
    return (
        <ActionSlot>
            {/* The reference draws ChatInputActionButton here; Button is used instead so the composer shares the
                design system's press spring and disabled fade. The overrides keep the reference's 36 dp brand
                square and its icon tint. */}
            <Button
                icon={createOnly ? 'ThreadPlusIcon' : 'SendMessageIcon'}
                accessibilityLabel={
                    createOnly ? t('threads.create') : t('composer.send')
                }
                disabled={!enabled}
                onPress={composer.send}
                buttonStyle={styles.send}
                iconStyle={styles.sendIcon(enabled)}
            />
        </ActionSlot>
    )
}

/** The characters left, over the top right of the input for the last tenth of the limit; red once over it. */
function CharCounter() {
    const session = useSession()
    const premiumType = useSessionStore(
        usersStore,
        state => state.users[session.userId]?.premium_type,
    )
    const length = useComposerState(state => state.text.length)
    const max = maxMessageLength(premiumType)
    const remaining = max - length
    if (remaining > max / 10) return null
    return (
        <View pointerEvents="box-none" style={styles.counter}>
            <PressableOpacity
                hitSlop={8}
                onPress={() =>
                    toast(
                        premiumType === 2
                            ? t('composer.counterInfo', { max })
                            : t('composer.counterNitro', { max, nitro: 4000 }),
                    )
                }
                style={styles.counterButton}
            >
                <Text
                    variant="text-xxs/semibold"
                    lineClamp={1}
                    color={
                        remaining < 0
                            ? 'TEXT_FEEDBACK_CRITICAL'
                            : 'TEXT_DEFAULT'
                    }
                >
                    {remaining}
                </Text>
                {premiumType !== 2 && (
                    <Icon name="NitroWheelIcon" size="xs" color="ICON_MUTED" />
                )}
            </PressableOpacity>
        </View>
    )
}

// The composer's own panels and buttons. The plus button and its rows are the uploader's
// (upload/composerSlots), the expression button the picker's (expressions/picker), at order 0 of their side.
registerComposerSlots({
    panels: { context: { placement: 'card', order: 0, Component: ContextBar } },
    actionButtons: {
        send: { side: 'end', order: 20, Component: SendButton },
        // Absolute, over the row's top right: its order doesn't matter.
        counter: { side: 'end', order: 30, Component: CharCounter },
    },
})

const styles = StyleSheet.create(theme => {
    const mobile = theme.modules.mobile
    return {
        send: {
            width: mobile.CHAT_INPUT_SEND_BUTTON_WIDTH,
            height: mobile.CHAT_INPUT_SEND_BUTTON_HEIGHT,
            borderRadius: theme.radii.sm,
            paddingHorizontal: 0,
            borderWidth: 0,
            backgroundColor:
                theme.colors.CHAT_INPUT_SEND_BUTTON_ACTIVE_BACKGROUND,
        },
        // ChatInputSendButton's iconActive tint; muted while there is nothing to send.
        sendIcon: (enabled: boolean) => ({
            width: mobile.CHAT_INPUT_ACTION_ICON_PIXEL_SIZE,
            height: mobile.CHAT_INPUT_ACTION_ICON_PIXEL_SIZE,
            tintColor: enabled
                ? theme.colors.CHAT_INPUT_SEND_BUTTON_ICON_ACTIVE_TINT
                : theme.colors.TEXT_MUTED,
        }),
        counter: {
            position: 'absolute',
            top: mobile.CHAT_INPUT_FLOATING_CONTENT_PADDING_VERTICAL,
            right: mobile.CHAT_INPUT_FLOATING_CONTENT_PADDING_HORIZONTAL,
        },
        counterButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.PX_4,
        },
    }
})
