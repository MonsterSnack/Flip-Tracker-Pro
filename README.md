# Flip Tracker Pro

A professional standalone Tampermonkey application for Torn flip tracking.

Current version: `0.8.2`

## What It Does

Flip Tracker Pro adds a floating desktop-style app window on Torn pages. It supports manual purchase tracking, FIFO sale recording, portfolio summaries, statistics, backups, Torn API settings, item price refresh, and Torn log import diagnostics.

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

Use a Torn Full Access API key for now. Flip Tracker Pro stores it locally in your browser only and only sends it to Torn API endpoints. No Torn password is ever required. You can clear the key from Settings at any time.

## Log Import IDs

Buy log IDs:

```text
1225, 1220, 4201, 1112, 1103, 4200, 5927, 5510
```

Sell log IDs:

```text
1226, 1221, 1113, 1104, 4210, 5928, 5511
```

Version 0.8.2 classifies logs by Torn log type ID first, then falls back to text parsing for known buy/sell wording.

## Log Import Diagnostics

Settings includes:

- Import latest logs, which checks the last 24 hours first and then the last 7 days if no logs are returned.
- Import date range, with same-day ranges treated as the full day.
- Test raw log API, which calls unfiltered `user -> log` with no date or log ID filters.
- Copy debug report, which excludes the API key.

The debug report now includes raw and normalized counts, buy/sell ID matches, text matches, imported counts, duplicate skips, unmatched sales, first sanitized log samples, and timing details.

## Release Notes

See `docs/greasyfork-release.md` for build, test, and GreasyFork readiness notes.