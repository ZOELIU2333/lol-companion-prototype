# Arena Realtime Build Engine Design

## Goal

Rebuild the prototype as a Windows-first Arena companion whose primary value is realtime build planning. It continuously combines the current champion, level, gold, items, selected augments, current three candidates, and available evidence to maintain three distinct routes: stable power, high-ceiling synergy, and mechanism-valid off-meta technology.

This is not a static tier list. The product must answer three questions within the Arena decision window:

1. Which of the three augments should I choose?
2. What should I buy now and what completed items should follow?
3. What combination is this choice building toward, what is missing, and how risky is it?

## Product Decisions

- The first phase is Arena-first. Ranked player intelligence remains outside the new dependency graph.
- Target Windows 10 and 11 x64.
- Ship NSIS as the primary artifact and a portable executable as the diagnostic fallback.
- Use one window with compact overlay and expanded management states.
- Automatically read champion, level, gold, items, and game time.
- Prefer automatic selected/candidate augment reads, but provide a fast icon-based manual fallback whenever the current client does not expose those fields.
- Cover every champion through general capability inference, with small reviewed overrides for exceptional mechanics.
- Use game-native augment, champion, and item icons as the primary visual language.
- Never display synthetic probabilities, invented win rates, or stale statistics as current evidence.
- Recalculate on meaningful state changes and notify only when the leading route changes, a complete item appears, a new augment is selected, or an incomplete combination becomes buildable.

## Architecture

```text
LCU adapter ─────────────┐
Live Client adapter ─────┼─> field-level session fusion ─> Arena state events
Manual augment input ────┘                                  │
                                                            ▼
CommunityDragon catalog ──> mechanism graph ─────────> route planner
Optional stats providers ─> evidence registry ────────> route planner
                                                            │
                                                            ▼
                                         stable / ceiling / off-meta routes
                                                            │
                                                            ▼
                                           compact overlay / expanded view
```

Recommended source layout:

```text
src/features/arena/domain/          session, catalog, graph, evidence types
src/features/arena/session/         source ports, fusion, change detection
src/features/arena/catalog/         validation, lookup, freshness, cache
src/features/arena/graph/           capability inference and graph traversal
src/features/arena/recommendation/  route generation, scoring, diversity
src/features/arena/ui/              compact and expanded Arena views
src-tauri/src/lcu/                  League discovery and authenticated reads
src-tauri/src/live_client/          realtime game-state reads
src-tauri/src/diagnostics/          logging, health, redaction, export
scripts/arena-data/                 bilingual catalog importer and validation
```

Dependencies point inward. The graph and route planner are pure TypeScript and import neither React, Tauri, storage, nor network code. Infrastructure adapters produce typed partial facts. The UI consumes completed application view models and never performs scoring.

## Realtime Session Model

Realtime collection uses field-level fusion rather than treating any endpoint as a complete truth. Each observed field stores:

- value;
- source: `lcu`, `live-client`, `manual`, `bundled-cache`, or `runtime-cache`;
- observation time;
- state: `live`, `stale`, `unsupported`, `unavailable`, or `error`.

LCU supplies client phase, queue/mode, current champion, and any Arena fields confirmed to exist in the current client. Live Client Data supplies game time, level, current gold, current items, and player state. Candidate augment discovery is capability-based: an empty payload cannot be interpreted as an empty candidate list unless the adapter has positively identified a supported endpoint and round state.

Manual champion, selected-augment, and three-candidate input is always available. A missing automatic value never overwrites a newer complete manual value. A round transition clears only round-scoped candidates, not selected augment history.

Polling is non-overlapping, bounded by timeouts, and uses backoff after repeated failures. Facts create state events only when semantically changed. Gold changes update the purchase plan silently. Complete item changes, augment changes, route-leader changes, and completed combination chains may notify.

## Versioned Arena Catalog

The existing MetaBot scraper is removed because its endpoint now returns HTTP 405. The old generated TypeScript datasets are also removed.

One importer fetches CommunityDragon `zh_cn` and `en_us` Arena payloads, joins records by numeric ID and API name, normalizes localized names, descriptions, icons, rarity, and identity, and writes compact JSON plus a manifest containing:

- schema version;
- generation time;
- content hash;
- augment count;
- Chinese and English source URLs;
- source locale priority.

Chinese definitions are canonical; English definitions supply API identity and fallback text. Icon paths beginning with `assets/` resolve under CommunityDragon's `/latest/game/` root. The prototype's current `/latest/plugins/rcp-be-lol-game-data/global/default/` prefix is incorrect for multiple live Arena icons, including Earthwake, and must not be retained.

The application starts from a bundled verified catalog. Background refresh downloads to a temporary file, validates schema, uniqueness, count, hash, and age, then atomically replaces the runtime cache. Network failure never blocks startup. CI checks upstream data daily and produces a reviewable change.

## Mechanism Graph

The graph has four node families:

1. Champion capabilities: multi-dash, repeat casting, sustained damage, shielding, healing, critical interactions, summons, attack frequency, range, crowd control, and similar gameplay mechanics.
2. Augment capabilities: inferred from current bilingual definitions and corrected by a small API-name override table for complex behavior.
3. Item capabilities: triggers, scaling stats, defensive behavior, damage type, movement, haste, conversion, and completion cost.
4. Match conditions: melee/ranged, level, gold, completed items, opponent damage profile, round timing, and current route state.

Graph edges use five explicit semantics only:

- `triggers` — one mechanic activates another;
- `amplifies` — one mechanic increases another's value;
- `converts` — one resource or damage model becomes another;
- `loops` — the end of a chain makes its trigger available again;
- `conflicts` — requirements or play patterns work against each other.

Every edge records evidence and reasoning. A generated explanation is built from the same edges used for scoring, so explanation and ranking cannot contradict each other.

