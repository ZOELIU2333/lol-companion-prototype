# Manual Arena Augment and Build Loop Design

## Goal

Make manual augment input the reliable primary workflow for Arena recommendations. A player can search and record previously selected augments, enter the current three candidates, compare them, confirm the chosen candidate, and immediately receive combined augment and item routes. Automatic augment discovery remains an optional future source and can never erase newer manual facts.

## Product Outcome

The live Arena page must remain useful when the client exposes no augment fields. It answers three questions independently and continuously:

1. Given the augments already selected, which mechanisms and combinations are active?
2. Of the current three candidates, which one best advances a stable, high-ceiling, or off-meta route?
3. Given the champion, selected augments, owned items, and current gold, what should the player buy now and complete next?

Item advice must exist before any augment is entered. Candidate comparison enriches item advice but cannot be a prerequisite for it.

## Manual Input Model

The Arena page has two related manual inputs.

### Selected Augments

An always-visible icon row represents the augments already chosen in the current match. The player opens a search field, searches by Chinese name, English name, API name, or normalized description keywords, and selects an icon result to append it.

Selected augments are unique. Clicking a selected icon offers an explicit undo action. Undo recalculates combinations and item routes immediately. The row persists across Arena rounds.

### Current Three Candidates

Three fixed candidate slots represent the current selection round. Each empty slot opens the same searchable icon catalog. Duplicate candidates are rejected. Ranking starts only when all three slots are filled, while base item advice remains visible throughout partial entry.

Each ranked candidate has an `我选了这个` action. Confirming it atomically:

- appends the augment to selected history;
- clears all three round-scoped candidate slots;
- recalculates combination routes;
- recalculates immediate and completed-item advice;
- records a semantic change notification.

The manual input is the highest-priority source. Unsupported, unavailable, empty, stale, or older automatic observations cannot overwrite it. A future positively validated automatic observation may fill empty manual state but must not replace a newer manual selection.

## Search

Search is local and instant over the verified Arena catalog. The searchable index contains:

- localized Chinese name;
- English name;
- API name;
- normalized description text;
- rarity/tier label.

Results show the game icon, Chinese name, optional English name, and rarity. Exact and prefix name matches rank above description matches. Already selected augments and candidates already occupying another slot remain visible but disabled with a reason.

No network request occurs while searching, and missing icons use the existing named placeholder behavior.

## Combined Recommendation Model

The recommendation engine accepts champion capabilities, selected augment history, current candidate augments, owned item IDs, current gold, level, and game time.

Selected augments are permanent route inputs for the current match. Current candidates are alternative next nodes. The mechanism graph evaluates champion-to-augment, augment-to-augment, augment-to-item, and item-to-item edges together.

The output contains three deliberately different route objectives:

- **稳定强度** prioritizes current value, affordability, survivability, and already active mechanisms.
- **上限联动** prioritizes two-to-three-step amplification, conversion, and loop chains.
- **黑科技** prioritizes unusual but mechanism-valid interactions and labels their completion risk.

When three candidates are present, every candidate is scored against all three objectives and the UI explains which route it advances. When candidates are absent, the engine may recommend future augment targets from the full catalog, but it labels them as `后续寻找` rather than pretending they are current choices.

The UI never presents invented probabilities or win rates. Every recommendation explanation comes from the same graph edges used for its score.

## Item Recommendation Independence

Item route generation is no longer nested under candidate augment generation. It always creates at least one champion-based route from the current item catalog, owned items, and gold.

When selected augments exist, their graph capabilities rerank and explain item choices. When current candidates exist, the engine may show how selecting each candidate changes the leading item route, but removing the candidates returns to the selected-augment/champion baseline instead of removing item advice.

The compact item output keeps the existing sequence:

`现在买什么 → 第一件成装 → 后续装备`

If no component is affordable, it displays the cheapest relevant component and the remaining gold required. Missing catalog nodes degrade only that route and do not hide all item recommendations.

## Persistence and Match Reset

Manual Arena state is stored locally with a schema version, champion key, selected augment IDs, candidate IDs, and last observed game-time metadata. It contains no account credentials.

On application restart, state is restored only when the current live Arena session is compatible with the saved champion and has not clearly restarted. A game time more than 30 seconds lower than the saved observation, a different champion, a fresh non-Arena session, or an explicit `重置本局` action clears saved selected and candidate augments. A temporarily unavailable or reconnecting Live Client reading does not count as leaving Arena.

Corrupt, unknown-version, or unknown-ID storage is discarded safely. Automatic API failure never clears valid persisted manual state.

## UI Structure

The compact Arena page keeps a short vertical reading order:

1. `已选海克斯` icon row with search/add, undo, and reset.
2. `本轮三个候选` fixed slots with search and ranked recommendation once complete.
3. `组合方向` showing stable, ceiling, and off-meta routes with concise mechanism chains.
4. `装备路线` showing immediate purchase, first completed item, and later item.

The existing hidden details control is replaced by visible primary actions. Manual input must not be buried under diagnostics or a collapsed disclosure. Search closes after a selection and restores keyboard focus to the relevant slot or add button.

## Failure Handling

- Automatic augment source unsupported: manual controls remain primary; no repeating error toast.
- Candidate count below three: show the number still required; keep combination and item baselines visible.
- Duplicate augment: disable the result and explain where it is already used.
- Search has no match: show a local no-result state without clearing current input.
- Unknown saved augment ID: discard that ID, retain other valid IDs, and persist the repaired state.
- Live Client temporarily reconnecting: retain manual input and last real item/gold snapshot with the existing stale label.
- Item/gold unavailable: show a champion-and-selected-augment completed-item direction, labeling immediate purchase as waiting for live data.

## Testing and Acceptance

Unit tests cover multilingual search ranking, keyword normalization, duplicate disabling, selected-history append/undo, atomic candidate confirmation, manual-over-automatic precedence, persistence validation, match reset, and corrupted storage repair.

Recommendation tests prove:

- item advice exists with zero selected augments and zero candidates;
- selected augments rerank item routes;
- three current candidates receive distinct scores and explanations;
- confirming one candidate moves it to history and clears only round candidates;
- stable, high-ceiling, and off-meta routes have materially different core nodes when valid alternatives exist;
- future catalog suggestions are labeled `后续寻找`, never as current candidates.

UI tests cover search by Chinese and English names, icon results, keyboard focus, three fixed slots, duplicate states, `我选了这个`, undo, reset confirmation, persisted restore, compact reading order, and equipment visibility without candidates.

The implementation is accepted after all frontend tests, Rust tests, lint, catalog checks, production build, and Windows x64 Actions checks pass. Windows acceptance must confirm that a player can manually enter three candidates, choose one, see it in selected history, and receive updated combination and equipment routes without restarting the application.
