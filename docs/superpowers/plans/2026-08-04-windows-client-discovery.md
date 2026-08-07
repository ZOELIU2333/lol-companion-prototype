# Windows Client Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace visible `wmic`/`reg.exe` polling with silent native Windows discovery, add a persisted manual League path fallback, and make exported diagnostics explain discovery and LCU failures without exposing credentials.

**Architecture:** Keep `lcu/discovery.rs` as the orchestration boundary, extract lockfile parsing and Windows API access into focused modules, and return a structured `DiscoveryReport` that health checks and telemetry can consume. A native backend file picker persists a validated path under the existing application data root; the React diagnostics panel invokes it and displays actionable/exportable results.

**Tech Stack:** Rust 2021, `windows-sys` 0.61, `rfd` 0.15 (Windows target only), Tauri 2 commands, tracing, serde/serde_json, React 19, TypeScript, Vitest/Testing Library, GitHub Actions Windows 2025.

## Global Constraints

- Client discovery must not launch a visible Terminal/Console window.
- Do not recursively scan whole disks; inspect only saved, environment, process, registry, and bounded common-path candidates.
- Never log or return raw lockfile contents, LCU passwords, Authorization headers, Riot tokens, or response bodies.
- Live Client port 2999 remains independent from LCU discovery and is expected to be unavailable outside an active match.
- OP.GG MCP availability is not a prerequisite for LCU readiness.
- Automatic discovery failure must not prevent offline/manual Arena use.
- Windows 10 and Windows 11 are supported; no administrator privileges may be required.

## File Structure

- Create `src-tauri/src/lcu/lockfile.rs`: shared five-field lockfile parser and validation.
- Create `src-tauri/src/lcu/discovery/windows.rs`: native process and registry discovery; no subprocesses.
- Create `src-tauri/src/lcu/discovery/config.rs`: persisted user-selected path loading, validation, and storage.
- Create `src-tauri/src/lcu/discovery/telemetry.rs`: redacted, state-change-only discovery logging.
- Modify `src-tauri/src/lcu/discovery.rs`: source ordering, candidate probing, report generation, compatibility helpers.
- Modify `src-tauri/src/lcu/client.rs`: consume shared lockfile parser and log LCU outcome categories.
- Modify `src-tauri/src/lcu/mod.rs`: register focused submodules.
- Modify `src-tauri/src/diagnostics/health.rs`: derive missing/degraded/ready states from `DiscoveryReport`.
- Modify `src-tauri/src/lib.rs`: expose the native path-selection command.
- Modify `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock`: Windows API features and Windows-only native dialog dependency.
- Modify `src/services/tauriHost.ts` and `src/services/tauriHost.test.ts`: typed path-selection bridge and recovery code.
- Modify `src/features/arena/ui/DiagnosticsPanel.tsx` and its test: select path, copy/export location, actionable feedback.
- Modify `src/app/useCompanionSession.ts`, `src/App.tsx`, `src/components/OverlayPanel.tsx`, `src/features/arena/ui/ArenaDecisionView.tsx`, and `src/features/arena/ui/ArenaExpandedView.tsx`: connect the recovery action and make diagnostics available outside an active Arena route.
- Modify `.github/workflows/validate.yml`, `.github/workflows/windows-installer.yml`, `docs/windows-troubleshooting.md`, and `docs/windows-acceptance.md`: regression guards and Windows acceptance instructions.

---

### Task 1: Shared Lockfile Parser and Structured Discovery Report

**Files:**
- Create: `src-tauri/src/lcu/lockfile.rs`
- Modify: `src-tauri/src/lcu/mod.rs`
- Modify: `src-tauri/src/lcu/client.rs`
- Modify: `src-tauri/src/lcu/discovery.rs`
- Test: inline `#[cfg(test)]` modules in the files above

**Interfaces:**
- Produces: `lockfile::parse(raw: &str) -> Result<LcuLockfile, LockfileParseError>`.
- Produces: `discovery::discover_lockfile() -> DiscoveryReport` and compatibility helpers `find_lockfile_path()` / `read_lockfile_contents()`.
- Consumes: existing `DiscoveryEnvironment` candidate sources.

