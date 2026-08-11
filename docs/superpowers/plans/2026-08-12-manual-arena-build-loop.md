# Manual Arena Augment and Build Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a searchable manual Arena augment workflow that records selected augments and current candidates, ranks combined augment routes, always provides item advice from live champion/items/gold, and shows an honest public-data teammate tier during Arena champ select.

**Architecture:** Pure catalog search, manual-session state, persistence, recommendation, and teammate-rating modules feed the Arena UI. React owns only interaction/loading state and calls typed store operations; manual facts have field-level priority over unsupported automatic observations. Item paths are generated from champion/selected-augment baselines even when current candidates are empty. LCU marks the local champ-select participant, while the teammate tier consumes only real OP.GG/Riot evidence and never mock player metrics.

**Tech Stack:** React 19, TypeScript 5.9, Vitest 4, Testing Library, Tauri 2, Rust, localStorage, GitHub Actions Windows x64.

## Global Constraints

- Manual augment input is the reliable primary workflow; automatic augment discovery is optional and cannot erase newer manual facts.
- Search is local and supports Chinese name, English name, API name, normalized description text, and rarity.
- Selected augments persist across rounds; current candidates clear after confirmation.
- Item advice must exist with zero selected augments and zero current candidates.
- Recommendations combine champion, selected augments, current candidates, owned items, gold, level, and game time.
- Stable, high-ceiling, and off-meta outputs must remain distinct when credible alternatives exist.
- Future catalog suggestions must be labeled `后续寻找` and never presented as current candidates.
- No invented probabilities or augment/item win rates may be displayed.
- Pregame teammate classification starts in Arena `ChampSelect` without waiting for port 2999.
- Only non-local allied identities from LCU may become teammate cards; real names must never inherit mock scores.
- Fewer than three usable public matches, a hidden identity, or an unavailable profile yields `情报不足`, not `下等马`.
- Do not add dependencies.

---

## File Structure

- Create `src/features/arena/catalog/search.ts`: normalized multilingual search and deterministic result ranking.
- Create `src/features/arena/catalog/search.test.ts`: exact, prefix, description, rarity, and disabled-result coverage.
- Modify `src/features/arena/session/manualStore.ts`: slot-based candidates, selected-history operations, atomic confirmation, reset, and manual-priority facts.
- Modify `src/features/arena/session/manualStore.test.ts`: store transition and precedence fixtures.
- Create `src/features/arena/session/manualPersistence.ts`: versioned local snapshot parsing, repair, restore compatibility, save, and clear.
- Create `src/features/arena/session/manualPersistence.test.ts`: persistence and match-reset coverage.
- Modify `src/features/arena/session/fusion.ts` and test: preserve touched manual fields against automatic values.
- Modify `src/features/arena/recommendation/types.ts`: identify baseline, current-candidate, selected-combination, and future-target paths.
- Modify `src/features/arena/ui/createDecisionModel.ts` and test: generate independent baseline item routes and selected/current augment combinations.
- Modify `src/features/arena/ui/types.ts`: expose future targets and route provenance to the UI.
- Create `src/features/arena/ui/AugmentSearch.tsx` and test: reusable searchable icon result list.
- Create `src/features/arena/ui/ArenaManualControls.tsx` and test: selected row, three slots, undo, confirm, and reset.
- Modify `src/features/arena/ui/ArenaDecisionView.tsx` and test: visible candidate confirmation, combination routes, future labels, and item fallback.
- Modify `src/app/useCompanionSession.ts`: remove mock candidate seeding, restore/persist manual state, and expose typed actions.
- Modify `src/components/OverlayPanel.tsx`: render manual controls as primary Arena UI and remove the collapsed legacy picker.
- Modify `src/App.tsx`: connect the new actions.
- Modify `src/App.css`: style the compact manual controls, search results, slots, and combined route summaries.
- Delete `src/features/arena/ui/AugmentPicker.tsx` and its test after replacement.
- Modify `src/services/lcuAdapter.ts`, `src/services/tauriHost.ts`, and `src-tauri/src/lcu/client.rs`: mark the local champ-select participant explicitly.
- Create `src/features/arena/teammate/rating.ts` and test: derive a tier, confidence, score, sample, and reasons from real public evidence.
- Create `src/features/arena/teammate/useArenaTeammateRating.ts` and test: load the non-local ally during Arena champ select through OP.GG/Riot fallbacks.
- Create `src/features/arena/teammate/ArenaTeammateCard.tsx` and test: render loading, classified, and honest insufficient-data states before the match.

---

### Task 1: Searchable Catalog and Reliable Manual Session State

**Files:**
- Create: `src/features/arena/catalog/search.ts`
- Create: `src/features/arena/catalog/search.test.ts`
- Modify: `src/features/arena/session/manualStore.ts`
- Modify: `src/features/arena/session/manualStore.test.ts`
- Modify: `src/features/arena/session/fusion.ts`
- Modify: `src/features/arena/session/fusion.test.ts`

