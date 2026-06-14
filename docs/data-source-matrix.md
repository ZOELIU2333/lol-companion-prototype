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
| Arena augment metadata/icons | CommunityDragon `cdragon/arena/en_us.json` | High | External import wired | Text-only fallback | `npm run data:arena:augments:import` pulls current augment ids, names, rarity, descriptions, and icon paths. |
| Arena augment Chinese tier/popularity | MetaBot.GG Chinese Arena augment tier list | Medium | External import wired | Hide tier if unavailable | `npm run data:arena:metabot:import` pulls Chinese names, S/A/B/C/D/F tier, pick rate, rank, patch, and icon URL. Treat as popularity/tier, not exact combo win rate. |
| Mayhem (海克斯大乱斗) augment identity/icons | CommunityDragon `cherry-augments.json` (`ARAM_`-prefixed entries) | High | External import wired | Text-only fallback | `npm run data:mayhem:official:import` pulls the 170 genuine Mayhem augments (id, name, rarity, icon). Official layer; `officialCoverage` must be 1. |
| Mayhem strength/off-meta recommendations | Multi-source aggregate: METAsrc + OP.GG Mayhem pages, validated against `current-patch` | Medium-low; honest zeros when sites offline | Aggregator wired; both stat sites currently offline (403 / SPA) | Local tag-rule scoring labeled `本地规则兜底 · 非版本统计` | `npm run data:mayhem:refresh` + `data:mayhem:check`. Off-meta entries require >=500 same-patch structured samples. Snapshot records each source's online/offline health; one offline site does not break the pipeline. |
| Version strong builds/runes | OP.GG MCP `lol_get_champion_analysis`, cached locally and refreshed at runtime | Medium-high | Static seed + runtime MCP fetch wired | Built-in curated tables | UI label is "OP.GG 韩服钻石+" with cache freshness in the underlying meta. Riot does not directly provide public aggregate win-rate tables. |
| Augment combination scores | Multi-source Arena data: OP.GG Arena pages, LeagueOfGraphs augment popularity, METAsrc Arena samples, and later our own Riot Match-V5 aggregate | Medium-low until self-aggregated | Static data layer wired | Explainable local scoring | Do not rely on OP.GG alone. Separate popularity, sample win rate, champion fit, selected-augment synergy, and local game state. |
| Premade party detection | Derived from shared recent matches | Medium | Demo inference exists | Hide/mark inferred | This is an inference, not official party data. |
| Ban/report/punishment counts | No trusted legal source | Unavailable | Blocked | Do not show as real | Keep as unavailable unless a legal source is proven. |

## Recommended Build Order

1. Keep LCU as the session authority: phase, mode, champ select, and local summoner.
2. Add Live Client Data as the live-game authority: gold, items, level, game time, and active player state.
3. Use OP.GG MCP for player profile and match history when LCU provides Riot ID, then use Riot API only when an API key/platform route is configured.
4. Use Data Dragon and CommunityDragon for icons/static metadata.
5. Treat build/rune/augment meta as a separate recommendation-data layer that can start as curated static data and later be replaced by an aggregate backend.

## Mayhem (海克斯大乱斗) Data Layer

26.12 Mayhem is a 5v5 win/loss mode (no Arena top-4 / average-placement / round concepts). The data layer lives in `src/features/mayhem/` and `data/mayhem/`, fully isolated from the Arena augment data so the two never impersonate each other.

