# LOL Companion Prototype

A WeGame-like League of Legends desktop companion prototype built with React, Vite, TypeScript, and Tauri 2.

The project is currently focused on a plugin-style overlay experience:

- Pregame player intelligence for both teams.
- Clickable player details with recent match history and match detail views.
- Version-strong item builds and rune pages using OP.GG Korean Diamond+ data.
- Arena/augment live recommendation prototype.
- Tauri desktop shell with floating-window controls.
- Local League Client/LCU detection, Live Client Data reads, and OP.GG MCP integration.
- Demo and cache fallback paths when real data is unavailable.

## Windows Quick Install

For normal Windows testing, you should not need Node.js, Rust, Cargo, or Tauri prerequisites.

1. Open the GitHub repo:

   https://github.com/ZOELIU2333/lol-companion-prototype

2. Go to `Actions` -> `Windows Installer`.
3. Click the latest successful run.
4. Download one artifact:
   - `LOL-Companion-Windows-Portable`: unzip and double-click `lol-companion.exe`. This is the fastest test path.
   - `LOL-Companion-Windows-Installer`: unzip and run an installer.
5. If you choose the installer artifact, run one installer:
   - Prefer `LOL Companion_*_x64-setup.exe` if available.
   - Use `.msi` if Windows blocks the setup executable.

The app is currently unsigned, so Windows SmartScreen may show a warning. For this early internal build, choose `More info` -> `Run anyway` only if you downloaded it from this repo's GitHub Actions. Always unzip the artifact before running the `.exe` or `.msi`.

Every push to `main` creates a fresh Windows artifact. You can also open `Actions` -> `Windows Installer` -> `Run workflow` to build one manually.

## Tech Stack

- React 19
- Vite
- TypeScript
- Tauri 2
- Rust
- OP.GG MCP HTTP API
- Riot API support for keyed local development

## Requirements

These are only required for local development:

- Node.js 20+
- npm
- Git
- Rust/Cargo
- Tauri system dependencies

For Windows, follow the official Tauri prerequisites:

https://v2.tauri.app/start/prerequisites/

League of Legends real-client testing is Windows-first. The browser demo works on macOS, but LCU and Live Client Data need a local League Client/game process.

If you only want to install and try the app on Windows, use the `Windows Quick Install` flow above instead.

## Install

```bash
git clone https://github.com/ZOELIU2333/lol-companion-prototype.git
cd lol-companion-prototype
npm install
```

## Run Browser Demo

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

The browser demo uses mock/demo data and static OP.GG cache fallback.

## Run Desktop App

```bash
npm run tauri:dev
```

In the app, open the `诊断` panel to check:

- `Desktop Shell`: whether the app is running inside Tauri.
- `League Client`: whether LCU is connected and which phase is active.
- `Live Client`: whether `127.0.0.1:2999` is available during a running game.
- `OP.GG MCP`: whether version/player data requests are reachable.

## Windows Test Flow

1. Start the app with `LOL-Companion-Windows-Portable`, install it with the Windows installer from GitHub Actions, or run `npm run tauri:dev` if you are developing locally.

2. Before opening LOL:
   - `Desktop Shell` should be normal.
   - `League Client` should show not connected/demo.
   - `Live Client` should show unavailable.

3. Open League Client:
   - `League Client` should become normal.
   - The diagnostic detail should show the current LCU phase.

4. Enter champ select:
   - LCU phase should move toward `ChampSelect`.
   - Player slots should attempt to hydrate from real account data when available.

5. Enter an actual game:
   - `Live Client` should become normal once `127.0.0.1:2999` is available.
   - Live recommendations should use game time, gold, level, and item ids.

6. Click a player:
   - Profile, recent 10 matches, and match details should show `OP.GG`, `Riot`, `Demo`, or `同步中` source indicators.

## Riot API Data

Riot API is optional. OP.GG MCP works without a Riot API key for supported public data paths. For local Riot API testing, copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Then fill:

```bash
RIOT_API_KEY=RGAPI-your-development-key
VITE_RIOT_DEFAULT_REGION=asia
VITE_RIOT_DEFAULT_PLATFORM=kr
VITE_RIOT_ACCOUNT_OVERRIDES={"蓝量不够Q":{"gameName":"Your Riot Name","tagLine":"KR1","region":"asia","platform":"kr"}}
```

The desktop app uses `RIOT_API_KEY` in the Tauri backend so the key is not exposed to the web UI. `VITE_RIOT_API_KEY` is only for browser-demo fallback and should not be used for production.

## Mock Development

Mock LCU:

```bash
npm run mock:lcu
```

Then in another terminal:

```bash
LEAGUE_CLIENT_LOCKFILE=/tmp/lol-companion-mock-lcu/lockfile npm run tauri:dev
```

Mock Riot API:

```bash
npm run mock:riot
```

Mock Live Client Data:

```bash
npm run mock:live
LIVE_CLIENT_DATA_BASE_URL=http://127.0.0.1:30099 npm run tauri:dev
```

Combined mock loop:

```bash
RIOT_API_KEY=mock \
RIOT_API_BASE_URL=http://127.0.0.1:30080 \
VITE_RIOT_API_BASE_URL=http://127.0.0.1:30080 \
LEAGUE_CLIENT_LOCKFILE=/tmp/lol-companion-mock-lcu/lockfile \
npm run tauri:dev
```

## Data Sources

- LCU lockfile and local LCU HTTPS endpoints for client/session/champ-select state.
- Live Client Data at `https://127.0.0.1:2999/liveclientdata/allgamedata` during a running game.
- OP.GG MCP for champion analysis, summoner profile, recent matches, and match details.
- Riot API as an optional keyed fallback for account, match, ranked, and mastery data.
- Data Dragon for item/champion/rune icons.

Refresh local OP.GG cache after a live patch:

```bash
npm run data:opgg:details:import -- --patch 16.11
npm run data:opgg:import
npm run data:arena:augments:import
npm run data:arena:metabot:import
npm run test
```

Update `src/services/dataDragon.ts` when Riot publishes a new Data Dragon version. The current default is `16.11.1`.

See:

- `docs/data-source-matrix.md`
- `docs/opgg-data-import.md`
- `docs/plugin-landing-architecture.md`

## Verification

```bash
npm run test
npm run lint
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

## Useful Scripts

```bash
npm run dev
npm run tauri:dev
npm run test
npm run lint
npm run build
npm run data:arena:augments:check
npm run data:arena:metabot:check
npm run data:opgg:details:check
```

## Notes

This is an early prototype. It does not inject into the game renderer or use a DirectX overlay. The first version is a desktop floating window with local client integrations and demo fallbacks.
