# Arena Realtime Session and UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge automatic game facts and fast manual augment input into a stable Arena session, then render the approved icon-first three-step decision UI.

**Architecture:** Independent source ports emit field-level observations with provenance and capability states. A fusion service produces semantic changes for the route planner; React renders compact and expanded view models and never performs polling or scoring itself.

**Tech Stack:** TypeScript 5.9, React 19, Vitest 4, Tauri 2, Rust 2021, LCU and Live Client local APIs.

## Global Constraints

- Canonical Arena mode literal is `arena`; production code must not use `augment` as a mode value.
- Champion, level, gold, items, and game time are automatic when available.
- Selected/candidate augments prefer automatic reads but always have icon-based manual fallback.
- Polling is non-overlapping, bounded, and notifies only on semantic material changes.
- Compact UI uses the fixed order `本轮选什么`, `回城买什么`, `这套怎么成型`.

---

### Task 1: Define field-level session fusion

**Files:**
- Create: `src/features/arena/session/types.ts`
- Create: `src/features/arena/session/fusion.ts`
- Test: `src/features/arena/session/fusion.test.ts`
- Modify: `src/types.ts`
- Modify: `src/services/lcuAdapter.ts`
- Test: `src/services/lcuAdapter.test.ts`

**Interfaces:**
- Produces: `ArenaObservation<T>`, `PartialArenaSession`, `ArenaSession`, `ArenaSourceCapability`.
- Produces: `mergeArenaSession(current, incoming): ArenaSession`.
- Produces: `classifyArenaChange(before, after): ArenaSessionChange[]`.

- [ ] **Step 1: Write failing fusion tests.**

```ts
it('does not replace a newer manual candidate set with missing automatic data', () => {
  const merged = mergeArenaSession(manualCandidatesAt(200), automaticCandidatesUnavailableAt(300))
  expect(merged.candidates.value).toHaveLength(3)
  expect(merged.candidates.source).toBe('manual')
})

it('clears round candidates but keeps selected augments', () => {
  const next = mergeArenaSession(roundOneSession, roundChangedAt(400))
  expect(next.candidates.value).toEqual([])
  expect(next.selectedAugments.value).toEqual(roundOneSession.selectedAugments.value)
})
```

Also test newer valid automatic values, stale labels, unsupported versus empty, item completion changes, gold-only changes, and route-notification classification.

- [ ] **Step 2: Run tests and verify failure.**

Run: `npm run test -- src/features/arena/session/fusion.test.ts src/services/lcuAdapter.test.ts`

- [ ] **Step 3: Implement observations and merge precedence.**

```ts
export type ArenaObservationState = 'live' | 'stale' | 'unsupported' | 'unavailable' | 'error'
export type ArenaSource = 'lcu' | 'live-client' | 'manual' | 'bundled-cache' | 'runtime-cache'

export type ArenaObservation<T> = {
  value: T
  source: ArenaSource
  observedAt: number
  state: ArenaObservationState
}
```

Valid newer values win. `unsupported`, `unavailable`, and `error` update health but never erase a valid value. Manual and automatic values use timestamp ordering once both are valid.

- [ ] **Step 4: Normalize the mode literal.**

Run after edits: `rg -n "['\"]augment['\"]" src src-tauri`  
Expected: no mode-literal matches.

- [ ] **Step 5: Run tests.**

Run: `npm run test -- src/features/arena/session src/services/lcuAdapter.test.ts`

- [ ] **Step 6: Commit.**

```bash
git add src/features/arena/session src/types.ts src/services/lcuAdapter.ts src/services/lcuAdapter.test.ts
git commit -m "refactor: normalize realtime Arena sessions"
```

### Task 2: Build source ports and manual store

**Files:**
- Create: `src/features/arena/session/ports.ts`
- Create: `src/features/arena/session/composite.ts`
- Test: `src/features/arena/session/composite.test.ts`
- Create: `src/features/arena/session/manualStore.ts`
- Test: `src/features/arena/session/manualStore.test.ts`
- Modify: `src/services/tauriHost.ts`
- Modify: `src/services/liveClientData.ts`

**Interfaces:**
- Produces: `ArenaSessionPort.read(signal: AbortSignal): Promise<PartialArenaSession>`.
- Produces: `CompositeArenaSession.read(signal): Promise<ArenaSession>`.
- Produces: `ManualArenaSessionStore.setChampion`, `.setCandidates`, `.selectAugment`, `.resetRound`.

- [ ] **Step 1: Write failing composite and manual-store tests.**

```ts
it('reports candidate discovery as unsupported without treating it as empty', async () => {
  const session = await compositeWithUnsupportedCandidates.read(new AbortController().signal)
  expect(session.capabilities.candidates).toBe('unsupported')
  expect(session.candidates.value).toEqual(manualCandidateIds)
})
```

Also test adapter timeout, one-source failure isolation, duplicate candidate prevention, exactly-three validation, selected-history deduplication, and manual round reset.

- [ ] **Step 2: Run focused tests and verify failure.**

Run: `npm run test -- src/features/arena/session/composite.test.ts src/features/arena/session/manualStore.test.ts`

- [ ] **Step 3: Implement ports and composite reads.**

Use `Promise.allSettled`, one `AbortSignal`, and per-port health. A failed port contributes an error capability observation while successful ports still merge.

- [ ] **Step 4: Implement the manual store.**

The store uses stable catalog IDs, refuses duplicate candidates, requires exactly three before confirmation, appends the confirmed candidate to selected history, and clears candidates for the next round.

