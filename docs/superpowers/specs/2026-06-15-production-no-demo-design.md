# Production No-Demo Design

## Goal

The distributed desktop application must never present simulated matches, players, match history, builds, runes, or augments as if they belonged to the current user. Demo scenarios remain available only when explicitly enabled for local development.

## Runtime Modes

The frontend has two explicit runtime modes:

- **Production desktop**: Demo data is disabled. This is the default for Tauri builds and Windows installers.
- **Development demo**: Demo data is enabled only when `VITE_ENABLE_DEMO=true` is set for local browser or Tauri development.

The application must not infer Demo mode merely because LCU is unavailable.

## Production States

### Client Not Found

- Show the application shell, window controls, connection status, and diagnostics.
- Main content shows a concise waiting state: `等待 League Client`.
- Do not render the map stage, simulated champion, player cards, chat brief, build, rune, or augment recommendations.

### Client Running, No Match

- Show `已连接客户端，等待对局`.
- Keep diagnostics and window controls available.
- Do not render simulated match intelligence.

### Real Session Available

- LCU determines phase and mode.
- Champion-select player identities and later real data hydration may render the existing match-intelligence interface.
- Static version recommendation datasets may still be used when clearly labeled as version/statistical data; this is not Demo match data.
- Missing real player/history fields use an honest loading or unavailable state, never mock player values.

## Data Boundary

- `CompanionDataSource.detectSession()` returns `null` when LCU is unavailable in production.
- Mock matches are not used as the production session fallback.
- Existing mock fixtures may remain in the repository for tests and explicitly enabled development previews.
- The production UI must not expose `DemoScenarioSwitcher`.
- Production connection labels and diagnostics must not mention `Demo`.

The current mock `Match` object is also used as a layout template. During this change it may remain an internal structural seed only after a real LCU session is detected, but no mock player identity, history, score, party, or current-match claim may be displayed. Follow-up real-data work can replace that structural dependency incrementally.

## UI Structure

Add a dedicated disconnected/idle surface that fits the compact overlay:

- Connection icon or restrained status indicator.
- One primary status line.
- One short secondary line explaining that detection continues automatically.
- Diagnostics remain reachable.
- No scenario selector, fake map timer, fake champion, or dense empty cards.

This is a product state, not an error page.

## Error Handling

- LCU read failures return the application to the appropriate waiting state.
- A detected League process with unavailable LCU remains `client`, not disconnected.
- Losing LCU during a session clears displayed real-session data instead of preserving stale or mock values.
- OP.GG or Riot API failures may use labeled cached version data, but must not substitute fake player or match data.

## Verification

- Unit-test production data source behavior when LCU is unavailable.
- Unit-test explicit development Demo enablement.
- Verify production builds do not render `Demo 场景` or `Demo 模式`.
- Verify client-not-found and client-running idle states.
- Verify a real LCU session transitions into the match interface.
- Run lint, frontend tests, production build, Rust tests, and Windows installer build.
