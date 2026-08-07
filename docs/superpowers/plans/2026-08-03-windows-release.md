# Windows Diagnostics and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Arena companion diagnosable on Windows and produce honest NSIS and portable artifacts through strict CI.

**Architecture:** Rust initializes redacted rotating logs before Tauri and exposes a typed health snapshot plus diagnostic export. GitHub Actions separates validation, scheduled catalog checks, and Windows artifact builds; required failures are never suppressed.

**Tech Stack:** Rust 2021, Tauri 2, tracing, zip, React 19, GitHub Actions, Node.js 20.19.0, npm 10, stable Rust, NSIS.

## Global Constraints

- Target Windows 10 and 11 x64.
- NSIS is primary; portable executable is the diagnostic fallback.
- End users do not install Node.js or Rust.
- Logs redact LCU passwords, Riot API keys, authorization headers, and account secrets.
- Tests, lint, catalog validation, Rust checks, portable build, and NSIS build must fail CI when broken.

---

### Task 1: Add redacted desktop diagnostics

**Files:**
- Create: `src-tauri/src/diagnostics/mod.rs`
- Create: `src-tauri/src/diagnostics/redact.rs`
- Create: `src-tauri/src/diagnostics/export.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`

**Interfaces:**
- Produces: `init(app_log_dir: &Path) -> Result<WorkerGuard, DiagnosticError>`.
- Produces: `redact(message: &str) -> String`.
- Produces command: `export_diagnostics() -> Result<String, String>`.

- [ ] **Step 1: Write failing Rust redaction tests.**

```rust
#[test]
fn removes_local_and_remote_credentials() {
    let raw = "riot:secret X-Riot-Token: RGAPI-secret Authorization: Basic abc";
    let safe = redact(raw);
    assert!(!safe.contains("RGAPI-secret"));
    assert!(!safe.contains("Basic abc"));
    assert!(safe.contains("[REDACTED]"));
}
```

Also test ordinary status preservation, lockfile lines, JSON key variants, and ZIP export containing only approved log/manifest files.

- [ ] **Step 2: Run tests and verify failure.**

Run: `cargo test --manifest-path src-tauri/Cargo.toml diagnostics`

- [ ] **Step 3: Add dependencies and implement daily rolling logs.**

Add `tracing`, `tracing-subscriber`, `tracing-appender`, `thiserror`, and `zip`. Initialize before `lol_companion_lib::run()`, install a panic hook, and retain seven daily files.

- [ ] **Step 4: Implement diagnostic export and user-readable startup failure.**

Export redacted logs plus application/catalog versions. A logging/Tauri startup failure must display a native message containing the log directory or recovery instruction despite the hidden Windows console.

