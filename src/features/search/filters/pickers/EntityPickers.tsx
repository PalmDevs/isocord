import { useSession, useSessionStore } from '../../../../core/react'
import { Avatar } from '../../../../design/components/avatars/Avatar'
import { TableRowIcon } from '../../../../design/components/table/TableRow'
import { Icon } from '../../../../design/icons/Icon'
import { channelsStore } from '../../../../stores/channels/channels'
import { guildsStore } from '../../../../stores/guilds'
import { usersStore } from '../../../../stores/users'
import { useSteadyRows } from '../../../chat/composer/suggestions/useSteadyRows'
import { channelIcon } from '../../../servers/channelIcon'
import { useGuildChannelResults } from '../../channels/useGuildChannelResults'
import { usePrivateChannelEntries } from '../../global/dms'
import { FILTERS, SELF_USER, SNOWFLAKE } from '../catalog'
import { resolveFilter } from '../resolve'
import { PickerList } from './PickerList'
import { useUserCandidates } from './useUserCandidates'
import type { PickerProps } from './FilterPicker'
import type { PickerRow } from './PickerList'

const AVATAR_SIZE = 32
/** Rows of the user list on screen before scrolling, the slots new rows may fill without moving the others. */
const USER_VISIBLE_ROWS = 6

/** A row for a pasted id, known or not, or a user filter's `@me`: picks it as it is. */
function useIdRows({ kind, context, query, onPick }: PickerProps): PickerRow[] {
    const session = useSession()
    const isSelf =
        FILTERS[kind].input === 'user' && query.toLowerCase() === SELF_USER
    if (!SNOWFLAKE.test(query) && !isSelf) return []
    const filter = resolveFilter(session, context, kind, query)
    if (!filter) return []
    return [
        {
            key: `id:${query}`,
            label: filter.label,
            subLabel: query,
            icon: <TableRowIcon name={FILTERS[kind].icon} />,
            onPress: () => onPick(filter),
        },
    ]
}

/** getUserAutocompletions: the people of the context matching the text. */
export function UserPicker({
    kind,
    context,
    query,
    onPick,
    submitRef,
}: PickerProps) {
    const candidates = useUserCandidates(context, query)
    const users = useSessionStore(usersStore, state => state.users)
    const rows = candidates.map((candidate): PickerRow => {
        const user = users[candidate.id]
        return {
            key: candidate.id,
            label: candidate.name,
            subLabel: candidate.username,
            icon: user ? <Avatar user={user} size={AVATAR_SIZE} /> : undefined,
            onPress: () =>
                onPick({ kind, value: candidate.id, label: candidate.name }),
        }
    })
    const idRows = useIdRows({ kind, context, query, onPick, submitRef })
    // Members arriving from the gateway for the same text join the list without moving the rows on screen.
    const shown = useSteadyRows([...idRows, ...rows], query, USER_VISIBLE_ROWS)
    return <PickerList rows={shown ?? []} submitRef={submitRef} />
}

/**
 * isValidChannelAutocomplete: a guild's text and voice channels matching the text (the Channels tab's search), or
 * in the DMs search the DMs and group DMs.
 */
export function ChannelPicker({
    kind,
    context,
    query,
    onPick,
    submitRef,
}: PickerProps) {
    const guildId =
        context.type === 'GUILD_CHANNEL' ? context.guildId : undefined
    const results = useGuildChannelResults(guildId, query)
    const channels = useSessionStore(channelsStore, state => state.channels)
    const entries = usePrivateChannelEntries()
    const needle = query.toLowerCase()

    const rows: PickerRow[] = guildId
        ? [...results.text.map(item => item.id), ...results.voice].flatMap(
              id => {
                  const channel = channels[id]
                  if (!channel?.name) return []
                  const name = channel.name
                  return [
                      {
                          key: id,
                          label: name,
                          icon: (
                              <TableRowIcon name={channelIcon(channel.type)} />
                          ),
                          onPress: () =>
                              onPick({ kind, value: id, label: name }),
                      },
                  ]
              },
          )
        : entries
              .filter(
                  entry =>
                      entry.name.toLowerCase().includes(needle) ||
                      entry.haystack.some(name => name.includes(needle)),
              )
              .map(entry => ({
                  key: entry.channel.id,
                  label: entry.name,
                  icon: entry.recipient ? (
                      <Avatar user={entry.recipient} size={AVATAR_SIZE} />
                  ) : (
                      <TableRowIcon name="GroupIcon" />
                  ),
                  onPress: () =>
                      onPick({
                          kind,
                          value: entry.channel.id,
                          label: entry.name,
                      }),
              }))
    const idRows = useIdRows({ kind, context, query, onPick, submitRef })
    return <PickerList rows={[...idRows, ...rows]} submitRef={submitRef} />
}

/** The guild's roles matching the text, highest first. @everyone has the mentionsEveryone filter instead. */
export function RolePicker({
    kind,
    context,
    query,
    onPick,
    submitRef,
}: PickerProps) {
    const guildId = context.type === 'GUILD_CHANNEL' ? context.guildId : ''
    const roles = useSessionStore(
        guildsStore,
        state => state.guilds[guildId]?.roles,
    )
    const needle = query.toLowerCase()
    const rows = Object.values(roles ?? {})
        .filter(
            role =>
                role.id !== guildId &&
                role.name !== undefined &&
                role.name.toLowerCase().includes(needle),
        )
        .sort((a, b) => (b.position ?? 0) - (a.position ?? 0))
        .map((role): PickerRow => {
            const name = role.name ?? ''
            return {
                key: role.id,
                label: `@${name}`,
                icon: (
                    <Icon
                        name="ShieldUserIcon"
                        color="INTERACTIVE_TEXT_DEFAULT"
                    />
                ),
                onPress: () =>
                    onPick({ kind, value: role.id, label: `@${name}` }),
            }
        })
    const idRows = useIdRows({ kind, context, query, onPick, submitRef })
    return <PickerList rows={[...idRows, ...rows]} submitRef={submitRef} />
}
