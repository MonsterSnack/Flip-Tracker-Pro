# GreasyFork Release

Flip Tracker Pro 0.8.3 ships as a standalone Tampermonkey/Greasemonkey userscript.

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
10. Open Settings and confirm backup, API key settings, item price refresh, Raw Log Test, debug report copy, and log import controls render.
11. Run `Raw Log Test` and confirm raw logs, normalized logs, buy ID matches, sell ID matches, recognized samples, and timings appear in the debug panel.
12. Run `Import latest logs`; if buy IDs are detected but purchases are not saved, confirm the Needs review count explains why.

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

Use a Torn Full Access API key for now.

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

Version 0.8.3 classifies by Torn log type ID first. Text parsing remains as a fallback for visible Torn log wording such as item market buys and sells. Recognized buy/sell logs become imports, duplicate skips, or Needs review items.

## Log Import Diagnostics

- `Raw Log Test` calls unfiltered `user -> log` with no date filter and no log ID filter.
- `Import latest logs` checks the last 24 hours first, then the last 7 days only if no logs are returned.
- If raw logs exist but none classify, the UI reports that the parser/classifier did not match.
- If recognized log IDs exist but imports are zero, the UI shows duplicates, parser failures, validation failures, and Needs review items.
- Date ranges that start and end on the same day include the full day, ending at 23:59:59.
- `Copy debug report` excludes the API key and includes sanitized endpoint, params, raw and normalized counts, buy/sell ID matches, text matches, candidate counts, saved counts, duplicate skips, unmatched sales, review candidates, parser failures, validation failures, first sanitized samples, and timing details.