# Arena Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stale and broken Arena data paths with one bilingual, validated, offline-first augment catalog whose icons resolve reliably.

**Architecture:** A testable Node library joins current CommunityDragon `zh_cn` and `en_us` payloads into compact JSON and a hashed manifest. Pure TypeScript runtime code validates and indexes bundled/runtime catalog snapshots; generated TypeScript arrays and the MetaBot scraper are removed.

**Tech Stack:** Node.js 20.19+, TypeScript 5.9, Vitest 4, CommunityDragon JSON, Web Crypto/SHA-256.

## Global Constraints

- Chinese definitions are canonical; English definitions provide API identity and fallback text.
- Icon paths beginning with `assets/` resolve under `https://raw.communitydragon.org/latest/game/`.
- Startup always has a bundled verified catalog and never depends on a network refresh.
- No generated TypeScript data arrays and no MetaBot dependency.

---

### Task 1: Extract a deterministic bilingual importer

**Files:**
- Create: `scripts/arena-data/catalog-lib.mjs`
- Create: `scripts/arena-data/catalog-lib.test.ts`
- Create: `scripts/arena-data/import-catalog.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `{ augments: CommunityDragonAugment[] }` in Chinese and English.
- Produces: `normalizeCatalog(zhPayload, enPayload, sourceMeta): ArenaCatalogFile`.
- Produces: `validateCatalog(file): void` and `createManifest(file): ArenaCatalogManifest`.

- [ ] **Step 1: Write failing importer tests.**

```ts
import { describe, expect, it } from 'vitest'
import { normalizeCatalog } from './catalog-lib.mjs'

it('joins localized definitions by id and api name', () => {
  const result = normalizeCatalog(
    { augments: [{ id: 27, apiName: 'Earthwake', name: '大地苏醒', desc: '位移后留下轨迹', iconLarge: 'assets/ux/cherry/augments/icons/earthwake_large.png', iconSmall: 'assets/ux/cherry/augments/icons/earthwake_small.png', rarity: 2 }] },
    { augments: [{ id: 27, apiName: 'Earthwake', name: 'Earthwake', desc: 'Dashes leave a trail', iconLarge: 'assets/ux/cherry/augments/icons/earthwake_large.png', iconSmall: 'assets/ux/cherry/augments/icons/earthwake_small.png', rarity: 2 }] },
    { generatedAt: '2026-08-03T00:00:00.000Z' },
  )
  expect(result.augments[0]).toMatchObject({ id: 27, apiName: 'Earthwake', name: '大地苏醒', englishName: 'Earthwake', rarity: 'prismatic' })
})
```

Also test HTML cleanup, duplicate ID rejection, missing `augments`, deterministic sort, unsupported rarity mapping, and a minimum live count of 200.

- [ ] **Step 2: Run the test and verify it fails.**

Run: `npx vitest run scripts/arena-data/catalog-lib.test.ts`  
Expected: FAIL because `catalog-lib.mjs` does not exist.

- [ ] **Step 3: Implement the importer library.**

```js
export function iconUrl(path) {
  if (!path) return null
  const normalized = String(path).replaceAll('\\', '/').replace(/^\/+/, '')
  return normalized.startsWith('assets/')
    ? `https://raw.communitydragon.org/latest/game/${normalized}`
    : `https://raw.communitydragon.org/latest/${normalized}`
}

