# Windows Stale Cache Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent obsolete OP.GG browser cache from crashing the Windows first render, and replace any unrelated future render crash with a diagnosable recovery screen.

**Architecture:** Validate untrusted OP.GG data at the storage/runtime boundary before it can enter recommendation construction, deleting invalid persisted values and falling back to the bundled seed. Keep boot diagnostics independent of React, then add a React error boundary whose ready marker is mounted only after the application subtree renders successfully.

**Tech Stack:** TypeScript 5.9, React 19, Vitest 4 with jsdom and Testing Library, Vite 7, Tauri 2/Rust, GitHub Actions Windows 2025.

## Global Constraints

- Invalid OP.GG cache must automatically fall back to bundled data without requiring user cleanup.
- Invalid fresh MCP data must not be registered or persisted.
- Diagnostics must not log local-storage contents, credentials, LCU secrets, or full user paths.
- Frontend error details remain redacted and limited to 500 characters by the Rust command.
- Do not add a validation library or another runtime dependency.
- The latest successful GitHub Actions promotion run must contain `LOL-Companion-Windows-Installer`.

---

## File structure

- Create `src/services/opggChampionDetailValidation.ts`: pure runtime guards for the OP.GG champion-detail contract.
- Modify `src/services/opggChampionData.ts`: enforce the validator for persisted and freshly fetched data; remove invalid persisted entries.
- Create `src/services/opggChampionCache.test.ts`: jsdom storage-boundary regression tests with a fresh module instance per test.
- Create `src/app/DesktopErrorBoundary.tsx`: render recovery UI and report React render failures.
- Create `src/app/DesktopErrorBoundary.test.tsx`: verify visible recovery and diagnostic reporting.
- Modify `src/app/DesktopRoot.tsx`: place the ready marker inside the successful application subtree.
- Modify `index.html`: include line, column, and stack in early module-error diagnostics.
- Modify `scripts/check-desktop-entry.mjs`: assert the production entry retains the enhanced diagnostics.
- Modify `src-tauri/src/lib.rs`: accept `react-render-error` as a known frontend diagnostic stage.

### Task 1: Validate OP.GG cache and runtime data

**Files:**
- Create: `src/services/opggChampionDetailValidation.ts`
- Create: `src/services/opggChampionCache.test.ts`
- Modify: `src/services/opggChampionData.ts`
- Test: `src/services/opggChampionData.test.ts`

**Interfaces:**
- Consumes: `OpggChampionDetail`, `OpggItemSet`, and `OpggRuneSet` from `src/data/opggKrHighEloDetails.ts`.
- Produces: `isOpggChampionDetail(value: unknown): value is OpggChampionDetail` and `registerRuntimeOpggChampionDetail(...): boolean`.

- [ ] **Step 1: Write failing validator and storage-boundary tests**

Create a jsdom test that uses `vi.resetModules()` before dynamic import so the module-level runtime map is empty, then cover valid persistence and obsolete cache eviction:

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { opggKrHighEloChampionDetails } from '../data/opggKrHighEloDetails'

const key = 'lol-companion:opgg-champion-detail:ezreal'
const valid = opggKrHighEloChampionDetails.find((detail) => detail.championKey === 'ezreal')!

describe('OP.GG champion cache boundary', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  it('accepts a complete persisted detail', async () => {
    window.localStorage.setItem(key, JSON.stringify(valid))
    const { getRuntimeOpggChampionDetail } = await import('./opggChampionData')
    expect(getRuntimeOpggChampionDetail('ezreal')).toEqual(valid)
    expect(window.localStorage.getItem(key)).not.toBeNull()
  })

  it.each([
    '{broken json',
    JSON.stringify({ championKey: 'ezreal', data: {} }),
    JSON.stringify({ ...valid, data: { ...valid.data, fourthItems: undefined } }),
    JSON.stringify({ ...valid, data: { ...valid.data, runes: { ...valid.data.runes, primaryRuneIds: undefined } } }),
  ])('evicts invalid persisted data and returns no runtime override', async (raw) => {
    window.localStorage.setItem(key, raw)
    const { getRuntimeOpggChampionDetail } = await import('./opggChampionData')
    expect(getRuntimeOpggChampionDetail('ezreal')).toBeUndefined()
    expect(window.localStorage.getItem(key)).toBeNull()
  })

  it('rejects invalid fresh data without persistence', async () => {
    const { registerRuntimeOpggChampionDetail } = await import('./opggChampionData')
    expect(registerRuntimeOpggChampionDetail({ championKey: 'ezreal', data: {} } as never)).toBe(false)
    expect(window.localStorage.getItem(key)).toBeNull()
  })
})
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm run test -- src/services/opggChampionCache.test.ts`

Expected: FAIL because invalid parsed values are returned and `registerRuntimeOpggChampionDetail` does not return `false`.

- [ ] **Step 3: Implement the pure runtime validator**

Create guards with no coercion. Every array consumed by `.map`, `.slice`, or spread must be present:

```ts
import type { OpggChampionDetail, OpggItemSet, OpggRuneSet } from '../data/opggKrHighEloDetails'

