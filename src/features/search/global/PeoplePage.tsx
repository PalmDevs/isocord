import { FlashList } from '@shopify/flash-list'
import { useMemo } from 'react'
import { t } from '../../../i18n'
import { usePrivateChannelEntries } from './dms'
import { DmRow, SectionHeader } from './rows'
import { useOpenDm } from './useOpenDm'
import type { SearchTabPageProps } from '../types'

type Row =
    | { key: string; kind: 'section'; title: string }
    | { key: string; kind: 'dm'; channelId: string }

/** NewMessageUserList.matchGroupDM and UserSearch scoring: a prefix match beats a match inside a name. */
function score(haystack: string[], query: string): number {
    let best = 0
    for (const name of haystack) {
        if (name.startsWith(query)) return 2
        if (name.includes(query)) best = 1
    }
    return best
}

/**
 * PeopleScreen: the group DMs matching the query, then the people. Without a query, the people are the ones
 * you message most recently. Isocord has no friends list or guild member search yet, so people are the
 * recipients of the open DMs.
 */
export function PeoplePage({ query, onDismiss }: SearchTabPageProps) {
    const entries = usePrivateChannelEntries()
    const openDm = useOpenDm(onDismiss)

    const rows = useMemo(() => {
        const needle = query.toLowerCase()
        const matching = needle
            ? entries
                  .map((entry, index) => ({
                      entry,
                      index,
                      score: score(entry.haystack, needle),
                  }))
                  .filter(match => match.score > 0)
                  // Higher score first, recency (the order of entries) breaks ties, as in the reference.
                  .sort((a, b) => b.score - a.score || a.index - b.index)
                  .map(match => match.entry)
            : entries
        const groups = needle ? matching.filter(entry => entry.isGroup) : []
        const people = matching.filter(entry => !entry.isGroup)
        const result: Row[] = []
        if (groups.length > 0) {
            result.push({
                key: 'g',
                kind: 'section',
                title: t('search.groupDms'),
            })
            for (const entry of groups)
                result.push({
                    key: entry.channel.id,
                    kind: 'dm',
                    channelId: entry.channel.id,
                })
        }
        if (people.length > 0) {
            result.push({
                key: 'p',
                kind: 'section',
                title: t('search.suggested'),
            })
            for (const entry of people)
                result.push({
                    key: entry.channel.id,
                    kind: 'dm',
                    channelId: entry.channel.id,
                })
        }
        return result
    }, [entries, query])

    return (
        <FlashList
            data={rows}
            keyExtractor={row => row.key}
            keyboardShouldPersistTaps="handled"
            getItemType={row => row.kind}
            renderItem={({ item: row }) =>
                row.kind === 'section' ? (
                    <SectionHeader title={row.title} />
                ) : (
                    <DmRow channelId={row.channelId} onPress={openDm} />
                )
            }
        />
    )
}
