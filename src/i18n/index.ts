import enUS from './locales/en-US.json'

export type MessageKey = keyof typeof enUS

/**
 * Loaded locales. To add a language, add `locales/<code>.json` with the same
 * keys and register it here; missing keys fall back to en-US.
 */
const locales: Record<string, Partial<Record<MessageKey, string>>> = {
    'en-US': enUS,
}

const current = 'en-US'

/** Looks up a message and fills `{name}` placeholders. */
export function t(
    key: MessageKey,
    values?: Record<string, string | number>,
): string {
    const message = locales[current]?.[key] ?? enUS[key]
    if (!values) return message
    return message.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in values ? String(values[name]) : match,
    )
}
