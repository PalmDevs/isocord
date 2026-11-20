# Contributing to Isocord

Isocord is an unofficial Discord client for Android. It is written from scratch
in React Native, and the message list, chat input and upload pipeline are native
Kotlin. The goal is to look and behave like the official mobile app, so most
work starts by reading how the official client does something. Read
[NOTICE.md](NOTICE.md) first.

## Setup

You need Bun, a JDK, the Android SDK and [uv](https://docs.astral.sh/uv/).

```sh
bun install          # also fetches Twemoji on the first run (scripts/fetch-twemoji.sh)
bun start            # Metro
bun android          # debug build on a device or emulator
```

Before sending a change, run all three checks:

```sh
bun typecheck        # tsc, strict with noUncheckedIndexedAccess
bun lint             # biome; `bun run format` fixes formatting and import order
(cd android && ./gradlew :app:assembleRelease -q)
```

The release APK is at `android/app/build/outputs/apk/release/app-release.apk`.
Install it with `adb install -r <apk>`. Most of the UI is native, so test
on a release build. A JS-only check misses Kotlin and codegen errors.

## Reference material

"The reference" means the official client. Don't build a screen from memory.
Check it against these:

- **Decompiled JS:** `discord-mobile-datamining`, a sibling checkout. See
  [Reading the datamine](#reading-the-datamine).
- **The official APK:** native views, resources, drawables and the compiled
  intl messages.
- **[docs.discord.food](https://docs.discord.food):** the API and gateway, for
  user accounts.

When you copy a behaviour, name the reference component or function in a
comment, for example `// getPrivateChannelUserTagsString: ...`. The next
person can then find it and check it.

## Layout

```
index.js            startup trace, env, registers App
src/
  app/              App.tsx (providers, root stack), feature registration, env
  core/             Session, REST client, gateway, accounts, storage, Feature API, helpers
  stores/           per-session Zustand stores fed by the gateway
  features/         one folder per area (chat, servers, messages, search, ...)
  design/           generated tokens, Mana components, icons
  i18n/             t() and locales/en-US.json
  native/           codegen specs for the native views and modules
android/app/src/main/java/me/palmdevs/isocord/
  chat/             Compose message list and search results (ChatView, ChatRows, MessageRow, ...)
  input/            native chat input (EditText with markdown spans)
  upload/           attachment preparation and upload engine
scripts/            extraction of tokens, icons, fonts, emojis and images from the reference
patches/            bun patches for dependencies (see package.json `patchedDependencies`)
TODO.md             the backlog, grouped by area and phase
```

## Architecture

### Sessions and stores

Everything that belongs to a logged-in account hangs off a `Session`
(`src/core/session.ts`): the REST client, the gateway socket, MMKV storage
and the stores. Switching accounts disposes the session and builds a new
one, so stores never need resetting by hand.

A store is a vanilla Zustand store declared with `defineStore(name, create,
{ cache })`.
- **Gateway handlers:** `create` receives the session and subscribes to
  events with `session.gateway.dispatch.on('EVENT', ...)`.
- **Cache:** the `cache` option sets which state is saved to disk. That state
  is restored on the next launch, so the UI can draw before `READY`. `READY`
  must replace whatever was restored.
- **`CACHE_VERSION`:** bump it in `session.ts` when the shape of any cached
  state changes.

Core stores are listed in `src/stores/index.ts`. Their order matters,
because a store's handlers run after those of the stores listed before it.

In React, read stores with `useSessionStore(store, selector)` and get the
session itself with `useSession()`. Outside React, use
`session.get(store).getState()`. A selector must not return a new array or
object on each call, or the component re-renders forever. Return primitives,
or join and derive inside the selector as `ChannelNameHeader.tsx` does.

### Features

A `Feature` (`src/core/feature.ts`) can contribute:
- stores;
- a per-session `setup`;
- root-stack screens;
- app-wide overlays such as sheets, alerts and toasts.

Built-in features are registered in `src/app/features.ts`. The order there
is also the draw order of their overlays. Future plugins will use the same
API, so add to it rather than wiring things into `App.tsx`.

### Navigation

The root native stack holds `main` (`MainTabs`) and the feature screens. The
tabs are Servers, Messages, Notifications and You.

React Navigation 7 doesn't pass a bare tab name down from the root stack. To
switch tabs from outside the tab navigator, use
`navigate('main', { screen: 'messages' })`.

Servers and Messages each host a `ChatPanels` (`src/features/chat/ChatPanels.tsx`):
a list, the chat and the channel details, moved between with pan gestures and back.

### Chat rendering

The message list is drawn natively with Jetpack Compose. JS decides what
each row says and looks like, and Kotlin only lays the rows out and draws
them:

1. The stores hold the messages, members, guilds and users.
2. `features/chat/rows/buildRows.ts` turns these into `ChatRow`s. `markdown.ts`
   parses message text, `author.ts` handles names, colours and tags, and
   `media.ts` handles attachments and embeds.
3. Rows go to the native view as JSON. `rows.ts` is the contract, and
   `ChatRows.kt` must mirror every change to it. Theme colours follow the
   same rule, from `theme.ts` to `ChatTheme`.
4. Taps come back as `isocord://` links through `onLinkPress`. Those links
   are handled in `features/chat/links/links.ts`.

To add an interaction to the chat, build an `isocord://` link in JS or in
Kotlin, then handle it in `links.ts`. Use `chatPress` from `ChatPress.kt`
for any press target inside the chat. It handles touch slop, long press and
cancelling when the panels are swiped.

The codegen specs for the native views and modules are in `src/native/`. If
you change one, rebuild the app; Metro reload is not enough.

### Design system

- **Tokens:** `src/design/tokens/generated/` is produced by
  `bun run extract` (colours, typography, spacing, radii, shadows and
  component modules). Don't edit those files by hand.
- **Theme:** components read `theme.colors.*`, `theme.space.*` and
  `theme.modules.*` through `react-native-unistyles`. Use semantic colour
  names, never hex values.
- **Components:** `src/design/components/` holds ports of the reference's
  Mana components. Use them before writing new UI. The in-app gallery
  (`features/gallery`) shows them.
- **Icons:** use `<Icon name="..." />`. The list in `icons/generated.ts`
  comes from `scripts/extract-icons.ts`.
- **Touch feedback:** every surface you can tap gets a ripple. Use
  `RipplePressable`, which has the reference's ripple colour.
- **Font weight:** it never changes between states (selected, pressed,
  unread). Show those states with colour or a background.

### Strings

All UI text goes through `t('key')`, with the English text in
`src/i18n/locales/en-US.json`. Copy that text from Discord's compiled intl
messages, using the hash the reference component uses. Don't write it
yourself. `read-datamine.ts` shows the text for each hash.

### Reading the datamine

The files are large and noisy, so `bun scripts/read-datamine.ts` narrows
before it reads. Every command works from any folder.

| Command | Use |
| --- | --- |
| `find <word>...` | Lists files whose path has all the words, with sizes. |
| `grep <regex> [dir] [-i] [--max N]` | Searches the cleaned text of every file. Also finds English text. |
| `msg <text\|hash>` | Finds an intl message and the files that use it. |
| `outline <file>` | Lists functions and methods with line numbers. |
| `read <file> [--lines A-B] [--raw]` | Prints a file. `read` is the default command. |

A `<file>` is a path from the datamine root or from `discord_app`, or a unique
file name such as `ChannelPinsStore.tsx`. Line numbers are of the cleaned text,
so they match across `grep`, `outline` and `--lines`. `--raw` shows the file as
shipped. `--apk <base.apk>` rebuilds the message cache, only needed once.

What the cleaning does (`scripts/datamine/clean.ts`, about 6 s for every file):

- keeps the plain variant of React Compiler components and drops the
  compiled one, `fileFinishedImporting` and other Metro and Hermes lines,
  and `_runtime` imports that nothing uses;
- folds Hermes' two-step object building (`obj = { a: null }`, code,
  `obj.a = x`, and likewise `items = [,]; items[0] = x`) into one literal.
  It only folds when the order of evaluation stays the same, and then moves
  the declaration down to where the values are set. A props object used once
  by the next `jsx()` call moves into that call;
- turns `jsx(Tag, { ... })` into JSX. A props variable that could not be
  inlined becomes `<Tag {...obj} />`. `children={null}` means the decompiler
  fills the children in with an assignment the fold could not move;
- renames imports of `index` and `native` files after their folder, such as
  `intlModule` for `intl/index.native.tsx`. The decompiler's own name is
  the first export it saw, such as `util`, and is often wrong;
- adds the English text after message hashes such as `t.wsoPhr`.

Things it cannot fix:

- `fn(1085)` and `_private(1126)` are Metro module ids with no name in the
  datamine. Find the module from the properties used on it, with `grep`;
- an `async` function is a Hermes generator state machine. Read the
  `if (0 === dependencyMap)` states in order, and skip the `asyncGeneratorStep`
  boilerplate;
- variables are named `tmp`, `obj`, `closure_N`. Trust the property names
  and calls, not the variable names.

## Code style

- **Formatting:** Biome sets it. That means 4-space indent, single quotes,
  no semicolons, trailing commas and 120 columns. Type imports go in
  separate `import type` statements after the value imports.
- **Memoisation:** the React Compiler is on, so don't add `useMemo`,
  `useCallback` or `memo` just for performance.
- **Kotlin:** follow the style of the files around your change.
- **Comments:** say why the code is the way it is, or which reference
  behaviour it copies. Don't restate what the code does. See
  [Comments](#comments) for the style.
- **Scope:** keep changes small and close to what the reference does. Don't
  add abstractions for cases that don't exist yet.

## Code guidelines

These rules apply to code you write or change. Don't restructure code you
aren't working on. Note the problem in `TODO.md` instead.

### Values shared with native code

Kotlin owns any value that both sides need. JS reads it through
`getConstants()` on a TurboModule spec. A "mirrored by X.kt" comment is not
a contract, and copies drift. The ChatInput `verticalInset` default is 5 in
Kotlin and 8 in JS.

```kotlin
// Kotlin defines the value once...
object Links {
  const val SCHEME = "isocord://"
}

@ReactModule(name = ConstantsModule.NAME)
class ConstantsModule(context: ReactApplicationContext) : NativeIsocordConstantsSpec(context) {
  override fun getName() = NAME

  override fun getTypedExportedConstants(): Map<String, Any> = mapOf(
    "linkScheme" to Links.SCHEME,
    "avatarSize" to AVATAR_SIZE.value,
  )

  companion object {
    const val NAME = "IsocordConstants"
  }
}
```

```ts
// ...and the spec in src/native/ types it for JS.
export interface Spec extends TurboModule {
    getConstants(): { linkScheme: string; avatarSize: number }
}

// Codegen needs the module in a const of its own before getConstants().
const NativeIsocordConstants =
    TurboModuleRegistry.getEnforcing<Spec>('IsocordConstants')

export const { linkScheme, avatarSize } = NativeIsocordConstants.getConstants()
```

JSON sent across the bridge decodes into `@Serializable` data classes with
`AppJson`, as `NotificationsModule.configure` does. Don't read keys one by
one with `opt*("key")`. Every hand-written read is one more place to update.

### Magic values

Name every number or string that has a meaning. Put the constant next to the
code that reads it, or in `src/core/` when it is a Discord fact. Look for an
existing owner before you add one. For example, permission bits live in
`src/core/discord/permissions.ts` and hosts in `src/core/constants.ts`.

```ts
// Bad: a raw type set, copied into 5 files with small differences
if ([0, 19, 20, 21].includes(message.type)) showPreview()
const url = `${CDN_BASE}/emojis/${id}.${animated ? 'gif' : 'webp'}?size=48`

// Good: one owner per fact, imported everywhere
if (USER_MESSAGE_TYPES.has(message.type)) showPreview()
const url = emojiUrl(id, animated, EMOJI_SIZE)
```

```kotlin
// Bad: the same width in Embed.kt and Attachments.kt, under two names
.widthIn(max = 432.dp)
// Bad: what unit, and why 5?
if (now - failedAt > 5_000_000_000L) retry()

// Good
/** Max width of embeds and file cards, as in the official app. */
val CARD_MAX_WIDTH = 432.dp
private val RETRY_AFTER = 5.seconds
```

In JS, spacing comes from `theme.space` and sizes from `theme.modules`, not
from numbers. A one-off layout value inside a Composable, such as `8.dp`,
needs no name.

### Files and functions

A file holds one domain. Above about 400 lines, check whether it mixes
domains, and split by domain when it does. Never split by line count alone.
A long, cohesive file such as `buildRows.ts` stays whole.

```
// Before: servers/GuildsBar.tsx, 1083 lines with colours, rows, folders and drag
servers/GuildsBar/
  GuildsBar.tsx   bar layout and scrolling
  rows.tsx        GuildRow, GuildItem
  folders.tsx     FolderHeader, FolderTileIcons, folder colours
  drag.tsx        drag-and-drop reorder
```

Keep a component, hook or function under about 100 lines, and a
`@Composable` under about 80. Pull out parts with a name: a header, a footer,
an overlay, or a custom hook for one concern. A pile of
`biome-ignore lint/correctness/useExhaustiveDependencies` comments means one
component does too much.

```tsx
// Before: one component with 20 useState and 17 useEffect calls
function ChatPanels() { /* 776 lines */ }

// After: one hook per concern
function ChatPanels() {
    const details = useDetailsPanel(channelId)
    const stacked = useStackedChat()
    const drag = usePanelDrag(details, stacked)
    // ...
}
```

```kotlin
// Before: ChatListContent is 260 lines of effects, list items and overlays
// After
@Composable
fun ChatListContent(rows: List<ChatRow>, actions: ChatActions) {
  val state = rememberChatListState(rows)
  LoadMoreEffects(state, actions)
  Box {
    ChatRowsList(state, rows)
    JumpToPresentButton(state)
  }
}
```

### Folders and packages

When a folder or package has more than about 15 files, group them into
subfolders by domain. A subfolder needs at least 3 related files. Don't make a
folder for 1 or 2.

```
design/components/
  sheets/    Sheet, SheetDrag, SheetLayer, sheetStore, SimpleActionSheet
  inputs/    Input, TextInput, TextField, SearchField, CodeInput
  buttons/   Button, ButtonGroup, IconButton
  Text.tsx, Card.tsx, Badge.tsx   (leaf components stay at the top)

me/palmdevs/isocord/chat/
  rows/      MessageRow, MessageHeader, SystemRow, ReplyPreview, Poll
  media/     Attachments, Embed, Gifv, ImageLoading
  viewer/    MediaViewer, MediaViewerView, MediaViewerViewManager
```

### One owner per helper

Before you write a formatter, URL builder or colour converter, grep for an
existing one. `displayName` (`stores/users.ts`), `formatTimestamp`
(`chat/timestamp.ts`) and `CDN_BASE` already exist. Copies drift. For
example, one copy of `displayName` uses `username` where the others use the
display name.

### Session state

Anything tied to an account belongs to the `Session`. A module-level `Map`,
`Set` or `let` outlives an account switch and leaks the old account's data.

```ts
// Bad: retry bodies survive a switch to another account
const bodies = new Map<string, MessageBody>()

// Good: dropped with the session, as in stores/stickerPacks.ts
const bodies = new WeakMap<Session, Map<string, MessageBody>>()
```

Plain counters, such as a nonce sequence, can stay at module level.

Don't register callbacks with module-level setters such as `setChannelOpener`.
A setter never unregisters, and a call does nothing when no callback is set.
Use a store or an event instead.

### React Compiler

The compiler memoises for you. Don't add `useMemo`, `useCallback` or `memo`
for speed.

```tsx
// Bad: the compiler already does this
const onClose = useCallback(() => dismiss(id), [id])

// Allowed, with a comment that says why identity matters
// Context value: a new object re-renders every composer consumer.
const api = useMemo<ComposerApi>(() => createApi(nativeRef), [])
```

### Layers

Imports go one way:

```
features  ->  stores  ->  core
design    ->  core
```

`core` doesn't import `stores` or `features`. `stores` doesn't import
`features`. `design` doesn't import `stores`. When a type sits in the wrong
layer, such as `ChannelType`, which `core/discord/permissions.ts` needs, move the
type down a layer.

### Kotlin errors and threads

Don't swallow errors. A silent failure, such as bad JSON from JS turning into
an empty list, is harder to find than a crash.

```kotlin
// Bad
val blocks = try { parse(json) } catch (_: Exception) { emptyList() }

// Good: log with the app's tag, then fall back
val blocks = try {
  parse(json)
} catch (e: SerializationException) {
  Log.w(TAG, "Bad style blocks from JS", e)
  emptyList()
}
```

Use coroutines for background work, as `upload/` does. Don't start a raw
`Thread`, post to a `Handler`, or create another executor.

### Comments

Comments are short and dense. Fragments are fine for one-line comments. A
docstring starts with a verb in the third person, such as "Returns",
"Parses" or "Draws".

- Keep sentences under 15 words.
- One idea per comment. Put details beside the constant or branch they
  describe, not in a paragraph at the top.
- Don't restate the code, and don't copy values the code already names.
- No em dashes, arrows or semicolon chains. Write two sentences.
- Use active voice and plain words: "use", not "utilize"; "make sure", not
  "ensure".
- A reference name stays, kept short: `// getPrivateChannelUserTagsString: ...`.

```ts
// Bad
/** Whether the user may send messages in a channel. DMs always allow it; a thread is judged by the parent ... */
// Good
/** Returns whether the user may send in the channel. DMs always allow it. */
```

```kotlin
// Bad: repeats values the constants already hold, chained with a semicolon
// text at MESSAGE_CONTENT_INSET (64dp), with 12dp kept at the end; each message has 2dp above and below.

// Bad
// Lenient accessors for the loose, hand-parsed row shapes (missing/null/mistyped -> default).
// Good
// Lenient JSON reads: missing, null or mistyped yields the default.

// Bad: 11 lines about how Telegram scrolls
// Good
/** Scrolls to a row. Near rows animate. Far rows animate, jump, then animate the rest. */
```

## Maintenance

- **Backlog:** keep `TODO.md` up to date. Tick items when they are done,
  mark them *verify* when they haven't been compared with the reference,
  and add known issues under their area.
- **Reference assets:** rerun the scripts in `scripts/` when the reference
  is updated, as shown in the [README](README.md). Check the diff of the
  generated files before you commit it.
- **Dependency patches:** they live in `patches/`. When you upgrade a patched
  package, regenerate its patch, or remove it if the fix landed upstream.
- **Cached state:** bump `CACHE_VERSION` whenever the shape of a cached
  store changes.
- **Native contract:** `rows.ts` / `ChatRows.kt`, `theme.ts` / `ChatTheme`
  and the specs in `src/native/` must change together. A mismatch only
  shows up at runtime, as missing fields or dropped rows.
