# Real Live Session Takeover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the production Demo scenario and make fresh or reconnecting Live Client evidence automatically drive the visible League match page.

**Architecture:** Add a small pure session-authority module that derives the visible session state and resolves Live Client versus LCU mode priority. `useCompanionSession` applies those rules while the overlay and game shell use an explicit `waiting | live | reconnecting` state to decide whether real match content may render. Mock matches remain internal recommendation templates and test fixtures only.

**Tech Stack:** React 19, TypeScript 5.9, Vitest 4, Testing Library, Tauri 2, Rust, GitHub Actions Windows x64.

## Global Constraints

- Production UI has exactly three real-session states: `waiting`, `live`, and `reconnecting`.
- Live Client is authoritative for mode, champion, items, and game time whenever it has a fresh or valid reconnecting snapshot.
- LCU may provide provisional client context but cannot overwrite a usable Live Client snapshot.
- `KIWI`, `CHERRY`, and `ARENA` must all map to Arena in TypeScript and Rust.
- Mock matches may remain as internal templates and test fixtures but cannot be selected or presented as the current production match.
- No production UI copy may contain `Demo 场景`, `刷新 Demo`, or `切换 Demo`.
- Do not add dependencies or redesign the recommendation engine in this change.

---

## File Structure

- Create `src/app/liveSessionAuthority.ts`: pure real-session state and source-priority rules.
- Create `src/app/liveSessionAuthority.test.ts`: source-priority, mode, and reconnect regression coverage.
- Modify `src/app/useCompanionSession.ts`: apply the authority rules, keep refs current across polling loops, and remove manual Demo scene APIs.
- Modify `src/services/lcuAdapter.ts` and `src/services/lcuAdapter.test.ts`: recognize current Arena aliases in the TypeScript LCU boundary.
- Modify `src-tauri/src/lcu/client.rs`: recognize the same aliases in the Rust LCU boundary and test them.
- Create `src/components/SessionWaitingView.tsx` and `src/components/SessionWaitingView.test.tsx`: focused waiting UI with connection guidance.
- Modify `src/components/OverlayPanel.tsx`: render waiting versus real match content from the explicit session state and remove Demo controls.
- Modify `src/components/GameShell.tsx`: suppress simulated match stage content while waiting.
- Modify `src/App.tsx`: pass the session state and remove obsolete Demo callbacks and match lists.
- Modify `src/App.css`: replace Demo selector styles with waiting-state styles.
- Delete `src/components/DemoScenarioSwitcher.tsx`: remove the production selector entirely.
- Modify `src/app/connectionEvidence.ts` and `src/app/connectionEvidence.test.ts`: replace the disconnected `Demo` label with a waiting label.

---

### Task 1: Encode Live Session Authority and Current Arena Aliases

**Files:**
- Create: `src/app/liveSessionAuthority.ts`
- Create: `src/app/liveSessionAuthority.test.ts`
- Modify: `src/services/lcuAdapter.ts:89-99`
- Modify: `src/services/lcuAdapter.test.ts:37-45`
- Modify: `src-tauri/src/lcu/client.rs:172-184`
- Test: `src-tauri/src/lcu/client.rs:566-585`

**Interfaces:**
- Consumes: `LiveClientReading`, `LiveClientSnapshot`, and `GameMode`.
- Produces: `LiveSessionState = 'waiting' | 'live' | 'reconnecting'`.
- Produces: `deriveLiveSessionState(reading: LiveClientReading): LiveSessionState`.
- Produces: `hasUsableLiveSnapshot(reading: LiveClientReading): boolean`.
- Produces: `resolveAuthoritativeMode(input: { live: LiveClientReading; lcuMode: GameMode | null; fallbackMode: GameMode }): GameMode`.

- [ ] **Step 1: Write failing TypeScript authority and alias tests**

