import { Day, sequence } from './build'
import { SAMPLE_VIDEO_URL } from './media'
import { BOT } from './world'
import type { Embed } from '../../../../stores/messages/messageTypes'

const picsum = (id: number, width: number, height: number) => ({
    url: `https://picsum.photos/id/${id}/${width}/${height}.jpg`,
    width,
    height,
})

const EXAMPLE_URL = 'https://example.com/article'
const EMBED_TIME = '2026-03-02T12:00:00.000Z'

const rich: Embed = {
    type: 'rich',
    title: 'A rich embed with **markdown**',
    url: EXAMPLE_URL,
    description:
        'The description supports *markdown*, `code` and [links](https://example.com).\n- And lists',
    color: 0x5865f2,
    timestamp: EMBED_TIME,
    author: { name: 'Embed author', url: EXAMPLE_URL },
    footer: { text: 'Embed footer' },
    thumbnail: picsum(1005, 200, 200),
    fields: [
        { name: 'Inline field', value: 'Value one', inline: true },
        { name: 'Inline field', value: 'Value two', inline: true },
        { name: 'Inline field', value: 'Value three', inline: true },
        { name: 'Full width field', value: 'A field that spans the card.' },
    ],
}

export const embedMessages = sequence(Day.EMBEDS, [
    { author: BOT, content: '', embeds: [rich] },
    {
        author: BOT,
        content: 'A rich embed with a large image and no color.',
        embeds: [
            {
                type: 'rich',
                title: 'Image embed',
                description: 'The image sits under the text.',
                image: picsum(1011, 800, 450),
            },
        ],
    },
    {
        gapMinutes: 8,
        content: 'A link embed: https://example.com/article',
        embeds: [
            {
                type: 'link',
                title: 'Example article title',
                url: EXAMPLE_URL,
                description: 'A page description pulled from the site.',
                provider: { name: 'Example' },
                thumbnail: picsum(1012, 200, 200),
            },
        ],
    },
    {
        content: 'An article embed: https://example.com/article',
        embeds: [
            {
                type: 'article',
                title: 'An article with a large preview',
                url: EXAMPLE_URL,
                description: 'Articles show the thumbnail large.',
                provider: { name: 'Example News' },
                thumbnail: picsum(1013, 640, 360),
            },
        ],
    },
    {
        gapMinutes: 8,
        content: 'An image embed: https://example.com/photo.jpg',
        embeds: [
            {
                type: 'image',
                url: 'https://example.com/photo.jpg',
                thumbnail: picsum(1014, 640, 400),
            },
        ],
    },
    {
        content: 'A gifv embed: https://example.com/clip.gif',
        embeds: [
            {
                type: 'gifv',
                url: 'https://example.com/clip.gif',
                thumbnail: picsum(1024, 480, 270),
                video: {
                    url: SAMPLE_VIDEO_URL,
                    proxy_url: SAMPLE_VIDEO_URL,
                    width: 480,
                    height: 270,
                },
            },
        ],
    },
    {
        gapMinutes: 8,
        content: 'A video embed: https://example.com/watch',
        embeds: [
            {
                type: 'video',
                title: 'A video that plays inline',
                url: 'https://example.com/watch',
                provider: { name: 'Example Video' },
                thumbnail: picsum(1026, 640, 360),
                video: {
                    url: SAMPLE_VIDEO_URL,
                    proxy_url: SAMPLE_VIDEO_URL,
                    width: 640,
                    height: 360,
                },
            },
        ],
    },
    {
        content: 'Embeds sharing a url form one gallery.',
        embeds: [1027, 1028, 1029].map(id => ({
            type: 'rich',
            url: 'https://example.com/gallery',
            image: picsum(id, 600, 400),
        })),
    },
    {
        gapMinutes: 8,
        author: BOT,
        content: 'Several embeds in one message.',
        embeds: [
            {
                type: 'rich',
                title: 'First',
                description: 'One',
                color: 0xed4245,
            },
            {
                type: 'rich',
                title: 'Second',
                description: 'Two',
                color: 0x57f287,
            },
        ],
    },
])
