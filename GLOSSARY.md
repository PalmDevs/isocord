# Glossary

Domain terms for Isocord's modules. Use these names in code, comments and reviews.

## Session and cache

- **Session:** one signed-in account. Owns its stores, gateway and per-account state.
- **Cache references:** the users and members that cached store state shows. `usersStore` and `membersStore` keep only these.
- **Login flow:** one login attempt's identity, fingerprint and REST client. Kept across retries and MFA, one per auth stack.

## Messages and sending

- **Outbox:** the per-session path for sending, retrying and editing messages. Validates, uploads, adds the pending message, posts, confirms or fails.
- **Composer input:** the composer's side of the native input: the view, the flush barrier and styling.
- **Draft sync:** keeps the input's text in step with the chat's draft or edit.

## Reading and notifications

- **Notify policy:** Kotlin (`NotificationState`, `GuildSettings`). Answers whether something notifies. Takes the clock as an argument.
- **Unread policy:** JS (`stores/unreadPolicy.ts`). Answers unread kind, mute and opt-in display, and badges. Takes the clock as an argument.
- **Policy vectors:** `test-vectors/notification-policy`, JSON cases both policies run for the terms they share: mute with end time, resolved level with the guild default, opt-in and mentioned.
- **Read session:** what the user has read in an open chat: the ack, the NEW divider and the opening jump.
- **Setting descriptor:** a user setting's proto path, codec and default. Drives read, write and optimistic apply.

## Permissions

- **Channel permissions:** `can(session, channelId, bits)`. Hides the guild lookup, the thread-to-parent swap and the DM default.

## Chat view

- **Chat link:** a decoded `isocord://` link (`ChatLink`). The chat link module owns encode, decode and open.
- **Row encoder:** turns rows and the chat theme into the JSON props the native chat views read.
- **Panel layer:** one sliding panel (chat, stacked chat, thread creation or details) with its x position and open state.

## Notifications

- **App session:** the app's own gateway session, forwarded to native code while the app is in front.
- **Background session:** the native gateway session that takes over while the app is away.
- **Session notifier:** the one set of notification rules both sessions use.
- **Dispatch context:** what the app's stores know around a forwarded event: channel, parent, guild, settings, users, status.
- **Handover:** Kotlin (`Handover`). Owns when the app left and returned, the takeover delay, and the replay state of both sessions. A return counts only after the delay. Takes the clock as a parameter.
