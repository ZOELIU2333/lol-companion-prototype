import type { LiveClientSnapshot } from './liveClientData'
import type { GameMode } from '../types'

export type ConnectionStatus = 'detecting' | 'disconnected' | 'client' | 'syncing' | 'match'

/**
 * A live snapshot is meaningful on its own — even when LCU/lockfile discovery
 * failed — when it carries any real in-game signal: game time, players, gold, or
 * items. This lets the 2999 Live Client Data feed drive an active session by itself.
 */
export function hasMeaningfulLiveData(snapshot: LiveClientSnapshot | null): boolean {
  if (!snapshot) return false
  return (
    snapshot.gameTime !== null ||
    snapshot.players.length > 0 ||
    snapshot.currentGold !== null ||
    snapshot.currentItemIds.length > 0
  )
}

/**
 * The overlay shows an active session when either the LCU phase reached "match"
 * OR live in-game data exists on its own. The two signals are independent so a
 * working 2999 feed is never hidden by an LCU/lockfile failure.
 */
export function isSessionActive(connectionStatus: ConnectionStatus, hasLiveData: boolean): boolean {
  return connectionStatus === 'match' || hasLiveData
}

/**
 * Maps a Live Client Data `gameMode` to a companion mode ONLY when it can be
 * identified with confidence. The 2999 feed is the sole signal here (LCU/queue id
 * is unavailable in this path), so we must not guess:
 *   - `CHERRY` → augment (Arena / 斗魂竞技场 uses augments) — reliable
 *   - `KIWI`   → augment (ARAM Mayhem / 海克斯大乱斗). Observed directly from
 *               the Windows Live Client `gameMode` field during a Mayhem match.
 *   - `CLASSIC` → ranked (Summoner's Rift) — reliable
 *   - `ARAM`    → null. Plain ARAM and ARAM Mayhem can both surface as `ARAM` in
 *               some clients, so it is NOT safe to infer augment from `ARAM` alone.
 *   - anything else / null → null (unknown; caller shows a generic live view)
 */
export function mapLiveGameModeToMode(gameMode: string | null | undefined): GameMode | null {
  switch ((gameMode ?? '').toUpperCase()) {
    case 'CHERRY':
    case 'KIWI':
      return 'augment'
    case 'CLASSIC':
      return 'ranked'
    default:
      return null
  }
}

/**
 * Resolves the UI mode from current-session signals without carrying mode state
 * across games. LCU wins because its queue id can distinguish Mayhem from plain
 * ARAM; an ambiguous or missing live mode falls back to the non-augment view.
 */
export function resolveActiveMode(
  lcuMode: GameMode | null | undefined,
  liveGameMode: string | null | undefined,
): GameMode {
  return lcuMode ?? mapLiveGameModeToMode(liveGameMode) ?? 'ranked'
}
