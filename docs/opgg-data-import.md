# OP.GG Korean Diamond+ Data Import

The app labels short-term version recommendations as `OP.GG 韩服钻石+`.

The preferred detail source is the official OP.GG MCP HTTP service at `https://mcp-api.op.gg/mcp`.

Current commands:

- `npm run data:opgg:import`: regenerate the champion ranking seed from `data/opgg/kr-diamond-plus-current-prototype.json`.
- `npm run data:opgg:details:import`: call OP.GG MCP `lol_get_champion_analysis` for the seeded champions and regenerate detail cache.
- `npm run data:opgg:details:check`: verify the generated TypeScript detail module matches the JSON cache.

Detail cache outputs:

- `data/opgg/kr-diamond-plus-current-details.json`
- `src/data/opggKrHighEloDetails.ts`

The app now prefers MCP detail data for:

- Champion win rate, pick rate, rank, and sample count.
- Core item sets, boots, fourth-item and fifth-item branches.
- Rune page ids/names/icons.
- Strong and weak matchup counters.

At runtime, the Tauri shell can also call `lol_get_champion_analysis` through the `opgg_mcp_call` command. `src/services/opggChampionData.ts` parses that response, registers an in-memory detail cache, and writes a best-effort browser `localStorage` cache, so champions outside the small static seed can still show OP.GG Korean Diamond+ builds and runes once the MCP request succeeds.

Direct command-line requests to public OP.GG pages can return a CloudFront/WAF challenge, so the browser-visible fallback flow is:

1. Open `https://op.gg/zh-cn/lol/champions?region=kr&tier=diamond_plus` in the browser.
2. Confirm the filters show `KR`, `Diamond +`, the target patch, and `单排/双排`.
3. Extract the visible/loaded champion rows into a JSON payload with:
   - `meta`: source, patch, region, rank, sample size, source URL.
   - `rows`: champion key, Chinese name, role, rank, win rate, pick rate, and OP.GG href.
4. Save the payload under `data/opgg/`.
5. Run `npm run data:opgg:import -- --input <payload.json>`.

For this prototype, `data/opgg/kr-diamond-plus-current-prototype.json` intentionally keeps the 10 champions used by the visible mock matches. The generated MCP detail cache is still local and should be refreshed when the live patch or target tier changes. Runtime MCP results are cached in the browser profile after the first successful request; later we can promote that into a managed on-disk cache with patch expiry.

Refresh for a new live patch:

```bash
npm run data:opgg:details:import -- --patch 16.11
npm run data:opgg:import
```

## Arena Augment Metadata Import

Arena augment names, ids, rarity, descriptions, and icon paths are imported from CommunityDragon:

```bash
npm run data:arena:import
npm run data:arena:check
```

Outputs:

- `public/data/arena/catalog.json`
- `public/data/arena/manifest.json`

The importer joins the Chinese and English catalogs, validates at least 200 unique records, fixes CommunityDragon game-asset icon URLs, and writes a deterministic SHA-256 manifest. This is metadata only. It does not contain augment win rate, placement, or combo strength; those require a separate evidence layer from public aggregate sources or our own Riot Match-V5 sample aggregation.

## Current Champion and Item Mechanics

Localized champion spells and item recipes are imported from the current Data Dragon version:

```bash
npm run data:game:import
npm run data:game:check
```

Outputs:

- `public/data/game/champions-zh-cn.json`
- `public/data/game/items-zh-cn.json`

The former MetaBot scraper was removed after its endpoint stopped supporting reliable unattended imports. Future popularity or placement evidence must remain optional and cannot replace the canonical CommunityDragon definitions.