**Interfaces:**
- Produces `searchArenaAugments(catalog: ArenaCatalogIndex, query: string, unavailable: ReadonlyMap<number, string>, limit?: number): ArenaAugmentSearchResult[]`.
- Produces `ArenaAugmentSearchResult = { augment: ArenaAugmentDefinition; disabledReason: string | null; matchKind: 'exact' | 'prefix' | 'name' | 'description' | 'all' }`.
- Extends `ManualArenaSessionStore` with `addSelectedAugment`, `removeSelectedAugment`, `setCandidateSlot`, `clearCandidateSlot`, `confirmCandidate`, `restore`, and `resetMatch`.
- Manual observations that exist in store output cannot be overwritten by non-manual incoming observations.

- [ ] **Step 1: Write failing multilingual search tests**

```ts
import { describe, expect, it } from 'vitest'
import { fixtureModel } from '../ui/testFixtures'
import { searchArenaAugments } from './search'

describe('Arena augment search', () => {
  it('ranks exact and prefix names ahead of description matches', () => {
    const results = searchArenaAugments(fixtureModel.catalog, '大地', new Map())
    expect(results[0]).toMatchObject({ augment: { name: '大地苏醒' }, matchKind: 'prefix' })
  })

  it('searches English and API names case-insensitively', () => {
    expect(searchArenaAugments(fixtureModel.catalog, 'spellwake', new Map())[0].augment.id).toBe(135)
  })

  it('keeps unavailable results visible and explains why they are disabled', () => {
    const results = searchArenaAugments(fixtureModel.catalog, 'Earthwake', new Map([[27, '已在本轮候选中']]))
    expect(results[0].disabledReason).toBe('已在本轮候选中')
  })
})
```

- [ ] **Step 2: Write failing manual transition tests**

```ts
it('edits candidate slots and confirms one candidate atomically', () => {
  const store = createManualArenaSessionStore(new Set([27, 65, 135]), () => 200)
  store.setCandidateSlot(0, 27)
  store.setCandidateSlot(1, 65)
  store.setCandidateSlot(2, 135)
  store.confirmCandidate(65)

  expect(store.read().selectedAugments?.value).toEqual([65])
  expect(store.read().candidates?.value).toEqual([])
})

it('supports direct selected-history add, undo, and full match reset', () => {
  const store = createManualArenaSessionStore(new Set([27, 65, 135]))
  store.addSelectedAugment(27)
  store.addSelectedAugment(65)
  store.removeSelectedAugment(27)
  expect(store.read().selectedAugments?.value).toEqual([65])
  store.resetMatch()
  expect(store.read().selectedAugments).toBeUndefined()
  expect(store.read().candidates).toBeUndefined()
})
```

Extend `fusion.test.ts`:

```ts
it('keeps touched manual facts when a newer automatic source reports values', () => {
  const manual = mergeArenaSession(createEmptyArenaSession(), {
    candidates: observation([27, 65, 135], 100, 'manual'),
  })
  const merged = mergeArenaSession(manual, {
    candidates: observation([9, 10, 11], 200, 'lcu'),
  })
  expect(merged.candidates.value).toEqual([27, 65, 135])
  expect(merged.candidates.source).toBe('manual')
})
```

- [ ] **Step 3: Run focused tests and verify failure**

Run:

```bash
npm test -- src/features/arena/catalog/search.test.ts src/features/arena/session/manualStore.test.ts src/features/arena/session/fusion.test.ts
```

Expected: search module and new store methods are missing, and fusion allows the newer LCU observation to replace manual candidates.

- [ ] **Step 4: Implement normalized search**

Use this normalization and deterministic sort boundary:

```ts
function normalize(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

const matchOrder = { exact: 0, prefix: 1, name: 2, description: 3, all: 4 } as const
```

Build searchable name text from `name`, `englishName`, and `apiName`; description text from `description`, `tooltip`, and `rarity`. Empty query returns catalog order with `matchKind: 'all'`. Sort by `matchOrder`, localized name, then numeric ID, and apply the default limit of 40.

- [ ] **Step 5: Implement explicit manual store operations**

Store candidate slots internally as `(number | null)[]` of length three. `read()` emits compact non-null IDs only after a manual candidate operation has touched the field. Selected history is also absent until touched. Validate every ID against `knownAugmentIds`, reject duplicates across selected history and other candidate slots, and keep `confirmCandidate` atomic.

Use this interface:

```ts
export type ManualArenaSnapshotInput = {
  championKey?: number
  selectedAugmentIds: number[]
  candidateAugmentIds: number[]
}

export type ManualArenaSessionStore = {
  setChampion: (championKey: number) => void
  addSelectedAugment: (augmentId: number) => void
  removeSelectedAugment: (augmentId: number) => void
  setCandidateSlot: (slot: 0 | 1 | 2, augmentId: number) => void
  clearCandidateSlot: (slot: 0 | 1 | 2) => void
  confirmCandidate: (augmentId: number) => void
  restore: (snapshot: ManualArenaSnapshotInput) => void
  resetRound: () => void
  resetMatch: () => void
  read: () => PartialArenaSession
  port: ArenaSessionPort
}
```