export function normalizeCatalog(zhPayload, enPayload, sourceMeta) {
  const englishById = new Map(enPayload.augments.map((item) => [Number(item.id), item]))
  const augments = zhPayload.augments.map((zh) => {
    const en = englishById.get(Number(zh.id))
    return {
      id: Number(zh.id), apiName: String(zh.apiName || en?.apiName),
      name: String(zh.name || en?.name), englishName: String(en?.name || zh.apiName),
      description: cleanText(zh.desc || en?.desc), tooltip: cleanText(zh.tooltip || zh.desc || en?.tooltip),
      iconLargeUrl: iconUrl(zh.iconLarge || en?.iconLarge), iconSmallUrl: iconUrl(zh.iconSmall || en?.iconSmall),
      rarity: rarityLabel(zh.rarity ?? en?.rarity),
    }
  }).sort((a, b) => a.id - b.id)
  return { schemaVersion: 1, generatedAt: sourceMeta.generatedAt, sources: sourceMeta.sources, augments }
}
```

- [ ] **Step 4: Implement the CLI.**

The CLI accepts `--zh-source`, `--en-source`, `--out`, `--manifest`, `--from-cache`, and `--check`; `--check` compares normalized content while ignoring `generatedAt`.

- [ ] **Step 5: Add npm scripts and run tests.**

```json
"data:arena:import": "node scripts/arena-data/import-catalog.mjs",
"data:arena:check": "node scripts/arena-data/import-catalog.mjs --from-cache --check"
```

Run: `npx vitest run scripts/arena-data/catalog-lib.test.ts`

- [ ] **Step 6: Commit.**

```bash
git add scripts/arena-data package.json package-lock.json
git commit -m "feat: add bilingual Arena catalog importer"
```

### Task 2: Add runtime validation and indexed lookup

**Files:**
- Create: `public/data/arena/catalog.json`
- Create: `public/data/arena/manifest.json`
- Create: `src/features/arena/catalog/types.ts`
- Create: `src/features/arena/catalog/catalog.ts`
- Create: `src/features/arena/catalog/catalog.test.ts`
- Modify: `src/services/augmentIcons.ts`

**Interfaces:**
- Produces: `parseArenaCatalog(value: unknown): ArenaCatalog`.
- Produces: `createArenaCatalogIndex(catalog): ArenaCatalogIndex`.
- Produces: `ArenaCatalogIndex.find(query: string | number): ArenaAugmentDefinition | null`.

- [ ] **Step 1: Generate current catalog fixtures.**

Run: `npm run data:arena:import`

- [ ] **Step 2: Write failing runtime tests.**

```ts
it('resolves id, API name, Chinese name, and English name to one definition', () => {
  const index = createArenaCatalogIndex(catalogFixture)
  expect(index.find(27)?.apiName).toBe('Earthwake')
  expect(index.find('大地苏醒')?.id).toBe(27)
  expect(index.find('earthwake')?.id).toBe(27)
})

