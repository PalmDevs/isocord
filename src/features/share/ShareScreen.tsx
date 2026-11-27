import { useNavigation, useRoute } from '@react-navigation/native'
import { useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { MAX_DESTINATION_COUNT, MessageFlag } from '../../core/discord/messages'
import { useSession } from '../../core/react'
import { IconButton } from '../../design/components/buttons/IconButton'
import { NavigatorHeader } from '../../design/components/layout/NavigatorHeader'
import { t } from '../../i18n'
import { channelsStore } from '../../stores/channels/channels'
import { Composer, ComposerProvider, useComposer } from '../chat/composer'
import { saveDraft } from '../chat/composer/outbox/drafts'
import { toast } from '../chat/composer/toast'
import { openChannel } from '../chat/links/openChannel'
import { copyLink } from '../chat/longPress/messageActionRows'
import { clearAttachments, uploadsStore } from '../upload'
import { DestinationList } from './DestinationList'
import { rankDestinations, shareDestinations } from './destinations'
import { isSlowmoded, sendForwards, sendShares } from './send'
import { SharePreviewContext } from './sharePreviewContext'
import type { Session } from '../../core/session'
import type { SharedContent } from '../../native/IsocordShare'
import type { Message } from '../../stores/readStates'
import type { Payload } from './destinations'
import type { ShareParams } from './params'
import type { SharePreviewValue } from './sharePreviewContext'

/** A share's draft and files. Each share starts from what was shared, so one is enough. */
const SHARE_DRAFT = 'share'

/** A forward's added text, per channel, as DraftType.ForwardContextMessage. */
const forwardDraft = (channelId: string) => `forward.${channelId}`

type SnapshotMessage = Message & {
    message_snapshots?: Array<{ message: Partial<Message> }>
}

/** What the forward or share carries, for the channels that refuse it. */
function payloadOf(params: ShareParams): Payload {
    if (params.kind === 'share')
        return {
            attachments: params.content.files.length > 0,
            embeds: false,
            voiceMessage: false,
        }
    const base = params.message as SnapshotMessage
    const content = base.message_snapshots?.[0]?.message ?? base
    return {
        attachments: (content.attachments?.length ?? 0) > 0,
        embeds: (content.embeds?.length ?? 0) > 0,
        voiceMessage:
            ((content.flags ?? 0) & MessageFlag.IS_VOICE_MESSAGE) !== 0,
    }
}

/**
 * ForwardModal and ShareScreen as one screen: the places to send to, picked with a search, and the composer for an
 * optional message, with the forwarded message as a panel over it. A share's files are the composer's own, and its
 * text starts in the input.
 */
export function ShareScreen() {
    const navigation = useNavigation()
    const params = useRoute().params as ShareParams
    const session = useSession()
    const forward = params.kind === 'forward' ? params.message : undefined
    const draftId = forward ? forwardDraft(forward.channel_id) : SHARE_DRAFT
    const [destinations] = useState(() => {
        // Before the composer reads its draft: a share's text is what was shared.
        if (params.kind === 'share')
            saveDraft(session, SHARE_DRAFT, params.content.text)
        return shareDestinations(
            session,
            payloadOf(params),
            forward?.channel_id,
        )
    })
    const [selected, setSelected] = useState<string[]>([])
    // formatResults' pinnedDestinations: the picks as of the last search change, so a tap does not move rows.
    const [pinned, setPinned] = useState<string[]>([])
    const [query, setQuery] = useState('')
    const [sending, setSending] = useState(false)
    const full = selected.length >= MAX_DESTINATION_COUNT

    const toggle = (channelId: string) =>
        setSelected(list =>
            list.includes(channelId)
                ? list.filter(id => id !== channelId)
                : list.length >= MAX_DESTINATION_COUNT
                  ? list
                  : [...list, channelId],
        )

    const send = async (content: string, silent: boolean) => {
        const failed = await deliver(session, params, selected, content, silent)
        if (failed === undefined) return false
        if (failed.length > 0) {
            // withoutSentDestinations: what went is unpicked, the rest can be sent again.
            setSelected(failed)
            toast(t(forward ? 'share.forwardFailed' : 'share.shareFailed'))
            return false
        }
        if (forward) toast(t('share.forwarded'))
        navigation.goBack()
        // transitionToChannel: one place opens.
        if (selected.length === 1 && selected[0]) openChannel(selected[0])
        return true
    }

    // `ready` only turns off after a render: a second quick tap must not send again.
    const inFlight = useRef(false)
    const sendWhileIdle = async (content: string, silent: boolean) => {
        if (inFlight.current) return false
        inFlight.current = true
        setSending(true)
        try {
            return await send(content, silent)
        } finally {
            inFlight.current = false
            setSending(false)
        }
    }

    const slowmodeNames = forward
        ? destinations
              .filter(
                  item =>
                      selected.includes(item.channel.id) &&
                      isSlowmoded(session, item.channel.id),
              )
              .map(item => item.name)
        : []
    const slowmodeKey = slowmodeNames.join('\n')
    // Context value: a new object re-renders the panel on every keystroke in the search.
    // biome-ignore lint/correctness/useExhaustiveDependencies: the names are keyed by their joined text
    const preview = useMemo<SharePreviewValue>(
        () => ({ message: forward, slowmodeNames }),
        [forward, slowmodeKey],
    )

    return (
        <ComposerProvider
            channelId={forward?.channel_id ?? ''}
            attached={{
                draftId,
                ready: selected.length > 0 && !sending,
                allowsEmpty: forward !== undefined,
                send: sendWhileIdle,
            }}
        >
            <View style={styles.container}>
                <Header
                    message={forward}
                    full={full}
                    onClose={() => navigation.goBack()}
                />
                <DestinationList
                    destinations={rankDestinations(destinations, query, pinned)}
                    selected={selected}
                    full={full}
                    query={query}
                    onQueryChange={next => {
                        setPinned(selected)
                        setQuery(next)
                    }}
                    onToggle={toggle}
                />
                <SharePreviewContext value={preview}>
                    <Composer />
                </SharePreviewContext>
                {params.kind === 'share' && (
                    <SharedFiles content={params.content} />
                )}
                <DropFilesOnLeave />
            </View>
        </ComposerProvider>
    )
}

/** Sends the forward or share. Returns the places it failed for, or undefined when there was nothing to send. */
async function deliver(
    session: Session,
    params: ShareParams,
    channelIds: string[],
    content: string,
    silent: boolean,
): Promise<string[] | undefined> {
    if (params.kind === 'forward')
        return sendForwards(
            session,
            params.message,
            channelIds,
            content,
            silent,
        )
    const files =
        session.get(uploadsStore).getState().channels[SHARE_DRAFT]?.length ?? 0
    if (content === '' && files === 0) return undefined
    return sendShares(session, SHARE_DRAFT, channelIds, content, silent)
}

/** "Forward To" or "Share to", the place limit as a warning, and Copy Message Link for a forward. */
function Header({
    message,
    full,
    onClose,
}: {
    message: Message | undefined
    full: boolean
    onClose: () => void
}) {
    const session = useSession()
    return (
        <NavigatorHeader
            title={t(message ? 'share.forwardTitle' : 'share.shareTitle')}
            subtitle={
                full
                    ? t('share.maxDestinations', {
                          count: MAX_DESTINATION_COUNT,
                      })
                    : undefined
            }
            subtitleColor="TEXT_FEEDBACK_WARNING"
            backIcon="XLargeIcon"
            backLabel={t('common.close')}
            onBack={onClose}
            trailing={
                message && (
                    <IconButton
                        icon="LinkIcon"
                        variant="icon-only"
                        size="md"
                        accessibilityLabel={t('share.copyMessageLink')}
                        onPress={() =>
                            copyLink(
                                session.get(channelsStore).getState().channels[
                                    message.channel_id
                                ],
                                message,
                            ).onPress()
                        }
                    />
                )
            }
        />
    )
}

/** Puts the shared files in the composer's list, where they show over the card. */
function SharedFiles({ content }: { content: SharedContent }) {
    const session = useSession()
    const composer = useComposer()
    // biome-ignore lint/correctness/useExhaustiveDependencies: once per screen
    useEffect(() => {
        clearAttachments(session, composer.attachmentsKey)
        composer.addAttachments(
            content.files.map(file => ({
                uri: file.uri,
                filename: file.filename,
                mimeType: file.mimeType,
            })),
        )
    }, [])
    return null
}

/** Drops the composer's files when the screen goes: a share's, or images pasted into a forward's input. */
function DropFilesOnLeave() {
    const session = useSession()
    const { attachmentsKey } = useComposer()
    useEffect(
        () => () => clearAttachments(session, attachmentsKey),
        [session, attachmentsKey],
    )
    return null
}

const styles = StyleSheet.create(theme => ({
    container: { flex: 1, backgroundColor: theme.colors.BACKGROUND_BASE_LOWER },
}))