- [ ] **Step 6: Give manual observations field priority in fusion**

Update `newerValid` so a valid current manual observation remains when the incoming observation is not manual. A new manual observation may replace automatic state, and two observations from the same source continue using timestamp ordering.

```ts
if (valid(current) && current.source === 'manual' && incoming.source !== 'manual') return current
```

- [ ] **Step 7: Run focused tests and commit**

Run:

```bash
npm test -- src/features/arena/catalog/search.test.ts src/features/arena/session/manualStore.test.ts src/features/arena/session/fusion.test.ts
```

Expected: all focused tests pass.

Commit:

```bash
git add src/features/arena/catalog/search.ts src/features/arena/catalog/search.test.ts src/features/arena/session/manualStore.ts src/features/arena/session/manualStore.test.ts src/features/arena/session/fusion.ts src/features/arena/session/fusion.test.ts
git commit -m "feat: add searchable manual Arena state"
```

---

### Task 2: Persist and Restore Manual Match State

**Files:**
- Create: `src/features/arena/session/manualPersistence.ts`
- Create: `src/features/arena/session/manualPersistence.test.ts`
- Modify: `src/app/useCompanionSession.ts`

**Interfaces:**
- Produces `ManualArenaPersistenceSnapshot` with `schemaVersion: 1`, champion key, selected/candidate IDs, and game time.
- Produces `createManualArenaPersistence(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, knownAugmentIds: ReadonlySet<number>, key?: string)`.
- Persistence object exposes `load`, `save`, and `clear`.
- Produces `isManualArenaSnapshotCompatible(saved, current): boolean` for champion/mode/time validation.

- [ ] **Step 1: Write failing persistence tests**

```ts
const storageRecords = new Map<string, string>()
const storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
  getItem: (key) => storageRecords.get(key) ?? null,
  setItem: (key, value) => storageRecords.set(key, value),
  removeItem: (key) => { storageRecords.delete(key) },
}
const persistence = createManualArenaPersistence(storage, new Set([27, 65, 135]))
const snapshot = (overrides: Partial<ManualArenaPersistenceSnapshot> = {}): ManualArenaPersistenceSnapshot => ({
  schemaVersion: 1,
  championKey: 103,
  selectedAugmentIds: [27],
  candidateAugmentIds: [65, 135],
  gameTimeSeconds: 300,
  ...overrides,
})

it('repairs unknown augment ids while retaining valid state', () => {
  storage.setItem('lol-companion:arena-manual:v1', JSON.stringify({
    schemaVersion: 1,
    championKey: 103,
    selectedAugmentIds: [27, 999],
    candidateAugmentIds: [65, 135],
    gameTimeSeconds: 300,
  }))
  expect(persistence.load()).toMatchObject({ selectedAugmentIds: [27], candidateAugmentIds: [65, 135] })
})

it('rejects a clearly restarted match but tolerates reconnect drift', () => {
  const saved = snapshot({ championKey: 103, gameTimeSeconds: 300 })
  expect(isManualArenaSnapshotCompatible(saved, { championKey: 103, gameTimeSeconds: 280, mode: 'arena' })).toBe(true)
  expect(isManualArenaSnapshotCompatible(saved, { championKey: 103, gameTimeSeconds: 200, mode: 'arena' })).toBe(false)
})
```

Also cover malformed JSON, wrong schema, different champion, fresh non-Arena mode, and storage exceptions.

- [ ] **Step 2: Run persistence tests and verify failure**

Run: `npm test -- src/features/arena/session/manualPersistence.test.ts`

Expected: module import fails.

- [ ] **Step 3: Implement safe persistence**

Use storage key `lol-companion:arena-manual:v1`. Parse records with explicit type checks, deduplicate IDs, retain at most four selected augments and three candidates, remove unknown IDs, and write repaired state back. Return `null` and remove storage for malformed JSON or the wrong schema.

Compatibility rules:

```ts
if (current.mode !== 'arena') return false
if (saved.championKey !== current.championKey) return false
return current.gameTimeSeconds >= saved.gameTimeSeconds - 30
```

- [ ] **Step 4: Integrate restore/save/reset into the session hook**

Remove the block that maps static `match.augmentCandidates` into `manualArenaStore.setCandidates`. Restore once after the catalog, current champion key, and a live Arena snapshot are available. After every manual action, merge `manualArenaStore.read()` into `arenaSession`, then save selected/candidate IDs with the current champion key and game time.

Expose these hook actions:

