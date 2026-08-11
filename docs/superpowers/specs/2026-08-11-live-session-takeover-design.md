# Real Live Session Takeover Design

## Goal

Remove the Demo scenario from the production UI and make real League session evidence drive the page automatically. When no game is running, the app shows a waiting state. When Live Client data becomes available, it takes over the current mode, champion, items, and game state without manual refresh.

## Scope

This change covers production session selection, Arena mode detection, waiting and reconnecting UI, and regression tests. Mock matches remain available to automated tests and as internal recommendation templates where a real snapshot does not contain enough catalog context, but they are never presented as the current match and cannot be selected in the production UI.

Deleting every mock fixture or redesigning the recommendation engine is outside this change. Those fixtures may be removed later after real match construction supplies every field required by recommendations.

## Session States

The production UI has three user-visible states:

1. **Waiting**: Live Client has no usable current or cached snapshot. The app shows a concise "waiting to enter game" view and the League Client and Live Client connection states. It does not render a champion, build, augment recommendation, or Demo selector.
2. **Live**: Live Client has a fresh snapshot. The snapshot is authoritative for the game mode, current champion, current items, and game time. `KIWI`, `CHERRY`, and `ARENA` are all Arena modes.
3. **Reconnecting**: Live Client is temporarily unavailable but still has a valid cached real snapshot. The app keeps the last real page visible, marks it as reconnecting, and continues polling. When the cache expires, the UI returns to Waiting.

The existing connection presentation remains the single source for the visible connection label. A healthy League Client alone means the client is connected, not that a live game page should be rendered.

## Data Authority

Live Client is the highest-priority source after a match begins. A fresh Live Client snapshot updates the active mode even when LCU is healthy. This removes the current gate that ignores mode updates whenever the LCU state is `ready`.

LCU remains responsible for client phase, lobby and champion-select context, and player identity when available. LCU may establish a provisional mode before Live Client starts, but it cannot overwrite a mode established by a fresh or valid reconnecting Live Client snapshot.

Arena mode recognition is shared semantically across both application layers:

- TypeScript LCU mapping recognizes `arena`, `cherry`, `kiwi`, and the existing Chinese label.
- Rust LCU mapping recognizes the same aliases.
- Live Client continues using its exported Arena mode predicate with the same aliases.

When a Live Client champion matches an existing internal recommendation template, that template supplies catalog and recommendation fields that the endpoint does not provide. The UI must describe this as live data with local recommendations, never as a Demo match.

## UI Changes

The `DemoScenarioSwitcher` is removed from the production overlay and its refresh and selection handlers are removed from the production session API. User-facing toasts that mention refreshing or switching Demo scenarios are removed.

The overlay receives an explicit session availability value instead of inferring renderability from a green diagnostic. In Waiting, it renders a focused empty state with the current connection label and guidance to enter a game. In Live or Reconnecting, it renders the normal ranked or Arena decision view.

The diagnostics panel remains available in every state. This lets users export diagnostics while waiting without exposing any mock content.

## Failure Handling

- A malformed Live Client payload does not create a live session. Polling continues and diagnostics report the failure through the existing reading state.
- A temporary 2999 connection failure preserves only an already validated real snapshot for the existing cache window.
- An expired snapshot clears the visible match and returns the app to Waiting.
- LCU failure does not clear a valid Live Client session.
- OP.GG failure keeps local recommendation fallback behavior and does not affect whether the match is considered live.

## Testing and Acceptance

Automated coverage must prove:

- TypeScript and Rust LCU mappings classify `KIWI` as Arena.
- A fresh `KIWI` Live Client snapshot switches the page to Arena even while LCU is ready.
- LCU polling cannot overwrite an active real Arena mode with a ranked or unknown provisional mode.
- Waiting renders without the Demo selector or match recommendations.
- Live and reconnecting states retain real-session rendering as intended.
- Expired or unavailable Live Client data returns the page to Waiting.
- No production UI copy contains "Demo 场景", "刷新 Demo", or "切换 Demo".

The implementation is complete after frontend tests, Rust tests, lint, production build, Arena data checks, and the Windows GitHub Actions build all pass. The resulting Actions run must expose downloadable Windows portable and installer artifacts.
