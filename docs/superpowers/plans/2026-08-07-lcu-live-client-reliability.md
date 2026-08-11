# LCU and Live Client Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Windows client accept the observed WeGame lockfile, keep Live Client readings stable across transient failures, and leave Demo mode whenever real LCU or Live Client evidence exists.

**Architecture:** Rust remains the credential and localhost boundary. It normalizes and validates lockfiles, reuses one Live Client HTTP client, classifies failures, and returns a `fresh`/`reconnecting`/`unavailable` reading. TypeScript normalizes that result and derives the UI state from independent LCU and Live Client evidence.

**Tech Stack:** Rust 2021, Tauri 2, reqwest 0.12/rustls, serde, React 19, TypeScript 5.9, Vitest 4, GitHub Actions Windows x64, NSIS.

## Global Constraints

- Never log or export the lockfile password, raw lockfile, Authorization header, or Live Client response body.
- Do not use `wmic`, PowerShell, `reg.exe`, or any discovery command that opens a console window.
- One failing source must not erase valid evidence from the other.
- A reconnecting snapshot is stale, carries an age, and expires after 10 seconds.
- Preserve Windows 10/11 x64, Tauri 2, Node 22.22.2+, and existing artifact names.

---

### Task 1: Compatible and diagnosable Rust lockfile parsing

**Files:**
- Modify: `src-tauri/src/lcu/lockfile.rs`
- Modify: `src-tauri/src/lcu/discovery.rs`
- Modify: `src-tauri/src/lcu/discovery/telemetry.rs`
- Modify: `src-tauri/src/lcu/discovery/config.rs`
- Modify: `src-tauri/src/diagnostics/health.rs`

**Interfaces:**
- Produces: `parse(raw: &str) -> Result<LcuLockfile, LockfileParseError>` with safe, copyable error categories.
- Produces: `CandidateProbe.parse_error: Option<LockfileParseError>`.
- Consumes: existing `LcuLockfile` accessors in `lcu/client.rs`.

- [ ] **Step 1: Write failing compatibility tests**

Add to `lockfile.rs` tests:

```rust
#[test]
fn parses_bom_nul_and_colons_inside_password() {
    let parsed = parse("\u{feff}LeagueClient:1234:54321:token:with:colon:https\0\r\n").unwrap();
    assert_eq!(parsed.pid(), 1234);
    assert_eq!(parsed.port(), 54321);
    assert_eq!(parsed.password(), "token:with:colon");
    assert_eq!(parsed.protocol(), "https");
}

#[test]
fn rejects_invalid_structure_by_safe_category() {
    assert!(matches!(parse("LeagueClient:0:54321:secret:https"), Err(LockfileParseError::InvalidPid)));
    assert!(matches!(parse("LeagueClient:1:0:secret:https"), Err(LockfileParseError::InvalidPort)));
    assert!(matches!(parse("LeagueClient:1:54321::https"), Err(LockfileParseError::EmptyPassword)));
    assert!(matches!(parse("LeagueClient:1:54321:secret:ftp"), Err(LockfileParseError::InvalidProtocol)));
}
```

Add a discovery test asserting an invalid candidate has `InvalidFormat` plus its safe parse category.

- [ ] **Step 2: Verify the tests fail**

Run: `cargo test --manifest-path src-tauri/Cargo.toml lcu::lockfile lcu::discovery`

Expected: FAIL because tolerant parsing, PID access, and `parse_error` do not exist.

- [ ] **Step 3: Implement normalization and outside-in parsing**

Use this structure:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum LockfileParseError {
    FieldCount, InvalidPid, InvalidPort, EmptyPassword, InvalidProtocol,
}