```ts
addSelectedArenaAugment(augmentId: number): void
removeSelectedArenaAugment(augmentId: number): void
setArenaCandidateSlot(slot: 0 | 1 | 2, augmentId: number): void
clearArenaCandidateSlot(slot: 0 | 1 | 2): void
confirmArenaCandidate(augmentId: number): void
resetArenaMatch(): void
```

`resetArenaMatch` clears the manual store, persistence, and merged manual observations without clearing live champion/item/gold observations.

- [ ] **Step 5: Run persistence, hook-adjacent, and build checks**

Run:

```bash
npm test -- src/features/arena/session/manualPersistence.test.ts src/features/arena/session/manualStore.test.ts src/features/arena/session/fusion.test.ts
npx tsc -b --pretty false
```

Expected: tests and TypeScript compilation pass after Task 4 updates the React callers. If obsolete prop errors remain in `App.tsx` or `OverlayPanel.tsx`, continue directly to Task 4 before committing the combined caller update.

---

### Task 3: Decouple Item Advice and Build Combined Routes

**Files:**
- Modify: `src/features/arena/recommendation/types.ts`
- Modify: `src/features/arena/recommendation/routePlanner.ts`
- Modify: `src/features/arena/recommendation/routePlanner.test.ts`
- Modify: `src/features/arena/ui/types.ts`
- Modify: `src/features/arena/ui/createDecisionModel.ts`
- Create: `src/features/arena/ui/createDecisionModel.test.ts`

**Interfaces:**
- Adds `ArenaRoutePathSource = 'baseline' | 'selected-combination' | 'current-candidate' | 'future-target'`.
- Adds `source: ArenaRoutePathSource` to `ArenaRoutePathInput` and `ArenaScoredRouteCandidate`.
- Adds `futureTargets: ArenaAugmentDefinition[]` to `ArenaDecisionViewModel`.
- `createArenaDecisionModel` always returns at least one available route with a purchase plan when valid item catalog targets exist.

- [ ] **Step 1: Write failing decision-model tests**

Build the test inputs explicitly so no runtime fetch is required:

```ts
const observation = <T,>(value: T): ArenaObservation<T> => ({
  value,
  source: 'manual',
  observedAt: 100,
  state: 'live',
})
const champion: Champion = {
  id: 'ahri', name: '阿狸', role: '中路', damageProfile: 'ap',
  powerWindow: '中期', identity: '位移法师', tags: ['位移', '法术'],
}
const catalog = fixtureModel.catalog
const item = (id: number, name: string, totalGold: number, from: number[] = []): ArenaItemDefinition => ({
  id, name, description: name, baseGold: totalGold, totalGold, from,
  purchasable: true, tags: [], iconUrl: `https://example.com/${id}.png`,
})
const gameData: CurrentGameData = {
  version: '16.11.1',
  champions: new Map(),
  items: new Map([
    item(3113, '以太精魂', 850), item(4629, '星界驱驰', 3000, [3113]),
    item(3157, '中娅沙漏', 3250), item(6655, '卢登的伙伴', 2850),
    item(4645, '影焰', 3200), item(3115, '纳什之牙', 3000), item(3006, '狂战士胫甲', 1100),
  ].map((entry) => [entry.id, entry])),
}
const liveSessionWithoutAugments = mergeArenaSession(createEmptyArenaSession(), {
  championKey: observation(103), selectedAugments: observation([]), candidates: observation([]),
  itemIds: observation([]), gold: observation(1200), level: observation(8),
})
const sessionWithSelected = (ids: number[]) => mergeArenaSession(liveSessionWithoutAugments, {
  selectedAugments: observation(ids),
})
```

Then add the assertions:

```ts
it('creates item advice without selected augments or current candidates', () => {
  const model = createArenaDecisionModel({ champion, session: liveSessionWithoutAugments, catalog, gameData })
  const purchase = model.routes.routes.find((route) => route.purchasePlan)?.purchasePlan
  expect(purchase?.firstCompletedItem).toBeDefined()
})

it('uses selected augments to rerank combined item paths', () => {
  const baseline = createArenaDecisionModel({ champion, session: liveSessionWithoutAugments, catalog, gameData })
  const selected = createArenaDecisionModel({ champion, session: sessionWithSelected([27]), catalog, gameData })
  expect(selected.routes.routes[0].coreSignature).not.toBe(baseline.routes.routes[0].coreSignature)
})