const positions = new Set(['top', 'jungle', 'mid', 'adc', 'support'])
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isString = (value: unknown): value is string => typeof value === 'string'
const isNumberArray = (value: unknown): value is number[] => Array.isArray(value) && value.every(isNumber)
const isNameArray = (value: unknown): value is Array<string | number> =>
  Array.isArray(value) && value.every((entry) => isString(entry) || isNumber(entry))

function isItemSet(value: unknown): value is OpggItemSet {
  return isRecord(value)
    && isNumberArray(value.ids)
    && isNameArray(value.idsNames)
    && value.ids.length === value.idsNames.length
    && ['pickRate', 'play', 'win', 'winRate'].every((key) => isNumber(value[key]))
}

function isRuneSet(value: unknown): value is OpggRuneSet {
  return isRecord(value)
    && ['id', 'pickRate', 'play', 'primaryPageId', 'secondaryPageId', 'win', 'winRate'].every((key) => isNumber(value[key]))
    && isString(value.primaryPageName)
    && isString(value.secondaryPageName)
    && isNumberArray(value.primaryRuneIds)
    && Array.isArray(value.primaryRuneNames) && value.primaryRuneNames.every(isString)
    && isNumberArray(value.secondaryRuneIds)
    && Array.isArray(value.secondaryRuneNames) && value.secondaryRuneNames.every(isString)
    && isNumberArray(value.statModIds)
    && isNumberArray(value.statModNames)
}

const isCounter = (value: unknown) => isRecord(value)
  && isNumber(value.championId) && isString(value.championName)
  && isNumber(value.play) && isNumber(value.win) && isNumber(value.winRate)

export function isOpggChampionDetail(value: unknown): value is OpggChampionDetail {
  if (!isRecord(value) || !isString(value.champion) || !isString(value.championKey)
    || !isString(value.championName) || !isString(value.href)
    || !isString(value.position) || !positions.has(value.position) || !isRecord(value.data)) return false
  const data = value.data
  if (!isItemSet(data.boots) || !isItemSet(data.coreItems) || !isItemSet(data.summonerSpells)
    || !Array.isArray(data.fourthItems) || !data.fourthItems.every(isItemSet)
    || !Array.isArray(data.fifthItems) || !data.fifthItems.every(isItemSet)
    || !isRuneSet(data.runes)
    || !Array.isArray(data.strongCounters) || !data.strongCounters.every(isCounter)
    || !Array.isArray(data.weakCounters) || !data.weakCounters.every(isCounter)
    || !isRecord(data.summary) || !isRecord(data.summary.averageStats)) return false
  const stats = data.summary.averageStats
  return ['banRate', 'kda', 'pickRate', 'play', 'rank', 'tier', 'winRate'].every((key) => isNumber(stats[key]))
    && isRecord(stats.tierData)
    && ['rank', 'rankPrev', 'rankPrevPatch', 'tier'].every((key) => isNumber(stats.tierData[key]))
}
```

- [ ] **Step 4: Enforce validation at both data-entry paths**

In `opggChampionData.ts`, make registration explicit and safe:

```ts
export function registerRuntimeOpggChampionDetail(detail: OpggChampionDetail, label = runtimeLabel) {
  if (!isOpggChampionDetail(detail)) return false
  runtimeDetails.set(detail.championKey, detail)
  runtimeLabels.set(detail.championKey, label)
  persistDetail(detail)
  return true
}