pub(crate) fn parse(raw: &str) -> Result<LcuLockfile, LockfileParseError> {
    let normalized = raw
        .trim_start_matches('\u{feff}')
        .trim_end_matches(|character| matches!(character, '\0' | '\r' | '\n'));
    let parts = normalized.split(':').collect::<Vec<_>>();
    if parts.len() < 5 { return Err(LockfileParseError::FieldCount); }
    let pid = parts[1].parse::<u32>().ok().filter(|v| *v > 0).ok_or(LockfileParseError::InvalidPid)?;
    let port = parts[2].parse::<u16>().ok().filter(|v| *v > 0).ok_or(LockfileParseError::InvalidPort)?;
    let protocol = parts.last().copied().unwrap_or_default().to_ascii_lowercase();
    if !matches!(protocol.as_str(), "http" | "https") { return Err(LockfileParseError::InvalidProtocol); }
    let password = parts[3..parts.len() - 1].join(":");
    if password.is_empty() { return Err(LockfileParseError::EmptyPassword); }
    Ok(LcuLockfile { pid, port, password, protocol })
}
```

Keep custom Debug output redacted.

- [ ] **Step 4: Carry only the safe category through discovery**

Change `probe_path` to return `(ProbeStatus, Option<LockfileParseError>)`, store it on `CandidateProbe`, and include only category names such as `InvalidFormat(InvalidProtocol)` in deduplicated telemetry. Map manual-selection failures to category-specific Chinese messages without field values.

- [ ] **Step 5: Run tests and commit**

```bash
cargo test --manifest-path src-tauri/Cargo.toml lcu::
cargo test --manifest-path src-tauri/Cargo.toml diagnostics::
git add src-tauri/src/lcu src-tauri/src/diagnostics/health.rs
git commit -m "fix: accept compatible League lockfiles"
```

Expected: PASS and no output contains fixture passwords.

---

### Task 2: Stateful Live Client reader with retry and expiry

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/live_client.rs`
- Modify: `src-tauri/src/diagnostics/health.rs`

**Interfaces:**
- Produces: `LiveClientReadingPayload { state, snapshot, age_seconds, failure_kind }`.
- Produces: `LiveClientReadingState::{Fresh, Reconnecting, Unavailable}`.
- Produces: `LiveClientFailureKind::{Connection, Timeout, Tls, Http, Json, Payload, Client}`.

- [ ] **Step 1: Write failing tracker tests**

```rust
#[test]
fn transient_failure_reconnects_then_expires() {
    let mut tracker = LiveClientTracker::default();
    tracker.record_success(fixture_snapshot(), 100);
    let reconnecting = tracker.record_failure(LiveClientFailureKind::Timeout, 106);
    assert_eq!(reconnecting.state, LiveClientReadingState::Reconnecting);
    assert_eq!(reconnecting.age_seconds, Some(6));
    assert!(reconnecting.snapshot.is_some());
    let unavailable = tracker.record_failure(LiveClientFailureKind::Timeout, 111);
    assert_eq!(unavailable.state, LiveClientReadingState::Unavailable);
    assert!(unavailable.snapshot.is_none());
}
```

Also test that success after a failure returns `Fresh` and age zero.

- [ ] **Step 2: Verify the focused test fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml live_client`

Expected: FAIL because reading types and tracker do not exist.

- [ ] **Step 3: Implement serialized reading types and tracker**

```rust
const LIVE_CLIENT_STALE_AFTER_SECONDS: u64 = 10;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum LiveClientReadingState { Fresh, Reconnecting, Unavailable }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum LiveClientFailureKind { Connection, Timeout, Tls, Http, Json, Payload, Client }

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveClientReadingPayload {
    pub state: LiveClientReadingState,
    pub snapshot: Option<LiveClientSnapshotPayload>,
    pub age_seconds: Option<u64>,
    pub failure_kind: Option<LiveClientFailureKind>,
}
```

Make snapshots cloneable. `record_failure` includes the cached snapshot only while age is `<= 10`.

- [ ] **Step 4: Reuse one HTTP client and classify failures**

Add `"time"` to the existing Tokio feature list in `src-tauri/Cargo.toml`. Use `OnceLock<Result<reqwest::Client, String>>` with a 2.5-second timeout and `danger_accept_invalid_certs(true)`. Add `read_once()` that calls `error_for_status`, then JSON and payload parsing. Classify errors without storing response bodies.

- [ ] **Step 5: Retry once and log only state transitions**

```rust
let result = match read_once().await {
    Ok(snapshot) => Ok(snapshot),
    Err(first) => {
        tokio::time::sleep(Duration::from_millis(150)).await;
        read_once().await.map_err(|second| if second == first { first } else { second })
    }
};
```

Store state in `OnceLock<Mutex<LiveClientTracker>>`. Log only changes in `(state, failure_kind)` with age and optional HTTP status, never URL query strings or payloads.

- [ ] **Step 6: Update health and run tests**

Map `Fresh` to ready, `Reconnecting` to stale with age, and `Unavailable` to unavailable. Then run:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml live_client
cargo test --manifest-path src-tauri/Cargo.toml diagnostics::health
```