it('labels catalog suggestions as future targets when current candidates are empty', () => {
  const model = createArenaDecisionModel({ champion, session: sessionWithSelected([27]), catalog, gameData })
  expect(model.futureTargets.length).toBeGreaterThan(0)
  expect(model.routes.routes.some((route) => route.candidates[0]?.source === 'future-target')).toBe(true)
})
```

- [ ] **Step 2: Extend route fixtures and run tests to verify failure**

Add `source: 'current-candidate'` to existing `ArenaRoutePathInput` fixtures. Run:

```bash
npm test -- src/features/arena/ui/createDecisionModel.test.ts src/features/arena/recommendation/routePlanner.test.ts src/features/arena/recommendation/purchasePlan.test.ts
```

Expected: the new model tests fail because zero candidates still generate zero routes and `futureTargets` does not exist.

- [ ] **Step 3: Generate baseline and combined route seeds**

In `createDecisionModel`, resolve selected and current definitions from session IDs. Choose target augments in this order:

1. exactly the current candidates when present;
2. up to twelve non-selected catalog augments ranked by mechanism-edge count against champion and selected augments;
3. one synthetic champion baseline when neither selected nor current augments exist.

Build the mechanism graph from champion, selected augments, target augments, and package items. Candidate paths include graph edges touching the target augment, any selected augment, or the package items. Set `selectedSynergy` from positive edges connecting selected augments to the target or package.

For the synthetic baseline, use:

```ts
{
  id: `baseline-${packageIndex}`,
  source: 'baseline',
  augmentApiName: 'ChampionBaseline',
  augmentName: '英雄基础路线',
  completedItemIds: itemIds,
}
```

Create one path per target/package pairing. Feed every path to `planArenaRoutes`; the baseline therefore produces purchase plans without any augment input.

- [ ] **Step 4: Expose future targets and source labels**

Set `futureTargets` to the definitions used by `future-target` paths, limited to the leading unique augment of each available route. Candidate UI continues to read only `session.candidates`; future targets render only in the combination section with `后续寻找`.

- [ ] **Step 5: Run recommendation tests and commit**

Run:

```bash
npm test -- src/features/arena/ui/createDecisionModel.test.ts src/features/arena/recommendation/routePlanner.test.ts src/features/arena/recommendation/purchasePlan.test.ts
```

Expected: item fallback, selected reranking, current-candidate scoring, future labels, and existing route diversity tests pass.

Commit:

```bash
git add src/features/arena/recommendation/types.ts src/features/arena/recommendation/routePlanner.ts src/features/arena/recommendation/routePlanner.test.ts src/features/arena/ui/types.ts src/features/arena/ui/createDecisionModel.ts src/features/arena/ui/createDecisionModel.test.ts
git commit -m "feat: combine Arena augments and item routes"
```

---

### Task 4: Build the Primary Manual Arena UI

**Files:**
- Create: `src/features/arena/ui/AugmentSearch.tsx`
- Create: `src/features/arena/ui/AugmentSearch.test.tsx`
- Create: `src/features/arena/ui/ArenaManualControls.tsx`
- Create: `src/features/arena/ui/ArenaManualControls.test.tsx`
- Modify: `src/features/arena/ui/ArenaDecisionView.tsx`
- Modify: `src/features/arena/ui/ArenaDecisionView.test.tsx`
- Modify: `src/features/arena/ui/types.ts`
- Modify: `src/components/OverlayPanel.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/app/useCompanionSession.ts` from Task 2
- Delete: `src/features/arena/ui/AugmentPicker.tsx`
- Delete: `src/features/arena/ui/AugmentPicker.test.tsx`

**Interfaces:**
- Produces `AugmentSearch` with catalog, unavailable reasons, selection callback, and close callback.
- Produces `ArenaManualControls` with `catalog`, `selectedIds`, `candidateIds`, `onAddSelected`, `onRemoveSelected`, `onSetCandidateSlot`, `onClearCandidateSlot`, `onConfirmCandidate`, and `onResetMatch` props.
- Adds `onConfirmCandidate(augmentId: number)` to `ArenaDecisionViewProps`.
- Removes legacy `onManualMode` and collapsed `AugmentPicker` behavior from the Arena overlay path.

- [ ] **Step 1: Write failing search and manual-control UI tests**

```tsx
const baseProps = {
  catalog: fixtureModel.catalog,
  selectedIds: [] as number[],
  candidateIds: [] as number[],
  onAddSelected: vi.fn(),
  onRemoveSelected: vi.fn(),
  onSetCandidateSlot: vi.fn(),
  onClearCandidateSlot: vi.fn(),
  onConfirmCandidate: vi.fn(),
  onResetMatch: vi.fn(),
}

it('searches and adds an already selected augment', async () => {
  const user = userEvent.setup()
  const onAddSelected = vi.fn()
  render(<ArenaManualControls {...baseProps} onAddSelected={onAddSelected} />)
  await user.click(screen.getByRole('button', { name: '添加已选海克斯' }))
  await user.type(screen.getByRole('searchbox', { name: '搜索海克斯' }), 'Earthwake')
  await user.click(screen.getByRole('button', { name: /大地苏醒/ }))
  expect(onAddSelected).toHaveBeenCalledWith(27)
})

