/** Which part of a message's author line was tapped (`isocord://author/<messageId>/<part>`). */
export const HEADER_PARTS = [
    'name',
    'avatar',
    'guild-tag',
    'role-icon',
    'silent',
] as const
export type HeaderPart = (typeof HEADER_PARTS)[number]

/** Returns the part named by a link segment, or undefined for an unknown one. */
export function headerPartOf(value: string): HeaderPart | undefined {
    return HEADER_PARTS.find(part => part === value)
}