it('uses the CommunityDragon game asset root', () => {
  expect(index.find('Earthwake')?.iconLargeUrl).toContain('/latest/game/assets/ux/cherry/')
})
```

- [ ] **Step 3: Run the test and verify it fails.**

Run: `npm run test -- src/features/arena/catalog/catalog.test.ts`

- [ ] **Step 4: Implement types, parser, and index.**

```ts
export type ArenaAugmentDefinition = {
  id: number
  apiName: string
  name: string
  englishName: string
  description: string
  tooltip: string
  rarity: 'silver' | 'gold' | 'prismatic' | 'unknown'
  iconLargeUrl: string | null
  iconSmallUrl: string | null
}
```

The parser rejects schema versions other than `1`, duplicate IDs/API names, fewer than 200 records, non-HTTP(S) icon URLs, and empty localized names.

- [ ] **Step 5: Replace `augmentIcons.ts` with catalog-definition URLs and run verification.**

Run: `npm run data:arena:check && npm run test -- src/features/arena/catalog/catalog.test.ts src/data/recommendationData.test.ts && npm run build`

- [ ] **Step 6: Commit.**

```bash
git add public/data/arena src/features/arena/catalog src/services/augmentIcons.ts
git commit -m "feat: consume verified Arena catalog"
```

### Task 3: Import current champion and item mechanics

**Files:**
- Create: `scripts/arena-data/import-ddragon.mjs`
- Create: `src/features/arena/catalog/gameData.ts`
- Test: `src/features/arena/catalog/gameData.test.ts`
- Create: `public/data/game/champions-zh-cn.json`
- Create: `public/data/game/items-zh-cn.json`
- Modify: `package.json`

**Interfaces:**
- Produces: `ArenaChampionDefinition` with stable key, localized name, spell text, range class, and tags.
- Produces: `ArenaItemDefinition` with numeric ID, localized name, description, price, recipe component IDs, purchasable state, and icon URL.
- Produces: `loadCurrentGameData(): Promise<{ champions; items; version }>`.

- [ ] **Step 1: Write failing current-data tests.**

```ts
it('retains item recipes and localized icons for purchase planning', () => {
  const cosmicDrive = gameData.items.get(4629)
  expect(cosmicDrive).toMatchObject({ name: '星界驱驰', totalGold: 3000 })
  expect(cosmicDrive?.from).toEqual(expect.arrayContaining([3113, 3108]))
  expect(cosmicDrive?.iconUrl).toMatch(/\/img\/item\/4629\.png$/)
})
```

Also test champion key/name/spell text, version metadata, unavailable item filtering, duplicate IDs, and missing recipes.

- [ ] **Step 2: Run the test and verify it fails.**

Run: `npm run test -- src/features/arena/catalog/gameData.test.ts`

- [ ] **Step 3: Implement the Data Dragon importer.**

Resolve the current version from the official versions manifest, fetch `zh_CN/championFull.json` plus `zh_CN/item.json`, normalize only fields consumed by graph and purchase planning, and embed the resolved version in both outputs. The importer supports `--version` for reproducible CI updates.

- [ ] **Step 4: Add scripts and generate fixtures.**

```json
"data:game:import": "node scripts/arena-data/import-ddragon.mjs",
"data:game:check": "node scripts/arena-data/import-ddragon.mjs --from-cache --check"
```

Run: `npm run data:game:import`  
Run: `npm run test -- src/features/arena/catalog/gameData.test.ts`

- [ ] **Step 5: Commit.**

```bash
git add scripts/arena-data/import-ddragon.mjs public/data/game src/features/arena/catalog/gameData.ts src/features/arena/catalog/gameData.test.ts package.json package-lock.json
git commit -m "feat: import current Arena champion and item data"
```

### Task 4: Add offline-first catalog repository and remove stale paths

**Files:**
- Create: `src/features/arena/catalog/repository.ts`
- Create: `src/features/arena/catalog/repository.test.ts`
- Delete: `scripts/import-cdragon-arena-augments.mjs`
- Delete: `scripts/import-metabot-arena-augments.mjs`
- Delete: `src/data/arenaAugments.ts`
- Delete: `src/data/metabotArenaAugments.ts`
- Delete: `data/arena/communitydragon-augments-current.json`
- Delete: `data/arena/metabot-zh-cn-augments-current.json`
- Modify: `README.md`
- Modify: `docs/data-source-matrix.md`

**Interfaces:**
- Produces: `ArenaCatalogRepository.load(): Promise<CatalogSnapshot>`.
- Produces: `ArenaCatalogRepository.refresh(): Promise<CatalogRefreshResult>`.
- Produces snapshot source `bundled-cache | runtime-cache` and freshness `fresh | aging | stale`.

- [ ] **Step 1: Write failing repository tests.**

```ts
it('rejects a corrupt runtime cache and returns bundled data', async () => {
  const repository = createRepository({ bundled: validCatalog, runtime: corruptCatalog })
  await expect(repository.load()).resolves.toMatchObject({ source: 'bundled-cache', catalog: validCatalog })
})
```

Also cover valid runtime preference, older-runtime rejection, network timeout, invalid download, and atomic promotion after validation.

- [ ] **Step 2: Run the test and verify it fails.**

Run: `npm run test -- src/features/arena/catalog/repository.test.ts`

- [ ] **Step 3: Implement freshness and repository behavior.**

Use `fresh` for 0–3 days, `aging` for 4–14 days, and `stale` after 14 days. Hash/schema failure is invalid regardless of age. Refresh returns the current valid snapshot on any network or validation failure.

- [ ] **Step 4: Replace all old imports, then delete obsolete scrapers and generated data.**

Run: `rg -n "metabotArena|arenaAugments|data:arena:metabot|data:arena:augments" src scripts package.json docs README.md`  
Expected after replacement: no matches.

- [ ] **Step 5: Run complete verification.**

Run: `npm run data:arena:check && npm run test && npm run lint && npm run build && git diff --check`

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "refactor: remove stale Arena data paths"
```
