/** Constants GuildFeatures. */
export const GuildFeature = {
    COMMUNITY: 'COMMUNITY',
    HUB: 'HUB',
    DISCOVERABLE: 'DISCOVERABLE',
    VERIFIED: 'VERIFIED',
    PARTNERED: 'PARTNERED',
    ANIMATED_BANNER: 'ANIMATED_BANNER',
    GUILD_TAGS: 'GUILD_TAGS',
    GUILD_ONBOARDING_HAS_PROMPTS: 'GUILD_ONBOARDING_HAS_PROMPTS',
    FORWARDING_DISABLED: 'FORWARDING_DISABLED',
    NEWS: 'NEWS',
    MEMBER_VERIFICATION_MANUAL_APPROVAL: 'MEMBER_VERIFICATION_MANUAL_APPROVAL',
    MEMBER_VERIFICATION_GATE_ENABLED: 'MEMBER_VERIFICATION_GATE_ENABLED',
    /** Voice at the top boost tier's bitrate, whatever the tier. */
    VIP_REGIONS: 'VIP_REGIONS',
} as const

/** guild_member/GuildMemberConstants GuildMemberFlags. */
export const GuildMemberFlags = {
    COMPLETED_ONBOARDING: 2,
} as const

/** Constants MAX_NICKNAME_LENGTH: longest server nickname. */
export const MAX_NICKNAME_LENGTH = 32
