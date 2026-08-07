# LCU Native Process-Arguments Fallback Design

## Context

The Windows diagnostic bundle exported at Unix time `1786121063` proves two independent facts:

- Live Client recovered from `Payload`, `Connection`, and HTTP 404 failures to `Fresh`; the 2999 path is working.
- Native process discovery found the running `LeagueClientUx.exe` directory, but its adjacent `lockfile` repeatedly produced the safe category `InvalidFormat(FieldCount)`.

The tolerant lockfile parser already handles BOM, trailing NUL/newlines, and colons inside the credential. The remaining WeGame file therefore cannot be treated safely as a standard five-field LCU lockfile. The previously reserved fallback—reading the League process launch arguments through native Windows APIs—is now required.

## Goals

- Establish LCU connectivity for the observed WeGame client even when its adjacent lockfile is non-standard.
- Preserve standard lockfile discovery as the first and preferred path.
- Use Windows APIs directly without spawning Terminal, PowerShell, WMI commands, `wmic`, or `reg.exe`.
- Keep the LCU token, complete process command line, Authorization header, and response bodies out of logs, diagnostics, frontend payloads, and persisted settings.
- Show the backend's safe validation reason instead of collapsing string rejections to the generic “League 路径验证失败”.

## Non-goals

- Changing Live Client polling, which the latest diagnostic shows reaching `Fresh`.
- Fixing OP.GG connectivity in this change.
- Persisting process arguments or tokens.
- Reading command lines from arbitrary processes.

## Chosen Approach

Use a native process-arguments fallback only for a running executable whose name is exactly `LeagueClientUx.exe` (case-insensitive). Standard saved, environment, process-directory, registry, and common-path lockfiles remain first priority. When no valid lockfile is available, the backend queries the matching League process command line and extracts only these recognized switches:

- `--app-port`
- `--remoting-auth-token`
- `--app-protocol` when present; otherwise use `https`

Both `--key=value` and `--key value` forms are accepted. The port must be in `1..=65535`, the token must be non-empty, and the protocol must be `http` or `https`.

Alternatives rejected:

1. Broadening delimiter guesses cannot reliably distinguish credentials from malformed content and has already failed against the real client.
2. Requiring the user to inspect or share the lockfile increases privacy risk.
3. Relying only on Live Client loses lobby, gameflow, and champion-select evidence.

## Architecture

### Credential boundary

Generalize the existing redacted `LcuLockfile` value into an internal LCU credential value containing PID, port, token, and protocol. It may be constructed from either a valid lockfile or recognized process arguments. Its custom `Debug` implementation always replaces the token with `[REDACTED]`.

No Tauri command returns this value. LCU request code consumes it directly inside Rust and continues to use Basic authentication only for localhost.

### Windows process discovery

Extend the existing ToolHelp snapshot loop so it retains the PID and executable parent for each `LeagueClientUx.exe`. Continue using `QueryFullProcessImageNameW` to verify the executable path.

For the fallback, open only that PID with query rights and call native `NtQueryInformationProcess` using `ProcessCommandLineInformation`. Bound the returned buffer to 64 KiB, validate the returned UTF-16 structure, copy the command line into a temporary Rust string, extract the three allowlisted switches, then drop the raw string immediately.

Every process handle is wrapped by the existing RAII handle and closed. Failure categories are structural only, such as `AccessDenied`, `ArgumentsUnavailable`, `MissingPort`, `MissingToken`, or `InvalidProtocol`.

### Discovery ordering

1. Validate saved and environment lockfiles.
2. Validate lockfiles adjacent to live League processes.
3. Validate registry and common-path lockfiles.
4. If none is valid, query arguments from live League processes.
5. Select the first validated process-argument credential.

The discovery report may record `ProcessArguments:Valid` or a safe failure category. It must never contain the raw command line, token, argument values, or derived Authorization header.

### LCU client integration

Replace the path-only handoff with an internal discovery result that can supply validated credentials from either source. Existing gameflow, summoner, champion-select, and Arena endpoint requests remain unchanged.

Manual lockfile selection continues to validate and save only a path. A non-standard selected file reports its safe parser category, while automatic process-argument fallback can still connect independently during the next detection cycle.

### Frontend validation errors

Tauri command failures may reject with a string. The selection handler will preserve a string rejection as its user-facing message, use `Error.message` for JavaScript errors, and fall back to the generic message only for unknown values. Backend messages contain safe categories and no credential data.

## Failure Handling

- No matching League process: keep the existing missing state.
- Process exits during inspection: classify as arguments unavailable and retry on the normal polling cycle.
- Insufficient access: classify safely; do not elevate privileges or ask for administrator mode.
- Incomplete or invalid switches: reject the candidate without logging values.
- Valid credentials but LCU request fails: keep the existing connect/HTTP outcome classification.
- Standard lockfile becomes valid later: it regains priority automatically.

## Testing

- Pure parser tests for quoted command lines and both supported switch forms.
- Missing, empty, invalid-port, and invalid-protocol tests using safe categories.
- Redacted `Debug` and telemetry tests proving fixture tokens never appear.
- Discovery-order tests proving a valid lockfile beats process arguments and process arguments beat no connection.
- Static Windows source test proving no console command execution is introduced.
- Frontend test proving a Tauri string rejection renders its safe detailed message.
- Full frontend data checks, Vitest, ESLint, production build, Rust format/test/check, and Windows x64 Actions build with portable smoke start and NSIS artifacts.

## Windows Acceptance

With the observed WeGame client running:

1. The non-standard adjacent lockfile may remain `FieldCount`, but native process-argument fallback becomes valid.
2. League Client changes to ready without manually sharing or editing the lockfile.
3. Lobby/gameflow state is readable; actual-game Live Client remains independently fresh.
4. Logs and exported diagnostics show only source and safe categories.
5. Searching logs and the diagnostics ZIP does not reveal the fixture token, raw process command line, Authorization header, or lockfile content.