- [ ] **Step 1: Write failing parser and report tests**

Add tests that require strict format validation without including secrets in errors:

```rust
#[test]
fn parses_valid_lockfile_without_exposing_password_in_debug() {
    let parsed = parse("LeagueClient:1234:54321:super-secret:https").unwrap();
    assert_eq!(parsed.port(), 54321);
    assert_eq!(parsed.protocol(), "https");
    assert!(!format!("{parsed:?}").contains("super-secret"));
}

#[test]
fn report_distinguishes_missing_invalid_and_selected_candidates() {
    let report = probe_candidates(vec![
        candidate(DiscoverySource::Saved, "missing", ProbeStatus::Missing),
        candidate(DiscoverySource::Process, "invalid", ProbeStatus::InvalidFormat),
        candidate(DiscoverySource::Common, "valid", ProbeStatus::Valid),
    ]);
    assert_eq!(report.selected_source, Some(DiscoverySource::Common));
    assert_eq!(report.probes.len(), 3);
}
```

- [ ] **Step 2: Run focused Rust tests and verify failure**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml lockfile
cargo test --manifest-path src-tauri/Cargo.toml discovery
```

Expected: FAIL because `lockfile::parse`, `DiscoveryReport`, and `ProbeStatus` do not exist.

- [ ] **Step 3: Implement the shared parser**

Create `lockfile.rs` with credential-redacted debug output:

```rust
pub(crate) struct LcuLockfile {
    port: u16,
    password: String,
    protocol: String,
}

