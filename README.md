# Flip Tracker Pro

A professional standalone Tampermonkey application for Torn flip tracking.

Current version: `0.8.0`

## What It Does

Flip Tracker Pro adds a floating desktop-style app window on Torn pages. It supports manual purchase tracking, FIFO sale recording, portfolio summaries, statistics, backups, Torn API settings, item price refresh, and Torn log import groundwork.

The installable release is a single readable userscript with no runtime dependency on GitHub, CDNs, external CSS, frameworks, jQuery, or module imports.

## Development Structure

```text
src/
  core/
  services/
  ui/
  modules/
  styles/
  utils/
  models/
scripts/
  build-userscript.js
dist/
  flip-tracker-pro.user.js
docs/
  greasyfork-release.md
```

Source stays modular under `src/` for development. The release build combines the source into one complete userscript.

## Build

Run from the repository root:

```bash
node scripts/build-userscript.js
```

The standalone userscript is generated here:

```text
dist/flip-tracker-pro.user.js
```

The build script uses only vanilla Node built-ins. No bundlers or npm packages are required.

## Manual Tampermonkey Install

1. Open `dist/flip-tracker-pro.user.js`.
2. Copy the full file contents.
3. Open Tampermonkey.
4. Create a new script.
5. Paste the script contents.
6. Save.
7. Visit `https://www.torn.com/`.
8. Click the small `FT` launcher to open Flip Tracker Pro.

## Torn API Privacy

Flip Tracker Pro is read-only. It never asks for Torn passwords.

Your API key is stored locally in your browser only and is used only for official Torn API requests. You can clear the key from Settings at any time.

Recommended key type: Custom.

Required selections:

```text
key -> info
user -> log
torn -> items
market -> itemmarket
```

Required user log IDs:

```text
1225, 1220, 4201, 1112, 4200, 5927, 5510
```

## Release Notes

See `docs/greasyfork-release.md` for build, test, and GreasyFork readiness notes.
