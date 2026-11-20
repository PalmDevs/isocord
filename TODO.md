# Isocord TODO

Everything still to do, grouped by area. "Reference" means the decompiled client in
`discord-mobile-datamining`; anything marked *verify* has not been compared against it yet.

Plan phases: 1 Foundations ✔ · 2 Auth/accounts (mostly done) · 3 Shell (first cut) ·
4 Chat read path (in progress) · 5 Chat write path · 6 Secondary screens · 7 Settings ·
8 Performance, plugins, background notifications, voice.

---

## Chat: message rendering (phase 4)

Design rule (2026-11-17): keep the chat consistent with itself. Use the reference as the starting point, but it does not have to match Discord one to one.
- [x] **Chat showcase screen** in the gallery: one sample message per message type and per chat feature, rendered by the real `buildRows` and `ChatView`, so differences are visible in one place. Each new message type or feature adds its sample. Built 2026-11-17: gallery "Chat" page, `src/features/gallery/chatShowcase/` (fixtures per domain, stub session). Untested on device.
  - [ ] Verify on device: the sample sticker and custom emoji ids (some are made up) and that the media loads (picsum.photos, MDN CC0 files).
  - [x] The showcase's `PENDING_TYPES` list is gone; every type is in `MessageType` (2026-11-18).
  - [x] `RichMessage` and `ApiPoll` exported from `rows/rich.ts`; the fixture copies are gone (2026-11-18).

