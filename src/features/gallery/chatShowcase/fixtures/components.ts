import {
    ButtonStyle,
    ComponentType,
    SelectDefaultValueType,
    SeparatorSpacing,
} from '../../../../core/discord/components'
import { MessageFlag, MessageType } from '../../../../core/discord/messages'
import { Day, sequence } from './build'
import { landscapeImage, picsum, SAMPLE_VIDEO_URL } from './media'
import { BOB, BOT, CARA, ChannelId, ME, RoleId } from './world'
import type {
    ApiComponent,
    ApiUnfurledMedia,
} from '../../../chat/messageComponents/apiComponent'
import type { ComponentInteractions } from '../../../chat/messageComponents/interactionStore'
import type { Sample } from './build'

const LINK_URL = 'https://example.com'
/** A component type the client does not know: left out, never drawn. */
const UNKNOWN_COMPONENT_TYPE = 999

const media = (id: number, width: number, height: number): ApiUnfurledMedia => {
    const url = picsum(id, width, height)
    return { url, proxy_url: url, width, height, content_type: 'image/jpeg' }
}
const thumbnailMedia = media(
    10,
    landscapeImage.width ?? 0,
    landscapeImage.height ?? 0,
)
const videoMedia: ApiUnfurledMedia = {
    url: SAMPLE_VIDEO_URL,
    proxy_url: SAMPLE_VIDEO_URL,
    width: 640,
    height: 360,
    content_type: 'video/mp4',
}

let customIds = 0
/** A button. Every non-link button gets a custom id, as a bot's would. */
const button = (
    style: number,
    label: string | undefined,
    extra: Partial<ApiComponent> = {},
): ApiComponent => ({
    type: ComponentType.BUTTON,
    style,
    label,
    ...(style === ButtonStyle.LINK || style === ButtonStyle.PREMIUM
        ? {}
        : { custom_id: `showcase-${++customIds}` }),
    ...extra,
})

const text = (content: string): ApiComponent => ({
    type: ComponentType.TEXT_DISPLAY,
    content,
})

const row = (...components: ApiComponent[]): ApiComponent => ({
    type: ComponentType.ACTION_ROW,
    components,
})

const select = (type: number, extra: Partial<ApiComponent>): ApiComponent => ({
    type,
    custom_id: `showcase-select-${++customIds}`,
    ...extra,
})

const separator = (divider: boolean, spacing: number): ApiComponent => ({
    type: ComponentType.SEPARATOR,
    divider,
    spacing,
})

const FRUIT_OPTIONS = [
    { label: 'Apple', value: 'apple', emoji: { name: '\u{1F34E}' } },
    {
        label: 'Banana',
        value: 'banana',
        description: 'Yellow and curved',
        emoji: { name: '\u{1F34C}' },
    },
    { label: 'Cherry', value: 'cherry', description: 'Comes in pairs' },
]

