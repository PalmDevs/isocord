/** Voice gateway close codes the client acts on (docs.discord.food, voice close event codes). */
export const VoiceCloseCode = {
    AUTHENTICATION_FAILED: 4004,
    SESSION_NO_LONGER_VALID: 4006,
    SESSION_TIMEOUT: 4009,
    SERVER_NOT_FOUND: 4011,
    VOICE_SERVER_CRASHED: 4015,
} as const