```ts
import { describe, expect, it } from 'vitest'
import type { LiveClientReading } from '../services/liveClientData'
import { deriveLiveSessionState, hasUsableLiveSnapshot, resolveAuthoritativeMode } from './liveSessionAuthority'

const freshKiwi: LiveClientReading = {
  state: 'fresh',
  snapshot: { gameTime: 300, gameMode: 'KIWI', championName: 'Ezreal', currentItemIds: [], source: 'live-client-data' },
  ageSeconds: 0,
  failureKind: null,
}

it('lets fresh KIWI data override a healthy ranked LCU session', () => {
  expect(resolveAuthoritativeMode({ live: freshKiwi, lcuMode: 'ranked', fallbackMode: 'ranked' })).toBe('arena')
  expect(deriveLiveSessionState(freshKiwi)).toBe('live')
  expect(hasUsableLiveSnapshot(freshKiwi)).toBe(true)
})

it('retains a valid reconnecting real snapshot', () => {
  const reconnecting = { ...freshKiwi, state: 'reconnecting' as const, ageSeconds: 6, failureKind: 'timeout' as const }
  expect(deriveLiveSessionState(reconnecting)).toBe('reconnecting')
  expect(resolveAuthoritativeMode({ live: reconnecting, lcuMode: 'ranked', fallbackMode: 'ranked' })).toBe('arena')
})

it('returns to waiting after the real snapshot is unavailable', () => {
  const unavailable: LiveClientReading = { state: 'unavailable', snapshot: null, ageSeconds: null, failureKind: 'connection' }
  expect(deriveLiveSessionState(unavailable)).toBe('waiting')
  expect(hasUsableLiveSnapshot(unavailable)).toBe(false)
})
```

Extend `src/services/lcuAdapter.test.ts`:

```ts
expect(mapLcuQueueToMode('KIWI')).toBe('arena')
expect(mapLcuQueueToMode('CHERRY')).toBe('arena')
```

Extend the Rust `maps_arena_queues_to_the_canonical_mode` test:

```rust
assert_eq!(map_queue_to_mode(Some("KIWI")), Some("arena".to_string()));
assert_eq!(map_queue_to_mode(Some("CHERRY")), Some("arena".to_string()));
```

- [ ] **Step 2: Run focused tests and verify the new expectations fail**

Run:

```bash
npm test -- src/app/liveSessionAuthority.test.ts src/services/lcuAdapter.test.ts
cargo test --manifest-path src-tauri/Cargo.toml maps_arena_queues_to_the_canonical_mode
```

Expected: TypeScript fails because `liveSessionAuthority.ts` does not exist and the LCU `KIWI` assertion fails; Rust fails its `KIWI` assertion.

- [ ] **Step 3: Implement the pure authority module and aliases**

Create `src/app/liveSessionAuthority.ts`:

```ts
import { isArenaGameMode, type LiveClientReading } from '../services/liveClientData'
import type { GameMode } from '../types'

export type LiveSessionState = 'waiting' | 'live' | 'reconnecting'

export function hasUsableLiveSnapshot(reading: LiveClientReading): boolean {
  return Boolean(reading.snapshot && (reading.state === 'fresh' || reading.state === 'reconnecting'))
}

export function deriveLiveSessionState(reading: LiveClientReading): LiveSessionState {
  if (reading.state === 'fresh' && reading.snapshot) return 'live'
  if (reading.state === 'reconnecting' && reading.snapshot) return 'reconnecting'
  return 'waiting'
}

export function resolveAuthoritativeMode(input: {
  live: LiveClientReading
  lcuMode: GameMode | null
  fallbackMode: GameMode
}): GameMode {
  if (hasUsableLiveSnapshot(input.live)) {
    return isArenaGameMode(input.live.snapshot?.gameMode) ? 'arena' : 'ranked'
  }
  return input.lcuMode ?? input.fallbackMode
}
```

In both LCU mappers, extend the Arena condition with `cherry` and `kiwi` while retaining `arena` and `海克斯`.

- [ ] **Step 4: Run focused tests and verify they pass**

Run:

```bash
npm test -- src/app/liveSessionAuthority.test.ts src/services/lcuAdapter.test.ts
cargo test --manifest-path src-tauri/Cargo.toml maps_arena_queues_to_the_canonical_mode
```

Expected: all focused tests pass.

- [ ] **Step 5: Commit the authority boundary**

