# GreasyFork Release

Flip Tracker Pro 0.8.6-debug ships as a standalone Tampermonkey/Greasemonkey userscript.

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
10. Open Settings and confirm backup, API key settings, Raw Log Test, Copy debug report, Copy raw recognized logs, and log import controls render.
11. Run `Raw Log Test` and confirm raw logs, normalized logs, buy ID matches, sell ID matches, and recognized samples appear in the debug panel.
12. Use `Copy raw recognized logs` and confirm the JSON includes only the first 10 recognized logs with `entryId`, `logTypeId`, `timestamp`, `title`, `textPreview`, `rawKeys`, `rawLog`, `rawCategory`, `rawDataPreview`, and `rawParamsPreview`.
13. Confirm the copied raw recognized log report does not contain the API key.
14. Run `Import latest logs` and confirm the Import Debug section shows the first 3 recognized logs with compact `data` and `params` previews.
15. If items remain in Needs Review, confirm editable fields still work, then use Save as Purchase, Save as Sale, Ignore, and Delete from review.

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

Use a Torn Custom API key with the required selections only.

Flip Tracker Pro stores it locally in your browser only and only sends it to Torn API endpoints. No Torn password is ever required.

## Log Import IDs

Buy log IDs:

```text
1225, 1220, 4201, 1112, 1103, 4200, 5927, 5510
```

Sell log IDs:

```text
1226, 1221, 1113, 1104, 4210, 5928, 5511
```

## Log Import Diagnostics

- `Raw Log Test` calls unfiltered `user -> log` and stores only sanitized limited debug samples.
- `Import latest logs` checks the last 24 hours first, then the last 7 days only if no logs are returned.
- `Copy raw recognized logs` copies a small JSON report for the first 10 recognized buy/sell logs.
- The raw recognized log report includes sanitized `raw.data` and `raw.params` previews so the next parser pass can map the real Torn API fields.
- Sanitization removes keys containing `key`, `token`, `password`, or `secret`.
- Sanitization limits recursion depth, arrays, object keys, and string length.
- Full raw logs are not stored permanently.
- The API key is never included in debug reports.