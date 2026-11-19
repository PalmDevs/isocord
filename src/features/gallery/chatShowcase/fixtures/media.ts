import { AttachmentFlag, MessageFlag } from '../../../../core/discord/messages'
import { Day, sequence } from './build'
import { BOB } from './world'
import type { Attachment } from '../../../../stores/messages/messageTypes'

/*
 * Public sample media only: picsum.photos for images, MDN's CC0 files for video and audio. Nothing here reaches
 * an account's files.
 */
export const picsum = (id: number, width: number, height: number) =>
    `https://picsum.photos/id/${id}/${width}/${height}.jpg`
const MDN_MEDIA = 'https://interactive-examples.mdn.mozilla.net/media/cc0'
export const SAMPLE_VIDEO_URL = `${MDN_MEDIA}-videos/flower.mp4`
export const SAMPLE_AUDIO_URL = `${MDN_MEDIA}-audio/t-rex-roar.mp3`
const SAMPLE_FILE_URL = 'https://example.com/files/report.pdf'

/** Bytes of a made-up voice waveform (up to 256 amplitude bytes, base64 on the wire). */
const WAVEFORM_BARS = 64
const WAVEFORM_PEAK = 255
const VOICE_SECONDS = 12.5
const waveform = btoa(
    String.fromCharCode(
        ...Array.from({ length: WAVEFORM_BARS }, (_, bar) =>
            Math.round(
                (WAVEFORM_PEAK / 2) *
                    (1 + Math.sin(bar / 4) * Math.cos(bar / 11)),
            ),
        ),
    ),
)

let nextId = 200000000000000000n
/** Builds an attachment with a fixed id from a counter, so ids stay stable between renders. */
function attachment(
    filename: string,
    url: string,
    extra: Partial<Attachment> = {},
): Attachment {
    nextId += 1n
    return {
        id: String(nextId),
        filename,
        size: 245_000,
        url,
        proxy_url: url,
        ...extra,
    }
}

const image = (id: number, width: number, height: number, name: string) =>
    attachment(name, picsum(id, width, height), {
        width,
        height,
        content_type: 'image/jpeg',
    })

const video = attachment('flower.mp4', SAMPLE_VIDEO_URL, {
    width: 640,
    height: 360,
    content_type: 'video/mp4',
    size: 1_200_000,
})

export const landscapeImage = image(10, 800, 500, 'forest.jpg')

export const mediaMessages = sequence(Day.MEDIA, [
    {
        content: 'One landscape image.',
        attachments: [landscapeImage],
    },
    {
        content: 'One portrait image with alt text.',
        attachments: [
            {
                ...image(1018, 500, 800, 'mountain.jpg'),
                description: 'A mountain under a cloudy sky',
            },
        ],
    },
    {
        gapMinutes: 8,
        content: 'Two images.',
        attachments: [
            image(1015, 800, 600, 'river.jpg'),
            image(1016, 800, 600, 'canyon.jpg'),
        ],
    },
    {
        content: 'Three images.',
        attachments: [
            image(1018, 800, 600, 'one.jpg'),
            image(1020, 800, 600, 'two.jpg'),
            image(1021, 800, 600, 'three.jpg'),
        ],
    },
    {
        content: 'Four images.',
        attachments: [10, 1015, 1016, 1018].map(id =>
            image(id, 800, 600, `tile-${id}.jpg`),
        ),
    },
    {
        content: 'Ten images, the most a message holds.',
        attachments: Array.from({ length: 10 }, (_, index) =>
            image(1030 + index, 800, 600, `many-${index}.jpg`),
        ),
    },
    { gapMinutes: 8, content: 'A video.', attachments: [video] },
    { content: '', attachments: [video, image(10, 800, 500, 'forest.jpg')] },
    {
        gapMinutes: 8,
        content: 'An audio file.',
        attachments: [
            attachment('t-rex-roar.mp3', SAMPLE_AUDIO_URL, {
                content_type: 'audio/mpeg',
                duration_secs: 4,
            }),
        ],
    },
    {
        content: '',
        flags: MessageFlag.IS_VOICE_MESSAGE,
        attachments: [
            attachment('voice-message.ogg', SAMPLE_AUDIO_URL, {
                content_type: 'audio/ogg',
                duration_secs: VOICE_SECONDS,
                waveform,
                flags: AttachmentFlag.IS_VOICE_MESSAGE,
            }),
        ],
    },
    {
        gapMinutes: 8,
        content: 'A file.',
        attachments: [
            attachment('report.pdf', SAMPLE_FILE_URL, {
                content_type: 'application/pdf',
                size: 3_400_000,
            }),
            attachment('archive.zip', SAMPLE_FILE_URL, { size: 52_000_000 }),
        ],
    },
    {
        gapMinutes: 8,
        author: BOB,
        content: 'A spoiler image and a spoiler video.',
        attachments: [
            {
                ...image(1025, 800, 600, 'spoiler.jpg'),
                flags: AttachmentFlag.IS_SPOILER,
            },
            {
                ...video,
                filename: 'SPOILER_flower.mp4',
                id: '200000000000000099',
            },
        ],
    },
])