```bash
git add src/app/liveSessionAuthority.ts src/app/liveSessionAuthority.test.ts src/services/lcuAdapter.ts src/services/lcuAdapter.test.ts src-tauri/src/lcu/client.rs
git commit -m "fix: prioritize current Arena live sessions"
```

---

### Task 2: Apply Real-Session Priority in the Polling Hook

**Files:**
- Modify: `src/app/useCompanionSession.ts:91-150, 257-344, 385-454, 508-540`
- Test: `src/app/liveSessionAuthority.test.ts`

**Interfaces:**
- Consumes: `deriveLiveSessionState`, `hasUsableLiveSnapshot`, and `resolveAuthoritativeMode` from Task 1.
- Produces: hook result property `liveSessionState: LiveSessionState`.
- Removes: `availableMatches`, `refreshMatch`, and `selectScenario` from the hook result.

- [ ] **Step 1: Strengthen the priority regression test**

Add to `src/app/liveSessionAuthority.test.ts`:

```ts
it('does not let a later ranked LCU poll overwrite reconnecting Arena evidence', () => {
  const reconnecting = { ...freshKiwi, state: 'reconnecting' as const, ageSeconds: 8, failureKind: 'timeout' as const }
  const modeAfterLcuPoll = resolveAuthoritativeMode({
    live: reconnecting,
    lcuMode: 'ranked',
    fallbackMode: 'arena',
  })
  expect(modeAfterLcuPoll).toBe('arena')
})
```

- [ ] **Step 2: Run the focused authority test**

Run: `npm test -- src/app/liveSessionAuthority.test.ts`

Expected: PASS against the Task 1 implementation, establishing the rule used by the hook refactor.

- [ ] **Step 3: Integrate the authority module into both polling loops**

In `useCompanionSession`:

```ts
const liveReadingRef = useRef(liveReading)
const liveSessionState = deriveLiveSessionState(liveReading)

useEffect(() => {
  liveReadingRef.current = liveReading
}, [liveReading])
```

In the LCU polling success path, resolve the mode without overwriting usable live evidence:

```ts
const nextMode = resolveAuthoritativeMode({
  live: liveReadingRef.current,
  lcuMode: session.mode,
  fallbackMode: activeModeRef.current,
})
setActiveMode(nextMode)
setActivePhase(nextMode === 'arena' ? 'live' : 'pregame')
```

Add and synchronize `activeModeRef` in the same pattern as `lcuStateRef`. In the Live Client polling loop, update the ref immediately before React state and always apply a usable snapshot, regardless of LCU state:

```ts
liveReadingRef.current = reading
setLiveReading(reading)
if (hasUsableLiveSnapshot(reading)) {
  const inferredMode = resolveAuthoritativeMode({
    live: reading,
    lcuMode: null,
    fallbackMode: activeModeRef.current,
  })
  activeModeRef.current = inferredMode
  setActiveMode(inferredMode)
  setActivePhase(inferredMode === 'arena' ? 'live' : 'pregame')
  // Keep the existing champion-template lookup for local recommendation fields.
}
```

Remove the `lcuStateRef.current !== 'ready'` gate. Keep `matchIndex` only as an internal recommendation-template selector. Remove `resetForMatch`, `refreshMatch`, and `selectScenario`, then stop returning their public values. Return `liveSessionState`.

- [ ] **Step 4: Run TypeScript tests and static checks**

Run:

```bash
npm test -- src/app/liveSessionAuthority.test.ts src/app/connectionEvidence.test.ts src/services/liveClientData.test.ts
npx tsc -b --pretty false
```

Expected: tests and type checking pass after callers are updated in Task 3; if TypeScript currently reports obsolete `App.tsx` props, record those exact errors and continue directly to Task 3 without committing a broken tree.

- [ ] **Step 5: Commit after Task 3 completes the caller update**

Do not create a partial commit if `App.tsx` still depends on removed properties. Include this hook change in the Task 3 UI commit so each commit remains buildable.

---

### Task 3: Replace Demo Controls with Waiting and Real-Match UI

