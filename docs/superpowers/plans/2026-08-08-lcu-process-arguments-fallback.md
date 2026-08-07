# Native LCU Process-Arguments Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the Windows app to WeGame League when its adjacent lockfile is non-standard by safely extracting validated LCU credentials from the running `LeagueClientUx.exe` command line.

**Architecture:** Keep normal lockfiles first. Introduce one redacted internal credential type shared by lockfile and process-argument sources, add a bounded native Windows command-line reader, and let discovery pass validated credentials directly to the existing LCU request layer. Preserve safe errors through diagnostics and the frontend.

**Tech Stack:** Rust 2021, Tauri 2, `windows-sys` 0.61, reqwest 0.12/rustls, React 19, TypeScript 5.9, Vitest 4, GitHub Actions Windows x64, NSIS.

## Global Constraints

- Never log, serialize, persist, or return the raw process command line, LCU token, Authorization header, or lockfile contents.
- Inspect only an exact case-insensitive `LeagueClientUx.exe`; do not read arbitrary process arguments.
- Do not spawn PowerShell, WMI, `wmic`, `reg.exe`, a shell, or a console window.
- Bound native reads to 64 KiB and validate pointers, lengths, UTF-16, port, and protocol.
- Keep all lockfile sources ahead of process arguments and preserve existing Tauri payloads and artifact names.

---

### Task 1: Add a source-neutral redacted credential type

**Files:**
- Create: `src-tauri/src/lcu/credentials.rs`
- Modify: `src-tauri/src/lcu/mod.rs`
- Modify: `src-tauri/src/lcu/lockfile.rs`

**Interfaces:**
- Produces: `LcuCredentials::try_new(pid, port, password, protocol)` and internal accessors.
- Produces: `CredentialValidationError::{InvalidPid, InvalidPort, EmptyPassword, InvalidProtocol}`.
- Keeps: public-safe `LockfileParseError` categories.

- [ ] **Step 1: Write failing validation and redaction tests**

```rust
#[test]
fn validates_and_redacts_credentials() {
    let value = LcuCredentials::try_new(42, 12345, "fixture-secret".into(), "https".into()).unwrap();
    let debug = format!("{value:?}");
    assert_eq!(value.port(), 12345);
    assert!(!debug.contains("fixture-secret"));
    assert!(debug.contains("[REDACTED]"));
}
```

Also assert zero PID, zero port, empty token, and `ftp` map to the four exact validation categories.

- [ ] **Step 2: Run `cargo test --manifest-path src-tauri/Cargo.toml lcu::credentials`**

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement `LcuCredentials`**

Derive `Clone`, `PartialEq`, and `Eq`; normalize the protocol to lowercase; validate all fields in `try_new`; expose read-only internal accessors. Implement `Debug` manually with `password: "[REDACTED]"`.

- [ ] **Step 4: Make lockfile parsing return `LcuCredentials`**

Keep the current tolerant outside-in parser and map each credential validation error one-to-one to `LockfileParseError`. Preserve all existing lockfile tests.

- [ ] **Step 5: Verify and commit**

```bash
cargo test --manifest-path src-tauri/Cargo.toml lcu::credentials
cargo test --manifest-path src-tauri/Cargo.toml lcu::lockfile
git add src-tauri/src/lcu/credentials.rs src-tauri/src/lcu/mod.rs src-tauri/src/lcu/lockfile.rs
git commit -m "refactor: unify internal LCU credentials"
```

---

### Task 2: Parse only allowlisted League process arguments

**Files:**
- Create: `src-tauri/src/lcu/discovery/process_arguments.rs`
- Modify: `src-tauri/src/lcu/discovery.rs`

**Interfaces:**
- Produces: `parse(command_line: &str, pid: u32) -> Result<LcuCredentials, ProcessArgumentsError>`.
- Produces: safe categories `ArgumentsUnavailable`, `MissingPort`, `InvalidPort`, `MissingToken`, `InvalidProtocol`.
- Accepts: `--key=value` and `--key value`, including quoted values.

- [ ] **Step 1: Add failing parser tests**

```rust
let a = parse(r#"LeagueClientUx.exe --app-port=54321 --remoting-auth-token=secret --app-protocol=https"#, 77).unwrap();
assert_eq!(a.port(), 54321);
let b = parse(r#"\"C:\\Riot Games\\LeagueClientUx.exe\" --app-port \"54322\" --remoting-auth-token \"other-secret\""#, 78).unwrap();
assert_eq!(b.protocol(), "https");
```