impl std::fmt::Debug for LcuLockfile {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.debug_struct("LcuLockfile")
            .field("port", &self.port)
            .field("password", &"[REDACTED]")
            .field("protocol", &self.protocol)
            .finish()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum LockfileParseError { FieldCount, InvalidPort, EmptyPassword, InvalidProtocol }

pub(crate) fn parse(raw: &str) -> Result<LcuLockfile, LockfileParseError> {
    let parts = raw.trim().split(':').collect::<Vec<_>>();
    if parts.len() != 5 { return Err(LockfileParseError::FieldCount); }
    let port = parts[2].parse().map_err(|_| LockfileParseError::InvalidPort)?;
    if parts[3].is_empty() { return Err(LockfileParseError::EmptyPassword); }
    if !matches!(parts[4], "http" | "https") { return Err(LockfileParseError::InvalidProtocol); }
    Ok(LcuLockfile { port, password: parts[3].to_owned(), protocol: parts[4].to_owned() })
}
```

Expose credential accessors as `pub(crate)` only, register `mod lockfile;`, and delete the duplicate private parser in `client.rs`.

- [ ] **Step 4: Implement report-based candidate probing**

Add these public discovery types and keep raw file contents private:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiscoverySource { Saved, Environment, Process, Registry, Common }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProbeStatus { Missing, NotFile, Unreadable, InvalidFormat, Valid }

#[derive(Debug, Clone)]
pub struct CandidateProbe { pub source: DiscoverySource, pub path: PathBuf, pub status: ProbeStatus }

#[derive(Debug, Clone)]
pub struct DiscoveryReport {
    pub correlation_id: u128,
    pub selected_path: Option<PathBuf>,
    pub selected_source: Option<DiscoverySource>,
    pub probes: Vec<CandidateProbe>,
}
```

`discover_lockfile()` must stop after the first valid candidate while preserving probes already attempted. `find_lockfile_path()` returns `discover_lockfile().selected_path`; `read_lockfile_contents()` reads that selected file without logging its content.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml lockfile
cargo test --manifest-path src-tauri/Cargo.toml discovery
```

Expected: PASS.

Commit:

```bash
git add src-tauri/src/lcu
git commit -m "refactor: model LCU discovery outcomes"
```

---

### Task 2: Native Windows Process and Registry Discovery

**Files:**
- Create: `src-tauri/src/lcu/discovery/windows.rs`
- Modify: `src-tauri/src/lcu/discovery.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Test: inline tests in `src-tauri/src/lcu/discovery/windows.rs` and `discovery.rs`

**Interfaces:**
- Produces: `windows::process_install_roots() -> Vec<PathBuf>`.
- Produces: `windows::registry_install_roots() -> Vec<PathBuf>`.
- Consumes: `DiscoveryEnvironment` process/registry candidate lists.

- [ ] **Step 1: Write source-order and no-subprocess regression tests**

Extend discovery tests to assert process roots precede registry/common roots. Add a source guard test that reads `windows.rs` with `include_str!`:

```rust
#[test]
fn native_windows_discovery_does_not_spawn_console_commands() {
    let source = include_str!("discovery/windows.rs");
    assert!(!source.contains("Command::new"));
    assert!(!source.contains("wmic"));
    assert!(!source.contains("reg.exe"));
}
```

- [ ] **Step 2: Run the regression test and verify failure**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml native_windows_discovery
```

Expected: FAIL because the module does not exist and current discovery uses `Command::new`.

- [ ] **Step 3: Add exact Windows API features**

Update the existing Windows target dependency:

```toml
[target.'cfg(windows)'.dependencies]
windows-sys = { version = "0.61", features = [
  "Win32_Foundation",
  "Win32_System_Diagnostics_ToolHelp",
  "Win32_System_Registry",
  "Win32_System_Threading",
  "Win32_UI_WindowsAndMessaging",
] }
```

Regenerate `Cargo.lock` through `cargo check`; do not hand-edit it.

- [ ] **Step 4: Implement native process enumeration**

Use `CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)`, `Process32FirstW`/`Process32NextW`, `OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, ...)`, and `QueryFullProcessImageNameW`. Keep only case-insensitive `LeagueClientUx.exe`, close every non-invalid handle with `CloseHandle`, and return parent directories only.

The exported function must be a silent in-process call:

```rust
pub(crate) fn process_install_roots() -> Vec<PathBuf> {
    enumerate_processes()
        .into_iter()
        .filter(|process| process.exe_name.eq_ignore_ascii_case("LeagueClientUx.exe"))
        .filter_map(|process| query_process_image_path(process.pid))
        .filter_map(|path| path.parent().map(PathBuf::from))
        .collect()
}
```

Wrap unsafe handles in small functions whose only responsibility is acquisition/query/close; never retain handles between polling cycles.

- [ ] **Step 5: Implement native registry reads**

Read `InstallLocation` from both HKCU and HKLM uninstall keys with `RegOpenKeyExW`, `RegQueryValueExW`, and `RegCloseKey`. Query both default and `KEY_WOW64_64KEY` views, accept `REG_SZ`/`REG_EXPAND_SZ`, remove trailing NULs, and ignore missing keys without logging errors.

```rust
pub(crate) fn registry_install_roots() -> Vec<PathBuf> {
    [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE]
        .into_iter()
        .flat_map(|hive| read_install_location_views(hive))
        .collect()
}
```

- [ ] **Step 6: Replace command-based functions and verify**

Delete both `Command::new("wmic")` and `Command::new("reg")` paths from `discovery.rs`, wire the native module under `#[cfg(target_os = "windows")]`, and keep empty non-Windows implementations for macOS/Linux tests.

Run:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml discovery
rustup target add x86_64-pc-windows-msvc
cargo check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc
```

Expected: all commands PASS; cross-target check contains no console-subsystem errors.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lcu/discovery.rs src-tauri/src/lcu/discovery/windows.rs
git commit -m "fix: discover League without console windows"
```

---

### Task 3: Persisted Manual League Path and Native Picker

