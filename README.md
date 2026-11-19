# Isocord

An unofficial Discord client for Android, written from scratch in React Native
and built to stay faithful to the official mobile app. See [NOTICE.md](NOTICE.md)
before using or redistributing it.

## Development

Requires Bun, a JDK, the Android SDK and [uv](https://docs.astral.sh/uv/).

```sh
bun install        # also fetches Twemoji on the first run
bun start          # Metro
bun android        # build and run on a device or emulator
bun typecheck
bun lint
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the architecture, conventions and
maintenance notes, and [AGENTS.md](AGENTS.md) for rules for AI coding agents.

## Layout

```
src/
  app/        entry point, providers, navigation, feature registration
  core/       REST client, gateway, session, accounts, storage, feature API
  design/     generated tokens, Mana components, icons
  features/   one folder per feature, each exporting a Feature
  i18n/       message lookup and locale files
scripts/      extraction of tokens, icons and fonts from the reference material
```

Everything belonging to a logged-in account lives in a `Session`
(`src/core/session.ts`). Switching accounts disposes the session and creates a
new one. Features (`src/core/feature.ts`) contribute stores, gateway handlers,
screens and overlays; built-in features and future plugins use the same API.

## Regenerating extracted assets

```sh
bun scripts/extract-tokens.ts <discord-mobile-datamining>
bun scripts/extract-icons.ts <discord-mobile-datamining> <res.apk>
bun scripts/read-datamine.ts <datamined-file> [--apk <base.apk>]   # readable view of a reference file
scripts/extract-fonts.sh <base.apk>
bun run twemoji                                                    # re-fetch Twemoji after a version bump
```

Twemoji isn't committed. Everything extracted from Discord is, so a clone
builds without the reference material.