- Scope: 海克斯大乱斗 all ranks, patch 26.12. Ranked/normal player intel stays Korean Diamond+.
- Official layer: Riot + CommunityDragon. `npm run data:mayhem:official:import` pulls the 170 `ARAM_`-prefixed augments from `cherry-augments.json`. `officialCoverage` must equal 1.
- Stat layer: METAsrc and OP.GG Mayhem pages. Each site degrades independently — when a site is unreachable (Cloudflare / login wall / captcha / client-rendered SPA), the importer records `status: 'unavailable'` with a reason and the pipeline continues. A single-site failure must never break the snapshot.
- Candidate layer: aramgg.com, arammayhem.com. Community off-meta candidates must be validated by no fewer than 500 same-patch structured samples (`OFF_META_MIN_GAMES = 500`).
- Off-meta gate: an entry qualifies only when `games >= 500 && pickRate <= 15 && winRate > baseline && evidenceType === 'aggregate'`.
- Snapshot: `data/mayhem/<patch>/snapshot.json` (canonical builder `src/features/mayhem/snapshot.ts`; `scripts/mayhem/build-snapshot.mjs` mirrors it via `aggregate.mjs`, guarded by a parity test). The app reads the baked `src/data/mayhemSnapshot.ts`.
- Honest-data rule: when no aggregate source is online, `strength` and `offMeta` are empty (not fabricated); the UI shows `本地规则兜底 · 非版本统计` and `样本 —` / `置信 —` placeholders rather than invented numbers. Combination probabilities are never shown.
- Refresh: `npm run data:mayhem:refresh` (detect patch → import all → rebuild snapshot) and `npm run data:mayhem:check` (hard checks: patch match, `queue === 'aram-mayhem'`, `officialCoverage === 1`, every off-meta entry `games >= 500`; offline aggregate sources are soft warnings). Automated daily by `.github/workflows/mayhem-data-refresh.yml`.
- Current 26.12 status: CommunityDragon official online (170 augments); METAsrc offline (HTTP 403); OP.GG offline (client-rendered, no usable records); community candidates online. Strength/off-meta therefore empty pending a reachable aggregate source — recorded honestly in the snapshot's source health.

## Recommendation Data Layer

The first implementation lives in `src/data/recommendationData.ts`.

- Build data is keyed by champion id and now prefers OP.GG MCP detail cache for core items and item branches.
- Rune data is keyed by champion id and now prefers OP.GG MCP detail cache for the top rune page.
- OP.GG Korean Diamond+ champion stats live in `src/data/opggKrHighEloStats.ts`; the first seed covers the 10 champions visible in the prototype.
- OP.GG MCP champion details live in `src/data/opggKrHighEloDetails.ts`; `data/opgg/kr-diamond-plus-current-details.json` is the local cache.
- Runtime champion details are loaded through `src/services/opggChampionData.ts` when the desktop host is available. If the current champion is not covered by the local seed, the app calls OP.GG MCP, registers an in-memory cache entry, and recomputes builds/runes without blocking the demo fallback.
- The import flow is documented in `docs/opgg-data-import.md`; `npm run data:opgg:import` regenerates the ranking seed and `npm run data:opgg:details:import` refreshes MCP details.
- Augment metadata now comes from external CommunityDragon import: `data/arena/communitydragon-augments-current.json` and `src/data/arenaAugments.ts`.
- Chinese Arena augment tier/popularity now comes from MetaBot.GG import: `data/arena/metabot-zh-cn-augments-current.json` and `src/data/metabotArenaAugments.ts`.
- Augment combination scoring still contains selected-augment profiles, tag bridges, and item-chain presets. It is currently a local rule model, not an OP.GG win-rate or pick-rate cache.
- New patch augment combos need a dedicated refresh path. Do not treat OP.GG as the only source:
  - OP.GG Arena pages: useful for champion-specific Arena build, augment, item, and skill references.
  - LeagueOfGraphs Arena augment pages: useful for broad augment popularity by patch, region, and rank filter.
  - METAsrc Arena pages: useful as a second opinion for champion-specific sample size, augment, item, and win-rate style rankings.
  - Riot Match-V5 self-aggregation: the target high-confidence source for our own `champion + selected augments + candidate augment + final placement + item path` model.
- LeagueOfGraphs and METAsrc currently return Cloudflare challenges to direct CLI fetches, so they should not be treated as reliable unattended import jobs until we use an approved API path, browser-mediated export, or our own Riot Match-V5 aggregation.
- Until the self-aggregated model exists, the UI must label augment output as source-mixed route guidance, not precise global probability.
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