- [ ] **Step 5: Adapt Tauri/Live Client bridges and verify.**

Run: `npm run test -- src/features/arena/session src/services/liveClientData.test.ts src/services/tauriHost.test.ts`  
Run: `npm run build`

- [ ] **Step 6: Commit.**

```bash
git add src/features/arena/session src/services/tauriHost.ts src/services/liveClientData.ts
git commit -m "feat: fuse automatic and manual Arena sources"
```

### Task 3: Add Rust local-client discovery and realtime commands

**Files:**
- Create: `src-tauri/src/lcu/discovery.rs`
- Create: `src-tauri/src/lcu/client.rs`
- Create: `src-tauri/src/lcu/mod.rs`
- Create: `src-tauri/src/live_client.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces Rust command: `read_arena_lcu_session() -> ArenaLcuSnapshot`.
- Produces Rust command: `read_live_client_snapshot() -> LiveClientSnapshot`.
- Produces candidate capability `available | unsupported | unavailable | error`.

- [ ] **Step 1: Add failing Rust discovery and parsing tests.**

```rust
#[test]
fn custom_lockfile_path_is_first() {
    let env = DiscoveryEnvironment::for_test()
        .with_var("LEAGUE_CLIENT_LOCKFILE", r"D:\\Riot\\League of Legends\\lockfile");
    assert_eq!(candidate_lockfile_paths(&env)[0], PathBuf::from(r"D:\Riot\League of Legends\lockfile"));
}
```

Include malformed lockfile, common/non-default install roots, current summoner, Arena queue mapping, Live Client item IDs, missing endpoint, and unknown JSON fields.

- [ ] **Step 2: Run Rust tests and verify failure.**

Run: `cargo test --manifest-path src-tauri/Cargo.toml lcu`  
Run: `cargo test --manifest-path src-tauri/Cargo.toml live_client`

- [ ] **Step 3: Extract discovery and authenticated LCU client code from `lib.rs`.**

Discovery checks the environment override first, then process/registry roots when available, then common paths/drives. Credentials remain inside Rust and never cross the Tauri boundary.

- [ ] **Step 4: Implement capability-probed Arena fields and Live Client parsing.**

Only a positively recognized endpoint and round state may report `available` with an empty candidate list. A 404 or structurally absent field reports `unsupported`.

- [ ] **Step 5: Run Rust verification.**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`  
Run: `cargo check --manifest-path src-tauri/Cargo.toml`

- [ ] **Step 6: Commit.**

```bash
git add src-tauri/src
git commit -m "refactor: isolate Arena local-client adapters"
```

### Task 4: Build the approved icon-first three-step UI

**Files:**
- Create: `src/features/arena/ui/ArenaDecisionView.tsx`
- Test: `src/features/arena/ui/ArenaDecisionView.test.tsx`
- Create: `src/features/arena/ui/AugmentPicker.tsx`
- Test: `src/features/arena/ui/AugmentPicker.test.tsx`
- Create: `src/features/arena/ui/ArenaExpandedView.tsx`
- Test: `src/features/arena/ui/ArenaExpandedView.test.tsx`
- Modify: `src/components/GameShell.tsx`
- Modify: `src/app/useCompanionSession.ts`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `ArenaSession`, `ArenaRouteSet`, `ArenaCatalogIndex`.
- Produces compact sections `本轮选什么`, `回城买什么`, `这套怎么成型`.
- Produces expanded routes, evidence, manual picker, source health, and diagnostics entry.

- [ ] **Step 1: Add React Testing Library dependencies and failing UI tests.**

```tsx
it('shows candidate icons, affordable purchase, and a labeled combo chain', () => {
  render(<ArenaDecisionView model={ahriDecisionFixture} />)
  expect(screen.getByRole('heading', { name: '本轮选什么' })).toBeVisible()
  expect(screen.getByAltText('大地苏醒')).toHaveAttribute('src', expect.stringContaining('earthwake'))
  expect(screen.getByText('以太精魂')).toBeVisible()
  expect(screen.getByText('位移爆发循环')).toBeVisible()
})
```

Also test local icon fallback, exactly three candidates, manual keyboard search, compact/expanded transition, three routes, stale source labels, and no-credible-alternative copy.

- [ ] **Step 2: Run UI tests and verify failure.**

Run: `npm run test -- src/features/arena/ui`

- [ ] **Step 3: Implement the icon picker and image fallback.**

Picker searches Chinese name, English name, and API name. Image failure swaps to a bundled placeholder while preserving localized alt text.

- [ ] **Step 4: Implement the compact three-step decision view.**

Candidate cards show icon, name, total, route, and one reason. Purchase cards show `buyNow`, `firstCompletedItem`, and later direction. The combo chain is one left-to-right labeled row, not a network graph.

- [ ] **Step 5: Implement expanded view and hook orchestration.**

The hook polls through `CompositeArenaSession`, prevents overlap, aborts on unmount, recalculates after semantic events, and notifies only for selected augment, completed item, leading route, or buildable-chain changes.

- [ ] **Step 6: Run complete frontend verification.**

Run: `npm run test`  
Run: `npm run lint`  
Run: `npm run build`

- [ ] **Step 7: Commit.**

```bash
git add src/features/arena/ui src/components/GameShell.tsx src/app/useCompanionSession.ts src/App.css package.json package-lock.json
git commit -m "feat: deliver icon-first Arena decision UI"
```
