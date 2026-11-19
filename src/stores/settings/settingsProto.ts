import { strFromU8, strToU8 } from 'fflate'
import {
    base64ToBytes,
    concatBytes,
    readFields,
    readFixed64s,
    writeBytesField,
    writeFixed64Field,
    writeFixed64s,
    writeVarintField,
} from '../../core/protobuf'
import type { ProtoField } from '../../core/protobuf'
import type { ThemeId } from '../../design/tokens'

// The PreloadedUserSettings protobuf: one descriptor per setting, for reading, saving and the optimistic apply.

/** UserSettingsTypes.PRELOADED_USER_SETTINGS, the `settings-proto` type. */
export const PRELOADED_SETTINGS = 1

/** GUILD_FOLDERS: the `guild_folders` category. */
const GUILD_FOLDERS = 14

type ProtoValue = ProtoField[1]

/** How a field's value is encoded. */
interface Codec<T> {
    /** Decodes a present field. Undefined keeps the current value. */
    read: (raw: ProtoValue) => T | undefined
    /** Encodes the field, or nothing for the default. */
    write: (field: number, value: T) => Uint8Array
}

/** One setting: `path` is the category and the field in it. */
export interface SettingDescriptor<T> {
    path: readonly [category: number, field: number]
    codec: Codec<T>
    /** The value when the category comes without the field. Absent keeps the current value. */
    default?: T
    /** Other fields of the category cleared by the same save. */
    clears?: readonly number[]
}

type Descriptors<State> = {
    [K in keyof State]-?: SettingDescriptor<NonNullable<State[K]>>
}

const EMPTY = new Uint8Array()

const fieldOf = (bytes: Uint8Array, number: number): ProtoValue | undefined =>
    readFields(bytes).find(([n]) => n === number)?.[1]

/** A google.protobuf wrapper's value, its field 1. */
const wrapped = (raw: ProtoValue) =>
    raw instanceof Uint8Array ? fieldOf(raw, 1) : undefined

const enumCodec: Codec<number> = {
    read: raw => Number(raw),
    write: (field, value) =>
        value ? writeVarintField(field, BigInt(value)) : EMPTY,
}

const boolCodec: Codec<boolean> = {
    read: raw => raw === 1n,
    write: (field, value) => (value ? writeVarintField(field, 1n) : EMPTY),
}

/** BoolValue: an empty wrapper is false. */
const boolValueCodec: Codec<boolean> = {
    read: raw => wrapped(raw) === 1n,
    write: (field, value) =>
        writeBytesField(field, value ? writeVarintField(1, 1n) : EMPTY),
}

/** UInt32Value: an empty wrapper is 0. */
const uint32ValueCodec: Codec<number> = {
    read: raw => Number(wrapped(raw) ?? 0n),
    write: (field, value) =>
        writeBytesField(
            field,
            value ? writeVarintField(1, BigInt(value)) : EMPTY,
        ),
}

/** StringValue: an empty wrapper is "". */
const stringValueCodec: Codec<string> = {
    read: raw => {
        const value = wrapped(raw)
        return value instanceof Uint8Array ? strFromU8(value) : ''
    },
    write: (field, value) =>
        writeBytesField(
            field,
            value ? writeBytesField(1, strToU8(value)) : EMPTY,
        ),
}

/** preloaded_user_settings Theme by ThemeId (saveClientTheme, PROTO_THEME_MAP_MOBILE_REFRESH the other way). */
const PROTO_THEMES: Record<ThemeId, bigint> = {
    dark: 1n,
    light: 2n,
    darker: 3n,
    midnight: 4n,
}

const themeCodec: Codec<ThemeId> = {
    read: raw =>
        (Object.keys(PROTO_THEMES) as ThemeId[]).find(
            id => PROTO_THEMES[id] === raw,
        ),
    write: (field, value) => writeVarintField(field, PROTO_THEMES[value]),
}

/** The chat related user settings (PreloadedUserSettings.text_and_images) the expression picker depends on. */
export interface TextAndImagesSettings {
    /** Default skin tone: a modifier character, empty for none. */
    diversitySurrogate?: string
    animateEmoji?: boolean
    /** 0 always, 1 on interaction, 2 never. */
    animateStickers?: number
    convertEmoticons?: boolean
    expressionSuggestionsEnabled?: boolean
}

/** The top-level settings the store holds, by state key. */
export interface UserSettings {
    /** Raw SwipeRightToLeftMode. */
    swipeRightToLeftMode?: number
    /** Developer mode: shows IDs to copy in menus. */
    developerMode?: boolean
    /** ShowInAppNotifications: in-app notifications for new messages. Unset means on. */
    showInAppNotifications?: boolean
    /** The account's theme, synced across clients. */
    theme?: ThemeId
    /** The account's chosen language. Unset means the system's. */
    locale?: string
}

/** UserSettings definitions in the reference's user_settings module. */
export const USER_SETTINGS: Descriptors<UserSettings> = {
    // ChatGestureSettings: UNSET (0) means REPLY.
    swipeRightToLeftMode: { path: [13, 13], codec: enumCodec, default: 0 },
    developerMode: { path: [13, 2], codec: boolCodec, default: false },
    // `client_theme_settings` (3) is cleared, so no gradient or custom theme from another client stays over it.
    theme: { path: [13, 1], codec: themeCodec, clears: [3] },
    showInAppNotifications: {
        path: [7, 1],
        codec: boolValueCodec,
        default: true,
    },
    // LocaleStore sends it as X-Discord-Locale.
    locale: { path: [12, 1], codec: stringValueCodec },
}