it('fills three fixed slots and confirms the chosen candidate', async () => {
  const user = userEvent.setup()
  const onConfirmCandidate = vi.fn()
  render(<ArenaManualControls {...baseProps} candidateIds={[27, 65, 135]} onConfirmCandidate={onConfirmCandidate} />)
  expect(screen.getAllByTestId('arena-candidate-slot')).toHaveLength(3)
  await user.click(screen.getByRole('button', { name: '选择超凡邪恶' }))
  expect(onConfirmCandidate).toHaveBeenCalledWith(65)
})
```

Also test disabled duplicates, selected undo, candidate clearing, no search results, and reset confirmation.

- [ ] **Step 2: Update decision-view test for independent item advice**

Render a model with empty candidates and a baseline purchase plan. Assert `回城买什么`, the immediate/target item icons, and `组合方向` remain visible while `本轮选什么` instructs the user to enter candidates.

- [ ] **Step 3: Run UI tests and verify failure**

Run:

```bash
npm test -- src/features/arena/ui/AugmentSearch.test.tsx src/features/arena/ui/ArenaManualControls.test.tsx src/features/arena/ui/ArenaDecisionView.test.tsx
```

Expected: new components are missing and the old view lacks confirmation and baseline rendering.

- [ ] **Step 4: Implement reusable search and primary controls**

`AugmentSearch` calls `searchArenaAugments`, shows at most 40 icon results, disables unavailable IDs with their reason, displays `没有找到匹配的海克斯` for an empty result, closes after selection, and restores focus through a ref supplied by `ArenaManualControls`.

`ArenaManualControls` renders this order:

```text
已选海克斯  [icon ×] [icon ×] [+ 添加已选海克斯] [重置本局]
本轮三个候选 [slot 1] [slot 2] [slot 3]
```

Filled slots render localized icon/name and a clear button. With all three filled, each slot renders `选择{name}`. Search target state distinguishes selected-history addition from candidate slot replacement.

- [ ] **Step 5: Integrate combined routes and item output**

In `ArenaDecisionView`, add a visible `组合方向` section that maps the three route objectives. For a `future-target` path prepend `后续寻找`; for a `baseline` path display `英雄基础路线`. Keep item output independent by selecting the first available route with a purchase plan rather than assuming the leading candidate route exists.

Add `我选了这个` to each current candidate card and call `onConfirmCandidate(augment.id)`.

- [ ] **Step 6: Replace the collapsed legacy picker in the overlay**

Render `ArenaManualControls` before `ArenaDecisionView` whenever the Arena model exists. Pass the model catalog and session IDs plus hook actions from `App.tsx`. Remove `isManualPickerOpen`, `AugmentPicker`, its `<details>`, and Arena-only `onManualMode` wiring. Keep diagnostics export and retry actions.

- [ ] **Step 7: Add compact CSS and run all UI/type checks**

Add focused classes for `.arena-manual`, `.arena-selected-row`, `.arena-candidate-slots`, `.arena-search-results`, `.arena-search-option`, and `.arena-combination-routes`. Reuse current rarity frame colors and `ArenaIcon`; do not create new image assets.

Run:

```bash
npm test -- src/features/arena/ui src/features/arena/catalog/search.test.ts src/features/arena/session
npm run lint
npm run build
```

Expected: all UI, search, session, lint, and production-build checks pass.

- [ ] **Step 8: Commit the complete buildable UI and hook integration**

```bash
git add src/App.tsx src/App.css src/app/useCompanionSession.ts src/components/OverlayPanel.tsx src/features/arena/ui src/features/arena/session/manualPersistence.ts src/features/arena/session/manualPersistence.test.ts
git commit -m "feat: add manual Arena augment build loop"
```

---

### Task 5: Rate the Real Arena Teammate Before Game Start

**Files:**
- Modify: `src/services/lcuAdapter.ts`
- Modify: `src/services/lcuAdapter.test.ts`
- Modify: `src/services/tauriHost.ts`
- Modify: `src/services/tauriHost.test.ts`
- Modify: `src-tauri/src/lcu/client.rs`
- Modify: `src/services/companionDataSource.ts`
- Modify: `src/services/companionDataSource.test.ts`
- Modify: `src/services/opggPlayerData.ts`
- Create: `src/features/arena/teammate/rating.ts`
- Create: `src/features/arena/teammate/rating.test.ts`
- Create: `src/features/arena/teammate/useArenaTeammateRating.ts`
- Create: `src/features/arena/teammate/useArenaTeammateRating.test.tsx`
- Create: `src/features/arena/teammate/ArenaTeammateCard.tsx`
- Create: `src/features/arena/teammate/ArenaTeammateCard.test.tsx`
- Modify: `src/app/useCompanionSession.ts`
- Modify: `src/components/OverlayPanel.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Adds `isLocalPlayer: boolean` to `LcuPlayerSnapshot` and the native Tauri payload.
- Carries `localSummonerName` and real LCU players through `DetectedGameSession`; exports the existing LCU-to-`PlayerRiotAccount` normalization for reuse.
- Adds account-based OP.GG loaders so teammate reads do not require a mock `PlayerIntel` object.
- Produces `rateArenaTeammate(input: ArenaTeammateEvidence): ArenaTeammateRating`.
- Produces `useArenaTeammateRating(input)` with `hidden | loading | rated | insufficient` states.
- The overlay renders the teammate card during Arena `ChampSelect` even when `liveSessionState === 'waiting'`.