- [ ] **Step 5: Run Rust verification.**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`  
Run: `cargo check --manifest-path src-tauri/Cargo.toml`

- [ ] **Step 6: Commit.**

```bash
git add src-tauri/src src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat: add redacted Windows diagnostics"
```

### Task 2: Expose typed health and recovery UI

**Files:**
- Create: `src-tauri/src/diagnostics/health.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/services/tauriHost.ts`
- Test: `src/services/tauriHost.test.ts`
- Create: `src/features/arena/ui/DiagnosticsPanel.tsx`
- Test: `src/features/arena/ui/DiagnosticsPanel.test.tsx`
- Modify: `src/features/arena/ui/ArenaExpandedView.tsx`

**Interfaces:**
- Produces command: `get_desktop_health() -> DesktopHealthSnapshot`.
- Produces TS: `readDesktopHealth(): Promise<DesktopHealthSnapshot | null>`.
- Produces statuses for shell, WebView2, League discovery, LCU, Live Client, augment capability, catalog, runtime cache, and logs.

- [ ] **Step 1: Write failing host and UI tests.**

```tsx
it('offers manual Arena mode when League is not found', () => {
  render(<DiagnosticsPanel health={leagueMissingFixture} />)
  expect(screen.getByText('未找到 League，仍可使用手动 Arena 模式')).toBeVisible()
})
```

Also test stale Live Client snapshot age, unsupported augment endpoint, corrupt runtime cache fallback, missing WebView2 guidance, and export success/failure.

- [ ] **Step 2: Run tests and verify failure.**

Run: `npm run test -- src/services/tauriHost.test.ts src/features/arena/ui/DiagnosticsPanel.test.tsx`

- [ ] **Step 3: Implement Rust health snapshot and TypeScript bridge.**

The snapshot contains status codes, safe paths, ages, versions, and recovery codes; it excludes credentials, raw headers, and raw lockfile content.

- [ ] **Step 4: Implement expanded diagnostic panel.**

Every non-ready state shows one primary recovery action: retry, switch to manual, discard invalid cache, open WebView2 installer guidance, open log directory, or export diagnostics.

- [ ] **Step 5: Run frontend and Rust verification.**

Run: `npm run test`  
Run: `npm run lint`  
Run: `npm run build`  
Run: `cargo check --manifest-path src-tauri/Cargo.toml`

- [ ] **Step 6: Commit.**

```bash
git add src-tauri/src src/services/tauriHost.ts src/services/tauriHost.test.ts src/features/arena/ui
git commit -m "feat: add actionable desktop health UI"
```

### Task 3: Create strict validation and scheduled catalog workflows

**Files:**
- Create: `.github/workflows/validate.yml`
- Create: `.github/workflows/arena-data.yml`
- Modify: `package.json`

**Interfaces:**
- Produces npm command: `npm run verify`.
- Produces daily catalog validation with a normalized diff artifact when upstream changes.

- [ ] **Step 1: Add a strict verify script.**

```json
"verify": "npm run data:arena:check && npm run test && npm run lint && npm run build && cargo check --manifest-path src-tauri/Cargo.toml"
```

- [ ] **Step 2: Add `validate.yml`.**

Use Node `20.19.0`, npm `10`, stable Rust, `npm ci`, and `npm run verify`. Do not use `continue-on-error`.

- [ ] **Step 3: Add daily `arena-data.yml`.**

Fetch both locales, validate, compare normalized content, and upload catalog/manifest diff when changed. Invalid upstream payload fails the job; unchanged data succeeds without writing to the repository.

- [ ] **Step 4: Run all locally available commands.**

Run: `npm run data:arena:check`  
Run: `npm run test`  
Run: `npm run lint`  
Run: `npm run build`

- [ ] **Step 5: Commit.**

```bash
git add .github/workflows/validate.yml .github/workflows/arena-data.yml package.json package-lock.json
git commit -m "ci: add strict validation and Arena data checks"
```

### Task 4: Rebuild Windows artifacts and acceptance documentation

**Files:**
- Modify: `.github/workflows/windows-installer.yml`
- Modify: `src-tauri/tauri.windows.conf.json`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `README.md`
- Create: `docs/windows-troubleshooting.md`
- Create: `docs/windows-acceptance.md`

**Interfaces:**
- Produces artifacts `LOL-Companion-Windows-Installer`, `LOL-Companion-Windows-Portable`, and failure-only `LOL-Companion-Windows-Diagnostics`.

- [ ] **Step 1: Replace the forced-success workflow.**

Build frontend, run Cargo checks/tests, build portable release, build NSIS, assert output existence, calculate SHA-256, and smoke-start the portable executable. Remove test `continue-on-error`, NSIS `exit 0`, and unconditional artifact uploads.

- [ ] **Step 2: Add a PID-scoped PowerShell smoke test.**

Start only the built executable, wait up to 20 seconds for a live process/window or ready log marker, collect logs on failure, and stop only the returned process ID.

- [ ] **Step 3: Configure Windows bundle metadata.**

Use x64 targets, NSIS primary bundle, WebView2 bootstrap behavior, current icons, catalog resource inclusion, and version consistency between package and Tauri configuration.

- [ ] **Step 4: Write troubleshooting and acceptance docs.**

Acceptance covers offline start, non-default League path, automatic champion/items/time, manual three-icon augment input, three distinct routes, affordable purchase advice, stale/cache/icon failure, diagnostic export, portable smoke, and NSIS install/uninstall.

- [ ] **Step 5: Verify no hidden success paths remain.**

Run: `rg -n "continue-on-error|exit 0|if: always" .github/workflows/windows-installer.yml`  
Expected: no matches. Failure-only diagnostics use `if: failure()`.

- [ ] **Step 6: Run local verification.**

Run: `npm run verify`  
Run: `git diff --check`

- [ ] **Step 7: Commit.**

```bash
git add .github/workflows/windows-installer.yml src-tauri/tauri.windows.conf.json src-tauri/tauri.conf.json README.md docs/windows-troubleshooting.md docs/windows-acceptance.md
git commit -m "ci: produce verified Windows artifacts"
```
