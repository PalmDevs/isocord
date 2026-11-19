import { LIMITED_CHANNEL_NAME_TYPES } from '../../core/discord/channelType'

/** Characters of a limited name that are turned into a dash: whitespace, dashes and tildes. */
const NAME_SEPARATORS = /[\s\-~]+/g
const LEADING_DASHES = /^-+/
const NAME_PUNCTUATION = /[\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g

/**
 * sanitizeChannelName: a text, announcement, forum or media channel name is lowercase, with dashes for spaces and no
 * punctuation (sanitizeGuildTextChannelName). Other types keep what was typed.
 */
export function sanitizeChannelName(name: string, type: number): string {
    if (!LIMITED_CHANNEL_NAME_TYPES.has(type)) return name
    return name
        .replace(NAME_SEPARATORS, '-')
        .replace(LEADING_DASHES, '')
        .replace(NAME_PUNCTUATION, '')
        .toLowerCase()
}

const LINE_BREAKS = /\r\n|[\r\n]/g

/** sanitizeThreadName: line breaks become spaces. The reference trims on blur, in the save. */
export const sanitizeThreadName = (name: string): string =>
    name.replace(LINE_BREAKS, ' ')
