# Notice

Isocord is an unofficial, third-party client. It is not affiliated with,
endorsed by, or supported by Discord Inc.

## Discord assets

The following files are the property of Discord Inc. and are **not** covered
by this project's licence. They are included only so the client can look and
behave like the official app, and are extracted from the official Android
application by the scripts in `scripts/`:

- `android/app/src/main/assets/fonts/` — gg sans, gg mono, ABC Ginto and the
  bundled Noto Sans and Source Code Pro builds
- `src/design/icons/images/` — icon artwork
- `src/design/tokens/generated/` — design token values (colours, typography,
  spacing, shadows)

"Discord" and its logos are trademarks of Discord Inc. If you are a rights
holder and want any of these files removed, open an issue.

## Twemoji

The APK bundles the Twemoji graphics
(https://github.com/jdecked/twemoji), Copyright 2019 Twitter, Inc. and other
contributors, licensed under CC-BY 4.0
(https://creativecommons.org/licenses/by/4.0/). They aren't in this repository.
`scripts/fetch-twemoji.sh` downloads them into `android/app/src/main/assets/twemoji/`,
copies the PNGs unchanged and builds `Twemoji.ttf` from the SVGs.

## Terms of service

Using a third-party client with a Discord user account is against Discord's
Terms of Service and may put the account at risk. Use it at your own
discretion.