- [ ] **Step 7: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/live_client.rs src-tauri/src/diagnostics/health.rs
git commit -m "fix: stabilize Live Client polling"
```

---

### Task 3: Normalize Live Client readings in TypeScript

**Files:**
- Modify: `src/services/liveClientData.ts`
- Modify: `src/services/liveClientData.test.ts`

**Interfaces:**
- Produces: `LiveClientReading` and `LiveClientConnectionState`.
- Changes: `LiveClientDataHost.readSnapshot()` to `LiveClientDataHost.read()`.

- [ ] **Step 1: Write failing bridge tests**

Mock a Rust result and expect normalized output:

```ts
tauriMocks.invoke.mockResolvedValue({
  state: 'fresh',
  snapshot: { gameTime: 914.2, gameMode: 'CLASSIC', championName: 'Ezreal', level: 9,
    currentGold: 1475, currentItemIds: [3004, 3078, 0], source: 'live-client-data' },
  ageSeconds: 0,
  failureKind: null,
})
await expect(host?.read()).resolves.toMatchObject({
  state: 'fresh', snapshot: { currentItemIds: [3004, 3078] },
})
```

Add reconnecting and malformed-fresh-result cases.

- [ ] **Step 2: Verify the test fails**

Run: `npm test -- src/services/liveClientData.test.ts`

Expected: FAIL because `read` and `normalizeLiveClientReading` do not exist.

- [ ] **Step 3: Implement the contract**

```ts
export type LiveClientConnectionState = 'fresh' | 'reconnecting' | 'unavailable'
export type LiveClientFailureKind = 'connection' | 'timeout' | 'tls' | 'http' | 'json' | 'payload' | 'client'
export type LiveClientReading = {
  state: LiveClientConnectionState
  snapshot: LiveClientSnapshot | null
  ageSeconds: number | null
  failureKind: LiveClientFailureKind | null
}
export type LiveClientDataHost = { read: (signal?: AbortSignal) => Promise<LiveClientReading> }
```

Export `normalizeLiveClientReading`. A fresh result without a valid snapshot becomes unavailable/payload. Unknown states become unavailable.

- [ ] **Step 4: Preserve stale observations in the Arena port**

Call `host.read(signal)`. Use Arena observation state `live` for fresh and `stale` for reconnecting. Return unavailable capabilities when no snapshot exists.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- src/services/liveClientData.test.ts
git add src/services/liveClientData.ts src/services/liveClientData.test.ts
git commit -m "feat: expose Live Client connection readings"
```

---

### Task 4: Derive UI status from independent connection evidence

**Files:**
- Create: `src/app/connectionEvidence.ts`
- Create: `src/app/connectionEvidence.test.ts`
- Modify: `src/app/useCompanionSession.ts`

**Interfaces:**
- Produces: `deriveConnectionPresentation(input): ConnectionPresentation`.
- Consumes: LCU readiness/phase and `LiveClientReading`.

- [ ] **Step 1: Write the truth-table tests**

```ts
expect(deriveConnectionPresentation({ lcuState: 'ready', lcuPhase: 'Lobby', live: unavailable }))
  .toEqual({ status: 'client', label: '已连接客户端', isDetected: true })
expect(deriveConnectionPresentation({ lcuState: 'unavailable', lcuPhase: null, live: fresh }))
  .toEqual({ status: 'match', label: '实时对局 · LCU 待恢复', isDetected: true })
expect(deriveConnectionPresentation({ lcuState: 'unavailable', lcuPhase: null, live: reconnecting }))
  .toEqual({ status: 'reconnecting', label: '实时数据重连中 · 6 秒前', isDetected: true })
expect(deriveConnectionPresentation({ lcuState: 'unavailable', lcuPhase: null, live: unavailable }))
  .toEqual({ status: 'demo', label: 'Demo 模式 · 未连接客户端', isDetected: false })
```

- [ ] **Step 2: Verify the new test fails**

