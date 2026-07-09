# GreasyFork Release

Flip Tracker Pro 0.8.1 ships as a standalone Tampermonkey/Greasemonkey userscript.

## Build

Run from the repository root:

```bash
node scripts/build-userscript.js
```

The build writes:

```text
dist/flip-tracker-pro.user.js
```

The build script uses only Node's built-in `fs` and `path` modules. It does not use webpack, Rollup, Vite, esbuild, Babel, npm packages, CDNs, or runtime imports.

## Test In Tampermonkey

1. Open Tampermonkey.
2. Create a new script.
3. Paste the contents of `dist/flip-tracker-pro.user.js`.
4. Save the script.
5. Visit `https://www.torn.com/`.
6. Confirm the small `FT` launcher appears.
7. Click `FT` and confirm the app expands.
8. Check that the window can be dragged and resized.
9. Add an open purchase, record a sale, and confirm portfolio/history/statistics update.
10. Open Settings and confirm backup, API key settings, item price refresh, raw log test, debug report copy, and log import controls render.

## GreasyFork Notes

- The final script is standalone.
- The final script has no external runtime dependencies.
- The final script is readable and not minified.
- The final script does not use `@require`.
- The final script does not load GitHub-hosted source files.
- The final script does not depend on external CSS, CDNs, frameworks, or jQuery.
- The script runs only on Torn pages via `https://www.torn.com/*` and `https://torn.com/*`.
- Torn API use is read-only.
- The Torn API key is stored locally in the user's browser only.
- The Torn API key is sent only to official Torn API endpoints.
- No Torn password is ever required.

## API Key Guidance

Recommended key type: Custom.

Required selections:

```text
key -> info
user -> log
torn -> items
market -> itemmarket
```

Required user log IDs for Custom Key permissions:

```text
1225, 1220, 4201, 1112, 4200, 5927, 5510
```

These log IDs are key setup requirements. Flip Tracker Pro does not send them as `log=` request filters by default.

Users should create the key on Torn's official API settings page and manually paste the generated key into Flip Tracker Pro.

## Log Import Diagnostics

- `Test raw log API` calls unfiltered `user -> log` with no date filter and no log ID filter.
- `Import latest logs` checks the last 24 hours first, then the last 7 days if no logs are returned.
- Date ranges that start and end on the same day include the full day, ending at 23:59:59.
- `Copy debug report` excludes the API key and includes sanitized endpoint, params, counts, first log texts, and last error details.
