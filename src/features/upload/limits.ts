/** Most files one message can carry (Constants.MAX_UPLOAD_COUNT in the official client). */
export const MAX_UPLOAD_COUNT = 10
/** Most bytes all files of one message can add up to (UploadUtils.MAX_TOTAL_ATTACHMENT_SIZE). */
export const MAX_TOTAL_ATTACHMENT_SIZE = 500 * 1024 * 1024

const MIB = 1024 * 1024

/** `premium_type` on the user: none, Nitro Classic, Nitro, Nitro Basic. */
export type PremiumType = 0 | 1 | 2 | 3

/** What one file may weigh, by the user's Nitro. Everyone gets 10 MiB. */
export function userMaxFileSize(premiumType: number | null | undefined) {
    switch (premiumType) {
        case 1: // Nitro Classic
        case 3: // Nitro Basic
            return 50 * MIB
        case 2: // Nitro
            return 500 * MIB
        default:
            return 10 * MIB
    }
}

/** What one file may weigh in a guild, by its boost level, as guild features. */
export function guildMaxFileSize(features: readonly string[] | undefined) {
    if (features?.includes('MAX_FILE_SIZE_100_MB')) return 100 * MIB
    if (features?.includes('MAX_FILE_SIZE_50_MB')) return 50 * MIB
    return 0
}

/**
 * The size limit of one file, as FileUtils.maxFileSize works it out: the larger of the user's own
 * limit and what the guild's boosts give. Pass no `guildFeatures` in DMs.
 */
export function maxUploadSize(options: {
    premiumType?: number | null
    guildFeatures?: readonly string[]
}) {
    return Math.max(
        userMaxFileSize(options.premiumType),
        guildMaxFileSize(options.guildFeatures),
    )
}
