# Windows Arena Companion Redesign

## Goal

Turn the prototype into a reliable Windows-first Arena companion. The first release must start consistently, detect the local League session when possible, accept manual input when automatic detection is unavailable, and rank the three visible augments with transparent evidence. Ranked-mode features are outside this phase and remain isolated until Arena is stable.

## Product Decisions

- Target Windows 10 and 11 on x64.
- Ship a signed-ready NSIS installer as the primary artifact and a portable executable as the diagnostic fallback.
- Use one window with compact overlay and expanded management states.
- Prefer automatic LCU/local-client discovery; always provide manual champion, selected-augment, and three-candidate entry.
- Support every champion through a general capability model, with optional champion-specific overrides.
- Display score components and data freshness. Do not display synthetic probabilities.
- Use CommunityDragon Chinese data as the canonical augment definition source, with English data as an identity fallback.
- Treat third-party performance statistics as optional providers. Stale or unavailable statistics must never be presented as current.

## Delivery Slices

### Slice 1: Reliable shell and diagnostics

Create a minimal Tauri application that can start without League, network access, or a valid data refresh. Add structured rotating file logs, a visible startup diagnostic, WebView2 guidance, explicit application/data directories, panic reporting, and a diagnostic export action. Discover Riot/League through process command lines, environment overrides, the lockfile, registry/install metadata where available, and common paths. Failure to find League is a normal offline state, not an application error.

### Slice 2: Versioned augment catalog

Replace the MetaBot scraper and the two generated TypeScript datasets with one versioned catalog. The importer fetches `zh_cn` and `en_us` CommunityDragon Arena payloads, joins records by numeric ID and API name, normalizes localized names/descriptions/icons/rarity, validates uniqueness and minimum coverage, and writes a compact JSON artifact plus a manifest containing generation time, content hash, record count, source URLs, and schema version.

The application bundles the last verified catalog so startup never depends on the network. A background refresh downloads to a temporary file, validates it, and atomically replaces the cache. Invalid or older data is rejected. CI checks daily for upstream changes and opens a reviewable update rather than silently changing recommendation behavior.

### Slice 3: Arena session and candidate input

Introduce an `ArenaSessionPort` with independent adapters:

- `LcuArenaSessionAdapter` for game phase, champion, and any augment fields exposed by the local client.
- `LiveClientAdapter` for in-game time and player state.
- `ManualArenaSessionAdapter` for champion, selected augments, and current three candidates.
- `CompositeArenaSession` that merges sources by field, records provenance, and never replaces newer manual input with missing automatic data.

Automatic candidate discovery is capability-based. If the current League client does not expose candidates, the UI immediately presents searchable manual selectors; OCR is not part of this phase.

### Slice 4: Transparent recommendation engine

The engine is pure TypeScript and has no UI, network, Tauri, or storage dependencies. Inputs are champion capabilities, selected augments, three candidates, optional opponent context, catalog metadata, and optional fresh statistics. Output contains a total score plus components:

- champion fit;
- selected-augment synergy;
- build continuity;
- defensive/context value;
- optional current-patch statistical evidence;
- confidence and missing-evidence notices.

General champion capabilities come from current champion metadata and deterministic role/stat heuristics. Champion overrides refine edge cases without replacing the general model. Augment capabilities are derived from normalized definitions and a small reviewed override table. Every explanation is generated from the same score components so the text cannot contradict the ranking.

## Architecture

```text
src/domain/arena/          catalog types, session model, scoring engine
src/application/arena/     orchestration, refresh policy, state machine
src/infrastructure/lcu/    browser/Tauri local-client adapters
src/infrastructure/data/   bundled catalog, cache, optional stats providers
src/ui/                    compact overlay and expanded management views
src-tauri/src/             startup, logging, discovery, HTTP commands, window API
scripts/arena-data/        importer, schema validation, manifest generation
```

Dependencies point inward: UI and infrastructure depend on application/domain interfaces; domain code imports neither React nor Tauri. Generated data is JSON, not thousands of lines of TypeScript.

## UI States

The compact overlay shows connection state, champion, three candidates, ranking, and the top score reasons. Expanding the same window reveals manual selectors, selected-augment history, score breakdowns, catalog version/freshness, source provenance, connection diagnostics, log export, and retry controls.

The UI must distinguish `automatic`, `manual`, `bundled-cache`, `runtime-cache`, and `unavailable`. Empty, loading, offline, stale, and invalid-data states have explicit copy and recovery actions. The application remains usable manually when every external service is unavailable.

## Error Handling

- Network refreshes have bounded timeouts and cannot block startup.
- Cache writes use download, validate, then atomic replace.
- Adapter errors are typed and surfaced in diagnostics without crashing the session loop.
- Polling prevents overlap, applies backoff, and stops when the window is closing.
- Rust panics and frontend unhandled errors are written to the diagnostic log.
- Hidden-console Windows builds always expose a user-readable failure path.
- CI fails on tests, lint, catalog validation, Cargo checks, frontend builds, portable builds, or installer builds. Failed steps are never converted to success.

## Testing and Acceptance

Unit tests cover catalog joining and validation, freshness policy, source merging, capability inference, score components, deterministic ordering, and explanation generation. Contract fixtures cover representative LCU and Live Client payloads, including missing and changed fields. UI tests cover manual fallback and all diagnostic states. CI builds both Windows artifacts and smoke-starts the executable on a Windows runner where practical.

Acceptance requires:

1. A clean Windows 10/11 machine can install and start the application without Node or Rust.
2. Starting without League or internet shows a usable manual Arena flow, not a blank window or crash.
3. With League running, detected fields populate and display their source.
4. The user can select a champion, prior augments, and three candidates manually and receive deterministic transparent ranking.
5. Catalog metadata shows source, collection time, schema version, and whether data is bundled or refreshed.
6. Corrupt cache, upstream failure, absent WebView2, and non-default League install paths have actionable diagnostics.
7. Tests, lint, frontend build, Rust checks, portable build, and NSIS build all fail CI correctly when broken.

## Migration and Removal

Keep existing ranked/player-intelligence code outside the new Arena dependency graph during the migration. Once the new Arena flow passes acceptance, remove the MetaBot scraper and generated dataset, hard-coded mock candidate scoring, synthetic probability fields, duplicated `augment` versus `arena` mode names, and CI steps that suppress failures. Ranked functionality can later migrate onto the same ports without blocking this release.

## Non-Goals

- OCR or screen capture.
- Game renderer injection or DirectX overlay hooks.
- Automated gameplay input.
- AI-generated recommendation text.
- Guaranteed third-party win/pick-rate data.
- Full ranked-mode reconstruction in the first delivery slice.
