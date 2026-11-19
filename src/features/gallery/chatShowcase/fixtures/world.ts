import { ChannelType } from '../../../../core/discord/channelType'
import { Permission } from '../../../../core/discord/permissions'
import type { Channel } from '../../../../stores/channels/channels'
import type { Guild, Role } from '../../../../stores/guilds'
import type { Member } from '../../../../stores/members'
import type { User } from '../../../../stores/users'

/*
 * The fake server the showcase renders in. Every id is fixed, and none belongs to a real account. Add a user,
 * role or channel here when a sample needs one.
 */

/** Permissions of @everyone: view, send, read history, add reactions, use external emoji. */
const EVERYONE_PERMISSIONS = String(
    Permission.VIEW_CHANNEL |
        Permission.SEND_MESSAGES |
        Permission.READ_MESSAGE_HISTORY |
        Permission.ADD_REACTIONS |
        Permission.USE_EXTERNAL_EMOJIS,
)

export const GUILD_ID = '900000000000000001'
export const OTHER_GUILD_ID = '900000000000000002'

export const ChannelId = {
    GENERAL: '910000000000000001',
    ANNOUNCEMENTS: '910000000000000002',
    VOICE: '910000000000000003',
    STAGE: '910000000000000004',
    FORUM: '910000000000000005',
    THREAD: '910000000000000006',
    FORUM_POST: '910000000000000007',
    OTHER_GUILD_CHANNEL: '910000000000000008',
    GROUP_DM: '910000000000000009',
} as const

export const RoleId = {
    MODERATOR: '920000000000000001',
    DESIGNER: '920000000000000002',
    GRADIENT: '920000000000000003',
} as const

/** The signed in user of the showcase. Owns the server, so everything is allowed. */
export const ME_ID = '930000000000000001'

const user = (id: string, username: string, globalName: string | null) => ({
    id,
    username,
    global_name: globalName,
    avatar: null,
})

export const ME: User = user(ME_ID, 'you', 'You')
export const ALICE: User = user('930000000000000002', 'alice', 'Alice')
export const BOB: User = user('930000000000000003', 'bob', 'Bob')
export const CARA: User = user('930000000000000004', 'cara', 'Cara')
export const BOT: User = {
    ...user('930000000000000005', 'helper-bot', 'Helper Bot'),
    bot: true,
}
/** Wears a server tag and has no global name. */
export const DAN: User = {
    ...user('930000000000000006', 'dan', null),
    primary_guild: {
        identity_enabled: true,
        identity_guild_id: GUILD_ID,
        tag: 'ISO',
        badge: null,
    },
}

export const USERS: User[] = [ME, ALICE, BOB, CARA, BOT, DAN]

const role = (
    id: string,
    name: string,
    color: number,
    position: number,
): Role => ({
    id,
    name,
    color,
    position,
    permissions: '0',
    mentionable: true,
})

const ROLES: Role[] = [
    // @everyone has the guild's id.
    { id: GUILD_ID, name: '@everyone', permissions: EVERYONE_PERMISSIONS },
    role(RoleId.MODERATOR, 'Moderator', 0x2ecc71, 3),
    role(RoleId.DESIGNER, 'Designer', 0xe91e63, 2),
    {
        ...role(RoleId.GRADIENT, 'Gradient', 0x3498db, 1),
        colors: { primary_color: 0x3498db, secondary_color: 0x9b59b6 },
    },
]

export const GUILD: Guild = {
    id: GUILD_ID,
    name: 'Isocord Showcase',
    icon: null,
    banner: null,
    ownerId: ME_ID,
    memberCount: 6,
    joinedAt: '2026-01-01T00:00:00.000Z',
    roles: Object.fromEntries(ROLES.map(entry => [entry.id, entry])),
    myRoles: [],
    enhancedRoleColors: true,
    version: 0,
}

export const OTHER_GUILD: Guild = {
    ...GUILD,
    id: OTHER_GUILD_ID,
    name: 'Another Server',
    roles: {},
}

export const MEMBERS: Record<string, Member> = {
    [ALICE.id]: { roles: [RoleId.MODERATOR], nick: 'Alice (mod)' },
    [BOB.id]: { roles: [RoleId.DESIGNER] },
    [CARA.id]: { roles: [RoleId.GRADIENT] },
    [DAN.id]: { roles: [] },
    [BOT.id]: { roles: [] },
    [ME_ID]: { roles: [] },
}

const channel = (
    id: string,
    type: number,
    name: string,
    extra: Partial<Channel> = {},
): Channel => ({ id, type, name, guild_id: GUILD_ID, ...extra })

export const CHANNELS: Channel[] = [
    channel(ChannelId.GENERAL, ChannelType.GUILD_TEXT, 'general'),
    channel(
        ChannelId.ANNOUNCEMENTS,
        ChannelType.GUILD_ANNOUNCEMENT,
        'announcements',
    ),
    channel(ChannelId.VOICE, ChannelType.GUILD_VOICE, 'lounge'),
    channel(ChannelId.STAGE, ChannelType.GUILD_STAGE_VOICE, 'town-hall'),
    channel(ChannelId.FORUM, ChannelType.GUILD_FORUM, 'ideas'),
    channel(ChannelId.THREAD, ChannelType.PUBLIC_THREAD, 'Weekend plans', {
        parent_id: ChannelId.GENERAL,
        thread_metadata: { archived: false },
    }),
    channel(ChannelId.FORUM_POST, ChannelType.PUBLIC_THREAD, 'Dark mode idea', {
        parent_id: ChannelId.FORUM,
        thread_metadata: { archived: false },
    }),
    {
        id: ChannelId.OTHER_GUILD_CHANNEL,
        type: ChannelType.GUILD_TEXT,
        name: 'elsewhere',
        guild_id: OTHER_GUILD_ID,
    },
    {
        id: ChannelId.GROUP_DM,
        type: ChannelType.GROUP_DM,
        name: 'Weekend crew',
        recipient_ids: [ALICE.id, BOB.id],
    },
]
