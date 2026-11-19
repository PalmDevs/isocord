import { create } from 'zustand'
import { SETTING_RENDERER_CONFIG } from './config'
import type { SettingContext, SettingKey } from './config'

/** UserSettingSearchStore: the query, and the result opened last, highlighted on its screen. */
export const useSettingSearchStore = create<{
    query: string
    selected: SettingKey | null
}>(() => ({ query: '', selected: null }))

const config = SETTING_RENDERER_CONFIG
const keys = Object.keys(config) as SettingKey[]

// SettingTreeManager.

/** Parent first, the top-level setting last. */
export function getAncestors(setting: SettingKey): SettingKey[] {
    const ancestors: SettingKey[] = []
    for (let parent = config[setting].parent; parent; ) {
        ancestors.push(parent)
        parent = config[parent].parent
    }
    return ancestors
}

export const getHighestLevelAncestor = (setting: SettingKey) =>
    getAncestors(setting).at(-1) ?? setting

/** The route row that opens the screen holding `setting`, or the setting itself if it is one. */
export function getNearestRouteAncestorOrSelf(setting: SettingKey): SettingKey {
    const route = [setting, ...getAncestors(setting)].find(
        key => config[key].type === 'route',
    )
    if (!route)
        throw new Error(`[SettingTree] No route ancestor for ${setting}`)
    return route
}

/** Titles of the ancestors, top-level first. */
export const getBreadcrumbs = (setting: SettingKey) =>
    getAncestors(setting)
        .reverse()
        .map(key => config[key].title())

/** SettingHookHarness's blocklist: a setting is hidden when its predicate, or an ancestor's, fails. */
export const isBlocked = (setting: SettingKey, context: SettingContext) =>
    [setting, ...getAncestors(setting)].some(
        key => config[key].predicate?.(context) === false,
    )

// StringMatchUtils.calculateJaroWinklerSimilarity.
function jaroWinkler(a: string, b: string): number {
    if (!a.length || !b.length) return 0
    const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1)
    const aMatched: boolean[] = []
    const bMatched: boolean[] = []
    let matches = 0
    for (let i = 0; i < a.length; i++) {
        const end = Math.min(b.length - 1, i + range)
        for (let j = Math.max(0, i - range); j <= end; j++) {
            if (bMatched[j] || a[i] !== b[j]) continue
            aMatched[i] = bMatched[j] = true
            matches++
            break
        }
    }
    if (!matches) return 0
    let transpositions = 0
    for (let i = 0, j = 0; i < a.length; i++) {
        if (!aMatched[i]) continue
        while (!bMatched[j]) j++
        if (a[i] !== b[j]) transpositions++
        j++
    }
    const jaro =
        (matches / a.length +
            matches / b.length +
            (matches - Math.floor(transpositions / 2)) / matches) /
        3
    if (jaro < 0.7) return jaro
    let prefix = 0
    while (prefix < 4 && a[prefix] === b[prefix]) prefix++
    return jaro + 0.1 * prefix * (1 - jaro)
}

/**
 * SettingSearchManager.getScoredSearchResults: 1 for a title or search term equal to the query, 0.95 for a
 * word of a several-word one starting with it, else the best Jaro-Winkler similarity of at least 0.8.
 */
function score(setting: SettingKey, query: string): number {
    const node = config[setting]
    const terms = [node.title(), ...(node.searchTerms?.() ?? [])].map(term =>
        term.toLocaleLowerCase(),
    )
    if (terms.includes(query)) return 1
    const tokens = terms.flatMap(term =>
        term.includes(' ') ? term.split(/\s+/) : [],
    )
    if (tokens.some(token => token.startsWith(query))) return 0.95
    return Math.max(
        0,
        ...terms.map(term => {
            const similarity = jaroWinkler(query, term)
            return similarity >= 0.8 ? similarity : 0
        }),
    )
}

/**
 * useSettingSearchResults with getScoredSettingListSearchResultItems: matches grouped under their
 * top-level setting, groups by their best score (a top-level setting matching itself gets 0.05 more),
 * the top-level setting first in its group, then by score. Blocked settings are left in: the
 * caller drops them with `isBlocked`, which can change while the results stay.
 */
export function searchSettings(query: string): SettingKey[] {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return []
    const groups = new Map<
        SettingKey,
        { setting: SettingKey; score: number }[]
    >()
    const best = new Map<SettingKey, number>()
    for (const setting of keys) {
        let value = score(setting, normalized)
        if (value <= 0) continue
        const top = getHighestLevelAncestor(setting)
        if (top === setting) value += 0.05
        best.set(top, Math.max(best.get(top) ?? 0, value))
        groups.set(top, [...(groups.get(top) ?? []), { setting, score: value }])
    }
    return [...best.entries()]
        .sort((a, b) => b[1] - a[1])
        .flatMap(([top]) =>
            (groups.get(top) ?? [])
                .sort((a, b) =>
                    a.setting === top
                        ? -1
                        : b.setting === top
                          ? 1
                          : b.score - a.score,
                )
                .map(result => result.setting),
        )
}

/** Index of the first result of its group, which shows the group's icon. */
export const isFirstOfGroup = (results: SettingKey[], index: number) =>
    index === 0 ||
    getHighestLevelAncestor(results[index]!) !==
        getHighestLevelAncestor(results[index - 1]!)