**Files:**
- Create: `src-tauri/src/lcu/discovery/config.rs`
- Modify: `src-tauri/src/lcu/discovery.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Test: inline tests in `config.rs`

**Interfaces:**
- Produces: `config::load_saved_lockfile() -> Option<PathBuf>`.
- Produces: `config::validate_selection(path: &Path) -> Result<PathBuf, SelectionError>`.
- Produces: Tauri command `choose_league_installation(kind: SelectionKind) -> Result<Option<String>, String>` where `SelectionKind` is `directory | lockfile`.
- Consumes: shared `lockfile::parse` and the application data root above the configured log directory.

- [ ] **Step 1: Write failing validation and persistence tests**

Use a unique temp root and assert directory/file selection, invalid format, and reload behavior:

```rust
#[test]
fn validates_persists_and_reloads_selected_directory() {
    let root = temp_root();
    let league = root.join("League of Legends");
    fs::create_dir_all(&league).unwrap();
    fs::write(league.join("lockfile"), "LeagueClient:1:54321:secret:https").unwrap();
    let selected = validate_selection(&league).unwrap();
    save_selected_lockfile_at(&root.join("league-client.json"), &selected).unwrap();
    assert_eq!(load_saved_lockfile_at(&root.join("league-client.json")), Some(selected));
}
```

- [ ] **Step 2: Run tests and verify failure**

Run `cargo test --manifest-path src-tauri/Cargo.toml validates_persists`.

Expected: FAIL because config functions do not exist.

- [ ] **Step 3: Add the Windows-only dialog dependency**

Add under the existing Windows target table:

```toml
rfd = "0.15"
```

The frontend must not receive broad filesystem permissions; selection and validation remain in Rust.

- [ ] **Step 4: Implement validation and atomic persistence**

Normalize a selected directory to `<directory>/lockfile`; accept a direct file only when its file name is exactly `lockfile`. Read and validate with `lockfile::parse`. Persist only the path in versioned JSON:

```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SavedLeaguePath { version: u8, lockfile_path: PathBuf }
```

Write to `league-client.json.tmp`, flush, then rename to `league-client.json`. The production config location is `configured_log_dir().parent()/league-client.json`.

- [ ] **Step 5: Implement the Tauri command**

Define a serde `SelectionKind` enum with `Directory` and `Lockfile`. On Windows, call `pick_folder()` for `Directory` and `set_file_name("lockfile").pick_file()` for `Lockfile`; do not apply an extension filter because League's `lockfile` has no extension. Return `Ok(None)` on cancel. On success, validate, persist, write a redacted success event, and return the selected installation directory as a local display string. Non-Windows builds return a clear unsupported error.

Register `choose_league_installation` in `tauri::generate_handler!`.

- [ ] **Step 6: Put the saved path first and verify**

Load the saved path before the environment/process/registry/common candidates, but continue automatic discovery if it is stale or invalid.

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml config
cargo test --manifest-path src-tauri/Cargo.toml discovery
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lcu/discovery src-tauri/src/lcu/discovery.rs src-tauri/src/lib.rs
git commit -m "feat: add persisted League path fallback"
```

---

### Task 4: Redacted Discovery and LCU Telemetry

**Files:**
- Create: `src-tauri/src/lcu/discovery/telemetry.rs`
- Modify: `src-tauri/src/lcu/discovery.rs`
- Modify: `src-tauri/src/lcu/client.rs`
- Modify: `src-tauri/src/diagnostics/health.rs`
- Test: inline tests in `telemetry.rs` and `health.rs`

**Interfaces:**
- Produces: `telemetry::record_report(report: &DiscoveryReport)`.
- Produces: `telemetry::safe_path(path: &Path) -> String`.
- Consumes: `DiscoveryReport` and LCU request outcome categories.

- [ ] **Step 1: Write failing redaction and health-state tests**

```rust
#[test]
fn safe_path_removes_windows_username_and_credentials() {
    let safe = safe_path(Path::new(r"C:\Users\Administrator\Riot Games\League of Legends\lockfile"));
    assert_eq!(safe, r"C:\Users\[USER]\...\League of Legends\lockfile");
    assert!(!safe.contains("Administrator"));
}

#[test]
fn invalid_candidates_are_degraded_not_missing() {
    let report = report_with_status(ProbeStatus::InvalidFormat);
    assert!(matches!(league_health(&report).status, HealthStatus::Degraded));
}
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml safe_path
cargo test --manifest-path src-tauri/Cargo.toml invalid_candidates_are_degraded
```

Expected: FAIL.

- [ ] **Step 3: Implement state-change-only discovery logging**

Build a report key from selected source plus ordered probe `(source,status)` pairs. Store the last key in `OnceLock<Mutex<Option<String>>>`; if unchanged, do not log again. On changes, emit correlation ID, source/status counts, and `safe_path` only. Do not pass raw file contents to tracing fields.