Add table tests for missing/empty/out-of-range port, missing/empty token, invalid protocol, mixed order, and a token containing `=`. Assert formatted results never contain fixture secrets or the whole command line.

- [ ] **Step 2: Run `cargo test --manifest-path src-tauri/Cargo.toml process_arguments`**

Expected: FAIL because the parser does not exist.

- [ ] **Step 3: Implement a small quoted-token parser**

Tokenize quotes and whitespace without a shell. Examine only `--app-port`, `--remoting-auth-token`, and `--app-protocol`; split equals form once; use `https` when protocol is absent; validate through `LcuCredentials::try_new`; expose only safe error categories.

- [ ] **Step 4: Scan and commit**

```bash
rg -n "log::|tracing::|println!|Serialize|Command::new|powershell|wmic" src-tauri/src/lcu/discovery/process_arguments.rs
cargo test --manifest-path src-tauri/Cargo.toml process_arguments
git add src-tauri/src/lcu/discovery.rs src-tauri/src/lcu/discovery/process_arguments.rs
git commit -m "feat: parse safe League process arguments"
```

Expected: tests PASS and the scan has no production logging, serialization, or command execution.

---

### Task 3: Read the exact Windows process command line natively

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lcu/discovery/windows.rs`
- Modify: `src-tauri/src/lcu/discovery.rs`

**Interfaces:**
- Produces: verified process candidates retaining PID and install root.
- Produces: safe `Result<LcuCredentials, ProcessArgumentsError>` per candidate.
- Uses: `NtQueryInformationProcess` with `ProcessCommandLineInformation` and RAII handles.

- [ ] **Step 1: Add failing source-safety and candidate tests**

Test that a candidate retains PID/root. With `include_str!`, assert `windows.rs` contains `ProcessCommandLineInformation` and excludes `Command::new`, `powershell`, `wmic`, and `reg.exe`.

- [ ] **Step 2: Run `cargo test --manifest-path src-tauri/Cargo.toml lcu::discovery`**

Expected: FAIL until candidate data and reader integration exist.

- [ ] **Step 3: Enable `Wdk_System_Threading` and retain verified PIDs**

Add the target-specific `windows-sys` feature. Continue exact process-name matching and `QueryFullProcessImageNameW` verification, but return:

```rust
pub(crate) struct LeagueProcessCandidate {
    pub(crate) pid: u32,
    pub(crate) install_root: PathBuf,
}
```

- [ ] **Step 4: Implement the bounded reader**

Open only the verified PID with `PROCESS_QUERY_LIMITED_INFORMATION`. Query the required byte count, reject sizes outside `size_of::<UNICODE_STRING>()..=64*1024`, query again, read the structure unaligned, require an even UTF-16 byte length, and prove `Buffer..Buffer+Length` lies inside the allocation before constructing a slice. Convert to a temporary string, parse immediately, then drop it. Map access/race/status/pointer/UTF-16 failures to `ArgumentsUnavailable` without values.

- [ ] **Step 5: Verify and commit**

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml lcu::discovery
cargo check --manifest-path src-tauri/Cargo.toml
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lcu/discovery.rs src-tauri/src/lcu/discovery/windows.rs
git commit -m "feat: read League credentials from native process data"
```

Expected: host checks PASS; Windows-only code stays behind `cfg(target_os = "windows")` for Actions compilation.

---

### Task 4: Select validated credentials and feed the LCU clients

**Files:**
- Modify: `src-tauri/src/lcu/discovery.rs`
- Modify: `src-tauri/src/lcu/discovery/telemetry.rs`
- Modify: `src-tauri/src/lcu/client.rs`
- Modify: `src-tauri/src/diagnostics/health.rs`

**Interfaces:**
- Adds: `DiscoverySource::ProcessArguments`.
- Adds: internal `DiscoveryReport.selected_credentials: Option<LcuCredentials>`.
- Adds: `ProbeFailure::{Lockfile(...), ProcessArguments(...)}`.
- Replaces: path-only internal readers with credential-based readers.

- [ ] **Step 1: Write failing discovery-order tests**

Test that a valid saved lockfile beats valid process arguments, valid process arguments win when every lockfile is invalid, invalid arguments yield only a safe category, and formatting a report never reveals `fixture-process-secret`.

