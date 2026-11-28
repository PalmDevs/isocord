import { StreamQuality } from '../../../core/discord/streams'
import { guildsStore } from '../../../stores/guilds'
import { usersStore } from '../../../stores/users'
import { PremiumType } from '../../expressions/data/availability'
import { voiceConstants } from '../settings/voiceSettings'
import type { Session } from '../../../core/session'
import type { StreamTables } from '../../../native/voiceTypes'

/** One resolution and frame rate of a preset. */
export interface StreamSetting {
    resolution: number
    fps: number
}

type Requirement = StreamTables['requirements'][number]

/** Kotlin's Go Live tables, parsed once: they never change in a process. */
let tables: StreamTables | null = null
const streamTables = (): StreamTables => {
    tables ??= JSON.parse(voiceConstants().streamPresets) as StreamTables
    return tables
}

/**
 * PremiumUtils.canStreamQuality. The reference asks the premium SKUs. This is their documented Nitro tiers:
 * Nitro for source quality, Nitro or Nitro Classic for 1080p and 60 fps.
 */
function canStreamQuality(quality: string, premiumType: number): boolean {
    if (quality === StreamQuality.HIGH) return premiumType === PremiumType.NITRO
    if (quality === StreamQuality.MID)
        return (
            premiumType === PremiumType.NITRO ||
            premiumType === PremiumType.NITRO_CLASSIC
        )
    return false
}

/** canUseStreamSetting: Nitro, or the server's boost level where a row allows one. */
function canUseStreamSetting(
    requirement: Requirement,
    premiumType: number,
    guildPremiumTier: number,
): boolean {
    const premium =
        requirement.quality != null &&
        canStreamQuality(requirement.quality, premiumType)
    if (requirement.guildPremiumTier != null)
        return premium || guildPremiumTier >= requirement.guildPremiumTier
    return requirement.quality == null || premium
}

/** canStreamWithSettings: a row for the setting that the user meets. Preset-only rows don't count. */
function canStreamWithSettings(
    setting: StreamSetting,
    premiumType: number,
    guildPremiumTier: number,
): boolean {
    return streamTables().requirements.some(
        requirement =>
            requirement.preset == null &&
            requirement.resolution === setting.resolution &&
            requirement.fps === setting.fps &&
            canUseStreamSetting(requirement, premiumType, guildPremiumTier),
    )
}

/** getStreamSettingsForPreset: the preset's best setting the user may stream, or null. */
export function streamSettingForPreset(
    preset: number,
    premiumType: number,
    guildPremiumTier: number,
): StreamSetting | null {
    const settings = streamTables().presets[String(preset)] ?? []
    return (
        settings.find(setting =>
            canStreamWithSettings(setting, premiumType, guildPremiumTier),
        ) ?? null
    )
}

/** getMaxSettingsForPreset: the preset's best setting, allowed or not. */
export const maxSettingForPreset = (preset: number): StreamSetting | null =>
    streamTables().presets[String(preset)]?.[0] ?? null

/** Our premium type and the guild's boost level, which unlock Go Live qualities. */
export function streamEntitlements(
    session: Session,
    guildId: string | null,
): { premiumType: number; guildPremiumTier: number } {
    const premiumType =
        session.get(usersStore).getState().users[session.userId]
            ?.premium_type ?? PremiumType.NONE
    const guild = guildId
        ? session.get(guildsStore).getState().guilds[guildId]
        : undefined
    return { premiumType, guildPremiumTier: guild?.premiumTier ?? 0 }
}
