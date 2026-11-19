import { Endpoint } from '../../core/api/paths'
import { logger } from '../../core/log'
import {
    guildOnboardingStore,
    parseOnboarding,
} from '../../stores/guildOnboarding'
import { guildsStore } from '../../stores/guilds'
import { setChannelOptInLocally } from '../../stores/settings/settingsActions'
import { settingsStore } from '../../stores/settings/settingsStore'
import { hasNotSetUpChannelOptIn } from './actions'
import type { Session } from '../../core/session'
import type {
    OnboardingOption,
    OnboardingPrompt,
    RawOnboarding,
} from '../../stores/guildOnboarding'
import type { Guild } from '../../stores/guilds'

const log = logger('GuildOnboarding')

/** shouldFetchPrompts: prompts fetched within the hour are kept. */
const REFETCH_AFTER_MS = 60 * 60 * 1000

/** updateOnboardingResponses' debounce: answers given together are saved together. */
const SAVE_DELAY_MS = 1000

/** The save waiting to run, by guild. */
const saveTimers = new WeakMap<
    Session,
    Map<string, ReturnType<typeof setTimeout>>
>()

/** The guilds whose onboarding is being fetched (GuildOnboardingPromptsStore.isLoading). */
const fetching = new WeakMap<Session, Set<string>>()

/** Returns whether answers wait to be saved, so a server copy must not replace them. */
const savePending = (session: Session, guildId: string) =>
    saveTimers.get(session)?.has(guildId) ?? false

/** fetchOnboardingPrompts, when shouldFetchPrompts. Answers not saved yet are kept. */
export function fetchOnboarding(session: Session, guildId: string): void {
    const current = session.get(guildOnboardingStore).getState().byGuild[
        guildId
    ]
    if (current && Date.now() - current.fetchedAt < REFETCH_AFTER_MS) return
    let inFlight = fetching.get(session)
    if (!inFlight) fetching.set(session, (inFlight = new Set()))
    if (inFlight.has(guildId)) return
    inFlight.add(guildId)
    session.rest
        .get<RawOnboarding>(Endpoint.guildOnboarding(guildId))
        .then(raw =>
            session.get(guildOnboardingStore).setState(state => {
                const fetched = parseOnboarding(raw)
                const held = state.byGuild[guildId]
                if (held && savePending(session, guildId))
                    fetched.responses = held.responses
                return { byGuild: { ...state.byGuild, [guildId]: fetched } }
            }),
        )
        .catch(error => log.warn('Could not fetch the onboarding', error))
        .finally(() => inFlight.delete(guildId))
}

const difference = (a: readonly string[], b: readonly string[]) =>
    a.filter(id => !b.includes(id))

/** The ids an answer adds and removes, for getRoles and getChannels. */
function changes(
    prompt: OnboardingPrompt,
    option: OnboardingOption,
    selected: boolean,
    responses: readonly string[],
    idsOf: (option: OnboardingOption) => string[],
): { added: string[]; removed: string[] } {
    const picked = prompt.options.filter(other => responses.includes(other.id))
    if (prompt.singleSelect && selected) {
        const previous = picked[0] ? idsOf(picked[0]) : []
        return {
            added: difference(idsOf(option), previous),
            removed: difference(previous, idsOf(option)),
        }
    }
    if (selected) return { added: idsOf(option), removed: [] }
    // What the other picked answers still give stays.
    const kept = picked.filter(other => other.id !== option.id).flatMap(idsOf)
    return { added: [], removed: difference(idsOf(option), kept) }
}

/**
 * useBatchUpdateSelectOption.handleSelectOption: picks or drops an answer. Its channels and roles change at once,
 * locally. The server applies them when the answers are saved.
 */
export function selectOption(
    session: Session,
    guild: Guild,
    prompt: OnboardingPrompt,
    option: OnboardingOption,
    selected: boolean,
): void {
    const store = session.get(guildOnboardingStore)
    const onboarding = store.getState().byGuild[guild.id]
    if (!onboarding) return
    const { responses } = onboarding
    const roles = changes(prompt, option, selected, responses, o => o.roleIds)
    const channels = changes(
        prompt,
        option,
        selected,
        responses,
        o => o.channelIds,
    )
    // getChannels: a user who never picked channels keeps the server's defaults too.
    if (hasNotSetUpChannelOptIn(session.get(settingsStore).getState(), guild))
        channels.added.push(...onboarding.defaultChannelIds)

    // GuildOnboardingActionCreators.selectOption: a single-select prompt keeps one answer.
    const dropped = prompt.singleSelect
        ? prompt.options.map(other => other.id)
        : [option.id]
    store.setState(state => ({
        byGuild: {
            ...state.byGuild,
            [guild.id]: {
                ...onboarding,
                responses: [
                    ...responses.filter(id => !dropped.includes(id)),
                    ...(selected ? [option.id] : []),
                ],
            },
        },
    }))
    setChannelOptInLocally(session, guild.id, channels.added, true)
    setChannelOptInLocally(session, guild.id, channels.removed, false)
    // updateRolesLocal.
    if (roles.added.length || roles.removed.length)
        session.get(guildsStore).setState(state => {
            const current = state.guilds[guild.id]
            if (!current) return state
            const myRoles = difference(
                [...new Set([...current.myRoles, ...roles.added])],
                roles.removed,
            )
            return {
                guilds: {
                    ...state.guilds,
                    [guild.id]: { ...current, myRoles },
                },
            }
        })
    scheduleSave(session, guild.id)
}

function scheduleSave(session: Session, guildId: string): void {
    let timers = saveTimers.get(session)
    if (!timers) saveTimers.set(session, (timers = new Map()))
    clearTimeout(timers.get(guildId))
    timers.set(
        guildId,
        setTimeout(() => {
            timers.delete(guildId)
            saveResponses(session, guildId)
        }, SAVE_DELAY_MS),
    )
}

/** _updateOnboardingResponses: `PUT /guilds/{id}/onboarding-responses`, marking every prompt and answer seen. */
function saveResponses(session: Session, guildId: string): void {
    const onboarding = session.get(guildOnboardingStore).getState().byGuild[
        guildId
    ]
    if (!onboarding) return
    const now = Date.now()
    const promptsSeen: Record<string, number> = {}
    const responsesSeen: Record<string, number> = {}
    const responses: string[] = []
    for (const prompt of onboarding.prompts) {
        promptsSeen[prompt.id] = now
        for (const option of prompt.options) {
            responsesSeen[option.id] = now
            if (onboarding.responses.includes(option.id))
                responses.push(option.id)
        }
    }
    session.rest
        .put<{ onboarding_responses?: string[] }>(
            Endpoint.guildOnboardingResponses(guildId),
            {
                body: {
                    onboarding_responses: responses,
                    onboarding_prompts_seen: promptsSeen,
                    onboarding_responses_seen: responsesSeen,
                },
            },
        )
        .then(body => {
            const saved = body?.onboarding_responses
            // GUILD_ONBOARDING_UPDATE_RESPONSES_SUCCESS. Picks made since then wait for their own save.
            if (!saved || savePending(session, guildId)) return
            session.get(guildOnboardingStore).setState(state => {
                const current = state.byGuild[guildId]
                if (!current) return state
                return {
                    byGuild: {
                        ...state.byGuild,
                        [guildId]: { ...current, responses: saved },
                    },
                }
            })
        })
        .catch(error => log.warn('Could not save the answers', error))
}