Run: `npm test -- src/app/connectionEvidence.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure reducer**

```ts
export type ConnectionStatus = 'detecting' | 'demo' | 'client' | 'match' | 'reconnecting'
export type ConnectionPresentation = { status: ConnectionStatus; label: string; isDetected: boolean }
export function deriveConnectionPresentation(input: {
  lcuState: 'detecting' | 'ready' | 'unavailable'
  lcuPhase: LcuGamePhase | null
  live: LiveClientReading
}): ConnectionPresentation
```

Priority: fresh Live, reconnecting Live, ready LCU, detecting, Demo. LCU phases `ChampSelect`, `GameStart`, `InProgress`, `WaitingForStats`, and `EndOfGame` are match evidence.

- [ ] **Step 4: Integrate one source of truth in the hook**

In `useCompanionSession.ts`, store LCU evidence and one `LiveClientReading`. Derive the presentation with `useMemo`. LCU polling updates only LCU evidence; Live polling updates only Live evidence. Use `liveReading.snapshot` for match projection. If LCU is absent and Live is fresh, derive mode from `/arena|cherry/i` and map `championName`; do not label untouched Demo roster fields as live.

Return:

```ts
connectionStatus: connectionPresentation.status,
connectionStatusLabel: connectionPresentation.label,
isDetected: connectionPresentation.isDetected,
```

- [ ] **Step 5: Run affected tests and commit**

```bash
npm test -- src/app/connectionEvidence.test.ts src/services/liveClientData.test.ts src/features/arena/session
git add src/app/connectionEvidence.ts src/app/connectionEvidence.test.ts src/app/useCompanionSession.ts
git commit -m "fix: derive real connection state from live evidence"
```

---

### Task 5: Diagnostics copy and Windows acceptance

**Files:**
- Modify: `src/features/arena/ui/DiagnosticsPanel.tsx`
- Modify: `src/features/arena/ui/DiagnosticsPanel.test.tsx`
- Modify: `docs/windows-troubleshooting.md`
- Modify: `docs/windows-acceptance.md`

**Interfaces:**
- Consumes: `live-client-reconnecting`, safe LCU parse categories, and age seconds.

- [ ] **Step 1: Write failing UI tests**

Assert `Live Client 正在重连`, `6 秒前`, and the safe `lockfile 无法解析` detail render; assert no fixture password is present in `document.body.textContent`.

- [ ] **Step 2: Verify failure**

Run: `npm test -- src/features/arena/ui/DiagnosticsPanel.test.tsx`

- [ ] **Step 3: Implement explicit recovery copy**

For stale health show `Live Client 正在重连，最近数据为 N 秒前`. Keep both League directory and lockfile selection actions and show the backend-safe parse detail.

- [ ] **Step 4: Document exact acceptance checks**

Add:

```markdown
- [ ] WeGame lockfile containing BOM/NUL or a token separator validates without exposing credentials.
- [ ] One forced 2999 timeout shows reconnecting and retains a stale snapshot with age.
- [ ] More than 10 seconds without a successful 2999 read clears the snapshot.
- [ ] Live fresh plus LCU unavailable displays “实时对局 · LCU 待恢复”, never Demo.
```

Explain safe failure categories and the reconnect window in troubleshooting.

- [ ] **Step 5: Test and commit**

```bash
npm test -- src/features/arena/ui/DiagnosticsPanel.test.tsx
git add src/features/arena/ui/DiagnosticsPanel.tsx src/features/arena/ui/DiagnosticsPanel.test.tsx docs/windows-acceptance.md docs/windows-troubleshooting.md
git commit -m "docs: explain client reconnection recovery"
```

---

### Task 6: Full gates and Windows publication

**Files:**
- Verify: all files changed in Tasks 1-5.
- Modify on failure only: the smallest owning file plus a focused regression test.

**Interfaces:**
- Produces: successful `LOL-Companion-Windows-Installer` and `LOL-Companion-Windows-Portable` artifacts.

- [ ] **Step 1: Run frontend gates**

```bash
npm run data:arena:check
npm run data:game:check
npm test
npm run lint
npm run build
```

Expected: all checks pass and desktop assets remain relative.

- [ ] **Step 2: Run Rust gates**

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: all tests and checks pass; no new credential-bearing warnings.

- [ ] **Step 3: Confirm clean history**

```bash
git status --short
git diff --check
git log --oneline -8
```

Expected: clean worktree and separate focused commits.

- [ ] **Step 4: Push without rewriting prior web commits**

If `codex/arena-rebuild` cannot fast-forward, create and push `codex/live-client-reliability`. Never force-push.

- [ ] **Step 5: Run Windows Installer and verify artifacts**

Dispatch `.github/workflows/windows-installer.yml` on the pushed branch with an empty promotion input. Monitor the run to completion. Verify its head SHA and both non-expired artifact names, then provide the exact Actions URL for Windows acceptance.