**Files:**
- Create: `src/components/SessionWaitingView.tsx`
- Create: `src/components/SessionWaitingView.test.tsx`
- Modify: `src/components/OverlayPanel.tsx:1-205`
- Modify: `src/components/GameShell.tsx:1-430`
- Modify: `src/App.tsx:1-50`
- Modify: `src/App.css:1-30, 930-940, 1113-1143`
- Modify: `src/app/connectionEvidence.ts:4-46`
- Modify: `src/app/connectionEvidence.test.ts:14-46`
- Delete: `src/components/DemoScenarioSwitcher.tsx`
- Modify: `src/app/useCompanionSession.ts` from Task 2

**Interfaces:**
- Consumes: `LiveSessionState` and `liveSessionState` from Tasks 1-2.
- Produces: `SessionWaitingView({ connectionStatusLabel }: { connectionStatusLabel: string })`.
- Adds: `liveSessionState: LiveSessionState` to `OverlayPanelProps` and `GameShellProps`.
- Removes: `matches`, `onRefresh`, and `onScenarioChange` from `OverlayPanelProps`.

- [ ] **Step 1: Write the failing waiting-view test**

Create `src/components/SessionWaitingView.test.tsx`:

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SessionWaitingView } from './SessionWaitingView'

afterEach(cleanup)

describe('SessionWaitingView', () => {
  it('shows a real connection waiting state without Demo controls', () => {
    render(<SessionWaitingView connectionStatusLabel="已连接客户端" />)
    expect(screen.getByRole('heading', { name: '等待进入游戏' })).toBeVisible()
    expect(screen.getByText('已连接客户端')).toBeVisible()
    expect(screen.getByText(/进入对局后会自动读取/)).toBeVisible()
    expect(document.body.textContent).not.toContain('Demo 场景')
  })
})
```

Update the disconnected assertion in `connectionEvidence.test.ts`:

```ts
expect(deriveConnectionPresentation({ lcuState: 'unavailable', lcuPhase: null, live: unavailable }))
  .toEqual({ status: 'offline', label: '未连接客户端 · 等待进入游戏', isDetected: false })
```

- [ ] **Step 2: Run UI tests and verify they fail**

Run:

```bash
npm test -- src/components/SessionWaitingView.test.tsx src/app/connectionEvidence.test.ts
```

Expected: waiting component import fails and the old disconnected presentation still reports Demo.

- [ ] **Step 3: Implement the waiting component and disconnected presentation**

Create `SessionWaitingView.tsx`:

```tsx
import { Gamepad2 } from 'lucide-react'

export function SessionWaitingView({ connectionStatusLabel }: { connectionStatusLabel: string }) {
  return (
    <section className="session-waiting" aria-live="polite">
      <Gamepad2 size={28} aria-hidden="true" />
      <p className="eyebrow">实时助手</p>
      <h2>等待进入游戏</h2>
      <strong>{connectionStatusLabel}</strong>
      <p>进入对局后会自动读取英雄、装备与竞技场状态，无需手动刷新。</p>
    </section>
  )
}
```

Change `ConnectionStatus` from `demo` to `offline` and return `{ status: 'offline', label: '未连接客户端 · 等待进入游戏', isDetected: false }` when no real source is available.

- [ ] **Step 4: Gate match rendering and remove all Demo scene APIs**

In `OverlayPanel`, remove the `DemoScenarioSwitcher` import, `matches`, `onRefresh`, and `onScenarioChange`. Add `liveSessionState`. Make the header refresh button call `onRefreshDiagnostics`. After the diagnostic panel, render:

```tsx
{liveSessionState === 'waiting' && (
  <SessionWaitingView connectionStatusLabel={connectionStatusLabel} />
)}
```

Add `liveSessionState !== 'waiting'` to the existing ranked recommendation condition and to the existing Arena decision condition. This preserves both current content blocks byte-for-byte while preventing either one from rendering without a usable real snapshot.

In `GameShell`, add `liveSessionState` and render `.game-stage` only when `liveSessionState !== 'waiting'`. Add `waiting-shell` to the main class list while waiting. Close any selected player detail if the state changes to waiting.

In `App.tsx`, pass `liveSessionState` to both components and remove `matches`, `onRefresh`, and `onScenarioChange`. Delete `DemoScenarioSwitcher.tsx`. Remove `.demo-scenario` CSS and add:

```css
.waiting-shell {
  align-content: center;
}