- [ ] **Step 1: Write failing LCU local-participant tests**

Extend the existing TypeScript LCU fixture so `localPlayerCellId` matches one allied participant, then assert:

```ts
expect(session?.players).toEqual(expect.arrayContaining([
  expect.objectContaining({ id: 'ally-0', isLocalPlayer: true }),
  expect.objectContaining({ id: 'ally-1', isLocalPlayer: false }),
]))
```

Add the equivalent Rust fixture assertion after serializing `LcuSessionPayload`: the `isLocalPlayer` field is true only for the matching cell ID. Keep hidden/absent participant identities filtered exactly as today.

- [ ] **Step 2: Write failing pure rating tests**

Use only explicit real-evidence fixtures:

```ts
const match = (score: number, result: '胜' | '负', champion = '阿狸', mode = '斗魂竞技场'): PlayerRecentMatch => ({
  id: `${champion}-${score}-${result}`,
  champion,
  result,
  mode,
  time: '刚刚',
  kda: '5/2/7',
  cs: '6.0',
  kp: 60,
  score,
})

it('classifies strong sufficient Arena evidence as 上等马', () => {
  const rating = rateArenaTeammate({
    currentChampionName: '阿狸',
    matches: [82, 79, 76, 84, 74, 80].map((score) => match(score, '胜')),
    profileWinRate: 57,
    source: 'opgg',
  })
  expect(rating).toMatchObject({ label: '上等马', confidence: 'high', sampleSize: 6 })
  expect(rating.reasons).toContain(expect.stringMatching(/竞技场/))
})

it('does not call a player 下等马 from too little data', () => {
  const rating = rateArenaTeammate({
    matches: [match(49, '负'), match(46, '负')],
    source: 'opgg',
  })
  expect(rating).toMatchObject({ label: '情报不足', score: null, sampleSize: 2 })
})
```

Also cover the middle/lower thresholds, mixed non-Arena fallback, current-champion evidence, confidence, and empty evidence.

- [ ] **Step 3: Implement deterministic evidence scoring**

Define:

```ts
export type ArenaTeammateRating = {
  label: '上等马' | '中等马' | '下等马' | '情报不足'
  score: number | null
  confidence: 'high' | 'medium' | 'low'
  sampleSize: number
  reasons: string[]
  source: 'opgg' | 'riot' | 'none'
}
```

Select Arena rows by normalized mode containing `arena`, `斗魂竞技场`, `cherry`, or `kiwi`. Use Arena rows when at least three exist; otherwise use all real rows. With fewer than three usable rows return `情报不足` and `score: null`.

Calculate a 0–100 score from real fields only:

```ts
const formScore = average(usableMatches.map((match) => match.score))
const championRows = currentChampionName
  ? usableMatches.filter((match) => match.champion === currentChampionName)
  : []
const championScore = championRows.length >= 2
  ? average(championRows.map((match) => match.score))
  : formScore
const profileScore = profileWinRate === undefined
  ? formScore
  : clamp(50 + (profileWinRate - 50) * 1.5, 35, 75)
const score = Math.round(formScore * 0.7 + championScore * 0.2 + profileScore * 0.1)
```

Classify `score >= 72` as `上等马`, `score >= 56` as `中等马`, otherwise `下等马`. Confidence is high for at least six Arena rows, medium for at least five usable rows, and low otherwise. Generate at most three reasons from the same evidence and never mention fabricated party, mastery, or win-rate values.

- [ ] **Step 4: Mark the local player at both LCU boundaries**

Capture `localPlayerCellId` before consuming `myTeam` in TypeScript and Rust. Set `isLocalPlayer` by exact cell-ID equality on every emitted player payload. Keep `false` when the local cell ID is absent; the hook also excludes an identity matching `localSummonerName` as a defensive fallback.

Update Tauri payload normalization and tests without logging participant identities or raw LCU response bodies.

- [ ] **Step 5: Add account-based OP.GG loaders and the pregame hook**

Refactor `src/services/opggPlayerData.ts` so these functions accept `PlayerRiotAccount` directly and share the existing cache:

```ts
loadOpggPlayerProfileForAccount(host, account): Promise<OpggMcpPlayerProfile | null>
loadOpggRecentMatchesForAccount(host, account, limit): Promise<PlayerRecentMatch[]>
```

Keep the existing player-based exports as wrappers for current ranked UI callers.

Extend `DetectedGameSession` with `localSummonerName`, return it from `createCompanionDataSource`, and export the existing LCU-to-`PlayerRiotAccount` mapper instead of duplicating default region/platform logic.