Example event shape:

```rust
tracing::info!(
    correlation_id = report.correlation_id,
    selected_source = ?report.selected_source,
    selected_path = %report.selected_path.as_deref().map(safe_path).unwrap_or_default(),
    probes = ?safe_probe_summary(report),
    "League client discovery changed"
);
```

- [ ] **Step 4: Log LCU outcome categories**

In `client.rs`, log only transitions among `no-lockfile`, `parse-error`, `connect-error`, `http-error`, and `ready`. Include HTTP status code when available; never include URL credentials, request headers, or response bodies.

- [ ] **Step 5: Derive actionable health from the same report**

Call discovery once in `get_desktop_health()` and share the result with League and LCU health logic. Map:

- no valid candidates and all missing → `missing`, recovery `select-league-path`;
- candidate exists but unreadable/invalid → `degraded`, recovery `select-league-path`;
- valid lockfile but LCU unreachable → `degraded`, recovery `retry`;
- valid lockfile and session → `ready`.

Keep Live Client and OP.GG states independent.

- [ ] **Step 6: Run tests and commit**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml diagnostics
cargo test --manifest-path src-tauri/Cargo.toml lcu
```

Expected: PASS, including assertions that secrets do not appear in formatted events.

Commit:

```bash
git add src-tauri/src/lcu src-tauri/src/diagnostics/health.rs
git commit -m "feat: log redacted League discovery outcomes"
```

---

### Task 5: Actionable Diagnostics UI and Export Location

**Files:**
- Modify: `src/services/tauriHost.ts`
- Modify: `src/services/tauriHost.test.ts`
- Modify: `src/features/arena/ui/DiagnosticsPanel.tsx`
- Modify: `src/features/arena/ui/DiagnosticsPanel.test.tsx`
- Modify: `src/features/arena/ui/ArenaDecisionView.tsx`
- Modify: `src/features/arena/ui/ArenaExpandedView.tsx`
- Modify: `src/app/useCompanionSession.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/OverlayPanel.tsx`

**Interfaces:**
- Produces: `chooseLeagueInstallation(kind: 'directory' | 'lockfile'): Promise<string | null>` in `tauriHost.ts`.
- Produces: `onSelectLeaguePath?: () => Promise<string | null>` UI callback.
- Consumes: Tauri command `choose_league_installation` and existing `export_diagnostics`.

- [ ] **Step 1: Write failing bridge tests**

```ts
it('opens the native League directory picker in Tauri', async () => {
  tauriMocks.isTauri.mockReturnValue(true)
  tauriMocks.invoke.mockResolvedValue('D:\\Riot Games\\League of Legends')
  await expect(chooseLeagueInstallation('directory')).resolves.toContain('League of Legends')
  expect(tauriMocks.invoke).toHaveBeenCalledWith('choose_league_installation', { kind: 'directory' })
})
```

Also assert outside Tauri returns `null` without invoking.

- [ ] **Step 2: Write failing diagnostics UI tests**

For `leagueDiscovery.status` missing/degraded, assert “重新检测”“选择 League 目录”和“选择 lockfile” are visible. Click each selection mode, resolve a path, and assert the selected path feedback. For export, assert the returned ZIP path is rendered and a “复制路径” button copies it.

- [ ] **Step 3: Run frontend tests and verify failure**

Run:

```bash
npm run test -- src/services/tauriHost.test.ts src/features/arena/ui/DiagnosticsPanel.test.tsx
```

Expected: FAIL because the bridge, prop, and UI actions do not exist.

- [ ] **Step 4: Implement the typed bridge and recovery code**

Extend `DesktopRecoveryCode` with `'select-league-path'`. Add:

```ts
export async function chooseLeagueInstallation(kind: 'directory' | 'lockfile'): Promise<string | null> {
  if (!isTauri()) return null
  return invoke<string | null>('choose_league_installation', { kind })
}
```

- [ ] **Step 5: Implement diagnostics actions and actual export path**

Replace the export status enum with a state that carries the returned path:

```ts
type OperationStatus =
  | { kind: 'idle' }
  | { kind: 'success'; path: string }
  | { kind: 'failure'; message: string }
