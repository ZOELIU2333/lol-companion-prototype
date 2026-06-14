# Windows Drag And Client Detection Design

## Goal

Fix two Windows desktop-shell regressions:

1. The borderless overlay cannot be moved by dragging ordinary non-interactive areas.
2. A running League Client is reported as disconnected when its lockfile is outside the small set of hard-coded install paths.

## Window Dragging

- Grant the Tauri window `startDragging` capability.
- Start native window dragging from a primary-button press on any non-interactive application area.
- Preserve normal behavior for buttons, links, form controls, player rows, expandable match rows, scrollbars, and other explicitly interactive elements.
- Keep existing `data-tauri-drag-region` markers as a passive fallback, but do not restrict dragging to the title area.
- Browser preview mode must remain usable and must not throw when the Tauri runtime is absent.

## League Client Detection

Detection uses two levels:

1. **LCU session detection**: read a valid lockfile and query the local LCU HTTPS API.
2. **Process fallback**: when a League client process is running but LCU is still starting, unreachable, or installed in an unknown location, report the client as connected rather than falling back to Demo.

On Windows, lockfile candidates are collected in this order:

1. `LEAGUE_CLIENT_LOCKFILE` environment override.
2. Parent directories of running `LeagueClientUx.exe` and `LeagueClient.exe` processes.
3. Existing standard Riot installation paths.
4. Common Riot installation paths across available Windows drive letters.

The process fallback must not claim that a match is active. It returns a client-running phase that maps to the existing `client` UI state. Champion select and active-game phases continue to map to the `match` state only when LCU confirms them.

No lockfile password, authorization header, or other secret may be exposed to the frontend or diagnostics.

## Diagnostics

- `Desktop Shell`: normal when running inside Tauri.
- `League Client`: connected when either LCU responds or a League client process is detected.
- `Live Client`: remains disconnected until the live-game endpoint is actually available.
- Diagnostic detail may include the detection method and non-secret executable or lockfile path to make Windows installation issues diagnosable.

## Error Handling

- Failure to inspect processes, read a lockfile, or query LCU must not crash the application.
- If no client process and no valid LCU session are found, keep the current Demo fallback.
- If a process exists but LCU is unavailable, show connected-client state and continue polling.

## Verification

- Unit-test interactive-target filtering for drag initiation.
- Unit-test process executable path to lockfile candidate derivation.
- Unit-test normalization of the client-running fallback into the frontend `client` state.
- Run frontend tests, lint, build, and Rust tests locally.
- Build the Windows installer in GitHub Actions.
- On Windows:
  - Launch the app without League: Demo state.
  - Launch League Client without entering a game: connected-client state.
  - Enter champion select: detected-match state.
  - Drag from several blank/content areas: window moves.
  - Click buttons, player rows, and match rows: actions still work without unintended dragging.