/** `text_and_images` (6). A partial update keeps the fields it lacks. */
export const TEXT_AND_IMAGES: Descriptors<TextAndImagesSettings> = {
    diversitySurrogate: { path: [6, 1], codec: stringValueCodec },
    animateEmoji: { path: [6, 14], codec: boolValueCodec },
    animateStickers: { path: [6, 15], codec: uint32ValueCodec },
    convertEmoticons: { path: [6, 21], codec: boolValueCodec },
    expressionSuggestionsEnabled: { path: [6, 22], codec: boolValueCodec },
}

/** A custom status: its text and emoji. */
export interface CustomStatus {
    text: string
    emoji?: { id?: string | null; name: string }
}

/**
 * CustomStatus { string text = 1; fixed64 emoji_id = 2; string emoji_name = 3; fixed64 expires_at_ms = 4;
 * fixed64 created_at_ms = 5; }. Null clears it. Never expires (ClearAfterValues.DONT_CLEAR). Only written.
 */
const customStatusCodec: Codec<CustomStatus | null> = {
    read: () => undefined,
    write: (field, value) => {
        if (!value) return EMPTY
        const { text, emoji } = value
        return writeBytesField(
            field,
            concatBytes([
                text ? writeBytesField(1, strToU8(text)) : EMPTY,
                emoji?.id ? writeFixed64Field(2, emoji.id) : EMPTY,
                emoji ? writeBytesField(3, strToU8(emoji.name)) : EMPTY,
                writeFixed64Field(5, String(Date.now())),
            ]),
        )
    },
}

/** `status` (11) `custom_status` (2): UserSettings.CustomStatusSetting. */
export const CUSTOM_STATUS: SettingDescriptor<CustomStatus | null> = {
    path: [11, 2],
    codec: customStatusCodec,
}

/**
 * Reads the settings `descriptors` describe from a PreloadedUserSettings message's categories, by
 * number. Only the settings whose category is present and whose value is known are returned.
 */
export function readSettings<State>(
    categories: ReadonlyMap<number, Uint8Array>,
    descriptors: Descriptors<State>,
): Partial<State> {
    const result: Partial<State> = {}
    for (const key of Object.keys(descriptors) as (keyof State)[]) {
        const { path, codec, default: fallback } = descriptors[key]
        const category = categories.get(path[0])
        if (!category) continue
        const raw = fieldOf(category, path[1])
        const value = raw === undefined ? fallback : codec.read(raw)
        if (value !== undefined) result[key] = value as State[keyof State]
    }
    return result
}

/** Returns the encoded field of one setting, empty for its default. */
export const writeSetting = <T>(descriptor: SettingDescriptor<T>, value: T) =>
    descriptor.codec.write(descriptor.path[1], value)

export interface GuildFolder {
    /** Absent for a guild that sits in the list on its own. */
    id?: string
    name?: string
    /** RGB integer. */
    color?: number
    guildIds: string[]
}

/**
 * Reads `guild_folders` (field 14):
 *   GuildFolders { repeated GuildFolder folders = 1; }
 *   GuildFolder { repeated fixed64 guild_ids = 1; Int64Value id = 2; StringValue name = 3; UInt64Value color = 4; }
 * Returns undefined when the message does not carry the field (partial updates).
 */
export function parseFolders(
    categories: ReadonlyMap<number, Uint8Array>,
): GuildFolder[] | undefined {
    const container = categories.get(GUILD_FOLDERS)
    if (!container) return undefined
    const folders: GuildFolder[] = []
    for (const [number, value] of readFields(container)) {
        if (number !== 1 || !(value instanceof Uint8Array)) continue
        const folder: GuildFolder = { guildIds: [] }
        for (const [key, raw] of readFields(value)) {
            if (!(raw instanceof Uint8Array)) continue
            if (key === 1) folder.guildIds.push(...readFixed64s(raw))
            // Fields 2 to 4 are wrapper messages holding the value in their field 1.
            const inner = key > 1 ? fieldOf(raw, 1) : undefined
            if (key === 2 && typeof inner === 'bigint')
                folder.id = String(inner)
            if (key === 3 && inner instanceof Uint8Array)
                folder.name = strFromU8(inner)
            if (key === 4 && typeof inner === 'bigint')
                folder.color = Number(inner)
        }
        folders.push(folder)
    }
    return folders
}

/** Encodes a PreloadedUserSettings message holding only `guild_folders`, the way the reference's `saveGuildFolders` does. */
export function encodeFolders(folders: GuildFolder[]): Uint8Array {
    const messages = folders.map(folder => {
        const parts = [writeBytesField(1, writeFixed64s(folder.guildIds))]
        if (folder.id !== undefined)
            parts.push(
                writeBytesField(2, writeVarintField(1, BigInt(folder.id))),
            )
        if (folder.name)
            parts.push(
                writeBytesField(3, writeBytesField(1, strToU8(folder.name))),
            )
        if (folder.color != null)
            parts.push(
                writeBytesField(4, writeVarintField(1, BigInt(folder.color))),
            )
        return writeBytesField(1, concatBytes(parts))
    })
    return writeBytesField(GUILD_FOLDERS, concatBytes(messages))
}

/** Splits a base64 PreloadedUserSettings message into its categories, by field number. */
export function readCategories(proto: string): Map<number, Uint8Array> {
    const categories = new Map<number, Uint8Array>()
    for (const [number, value] of readFields(base64ToBytes(proto)))
        if (value instanceof Uint8Array) categories.set(number, value)
    return categories
}
