# Windows stale cache recovery design

## Problem

The Windows production shell loads `http://tauri.localhost/` successfully, but React fails during its first render with `Cannot read properties of undefined (reading 'map')`. The same production bundle renders in a fresh browser profile. The desktop-only difference during initial recommendation construction is the persisted OP.GG champion-detail cache, which is currently trusted after `JSON.parse` without runtime shape validation.

An older cached response can therefore override the bundled, valid OP.GG seed and crash recommendation construction before the application can report `frontend-ready`.

## Outcome

The desktop application must render even when OP.GG local storage contains malformed, partial, or obsolete data. Invalid cache data must never enter the runtime recommendation store. The application must fall back to bundled recommendation data automatically and retain enough diagnostics to identify any unrelated future startup failure.

## Design

### Cache boundary

Add a focused runtime validator at the persistence boundary in `opggChampionData.ts`. It validates the fields used synchronously by recommendation construction:

- champion identity and supported position;
- summary and average statistics;
- item sets, including `ids` and `idsNames` arrays;
- fourth- and fifth-item arrays;
- rune identifier and name arrays;
- strong- and weak-counter arrays.

`readPersistedDetail` returns a value only after validation. When parsing or validation fails, it removes that champion's invalid cache entry on a best-effort basis and returns `null`. The existing bundled OP.GG seed remains the fallback.

Fresh MCP responses pass through the same validator before registration and persistence, so a partial upstream response cannot become the next startup failure.

### Rendering safety

Keep the existing pre-React fallback page. Extend the early error reporter to include the column number and a redacted, length-limited JavaScript stack when available. This does not replace cache validation; it makes any different future first-render failure actionable from one log file.

Add a React error boundary at the desktop root. If an unexpected render error escapes domain validation, the window shows a compact recovery message instead of remaining black and reports a `react-render-error` frontend stage to the Rust diagnostics command.

### Diagnostics contract

The Rust `report_frontend_status` command accepts the new `react-render-error` stage. Diagnostic details continue through the existing redaction and length limits. No local-storage contents, credentials, LCU secrets, or full user paths are logged.

## Testing

- Unit-test valid persisted OP.GG data acceptance.
- Unit-test malformed JSON, missing arrays, and obsolete partial objects falling back without throwing.
- Unit-test invalid cached entries are removed.
- Unit-test invalid freshly fetched MCP data is not registered or persisted.
- Component-test the desktop error boundary renders its recovery UI and reports the failure stage.
- Run the complete frontend tests, lint, production build, Rust tests, formatting, and checks.
- Build on the GitHub Windows runner and publish the resulting installer to the latest Actions run.

## Acceptance criteria

- The supplied failure scenario cannot reproduce a black screen from stale OP.GG cache.
- A fresh Windows launch reaches `frontend-ready`, or shows a readable recovery UI for an unrelated render failure.
- Invalid OP.GG cache automatically falls back to bundled data without user cleanup.
- The latest GitHub Actions run contains `LOL-Companion-Windows-Installer`.