/** Action rows: buttons and select menus. Their taps toast in the showcase. */
const actionRowSamples: Sample[] = [
    {
        author: BOT,
        content: 'Every button style.',
        components: [
            row(
                button(ButtonStyle.PRIMARY, 'Primary'),
                button(ButtonStyle.SECONDARY, 'Secondary'),
                button(ButtonStyle.SUCCESS, 'Success'),
                button(ButtonStyle.DESTRUCTIVE, 'Danger'),
            ),
            row(
                button(ButtonStyle.LINK, 'Open example.com', { url: LINK_URL }),
                button(ButtonStyle.PREMIUM, undefined, { sku_id: '1' }),
            ),
        ],
    },
    {
        author: BOT,
        content: 'Emoji, emoji only and disabled buttons.',
        components: [
            row(
                button(ButtonStyle.SECONDARY, 'Party', {
                    emoji: { name: '\u{1F389}' },
                }),
                button(ButtonStyle.PRIMARY, undefined, {
                    emoji: { name: '\u{1F44D}' },
                }),
                button(ButtonStyle.PRIMARY, 'Disabled', { disabled: true }),
                button(ButtonStyle.LINK, 'Disabled link', {
                    url: LINK_URL,
                    disabled: true,
                }),
            ),
        ],
    },
    {
        author: BOT,
        content: 'A button waiting on the bot: the others wait too.',
        components: [
            row(
                button(ButtonStyle.PRIMARY, 'Confirm'),
                button(ButtonStyle.SECONDARY, 'Cancel'),
            ),
        ],
    },
    {
        author: BOT,
        content: 'A button whose interaction failed.',
        components: [row(button(ButtonStyle.SUCCESS, 'Claim reward'))],
    },
    {
        author: BOT,
        content: 'String selects: one pick, several picks with defaults.',
        components: [
            row(
                select(ComponentType.STRING_SELECT, {
                    placeholder: 'Pick a fruit',
                    options: FRUIT_OPTIONS,
                }),
            ),
            row(
                select(ComponentType.STRING_SELECT, {
                    placeholder: 'Pick some fruit',
                    min_values: 1,
                    max_values: 3,
                    options: FRUIT_OPTIONS.map((option, index) => ({
                        ...option,
                        default: index < 2,
                    })),
                }),
            ),
        ],
    },
    {
        author: BOT,
        content: 'User, role, mentionable and channel selects.',
        components: [
            row(
                select(ComponentType.USER_SELECT, {
                    placeholder: 'Pick a user',
                    default_values: [
                        { id: BOB.id, type: SelectDefaultValueType.USER },
                    ],
                }),
            ),
            row(
                select(ComponentType.ROLE_SELECT, {
                    placeholder: 'Pick roles',
                    max_values: 2,
                    default_values: [
                        {
                            id: RoleId.MODERATOR,
                            type: SelectDefaultValueType.ROLE,
                        },
                    ],
                }),
            ),
            row(
                select(ComponentType.MENTIONABLE_SELECT, {
                    placeholder: 'Pick anyone',
                }),
            ),
            row(
                select(ComponentType.CHANNEL_SELECT, {
                    default_values: [
                        {
                            id: ChannelId.GENERAL,
                            type: SelectDefaultValueType.CHANNEL,
                        },
                    ],
                }),
            ),
            row(
                select(ComponentType.STRING_SELECT, {
                    placeholder: 'A disabled select',
                    disabled: true,
                    options: FRUIT_OPTIONS,
                }),
            ),
        ],
    },
    {
        author: BOT,
        content: 'A select waiting on the bot.',
        components: [
            row(
                select(ComponentType.STRING_SELECT, {
                    placeholder: 'Pick a fruit',
                    options: FRUIT_OPTIONS,
                }),
            ),
        ],
    },
]