## Evidence Model

Evidence levels are independent and visible:

- `current-statistics` — patch-qualified current performance data;
- `community-sample` — reproducible community games or published build evidence;
- `mechanism-verified` — interaction follows directly from current definitions or a reviewed override;
- `theoretical` — the graph supports the path but real-game strength has not been demonstrated.

An off-meta route must be mechanism-verified before recommendation. Theoretical edges can explain future potential but cannot by themselves elevate a broken or incomplete route. Missing or stale statistics reduce confidence; they do not erase a valid mechanism. Third-party providers are optional adapters and may not claim freshness without patch and collection metadata.

## Three Distinct Route Objectives

### Stable power

Prioritizes value that works immediately: champion fit, current items, selected-augment synergy, survivability, completion cost, and fresh statistical evidence. It represents the reliable floor.

### High-ceiling synergy

Searches two to three steps ahead for trigger, amplifier, conversion, or loop chains. It reports remaining augments/items and penalizes low-probability construction distance. A theoretical maximum that requires multiple rare future conditions is labeled difficult to complete.

### Off-meta technology

Searches for unusual conversion or loop paths that are mechanism-valid but less common. Its score includes mechanism completeness, novelty, immediate usability, build cost, and failure risk. Novelty may surface an otherwise valid route; it cannot rescue an invalid route.

Route diversity is enforced by core-node difference. When two routes converge on the same core augment and items, the planner searches for the next valid distinct branch. If no credible alternative exists, the UI states that no trustworthy distinct route is available instead of manufacturing variety.

Each route returns:

- ranking of the current three candidates;
- one primary reason and any conflict;
- immediate affordable purchase;
- first completed item and later item direction;
- next mechanics to seek;
- missing or impossible conditions;
- source, patch, evidence level, and confidence;
- material change reason when the route changes.

## UI Design

The approved baseline is the fourth visual prototype: game-native icon driven, low text density, and a fixed three-step reading order.

1. `本轮选什么` shows the three candidate augment icons. The recommendation is visually dominant and includes only name, route score, and one reason.
2. `回城买什么` shows the affordable component for current gold, first completed item, and later item direction. Every icon includes a short name and purpose.
3. `这套怎么成型` shows one left-to-right icon chain: champion mechanic, selected augment, recommended candidate, item, and route outcome.

The compact overlay displays those three steps without a dense graph. The expanded state contains alternate stable/high-ceiling/off-meta routes, evidence, manual icon pickers, source provenance, catalog freshness, and diagnostics.

The palette is neutral dark gray with one blue primary accent. Tier color may appear as a restrained icon-frame detail; it does not compete with recommendation hierarchy. Abstract network diagrams are excluded from the main realtime view.

## Error Handling

- League not found: enter manual Arena mode; do not fail startup.
- Live Client disconnected: retain the last valid snapshot with its age; never label it live.
- Augment endpoint unsupported: show the fast icon picker without repeated error notifications.
- CommunityDragon unavailable: use the bundled verified catalog.
- Icon unavailable: use local cache, then a clear placeholder with the localized name.
- Statistics stale: remove them from scoring and show mechanism-only confidence.
- Adapter error: write a redacted diagnostic and isolate the failure from other sources.
- Hidden-console Windows failure: record a file log and show a user-readable recovery path.
- Cache update: download, validate, and atomically replace; invalid cache cannot replace the last valid copy.

Logs redact LCU passwords, Riot API keys, authorization headers, and account secrets. Diagnostics expose source health and actionable recovery, not raw credentials.

## Testing and Acceptance

Unit tests cover bilingual catalog joins, icon path resolution, schema/hash validation, field-level source fusion, round transitions, capability inference, edge semantics, evidence rules, route diversity, scoring determinism, purchase affordability, and explanation consistency.

Contract fixtures cover representative LCU and Live Client payloads, missing fields, unsupported augment endpoints, and changed unknown fields. UI tests cover icon loading/fallback, manual candidate selection, the three-step reading order, current-gold purchase advice, three routes, stale source badges, and offline recovery.

Acceptance requires:

1. A clean Windows 10/11 x64 machine installs and starts without Node.js or Rust.
2. Without League or internet, manual mode completes one full three-candidate recommendation.
3. Champion, level, gold, items, and time update from a real game.
4. Three localized augment icons render correctly; unsupported automatic reads fall back to manual selection within seconds.
5. Stable, high-ceiling, and off-meta routes remain meaningfully distinct or explicitly report that no credible alternative exists.
6. Purchase advice shows an affordable component, first completed item, and later direction.
7. Every off-meta route identifies mechanism conditions, missing nodes, risk, and evidence level.
8. Material state changes update routes without notification spam.
9. Corrupt cache, missing icons, upstream failure, and non-default League paths provide actionable diagnostics.
10. Tests, lint, catalog validation, Rust checks, portable build, or NSIS build failure causes CI to fail.

## Delivery Order

1. Versioned bilingual catalog and local icon reliability.
2. Pure mechanism graph, evidence registry, and three-route planner using fixtures.
3. Realtime source fusion with manual augment fallback.
4. Approved three-step icon UI and purchase planning.
5. Windows logging, diagnostics, packaging, and strict CI.

Each slice must be independently testable. Existing ranked/player-intelligence code remains isolated until Arena acceptance passes, after which obsolete MetaBot, mock candidate scoring, synthetic probability, and duplicate `augment`/`arena` mode code are removed.

## Non-Goals

- OCR or screen capture in the first phase.
- Game renderer injection or DirectX hooks.
- Automated gameplay input.
- Generative AI in the realtime decision path.
- Guaranteed third-party performance statistics.
- Full ranked-mode reconstruction before Arena acceptance.
