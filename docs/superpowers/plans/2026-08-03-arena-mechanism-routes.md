# Arena Mechanism Graph and Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure, deterministic mechanism graph that produces stable, high-ceiling, and off-meta Arena routes with transparent evidence and purchase advice.

**Architecture:** Catalog definitions and champion/item facts become capability nodes connected by five typed edge semantics. A route planner searches short valid paths, scores three different objectives, enforces route diversity, and generates explanations from the same score components.

**Tech Stack:** TypeScript 5.9, Vitest 4, current bilingual Arena catalog, current Data Dragon item/champion metadata.

## Global Constraints

- Edge semantics are exactly `triggers`, `amplifies`, `converts`, `loops`, and `conflicts`.
- Evidence is exactly `current-statistics`, `community-sample`, `mechanism-verified`, or `theoretical`.
- No synthetic probability, invented win rate, or generative AI in the realtime path.
- An off-meta route must contain at least one mechanism-verified edge.
- Each recommendation exposes an affordable component, first completed item, later direction, missing nodes, risk, and evidence.

---

### Task 1: Define mechanism and evidence primitives

**Files:**
- Create: `src/features/arena/graph/types.ts`
- Create: `src/features/arena/graph/evidence.ts`
- Test: `src/features/arena/graph/evidence.test.ts`

**Interfaces:**
- Produces: `MechanismNode`, `MechanismEdge`, `EvidenceRecord`, `CapabilityWeight`.
- Produces: `canRecommendOffMeta(edges): boolean`.
- Produces: `evidenceConfidence(records): 'low' | 'medium' | 'high'`.

- [ ] **Step 1: Write failing evidence tests.**

```ts
it('rejects an off-meta chain supported only by theory', () => {
  expect(canRecommendOffMeta([{ relation: 'amplifies', evidence: [{ kind: 'theoretical' }] }])).toBe(false)
})

it('accepts a chain with reviewed mechanism evidence', () => {
  expect(canRecommendOffMeta([{ relation: 'triggers', evidence: [{ kind: 'mechanism-verified' }] }])).toBe(true)
})
```

- [ ] **Step 2: Run the test and verify it fails.**

Run: `npm run test -- src/features/arena/graph/evidence.test.ts`  
Expected: FAIL because the graph module does not exist.

- [ ] **Step 3: Implement exact discriminated unions.**

```ts
export type EdgeRelation = 'triggers' | 'amplifies' | 'converts' | 'loops' | 'conflicts'
export type EvidenceKind = 'current-statistics' | 'community-sample' | 'mechanism-verified' | 'theoretical'

export type MechanismEdge = {
  from: string
  to: string
  relation: EdgeRelation
  weight: number
  explanation: string
  evidence: EvidenceRecord[]
}
```

- [ ] **Step 4: Run focused tests.**

Run: `npm run test -- src/features/arena/graph/evidence.test.ts`

- [ ] **Step 5: Commit.**

```bash
git add src/features/arena/graph
git commit -m "feat: define Arena mechanism evidence"
```

### Task 2: Infer champion, augment, and item capabilities

**Files:**
- Create: `src/features/arena/graph/capabilities.ts`
- Test: `src/features/arena/graph/capabilities.test.ts`
- Create: `src/features/arena/graph/overrides.ts`
- Create: `src/features/arena/graph/buildGraph.ts`
- Test: `src/features/arena/graph/buildGraph.test.ts`

**Interfaces:**
- Consumes: `Champion`, `ArenaAugmentDefinition`, `ArenaItemDefinition`.
- Produces: `inferChampionCapabilities(champion): CapabilityWeight[]`.
- Produces: `inferAugmentCapabilities(augment): CapabilityWeight[]`.
- Produces: `inferItemCapabilities(item): CapabilityWeight[]`.
- Produces: `buildMechanismGraph(input): MechanismGraph`.

- [ ] **Step 1: Write failing capability tests.**

```ts
it('recognizes Earthwake as a dash-triggered damage mechanic', () => {
  expect(inferAugmentCapabilities(earthwake)).toEqual(expect.arrayContaining([
    expect.objectContaining({ capability: 'dash-trigger' }),
    expect.objectContaining({ capability: 'proc-damage' }),
  ]))
})

it('applies the reviewed Ahri multi-dash override', () => {
  expect(inferChampionCapabilities(ahri)).toContainEqual(expect.objectContaining({ capability: 'multi-dash' }))
})
```

