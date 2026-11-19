import { useCallback, useEffect, useRef, useState } from 'react'
import { BackHandler } from 'react-native'
import { useSession } from '../../../core/react'
import { FILTERS } from './catalog'
import { filterKeys, findTokens, withoutTokens } from './parse'
import { resolveFilter } from './resolve'
import type { SearchContext } from '../types'
import type { FilterKind, SearchFilter } from './catalog'
import type { FilterToken } from './parse'
import type { ResolvedFilter } from './resolve'

let nextFilterId = 0

const withId = (filter: ResolvedFilter): SearchFilter => ({
    ...filter,
    id: `f${++nextFilterId}`,
})

/** Adds a filter to a list: once, and in place of the one of a single-value kind. */
function addFilter(
    list: SearchFilter[],
    filter: ResolvedFilter,
): SearchFilter[] {
    const same = list.some(
        item =>
            item.kind === filter.kind &&
            item.value === filter.value &&
            Boolean(item.negated) === Boolean(filter.negated),
    )
    if (same) return list
    const kept = FILTERS[filter.kind].single
        ? list.filter(item => item.kind !== filter.kind)
        : list
    return [...kept, withId(filter)]
}

/** Puts a filter in the place of the one with `id`. Drops that one when the new filter is already in the list. */
function replaceFilter(
    list: SearchFilter[],
    id: string,
    filter: ResolvedFilter,
): SearchFilter[] {
    const rest = list.filter(item => item.id !== id)
    const added = addFilter(rest, filter)
    if (added === rest) return rest
    const index = list.findIndex(item => item.id === id)
    const replaced = added[added.length - 1] as SearchFilter
    const kept = added.slice(0, -1)
    return [...kept.slice(0, index), replaced, ...kept.slice(index)]
}

/** The text a filter's picker opens with to edit it: the date picker reads `YYYY-MM-DD`, the others their label. */
const editText = (filter: SearchFilter) =>
    FILTERS[filter.kind].input === 'date' ? filter.value : filter.label

/**
 * The state of a search bar with filters: the text, the filters, and the filter whose picker is open.
 * While a picker is open the text is the picker's own search. The query's text is kept aside and comes back
 * when the picker closes (the reference's saveDraftTextInputValue).
 * Back closes an open picker first. A `scope` is a removable tag the search starts with.
 */
export function useSearchInput(context: SearchContext, scope?: ResolvedFilter) {
    const session = useSession()
    // The scope tag comes back with every reset.
    const [initial] = useState<SearchFilter[]>(() =>
        scope ? [withId({ ...scope, implicit: true })] : [],
    )
    const [text, setText] = useState('')
    const [filters, setFilters] = useState(initial)
    const [picking, setPicking] = useState<FilterKind | null>(null)
    /** The id of the filter the open picker replaces, or null when it adds one. */
    const [editing, setEditing] = useState<string | null>(null)
    const [draft, setDraft] = useState('')
    /** Enter while a picker is open: set by the picker (adds the typed value, or the first match). */
    const pickerSubmit = useRef<(() => void) | null>(null)

    // Keeps its identity: the host's back handler depends on it, and must stay registered before the picker's.
    const reset = useCallback(() => {
        setDraft('')
        setText('')
        setFilters(initial)
        setPicking(null)
        setEditing(null)
    }, [initial])

    const closePicker = () => {
        setPicking(null)
        setEditing(null)
        setText(draft)
    }

    const openPicker = (kind: FilterKind, rest: string, query = '') => {
        if (picking === null) setDraft(rest)
        setPicking(kind)
        setEditing(null)
        setText(query)
    }

    useEffect(() => {
        if (picking === null) return
        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                setPicking(null)
                setEditing(null)
                setText(draft)
                return true
            },
        )
        return () => subscription.remove()
    }, [picking, draft])

    /**
     * Turns the `key:value` tokens of the text into tags (getSearchQueryFromTokens). `all` converts every token
     * (a paste, Enter); otherwise only a `key:` just typed, which opens its picker. A value that names nothing
     * known opens its filter's picker searching for it. Returns the text left.
     */
    const convert = (next: string, all: boolean): string => {
        const tokens = findTokens(next, filterKeys(context)).filter(
            token => all || (token.value === '' && token.end === next.length),
        )
        const done: FilterToken[] = []
        const added: ResolvedFilter[] = []
        let open: { kind: FilterKind; query: string } | null = null
        for (const token of tokens) {
            const { kind, value } = token
            const toggle = FILTERS[kind].input === 'toggle'
            const filter =
                value === ''
                    ? toggle
                        ? { kind, value: '', label: '' }
                        : null
                    : resolveFilter(session, context, kind, value)
            if (filter) {
                added.push(filter)
                done.push(token)
            } else if (!open && !toggle) {
                open = { kind, query: value }
                done.push(token)
            }
        }
        const rest = withoutTokens(next, done)
        if (added.length > 0) setFilters(list => added.reduce(addFilter, list))
        if (open) openPicker(open.kind, rest, open.query)
        else setText(rest)
        return rest
    }

    return {
        text,
        filters,
        picking,
        editing,
        pickerSubmit,
        /** The query's text, also while a picker holds the field. */
        queryText: picking === null ? text : draft,

        /** Sets the text as typed: filter tokens become tags. */
        changeText(next: string) {
            if (picking !== null) return setText(next)
            convert(next, next.length > text.length + 1)
        },
        /** Puts text in the bar as it is (a tapped recent search). */
        setText,
        /** Enter on the query: converts what is left of the tokens. Returns the text searched for. */
        submitText: () => convert(text, true),

        /** Opens the picker of `kind`, or closes it when it is the open one. */
        openPicker(kind: FilterKind) {
            if (picking === kind) return closePicker()
            openPicker(kind, text)
        },
        /** A suggested filter for the word being typed: `rest` is the text without that word. */
        pickSuggestion(kind: FilterKind, rest: string) {
            if (FILTERS[kind].input !== 'toggle') return openPicker(kind, rest)
            setFilters(list => addFilter(list, { kind, value: '', label: '' }))
            setText(rest)
        },
        closePicker,

        /** Opens the picker of a tapped tag's filter with its value. The pick replaces it. A toggle has none. */
        edit(id: string) {
            const filter = filters.find(item => item.id === id)
            if (!filter || FILTERS[filter.kind].input === 'toggle') return
            openPicker(filter.kind, text, editText(filter))
            setEditing(id)
        },

        /** Adds a filter, or replaces the one being edited, and closes the picker. A single-value kind keeps one. */
        add(filter: ResolvedFilter) {
            setFilters(list =>
                editing === null
                    ? addFilter(list, filter)
                    : replaceFilter(list, editing, filter),
            )
            closePicker()
        },

        /** Adds a toggle filter, or removes it when it is on. */
        toggle(kind: FilterKind) {
            setFilters(list =>
                list.some(item => item.kind === kind)
                    ? list.filter(item => item.kind !== kind)
                    : addFilter(list, { kind, value: '', label: '' }),
            )
        },

        remove(id: string) {
            setFilters(list => list.filter(item => item.id !== id))
        },

        /** Empties the bar: leaving search forgets its query, as SearchQueryStore does. */
        reset,
    }
}

export type SearchInput = ReturnType<typeof useSearchInput>