- [ ] **Step 2: Run `cargo test --manifest-path src-tauri/Cargo.toml lcu::discovery`**

Expected: FAIL because reports cannot select process credentials.

- [ ] **Step 3: Retain credentials during probes and preserve order**

Parse each lockfile once and retain its credential. Probe saved, environment, adjacent-process, registry, and common files first. Only when none succeeds, inspect verified process arguments and select the first valid one. Keep `selected_path` optional for diagnostics/settings.

- [ ] **Step 4: Convert clients and health checks**

Add credential-based internal readers for ordinary and Arena LCU payloads. `read_lcu_session`, `read_arena_lcu_session`, and the health snapshot perform one discovery and consume its validated credential. Keep endpoint calls and external Tauri payloads unchanged. Treat LCU discovery as available when credentials exist even if `selected_path` is absent.

- [ ] **Step 5: Restrict telemetry and verify**

Telemetry may include correlation ID, source, safe candidate path, status, and safe category only. Process-argument probes contain no raw command line or values.

```bash
cargo test --manifest-path src-tauri/Cargo.toml lcu::
cargo test --manifest-path src-tauri/Cargo.toml diagnostics::
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
git add src-tauri/src/lcu src-tauri/src/diagnostics/health.rs
git commit -m "fix: fall back to native League process credentials"
```

---

### Task 5: Preserve safe frontend errors and document recovery

**Files:**
- Modify: `src/services/tauriHost.ts`
- Modify: `src/services/tauriHost.test.ts`
- Modify: `docs/windows-beta-acceptance.md`
- Modify: `docs/windows-troubleshooting.md`

- [ ] **Step 1: Add a failing string-rejection test**

```ts
tauriMocks.invoke.mockRejectedValue('所选 lockfile 无法解析（字段数量不正确）');
await expect(chooseLeagueInstallation('lockfile')).rejects.toThrow(
  '所选 lockfile 无法解析（字段数量不正确）',
);
```

- [ ] **Step 2: Run `npm test -- --run src/services/tauriHost.test.ts`**

Expected: FAIL because a raw Tauri string is not normalized to `Error`.

- [ ] **Step 3: Normalize safe error shapes**

Rethrow an existing `Error`, convert a non-empty string to `new Error(error)`, and use the existing generic Chinese message for other values. Never stringify unknown objects.

- [ ] **Step 4: Update Windows docs**

Document lockfile priority, automatic WeGame process fallback, no administrator requirement, safe `ProcessArguments:Valid` diagnostics, and separate lobby/gameflow versus in-game Live Client acceptance checks.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- --run src/services/tauriHost.test.ts
npm test -- --run
npm run lint
npm run build
git add src/services/tauriHost.ts src/services/tauriHost.test.ts docs/windows-beta-acceptance.md docs/windows-troubleshooting.md
git commit -m "fix: explain League validation and fallback status"
```

---

### Task 6: Full verification, publish, and Windows x64 build

**Files:**
- Verify: `.github/workflows/windows-installer.yml`
- Verify: every changed Rust, TypeScript, test, and documentation file.

- [ ] **Step 1: Run the complete local gate**

```bash
npm run data:arena:check
npm run data:game:check
npm test -- --run
npm run lint
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
git diff --check
```

- [ ] **Step 2: Scan for leaks and forbidden commands**

```bash
rg -n "fixture-secret|fixture-process-secret|Authorization: Basic|Command::new\(|powershell|wmic|reg\.exe" src-tauri/src src test docs
```

Expected: secrets occur only in explicit redaction fixtures; no production credential logging or new command execution.

- [ ] **Step 3: Push and trigger**

```bash
git push origin codex/live-client-reliability
gh workflow run windows-installer.yml --ref codex/live-client-reliability
```

- [ ] **Step 4: Monitor and verify artifacts**

Set `LCU_BUILD_RUN_ID` from `gh run list --workflow windows-installer.yml --branch codex/live-client-reliability --limit 1 --json databaseId --jq '.[0].databaseId'`, then run `gh run watch "$LCU_BUILD_RUN_ID" --exit-status` and `gh run view "$LCU_BUILD_RUN_ID" --json url,conclusion,headSha,artifacts`.

Expected: Windows x64 compilation, portable smoke start, NSIS packaging, and upload succeed; both `LOL-Companion-Windows-Installer` and `LOL-Companion-Windows-Portable` are downloadable.