function readPersistedDetail(championKey: string) {
  if (typeof window === 'undefined' || !window.localStorage) return null
  const key = `${storagePrefix}${championKey}`
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (isOpggChampionDetail(parsed) && parsed.championKey === championKey) return parsed
  } catch {
    // Invalid cache is removed below.
  }
  try { window.localStorage.removeItem(key) } catch { /* best effort */ }
  return null
}
```

After `parseAnalysisText`, return `null` when registration rejects the assembled detail:

```ts
if (!registerRuntimeOpggChampionDetail(detail)) return null
return detail
```

- [ ] **Step 5: Run focused and recommendation regression tests**

Run: `npm run test -- src/services/opggChampionCache.test.ts src/services/opggChampionData.test.ts src/data/recommendationData.test.ts src/lib/recommendations.test.ts`

Expected: all selected test files PASS, including cache eviction and bundled fallback behavior.

- [ ] **Step 6: Commit the cache boundary**

```bash
git add src/services/opggChampionDetailValidation.ts src/services/opggChampionData.ts src/services/opggChampionCache.test.ts src/services/opggChampionData.test.ts
git commit -m "fix: reject stale OP.GG champion cache"
```

### Task 2: Add visible React recovery and actionable boot diagnostics

**Files:**
- Create: `src/app/DesktopErrorBoundary.tsx`
- Create: `src/app/DesktopErrorBoundary.test.tsx`
- Modify: `src/app/DesktopRoot.tsx`
- Modify: `index.html`
- Modify: `scripts/check-desktop-entry.mjs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: `window.__LOL_COMPANION_BOOT__.report(stage, detail)`.
- Produces: `DesktopErrorBoundary`, `FrontendReadyMarker`, and the `react-render-error` diagnostics stage.

- [ ] **Step 1: Write the failing error-boundary test**

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DesktopErrorBoundary } from './DesktopErrorBoundary'

afterEach(cleanup)

function BrokenView(): never {
  throw new Error('render exploded')
}

describe('DesktopErrorBoundary', () => {
  it('replaces a render crash with recovery UI and a diagnostic stage', () => {
    const report = vi.fn()
    window.__LOL_COMPANION_BOOT__ = { ready: false, report }
    render(<DesktopErrorBoundary><BrokenView /></DesktopErrorBoundary>)
    expect(screen.getByRole('heading', { name: '界面渲染失败' })).toBeVisible()
    expect(screen.getByText(/重新打开/)).toBeVisible()
    expect(report).toHaveBeenCalledWith('react-render-error', expect.stringContaining('render exploded'))
  })
})
```

- [ ] **Step 2: Run the component test and verify failure**

Run: `npm run test -- src/app/DesktopErrorBoundary.test.tsx`

Expected: FAIL because `DesktopErrorBoundary.tsx` does not exist.

- [ ] **Step 3: Implement the error boundary and success-only ready marker**

Use a class boundary because React render errors cannot be caught by a hook:

```tsx
import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react'

export class DesktopErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    const detail = [error.message, error.stack, info.componentStack].filter(Boolean).join(' | ').slice(0, 500)
    window.__LOL_COMPANION_BOOT__?.report('react-render-error', detail)
  }
  render() {
    if (this.state.error) return (
      <main className="desktop-render-fallback" role="alert">
        <h1>界面渲染失败</h1>
        <p>已阻止黑屏。请关闭后重新打开；如果仍然失败，请发送最新诊断日志。</p>
        <code>%LOCALAPPDATA%\LOL Companion\logs</code>
      </main>
    )
    return this.props.children
  }
}

export function FrontendReadyMarker() {
  useEffect(() => {
    const boot = window.__LOL_COMPANION_BOOT__
    if (boot) { boot.ready = true; boot.report('frontend-ready') }
    const fallback = document.getElementById('boot-fallback')
    if (fallback) fallback.hidden = true
  }, [])
  return null
}
```

Update `DesktopRoot` so the marker is discarded when `App` throws:

```tsx
export function DesktopRoot() {
  return <DesktopErrorBoundary><App /><FrontendReadyMarker /></DesktopErrorBoundary>
}
```

- [ ] **Step 4: Improve pre-React error details and production-entry assertions**

In `index.html`, report location and stack without including application state:

```js
window.addEventListener('error', function (event) {
  var location = [event.filename, event.lineno, event.colno].filter(Boolean).join(':')
  var stack = event.error && event.error.stack ? event.error.stack : ''
  report('module-error', [event.message, location, stack].filter(Boolean).join(' | '))
})
```

In `scripts/check-desktop-entry.mjs`, fail the build unless `event.colno`, `event.error.stack`, and the boot diagnostics are present.

- [ ] **Step 5: Extend the Rust diagnostic stage allowlist**

Add `"react-render-error"` to the existing match in `report_frontend_status`. Keep the current redaction and 500-character truncation unchanged.

- [ ] **Step 6: Run focused frontend and Rust checks**

Run:

```bash
npm run test -- src/app/DesktopErrorBoundary.test.tsx
npm run lint
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: all commands PASS; `dist/index.html` contains relative `./assets/` URLs and enhanced boot diagnostics.