.session-waiting {
  display: grid;
  justify-items: center;
  gap: 0.65rem;
  margin: 1rem 0.9rem;
  padding: 2.4rem 1.2rem;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.58);
  color: #cbd5e1;
  text-align: center;
}
```

- [ ] **Step 5: Verify UI behavior and prohibited copy**

Run:

```bash
npm test -- src/components/SessionWaitingView.test.tsx src/app/connectionEvidence.test.ts src/app/liveSessionAuthority.test.ts
npx tsc -b --pretty false
if rg -n 'Demo 场景|刷新 Demo|切换 Demo' src --glob '!*.test.*'; then exit 1; fi
```

Expected: all tests and type checking pass; `rg` returns no production matches.

- [ ] **Step 6: Commit the buildable hook and UI change**

```bash
git add src/App.tsx src/App.css src/app/useCompanionSession.ts src/app/connectionEvidence.ts src/app/connectionEvidence.test.ts src/components/GameShell.tsx src/components/OverlayPanel.tsx src/components/SessionWaitingView.tsx src/components/SessionWaitingView.test.tsx src/components/DemoScenarioSwitcher.tsx
git commit -m "feat: replace Demo scenarios with live session state"
```

---

### Task 4: Full Verification and Windows Artifact Build

**Files:**
- Verify: all files changed in Tasks 1-3
- Verify: `.github/workflows/windows-installer.yml`

**Interfaces:**
- Consumes: the complete live-session implementation.
- Produces: a verified Git commit on `codex/live-client-reliability` and a successful Windows Installer Actions run with installer and portable artifacts.

- [ ] **Step 1: Run the complete local frontend and data verification**

Run:

```bash
npm run data:arena:check
npm run data:game:check
npm test
npm run lint
npm run build
```

Expected: every command exits zero; the test count includes the new session authority and waiting-view tests.

- [ ] **Step 2: Run the complete Rust verification**

Run:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: formatting, compilation, and all Rust tests pass.

- [ ] **Step 3: Inspect the final diff and production copy**

Run:

```bash
git diff --check
git status --short
if rg -n 'Demo 场景|刷新 Demo|切换 Demo' src --glob '!*.test.*'; then exit 1; fi
```

Expected: no whitespace errors, only intentional files are changed, and no prohibited production copy remains.

- [ ] **Step 4: Commit any verification-only corrections**

If verification required a correction, stage only the corrected files and commit:

```bash
git add src/App.tsx src/App.css src/app/liveSessionAuthority.ts src/app/liveSessionAuthority.test.ts src/app/useCompanionSession.ts src/app/connectionEvidence.ts src/app/connectionEvidence.test.ts src/components/GameShell.tsx src/components/OverlayPanel.tsx src/components/SessionWaitingView.tsx src/components/SessionWaitingView.test.tsx src/services/lcuAdapter.ts src/services/lcuAdapter.test.ts src-tauri/src/lcu/client.rs
git commit -m "test: cover live session takeover"
```

If no correction was needed, do not create an empty commit.

- [ ] **Step 5: Push the branch and start the Windows workflow**

Run:

```bash
git push origin codex/live-client-reliability
gh workflow run windows-installer.yml --ref codex/live-client-reliability
```

If the workflow only accepts `main` or a manual dispatch is unavailable, dispatch it through the repository Actions API against the same branch ref. Do not modify `main` merely to trigger a build.

- [ ] **Step 6: Verify the Windows run and artifacts**

Run:

```bash
task_run_id=$(gh run list --workflow windows-installer.yml --branch codex/live-client-reliability --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$task_run_id" --exit-status
gh api "repos/ZOELIU2333/lol-companion-prototype/actions/runs/$task_run_id/artifacts"
```

Expected: the run concludes `success` and exposes non-expired artifacts named `LOL-Companion-Windows-Installer` and `LOL-Companion-Windows-Portable`.