- [ ] **Step 2: Run tests and verify failure.**

Run: `npm run test -- src/features/arena/graph/capabilities.test.ts src/features/arena/graph/buildGraph.test.ts`

- [ ] **Step 3: Implement token inference and reviewed overrides.**

The token map covers dash/blink/teleport, ability hit, attack hit, critical strike, heal, shield, burn, cooldown/haste, summon, immobilize, execute, stacking, and revive across current Chinese and English wording. Overrides are keyed only by stable champion key or augment API name.

```ts
export const augmentOverrides = {
  Earthwake: ['dash-trigger', 'proc-damage'],
  Spellwake: ['ability-hit-trigger', 'repeat-cast', 'proc-damage'],
  PhenomenalEvil: ['ability-hit-trigger', 'ap-scaling', 'stacking'],
} satisfies Record<string, ArenaCapability[]>
```

- [ ] **Step 4: Build edges from shared capabilities and explicit conversions.**

Direct shared trigger/output creates `triggers` or `amplifies`; resource/damage model change requires an override-backed `converts`; a path returning to its initial trigger creates `loops`; mutually exclusive play requirements create `conflicts`.

- [ ] **Step 5: Run focused and catalog tests.**

Run: `npm run test -- src/features/arena/graph src/features/arena/catalog`

- [ ] **Step 6: Commit.**

```bash
git add src/features/arena/graph
git commit -m "feat: infer Arena mechanism graph"
```

### Task 3: Add optional evidence provider registry

**Files:**
- Create: `src/features/arena/graph/evidenceProvider.ts`
- Test: `src/features/arena/graph/evidenceProvider.test.ts`
- Create: `src/features/arena/graph/communityEvidence.ts`

**Interfaces:**
- Produces: `ArenaEvidenceProvider.read(context, signal): Promise<EvidenceRecord[]>`.
- Produces: `collectArenaEvidence(providers, context, now): Promise<EvidenceSnapshot>`.
- Produces provider health and rejects unqualified statistical freshness.

- [ ] **Step 1: Write failing provider tests.**

```ts
it('excludes statistics without patch and collection metadata', async () => {
  const snapshot = await collectArenaEvidence([providerReturningUnqualifiedStats], context, now)
  expect(snapshot.records).toEqual([])
  expect(snapshot.health[0].status).toBe('rejected')
})

it('keeps mechanism evidence when statistical providers fail', async () => {
  const snapshot = await collectArenaEvidence([failingStatsProvider, reviewedMechanismProvider], context, now)
  expect(snapshot.records.map((record) => record.kind)).toContain('mechanism-verified')
})
```

Also test timeout isolation, current-patch acceptance, older-patch rejection, community sample URLs, and duplicate evidence collapse.

- [ ] **Step 2: Run tests and verify failure.**

Run: `npm run test -- src/features/arena/graph/evidenceProvider.test.ts`

- [ ] **Step 3: Implement provider validation and registry.**

`current-statistics` requires patch, sample size, collection time, metric name, value, and source URL. `community-sample` requires source URL, collection time, and a concise reproducible claim. Provider failure never removes local mechanism evidence.

- [ ] **Step 4: Add a reviewed local community evidence file.**

Store entries keyed by stable champion key, augment API names, and item IDs. Every entry includes URL, collected time, claim, and reviewed mechanism edges; an empty file is valid and does not invent samples.

- [ ] **Step 5: Run focused tests and commit.**

```bash
npm run test -- src/features/arena/graph/evidenceProvider.test.ts src/features/arena/graph/evidence.test.ts
git add src/features/arena/graph
git commit -m "feat: validate optional Arena evidence providers"
```

### Task 4: Implement three-objective route generation

**Files:**
- Create: `src/features/arena/recommendation/types.ts`
- Create: `src/features/arena/recommendation/routePlanner.ts`
- Test: `src/features/arena/recommendation/routePlanner.test.ts`
- Modify: `src/types.ts`
- Modify: `src/lib/recommendations.ts`