- [ ] **Step 7: Commit rendering recovery**

```bash
git add src/app/DesktopErrorBoundary.tsx src/app/DesktopErrorBoundary.test.tsx src/app/DesktopRoot.tsx index.html scripts/check-desktop-entry.mjs src-tauri/src/lib.rs
git commit -m "fix: show recovery UI for desktop render failures"
```

### Task 3: Full regression verification

**Files:**
- Modify only files required by failures directly caused by Tasks 1-2.
- Test: all frontend and Rust test suites.

**Interfaces:**
- Consumes: the validated cache boundary and render recovery components.
- Produces: a clean, fully verified branch at the final fix commit.

- [ ] **Step 1: Run the complete local verification suite**

```bash
npm run data:arena:check
npm run data:game:check
npm run test
npm run lint
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
git diff --check
```

Expected: all catalog checks, frontend tests, lint, production build, Rust tests/checks, and whitespace validation PASS. Existing Rust dead-code warnings may remain; no new warnings are introduced by this fix.

- [ ] **Step 2: Verify the regression path explicitly**

Run: `npm run test -- src/services/opggChampionCache.test.ts src/app/DesktopErrorBoundary.test.tsx`

Expected: malformed JSON, missing arrays, invalid fresh data, and render exceptions all PASS their recovery assertions.

- [ ] **Step 3: Inspect final scope**

Run: `git status --short && git diff HEAD~2 --stat && git log -4 --oneline`

Expected: no uncommitted files; changes are limited to the approved spec, plan, cache boundary, boot diagnostics, error boundary, and their tests.

### Task 4: Publish and verify the Windows installer

**Files:**
- No source edits expected.
- Workflow: `.github/workflows/windows-installer.yml` (execute only).

**Interfaces:**
- Consumes: a locally verified `codex/arena-rebuild` branch.
- Produces: a successful full Windows run, a successful promotion run, and downloadable installer artifact.

- [ ] **Step 1: Commit the implementation plan if it is not already committed**

```bash
git add docs/superpowers/plans/2026-08-06-windows-stale-cache-recovery.md
git commit -m "docs: plan Windows stale cache recovery"
```

- [ ] **Step 2: Push the branch**

Run: `git -c http.version=HTTP/1.1 push origin codex/arena-rebuild`

Expected: remote branch advances to the final local commit.

- [ ] **Step 3: Dispatch and watch a full Windows build**

```bash
gh workflow run "Windows Installer" --repo ZOELIU2333/lol-companion-prototype --ref codex/arena-rebuild
windows_full_run_id=$(gh run list --repo ZOELIU2333/lol-companion-prototype --workflow "Windows Installer" --branch codex/arena-rebuild --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$windows_full_run_id" --repo ZOELIU2333/lol-companion-prototype --exit-status --interval 10
```

Expected: `Verify and build Windows x64` succeeds, including data checks, frontend tests, Rust checks, portable startup, NSIS packaging, and artifact uploads.

- [ ] **Step 4: Verify full-run artifacts**

Run: `gh api "repos/ZOELIU2333/lol-companion-prototype/actions/runs/$windows_full_run_id/artifacts" --jq '.artifacts[] | [.name,.size_in_bytes,.expired] | @tsv'`

Expected: non-expired, non-empty `LOL-Companion-Windows-Installer` and `LOL-Companion-Windows-Portable` artifacts.

- [ ] **Step 5: Promote the verified installer to the latest Actions run and prerelease**

```bash
gh workflow run "Windows Installer" --repo ZOELIU2333/lol-companion-prototype --ref codex/arena-rebuild -f promote_run_id="$windows_full_run_id"
windows_promotion_run_id=$(gh run list --repo ZOELIU2333/lol-companion-prototype --workflow "Windows Installer" --branch codex/arena-rebuild --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$windows_promotion_run_id" --repo ZOELIU2333/lol-companion-prototype --exit-status --interval 5
```

Expected: `Publish direct-download prerelease` succeeds.

- [ ] **Step 6: Verify the final download surface**

Run: `gh api "repos/ZOELIU2333/lol-companion-prototype/actions/runs/$windows_promotion_run_id/artifacts" --jq '.artifacts[] | [.name,.size_in_bytes,.expired] | @tsv'`

Expected: the latest run contains a non-expired `LOL-Companion-Windows-Installer`; provide that exact Actions run URL to the user for Windows acceptance testing.
