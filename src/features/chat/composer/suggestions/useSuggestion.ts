import { useEffect, useMemo } from 'react'
import { useSession, useSessionStore } from '../../../../core/react'
import { channelsStore } from '../../../../stores/channels/channels'
import { guildsStore } from '../../../../stores/guilds'
import {
    membersStore,
    requestAutocompleteMembers,
} from '../../../../stores/members'
import { messagesStore } from '../../../../stores/messages/messages'
import { settingsStore } from '../../../../stores/settings/settingsStore'
import { usersStore } from '../../../../stores/users'
import { useComposer, useComposerState } from '../state/useComposer'
import { findSuggestion, MAX_RESULTS, MENTION } from './search'
import type { Suggestion } from './search'

/** Returns the suggestion for the text before the cursor: mentions, channels or emojis, or null. */
export function useSuggestion(): Suggestion | null {
    const session = useSession()
    const { channelId } = useComposer()
    const text = useComposerState(state => state.text)
    const cursor = useComposerState(state =>
        state.selection.start === state.selection.end
            ? state.selection.start
            : -1,
    )
    const enabled = useSessionStore(
        settingsStore,
        state => state.textAndImages.expressionSuggestionsEnabled !== false,
    )
    const channel = useSessionStore(
        channelsStore,
        state => state.channels[channelId],
    )
    const channels = useSessionStore(channelsStore, state => state.channels)
    const byGuild = useSessionStore(channelsStore, state => state.byGuild)
    const guild = useSessionStore(guildsStore, state =>
        channel?.guild_id ? state.guilds[channel.guild_id] : undefined,
    )
    const members = useSessionStore(membersStore, state =>
        channel?.guild_id ? state.members[channel.guild_id] : undefined,
    )
    const users = useSessionStore(usersStore, state => state.users)
    const messages = useSessionStore(
        messagesStore,
        state => state.channels[channelId]?.messages,
    )

    // The `@` query typed in a server: queryChannelUsers asks the gateway for the members it matches, and they
    // arrive in the members store read below. With nothing typed, the channel's recent authors are shown instead;
    // the gateway is only asked when there are none.
    const mentionQuery =
        cursor >= 0
            ? MENTION.exec(text.slice(0, cursor))?.[1]?.toLocaleLowerCase()
            : undefined
    const guildId = channel?.guild_id
    const hasRecentAuthors = !!messages?.some(
        message => members?.[message.author.id],
    )
    useEffect(() => {
        if (!guildId || mentionQuery === undefined) return
        if (mentionQuery === '' && hasRecentAuthors) return
        requestAutocompleteMembers(session, guildId, mentionQuery, MAX_RESULTS)
    }, [session, guildId, mentionQuery, hasRecentAuthors])

    // Memoised: scans the text and every candidate list on each keystroke.
    return useMemo(() => {
        if (cursor < 0 || !channel) return null
        const scope = {
            session,
            channelId,
            channel,
            channels,
            byGuild,
            guild,
            members,
            users,
            messages,
        }
        return findSuggestion(scope, text, cursor, enabled)
    }, [
        text,
        cursor,
        enabled,
        channel,
        channels,
        byGuild,
        guild,
        members,
        users,
        messages,
        channelId,
        session,
    ])
}
