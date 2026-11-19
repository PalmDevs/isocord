import { createStore } from 'zustand/vanilla'
import { defineStore } from '../core/session'

// GuildOnboardingPromptsStore: a server's onboarding questions and the user's answers, from
// `GET /guilds/{id}/onboarding`. Fetched when Channels & Roles opens, not cached.

/** OnboardingPromptType. */
export const OnboardingPromptType = {
    MULTIPLE_CHOICE: 0,
    DROPDOWN: 1,
} as const

interface RawOption {
    id: string
    channel_ids?: string[] | null
    role_ids?: string[] | null
    emoji?: { id?: string | null; name?: string | null; animated?: boolean }
    title: string
    description?: string | null
}

interface RawPrompt {
    id: string
    title: string
    options: RawOption[]
    single_select: boolean
    required: boolean
    in_onboarding: boolean
    type: number
}

/** What `GET /guilds/{id}/onboarding` returns, as far as it is read. */
export interface RawOnboarding {
    prompts: RawPrompt[]
    default_channel_ids: string[]
    enabled: boolean
    responses?: string[] | null
}

export interface OnboardingOption {
    id: string
    channelIds: string[]
    roleIds: string[]
    emoji?: { id?: string | null; name?: string | null; animated?: boolean }
    title: string
    description: string
}

export interface OnboardingPrompt {
    id: string
    title: string
    options: OnboardingOption[]
    singleSelect: boolean
    required: boolean
    inOnboarding: boolean
    type: number
}

export interface GuildOnboarding {
    enabled: boolean
    prompts: OnboardingPrompt[]
    defaultChannelIds: string[]
    /** The ids of the options the user picked. */
    responses: string[]
    fetchedAt: number
}

interface GuildOnboardingState {
    byGuild: Record<string, GuildOnboarding>
}

/** serverApiResponseToClientState. */
export function parseOnboarding(raw: RawOnboarding): GuildOnboarding {
    return {
        enabled: raw.enabled,
        prompts: raw.prompts.map(prompt => ({
            id: prompt.id,
            title: prompt.title,
            options: prompt.options.map(option => ({
                id: option.id,
                channelIds: option.channel_ids ?? [],
                roleIds: option.role_ids ?? [],
                emoji: option.emoji,
                title: option.title,
                description: option.description ?? '',
            })),
            singleSelect: prompt.single_select,
            required: prompt.required,
            inOnboarding: prompt.in_onboarding,
            type: prompt.type,
        })),
        defaultChannelIds: raw.default_channel_ids,
        responses: raw.responses ?? [],
        fetchedAt: Date.now(),
    }
}

/** getEnabledOnboardingPrompts, in useSortedOnboardingPrompts' order: the prompts outside onboarding first. */
export function enabledPrompts(
    onboarding: GuildOnboarding | undefined,
): OnboardingPrompt[] {
    if (!onboarding?.enabled) return []
    return [
        ...onboarding.prompts.filter(prompt => !prompt.inOnboarding),
        ...onboarding.prompts.filter(prompt => prompt.inOnboarding),
    ]
}

export const guildOnboardingStore = defineStore('guildOnboarding', () =>
    createStore<GuildOnboardingState>(() => ({ byGuild: {} })),
)
