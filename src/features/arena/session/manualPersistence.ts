import type { ArenaObservationState } from './types'

export const MANUAL_ARENA_STORAGE_KEY = 'lol-companion:arena-manual:v1'

export type ManualArenaPersistenceSnapshot = {
  schemaVersion: 1
  championKey: number
  selectedAugmentIds: number[]
  candidateAugmentIds: number[]
  gameTimeSeconds: number
}

export type ManualArenaCurrentSession = {
  mode: 'arena' | 'ranked' | null
  modeState: ArenaObservationState
  championKey: number | null
  gameTimeSeconds: number | null
}

export type ManualArenaPersistence = {
  load: () => ManualArenaPersistenceSnapshot | null
  save: (snapshot: ManualArenaPersistenceSnapshot) => void
  clear: () => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function uniqueKnownIds(value: unknown, knownAugmentIds: ReadonlySet<number>) {
  if (!Array.isArray(value)) return null
  const result: number[] = []
  for (const id of value) {
    if (!Number.isInteger(id)) return null
    if (knownAugmentIds.has(id) && !result.includes(id)) result.push(id)
  }
  return result
}

function sanitizeSnapshot(
  value: unknown,
  knownAugmentIds: ReadonlySet<number>,
): ManualArenaPersistenceSnapshot | null {
  if (!isRecord(value) || value.schemaVersion !== 1) return null
  if (!Number.isInteger(value.championKey) || Number(value.championKey) <= 0) return null
  if (typeof value.gameTimeSeconds !== 'number' || !Number.isFinite(value.gameTimeSeconds) || value.gameTimeSeconds < 0) {
    return null
  }

  const selected = uniqueKnownIds(value.selectedAugmentIds, knownAugmentIds)
  const candidates = uniqueKnownIds(value.candidateAugmentIds, knownAugmentIds)
  if (!selected || !candidates) return null

  const selectedAugmentIds = selected.slice(0, 4)
  const candidateAugmentIds = candidates
    .filter((id) => !selectedAugmentIds.includes(id))
    .slice(0, 3)

  return {
    schemaVersion: 1,
    championKey: Number(value.championKey),
    selectedAugmentIds,
    candidateAugmentIds,
    gameTimeSeconds: value.gameTimeSeconds,
  }
}

export function isManualArenaSnapshotCompatible(
  saved: ManualArenaPersistenceSnapshot,
  current: ManualArenaCurrentSession,
) {
  if (current.mode === 'ranked' && current.modeState === 'live') return false
  if (current.championKey !== null && saved.championKey !== current.championKey) return false
  if (current.mode !== 'arena' || current.gameTimeSeconds === null) return true
  return current.gameTimeSeconds >= saved.gameTimeSeconds - 30
}

export function createManualArenaPersistence(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  knownAugmentIds: ReadonlySet<number>,
  key = MANUAL_ARENA_STORAGE_KEY,
): ManualArenaPersistence {
  const clear = () => {
    try {
      storage.removeItem(key)
    } catch {
      // Best-effort local persistence must never block the live workflow.
    }
  }

  return {
    load() {
      let raw: string | null
      try {
        raw = storage.getItem(key)
      } catch {
        return null
      }
      if (!raw) return null

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        clear()
        return null
      }

      const snapshot = sanitizeSnapshot(parsed, knownAugmentIds)
      if (!snapshot) {
        clear()
        return null
      }

      const repaired = JSON.stringify(snapshot)
      if (repaired !== raw) {
        try {
          storage.setItem(key, repaired)
        } catch {
          // The repaired in-memory state is still usable when storage is read-only.
        }
      }
      return snapshot
    },
    save(snapshot) {
      const sanitized = sanitizeSnapshot(snapshot, knownAugmentIds)
      if (!sanitized) return
      try {
        storage.setItem(key, JSON.stringify(sanitized))
      } catch {
        // Best-effort local persistence must never block manual input.
      }
    },
    clear,
  }
}
