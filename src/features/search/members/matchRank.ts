/** Lower is better: exact, prefix, word start, anywhere; -1 when it does not match (the autocompleter's order). */
export function matchRank(name: string, query: string): number {
    const lowered = name.toLowerCase()
    if (lowered === query) return 0
    if (lowered.startsWith(query)) return 1
    if (lowered.includes(` ${query}`)) return 2
    return lowered.includes(query) ? 3 : -1
}