```

Render the path in a read-only `<code>` element and copy it with `navigator.clipboard.writeText(path)`. Selection success must call the existing retry/refresh callback so health updates immediately.

- [ ] **Step 6: Wire the callback through the session and shell**

In `useCompanionSession`, add `selectLeagueInstallation(kind)` that invokes the bridge, increments `diagnosticRefreshKey` on success, and returns the path. Pass it from `App` to `OverlayPanel`, then to `DiagnosticsPanel` through the Arena views.

Also render the actionable `DiagnosticsPanel` inside the top-level expanded diagnostics drawer so ranked-mode users can select a path or export logs without first entering Arena route details. Keep the compact four-row summary above it.

- [ ] **Step 7: Run focused and full frontend verification**

Run:

```bash
npm run test -- src/services/tauriHost.test.ts src/features/arena/ui/DiagnosticsPanel.test.tsx
npm run test
npm run lint
npm run build
```

Expected: all PASS; no duplicated button labels within one rendered diagnostics surface.

- [ ] **Step 8: Commit**

```bash
git add src/services src/features/arena/ui src/app/useCompanionSession.ts src/App.tsx src/components/OverlayPanel.tsx
git commit -m "feat: add League path recovery UI"
```

---

### Task 6: CI Regression Guards, Documentation, and Windows Artifact Verification

**Files:**
- Modify: `.github/workflows/validate.yml`
- Modify: `.github/workflows/windows-installer.yml`
- Modify: `docs/windows-troubleshooting.md`
- Modify: `docs/windows-acceptance.md`

**Interfaces:**
- Consumes: all previous Rust commands, frontend actions, and workflows.
- Produces: a verified Windows installer/portable build with no command-based discovery regression.

- [ ] **Step 1: Add a static no-console regression guard**

Add before full verification in both relevant workflows:

```yaml
- name: Reject console-based League discovery
  shell: bash
  run: |
    if rg 'Command::new\("(wmic|reg)' src-tauri/src/lcu; then
      echo "League discovery must use native Windows APIs."
      exit 1
    fi
```

On Windows, use the Git-for-Windows bash already available to keep the exact guard identical.

- [ ] **Step 2: Update troubleshooting and acceptance docs**

Document this recovery order exactly:

1. Open League Client and wait for the signed-in home screen.
2. Click “重新检测”.
3. If still missing, click “选择 League 目录” and select the directory containing `lockfile`.
4. Confirm the status becomes ready within ten seconds.
5. Export diagnostics and use the displayed ZIP path.

Add acceptance checks for five minutes without Terminal windows, C/D/custom install paths, saved-path restart reuse, lobby 2999 behavior, and absence of credentials in ZIP/logs.

- [ ] **Step 3: Run complete local verification**

Run:

```bash
npm run verify
cargo test --manifest-path src-tauri/Cargo.toml
rg 'Command::new\("(wmic|reg)' src-tauri/src/lcu && exit 1 || true
```

Expected: frontend tests/lint/build, data checks, Rust checks/tests all PASS; `rg` returns no match.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows docs/windows-troubleshooting.md docs/windows-acceptance.md
git commit -m "ci: guard silent Windows client discovery"
```

- [ ] **Step 5: Push and verify GitHub Actions**

Push the feature branch, confirm PR validation succeeds, then dispatch `Windows Installer` for the branch. The Windows run must pass:

- native discovery compilation;
- frontend and Rust tests;
- portable build;
- PID/window or ready-log smoke test;
- NSIS build;
- artifact size/SHA256 assertions;
- installer and portable artifact upload.

- [ ] **Step 6: Perform real Windows acceptance**

On the affected Windows machine, install the new artifact and verify:

- no Terminal window appears during five minutes of polling;
- League status changes from Demo to connected within ten seconds after login;
- manual directory selection works when automatic sources are intentionally unavailable;
- exported diagnostics contain discovery outcomes and no raw lockfile/password/token values.

Record any remaining machine-specific failure with the newly exported ZIP before changing discovery behavior again.
