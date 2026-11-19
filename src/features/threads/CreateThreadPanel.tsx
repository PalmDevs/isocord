import { useState } from 'react'
import { Keyboard, ScrollView, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { MAX_CHANNEL_NAME_LENGTH } from '../../core/discord/channelLimits'
import { useSession, useSessionStore } from '../../core/react'
import { TextInput } from '../../design/components/inputs/TextInput'
import { NavigatorHeader } from '../../design/components/layout/NavigatorHeader'
import { TableSwitchRow } from '../../design/components/table/TableControlRows'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'
import { channelsStore } from '../../stores/channels/channels'
import { messagesStore } from '../../stores/messages/messages'
import { Composer, ComposerProvider, useComposer } from '../chat/composer'
import { usePrivateThreadMode } from '../chat/composer/state/status'
import { toast } from '../chat/composer/toast'
import { buildMessageRow } from '../chat/rows/rowEncoder'
import { StaticMessage } from '../chat/StaticMessage'
import { createThread, defaultThreadName, sanitizeThreadName } from './create'

/** How far the starter message is shown before it is cut with a fade (ThreadCreationStarterMessage). */
const STARTER_MAX_HEIGHT = 200

/**
 * CreateThreadView, as a panel over the chat (the reference's CREATE_THREAD screen of the channel stack): the
 * thread's name, the Private Thread switch for one on its own, over the message it starts from, and the composer for its first message. Sending creates the thread
 * and sends the message into it if there is one; `onCreated` then shows the thread.
 */
export function CreateThreadPanel({
    channelId,
    messageId,
    onBack,
    onCreated,
}: {
    /** The channel the thread starts in. */
    channelId: string
    /** The message it starts from, if any. */
    messageId?: string
    onBack: () => void
    onCreated: (threadId: string) => void
}) {
    const session = useSession()
    const [name, setName] = useState('')
    const [nameError, setNameError] = useState<string>()
    const [privateChecked, setPrivateChecked] = useState(false)
    const privateThreadMode = usePrivateThreadMode(channelId)
    // getIsPrivate: a thread is private when it can only be, else as switched.
    const isPrivate = privateThreadMode === 'privateOnly' || privateChecked
    const message = useSessionStore(messagesStore, state =>
        messageId
            ? state.channels[channelId]?.messages.find(
                  item => item.id === messageId,
              )
            : undefined,
    )
    const defaultName = defaultThreadName(session, channelId, message)
    const starterRow = message && buildMessageRow(session, message)

    // useSubmitForm: a thread on its own needs a name; one on a message is named after it.
    const create = async () => {
        const parent = session.get(channelsStore).getState().channels[channelId]
        if (!parent) return undefined
        const typed = sanitizeThreadName(name)
        if (!messageId && typed === '') {
            setNameError(t('threads.nameRequired'))
            Keyboard.dismiss()
            return undefined
        }
        setNameError(undefined)
        const thread = await createThread(session, parent, {
            name: typed || defaultName || t('threads.defaultName'),
            messageId,
            // Only a thread on its own can be private.
            isPrivate: !messageId && isPrivate,
        })
        if (thread === 'nameRequired') {
            setNameError(t('threads.nameRequired'))
            Keyboard.dismiss()
            return undefined
        }
        if (thread === 'failed') {
            toast(t('threads.createFailed'))
            return undefined
        }
        return thread.id
    }

    return (
        <ComposerProvider channelId={channelId} thread={{ create, onCreated }}>
            <View style={styles.container}>
                <Header channelId={channelId} onBack={onBack} />
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.iconContainer}>
                        <Icon name="ThreadIcon" size="lg" color="TEXT_STRONG" />
                    </View>
                    <View style={styles.options}>
                        <NameInput
                            value={name}
                            onChange={text => {
                                setName(text)
                                setNameError(undefined)
                            }}
                            optional={messageId !== undefined}
                            placeholder={defaultName || t('threads.new')}
                            error={nameError}
                        />
                        {!messageId && privateThreadMode !== 'disabled' && (
                            <View style={styles.privateThread}>
                                <TableSwitchRow
                                    start
                                    end
                                    disabled={privateThreadMode !== 'enabled'}
                                    label={t('threads.private')}
                                    subLabel={t('threads.privateDescription')}
                                    value={isPrivate}
                                    onValueChange={setPrivateChecked}
                                />
                            </View>
                        )}
                    </View>
                    {starterRow && message && (
                        <>
                            <View style={styles.divider} />
                            <StaticMessage
                                author={message.author}
                                row={starterRow}
                                maxHeight={STARTER_MAX_HEIGHT}
                            />
                        </>
                    )}
                </ScrollView>
                <Composer />
            </View>
        </ComposerProvider>
    )
}

/** GuildChannelHeader with `showCreateThread`: "New Thread", under it the channel it starts in. */
function Header({
    channelId,
    onBack,
}: {
    channelId: string
    onBack: () => void
}) {
    const parentName = useSessionStore(
        channelsStore,
        state => state.channels[channelId]?.name,
    )
    return (
        <NavigatorHeader
            title={t('threads.new')}
            subtitle={parentName}
            titleIcon={
                <Icon name="ThreadIcon" size="sm" color="ICON_DEFAULT" />
            }
            onBack={onBack}
            backLabel={t('common.back')}
        />
    )
}

/** ThreadCreationTitleInput. "Next" moves on to the first message. */
function NameInput({
    value,
    onChange,
    optional,
    placeholder,
    error,
}: {
    value: string
    onChange: (text: string) => void
    optional: boolean
    placeholder: string
    error: string | undefined
}) {
    const composer = useComposer()
    return (
        <TextInput
            label={t(optional ? 'threads.nameOptional' : 'threads.name')}
            accessibilityHint={optional ? undefined : t('threads.nameHint')}
            required={!optional}
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            errorMessage={error}
            maxLength={MAX_CHANNEL_NAME_LENGTH}
            clearable
            autoFocus
            returnKeyType="next"
            textContentType="none"
            submitBehavior="submit"
            onSubmitEditing={() => composer.focus()}
        />
    )
}

const styles = StyleSheet.create(theme => ({
    container: { flex: 1, backgroundColor: theme.colors.BACKGROUND_BASE_LOWER },
    scroll: { flex: 1 },
    // Pushed to the bottom, over the composer, which overlaps it by half its scrim.
    content: {
        flexGrow: 1,
        justifyContent: 'flex-end',
        paddingHorizontal: theme.space.PX_12,
        paddingBottom:
            theme.modules.mobile.CHAT_INPUT_FLOATING_SCRIM_GRADIENT_HEIGHT / 2 +
            theme.space.PX_16,
    },
    iconContainer: {
        width: theme.space.PX_64,
        height: theme.space.PX_64,
        marginVertical: theme.space.PX_16,
        borderRadius: theme.radii.lg,
        backgroundColor: theme.colors.BACKGROUND_MOD_SUBTLE,
        justifyContent: 'center',
        alignItems: 'center',
    },
    options: { paddingBottom: theme.space.PX_16 },
    privateThread: { paddingTop: theme.space.PX_8 },
    divider: {
        height: 1,
        backgroundColor: theme.colors.BORDER_SUBTLE,
        alignSelf: 'stretch',
        marginBottom: theme.space.PX_16,
    },
}))
