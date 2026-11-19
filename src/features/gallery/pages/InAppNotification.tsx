import { StickerFormat } from '../../../core/discord/expressionTypes'
import { snowflakeFromTimestamp } from '../../../core/discord/snowflake'
import { useSession } from '../../../core/react'
import { showToast } from '../../../design/components/overlays/toastStore'
import { TableRow } from '../../../design/components/table/TableRow'
import { TableRowGroup } from '../../../design/components/table/TableRowGroup'
import { channelsStore } from '../../../stores/channels/channels'
import { usersStore } from '../../../stores/users'
import { showInAppNotification } from '../../inAppNotifications/store'
import { serversUiStore } from '../../servers/store'
import { PageSection } from '../GalleryPage'
import type { Session } from '../../../core/session'
import type { Message } from '../../../stores/readStates'

/*
 * DevToolsInAppNotificationTestingScreen: notifications made up from the selected channel and the current user,
 * shown without the checks a real message goes through. Nothing is sent to the account.
 */

type Variant = 'text-only' | 'media-only' | 'text-and-media'

const SHORT_TEXT = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
const LONG_TEXT =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum..'
const IMAGE_URL = 'https://cdn.discordapp.com/assets/og_img_discord_home.png'
/** The reference's fallback sticker when the client doesn't have it. */
const STICKER = {
    id: '781324722394103808',
    name: 'Cheer',
    format_type: StickerFormat.APNG,
}

const VARIANTS: Array<{ variant: Variant; label: string }> = [
    { variant: 'text-only', label: 'Text Only' },
    { variant: 'media-only', label: 'Media Only' },
    { variant: 'text-and-media', label: 'Message and Media' },
]

/** How many notifications the queue test shows at once: one on screen, two waiting, one dropped. */
const BURST = 4

const error = (content: string) =>
    showToast({ key: 'in-app-notification-test', content, variant: 'critical' })

/** buildTestMessageData: a message of the given kind in the selected channel, by the current user. */
function testMessage(
    session: Session,
    variant: Variant,
    index = 0,
): { message: Message; channelId: string } | undefined {
    const { selectedGuildId, selectedChannelIds } = session
        .get(serversUiStore)
        .getState()
    const channelId = selectedGuildId
        ? selectedChannelIds[selectedGuildId]
        : undefined
    if (
        !channelId ||
        !session.get(channelsStore).getState().channels[channelId]
    ) {
        error('Select a channel first')
        return undefined
    }
    const author = session.get(usersStore).getState().users[session.userId]
    if (!author) {
        error('Current user is null')
        return undefined
    }
    // Ids made up from the time, apart for the ones made in the same millisecond.
    const id = String(
        BigInt(snowflakeFromTimestamp(Date.now())) + BigInt(index),
    )
    return {
        channelId,
        message: {
            id,
            channel_id: channelId,
            author,
            type: 0,
            timestamp: new Date().toISOString(),
            content:
                variant === 'media-only'
                    ? ''
                    : variant === 'text-and-media'
                      ? LONG_TEXT
                      : SHORT_TEXT,
            attachments:
                variant === 'text-and-media'
                    ? [
                          {
                              id,
                              url: IMAGE_URL,
                              proxy_url: IMAGE_URL,
                              filename: 'og_img_discord_home.png',
                              size: 54697,
                              width: 1200,
                              height: 630,
                              content_type: 'image/png',
                          },
                      ]
                    : [],
            sticker_items: variant === 'media-only' ? [STICKER] : [],
            embeds: [],
        },
    }
}

function show(session: Session, variant: Variant, index = 0) {
    const test = testMessage(session, variant, index)
    if (!test) return
    const channel = session.get(channelsStore).getState().channels[
        test.channelId
    ]
    if (channel) showInAppNotification(session, test.message, channel)
}

export function InAppNotificationPage() {
    const session = useSession()
    return (
        <>
            <PageSection title="Message">
                <TableRowGroup description="Enqueues notification using the currently selected channel.">
                    {VARIANTS.map(({ variant, label }) => (
                        <TableRow
                            key={variant}
                            label={label}
                            onPress={() => show(session, variant)}
                        />
                    ))}
                </TableRowGroup>
            </PageSection>
            <PageSection title="Queue">
                <TableRowGroup description="One notification shows at a time and two wait; a third waiting one pushes the oldest out.">
                    <TableRow
                        label={`${BURST} at once`}
                        subLabel="Shows the first, then the third and fourth. The second is dropped."
                        onPress={() => {
                            for (let index = 0; index < BURST; index++)
                                show(session, 'text-only', index)
                        }}
                    />
                </TableRowGroup>
            </PageSection>
        </>
    )
}