`useArenaTeammateRating` receives mode, LCU phase, players, local summoner name, and host dependencies. It selects the first `team === 'ally' && !isLocalPlayer` participant with a real account, starts loading only for Arena `ChampSelect`, tries OP.GG profile/history first, and falls back to configured Riot profile/history. Abort stale state updates when the participant/session changes. Missing identity or fewer than three matches resolves to `insufficient` rather than Demo.

- [ ] **Step 6: Write and implement the teammate card UI**

Tests must cover:

```tsx
render(<ArenaTeammateCard state={{
  status: 'rated',
  teammateName: '真实队友',
  championId: 103,
  rating: { label: '上等马', score: 78, confidence: 'high', sampleSize: 8, reasons: ['竞技场近期状态强'], source: 'opgg' },
}} />)
expect(screen.getByText('上等马')).toBeInTheDocument()
expect(screen.getByText('78')).toBeInTheDocument()
expect(screen.queryByText(/Demo/)).not.toBeInTheDocument()
```

Render one compact `本局队友` card with champion icon, name, tier, score, confidence, sample count, reasons, and source badge. Loading says `正在读取公开战绩`; missing identity/data says `情报不足` with the specific reason. Do not render mock score, party, or mastery fields.

- [ ] **Step 7: Integrate before the waiting view and verify**

Store `session.localSummonerName` beside the existing `lcuPhase` and `lcuPlayers`. Call the hook from `useCompanionSession`, return both `lcuPhase` and its teammate state, pass them through `App.tsx`, and render `ArenaTeammateCard` in `OverlayPanel` before `SessionWaitingView` when `activeMode === 'arena'` and `lcuPhase === 'ChampSelect'`. Do not use `effectivePhase` for this condition and do not use the existing `GameShell` profile effect because both carry ranked/live or mock presentation assumptions.

Run:

```bash
npm test -- src/services/lcuAdapter.test.ts src/services/tauriHost.test.ts src/features/arena/teammate
npm run lint
npm run build
/Users/zoe/.cargo/bin/cargo test --manifest-path src-tauri/Cargo.toml lcu
```

Expected: the teammate card can load during the pregame waiting state, local player is excluded, insufficient data stays honest, and all focused checks pass.

- [ ] **Step 8: Commit the teammate feature**

```bash
git add src/services/lcuAdapter.ts src/services/lcuAdapter.test.ts src/services/tauriHost.ts src/services/tauriHost.test.ts src/services/companionDataSource.ts src/services/companionDataSource.test.ts src/services/opggPlayerData.ts src/features/arena/teammate src/app/useCompanionSession.ts src/components/OverlayPanel.tsx src/App.tsx src/App.css src-tauri/src/lcu/client.rs
git commit -m "feat: rate Arena teammate before game"
```

---

### Task 6: Full Verification and Windows Build

**Files:**
- Verify all files changed in Tasks 1-5.
- Verify `.github/workflows/windows-installer.yml` without changing its artifact names.

**Interfaces:**
- Produces a clean, pushed `codex/live-client-reliability` branch.
- Produces successful `LOL-Companion-Windows-Installer` and `LOL-Companion-Windows-Portable` artifacts.

- [ ] **Step 1: Run complete frontend and data verification**

Run:

```bash
npm run data:arena:check
npm run data:game:check
npm test
npm run lint
npm run build
```

Expected: every command exits zero and the full test count includes search, persistence, store, decision-model, manual controls, decision-view, LCU local-player, teammate-rating, and pregame-card coverage.

- [ ] **Step 2: Run complete Rust verification**

Run:

```bash
/Users/zoe/.cargo/bin/cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
/Users/zoe/.cargo/bin/cargo check --manifest-path src-tauri/Cargo.toml
/Users/zoe/.cargo/bin/cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: formatting, compilation, and all Rust tests pass.

- [ ] **Step 3: Inspect the final scope**

Run:

```bash
git diff --check
git status --short
rg -n "match\.augmentCandidates|AugmentPicker" src --glob '!*.test.*'
```

Expected: no whitespace errors, only intentional changes remain, and the final `rg` command returns no production matches.

- [ ] **Step 4: Push and trigger Windows Installer**

Run:

```bash
git push -u origin codex/live-client-reliability
gh workflow run windows-installer.yml --ref codex/live-client-reliability
```

- [ ] **Step 5: Watch the run and verify both artifacts**

Run:

```bash
arena_run_id=$(gh run list --workflow windows-installer.yml --branch codex/live-client-reliability --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$arena_run_id" --exit-status
gh api "repos/ZOELIU2333/lol-companion-prototype/actions/runs/$arena_run_id/artifacts" --jq '{total_count, artifacts: [.artifacts[] | {name, size_in_bytes, expired}]}'
```

Expected: the run succeeds and returns exactly the installer and portable artifacts with `expired: false` and non-zero sizes.