- Owner's fixes (2026-11-18):
  - [x] Tapping the replied-message preview ripples the whole message (shares the row's interaction source). Built 2026-11-18, untested on device.
  - [x] Embed fields sit beside the thumbnail, as `embed_view.xml` lays them out, so no gap without a title or description. Built 2026-11-18, untested on device.
  - [x] The message being replied to stays highlighted (`replyingMessageId` ChatView prop, `theme.highlight` as the reference's editingColor). Built 2026-11-18, untested on device.
    - [x] Highlight the message being edited too, as the reference does (`state.editing[channelId]?.id` in `ChatList.tsx`).
  - [x] Message height animates when reactions change (200 ms, reactions slot only). Built 2026-11-18, untested on device. Check that it doesn't animate when LazyColumn reuses a row.
  - [x] Stray KDoc line above `TypingInsetSpring` in `ChatList.kt`; unused `combinedClickable` import in `ReplyPreview.kt`.
  - [x] Notifications: server, group DM or DM icon as the large (conversation) icon, as `NotificationDataUtils.getIconUrl` does. Fixes the blank "dot" in threads and posts. The reference has no per-channel-type icons; announcement and voice text just lacked the server icon. `forward.ts` sends the icons too. Built 2026-11-18, untested on device.
  - [x] Notifications: Reply only where the account may send (`getDirectReplyAction`'s `canReply`, which Discord's push carries). Worked out natively (`ChannelPermissions.kt`, canSendMessages over computePermissions), from READY and role/channel events in the background, from `forward.ts`'s guild roles and overwrites in front. Not done: the reference's app-DM exclusion, timeouts. Built 2026-11-18, untested on device.
    - [ ] Publish conversation shortcuts (`getShortcutInfo`); default group DM icons for groups without one. Stage channels get the server icon (the reference gives none).
  - [x] Replied message area: no ripple, long press consumed (doesn't open the message's actions). Built 2026-11-18, untested on device.
  - [x] Reaction pills scale in and out (200 ms, shares `REACTIONS_RESIZE_MS`). Built 2026-11-18, untested on device.
  - [x] Welcome row icons (`ChatBeginningRowIcon`): text, thread, post. Built 2026-11-18, untested on device.
    - [ ] Lock variants for private channels and the app-channel icon (need the @everyone VIEW_CHANNEL check and `GUILD_APP`).
    - [x] Search results' `channelGlyph` (`MessageResults.tsx`) still uses "•"/"#" text.
  - [x] Thread card author avatar: size 36 → 64 (CDN serves powers of two only; inferred, not observed). Built 2026-11-18, untested on device.
  - [x] Silent messages: BellZIcon after the timestamp, `isNewMessageGroup` silence rule. Built 2026-11-18, untested on device.
    - [x] Tap the bell for the "This is a @silent message." toast (`handleTapSuppressNotificationsIcon`, `RO/KYj`); "Silent message" a11y label (`t0MA8g`).
  - [x] Reply "@" shows on pending replies (`pendingMessage` mentions the replied author unless it's yourself or the ping is off). Built 2026-11-18, untested on device.

Compared against the official client side by side (split-screen screenshot, 2026-11-12):

### Author line
- [ ] **Role gradients**: partly done. Long names need the gradient to loop back and forth (ping-pong) instead of stretching once.
- [x] **Clan / guild tags**: badge + tag text after the username (e.g. `💜 NG`), in the header and in reply previews.
- [x] **Avatar decorations** around avatars (Yoshi's ring in the screenshot).
- [x] Role icons after the username.
- [x] Bot / app tag styling (verified check, "APP" pill size and colour).
- [x] Username weight and size.
- [x] Timestamp format.
- [ ] Server-specific avatars (member `avatar`) and server profiles.

### Replies
- [x] **Reply spine**: the curved line from the avatar column up to the reply preview.
- [x] Reply preview content: 16px avatar of the replied-to author, `@` before the name, clan tag, and markdown-stripped text.
- [x] Reply to a deleted / unloaded message ("Original message was deleted"), reply to an attachment-only message (icon + "Click to see attachment").
- [x] Tapping a reply jumps to the replied-to message (scroll + highlight; loads the window `around` it when not loaded). Untested on device.

### Layout and spacing
- [x] Gutter and avatar gap: 12dp edge inset + 40dp avatar + 12dp gap = 64dp content start (`MESSAGE_EDGE_INSET` / `MESSAGE_AVATAR_GAP`). Group spacing and grouped-message top padding still *verify*.
- [ ] Chat background colour: the reference screenshot uses the **darker** theme, ours is **dark**; compare again on the same theme before changing tokens.
- [ ] Line heights and inline alignment are usable but still not exact (text, headings, inline emoji, code).
- [ ] Markdown list margins and padding are slightly off; body text weight probably doesn't match the reference.
- [x] Press highlight (ripple) colour is wrong: it should lighten in dark themes and darken in light themes, ours does the opposite.
- [ ] Rounded ripples: `RipplePressable` draws a bounded ripple on a child layer clipped by the pressable's rounded `overflow: 'hidden'` and presses it with the view commands `hotspotUpdate`/`setPressed` itself, since `ReactViewGroup.dispatchSetPressed` doesn't pass the pressed state to children (stock RN masks `android_ripple` to a rectangle; the reference's RN fork takes a `cornerRadius`). Cleaner: patch RN (`CompositeBackgroundDrawable`'s feedback underlay, or `ReactDrawableHelper`'s mask) to clip the ripple to the border radius and drop the extra view; needs React Native built from source, the app uses the prebuilt `react-android`.
- [ ] Press feedback audit: every pressable now ripples (`RipplePressable`) or highlights; not covered: sheet handle / scrim dismiss areas, native Compose chat surfaces (not rechecked).
- [ ] Strings still not from the reference (checked against the compiled intl file, no exact hit): chat.mention.unavailable, chat.readOnly, composer.expressionsSoon, chat.system.unsupported, chat.reply.unloaded, chat.jump.notFound, expressions.* / composer.* hints; parametrised copy not verified.
- [x] Date separator styling.
- [x] "NEW" unread divider and the "new messages" bar.
- [x] Jump-to-present button (↓ in the bottom right) when scrolled up.
- [x] "<N>+? new messages since <time>" strip under the header (`NewMessagesBar`; reference ChatBanner → NewMessagesChatBar, MessagesUtils scrollToNewMessages): loaded messages after the read marker, "N+" when the window is not the newest or every loaded message is unread; a tap loads the window around the marker and scrolls to the oldest unread, ✕ marks the chat read. Only while the gateway is connected. Built and installed on the emulator 2026-11-15, untested. Open: the time is short time only (assumed `{timestamp, time, short}`; the compiled message type was not checked); a deleted read-marker message gives the "not found" toast instead of a jump.
- [x] Scroll position restoration when reopening a chat (in memory, per channel, last 50 chats).

### System messages
System rows live in `src/features/chat/system/`: `index.ts` dispatches by message type (createSystemMessageContent), one file per domain exports its handlers (icon, tint, content as a message key in Discord's `{$link:…}`/`{$b:…}` markup), and `systemPlainText` gives the Messages tab preview (SystemMessageUtils.stringify). A new domain is a new file plus one spread line in `HANDLERS`. Icons and tints for every type in SystemMessageView.getIconAndColor are already in `SystemRow.kt` (`system_*` drawables). Types without a handler fall back to their content in an ordinary row. Built 2026-11-17 and installed on the emulator, untested on device.
- [x] Join (randomised line by send time, "Wave to say hi!", bot "was added to the server."), recipient add/remove/leave (group and thread), channel name / post title / group name, group icon, pins ("a message" jumps, "pinned messages" opens the details on Pinned Messages), boosts with count and tiers 1–3, thread created (name opens the thread). Reactions under system rows.
  - Differences: role gradient (enhanced role colours) not drawn on system usernames; "Edit group" only toasts (no group DM settings sheet); the bot join's `actor` variant ("x has added y") is not shown (the field is not kept); the wave button ignores SUPPRESS_JOIN_NOTIFICATION_REPLIES; thread-created previews keep the sentence (stringify gives only the name).
- [x] Ported 2026-11-18 (built, installed on the emulator, untested on device):
  - `calls.ts`: CALL (ongoing, missed, ended with duration) and VOICE_SESSION.
  - `polls.ts`: POLL_RESULT, with the question linking to the poll.
  - `automod.ts`: AUTO_MODERATION_ACTION.
  - `stage.ts`: the five Stage types.
  - `guild.ts`: follow add, discovery (4), GUILD_STREAM, alert mode on and off, raid, false alarm.
  - `purchases.ts`: role subscription (joined or renewed, months), PURCHASE_NOTIFICATION, app premium, private channel integration added and removed.
  - `threads.ts`: THREAD_STARTER_MESSAGE draws the parent, or the "couldn't load" line.
  - Thread card (`ThreadEmbedCard.kt`, `threadEmbed.ts`) under messages with a thread and under THREAD_CREATED: name, "{count} ›" / "See Thread ›", newest author and text; opens the thread.
  - Boost rows are the message only; no boost modal (decided 2026-11-17).
  - Differences:
    - Poll result is text only; the mobile reference has no card, and a winning custom emoji is dropped.
    - No links on the role subscription overview, the followed-server menu or Join Stream. No first-month welcome card or sticker.
    - Thread card has no blocked or spoiler variants.
    - CHAT_INPUT and CONTEXT_MENU_COMMAND are user messages in the reference, so the "used a command" line never applies (see interaction headers).
- [ ] AutoMod: avatar is the reference's auto_moderation_avatar PNG from the APK (2026-11-18). `system_automod_shield` is now unused. The APK has no archived-thread icon, and nothing needs one yet. No action bar or Report Issues, and raid-alert notification embeds aren't ported.
- [ ] Calls: no join on tap, no ticking timer while ongoing. "Active" means `ended_timestamp` is empty.
- [ ] Not ported yet: GUILD_JOIN_REQUEST_*, GUILD_SPACE_MESSAGE, PREMIUM_REFERRAL, PREMIUM_GROUP_INVITE, GIFTING_PROMPT, CHANNEL_LINKED_TO_LOBBY, IN_GAME_MESSAGE_NUX, FRIEND_REQUEST_ACCEPTED.
- [ ] `ThreadRow.tsx` hardcodes 21 instead of importing `MessageType.THREAD_STARTER_MESSAGE`.

### Markdown
- [x] Lists, subtext (`-# `), mention spoilers, guild-navigation / command / cross-guild channel mentions and Discord channel+message links checked against the reference. Open: list padding (reference 16 top, 4 per item, bullet in a bold mono font). Mention icons done (see below).
- [x] Code block syntax highlighting.
- [x] Timestamp styles (`<t:…:R>` relative, `:d`, `:F` …) instead of `toLocaleString`.
- [x] Unicode emoji as Twemoji images, `:shortcode:` handling.
- [ ] Guild navigation mentions (`<id:customize>`), slash-command mentions (`</name:id>`), linked channel mentions across guilds.
- [ ] Links to Discord messages/channels (like the one in the announcement) should render as channel mentions. Tapping one opens the channel and jumps to the message (done).
- [x] Channel mentions and links to channels the client does not hold (archived or unjoined threads and posts) are fetched once with `GET /channels/{id}` (`stores/channels/linkedChannels.ts`, after LazyLoadedThreadManager.loadThread), and the rows rebuild when one arrives. The official mobile client does not fetch them. Only threads are held, like the reference. Built 2026-11-17, untested on device.
  - [ ] A link to a DM or group DM shows "unknown" even when the DM is held: the resolver returns `channel.name`, which DMs lack (the reference uses computeChannelName).
  - [ ] Search results, notifications and the media footer (`buildMessageRow`) don't fetch unknown linked channels.

### Attachments and embeds
- [ ] Spoiler images and alt text on embeds; image size limits per the reference (multi-image mosaic of link embeds is done, see below).
- [x] Video attachments and video/gifv embeds (Tenor/Giphy currently show a still frame).
- [x] Audio attachments and voice messages (waveform player).
- [~] Media viewer (`src/features/mediaViewer`, `MediaViewer.kt`; reference `modules/media_viewer/native`). Native pager, footer and gestures in `IsocordMediaViewerView`, JS header on top, opened as a sheet in ModalStack, over the sheet it was opened from. First version checked on a device; the second round (below) built and installed on the emulator, **not yet looked at**.
  - Opens from chat attachment and embed tiles, forwards' media (`isocord://forward-media|forward-embed-media`), search result media, and the search Media tab and Recent grid (paging through every media result loaded so far, the footer following each item's message). Tiles send where they are (`?origin=x,y,w,h`) and the viewer grows out of them (cover mode, 300 ms standard easing, corners 16 to 0 over the first quarter), starting on the tile's own picture from Coil's memory cache (`loadedCopy`). The search Media tab draws its tiles with `IsocordProxyImageView` (Coil) instead of expo-image so the cache is shared.
  - Swipe up or down closes on a release faster than 1000 dp/s (else springs back, damping 15, stiffness 250); the closing spring stops at the edge instead of swinging back. Tap toggles the header and footer (150 ms in, 75 ms out, hidden while dragging, gone at once when closing). Zoom is on the whole page, as the reference's zooming ScrollView (pinch, double tap, pan past the picture's edges; telephoto `zoomable`), with the reference's zoom limit; the picture is asked for at its full-zoom size (up to 4096 px).
  - Videos play when shown and pause when left; footer controls (play/pause, time, timeline with tap/drag seek, length, mute). GIF videos loop muted. YouTube and TikTok play in a web view after the play button (the reference's iframe API page; TikTok with its own controls). Spoiler media other than the tapped one stays covered until tapped. ALT button opens "Image Description (Alt Text)". Header: close, More Options (Save to the media library with the saved toast, Share, Copy Media Link, Open in Browser, Jump to Message from search) in a context menu by the button; a long press on the media opens the same options in an action sheet. Light status bar icons while open.
  - Footer (our own design): the message cut after three lines in the dark theme, the media strip and the reactions with an always-shown "React" button, both lined up with the message text.
  - Embed cards' corner thumbnails (bot embeds) open too (`isocord://embed-media/<id>/<index>/thumbnail`); when the card also has an image, the thumbnail is its own page just before it (the reference's pager has only image ?? video ?? thumbnail per embed). Built 2026-11-16 and installed on the emulator, untested on device.
  - Components V2 gallery items and section thumbnails open too (`isocord://component-media/<id>/<component id>/<item>`, extractMediaSourcesFromComponent): a gallery pages through its own items only, a thumbnail opens alone. Long press opens the media sheet. Placeholder items (no image or video type) are kept, unlike toMediaSourceFromUnfurledMedia. Spoilers on gallery items and thumbnails are covered in neither the chat nor the viewer yet. Built 2026-11-17 and installed on the emulator, untested on device.
  - Differences: More Options is a context menu, not the reference's action sheet; Share sends the link, not the file (no file share module); the mute button is in the controls row, not the header; the media strip is a plain row, not the reference's scrubber; search does not load more results from inside the viewer (onEndReached); no "Forward" or "Mark As Not Sensitive" actions; no favourite GIF button; the reference's own TikTok controls.
- [x] Inline embed fields side by side (works; confirmed by the owner 2026-11-17).
- [x] Image/GIF/video link embeds as inline media (isEmbedInline), link hidden when it is the only content (hasOnlySimpleEmbed), embeds sharing a url merged into a gallery, play button on YouTube/TikTok, `||link||` hides the media. Compiled and checked on device: not yet.
- [ ] Embed provider links and author links.
- [-] Spotify, Twitch and other platform-specific (social) embeds: skipped for now. They aren't worth the effort yet. The generic embed covers them.
- [x] Markdown in embed titles and field names (EMBED_TITLE_RULES: everything but code blocks, br, user/role/@everyone mentions and subtext; a title that is the embed's link is parsed without links). `parseEmbedTitle` in `markdown.ts`, `EmbedRow.title` / `fields[].name` are spans, drawn by `InlineMarkup` in `Embed.kt`. Author name, provider and footer are plain text in the reference too. Compiled only, not checked on device.
- [x] Mention icons instead of glyphs: channel type icons (text, announcement, forum, media, thread, post, voice, stage), the message bubble (`ChatIcon`) for message links, `ic_caret_24px` as separator, route icons (home/guide sign post, browse/customize magnifier, linked roles link) as inline placeholders tinted with the mention colour (`Span.icon`, `mentionIcon` in `MessageText.kt`, drawables `mention_*.png`). Open: NSFW / spoiler / locked variants (need channel flags and permissions), guild icon chip in front of other-guild channel names (we show the guild name), `/` of command mentions is plain bold text in the reference (kept as text).
- [x] Message text and the composer one weight step heavier (Medium, mentions SemiBold, links stay Normal), as the official Android app draws them. Built 2026-11-16, untested on device.
- [x] Mention colours in the chat follow the official APK's native `chat_mentions_{background,foreground}_{dark,light}` (brand at 30% / BRAND_260 dark, BRAND_160 / BRAND_530 light), not the paler `MENTION_*` tokens. The composer keeps `MENTION_*` like the reference's ChatInputAppCommandManager. Untested on device.
- [x] Composer selection handles tinted with the official app's `colorAccent` (brand_260) in `styles.xml`. Untested on device.
- [x] Gradient role mentions: `Span.colors` (`roleColors` in `author.ts`, shared with usernames) painted with a brush; pill tint is the primary colour at 10% (was 15%). Open: the brush is mirrored over an estimated text width (a span brush covers the whole paragraph), so the exact phase differs from the reference.
- [x] APNG stickers animate in the chat and the picker (`ApngDecoder.kt`, APNG4Android, a frame at a time: the official client's LINE apng keeps all frames and ran out of memory). Picker follows `animate_stickers`: "on interaction" stays still (the reference animates the focused one). Built 2026-11-19, untested on device.
- [ ] Stickers that fail to load.
- [x] Polls: voting, Show results / Go back to vote, End Poll Now, voters sheet, live votes (`features/chat/polls/`, `stores/pollState.ts`, `Poll.kt`). Remove Vote sends a `PUT` with an empty list, as the reference does. Errors show a toast, not the "Oh no!" alert. Built 2026-11-18, untested on device.
  - [ ] Voters sheet lists only the first 100 voters per answer; image polls and their long press; vote editing (nothing in mobile turns it on).
  - [ ] Vote `answer_ids` are sent as strings, as the reference does; docs.discord.food says integers.
- [x] Bot components: buttons (all styles), selects (string, user, role, mentionable, channel) with pick sheets, interactions (`isocord://component/...`, POST /interactions, INTERACTION_* events, loading and failure texts), components v2 (container, section, text display, media gallery, file, separator). `src/features/chat/messageComponents/`, `chat/rows/components/`. Built 2026-11-18, untested on device.
  - [ ] `shouldDisableInteractiveComponents` (lurking, pending member, locked or archived thread, timeout); `unarchiveThreadIfNecessary`; `sendClydeError`; INVALID_FORM_BODY / UNKNOWN_INTEGRATION handling. An interaction whose POST succeeded but got no gateway event stays waiting until the chat reopens (the reference has no rule either).
  - [ ] Application name in the timeout text (needs an application store); wide layout (400dp selects, 85dp thumbnails); spoilered or obscured file components; components in forwarded snapshots.
- [x] Forwarded messages (message snapshots) in the chat: rounded 4 dp bar with content at 20 dp, footer "#channel • date >" (forward_breadcrumb_view, `MessageForward.getForwardInfo`; origin channel or server with icon, compact timestamp, accessibility label), the whole footer row a chatPress with a ripple. Built 2026-11-15, untested on device.
  - [ ] Bar colour (reference `k0.a().l()`, `theme.spine` for now); the "Forwarded" header per forward_header_view (16 dp icon + 14 sp label); lurking a server the user isn't in (`handleForwardBreadcrumb` `startLurking`); search results handling `isocord://forward`.
  - [ ] ChatPreview and search rows don't pass `guilds`, so forwards from other servers show no footer there.
- Open review notes (2026-11-15):
  - [ ] `ChatPanel` subscribes to the whole `guilds` map for forward footers, so any guild change rebuilds every row in JS. Select only the guilds forwards point to.
  - [ ] `ChatInput` `selectionColor` uses hex literals (`#ffffff99` / `#5865f299`); no selection token yet.
  - [ ] Rotating during the stacked panel's close slide cancels it and leaves the stacked `ChatPanel` mounted offscreen until the next open/drop.
  - [ ] Media search `coverSize` doesn't cap the scale at the source size (native `ProxyImageMapper` does).
  - [ ] Check whether the `memo` / `useMemo` in `MemberRow`, search media cells, `ChatPanel` and `SearchTabsLayout` are needed with the React Compiler on.
- [x] Interaction header (16 dp avatar, role-coloured name, command pill; slash only for slash commands) and ephemeral "Only you can see this • Dismiss message" (local delete). Built 2026-11-18, untested on device.
  - [ ] Ephemeral help article button; command name taps.
  - [ ] Remove the dead `interaction`/`ephemeral` string fields and the `InteractionHeader`/`EphemeralFooter`/`richOf` checks in `Forward.kt` and `ChatRows.kt` (left while forwarding is being reworked).
- [x] Super reactions: own chip before the normal one, palette from `buildPlatformedThemedEmojiColorPalette` (`burstColors.ts`), static only (decided 2026-11-17). Hold opens the reactions sheet on the super tab. Without Nitro, a tap toggles a normal reaction instead of the upsell. Built 2026-11-18, untested on device.
  - [ ] Out-of-super-reactions upsell for users without Nitro.

### Interaction (read-only parts)
- [x] Long-press message action sheet (`src/features/chat/longPress/`): quick reactions + picker, edit, reply, open thread, copy text, mark unread, publish, pin, DM, mention, copy link, copy ID (developer mode), remove all reactions, delete; failed-message retry/delete. Untested on device as of 2026-11-13.
- [x] Channel long-press sheet (`src/features/channelActions/`): long press on channel, category, thread, DM and group DM rows (servers list, Messages tab) and the channel details' settings button (a DM, group DM, thread or channel without MANAGE_CHANNELS). Rows: Profile, Close DM, Pin Channel to Top, Copy Link, Mark Unread, Mark As Read, Mute/Unmute, Notification Settings, Edit Channel/Category, Duplicate Channel (ours), Copy Channel ID (developer mode), Customize Group, Leave Group. Built 2026-11-19, untested on device.
  - [ ] Not done: Invite, favorites rows, opt-in channels rows (category), Threads browser, stage/voice rows (Connect, Open Chat, End Stage, Report, collapse), Re-hide Spoiler Channel, the experimental rows, Mute Thread (no thread notification settings), mention count of Mark Unread, DM icons in the guilds bar (isocord's bar has none).
  - [ ] Missing rows (features don't exist yet):
    - View Reactions;
    - Report;
    - Apps;
    - Bookmark/reminders, End Poll Early;
    - attachment and media rows;
    - Jump.
  - [ ] English labels are from memory (the datamining has only hashed keys). Verify against the official app, especially "Message" (the DM row) and "Open Thread". `read-datamine.ts` prints "View Thread" for that row (hash `39d0Wj`).
- [x] Create Thread (`src/features/threads/`, 2026-11-16): from the long-press sheet ("Create Thread" on a user message without a thread, in a text or announcement channel, CREATE_PUBLIC_THREADS + READ_MESSAGE_HISTORY) and from the Threads page's create button (a thread on its own; the details slide away first). A panel in `ChatPanels` over the chat on top (the reference's CREATE_THREAD screen of the channel stack), swiped or backed away like the stacked chat. Like CreateThreadView: "New Thread" header over the parent's name, thread icon, name field ("Thread Name (Optional)" from a message, required otherwise; placeholder is the default name), the starter message (author + native body preview, cut at 200 dp; the reference draws a full chat item), and the composer in thread mode (`ComposerProvider` `thread`: its own draft and file list `thread.<channel>`, files prepared at once but uploaded to the thread once it exists (upload store `defer`), no typing, no reply/edit, a sticker creates the thread with it). Send creates a public (announcement) thread with the parent's default archive time, sends the first message if any, and opens the thread stacked under the panel, which goes once the thread's chat has drawn. Unlike the reference: the send button shows the thread icon and "Create Thread" while the input is empty; back from the new thread returns to the chat it was made in (the reference replaces that chat). Built and installed on the emulator, **not yet tried on a device**. Not done: private threads (the "Private Thread" switch for a thread without a message), the CreateThread slowmode, automod title errors (shown as the generic error toast), the name draft (`DraftType.ThreadSettings`) surviving the panel. Files that fail to upload after the thread is created are dropped with a toast and the text is sent alone.
  - [x] Delete, Pin and Unpin confirms show the message (`AlertMessagePreview.tsx`, the reference's alert `children`): author over the native body, no line clamp, cut at 256 dp with a fade. Built and installed on the emulator 2026-11-17, **not yet looked at**. Publish and Remove All Reactions have none, as in the reference.
  - [ ] Create Thread's starter message is clamped to 2 lines (`MessagePreviewView`'s default `lineClamp`), before its 200 dp cut.
  - [ ] Quick reaction row toggles an existing reaction off; the reference only adds.
- [x] Tapping mentions: user → profile sheet, role and @everyone → role members sheet (`roleMembersSheet.tsx`: `GET /guilds/{id}/roles/{role}/member-ids` then gateway REQUEST_GUILD_MEMBERS for the missing ones, rows filtered from the member store and sorted by name, header with role dot and name; @everyone lists the channel's member list as loaded; an unknown role does nothing), command → `/name` in the composer (reference: app launcher), channel → opens it / "no access" toast, `nav` → "not available" toast.
  - [ ] Role members sheet: no member count in the header, no paging past what `member-ids` returns, @everyone shows only the loaded part of the member list, @here is not tappable.
- [x] Tapping reactions (react/unreact, optimistic), hold → TEMPORARY reactors sheet (first 100 only, no paging), add-reaction chip under 20 reactions.
- [x] Header taps: name → mention in the input, avatar → profile sheet, clan tag → TEMPORARY server sheet, role icon → toast (looks the server up from the channel: fetched messages have no `guild_id`). Press targets not checked against the reference.
- [x] Swipe left to reply, pull past 130dp to edit (reference `SwipeHelper`). Not done: the gutter's bevelled ends/shadow, join rows.
  - [ ] Animate the row's border radius while swiping, as the reference does.
  - [ ] Haptics and icon animation per RDX `SwipeHelper`: buzz at 80dp and on the reply→edit flip, icon rotation, edit circle 0 → 1.3 → 1. Verify against the APK; what's there now isn't right yet.
- [x] Media long press (2026-11-16): holding a media tile (attachment, embed media, embed corner thumbnail, a forward's media) opens the message sheet with that media (the reference's `selectedMedia`): a small preview on top (skipped for spoilers), then Save Media (not for YouTube/TikTok players), Copy Media Link, Copy Proxied Media Link (when the proxy address differs) and Open Media Link in a group of their own, then the reactions, then the message's rows. The reference has no preview, keeps the reactions on top and mixes these rows into the first group, with Save Image/Save Video labels. The preview uses the chat's Coil cache through `IsocordProxyImageView`, showing the chat's in-memory copy without a new request when it is big enough. Installed on the phone and the emulator, **not yet tried by hand**. Not done: Save File for audio and file attachments (they have no long-press link yet).
  - 2026-11-17: Copy and Open Media Link use the file's own address (`ViewerSource.file`), not the proxy's. Save still downloads the proxied copy for embeds (getEmbedUrl).
- [ ] Chat events missing against the reference (`MessagesRenderer.tsx` props, handlers in `MessagesHandlers.tsx` and `contentHandlers.tsx`), checked 2026-11-17:
  - [x] Long press on links (`onLongPressLink`), channel mentions and message links (`onLongPressChannel`, permalink via `getChannelPermalink`, plus Go To Channel) and file attachment cards: Link Options (Open, Copy, Share, mail/phone/SMS rows). The message long press reports the link under the finger. Emoji, user and role links fall back to the message sheet. File cards show Save File, Copy Link, Copy Proxied Link and Open Link above the message sheet (our addition; the reference shows Link Options). Built 2026-11-18, untested on device.
  - [x] Long press on command mentions: Copy Command, Copy Command ID in developer mode. Built 2026-11-18, untested on device.
  - [x] Long press on the username opens the profile (`onLongPressUsername`). Built 2026-11-18, untested on device.
  - [x] Tap inline code copies it (`onTapInlineCode`). Holding an embed part copies that part's raw text, as the reference does: provider, author, title, description, field name or value, footer. Settings → Chat → Gestures: `tapInlineCodeToCopy`, `holdEmbedToCopy` (both on; labels are our own wording; `src/stores/settings/chatGestures.ts`). With the setting off, a hold opens the message sheet. Built 2026-11-18, untested on device.
  - [x] Tap on a sticker opens the sticker info sheet (`onTapSticker`), fetching the sticker first when it isn't held. Sticker hold does nothing: the reference only toggles animation, and ours always animate. Built 2026-11-18, untested on device.
  - [ ] Double tap a message to add the default reaction (`onDoubleTapMessage`, `DoubleTapToReactUtils`; write path).
  - [x] File attachment taps re-sign expired URLs first (`maybeRefreshAttachmentUrl`). Text files (the reference's 386 extensions) open a plain-text preview screen (`src/features/filePreview/`) with Wrap Text and Download. Unlike the reference, the whole card opens it (no separate View button), Download skips the suspicious-download warning, and whitespace isn't cleaned up. Built 2026-11-18, untested on device.
  - [ ] Voice messages have no hold rows.
  - [ ] Thread shortcut gesture (`onInitiateThread`: open the message's thread or create one).
  - [ ] Inline forward button (`onTapInlineForward`).
  - [ ] Message taps on system rows (`onTapMessage`): boosts open the boost modal, automod jumps to the flagged message.
  - [x] Poll answer, vote and action taps (`onTapPollAnswer`, `onTapPollSubmitVote`, `onTapPollAction`). `onLongPressPollImage` is left out: we draw no image polls.
  - [x] Interaction buttons and select menus (`onTapButtonActionComponent`, `onTapSelectActionComponent`). Built 2026-11-18, untested on device.
  - [ ] Come with their features: silent / timeout / OP tag toasts, blocked messages separator (`onTapSeparator`), call rows, invites (+ accept), thread embeds, game mentions and icons, voice channel badge, summaries and conversations, automod actions and feedback, forum post follow and share, gift codes, safety notices, obscured media, connections role tag, shared client themes, cancel upload.
  - [-] Soundmoji and activity joins: won't do. Discord retired soundmoji, and activities need voice channels, which aren't planned yet.
- [ ] Jump window: leaving a detached (jumped-to) chat keeps the window; Discord returns to the present on channel switch. Highlight timing (800 ms hold, 1200 ms fade) is a guess.
- [x] Typing indicator above the composer (`stores/typing.ts`, `composer/TypingIndicator.tsx`, `design/components/Ellipsis.tsx`); in the Messages tab it replaces a conversation's preview. Laid out like the custom typing indicator without its emojis; springs out the way it came in (the reference has no exit) and pushes the chat list up (`typingInset` on ChatView, animated in Compose). Not checked on device with someone typing.
  - [ ] Blocked and ignored users still show as typing (no relationship store yet; useTypingUserIds skips them).
  - [x] Slowmode on the right of the typing indicator (SlowModeIndicator, 2026-11-16): the bar is up whenever the channel has slowmode (hasTypingIndicatorContent); "m:ss" (h:mm:ss) cooldown, "Slowmode is enabled." or "Slowmode Immune" with the timer icon; a press toasts the rate. Unlike the decompiled reference, the cooldown stays while someone types. BYPASS_SLOWMODE now counts as a bypass. Built and installed on the emulator, **not yet tried on a device**.
  - [ ] The cooldown is only known for messages sent this launch (`useLastSent`); the reference also guesses it from the server's 429 retry_after (SlowmodeStore).
  - [ ] Friend nicknames aren't used for DM names (NicknameUtils.getName).

### Channel types
- [ ] Threads (open from the channel list and from thread-created messages).
- [~] Forum and media channels (post list). Built, untested on device.
  - Done: tapping a forum or media channel shows `features/forum/ForumPanel` in the chat panel (`ChannelPanel`). Two column masonry (FlashList), pinned posts first, posts from `GET /channels/{id}/threads/search` with their first messages (`stores/forumPosts.ts`, `useForumFeed`), live counts through `threadsStore`, a post opens as the stacked chat, empty and skeleton states. Card: media, pin, tags, preview, author, comments, time, unread dot.
  - Also built, untested on device: search bar (debounced `name`, `ForumSearchBar`) and the Sort & View sheet (`ForumFilterSheet`: sort, tags, match some/all, reset, applied live through `stores/forumQueries.ts`), filtered and searched empty states with a clear button, long press sheet (`ForumPanel.onLongPress` into `openChannelActionSheet`, the post is held with `holdThread`), pull to refresh, and new posts (THREAD_CREATE) at the top of unfiltered feeds (no first message until a refresh). The search `name` is cut to `THREAD_SEARCH_NAME_MAX`, and paging stops at `THREAD_SEARCH_MAX_OFFSET` (docs.discord.food).
  - Not done: grid and gallery layouts, `POST /channels/{id}/post-data` (not needed, the search returns first messages), per-post unread counts, typing users on a card.
  - [ ] New post button and composer (reference: `modules/forums/native/composer/ForumComposer*`).
  - [ ] Forum guidelines (reference: `ForumGuidelinesActionSheet`, `ForumGuidelinesManager`).
  - [ ] `forumPostsStore.posts` grows with every fetched post; only query feeds are evicted (5 per forum).
  - [ ] A 202 "index not ready" from `threads/search` shows as an empty list, with no retry.
  - [ ] Media channels use the same list layout (no gallery grid).
- [ ] Voice and stage channels (text-in-voice chat at least; joining is phase 8).
- [ ] Announcement channels: follow button, published messages.

---

## Chat header and panels

- [x] Shared `NavigatorHeader` (heading-18/bold title, text-xs subtitle, 56dp, hairline border) used by channel, DM, gallery and Manage Accounts headers. Background is our own choice (`BACKGROUND_BASE_LOWER`; the reference uses `BACKGROUND_BASE_LOW`).
- [~] Header like the reference: channel icon + name + chevron (`>`) opening channel details, search button on the right, thread/member buttons.
  - Done: the title (guild channel and DM) has the chevron and opens the channel details; a search button on the right opens them with the search bar up (`NavigatorHeader` `onTitlePress`, `chat/details/HeaderSearchButton`).
  - Not done: the member count subtitle of a guild channel header (online/total, `ChannelMemberCountStore`), thread and member buttons, the thread parent link in the details header, the topic's markup, gradient and spring open/close (`SPRING_CHANNEL_DETAILS` is defined, unused).
- [~] Channel details panel (`src/features/chat/details`, `ChatPanels`): header (icon, name, type or usernames, topic), buttons (search, mute, settings), search bar and the search tabs below.
  - Done: slides in over the chat (`PANEL_OPEN_MS`); closes with its back arrow, the hardware back (search first, except when it was opened by the header's search button: then back, and the search bar's chevron, close it at once) or a drag from the left edge; a channel (Channels tab) or thread (Threads tab) picked in them waits for them to slide away, then the chat under them switches to it in place (`openFromDetails`, untested on device); leftward swipe of the chat opens it when `appearance.swipe_right_to_left_mode` is CHANNEL_DETAILS (read from the user settings, never written; messages then do not swipe to reply). Searching folds the header away (`SPRING_CHANNEL_HEADER`).
  - Not done: a thread's mute button shows a "not available yet" toast (the mute icon does follow the muted state); the swipe mode is set in Settings → Chat → Swipe right to left; the reference reveals the details *behind* the sliding chat, here they slide in over it.
- [ ] DM header buttons: call, video call, search; activity status, typing.
- [x] Member list: the Members tab of the channel details (`src/features/search/members`). Guild channel: the lazy member list (`stores/memberList.ts`: GUILD_SUBSCRIPTIONS_BULK `channels` ranges in blocks of 100 as the list scrolls, GUILD_MEMBER_LIST_UPDATE SYNC/INSERT/UPDATE/DELETE/INVALIDATE) grouped into hoisted roles, Online and Offline with counts; with a query REQUEST_GUILD_MEMBERS (50, presences) filtered to members who can see the channel; DM and group DM: the people by username, owner crown. Rows: avatar with status, role colour, crown, APP tag, activity or custom status; tap opens the profile sheet.
  - [x] Verify on device against a real guild (list ids of channels with private overwrites, large guilds, scrolling to the Offline group, reconnect).
  - [ ] Role gradient names, nameplates, boost gem and the group DM promo banner of the reference rows.
- [x] Swipeable chat panel: verify on device — gesture vs. vertical scrolling, swipe-left to reopen, back button, orientation changes.
- [x] Split-screen: Unistyles reported the window's screen offset as the top inset (695px gap in the bottom half); patched in `patches/react-native-unistyles@3.8.1.patch` — *verify* at several split ratios, top and bottom. Also re-check the `ChatView.kt` re-measure on resize.
- [x] The "Sending messages is coming soon" footer goes away with the composer (phase 5).
- [~] A jump from the Notifications tab sometimes left the Servers chat panel stuck shut (taps queued, swipe off) until a tab round trip. `useTabSelected` missed tab changes made by `navigate('main', { screen })`: `useNavigationState` re-read the stored state before it committed. Now follows the navigator's `state` event. *Verify on device*, then remove the `DIAG` / `PanelsDiag` logging.
- [ ] A back gesture with nothing left to close finishes `MainActivity` (`wm_finish_activity app-request`, 2026-11-17). Reopening remounts the whole React tree and ends and restarts the session in the same JS runtime. Check what the reference does at the root (move the task to back?).

---

## Known issues and caveats (current state, 2026-11-13)
- [ ] Native ReactionsView (forum card chip) built but untested on a device: check chip taps do not also open the card, and the card height does not jump.
- [ ] Forum post action bar is a native chat row (`ChatRow.PostActions`, `PostActionsRow.kt`) under the first message, pinned over the list's top once scrolled past (`postActionsPinned`), and only pinned while history lacks the first message. Built 2026-11-19, untested on device: check the hand-off between the row and the pinned copy, and that taps on the pinned copy don't reach the rows under it. Our departures: the JS bar's icon buttons and padding instead of ForumPostActionBarView's labelled Follow/Share buttons, no share prompt, the pinned copy has no gradient (useGradientTop).

### Loading states
- [x] **Skeleton UI**: placeholder rows while the cache restores at startup (guild bar, channel list, DM list) and while a chat's messages load (the reference has shimmering placeholder messages; check `discord_app` for its loading/placeholder rows and match them). In the chat, render them natively as `ChatRow.Loading`-style rows so they cost nothing to swap out.

### Platform ripple in Compose
- [-] Native Compose surfaces (chat, pins, search, preview, viewer) draw their own ripple (`ChatRipple.kt`). With material-ripple, the first press on each of the 5 ripple hosts froze in place in screens pushed on the native stack. Root cause not found. Fresh hosts were attached and drawn on a hardware canvas.

### Chat scrolling
- [x] Long jumps: Telegram-style animate → jump → decelerate (`ChatScroll.kt` `scrollToRow`). Short ones animate fully. Feel-test on device.

### Chat performance
- [ ] **ChatView lag: media pass done, not yet measured on device.** Done:
  - Unchanged rows keep their instance (`ChatView.updateRows`); chat model classes are marked stable in `android/app/compose-stability.conf`, so unchanged parts of an edited message skip too.
  - GIFVs: `Gifv.kt` pools at most 3 ExoPlayers (reused, light LoadControl, no audio, 64 MB `SimpleCache`); a tile plays only when at least half visible, the list is idle and 150 ms passed. Poster stays under the video until the first frame.
  - Images: rows carry plain proxy URLs; `ImageLoading.kt` (`ProxyImage` + Coil `Mapper`) requests the smallest WebP covering the laid-out tile (never upscaled; animated GIFs capped at 640 px). Loader: 25% memory, 256 MB disk, no crossfade.
  - Spoilers use a 24 px stretched copy instead of `Modifier.blur` (check it doesn't look too blocky: `SPOILER_PIXELS`).
  - `ChatView.requestLayout` coalesces to one measure per frame.
  - Slow flings stuttered (2026-11-16, A06): the posted `measureAndLayout` laid out only the ComposeView, so `ChatView`'s own layout request was never cleared. Android then stopped passing Compose's requests up, and `AndroidComposeView` kept waiting for a layout pass instead of invalidating. A fling with no new rows reached the screen on 1 frame in 3–8 (60–90 px jumps). The runnable now also calls `layout()` on `ChatView` (React Native's native-view pattern). Confirmed on the A06.
  - Reply previews draw the replied-to text as spans (`ReplyRow.spans`, `buildRows.replySpans`: mentions, emoji, links styled, one line, quotes/code/line breaks flattened like the reference's inline reply rules), through the span builder shared with the message body (`buildSpanText` in `MessageText.kt`).
  Still open:
  - **Baseline profile.** A Perfetto trace of the release build (2026-11-13) spent 2.4 s JIT-compiling; the first chat opens cost 170–250 ms on the UI thread versus 45–80 ms once warm. Sideloaded release builds get no cloud profile. Generate one with a Macrobenchmark `BaselineProfileRule` run on the emulator (startup, open a chat, scroll it, swipe panels), ship it as `baseline-prof.txt` with `androidx.profileinstaller`. The release build is already `profileable` (manifest) for tracing.
  - Coil disk cache lock contention: ~10 coroutine threads waited up to 100 ms on `DiskLruCache.get` in the same trace (delays images, not frames). Consider a smaller fetcher/decoder parallelism.
  - Three image stacks are loaded (Fresco via RN `Image`, Glide via expo-image, Coil in the chat); consolidating would cut memory and startup.
  - `ChatPanel` still rebuilds *all* rows in JS whenever the whole `users` / `members` / `channels` maps change (presence, member chunks). Native now parses only changed lines (`serializeRows` one row per line, `parseRows(json, previous)` line cache in `ChatRows.kt`). Built 2026-11-15, untested on device. Narrow the deps or build rows per message.
  - Mention and add-reaction icons are decoded once per process (`cachedPainter`); `animateItem` removed from rows; reply spine path cached (`drawWithCache`). Built 2026-11-15, untested on device.
  - Traces of sideloaded builds run Compose JIT-only (1282 baseline compiles in a 17 s trace). Run `adb shell cmd package compile -f -m speed-profile me.palmdevs.isocord` after one launch before tracing.
  - GIFs don't start while a finger is down (`isScrollInProgress` is true during a drag).
  - `player.release()` for user-started video/audio still blocks the main thread (rare).
  - An unproxied Tenor GIF poster animates under its video (rare).
  - No loading placeholder/blurhash for tiles; avatar decorations still request `size=256`.
  - Timing logs to read, then remove or gate: `[chat] rows: … ms` (ReactNativeJS) and `IsocordChat` (native).
  - Remaining deadline misses while scrolling (A06 trace, 2026-11-16; 20 of 752 frames, plus 126 buffer-stuffed after them): a `rows` prop update mid-scroll costs 9 ms on the UI thread (`chat:rows` 6 ms of it). Composing and measuring incoming rows takes 4–7 ms (urgent prefetch up to 9.5 ms, text measure). RenderThread `Drawing` averages 5.6 ms per frame (up to 11 ms). Each touch MOVE takes 2–3 ms to dispatch (RN `TouchesHelper` + Compose).
- [ ] Reactions and component buttons are drawn natively with hand-copied Mana values. Decided to keep them native for now (the reference is native too); consider passing Mana sizes/text styles through the chat theme JSON so JS and Compose can't drift.

- [x] Messages tab previews draw the message as spans (emoji, mentions, inline markup) like ChannelRowPreview's MessagePreviewMarkup, through `IsocordSpanTextView` (`chat/SpanTextView.kt`, the shared `SpanText` composable). Labels and the trailing media icon (`messagePreview.ts`, copied from `useFormattedMessagePreview`) go through the same view, and the thread card shares it. Built 2026-11-18, **untested on device**.
  - [ ] Measure the cold open of the Messages tab and fling through the list (`dumpsys gfxinfo` framestats) against the plain-text version: one ComposeView per visible row.
  - [x] Channel topics with markup (`ChannelTopic.tsx`): `onContentHeight` (with `truncated`), `onLinkPress`. Springs between the clamped and full height (SPRING_CHANNEL_DETAILS, full height from a hidden unclamped copy like the reference). Taps off a link go to a `RipplePressable` (platform ripple; the reference fades its opacity), links stay native (`NativeGestureUtil` cancels the JS press). The details slide-in waits for the topic's height (`useDetailsPanel.startSlide`, 400 ms fallback). Built 2026-11-18, **untested on device**.
  - [ ] Embed title/description markup in previews uses the plain title, not the reference's `rawTitle`; call previews don't colour the text green when ongoing; thread card icon sits right of a 2-line preview.

### Chat rendering leftovers
- [x] `ForwardView` draws the forwarded attachments and embeds with the chat's `AttachmentList`/`EmbedView`; their media opens in the viewer (`forward-media` links).
- [ ] Message component buttons: semibold label per ButtonComponentView; 14sp size still not confirmed.
- [x] Reply tap → jump to message; `isocord://channel/…/<messageId>` jumps.
- [ ] `wave` links are ignored (no write path yet).
- [ ] `:shortcode:` emoji table (needs a decision on the data source).

### Design system
- [ ] Tabs / SegmentedControl paging (`Pages.tsx`, `react-native-pager-view@10`) is untested on device: swipe, fling, tap-to-jump across unmounted pages, lazy mounting.
- [ ] `Pages.tsx` passes `onPageScroll` as `never` (Reanimated handler vs codegen event type).
- [ ] Large SegmentedControl: indicator dragging is disabled while attached to pages.
- [ ] `onSetActiveIndex` no longer fires when re-selecting the active index (behaviour change; no callers rely on it).
- [ ] SegmentedControl last-item alignment, TagListInput chip alignment and AlertModal spring were fixed but not checked on device. TagListInput icon colour differs (`INPUT_ICON_DEFAULT` vs reference `interactive-text-default`).
- [ ] AlertModal backdrop still uses a plain fade (reference only defines the card springs).
- [ ] `CodeInput` should replace the MFA input in `Mfa.tsx`.
- [ ] Motion: every animation config is in `src/design/tokens/motion.ts` (reference presets + per-component constants). The native Kotlin chat (`SwipeToReply.kt`, `ChatScroll.kt`, spoilers, skeleton) still keeps its own durations. Changed on 2026-11-14, not checked on device: action sheet spring now matches `ACTION_SHEET_SPRING_CONFIG` (damping 17, was 20); the keyboard panel uses 250 ms out-exp (was 450 ms); popovers and tooltips exit on their spring (was a 120 ms fade); toasts use the reference's 300 ms linear timing (was `MODAL_SPRING`).
- [ ] Toasts: cards behind the front one hide their content, which fades in with the front card's drag. The reference shows one toast at a time; the stack and swipe-to-dismiss are ours.
- [ ] IconButton / ToggleIconButton ported (gallery: Icon Button). `ImageButton` not ported. Used by the composer's media row (Photos/Camera/Files: secondary, lg, labelled; the reference's media keyboard bar uses plain Pressables there). Attachment tile chips (spoiler/edit/remove) stay custom: three 32px buttons don't fit a 96px tile. The composer's plus (ToggleIconButton, icon-only, turns into an x) and expression button use it (`ComposerIconButton`); the send button uses `Button` (icon-only, 36 dp brand square via `buttonStyle`; the reference uses ChatInputActionButton). Other candidates: NavigatorHeader back/close, SearchField/Input clear, voice controls (toggle).
- [ ] Gallery: index + one page per component, modelled on `UserSettingsDesignSystem*`. Missing pages: Button Action Sheet, AI Loader, AI Shimmer, Shadows, Haptics, Background Blur View, Experimental Buttons, Legacy Button, Modal/Backdrop. Only Button and Text Input have prop toggles; the reference pages have many more.

### UI consistency leftovers
- [ ] Messages and You tabs pad the top inset by hand instead of using `NavigatorHeader`.
- [ ] `Pile` `cutoutColor` defaults to `BACKGROUND_BASE_LOW`; callers on LOWER must pass it.
- [ ] `AuthFormView` and `Modal` default to `BACKGROUND_BASE_LOW` (possibly intended).
- [ ] Raw spacing numbers in non-theme `StyleSheet.create` blocks (Button, Badge, Sheet, Checkbox, SegmentedControl, TableControlRows, ButtonGroup, gallery Layout).

### Patches and dependencies
- Unistyles 3.8.1 is patched (top inset in multi-window). Drop the patch when upstream fixes it; re-check on upgrade.
- OkHttp is held at 4.11.0, the version in the official 353.11 APK (TLS handshake). Re-check when moving to a newer reference build, together with `CLIENT` and `IsocordNetwork.USER_AGENT`.

### Network fidelity (stock client match)
- [ ] 401 `MFA_REQUIRED` (60003): the reference opens an MFA modal and retries with `X-Discord-MFA-Authorization`; we only reject the request.
- [ ] Message send body lacks `mobile_network_type` and `signal_strength` (MessageQueue `handleSend`), and the `X-Context-Properties` location.
- [ ] MessageQueue requeues a send after a body-less 429 with Retry-After; ours fails it.
- [ ] `launch_signature` (libdiscore, native) is unverified: the nanosecond timestamp is a guess.
- [ ] `/experiments` `X-Context-Properties` location is assumed `/` (getFingerprintLocation with the router at its initial path). Confirm.
- [ ] Super property key order for `device_model_name` and `install_source` is unverified: the datamine (350.2.3) predates them.
- [ ] IDENTIFY always takes the non-fast-connect path (`is_fast_connect: false`); the reference fast-connects natively on cold start with an empty `client_state`.
- [ ] Measure zstd (fzstd) decode time of READY on device against the old zlib path.
- [ ] Refresh the phone list new accounts claim (`src/core/api/devices.ts`) as models age, and raise the SDK cap past 36 once Android 17 is common.
- [ ] No analytics (`/science`) are sent; the reference sends many. Decide whether silence or fakes is the lesser signal.

---

## User added TODOs

- [ ] Channel welcome row should have channel topic text.
- [ ] ChannelList item on threads/posts should have spline excluded from the interactable/highlight area.
- [ ] Right chevron in channel bar in chat panel after the channel name to indicate the area is interactable and opens the channel details.
- [ ] Don't show wave to say hi button in channels where the user doesn't have permission to send messages.
- [ ] Component gallery's Tooltips page doesn't do anything (low priority, only when tooltips are actually needed).
- [ ] Tab swiper unmounts/unrenders pages too quickly when exiting a screen.
- [ ] Group DM avatar pile
- [ ] Create DM FAB
- [x] Forward messages and share from other apps, one screen (`src/features/share/`, 2026-11-18): ForwardModal and ShareScreen. Built and installed on the emulator, **not yet tried by hand**.
  - Long-press "Forward" row before Reply (`canForwardMessage`: forwardable types and flags, no poll/call/activity, READ_MESSAGE_HISTORY outside DMs, no FORWARDING_DISABLED). Opens the `share` root screen through `openShare`.
  - Share intents: `SEND`/`SEND_MULTIPLE` `*/*` on MainActivity (`share/SharedContent.kt`, ShareProps.createShareProps: EXTRA_TEXT, EXTRA_STREAM with name and type, read grant kept), handed to JS by `IsocordShare` (`takeShared` + `onShared`), opened from MainTabs. A share made while logged out opens after login.
  - Header "Forward To" / "Share to", "Maximum 5 places at once." as a warning subtitle, Copy Message Link (LinkIcon) for a forward. Search field, then TableCheckboxRows (guild icon + channel + server name, DM avatar + username, group DM icon). At most 5 picks; rows a payload can't go to are disabled with the reason (attachments, embeds, voice messages).
  - Before a search: picks pinned on top, then unread mentions, then newest message, 15 rows (the reference uses quick switcher history + frecency). Search matches channel and DM names (and usernames) over server names, prefix over substring, then all words across both; newest first within a rank.
  - The chat's own Composer in a new `attached` mode (ComposerProvider): own draft (`forward.<channel>`, ForwardContextMessage; `share`), no typing, reply/edit or plus button, placeholder "Add an optional message...", send live once a place is picked. The forwarded message is a composer `above` panel (`SharePreviewPanel`: quote bar beside the message as the chat draws it, through `StaticMessage`, cut with a fade past 160 dp) with the slowmode warning. A share's text starts in the input and its files sit in the composer's attachment strip (spoiler and alt text editable).
  - Sending: forwards go to every place at once (message_reference type FORWARD, `@silent` honoured), then the text as its own message, skipped where slowmode holds the user. Shares upload a copy of the files per place and send text + files as one message. One place opens its chat; "Message forwarded!" toast. Failures keep only the failed places picked, with a "Forward Failed"/"Share Failed" toast (the reference shows an alert listing them).
  - Departures: one screen in the main activity (the reference shares from its own activity); the composer's send square instead of a "Send (N)" button; BACKGROUND_BASE_LOWER for both; guild icons without the channel-type badge; the forwarded message shows its author, files and embeds (the reference's ForwardPreview is text, a file summary and a thumbnail); each share or forward opens a fresh screen, an unreadable shared file is left out.
  - [ ] Not done: DMs with friends who have no DM channel yet (`includeMissingDMs`); the shared link's embed preview (`useFetchShareEmbed`, ShareEmbed); Direct Share shortcuts (chooser targets, `targetUserId`/`targetChannelId`); age-restricted and external-sticker checks; quick switcher prefixes (`@`, `#`, `!`, `*`) are stripped, not modes; the "You can only upload 10 files" warning (extra files are rejected with the uploader's toast).
  - [ ] A forward's composer reads the origin channel for emoji and mentions; the reference uses the first picked place (`useSelectedDestinationChannel`).
  - [ ] An image pasted into a forward's input lands in its file list and is never sent (dropped when the screen closes).
  - [ ] Shares skip the slowmode check that forwards get; the sticker tab still shows in attached mode (a sticker is refused with a toast).
- [ ] `MessageFlag.CROSSPOSTED` in `core/discord/messages.ts` is `1 << 1`, which is IS_CROSSPOST; CROSSPOSTED is `1 << 0` (Constants MessageFlags). Used by the publish row.
- [x] Bundled Twemoji 17 (`assets/twemoji`, `scripts/fetch-twemoji.sh`), used the same way everywhere. Installed and starts on the emulator; rendering not looked at yet.
  - Standalone emoji are the 72px PNGs, as in the reference: chat message text, reactions, polls, components, role icons, pickers, sheets.
  - All other text uses `Twemoji.ttf` (CBDT, 72px) as the first fallback behind the app fonts (`TwemojiFonts.kt`): React Native `Text` and `TextInput`, Compose, the composer. Needs Android 10 (`Typeface.CustomFallbackBuilder`); Android 7–9 keep the system emoji there.
  - The font follows the parser: text-presentation symbols (▶, ✔, ♥, digits) stay text unless followed by U+FE0F; minimally-qualified ZWJ sequences (`👁‍🗨`) aren't Twemoji in either.
  - `@twemoji/parser` is pinned to 17.0.1: 17.0.2 stops matching text-default modifier bases (✌️, ☝️, ✍️, ⛹️ and their skin tones).
  - `TwemojiFonts.REACT_FAMILIES` lists the families React Native uses; a family added to the tokens needs adding there, or it gets the system emoji.
  - The fonts are decoded at startup (Twemoji.ttf is 4.4 MB, compressed in the APK); check the startup cost in a trace.
  - Jumbo emoji (48sp) and the emoji info sheet upscale the 72px art and may look soft.
  - Emoji 17 renders, but the picker data (`unicode-emojis.json`, from the reference APK) stops at Emoji 16 until Discord's data adds it.
- [ ] Blocked/ignored messages row (collapsed "N blocked messages" row as in the reference).
- [ ] Support more message types (see "System messages" and "Attachments and embeds").
- [ ] Emoji/sticker info (complete version)

### Device test findings (2026-11-14), in progress
- [x] Members don't load in some channels (posts, threads, some text channels). The list id now follows PermissionUtils.canEveryone (any overwrite denying View Channel gives a hashed list); threads use their own list. (untested on device)
- [x] Threads/posts reuse the parent's members instead of their own. `thread_member_lists` + THREAD_MEMBER_LIST_UPDATE / THREAD_MEMBERS_UPDATE, `ThreadMemberList.tsx` (ThreadChannelUserList); announcement threads show the parent's list as in the reference. (untested on device)
- [x] Cache guild member profile overrides (server avatar, banner, bio, nick). The members store is cached (authors of the cached messages) and kept over READY, re-requested once; banner/bio/pronouns kept when an object carries them. No profile fetch yet (`/users/{id}/profile?guild_id`). (untested on device)
- [x] Member list placeholder should include role names. Group headers come from the counts (ChannelMemberStore.setGroups), so unloaded ranges show their role headers. (untested on device)
- [x] Defer the chat view until the server switch is done (it delays the switch). `ChatPanels` builds a newly selected channel's offscreen chat on idle while closed (`builtChannelId`); an open chat or a tap builds at once. A swipe within that idle window shows the previous chat. Untested on device.
- [x] Files & Links: recycled cells briefly show stale images. (untested on device)
- [x] Jank opening channel details. `ChatPanels` calls `prefetchMemberList` when the chat opens. Tabs that aren't selected mount 10 ms after the selected one (`SearchTabsPage`). The 107 ms / 774 ms draws in the 2026-11-15 traces were react-native-svg StatusAvatars (software-rendered per invalidation); every StatusAvatar caller now passes `cutoutBackground` (reference `SolidCutoutOverlay`). Built 2026-11-15, untested on device.
- [x] Media tab scroll jank: `memory-disk` cache, images requested at device scale with cover dimensions (`SearchMediaImage`), cells keep their item across pages (`getMedia` WeakMap). Built 2026-11-15, untested on device.
- [x] Animated guild banner paused while the chat or details cover the server list (`listCovered`); fully covered panels drawn at opacity 0 while at rest (`dragging`). Built 2026-11-15, untested on device.
- [x] Scrolling far in the Members tab janked every tab until the details closed. FlashList's recycle pool (unbounded by default) kept scrolled-past placeholder cells mounted, each pulsing every frame, and every list update re-rendered all mounted cells (`extraData={list.version}`). `GuildMemberList` now passes `maxItemsInRecyclePool={0}` and renders from the row objects (`data={rows}`, renderItem depending only on the groups); skeletons in a tab that is not selected pause (`SkeletonPausedContext` in `SearchTabsLayout`). Built 2026-11-15, untested on device.
  - Same fix in the other tabs, not compiled yet: loading placeholders get their own keyed `FlashList` (FlashList reads `maxItemsInRecyclePool` only on mount, and a list reused for results kept its placeholders pulsing in the pool) in `GuildMemberList`, `ThreadMemberList`, `GuildMemberSearch` and `ResultList` (media, pins, links, files). `ThreadMemberList` selects only its members' users, members and online flags (`useShallow`) instead of the whole `users` and `presences` maps.
  - Not done: `GuildMemberSearch` (whole `users` map, re-matches every guild member on any user update), `DmMemberList`, Recent (`dms.ts`) and Channels (`useGuildChannelResults`) still subscribe to whole maps.
- [ ] Each member placeholder row runs its own SkeletonPulse; one shared pulse would be cheaper.
- [x] A quick back gesture in the chat (e.g. to close the expression keyboard) can swipe the panel and then trigger back, leaving the app. `ChatPanels` pan: a canceled drag (system took the touch) snaps back, and composers are dismissed only when a drag commits (the IME now stays up during the drag). Untested on device.
- [x] Selecting a server with no selected channel should pick its preferred first channel (as Discord does). `defaultChannelId` (GuildChannelStore.getDefaultChannel: first text/announcement channel by raw position the user can view), applied and remembered in `ServersPanels`. Forum/media still left out of the default channel. Untested on device.
- [x] Finish the reactions sheet (sticky emoji carousel, infinite scroll). (untested on device)
- [x] A screen pushed over the tabs (Channels & Roles, say) no longer closes the tab's chat panel: tabs report being selected (`useTabSelected`), not focused. Untested on device.
- [x] Channel rows dim only for the channel's own mute (BaseChannelListChannel.isMuted). A muted server or category no longer dims all its channels and hides their unread dots. Untested on device.
- [x] The selected channel always shows in the channel list: an unjoined thread or post (held by `holdThread`) goes first under its parent (ChannelListState computeThreadIds), and a collapsed category keeps that parent. In opt-in servers the selected channel shows even when not picked. Untested on device.
- [x] No "new messages" divider when already at the bottom (+32dp) and the message arrived after (auto-read, always for own messages). The NEW divider moves above a message that arrives while scrolled away or not visible, when nothing was unread (ReadStateStore MESSAGE_CREATE). Built 2026-11-15, untested on device.
- [x] Mark unread moves the NEW divider at once (manual MESSAGE_ACK). Built 2026-11-15, untested on device.
- [x] Server unread dot ignores channels left out of an opt-in channel list (Customize Community / Browse Channels); their mentions still count, threads are exempt (GuildReadStateStore). Built 2026-11-17, untested on device.
- [x] Opening a chat with unread mentions scrolls to the first unread mention (`mentionsUser`, shared with the mention highlight), loading around the read marker when needed; the ack waits until the jump settles. Without mentions it opens at the bottom and is acked, like the reference (`useScrollHandlers` → UPDATE_CHANNEL_DIMENSIONS). Built 2026-11-15, untested on device.
  - [ ] The mention jump skips mentions between the around-marker window and the newest page.
  - [ ] Confirm DCDChatList emits the first scroll event that acks a channel opened at the bottom.
- [x] Sending doesn't auto-scroll until the new message is fully hidden by the composer. (untested on device)
- [x] Message enter animations: `RowMotion` node driven by frame time (can't freeze part-grown; snaps to the end if detached), height 200 ms FastOutSlowIn, fade 400 ms; a sent message keeps its pending row's list item (`lazyKey` alias). The reference sets no item animator; the timings are ours. Built 2026-11-15, untested on device.
- [x] Exit animation for messages deleted on screen (`ChatRowChanges`): fade 150 ms, collapse 200 ms, only when the update adds nothing else; pending → sent never exits. Deleting the newest message no longer snaps a scrolled-up list to the bottom. Built 2026-11-15, untested on device.
- [x] Reactions in a message row have 4 dp above and below. Built 2026-11-15, untested on device.
- [x] Reply headers to attachment-only messages use Mana's ImageIcon (`ic_image.png`) instead of a hand-drawn glyph. Built 2026-11-15, untested on device.
- [x] The composer's scrim gradient rises with the rows above the card (media row, attachments) until it ends at their top, so they sit on solid background. Deliberately differs from the reference (fixed 56 dp gradient). Built 2026-11-15, untested on device.
- [x] Forward header uses ArrowAngleRightUpIcon (`ic_forward.png`), 16 dp icon + 4 dp + 14 sp label (forward_header_view). Label style (italic medium) not checked against the reference. Built 2026-11-15, untested on device.
- [x] Forwarded message: the footer opens the source channel in a second chat panel stacked over the chat (swipe right or back closes it) and jumps to the message (`isocord://forward`). One level only; a forward inside it replaces it. Built 2026-11-15, untested on device.
- [x] Composer bobs down and up when switching from the IME to the expression keyboard. (untested on device)
- [x] Show the selected tone in the tone picker button. (untested on device)
- [x] Add reaction picker sheet has the skin tone toggle and the category rail, like the expression picker's Emoji tab. Built 2026-11-15, untested on device.
- [x] Custom emojis that share a name insert and send as the right one: the picker and suggestions insert `:name~N:` (the reference's `EmojiDisambiguations`) and `resolveEmoji` looks the disambiguated name up in `listEmojis`, sending `<:name:id>` with the real name. Fixed 2026-11-16, untested on device.
- [ ] Native expression grid (`IsocordExpressionGridView`: `src/native/ExpressionGridViewNativeComponent.ts`, `picker/ExpressionGrid.tsx`, `android/.../expressions/`) for the emoji and sticker grids, the reaction picker included. Rows are one Compose node each, drawing every item's image (Telegram-style); copied from the reference's EmojiPickerView: an oval `BACKGROUND_MOD_MUTED` placeholder until an image fades in (100ms), no new loads while flinging faster than 8000px/s, animated emojis paused while scrolling (300ms idle), `lock_overlay` (20% black and a 16dp lock) on locked items instead of dimming them, non-sticky 16sp headers. Both grids use 12dp sides like the search bar, items spread `space-between` (at least 11dp apart for emojis, 8dp for stickers), and headers sit 12dp below the images above and 8dp above the ones below; these are our own values, since the reference centres emojis in fixed cells and uses 14sp sticker headers. Holding an item opens the WIP emoji info sheet or a new WIP sticker sheet (`stickerInfoSheet.tsx`: image, name, pack or server). Built 2026-11-16 and installed on the emulator; not looked at yet. Open: whether the sheet drag works over the Compose list (else the reference's `scrollingEnabled` command); press feedback is a fading highlight on the cell, not an expanding ripple; accessibility is an empty semantics node per item (name, button role, tap and hold actions) and headings on the headers, not checked with TalkBack or Switch Access; sticker placeholder is a rounded square (reference unknown).
- [x] Mentions with icons have no highlight background behind the icon. (untested on device)
- [x] Tap an emoji to open its info (temporary sheet). (untested on device)
- [x] Editing occasionally sends a new message (not reproduced). (untested on device)
- [x] While editing, disable send until the content changes. Deliberately differs from the reference (which keeps send enabled and closes an unchanged edit): `SendButton` compares the serialized content like `send`; Enter on an unchanged edit still closes it. Slowmode no longer blocks an edit. (untested on device)

### Fixes (2026-11-15), built, untested on device
- [x] Channel mentions and message links open the channel in a panel stacked over the chat, scrolled to the message (handleMessagesTapChannel / navigateToChannel, `navigationReplace: false`); the same channel jumps in place. Search results and message previews still open the channel in its tab.
- [ ] The stacked chat is one level deep: a link inside it switches it in place, where the reference pushes another channel screen.
- [~] Channel details: the header folded twice when dismissing search (channels without a topic). Copied the reference's `onLayout` guard (> PX_8, 0.001 tolerance); the root cause is unconfirmed. If it persists, suspect the forced React render when the 100 ms fade settles mid-spring.
- [x] Edit text is kept per channel across chat, tab and panel switches (in memory, like EditMessageStore `textValue`); the edit ends when its message is deleted. Deliberately differs from the mobile reference, which shows the original text again.
- [ ] Edits aren't ended by MESSAGE_DELETE_BULK (nor in the reference); a panel's last-frame keystrokes are lost on unmount (drafts too).
- [x] Mention autocomplete asks the gateway for members (REQUEST_GUILD_MEMBERS, limit 10, GuildUtils.requestMembers) and matches nickname, display name and username (queryChannelUsers / queryMentionResults); roles show when mentionable or with Mention Everyone.
- [x] Roles without a colour use the default text colour in the autocomplete.
- [x] Mention and `:emoji` autocomplete lists animate their height (useAutocompleteAnimatedHeightStyles, TIMING_STANDARD). The target height is computed from the rows (AutocompleteWrapper: rows × 48, section titles, sticker row, hairline), not measured: `onLayout` fired several times or not at all, which made it slow or stuck.
- [ ] Emoji suggestion bar: report its height so the chat makes room (EmojiSuggestionBarSmall `onOccupiedHeightChange`).
- [ ] Mention autocomplete: filter out pending members and members who left (isValidGuildMember; needs `joined_at`/`pending` on Member and a CACHE_VERSION bump), StringUtils.normalize (confusable characters), friend nicknames in DMs.
- [x] Missing message chunks after backgrounding: the newest-page refetch replaces the list, keeping only newer and pending messages (ChannelMessages.loadComplete); stale refreshes that failed or hung are retried on READY/RESUMED.
- [x] Member list not fetched after a reconnect or guild outage: subscriptions are sent only on an established session and sent again on RESUMED and GUILD_CREATE (GuildSubscriptionsStore.handleConnectionOpenOrResumed).
- [x] Members tab stuck at placeholders on a cold start into the last channel (headers and counts came, rows didn't): the server sometimes never sent the first SYNC when the same channel subscription arrived twice while the guild was still loading after READY (once from READY, again on GUILD_CREATE). Subscriptions now go through one queue (`memberList.ts`, GuildSubscriptions `_enqueue` + `DelayedCall(0)` flush): what is asked for a guild in one tick (`typing`/`activities`/`threads` via `subscribeToGuild`, `channels`, `thread_member_lists`) is one GUILD_SUBSCRIPTIONS_BULK, and a reconnect resends each guild's whole state in one message. `ChatPanel` calls `subscribeToGuild` (once per guild) instead of sending its own. GUILD_CREATE resubscribes only guilds back from an outage (GUILD_DELETE `unavailable`). Seen working on the emulator 2026-11-16.
  - [ ] Once a list's rows are lost (no SYNC, or INVALIDATE), nothing asks for them again: `prefetchMemberList` and `subscribeMemberList` skip a channel already held with the same ranges.
- [ ] REST requests have no timeout, so a request on a connection that died in the background can hang forever (`rest.ts`).
- [ ] Gateway emitter: a throwing dispatch listener skips the rest; isolate them or reset the socket like `resetSocketOnDispatchError`.
- [x] Gateway: missed reactions after backgrounding, not corrected until relaunch. Every heartbeat is now a QoS heartbeat (op 40, `{ver: 31, active, reasons: ['foregrounded']}`, SessionHeartbeatScheduler); before, the server heard the active state only at IDENTIFY. On foreground a pending reconnect happens now (`resetBackoff`), and an open session gets an expedited heartbeat that reconnects (and resumes, replaying what was missed) if unacked in 5 s. The reference only expedites on notification taps. Built 2026-11-16, untested on device; the root cause (half-open socket vs. events withheld from an inactive session) is unconfirmed.
- [ ] Gateway: no expedited heartbeat or backoff reset on network change, so a half-open socket after a network switch takes up to two heartbeat intervals to notice.
- [x] `Button`: animatable icon (`iconStyle`, BaseTextButton), icon-only (no `text`), `buttonStyle` override of the pill. The composer's send button uses it.
- [x] Composer didn't always scroll to a new line. React Native ignores the EditText's layout requests, and TextView.bringPointIntoView waits for a layout, so at max height the scroll never happened. `ChatInputView` now lays the EditText out itself when its height won't change, and fits the scroll to the cursor whenever the field is resized (the height animation could leave the top line scrolled away).
- [x] "(edited)" was missing when a message ended in a code block; it now goes on its own line below the block. With no text at all (attachments only), the label still isn't shown.
- [ ] Send button: no pressed colour blend (static brand background over Button's animated colour), no ripple (Button has none; the reference scales), ChatInputActionButtonTransitionItem bounce not ported.

### Fixes (2026-11-16), built, not installed or seen on a device
- [x] Category rail (expression picker, add-reaction sheet): its system bar inset shrinks with the keyboard (`keyboard.progress`), so the rail sits right on the keyboard while searching. In the composer panel the keyboard still covers the rail and the grid's bottom while its search has focus.
- [x] DMs search: 12 between the search bar and the tabs (was the reference's 16), as under the channel details' search bar.
- [~] Search filters (`src/features/search/filters`): a bar of filter chips in up to three rows (horizontal masonry, shortest row first, scrolling sideways) riding on the keyboard (`KeyboardStickyView`) in the DMs search and the channel details' search. Toggles (pinned, mentionsEveryone, nsfw) switch in place; the others open a picker over the tabs, which stay mounted, with the bar's text searching the picker (the query's text comes back when it closes, back closes it first). Filters are tags in the search bar with an X to remove (`TagListInput`, tag text can be any node). Covers the reference's from, mentions, has, in, on, before, after, authorType and pinned, plus repliedTo, repliedToMessage, mentionsRole, mentionsEveryone, linkHost, fileName, fileType, embedType, embedProvider, command (application command index), nsfw, slop and sort. Built 2026-11-17, **not yet looked at on a device**.
  - [ ] English text written by us (no Discord copy exists): the new filter keys and hints, the bar's "Message Search Filters" header, Exclude, the invalid value line, the date hint, Oldest, Most relevant, previous and next month.
  - A guild channel's search starts with a removable `in: channel` scope tag (`implicit`, still the initial tabs); removing it searches the whole server. The server header's search starts on the whole server, as the reference's does. Channels named with `in` are sent with `include_nsfw`; the `nsfw` filter covers a whole-server search.
  - With a filter of its own (not the scope tag) only the Messages tab shows and is fetched (`FILTERED_TABS`; the reference keeps every tab).
  - Tapping a filter tag (not a toggle) opens its picker with the current value. The pick replaces the tag in place, while closing the picker keeps the old one (`useSearchInput.edit`). Departs from the reference, whose tags only come off. Built 2026-11-19, not yet looked at on a device.
  - [ ] A DM's search has no scope tag: removing it would mean switching to the all-DMs search.
  - [ ] No clear button in the search bar any more (`TagListInput` has none).
  - Typed filters: a word that starts a filter key shows the matching filters in a card under the field (`FilterSuggestions`; the reference only suggests a full key). Typing `key:` opens its picker; a paste or Enter turns every `key:value` (quoted values too) into tags (`parse.ts`, `resolve.ts`). Values: ids (known or not), user, channel and role names, option names with `-` to exclude, `YYYY-MM-DD`/today/yesterday, `true` for toggles. A value that names nothing opens its picker searching for it. Pickers offer a pasted id as its own row; commands match an id in the index.
  - [ ] A typed name resolves only against users, channels and roles the client already has.
  - [ ] Dates are single days; the reference's typed shortcuts (week, month, year, month and weekday names) are not parsed.
- [x] Threads page empty state: the "Create Thread" button is centred (Button hugs to the start by default).
- [x] Tabs: items have 12 above the label (was 16).
- [x] Messages tab: 4 between the typing dots and the text (was 8 on top of the dots' own 6).
- [x] NavigatorHeader: the bar takes the status bar's room, so the pressable title's ripple fills the header up to the top of the screen.
- [x] Media viewer: More Options opens a ContextMenu by the button; a long press on the media still opens the action sheet (it has no anchor).
- [x] Autocomplete box: rows are pinned to its bottom, so they don't move while its height animates.
- [x] Chat list crash "Key "unread" was already used": messages aren't always strictly ordered by id (a sent message takes its server id where its pending copy was), so the read marker could fall between two pairs; `buildRows` now places the NEW divider once.
- [x] Reactions: 8dp above and below the reaction row in a message (was 4).
- [x] Notifications tab: server channel rows show "# channel • Server" (our own addition; `SearchRow.guildName`).
- [x] Composer backspace on a mention pill or custom emoji: a key event removed the whole node (TextUtils.getOffsetBefore skips a ReplacementSpan) but a soft keyboard's deleteSurroundingText / shortened composing text removed one character. `ChatInputView` now widens any user deletion that cuts into a `PillSpan` / `InlineImageSpan` to the whole node, and drops the composing span after.
- [x] Composer custom emoji that loaded after their span was set only showed after the next edit (invalidate() keeps the text's cached display lists); the span is set again on load.
- [x] Composer: typing the closing colon of `:sob:` turns it into 😭 (`typedShortcode` in `parse.ts`, `unicodeEmoji` composer slot). Our own addition; not found in the reference's ChatInput. Not inside code, not after a word character (`12:30:`).
- [x] Markdown headings: spacing per the reference's renderer (`kl.b.z0`, `HeadingContentNode`): 8dp before a heading after other content, 4dp before one that starts the message, 4dp after every heading (was 0 / 8 / 4 except after the last).
- [x] Swipe to reply/edit snapped the list down while the row was held: `SwipeToReply` took only sideways moves (`horizontalDrag`), so once the finger held still, a move with no sideways part reached the list unconsumed and it scrolled by all the vertical drift since the touch went down, at once (traced on a phone 2026-11-16: 15–145 px in one frame). It now takes every move of the claimed pointer (`drag`).
- [x] The reply or edit bar growing the composer no longer moves the messages while you read older ones: `ChatList` (`keepStillUnderComposer`) undoes the composer's part of the resize in the same measure pass (composer view found by `composerNativeId`, its height read while the list is measured); at the newest message the list follows so the newest stays in view. The keyboard and panels still push the list. `ChatView` sizes its Compose list just before drawing instead of during React Native's mount, which set the chat view's frame before the composer's. Our own behaviour; the reference was not checked for it. Not checked: attachments strip, rotation and split screen with the pre-draw sizing.

## Chat write path (phase 5)

- [ ] Composer: "Message #channel" input, `+` (attachments), gift, emoji, mic buttons as in the reference.
- [ ] Sending with nonces, optimistic messages, failed-message retry/delete.
- [ ] Replies (with mention toggle), edits, deletes.
- [ ] Attachments upload (with spoiler, alt text, description), voice messages.
- [ ] Emoji, sticker and GIF pickers.
  - [x] Sticker picker categories (pack rail / section jumps, like the emoji picker).
  - [x] GIF tab (`picker/GifPicker.tsx`, `expressions/gifs/`), built 2026-11-19 and installed on the emulator, **not yet looked at**. Categories page (Favorites, Trending GIFs, the providers' categories; a category searches its name), search (250ms debounce), Trending GIFs and Favorites pages with a back header. A GIF sends its link with the channel's reply (`sendGif`, handleSelectGIF) and tells its provider (`/gifs/select`, Tenor's registershare). Native grid `IsocordGifGridView` (`android/.../expressions/gifs/`): a Compose staggered grid, 2 columns (3 from 600dp), 8dp gutter, 12dp sides like the search bar, images loaded at tile size (none during a fast fling), paused while scrolling, 100ms fade over the placeholder.
    - Providers (the gif-providers plugin, not the reference): Klipy (Discord's `/gifs`, the default), Tenor and GIPHY, chosen in a sheet from the button by the search field (with a quality for Tenor/GIPHY), saved per device. Several at once are interleaved, deduped by link and badged with the provider; one that fails or takes over 10s is left out. GIPHY shows animated WebP when it has it.
    - Holding a GIF opens GIFPickerItemActionSheet (`picker/gifActionsSheet.tsx`): the GIF, Add to / Remove from Favorites, Insert in Chat Input (ours: puts the link in the composer and brings the keyboard back), Copy Link. Favorites are saved at once (`updateFavoriteGifs` in `stores/frecency.ts`, one PATCH of FavoriteGIFs at a time, hide_tooltip kept, refused over MAX_FAVORITE_GIFS_SIZE with the reference alert). Favorites page has the reference search button that turns into a field. Built 2026-11-19, installed on the emulator, **not yet looked at**; favouriting not tried against the account.
    - Differences: the store changes once the PATCH returns, not at once as the reference does; a failed save toasts the generic error. Favouriting a GIF from a message (media viewer) is not done.
    - Not done: search suggestions and trending search terms, the slowmode check before sending. A favorite whose media is a video stays a placeholder (no video tiles). The category tile's a11y label is the bare name, not "Category, {name}".
    - Strings not from Discord: the search placeholder joins provider names ("Search {providers}", after "Search Klipy"), the providers sheet and quality labels (the plugin's), "Could not send the GIF.", "Insert in Chat Input"
  - [ ] Compose views hosted under React Native (ExpressionGridView, GifGridView, SearchResultsView, MediaViewerView, MessagePreviewView, SpanTextView) each copy the same measure/layout and event plumbing; could share one base.
  - [ ] Picker scroll performance: better, still not smooth. Perfetto on R7AY60DPD2P (2026-11-13), 10 s of scrolling:
    - Before: 62% of frames missed the deadline, and animated-emoji decoding took 13 s of CPU.
    - After per-column cell keys and pausing animations while scrolling: 27% missed, 2.4 s decoding.
    - After that, also no grid re-render on scroll start/stop or on rail changes. Not re-traced.
    - What remains is the cost of one RN view per emoji:
      - RenderThread drawing about 4 s;
      - JS about 5 s;
      - mountViews about 1.6 s, with spikes up to 73 ms;
      - about 4k ExpoImage source swaps.
    - Real fix: a native grid. Discord ships `EmojiPickerNativeComponent`, a RecyclerView. Telegram-style is better still:
      - one custom-drawn View per row, not a view per emoji;
      - Unicode emoji from a bundled sprite sheet instead of per-emoji twemoji CDN loads;
      - animated emoji frames rendered on a background thread into one bitmap, with decoded frames cached;
      - decode at display size;
      - limit playing animations on low-end devices.
    - Cheaper levers first: pause animations during sheet drags; stop the JS `onScroll` round trip (UI-thread scroll handler).
- [ ] Mention / channel / emoji autocomplete, slash commands. The autocomplete and the emoji suggestion bar float over the chat in the floating composer (`Suggestions.tsx`: `AutocompleteWrapper` card above the accessories, `EmojiSuggestionBarSmall` right-aligned above the card, max 3 emojis). The `:name` autocomplete has the reference's EMOJIS_AND_STICKERS sections: "Stickers matching" with a horizontal sticker row, a hairline, "Emoji matching" with the emoji rows (3 on screen, scrolling). Not checked on device. Open: the autocomplete's animated height, locked (Nitro) emojis in the bar, `onOccupiedHeightChange` (the reference makes room in the chat for the bar), slash commands.
- [ ] Send typing (`POST /channels/:id/typing`).
- [x] Drafts per channel no longer get lost: offscreen chats restore into the input when it attaches, stale input events after a text replacement are dropped (`flushText` barrier), the last keystroke is kept on switch and edit start (`keepDraft`, `flushPendingDraftSave`), uploads keep text typed meanwhile, composers on the same channel sync (`onDraftSaved`), backgrounding flushes the pending save. Built 2026-11-15, untested on device.
- [x] Reactions add/remove (optimistic, from the long-press sheet). Tapping a reaction chip in chat is still TODO (see Interaction, under Chat: message rendering).
- [ ] Slowmode, permissions (no send, no attach), age-gated channels, rules screening.

---

## Shell: Servers tab

- [x] Guild header (`servers/GuildHeader.tsx`, reference `RedesignGuildHeader` + `ChannelListStickyHeader` + `GuildSearchAndInvite`): name with chevron, "N Members · Community" for community servers, Search / Invite / Events buttons, divider; banner (scrolls and fades, darkens on press, animated only when focused with no sheet open). The header is an overlay outside the list (`translateY = max(0, bannerHeight - scroll)`) instead of being counter-translated inside the scroll content, so it can't come unstuck. Built and installed on the emulator 2026-11-14, **not yet looked at on a device**.
  - [ ] The guild action sheet, invite and events are placeholder sheets (title only).
  - [ ] Search opens the selected channel's details, searching, with the tabs of the reference's server search (SEARCH_TYPE_TO_SEARCH_INITIAL_TABS GUILD: Recent, Members, Channels, Media, Pins, Links, Files) on the Recent tab (`openGuildSearch` in `ChatPanels`, `SearchTabsLayout` `guildSearch`), over the tab or the chat. Recent tab there: "Suggested" = the 3 text channels with the newest messages (useSuggestedChannelsData, without its smart search suggestions) and "Photos & Media"; no search history (the reference keys one per server but only the DMs search ever adds to it). Checked on a device: account settings apply. The reference opens a guild-wide search screen instead (`navigateToSearchWithPrefetch`, GUILD search context), so Messages / Media / Pins / Links / Files here only cover the selected channel. Does nothing in a server with no selected channel.
  - [ ] GuildBadgeV2 after the name (verified, partnered, boost level): needs the badge images.
  - [ ] Events button also shows for servers that have scheduled events (not stored yet; it only follows CREATE_EVENTS / MANAGE_EVENTS now, and the reference also checks MANAGE_EVENTS on voice channels). Unread-events dot ("New Events").
  - [ ] Dragging on the pinned header doesn't scroll the list (in the reference it is part of the scroll content). Dragging on the banner does.
  - [ ] Invite also shows for servers with a vanity URL the user can view invites for (`shouldRenderInvite`); invites-disabled state.
  - [ ] Client theme gradient behind the header (`ThemedGradient`), lurker "Join" button, favourites server variant, coachmarks.
- [ ] Channel rows: unread message previews where the reference shows them, voice channel participants, event / stage indicators.
- [ ] Status indicators are plain circles; use the reference's masked shapes for idle/dnd/offline/streaming/mobile.
- [~] Opt-in channels / Channels & Roles (`features/channelBrowser`, `channelList.ts`, `settingsActions.ts` setChannelOptIn / optIntoChannels, `stores/guildOnboarding.ts`; reference ChannelBrowser, ChannelsAndRolesModal, CustomizeCommunity, useBatchUpdateSelectOption, useBatchUpdateChannelSettings, OptInChannelsActionCreators, OptInOnboardingUtils, ChatBanner OptInChannelBanner). The row at the top of community servers' channel lists (GuildRolesAndChannelsRow, "Channels & Roles" where the server has questions, else "Browse Channels") and `<id:customize>` / `<id:browse>` links open the screen on that tab. The tabs swipe (SegmentedControlPages), and a divider separates the row from the channels (the guild actions section's footer Divider). Customize lists the onboarding questions (`GET /guilds/{id}/onboarding`) as table groups, radio rows for single-select ones, with a red star on required ones, which keep their last answer. An answer changes its channels and roles locally and the answers are saved together after 1 s (`PUT /guilds/{id}/onboarding-responses`, marking every question seen). All Channels is the browser: search, categories with "Follow Category", channels as TableCheckboxRows (topic or "Active …", disabled under a followed category, all checked while opt-in was never set up). Picks are saved together after 1 s and stay applied over gateway echoes (pending channel flags). Opt-in servers list only picked channels and categories, plus the selected channel and channels with mentions. The chat of an unpicked channel shows "This channel is not on your channel list." with "+ Add" when there's no new messages bar. Unpicked channels never notify (`GuildSettings.optedOut` in NotificationState.kt, allowNoMessages). Built and installed 2026-11-17, **not tested on a device** (no picks or answers saved yet).
  - [ ] Unpicked channels the list still shows sit in place; the reference moves them, unreads and recently visited ones into a Recents category, and voice channels into their own category.
  - [ ] Customize: "new" badges and the "New Options" section, the connections prompt, the help text under a prompt (usePromptHelpText), dropdown prompts in a sheet (listed like the others), marking questions seen when the tab closes. A failed answer save keeps the local change (no rollback, like the reference). Unicode answer emoji are drawn as text, not twemoji. Onboarding default channels aren't added when opting into everything from the browser (onboardExistingMember).
  - [ ] "Choose Your Channels" card (CHANNEL_BROWSER_NUX), "new" badges (NewChannelsStore), topics drawn as plain text instead of markup (parseTopic).
  - [ ] Guild unread badges still count unpicked channels (GuildReadStateStore).
  - [ ] A failed save keeps the pick on screen (no rollback).
- [ ] Long-press action sheets for guilds, folders and channels (mark as read, mute, notification settings, copy link/id, leave).
  - [x] Channel and DM sheet (ChannelLongPressActionSheet): see the Channel long-press sheet item above. Built 2026-11-19, untested on device. Mark Unread counts mentions in the loaded messages, else fetches the newest two (the reference counts 0 when none are loaded). Not done: the guilds bar's DM icons (the bar has none yet), Invite, favorites, stage/voice and experimental rows.
  - [x] Thread and forum post sheets (ThreadLongPressActionSheet, LongPressForumPostActionSheet) in the same sheet (`channelActions/threadActions.ts`): mark read/unread, join/leave (follow/unfollow), close/open, lock/unlock, edit, copy link, mute, notification settings, pin post, delete, copy ID. Long press in the channel list and the Threads tab. Thread member state synced from the gateway (`threadMemberActions.ts`); thread mute and notification level share the channel sheets; the edit screen has a thread/post variant (hide after inactivity, anyone can invite, close/lock/delete rows). Built 2026-11-19, untested on device. Section order inferred (scrambled decompile); Delete Thread is ours; mute rows show for unjoined threads too (changing them joins first). Not done: Edit Tags, author Edit Post, the author delete variant, forum tags and spoiler in settings; an unjoined pinned post is not found when replacing a pin.
  - [ ] Guild and folder sheets.
  - [ ] Leftover debug logs: two `console.log('[DEBUG-st7k]…')` in `features/chat/details/ChannelDetails.tsx`.
  - [x] Mute and notification settings (`features/notificationSettings`, `stores/settings/notificationActions.ts`; MuteSettingsActionSheet, ChannelSettingsNotifications, UserGuildSettings `channel_overrides` PATCH, optimistic). Sheets, where the reference pushes screens. Built 2026-11-19, untested on device.
    - [ ] Not done: server mute, stage and forum variants ("New Posts Created"), the "muted until {endTime}" hints (MutedUntilText), the mute row's description (`6yI+JS`).
  - [x] Unread Badges (NotificationSettingsMessageUnreadChannelActionSheet) in a server channel's notification settings: All Messages or Mention Only (dimmed unless mentioned), the UNREADS_* channel flags; Mention Only disabled while the channel notifies of all messages; shown only with the new notification system. Installed on the emulator 2026-11-19, not tried by hand. Not done: the mock channel preview, the server-wide unread setting (NotificationSettingsMessageUnreadGuildActionSheet), the unread notice (UnreadSettingNotice).
  - [x] Pin Channel to Top (`setIsFavorite`, the FAVORITED override flag): pinned channels leave their category for a "Pinned Channels" section at the top of the list. Built 2026-11-19, untested on device.
  - [x] Edit channel and category (`features/channelSettings`, ChannelSettingsOverview): name, topic or post guidelines, slowmode, age-restricted, announcement channel (NEWS guilds, not the rules or updates channel), Hide After Inactivity (`default_auto_archive_duration`); PATCHes changed fields only. Customize group (name, icon via expo-image-picker). Duplicate channel (clone path of CreateChannelModal). Close DM and leave group with confirm (`closePrivateChannel`). Built 2026-11-19, untested on device.
  - [ ] Channel settings Permissions row (renderPermissions, MANAGE_ROLES): shown, but the screen it opens does not exist; onPress does nothing.
  - [ ] Channel settings Invites row (renderCommonSettingsSection, INSTANT_INVITES): shown, but the screen it opens does not exist; onPress does nothing.
  - [ ] Delete channel: no "Cannot Delete Channel" alert for a Community rules or updates channel, no onboarding default-channel threshold check (handleDeleteChannel).
  - [ ] Delete channel: no Conjure app channel alert (openConjureDeleteAppChannelAlert).
  - [ ] Delete channel alert names the channel by `channel.name`, not computeChannelName.
  - [ ] Delete channel: the chat stays open when the open channel is deleted (leaveDeletedChannel).
  - [ ] Age-restricted switch is not disabled in an age-restricted guild or a linked-lobby channel (renderNsfwConfig isNSFWDisabled).
    - [ ] Not done in edit: voice settings (bitrate, user limit, region, video quality), forum tags, default sort and layout, change category, permissions, delete channel, topic emoji conversion, age-restricted lock for age-restricted servers and linked lobbies. The group-save rate limit shows text without a countdown.
  - [ ] Favorites: the sheet's favorite rows (openFavoritesGuildMoveToCategoryActionSheet) and the favorites server. Deferred.
  - [ ] Invite: the sheet's Invite and Invite Links rows (showInstantInviteActionSheet, InstantInviteUtils). Deferred, as is the guild header's invite button.
- [ ] Folder editing (name, colour, settings modal). Reordering follows the reference's GuildsBar drag (useGuildsBarGesture rules, moveById); not checked on a device yet. Missing from it: haptics, screen-reader announcements, the long-press context menu.
  - [x] Drag servers and folders, including servers within, into and out of open folders (flattened rows, like the reference's `getFlattenedGuildFolderList`).
  - [x] Rows spring aside and close up (TRANSITION_PHYSICS); dragging back over the start cancels; an open folder has one background behind its header and servers (GuildsBarGuildFolderBG) and rows are drawn over the rows below, so icons stay above backgrounds; a drop commits once the preview has landed and the rows have finished springing (picking something up meanwhile commits it at once). Open: the item side of useGuildsBarGesture is not readable in the datamine, so the gap side comes from the half of the row the finger is in; a folder emptied by a drop still disappears without animating.
  - [ ] The reference's other drop targets:
    - drop a server onto another top-level server to create a folder (`convert-before`/`convert-after`);
    - drop onto a closed folder to add to it (`drop-into`).
  - [ ] Folder settings (name, colour), delete folder.
- [ ] Server dock (deferred design): grid when expanded, search, optional list view (remember the preference) with the `mobile-server-drawer` activity/typing details — "TabsV2" in the reference.
- [ ] Join / create server, discovery.

## Shell: Messages tab

- [ ] Add Friends and New Message buttons are no-ops.
- [ ] Previews are fetched eagerly for the 90 most recent DMs; the reference fetches lazily per visible row (`useLatestChannelMessage` → `addWant`).
- [ ] Muted styling and unread styling — *verify* against the reference.
- [ ] Favourites, message requests, spam folder, friend activity / "active now".
- [ ] Presence only covers friends (READY_SUPPLEMENTAL); other DM recipients have none.

## Shell: Notifications tab

- [x] Recent Activity: the notification centre's mention items (`GET /users/@me/notification-center/items` with `with_mentions`, `roles_filter`, `everyone_filter`; `recent_mention` and `reply_mention`), drawn as search results (`IsocordSearchResultsView` with `inertContent`: the row is the only press target) with 3 lines of text and the body (media and embeds included) cut at 320 dp with a fade (`maxContentHeight`, `fadeCut`). A tap opens the search preview panel (`SearchPreviewHost` with `closeOnJump`, hosted in `MainTabs` around the tab navigator so it covers the tab bar, under the chat panels), "Jump to Message" opens the chat. Every search preview now also closes with a rightward swipe (fling or past half the width, as the chat panels). Items cached (`notificationsStore`), the first page fetched on READY and again whenever the tab is shown, then pages of 8; `NOTIFICATION_CENTER_ITEM_CREATE` / `_DELETE` / `_ITEMS_ACK` keep them current. Read and unread (`isUnreadMention`, ForYou's check: not `acked` and the channel's read marker before the message): read rows at 50% opacity, the tab's badge counts the unread ones. Built and installed on the emulator 2026-11-15, **not yet looked at**.
  - [ ] Friend request notifications above Recent Activity (`FRIEND_REQUESTS_GROUPED`, incoming / accepted requests, game friend requests; NotificationCenterLocalItems).
  - [ ] The other item types (reactions, go live, scheduled events, friend suggestions, missed messages, ...), mark all read.
  - [x] Pull to refresh (`refreshable` / `refreshing` / `onRefresh` on `IsocordSearchResultsView`, a `SwipeRefreshLayout` around the list). Mark As Read on a mention now moves the channel read marker to the message (`ackMessage`); the reference only acks it locally, so it came back unread on the next fetch. Built 2026-11-19, untested on device.
  - [ ] Acking: leaving the tab bulk-acks the items shown (`bulkMarkNotificationCenterItemsAcked`, `clearNotificationGuildMentions`), the `NotificationCenterAckedBeforeId` setting and the NOTIFICATION_CENTER read state (items older than it are read). Until then a mention only reads as read once its channel is read or the server acks it.
  - [ ] *Verify* that new mentions arrive as `NOTIFICATION_CENTER_ITEM_CREATE` while the app runs; otherwise the badge only catches up on READY or opening the tab.
  - [ ] Cached items don't follow MESSAGE_UPDATE / MESSAGE_DELETE until the next refresh.
  - [ ] "Recent Activity" stays above the list instead of scrolling with it.
  - [ ] Blocked / ignored authors aren't filtered out yet.

## In-app notifications

- [ ] Message notifications (`src/features/inAppNotifications`; reference `modules/in_app_notifications/native`, `stores/native/InAppNotificationStore`). Written on 2026-11-14, **not built or tested on a device yet**. Done: the `MESSAGE_CREATE` check (own messages, @silent, system messages, app in front, the chat on screen, `ShowInAppNotifications`, DND, muted server/category/channel, "Nothing", "All messages" vs mentions with suppressed @everyone/roles, the guild's default level), one on screen with two waiting (the oldest dropped), removal on `MESSAGE_ACK`, the card (avatar, name in role colour, "· icon channel, server", 2 line preview cut at 96 with a fade, 5 s bar, swipe up, press scale, tap opens the message), the screen reader announcement.
  - Preview: `IsocordMessagePreviewView` (`MessagePreviewView.kt`) draws the chat's message body (`MessageBody`, shared with search) for every message. The reference only does that for image embeds and forwards; plain text uses `ChannelRowPreview` (inline markup, `text-md/medium`), and media-only messages and polls use a line like "{username} sent a poll".
  - Not done: the media thumbnail on the right (`MediaPreviewRightAccessory`), the sound (`playInAppMessageSound`), long press → notification settings, the role dot setting, reaction / message request / failed to send / reminder / alert notifications, closing open sheets and modals on tap (`ModalActionCreators.popAll`).
  - Not checked yet: blocked users, message requests, focus mode, thread notification settings (joined threads notify on mentions only, *verify*), NSFW / spoiler gated channels.
  - The guild's default notification level (`Guild.defaultMessageNotifications`) is only used here; fixed 2026-11-18: unreads (`resolveUnreadSetting`, mention-on-all-messages) now use it too, as the reference's `resolvedMessageNotifications` does (built and installed, untested on device).

## Shell: You tab and accounts

- [ ] Full You tab (status picker, the settings gear in the header instead of the temporary Settings button). The profile itself is the sheet's `UserProfile` (2026-11-19, untested on device); the status bar strip above the banner is plain.
- [ ] Account switcher: invalid-token indicator; divider inset is off while editing.
- [x] TableRow family, switch/checkbox/radio, slider, RowButton (Mana port), with the Android ripple as press state (`RipplePressable`) — draggable rows still missing.

---

## Auth and accounts (phase 2 polish)

- [x] Mana `AlertModal` for errors and confirmations.
- [-] Spinner/transition while switching accounts.
- [ ] Register, forgot password, new-location verification (email), phone verification.
- [ ] MFA variants: SMS, backup codes, WebAuthn/passkeys — *verify* which are handled.
- [ ] QR-code login (remote auth) both ways.
- [ ] Test the whole flow end to end against Discord (token login + email & password & TOTP is the only one confirmed so far).

---

## Secondary screens (phase 6)

- [x] User profile sheet (bio, roles, mutual servers/friends, connections, notes, server tag chip that opens the TEMPORARY server sheet). Gap: the verified mark is a circled check, not the badge shape.
  - `src/features/userProfile`: main tab only. Banner, avatar, status bubble, badges (tap shows a toast), bio (native markdown), roles, note, mutual servers and friends, connections, moderator actions, Message / Add Friend / Call row, more menu, Nitro theme gradient (`experimental_backgroundImage`). **Not yet looked at on a device.**
  - Gaps: Invite to Server and Apps do nothing; Call only shows a toast; timeout offers 1 minute to 1 week (no "remove timeout" because the member's timeout is not stored); no role hierarchy check for kick, ban and timeout; "View Server Profile" text not found in the intl messages; Activity, Board and Wishlist tabs left out. The sheet always opens at full height and cannot collapse.
  - [x] Round 2 (2026-11-19, built and installed on the emulator, **not yet looked at**): presence on server avatars, ring behind the avatar, gradient on the whole sheet, own-profile status placeholder and custom status editor (alert, emoji picker, `settings-proto` `status.custom_status`), APP tag, bots get Message only, Message is secondary, Member Since, role icons on the role tags, GitHub connection icon, RPC card with app icon, small image and elapsed timer, a mutual server switches the profile to that server's, mutuals status cutout, profiles cached (latest 50), avatar and banner fit in the media viewer.
  - [x] Round 3 (2026-11-19, untested on device): custom status alert and moderator / more-menu confirms on the `aboveSheets` layer over the open sheet, note disabled with "Loading Note" while it loads, profile body split into `UserProfile` (slots: top-right `action`, `afterIdentity`) and reused by the You tab, no mutuals on your own profile.
  - [x] Blocked and ignored users (2026-11-20, built, untested on device): "You blocked them" / "You ignored them • Unignore" card under the identity (UserProfileRemediatedNotice). Add Friend and Call are disabled on a blocked profile (the reference hides Add Friend instead). In the chat, back-to-back messages of a blocked or ignored user fold into "N blocked messages" / "N ignored messages" (createChannelStream BLOCKED_GROUP / IGNORED_GROUP, BlockedMessageGroupView): a tap opens one group at a time (`revealedId`, revealMessage), with the height, fill and messages animated, and a message deleted from an open group fades and collapses. A group has the margin of a new message group above it, and its label is centred in a 34 dp strip. Reply previews of a blocked or ignored author say "Blocked message" / "Ignored message" (createMessageContent). A jump to a folded message opens its group first (`revealMessage`, our addition: the reference leaves it folded) and scrolls to the group. A deleted open message hands the reveal to its newer neighbour (MessageStore MESSAGE_DELETE). A group keeps its list item when its key moves (`ChatRowChanges` aliases). Open: `message_horizontal_spacing` of the group view couldn't be read from the APK, so the group's side padding is a guess; a jump into a group taller than the screen lines up the group's bottom, not the message; message previews, search and the chat preview don't fold.
  - [x] Profile-themed buttons (2026-11-19, untested on device): inside `ProfileThemeScope`, primary buttons take the theme's primary colour (`getContrastingColor` against white, pressed darkened), secondary and tertiary use the translucent white / primary fills (`useProfileThemedButtonStyles`, `design/components/buttons/buttonTheme.ts`, colour maths in `design/colors.ts`). Checked in the gallery's scope picker, not yet against the reference's numbers.
  - [ ] Custom status: no "clear after" choice (never expires), no verified bot check mark on the APP tag, the RPC card has no party size, buttons or Spotify links.
- [ ] Friends list, friend requests, add friend.
- [ ] Search (messages, people, channels), pins, saved/bookmarks. Messages tab global search screen (Recent + People pages, history) done; no friends list/guild members in People yet.
  - Message results (Messages and Pins tabs) are one native Compose list, `IsocordSearchResultsView` (`SearchResultsView*.kt`, `SearchRows.kt`, `SearchResultsList.kt`; JS `search/messages/MessageResults.tsx`): each result is the chat's own message row (`buildRows` with one message; author in role colour with nickname, avatar, markdown, mentions, emoji, attachments, embeds, stickers, polls/forwards) with the query's words highlighted (`Span.highlight`), 4 lines of text (Pins 10), a channel header for server channels, a loading row that asks for the next page, a notice row for the historical indexing header. Rows are cached per message as JSON strings so a new page costs only its own messages. Still JS: placeholders, errors, "no results" (`ResultList`).
  - [x] Message preview (`search/preview.tsx` `SearchPreviewHost`, `chat/ChatPreview.tsx`; reference SearchNavigatorPreviewScreen, MessagePreview, ChatPreview): tapping a result (Messages, Pins, Files, Links, a voice message in Media) slides a panel over the search with the channel's header, the messages around the result (`loadPreview`, a `preview` window in the messages store apart from the chat's, so previewing does not move the chat; it pages older and newer history as it scrolls, `loadPreviewPage`; edits, deletes and reactions reach it, new messages do not), scrolled to the result with a flash, the list's jump button leading back to the result (ChatView `jumpTarget`: shown while the result is off screen, ↑ or ↓ toward it, scrolls to it with the flash; not in the reference, which has no paging in its preview), and the 44 dp "Jump to Message" bar where the composer would be. Back, its arrow or a rightward swipe (2026-11-15, untested) closes it; the jump closes search and opens the chat at the message. Long press works there without edit, reply and mention (they need the composer); the list does not swipe; a name tap does nothing; links to other channels, threads and messages outside the window leave search like the jump. Built and installed on the emulator 2026-11-14, **not yet looked at on a device**. Open: the channel details' edge drag moved the details with the preview on top instead of closing the preview; the preview's own swipe now competes with it at the left edge, *check which wins*; the reference's Reply in a preview jumps to the chat and focuses the input (left out here). Rotating while a preview is open re-registers ChatPanels' back handler ahead of the preview's, so back then closes the details instead.
  - Search core (`src/features/search`): done: `SearchTabsLayout` (tabs with result counts, tabs with no results dropped, selection kept as the tab set changes, debounced query), `SearchBar` (plain text), the Channels tab of a server channel (name match, count once the query settles), the Messages, Media, Pins, Links and Files tabs (one batched `POST .../messages/search/tabs` for the first pages, cursor paging, 202 indexing retry, channel pins endpoint, highlight of the query words, tap opens the message preview). Media, Links and Files are masonry lists (FlashList `masonry` + `optimizeItemArrangement`, shortest column first; items keep their proportions, clamped): columns = `max(3 | 2, ceil(width / 160 | 240))` (media | files and links; `MEDIA_MAX_ITEM_WIDTH`, `FILES_OR_LINKS_MAX_ITEM_WIDTH` in `search/messages/constants.ts`). The search bar has a back chevron (`SearchBar` `onBack`, `ChevronLargeLeftIcon`; the reference's global search screen has a separate arrow instead), tab items are spaced by 12 dp padding each side (the reference's itemSpacing 24) so the touch target grows. Recent tab (RecentScreen): "Search History", "Suggested", and "Photos & Media": a 3 by 3 grid of the first 9 media of the Media tab's results (square tiles, outer corners rounded, `RecentsMediaGridPlaceholder` while they load) with "View all" switching to the Media tab (`SearchTabPageProps.selectTab`); **not yet tested on a device**. English strings were taken from the reference's real texts. Differences: People tab has one "Suggested" section (no Friends / Server Members); members show the activity name only, without its icon; no "Thread in #parent" line in the details header; full timestamp accessibility label is a date. Not done: search filters (see "Search filters and autocomplete" below), search history of text queries from message results, smart search, guild-wide (server) search and the Threads tab, voice users and the muted/favourite marks in the Channels tab rows (`search/channels`: text channels by newest message with "Active … ago", then voice channels; the reference sorts voice channels by how many are in them), role colours/nicknames only for members the client has (requested through the gateway, not part of the search response), the reference's channel icons in the result header (a `#`/`•` glyph), embed/description matches (the reference cuts and highlights embed titles/descriptions too), the tab-switch crossfade and edge gradient, exact result counts setting, age-restricted channel agreement gate (`include_nsfw` is always sent for guild channels).
  - [~] Threads tab of a guild channel's details (`search/threads/ThreadsPage.tsx`, `ThreadRow.tsx`, `stores/threads.ts`; reference SearchTabsThreadScreen, redesign ThreadList, ThreadListEmpty, ThreadListTableRow, ThreadBrowserRowSubtext, ActiveThreadsStore, ThreadMessageStore): between Pins and Links before a query; none in a thread's details. "Create Thread" row while `canStartThread`; Joined / Active / Older sections (active threads from READY, GUILD_CREATE and THREAD_LIST_SYNC; older from `/threads/search`, 25 a page); the empty state and spinner. Tapping an unjoined or archived thread holds it in the channels store (`holdThread`) and opens it. Written 2026-11-15, **not built or seen on a device** (the bundle failed on an unrelated missing `fzstd`). Open: Create Thread (row and empty-state button) does nothing (navigateToThreadCreation); no cross-fade between loading, empty and list (EnterExitCrossFadeContainer); the last message's text is `previewText`, not inline markup (renderMessageMarkup); usernames have a flat role colour, not gradients or the role-dot setting; THREAD_LIST_SYNC `members` and THREAD_MEMBER(S)_UPDATE do not change which threads count as joined.
- [ ] **Search filters and autocomplete** (nothing implemented; the bar is a plain text field). Reference: `modules/search/native/components/layout/` (`SearchBar`, `SearchScreenSearchBar`, `SearchFilterButton` "Search Filters", `autocomplete/AutocompleteScreen`, `SearchFilterSuggestions`, `SearchFilterUtils`, `useSearchSuggestionsGesture`), `modules/search/native/tokens/SearchTokens` and `SearchQueryStore`.
  - Tokens in the bar (`toSearchBarTag`): the text field becomes a tag input where a filter is a removable chip ("{text}, removed" announced; "Filtered by: {text}. Swipe left to select the filter." as its label), backspace on an empty field removes the last one, the placeholder becomes "Search" once `in:` channels are set (instead of "Search in {server}").
  - Filters to support: `from:` (users), `mentions:` (users), `has:` (link, embed, file, image, video, sound, sticker, poll...), `before:` / `after:` / `during:` (date picker; the query params `min_id`/`max_id`), `in:` (channels; narrows the search to them in a server), `pinned:` (true / false), author type (user, bot, webhook), and the sort / mode (most relevant, newest, oldest: `searchModeToSearchQueryParams`).
  - Autocomplete: the filter button opens `AutocompleteScreen` with the filter list (`SearchFilterSuggestions`, shown over the results, dismissed by a gesture from `useSearchSuggestionsGesture`); typing a filter name or choosing one lists values (members, channels, `has` kinds, dates) filtered by what is typed; choosing a value turns it into a token. Server members come from the gateway (`REQUEST_GUILD_MEMBERS`, as the Members tab does), channels from the guild's channel list.
  - API: the tokens map to the search request's `author_id`, `mentions`, `has`, `min_id` / `max_id`, `channel_id`, `pinned`, `author_type` (see `search/api.ts`); the tabs' counts, `SearchQueryStore` equivalent state and history entries of filtered searches (the history stores tokens too, `SearchHistoryRow`) have to follow.
  - Strings: the filter and suggestion texts are hashed under `SearchFilterUtils`, `AutocompleteScreenUtils`, `SearchTokens` and `SearchFilterButton`; read them from the compiled messages like the rest.
- [ ] Server info / settings screens (read-only first), invites.
- [ ] Threads and forum browsing.
- [ ] Events.

## Settings (phase 7)

- [~] Settings screens (`src/features/settings`), modelled on the reference's `SETTING_RENDERER_CONFIG`: settings are route / toggle / radio / slider / pressable / static nodes in `config.ts`, screens list them in sections. Only settings for features Isocord has are added (no privacy, family center, billing, devices, clips…). **Not yet tested on a device.**
  - Done: overview (App Settings, Manage Accounts and Log Out (moved off the You tab; Manage Accounts is Isocord's own row), Developer Settings → App Version when Developer Mode is on, Staff Settings → Design System gallery); Appearance → Theme: one theme synced to the account (`appearance.theme`, `setTheme` clears `client_theme_settings` like saveClientTheme; READY and later updates apply it), or Same as Device Theme with a device-only Light Mode and Dark Mode theme each, following the system's mode (`themeStore` in `design/tokens`; built 2026-11-16, untested on device); Accessibility → Play animated emoji; Chat → Gestures → Swipe right to left; Notifications → in-app notifications; Advanced → Developer Mode. Account settings save like the reference's `updateAsync`: the whole PreloadedUserSettings category is re-sent with one field changed (`saveSettingField`), and toggles stay disabled until READY.
  - [ ] Search (`search.ts`, `SearchableSettingsScreen`), modelled on `SearchableSettingsList` / `useSettingSearchResults` / `SettingSearchManager`: settings have parents (SettingTreeManager), results are grouped under their top-level setting with its icon and breadcrumbs, scored like the reference (exact 1, word prefix 0.95, Jaro-Winkler ≥ 0.8), debounced 350 ms with placeholder rows, an empty state; a nested result opens its screen and highlights the row (SettingListItemHighlight); a static result copies its value. **Not yet tested on a device.** Not done: scrolling to the highlighted row (`useAutoScrollToSearchResultSetting`; screens are short), the screen-reader announcement of an empty search, FlashList.
  - Differences: opened from a plain "Settings" button on the You tab (the reference uses the gear in the You tab header); the themes are radio groups instead of the picker screens, there is no Sync across clients toggle (the single theme always syncs), an UNSET account theme keeps the last one instead of following the system, and the pickers offer Ash, which the reference's mobile picker doesn't; the Developer Mode description has no Discord API link; in-app notifications ignore Focus Mode;  selectively synced settings (Text & Media sync off) always save to the account; no offline edits (`required_data_version`).
- [ ] Account, privacy & safety, connections, devices/sessions.
- [~] Appearance → Zoom level (2026-11-16, built, **untested on device**): the reference's Android font scale (`AndroidFontScaleSetting`, `FontScaleStore`, `FontModule`). A slider over `FONT_SCALES` (75–200 %) with ± step icons and Reset to default; Save in the header writes the scale to SharedPreferences and restarts the app (ProcessPhoenix). Natively, `MainApplication.getResources` and `MainActivity.attachBaseContext` set `fontScale` to system × custom, so React Native text, Dimensions' `fontScale` and the Compose chat (all sp) scale together (`FontScale.kt`). Not done: Classic chat text size (`ANDROID_CLASSIC_CHAT_FONT_SCALE`), `getScaledHeightForText` (line heights).
- [ ] Appearance: chat density, reduced motion (theme and zoom level done, see above).
- [ ] Notification settings per server/channel/DM, mute durations.
- [x] Notifications → System notifications: "Get notifications outside of Discord." and "Notify on every new message in conversations" (background notifications, phase 8). Stored on the device, not read from the system's permission and channel states as the reference does.
- [x] `read-datamine.ts` explores the datamine (`find`, `grep`, `outline`, `msg`, `read --lines`) and cleans files: no compiler variants or unused runtime imports, `jsx()` as JSX, split object building folded, index imports renamed after their folder. About 42 % fewer bytes. Open: `fn(1085)` module ids are unnamed, and `async` functions stay Hermes generator state machines.
- [x] `read-datamine.ts --apk` also reads the feature modules' own English messages (`res/raw/modules_*compiledmessages.jsona`), e.g. NotificationSettings.messages; the cache now has 12669 messages.
- [ ] Language (English only for now, but strings already go through i18n).
- [ ] Isocord settings: plugins, experiments, debug info.

---

## Platform, performance and infrastructure (phase 8)

- [~] Background notifications (`android/.../notifications/`, `src/features/systemNotifications`). Discord's FCM sender is not usable by us, so a `remoteMessaging` foreground service (`GatewayService`) keeps a second gateway session of its own (zlib-stream, QoS heartbeats, resume, backoff, reconnect when the network returns), separate from the app's JS socket (JS timers stop in the background). Opt-in from Settings → Notifications → System notifications ("Get notifications outside of Discord.", which asks for POST_NOTIFICATIONS and then the battery optimisation exemption; "Notify on every new message in conversations"). JS hands the account over (`configure`: token, IDENTIFY properties with `client_app_state: background`, REST headers, translated text) on every session start and READY; the service restarts after reboot / app update (`BootReceiver`) and is sticky. READY is decoded as a stream into only what's needed. The filter is the in-app one ported to Kotlin (`NotificationState.shouldNotify`: own, @silent, system messages, DND, muted server/category/channel with mute end times, levels with the guild default, @everyone/role suppression), and nothing posts while the app is on screen (in-app notifications take over). One MessagingStyle notification per channel (tag = channel id, last 10 messages, circular avatars, image previews from the media proxy at ≤720 px through a FileProvider, spoilers masked and spoiler images left out), only the first message alerts unless "every new message" is on (`setOnlyAlertOnce`), Reply (RemoteInput, POST messages) and Mark As Read (POST ack) sent from Kotlin, gone on MESSAGE_ACK from any device, a tap opens the message (`isocord://channel/…` → `openChannel` in `MainTabs`). Notification channels and groups use the official ids and names (`directMessages`, `messages`, groups `111_realtime`/`222_social`/`333_server`). Built and installed on the emulator 2026-11-16, **not tested on a device**: nothing has been received, replied to or marked read yet.
  - Other kinds (2026-11-16), as alerts (`Alert` in NotificationContent.kt, one per tag, built by the service in the background and by `systemNotifications/alerts.ts` in front), each on its official channel id: incoming calls (`calls`, ringtone, insistent, CALL_CREATE/UPDATE while `ringing` has the account, gone when it doesn't or on CALL_DELETE, 60 s timeout, Decline = `POST /channels/{id}/call/stop-ringing`; pops up even over the app, which has no call screen; no answering), friend requests (`friendRequests`: incoming with Accept = `PUT` / Ignore = `DELETE /users/@me/relationships/{id}`, and "has accepted your friend request" when an outgoing one becomes a friend; gone when answered anywhere), reactions to your messages (`reactions`, "Reacted {emoji} to you:" with the message fetched by `GET /channels/{id}/messages?around=`, since MESSAGE_REACTION_ADD lacks it), new forum/media posts where the forum resolves to all messages (`forumThreadCreated`), scheduled events going live that you're interested in (`guildEventLive`, interest checked with `GET /users/@me/scheduled-events?guild_ids=` when one starts), and Discord's system DMs (`systemMessages`). Everything but calls goes to one "In-app notifications" channel (default importance) while the app is in front; the two "(in app)" message channels of the earlier build are deleted. Settings → Notifications → "Notify me about" → Real-time / Social / Server / Miscellaneous, with a device-local toggle per kind (`NotificationKind`). DND and mutes apply to all of them. A resume after the app was in front for 3 s or more replays what the other session already notified, and those events carry no time as messages do, so reactions, friend requests, forum posts and events skip it (`Handover` replay windows, ended by RESUMED or READY; this also drops such an event that happened in the 3 s after the app left); calls don't, since a call still ringing must alert. An event that goes back to scheduled or ends may start again. Switching account or logging out cancels alerts too. Built and installed on the emulator, untested.
  - Differences: the reference lets the system's channel settings control most kinds and only syncs Reactions (and the hidden missed messages / voice / gaming ones) to the account; here every kind is a device toggle, and the account's reaction setting (All / DMs only / Never) is not read. Reaction text uses the message's text or label instead of the reference's media-specific wording ("to your image", ...). Not doable over the gateway: server highlights, missed messages, friend gaming/voice activity, go live; voice connected needs voice.
  - Not done: message requests, blocked users and focus mode in the filter; a thread's own notification setting; the conversation shortcuts Android 11+ needs to list them under Conversations; per-account notifications for accounts other than the current one; turning the toggle off when the notification permission is revoked in the system settings.
  - One connection at a time (2026-11-16): while the app is in front (MainActivity resumed) the service's session is paused (socket closed with 4000, session kept) and JS posts the system notifications itself (`native.post`, the same Incoming JSON, filtered by `shouldNotifyInFront`, shared with the in-app card, skipping the chat on screen) on two channels of our own at default importance, "Direct messages (in app)" and "Messages (in app)", which sound but don't pop up; the in-app card stays. JS forwards every MESSAGE_ACK (`native.ack`). In the background the JS socket pauses the same way (`GatewaySocket.pauseInBackground`, set while system notifications are on) and the service resumes its session 3 s after the app leaves (so system dialogs over the app don't connect it), skipping replayed messages sent before the app left (`Handover.replayed`); a message both sides heard is posted once. Back in front after 3 s or more away, the JS resume's replayed messages from before the return neither post nor show an in-app card (`Handover.replayed` in `SessionNotifier.onMessage`, so `native.dispatch` answers false); after a shorter time (a system dialog) the service never connected, so they do. After a resume fails and READY comes instead, every notification is checked against READY's `read_state` (`MessageNotifier.reconcile`, notifications from before a process restart by their last message id extra). After a long time in the app the session has expired, so leaving it costs a fresh IDENTIFY and a full READY. Built and installed on the emulator, untested.
  - One Handover (2026-11-18, built and installed on the emulator, **untested on a device**): `notifications/Handover.kt` owns leftAt, the return (only after the 3 s takeover delay), `appReplaying` and `backgroundReplaying`, with the clock as a parameter. MainActivity resume and pause are the only source of "in front" (`Handover.returned` / `left`, then `AppVisibility.set`); JS no longer reads `AppState`. JS forwards RESUMED beside READY and `AppSession` ends the app's replay window on either. Gone: `handover.ts`, `replaying` in `DispatchContext`, `NotificationGateway.replaying`, `AppVisibility.leftAt`, the `backgroundTakeoverMs` constant. JVM tests: `HandoverTest` (`./gradlew :app:testDebugUnitTest`; the release variant has no unit-test task).
  - Embed-only messages (2026-11-17): the first embed's text, as getContentlessNotificationBody (NotificationTextUtils): "title description", either alone, else the first field's "name value". Spoilers masked; "Link" only when the embed has no text. Built and installed on the emulator, untested.
  - Our own: the "Background connection" status channel and its Connected / Connecting… notification; "#channel, server" titles (the in-app card has an icon instead of the #); spoilers masked as "Spoiler". The official app runs Reply and Mark As Read through a headless JS task.
  - The second session uses presence `unknown` with `afk: true` and never reports itself active; check how it affects the account's shown status and Discord's own push to other devices. Heartbeats use executor timers, which stall while the CPU sleeps in deep Doze: check whether the server drops the session and how late resumes deliver messages, with and without the battery exemption.
  - Known issues: on Android 12+ a sticky restart from the background, or a `configure` on a READY that arrives after the app left the screen, may not start the service unless the app is exempt from battery optimisation (both are caught; the service then waits for the next app start). The tap's `isocord://` URL is read with `Linking.getInitialURL` whenever `MainTabs` mounts, so remounting it (account switch, re-login) reopens that message. Between `onPause` and `onStop` neither in-app nor system notifications show.
- [ ] Voice and video (later).
- [ ] External plugins on top of the `Feature` registry.
- [ ] Cache follow-ups: per-store cache versions; cache size monitoring; persist DM previews lazily; maybe cache presences.
- [ ] Startup: measure time to first *meaningful* frame in release (`reportFullyDrawn`); lazy-load screens that aren't on the first frame.
- [ ] Release builds: Android lint crashes (`lintVitalAnalyzeRelease`, a lint bug) — find the cause instead of skipping it; building every ABI takes over 20 minutes (use `-PreactNativeArchitectures=x86_64` for local testing); a real signing config.
- [ ] Tests: there are none yet (stores, markdown, buildRows, gateway are good candidates).
- [x] Version control: the project is not a git repository yet.
- [x] Biome config migration (`biome migrate`).
- [x] Development timing logs in `socket.ts` / `session.ts` now go to the always-on logger (Debug Logs). `ChatPanel.tsx`'s per-update rows timing stays a `__DEV__` console log (too frequent for the buffer).
- [x] Debug Logs (Settings → Developer Settings → Logs, needs Developer Mode; `core/log.ts`, `features/debugLogs`), after UserSettingsDebugLogs and LogAggregator: 5000-entry in-memory buffer, regex filter, sort order, share as text; the list updates live (batched every 500 ms) and follows new entries when at the newest end. Logged: REST method/path/status/time (never query, headers or bodies), gateway state/closes/reconnects/READY size and timing, session start/feature setup times/cache restore and save/READY, feature registration, accounts (no identifiers), uploads, chat link kinds, screens, app state, startup milestones, console warnings/errors, uncaught errors, unhandled rejections (release). The last 100 lines before a fatal error are kept for the next launch. Built and installed on the emulator 2026-11-16, untested on device. Departures: entries have a level (category coloured for warn/error); the Logs row opens the screen directly instead of a sheet of log screens; live list instead of a snapshot with pull to refresh (no Refresh option); the options button is a secondary IconButton beside the field, not inside it. Open: native (Kotlin) logs don't reach the buffer.
- [x] In-app perf monitor (Settings → Developer Settings → Performance, needs Developer Mode; `features/perf`, `core/trace.ts`, `Perf.kt`): records `traced`/`beginSection` spans, native `Perf.span`s (`chat:rows`), janky frames (FrameMetrics, over 2× the deadline like JankStats) and JS stalls (rAF gaps over 100 ms, only while the overlay shows); overlay with JS/UI fps, jank, worst frame, JS/Java/native heap; exports Chrome trace JSON to Downloads. Recording survives restarts so startup sections are caught. Built and installed on the emulator 2026-11-16, untested on device. Open: the screen's own text is plain English (no reference strings); turn the timing logs in `socket.ts` / `session.ts` into spans; Android 15+ could add a full system trace via `ProfilingManager`.

## Cleanup

Found in the architecture review and code-smell audit (2026-11-16). The rules behind these are in the Code guidelines section of CONTRIBUTING.md and in the Code rules section of AGENTS.md.

### Bugs found along the way
- [x] Timed mutes never expire: `parseGuildSettings` (`stores/settings.ts`) compares `mute_config.end_time` with `Date.now()` once at parse time and caches the result. Kotlin's `NotificationState.kt` checks it live.
- [x] `useCanBypassSlowmode` (`composer/status.ts`) computes permissions on a thread without swapping to the parent channel, so the parent's overwrites are missed.
- [x] `ChatInput.tsx` group placeholder uses `channel.name ?? names.join(', ')`, so an empty name wins. It also tells DM from group by recipient count instead of channel type.
- [x] Mute checks disagree: `ChannelList.tsx` skips the guild mute, `NavigationBar.tsx` skips the category mute.
- [x] Search's link handler (`MessageResults.tsx`) leaves a role link's `channelId` undefined in DMs and has no `react` or `retry` cases.
- [x] ChatInput `verticalInset` default is 5 in `ChatInputViewManager.kt` and 8 in JS.
- [x] `rows.ts` header says colours are `#rrggbb`. They are ARGB ints.
- [x] `chatPress` is skipped for `.clickable` at `MessageRow.kt:117,187`, `MessageHeader.kt:110,151` and `Attachments.kt:409`.
- [x] `ImageLoading.resourceBitmaps` is an unsynchronised `HashMap`. Check `ScopedCookieJar.jars`, which OkHttp threads read.
- [x] `youtubePage` and `tiktokPage` in `MediaViewer.kt` put URL parts into inline JS. Check for injection and move the pages to assets.

### Deepen modules (strongest first)
- [x] Notification policy (now split, 2026-11-18, see GLOSSARY.md: the Unread policy in `stores/unreadPolicy.ts` and the Notify policy in `GuildSettings.kt`, sharing `test-vectors/notification-policy` run by `bun test` and `NotificationPolicyVectorsTest`): one module answers muted, mention level and unread kind, with an injected clock. Replaces 8+ mute checks and 4 mention checks (`readStates.ts`, `ChannelList.tsx`, `NavigationBar.tsx`, `MessagesTab.tsx`, `inAppNotifications/store.ts`, `alerts.ts`, `buildRows.ts`).
  - Policy drift fixed with the vectors (2026-11-18): a Kotlin mute ending exactly now no longer counts as active (reference `MuteTimers.computeIsMuted` is `end >= now`); unread kind and mention-on-all-messages use the guild's default level. Not shared: opt-in's effect on notifying and the unread kinds stay on their own side. The reference's `getMessageNotifications` returns the guild entry's level as is (even NULL); both ports fall back to the guild default as before, unverified against a real account.
- [x] Channel permissions: one call per check from a session and channel id, hiding the guild lookup, the thread-to-parent swap and the DM default. `longPress/actions.ts` `channelPermissions` is the current de facto owner.
- [x] Chat link module: owns the `isocord://` grammar (encode, decode, open). Replaces about 40 build sites and 6 parsers (`links.ts`, `MessageResults.tsx`, `MediaViewerHost.tsx`, `mediaViewer/store.ts`, `NotificationsTab.tsx`, `MainTabs.tsx`) and the 4 opener setters.
- [x] ChatRow encoder: owns RowContext assembly, the standalone and search variants, theme variants and serialisation. Theme JSON is built in 7 places, row JSON in 6. `ChatPreview` loses line diffing with a plain `JSON.stringify`.
- [x] Outbox: per-session send path (validate, upload, optimistic message, post, confirm, fail, retry, edit). Pulls logic out of the `ComposerContext.tsx` `send` closure, `composer/send.ts` and the global `uploadsStore`.
- [x] Read session: moves the ack decision, NEW divider and first-mention jump out of `ChatPanel.tsx` component state.
- [x] Cache closure: stores declare which users and members they reference, and the session computes what `users.ts` and `members.ts` keep. Also per-store versions and handler order from declared dependencies (see Cache follow-ups).
- [x] Conversation name: one `computeChannelName` port for the 8 name derivations (`rich.ts`, `systemNotifications/index.ts`, `inAppNotifications/store.ts`, `useDm.ts`, `search/global/dms.ts`, `ChatInput.tsx`, `ChannelNameHeader.tsx`, `welcomeRow`).
- [x] Setting descriptors: one `{ path, codec, default }` per user setting for read, write and optimistic apply. Today each proto path is written twice in `stores/settings.ts`.
- [ ] Guild drag session (speculative): a state machine over rows for `GuildsBar.tsx` drag and drop, with timing driven from outside.

### Fast Refresh and import cycles
Found 2026-11-19 with `bun scripts/import-graph.ts` (simulates Metro's walk, not seen on a device).
- [x] No import cycles and no full reloads (`bun scripts/import-graph.ts --check` passes). Cut by moving `isImageFile` and `isVideoFile` to `core/discord/mediaFormats.ts`, `keyOf` and `toggleReactionByKey` to `chat/reactions.ts`, the header part names to `chat/headerParts.ts`, and the history refresh on connect to `messageHistoryStore`. The profile sheet registers at startup (`registerProfileSheet` in `app/features.ts`). `openSheets.tsx` opens the mute and notification settings sheets and hands each the other's opener.
- [x] No `.tsx` file mixes components with other exports. Helpers, hooks, contexts and constants moved to files of their own (`avatarUrl.ts`, `useComposer.ts`, `sheetContext.ts`, `showAlert.tsx` and others). Hooks stay importable from `core/react.ts`, whose `SessionProvider` moved to `core/SessionProvider.tsx`.
- [x] `expressions/picker/EmojiGrid.tsx` created the `useSkinTone` store, so every edit reset the skin tone. It now lives in `useSkinTone.ts`.
- [x] `CARD_PLACEHOLDER_BODY_HEIGHT` had two definitions. `cardRowMetrics.ts` owns it.
- [ ] 27 `.tsx` files hold only openers (`openXSheet`, `showAlert`). They are hot-safe but not refresh boundaries, since they export no components.
- [ ] Then enable Biome's `style/useComponentExportOnlyModules` and `suspicious/noImportCycles`, and add `--check` to Verify.

### Values shared with native code
- [x] Add a `NativeIsocordConstants` TurboModule with `getConstants()`. Move into Kotlin: link scheme and kinds, `NodeType`, spoiler flag, `PREVIEW_MAX_PX`, swipe actions, alert and notification kinds, avatar and row geometry.
- [x] Decode bridge JSON with `@Serializable` classes and `AppJson`: `ChatTheme` (51 fields written 3 times, `searchHighlight` outside the contract), the rows in `ChatRows.kt` (76 `opt*` reads), `ViewerSource`, `SearchRow`, `StyleBlock`, `GridSection`.
- [x] Typed props instead of strings: `origin` (`"x,y,w,h"`), `keyboardAppearance` (int), the JSON-string props where codegen structs fit.

### Magic values and duplicated helpers
- [x] Discord facts in `src/core/`: a `MessageType` object (5 raw type sets and a `switch` on numbers in `rich.ts`), message and attachment flags (5 files), message length limits (now in `ComposerContext.tsx`), `MINUTE` and `DAY`.
- [x] One CDN URL builder: the emoji URL is built 8 times, and 5 sites bypass `CDN_BASE`.
- [x] An API path table: 42 inline paths, `/users/@me` 11 times.
- [x] Use `CloseCode` for the bare `4000` in `gateway/socket.ts`.
- [x] Kotlin: one `CARD_MAX_WIDTH` (`432.dp` twice), one retry duration (`5_000_000_000L` 3 times), one avatar size, one `PlayButton` (`Attachments.kt`, `MediaViewer.kt`), one optional-string JSON reader. Move the 15 `Color(0x...)` literals outside `ChatTheme` into the theme.
- [x] JS: 103 numeric paddings, margins and gaps where `theme.space` fits. Worst: `search/messages/rows.tsx`, `ThreadsPage.tsx`, `upload/composerSlots.tsx`.
- [x] Merge helpers: two `formatTimestamp`, `formatSize` and `formatBytes`, three role-colour-to-hex helpers, two `emojiUrl`, 7 inline copies of `displayName`.
- [x] Rename `Json.kt` accessors. They copy org.json names on top of kotlinx.serialization.

### Split files by domain
- [x] `servers/GuildsBar.tsx` (1083): colours, rows, folders, drag, bar.
- [x] `composer/ComposerContext.tsx` (1072): store, keyboard height, limits (to core), send (to `send.ts`).
- [x] `stores/messages.ts` (911): types, store, windows, previews.
- [x] `composer/Suggestions.tsx` (932): search, `useSuggestion`, views.
- [x] `stores/settings.ts` (690): proto codec, store, actions.
- [x] `settings/SettingsList.tsx` (675): rows, search.
- [x] `search/messages/rows.tsx` (682): one file per row kind.
- [x] `chat/MediaViewer.kt` (856): sources, page, hosted player, footer, controls.
- [x] `chat/ChatList.kt` (815): list, row motion, list state, jump button.
- [x] `chat/ChatRows.kt` (502): model, parsing, `ChatTheme`.
- [x] `chat/Attachments.kt` (479): mosaic, file and audio attachments.
- [x] `expressions/index.ts` and `systemNotifications/index.ts` hold real implementation in an index file.

### Long functions
- [x] `ChatPanels` (776 lines, 42 hooks, 10 `biome-ignore`): one hook per concern (`useDetailsPanel`, `useStackedChat`, `useHandoff`, `usePanelDrag`).
- [x] `ComposerProvider` (708 lines) and `ChatPanelContent` (479 lines).
- [x] Others over 250 lines: `GuildsBar`, `messageActionGroups`, markdown `flatten`, `createSearchController`, `buildRows`.
- [x] Composables over 80 lines: `ChatListContent` (260), `MediaViewer` (187), `EmbedView` (137), `SwipeToReply` (113), `Cells` (96), `ComponentView` (87), `Reactions` (85), `ExpressionGrid` (83), `MediaTileView` (83).
- [x] `ChatInputView.kt` (629): one class. Pull out paste handling and the spoiler menu.

### Folders and packages
- [x] Kotlin `chat/` (35 files): `rows/`, `media/`, `text/`, `list/`, `viewer/`, `search/`.
- [x] Kotlin `notifications/`: `gateway/` and `notify/`. Loose root files into `core/`.
- [x] `design/components` (61 files): `sheets/`, `modals/`, `toasts/`, `inputs/`, `buttons/`, `table/`, `avatars/`.
- [x] `features/chat`: `rows/`, `panels/`, `sheets/`. `composer/suggestions/`.
- [x] `stores`: `messages/` and `settings/` after their splits.

### Session state and layering
- [x] Module-level state that outlives the session: `stores/messages.ts` (`lastOlderFailure`, `windowGenerations`, `previewRequest`, `previewPages`), `upload/store.ts` (global store, `tasks`, `subscribed`), `composer/send.ts` (`bodies`, `lastTyping`), `ComposerContext.tsx` (`uploading`, `savingEdits`, `creatingThreads`, `resetters`), `inAppNotifications/store.ts`, `mediaViewer/store.ts`, `core/api/auth.ts` `flow`.
- [x] Replace `setChannelOpener`, `setThreadCreationOpener`, `setDetailsChannelOpener` and `setStackedChatOpener` with a store or an event.
- [x] Fix imports against the layer order: `core/permissions.ts` imports `stores` (move `ChannelType` to core), `stores/expressions.ts`, `stickerPacks.ts` and `frecency.ts` import `features/expressions/data`, `design/components/StatusAvatar.tsx` imports `stores/presences`.
- [x] Type gateway dispatch payloads as a discriminated union instead of `any` plus casts.

### Rule drift
- [x] 74 `useMemo`, `useCallback` and `memo` uses. Remove the trivial ones. Keep and comment the ones where identity matters.
- [x] About 20 swallowed Kotlin exceptions. Worst: `StyleBlocks.kt:63` (bad JSON becomes an empty list), `NotificationActionReceiver.kt:172`. `parseRows` throws instead, so pick one policy.
- [x] Kotlin concurrency: coroutines everywhere. Raw `Thread` in `ChatInputView.kt`, `Handler` in `MediaPrep.kt`.
- [x] Hardcoded English: `SearchField.tsx` placeholder, `PerfScreen.tsx`. Hex literal in `CaptchaModal.tsx`.
- [x] Comments: 244 blocks over 4 lines, about 590 with semicolons, 10 with arrows. Worst: `expressions/index.ts:33` (32 lines), `KeyboardArea.tsx:43`, `expressions/data/search.ts:556`, `ChatList.kt`, `MediaViewer.kt`, `SwipeToReply.kt:108`, `ChatScroll.kt:53`, `ChatPress.kt:33`.
- [x] 27 dead-export candidates (`Modal*` parts, unused motion springs, availability helpers, `upload/pickers.ts`). Confirm before deleting.

### Cleanup leftovers
- [ ] Unused exported types: 56 of 76 exported `*Props` types have no outside importer. Keep the exports in `design/components`, where wrappers may need them. Drop `export` in `features/`. Also about 60 exported-but-internal types in `search/api.ts` and `expressions/data/search.ts`. Nothing catches unused exports today. `knip` would, as a new dev dependency.
- [ ] Block-bodied `useMemo` calls (`PeoplePage`, `dms.ts`, `DmMemberList`, `useGuildChannelResults`, `GuildMemberSearch`, `MessageResults`, `SearchTabsLayout`) and the `memo()` list rows (`MemberRow`, `MediaCell`, `FileCard`, `LinkCard`, `RailItem`). Check each against the React Compiler. Comment the ones kept.
- [ ] A few 5 to 6 line comment blocks (`settings/search.ts`, `inAppNotifications`). Docstrings that don't start with a verb, outside the rewritten ones.
- [ ] Composables possibly still over about 80 lines after the split: `ChatListContent`, `MediaViewer`, `ExpressionGrid`, `Cells`.
- [ ] `UploadEngine.kt:224` catches `IOException` and skips without a log.
- [ ] Channel permissions: a guild channel whose guild isn't loaded gets the DM default. Check against the reference.
- [ ] Notification preview text doesn't render `<t:…>` timestamps as dates, as the reference's `renderNotificationMessageContent` does.
- [ ] `MessageNotifier.kt` still uses raw `Executors`. Move it to coroutines.
- [ ] Thread bars: ArchivedLockedThreadChatBanner variant ("closed and locked", Open button) not shown; IconButton has no `xs` size (action bar uses `sm`).