**Interfaces:**
- Produces: `planArenaRoutes(input: ArenaRouteInput): ArenaRouteSet`.
- Produces route kinds `stable | ceiling | off-meta`.
- Produces score components `championFit`, `selectedSynergy`, `immediateValue`, `completionDistance`, `contextValue`, `evidenceValue`, `novelty`, `riskPenalty`.

- [ ] **Step 1: Write failing route tests.**

```ts
it('produces three distinct route objectives for Ahri candidates', () => {
  const result = planArenaRoutes(ahriFixture)
  expect(result.routes.map((route) => route.kind)).toEqual(['stable', 'ceiling', 'off-meta'])
  expect(new Set(result.routes.map((route) => route.coreSignature)).size).toBe(3)
})

it('derives total and explanation from identical components', () => {
  const candidate = planArenaRoutes(ahriFixture).routes[0].candidates[0]
  expect(candidate.total).toBe(candidate.components.reduce((sum, part) => sum + part.points, 0))
})
```

Also test deterministic ties, no credible distinct route, theory-only off-meta rejection, stale-stat exclusion, two-to-three-step ceiling search, and conflict penalties.

- [ ] **Step 2: Run tests and verify failure.**

Run: `npm run test -- src/features/arena/recommendation/routePlanner.test.ts`

- [ ] **Step 3: Implement route scoring.**

Stable weights immediate value and current evidence highest. Ceiling weights graph path value and complete loops while penalizing missing nodes. Off-meta weights novelty only after mechanism validity, then applies build cost and risk penalties.

- [ ] **Step 4: Enforce diversity by core signature.**

Core signature is the sorted set of recommended candidate API name plus first two completed item IDs and decisive mechanism edge. If a route duplicates a previous signature, select the next valid candidate path; otherwise return `alternativeUnavailable: true` with a clear reason.

- [ ] **Step 5: Remove Arena probability and seed-value fields from consumers.**

Replace `probability`, `currentValue`, and `scalingValue` with score components, evidence, missing nodes, and risk. Preserve ranked-mode types only where still used outside Arena.

- [ ] **Step 6: Run full tests.**

Run: `npm run test`  
Run: `npm run lint`  
Run: `npm run build`

- [ ] **Step 7: Commit.**

```bash
git add src/features/arena/recommendation src/lib/recommendations.ts src/types.ts
git commit -m "feat: plan distinct Arena build routes"
```

### Task 5: Add affordable purchase planning

**Files:**
- Create: `src/features/arena/recommendation/purchasePlan.ts`
- Test: `src/features/arena/recommendation/purchasePlan.test.ts`
- Modify: `src/features/arena/recommendation/routePlanner.ts`

**Interfaces:**
- Produces: `createPurchasePlan(route, ownedItemIds, gold, itemCatalog): ArenaPurchasePlan`.
- Produces: `buyNow`, `firstCompletedItem`, `laterItems`, and `reason`.

- [ ] **Step 1: Write failing affordability tests.**

```ts
it('recommends an affordable component before the completed item', () => {
  const plan = createPurchasePlan(cosmicRoute, [], 1680, itemCatalog)
  expect(plan.buyNow?.totalGold).toBeLessThanOrEqual(1680)
  expect(plan.firstCompletedItem.id).toBe(4629)
})
```

Also test owned components, exact completion gold, no affordable component, defensive override, and missing item recipes.

- [ ] **Step 2: Run test and verify failure.**

Run: `npm run test -- src/features/arena/recommendation/purchasePlan.test.ts`

- [ ] **Step 3: Implement recipe traversal and contextual priority.**

Walk `from` recipes recursively, subtract owned components, filter purchasable components by current gold, and choose the component with highest route capability gain per remaining gold. If none is affordable, return `buyNow: null` and exact remaining gold.

- [ ] **Step 4: Integrate purchase plans into all three routes and verify.**

Run: `npm run test -- src/features/arena/recommendation`  
Run: `npm run build`

- [ ] **Step 5: Commit.**

```bash
git add src/features/arena/recommendation
git commit -m "feat: add Arena purchase planning"
```
