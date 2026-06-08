# LOL Companion Data Source Matrix

This matrix keeps product claims tied to data we can actually obtain.

| Feature | Primary source | Confidence | Current status | Fallback | Notes |
| --- | --- | --- | --- | --- | --- |
| Client running / game phase | LCU lockfile + Gameflow API | High on local machine | Wired through Tauri | Demo mode | Requires League Client running locally. |
| Champ select players | LCU champ-select session | Medium | Wired through Tauri | Mock player slots | Enemy identity can vary by queue/client exposure. |
| Live gold / level / current items | Live Client Data API | High during game | Next implementation slice | Demo live state | Local game process endpoint, no Riot API key needed. |
| Recent 10/20 matches | OP.GG MCP `lol_list_summoner_matches`, Riot Match-V5 as keyed fallback | Medium-high | OP.GG adapter wired, Riot adapter wired | Demo history | OP.GG route does not need Riot API key; requires Riot ID and supported OP.GG region. |
| Rank / LP tier | OP.GG MCP `lol_get_summoner_profile`, Riot League-V4 as keyed fallback | Medium-high | OP.GG adapter wired, Riot adapter wired | Demo rank | OP.GG route is best first pass for desktop users without an API key. |
| Champion mastery / champion pool top 3 | OP.GG MCP ranked-most champions, Riot Champion-Mastery-V4 as keyed fallback | Medium | OP.GG adapter wired, Riot adapter wired | Demo mastery | OP.GG gives champion pool and win rate; Riot mastery gives mastery points/level. |
| Item/rune/champion names and icons | Data Dragon | High | Partially wired | Version-pinned static URLs | Cache later so the overlay stays usable offline. |
| Arena augment icons | CommunityDragon | Medium | Partially wired | Text-only fallback | Community resource paths can move across patches. |
| Version strong builds/runes | OP.GG MCP `lol_get_champion_analysis`, cached locally and refreshed at runtime | Medium-high | Static seed + runtime MCP fetch wired | Built-in curated tables | UI label is "OP.GG 韩服钻石+" with cache freshness in the underlying meta. Riot does not directly provide public aggregate win-rate tables. |
| Augment combination scores | Static `recommendationData` profiles + rule scoring, later aggregate/community source | Medium-low | Static data layer wired | Explainable local scoring | Must show reasons. Do not present as global win rate until sourced. |
| Premade party detection | Derived from shared recent matches | Medium | Demo inference exists | Hide/mark inferred | This is an inference, not official party data. |
| Ban/report/punishment counts | No trusted legal source | Unavailable | Blocked | Do not show as real | Keep as unavailable unless a legal source is proven. |

## Recommended Build Order

1. Keep LCU as the session authority: phase, mode, champ select, and local summoner.
2. Add Live Client Data as the live-game authority: gold, items, level, game time, and active player state.
3. Use OP.GG MCP for player profile and match history when LCU provides Riot ID, then use Riot API only when an API key/platform route is configured.
4. Use Data Dragon and CommunityDragon for icons/static metadata.
5. Treat build/rune/augment meta as a separate recommendation-data layer that can start as curated static data and later be replaced by an aggregate backend.

## Recommendation Data Layer

The first implementation lives in `src/data/recommendationData.ts`.

- Build data is keyed by champion id and now prefers OP.GG MCP detail cache for core items and item branches.
- Rune data is keyed by champion id and now prefers OP.GG MCP detail cache for the top rune page.
- OP.GG Korean Diamond+ champion stats live in `src/data/opggKrHighEloStats.ts`; the first seed covers the 10 champions visible in the prototype.
- OP.GG MCP champion details live in `src/data/opggKrHighEloDetails.ts`; `data/opgg/kr-diamond-plus-current-details.json` is the local cache.
- Runtime champion details are loaded through `src/services/opggChampionData.ts` when the desktop host is available. If the current champion is not covered by the local seed, the app calls OP.GG MCP, registers an in-memory cache entry, and recomputes builds/runes without blocking the demo fallback.
- The import flow is documented in `docs/opgg-data-import.md`; `npm run data:opgg:import` regenerates the ranking seed and `npm run data:opgg:details:import` refreshes MCP details.
- Augment data contains selected-augment profiles, tag bridges, and item-chain presets.
- `src/lib/recommendations.ts` is responsible for dynamic scoring only: enemy composition, selected augments, current state, and conflict penalties.
- Short-term version data is marked as `source: opgg-kr-high-elo`; for covered champions, the concrete build/rune data comes from OP.GG MCP detail cache rather than hand-written templates.
- Target source page: `https://op.gg/zh-cn/lol/champions?region=kr&tier=diamond_plus`.

Current static seed coverage: Ahri, Camille, Draven, Ezreal, Kai'Sa, Lee Sin, Mordekaiser, Nautilus, Syndra, and Thresh. Runtime MCP fetch is the bridge for broader champion coverage before we add a persistent full-cache importer.

## Player Data Layer

- OP.GG MCP player adapter lives in `src/services/opggMcpAdapter.ts`.
- Internal account conversion helpers live in `src/services/opggPlayerData.ts`.
- Tauri proxies OP.GG MCP through `opgg_mcp_call` so the desktop shell does not depend on browser CORS behavior.
- OP.GG and Riot player profile/history/detail reads use a best-effort 30-minute browser `localStorage` cache, keyed by region, Riot ID, and match id where applicable.
- Currently supported OP.GG player tools:
  - `lol_get_summoner_profile`
  - `lol_list_summoner_matches`
  - `lol_get_summoner_game_detail`

Recommended OP.GG Korean Diamond+ fields:

- `patch`: game patch used when the data was collected.
- `region`: `kr`.
- `rank`: `diamond+`.
- `sampleSize`: match count when visible.
- `winRate` and `pickRate`: optional aggregate stats for builds or rune pages.
- `confidence`: medium by default for manually copied public meta data.
