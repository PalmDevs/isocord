import { useEffect, useState } from 'react'
import { Endpoint } from '../../../../core/api/paths'
import { useSession } from '../../../../core/react'
import { TableRowIcon } from '../../../../design/components/table/TableRow'
import { PickerList } from './PickerList'
import type { SearchContext } from '../../types'
import type { PickerProps } from './FilterPicker'
import type { PickerRow } from './PickerList'

interface CommandIndex {
    applications?: Array<{ id: string; name: string }>
    application_commands?: Array<{
        id: string
        name: string
        application_id: string
    }>
}

/** The application command index of the context: the guild's, the DM's, or the user's own apps'. */
function indexPath(context: SearchContext): string {
    switch (context.type) {
        case 'GUILD_CHANNEL':
            return Endpoint.commandIndexGuild(context.guildId)
        case 'CHANNEL':
            return Endpoint.commandIndexChannel(context.channelId)
        case 'DMS':
            return Endpoint.commandIndexUser
    }
}

/** The commands of the context matching the text, from its application command index. */
export function CommandPicker({
    kind,
    context,
    query,
    onPick,
    submitRef,
}: PickerProps) {
    const session = useSession()
    const [index, setIndex] = useState<CommandIndex | null>(null)
    const path = indexPath(context)
    useEffect(() => {
        const abort = new AbortController()
        session.rest
            .get<CommandIndex>(path, { signal: abort.signal })
            .then(setIndex)
            // Lists nothing: the picker then says no results.
            .catch(() => {
                if (!abort.signal.aborted) setIndex({})
            })
        return () => abort.abort()
    }, [session, path])

    const apps = new Map(
        (index?.applications ?? []).map(app => [app.id, app.name]),
    )
    const needle = query.toLowerCase().replace(/^\//, '')
    const rows = (index?.application_commands ?? [])
        .filter(
            command =>
                command.id === query ||
                command.name.toLowerCase().includes(needle),
        )
        .map(
            (command): PickerRow => ({
                key: command.id,
                label: `/${command.name}`,
                subLabel: apps.get(command.application_id),
                icon: <TableRowIcon name="SlashBoxIcon" />,
                // The search API wants the bare name with the id.
                onPress: () =>
                    onPick({ kind, value: command.id, label: command.name }),
            }),
        )
    return (
        <PickerList
            rows={rows}
            submitRef={submitRef}
            loading={index === null}
        />
    )
}