/** Components v2 layout: the message's content is its components. */
const layoutSamples: Sample[] = [
    {
        gapMinutes: 8,
        author: BOT,
        content: '',
        flags: MessageFlag.IS_COMPONENTS_V2,
        components: [
            {
                type: ComponentType.CONTAINER,
                accent_color: 0x5865f2,
                components: [
                    text(
                        '## A container\nComponents v2 layout with an **accent** colour.',
                    ),
                    separator(true, SeparatorSpacing.SMALL),
                    {
                        type: ComponentType.SECTION,
                        components: [
                            text('### Section'),
                            text('Text with a thumbnail on the side.'),
                        ],
                        accessory: {
                            type: ComponentType.THUMBNAIL,
                            id: 1,
                            media: thumbnailMedia,
                            description: 'A forest',
                        },
                    },
                    {
                        type: ComponentType.SECTION,
                        components: [text('A section with a button.')],
                        accessory: button(ButtonStyle.PRIMARY, 'Press'),
                    },
                    {
                        type: ComponentType.SECTION,
                        components: [text('A wide button goes under.')],
                        accessory: button(
                            ButtonStyle.SECONDARY,
                            'A button with a rather long label',
                        ),
                    },
                    separator(true, SeparatorSpacing.LARGE),
                    {
                        type: ComponentType.MEDIA_GALLERY,
                        id: 2,
                        items: [
                            { media: media(11, 800, 500) },
                            { media: media(12, 800, 500), spoiler: true },
                            { media: videoMedia, description: 'A flower' },
                        ],
                    },
                    separator(false, SeparatorSpacing.LARGE),
                    {
                        type: ComponentType.FILE,
                        name: 'report.pdf',
                        size: 245_000,
                        file: { url: `${LINK_URL}/report.pdf` },
                    },
                    row(
                        button(ButtonStyle.LINK, 'Docs', {
                            url: `${LINK_URL}/docs`,
                        }),
                    ),
                ],
            },
        ],
    },
    {
        author: BOT,
        content: '',
        flags: MessageFlag.IS_COMPONENTS_V2,
        components: [
            {
                type: ComponentType.CONTAINER,
                spoiler: true,
                components: [text('A container hidden by a spoiler.')],
            },
            {
                type: ComponentType.SECTION,
                components: [text('A spoiler thumbnail, outside a container.')],
                accessory: {
                    type: ComponentType.THUMBNAIL,
                    id: 3,
                    media: media(13, 400, 400),
                    spoiler: true,
                },
            },
            {
                type: ComponentType.MEDIA_GALLERY,
                id: 4,
                items: [{ media: media(14, 800, 500) }],
            },
            // Unknown components are skipped.
            { type: UNKNOWN_COMPONENT_TYPE },
            text('Plain text displays, **with** _markdown_ and `code`.'),
        ],
    },
]

/** Interaction responses: who ran the command, ephemeral messages, and messages on their way. */
const responseSamples: Sample[] = [
    {
        gapMinutes: 8,
        author: BOB,
        type: MessageType.CHAT_INPUT_COMMAND,
        content: 'A slash command response.',
        interaction_metadata: {
            name: 'shrug',
            user: {
                id: BOB.id,
                username: BOB.username,
                global_name: BOB.global_name,
            },
        },
    },
    {
        author: BOT,
        type: MessageType.CONTEXT_MENU_COMMAND,
        content: 'A context menu command response: no slash before the name.',
        interaction_metadata: {
            name: 'Translate Message',
            user: {
                id: CARA.id,
                username: CARA.username,
                global_name: CARA.global_name,
            },
        },
    },
    {
        author: BOT,
        type: MessageType.CHAT_INPUT_COMMAND,
        content: 'Only you can see this. Dismiss takes it away on this device.',
        flags: MessageFlag.EPHEMERAL,
        interaction_metadata: {
            name: 'roll',
            user: {
                id: ME.id,
                username: ME.username,
                global_name: ME.global_name,
            },
        },
    },
    {
        author: ME,
        content: 'A message you are still sending.',
        state: 'sending',
    },
    {
        author: ME,
        content: 'A message that failed to send.',
        state: 'failed',
        nonce: 'showcase-failed',
    },
]

export const componentMessages = sequence(Day.COMPONENTS, [
    ...actionRowSamples,
    ...layoutSamples,
    ...responseSamples,
])

const [, , waiting, failed, , , waitingSelect] = componentMessages

/** The interaction states the samples show: a button and a select waiting, a button that failed. */
export const showcaseInteractions: ComponentInteractions = {
    byMessage: {
        ...(waiting && {
            [waiting.id]: {
                nonce: 'showcase-waiting',
                componentId: '0,0',
                phase: 'created',
            },
        }),
        ...(failed && {
            [failed.id]: {
                nonce: 'showcase-failed-interaction',
                componentId: '0,0',
                phase: 'failed',
            },
        }),
        ...(waitingSelect && {
            [waitingSelect.id]: {
                nonce: 'showcase-waiting-select',
                componentId: '0,0',
                phase: 'queued',
            },
        }),
    },
    selections: {},
}
