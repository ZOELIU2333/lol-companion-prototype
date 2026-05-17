# LOL Companion Plugin Landing Architecture

## Locked Product Shape

This prototype is the visual and product baseline for a WeGame-like League of Legends companion plugin.

- Ranked / normal mode is a pregame intelligence surface only.
- Arena / augment mode keeps a live surface because augment scoring depends on current candidates and previously selected augments.
- The app avoids teaching content. It is for experienced players who want fast intel and actions.
- Player intel, version-strong rune pages, version-strong item loadouts, chat brief, and match detail are the primary ranked surfaces.
- Item loadout and rune page actions are mock "one click apply" actions now, intended to become plugin-host actions later.

## Frontend Boundaries

- `src/App.tsx`: thin shell that renders the current session.
- `src/app/useCompanionSession.ts`: session orchestration for selected match, phase, detection state, toasts, and plugin actions.
- `src/components/`: presentational overlay and card surfaces.
- `src/lib/`: derived recommendation and chat brief logic.
- `src/data/mockMatches.ts`: demo data only.
- `src/services/`: future integration boundary for plugin data and host actions.

## Integration Boundaries

`CompanionDataSource` is the read side:

- Detect current League session.
- List available/demo matches.
- Return a match snapshot that the UI and recommendation layer understand.

`PluginActions` is the write side:

- Apply item loadout.
- Apply rune page.
- Send chat brief.

Both are mocked today. Real implementations should replace the service objects without changing component props.

## LCU Adapter Contract

`src/services/lcuAdapter.ts` and `src/services/tauriHost.ts` now contain the first local-client bridge boundary:

- Parse the League Client `lockfile`.
- Build the local authenticated LCU base URL.
- Read gameflow phase, queue/session metadata, and current summoner through a host-provided request function.
- Map LCU queue descriptions into the product's ranked/augment mode split.
- Invoke Tauri commands when the app is running inside the desktop shell, and fall back to demo data in the browser.

The React layer stays host-agnostic on purpose. The Tauri shell provides filesystem and HTTPS access without pulling desktop assumptions into components.

## Desktop Shell

The first desktop host lives in `src-tauri/`:

- `read_lcu_session`: finds the Windows League Client `lockfile`, calls local LCU endpoints, and returns phase, mode, summoner name, and source.
- The overlay includes a lightweight connection diagnostics panel for Windows validation. It reports League Client/LCU, Live Client Data, and OP.GG MCP availability separately so a failed setup can be diagnosed without reading logs.
- The diagnostics panel also reports whether the app is running in the Tauri desktop shell, exposes the current LCU phase when available, distinguishes `127.0.0.1:2999` Live Client failures, and has a manual refresh action for test sessions.
- `set_overlay_always_on_top`: toggles the floating window above other windows.
- `set_overlay_compact`: switches the overlay between standard and compact sizes.

This is a desktop floating window, not DirectX/game injection.

## Real Data Sources

Use Riot and local data conservatively:

- **LCU**: local client/session detection and available client-side state.
- **Riot API**: public ranked entries, recent match history, match detail, match timeline, champion mastery.
- **Data Dragon**: champion, item, rune, summoner spell metadata and icons.

Do not fake hidden or private data such as reports, bans, hidden MMR, or moderation state.

## Riot API Adapter

`src/services/riotApiAdapter.ts` now contains the first public-data read path:

- Resolve Riot ID to PUUID through Account-V1 when only game name and tag line are known.
- Fetch recent match IDs and match details through Match-V5.
- Map match details into UI-ready recent-history rows: champion, queue, win/loss, KDA, CS/min, kill participation, and a derived score.
- Keep `getPlayerIntel` empty until ranked entries, mastery, and timeline-derived metrics are wired together.

This adapter is intentionally host-driven. The frontend does not own API keys; a browser, Tauri, or backend host supplies `fetchJson` and credentials.

## Next Engineering Steps

1. Install Rust/Cargo on the dev machine and run `npm run tauri:dev` against a real League Client session.
2. Add a host-backed Riot API key strategy for local development and production packaging.
3. Derive real `PlayerIntel` from ranked entries, mastery, recent match history, and timelines.
4. Move versioned item/rune metadata beyond icons into a Data Dragon catalog module.
5. Replace mock `PluginActions` with the desktop/plugin host bridge.
6. Expand LCU reads for champion select participants and augment candidates when those endpoints are available.
