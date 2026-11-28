/** REST paths of the Discord API, relative to API_BASE. */
export const Endpoint = {
    experiments: '/experiments',
    login: '/auth/login',
    logout: '/auth/logout',
    mfa: (method: string) => `/auth/mfa/${method}`,
    mfaSmsSend: '/auth/mfa/sms/send',
    me: '/users/@me',
    myChannels: '/users/@me/channels',
    /** USER_SET_GUILD_IDENTITY: adopts or clears a server tag. */
    myClan: '/users/@me/clan',
    myGuild: (guildId: string) => `/users/@me/guilds/${guildId}`,
    /** SET_GUILD_MEMBER: updates the current user's server profile (e.g. nickname). */
    myGuildMember: (guildId: string) => `/guilds/${guildId}/members/@me`,
    notificationCenterItems: '/users/@me/notification-center/items',
    notificationCenterItem: (itemId: string) =>
        `/users/@me/notification-center/items/${itemId}`,
    notificationCenterItemAck: (itemId: string) =>
        `/users/@me/notification-center/items/${itemId}/ack`,
    /** ACCOUNT_NOTIFICATION_SETTINGS */
    accountNotificationSettings: '/users/@me/notification-settings',
    myGuildSettings: (guildId: string) =>
        `/users/@me/guilds/${guildId}/settings`,
    settingsProto: (type: number) => `/users/@me/settings-proto/${type}`,
    searchTabsDms: '/users/@me/messages/search/tabs',
    searchTabsChannel: (channelId: string) =>
        `/channels/${channelId}/messages/search/tabs`,
    searchTabsGuild: (guildId: string) =>
        `/guilds/${guildId}/messages/search/tabs`,
    stickerPacks: '/sticker-packs',
    /** GIFS_SEARCH, GIFS_TRENDING, GIFS_TRENDING_GIFS, GIFS_SUGGEST and GIFS_SELECT. */
    gifsSearch: '/gifs/search',
    gifsTrending: '/gifs/trending',
    gifsTrendingGifs: '/gifs/trending-gifs',
    gifsSuggest: '/gifs/suggest',
    gifsSelect: '/gifs/select',
    /** APPLICATION_COMMAND_INDEX_CHANNEL, _GUILD and _USER. */
    commandIndexChannel: (channelId: string) =>
        `/channels/${channelId}/application-command-index`,
    commandIndexGuild: (guildId: string) =>
        `/guilds/${guildId}/application-command-index`,
    commandIndexUser: '/users/@me/application-command-index',
    preloadMessages: '/channels/preload-messages',
    channel: (channelId: string) => `/channels/${channelId}`,
    /** THREAD_MEMBER: the user's own membership of a thread (POST joins, DELETE leaves). */
    myThreadMember: (threadId: string) =>
        `/channels/${threadId}/thread-members/@me`,
    /** THREAD_MEMBER_SETTINGS. */
    myThreadMemberSettings: (threadId: string) =>
        `/channels/${threadId}/thread-members/@me/settings`,
    /** GUILD_CHANNELS: creates (POST) a guild channel, used to duplicate one. */
    guildChannels: (guildId: string) => `/guilds/${guildId}/channels`,
    guildPreview: (guildId: string) => `/guilds/${guildId}/preview`,
    channelInvites: (channelId: string) => `/channels/${channelId}/invites`,
    channelMessages: (channelId: string) => `/channels/${channelId}/messages`,
    channelMessage: (channelId: string, messageId: string) =>
        `/channels/${channelId}/messages/${messageId}`,
    channelTyping: (channelId: string) => `/channels/${channelId}/typing`,
    /** CALL (GET: who may be rung), CALL_RING and CALL_STOP_RINGING. */
    /** REGIONS: the voice regions a server's channels can override to. */
    guildRegions: (guildId: string) => `/guilds/${guildId}/regions`,
    channelCall: (channelId: string) => `/channels/${channelId}/call`,
    channelCallRing: (channelId: string) => `/channels/${channelId}/call/ring`,
    channelCallStopRinging: (channelId: string) =>
        `/channels/${channelId}/call/stop-ringing`,
    channelPins: (channelId: string) => `/channels/${channelId}/messages/pins`,
    channelPin: (channelId: string, messageId: string) =>
        `/channels/${channelId}/pins/${messageId}`,
    channelAttachments: (channelId: string) =>
        `/channels/${channelId}/attachments`,
    channelThreads: (channelId: string) => `/channels/${channelId}/threads`,
    channelThreadsSearch: (channelId: string) =>
        `/channels/${channelId}/threads/search`,
    messageThreads: (channelId: string, messageId: string) =>
        `/channels/${channelId}/messages/${messageId}/threads`,
    messageAck: (channelId: string, messageId: string) =>
        `/channels/${channelId}/messages/${messageId}/ack`,
    bulkAck: '/read-states/ack-bulk',
    messageCrosspost: (channelId: string, messageId: string) =>
        `/channels/${channelId}/messages/${messageId}/crosspost`,
    messageReactions: (channelId: string, messageId: string) =>
        `/channels/${channelId}/messages/${messageId}/reactions`,
    /** `emoji` is `name` or `name:id`, URL-encoded. */
    messageReaction: (channelId: string, messageId: string, emoji: string) =>
        `/channels/${channelId}/messages/${messageId}/reactions/${emoji}`,
    myReaction: (channelId: string, messageId: string, emoji: string) =>
        `/channels/${channelId}/messages/${messageId}/reactions/${emoji}/@me`,
    /** REACTION_WITH_TYPE for the current user: how a reaction of either type is taken back. */
    myReactionOfType: (
        channelId: string,
        messageId: string,
        emoji: string,
        type: number,
    ) =>
        `/channels/${channelId}/messages/${messageId}/reactions/${emoji}/${type}/@me`,
    /** POLL_ANSWERS: PUT the user's `answer_ids`, an empty list removes the vote. */
    pollAnswers: (channelId: string, messageId: string) =>
        `/channels/${channelId}/polls/${messageId}/answers/@me`,
    /** POLL_EXPIRE: ends a poll early. */
    pollExpire: (channelId: string, messageId: string) =>
        `/channels/${channelId}/polls/${messageId}/expire`,
    /** POLL_ANSWER_VOTERS: the users who voted for one answer. */
    pollAnswerVoters: (
        channelId: string,
        messageId: string,
        answerId: number,
    ) => `/channels/${channelId}/polls/${messageId}/answers/${answerId}`,
    /** INTERACTIONS: runs a slash command or a message component. */
    interactions: '/interactions',
    attachment: (uploadFilename: string) => `/attachments/${uploadFilename}`,
    /** ATTACHMENTS_REFRESH_URLS: re-signs expired attachment URLs. */
    attachmentsRefreshUrls: '/attachments/refresh-urls',
    sticker: (stickerId: string) => `/stickers/${stickerId}`,
    roleMemberIds: (guildId: string, roleId: string) =>
        `/guilds/${guildId}/roles/${roleId}/member-ids`,
    guildOnboarding: (guildId: string) => `/guilds/${guildId}/onboarding`,
    guildOnboardingResponses: (guildId: string) =>
        `/guilds/${guildId}/onboarding-responses`,
    /** USER_PROFILE. */
    userProfile: (userId: string) => `/users/${userId}/profile`,
    /** APPLICATIONS_PUBLIC: public details of applications, by `application_ids`. */
    applicationsPublic: '/applications/public',
    /** USER_RELATIONSHIP: PUT with a type adds or blocks, DELETE removes or unblocks. */
    userRelationship: (userId: string) => `/users/@me/relationships/${userId}`,
    /** IGNORE_USER: PUT ignores, DELETE stops ignoring. */
    ignoreUser: (userId: string) => `/users/@me/relationships/${userId}/ignore`,
    /** NOTE: the current user's private note about a user. */
    userNote: (userId: string) => `/users/@me/notes/${userId}`,
    guildMember: (guildId: string, userId: string) =>
        `/guilds/${guildId}/members/${userId}`,
    guildBan: (guildId: string, userId: string) =>
        `/guilds/${guildId}/bans/${userId}`,
    /** STREAM_PREVIEW: the signed URL of a Go Live stream's thumbnail. */
    streamPreview: (streamKey: string) => `/streams/${streamKey}/preview`,
} as const
