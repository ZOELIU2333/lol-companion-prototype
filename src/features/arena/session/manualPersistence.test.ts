import { beforeEach, describe, expect, it } from 'vitest'
import {
  createManualArenaPersistence,
  isManualArenaSnapshotCompatible,
  type ManualArenaPersistenceSnapshot,
} from './manualPersistence'

const storageKey = 'lol-companion:arena-manual:v1'
const records = new Map<string, string>()
const storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
  getItem(key) {
    return records.get(key) ?? null
  },
  setItem(key, value) {
    records.set(key, value)
  },
  removeItem(key) {
    records.delete(key)
  },
}
const knownAugmentIds = new Set([27, 65, 135, 199, 225])

function snapshot(overrides: Partial<ManualArenaPersistenceSnapshot> = {}): ManualArenaPersistenceSnapshot {
  return {
    schemaVersion: 1,
    championKey: 103,
    selectedAugmentIds: [27],
    candidateAugmentIds: [65, 135],
    gameTimeSeconds: 300,
    ...overrides,
  }
}

describe('manual Arena persistence', () => {
  beforeEach(() => records.clear())

  it('repairs unknown and duplicate augment ids while retaining valid state', () => {
    records.set(storageKey, JSON.stringify(snapshot({
      selectedAugmentIds: [27, 999, 27, 199, 225, 65],
      candidateAugmentIds: [65, 135, 999, 135, 27],
    })))
    const persistence = createManualArenaPersistence(storage, knownAugmentIds)

    expect(persistence.load()).toMatchObject({
      selectedAugmentIds: [27, 199, 225, 65],
      candidateAugmentIds: [135],
    })
    expect(JSON.parse(records.get(storageKey) ?? '{}')).toMatchObject({
      selectedAugmentIds: [27, 199, 225, 65],
      candidateAugmentIds: [135],
    })
  })

  it('clears malformed JSON and unsupported schema versions', () => {
    const persistence = createManualArenaPersistence(storage, knownAugmentIds)
    records.set(storageKey, '{broken')
    expect(persistence.load()).toBeNull()
    expect(records.has(storageKey)).toBe(false)

    records.set(storageKey, JSON.stringify({ ...snapshot(), schemaVersion: 2 }))
    expect(persistence.load()).toBeNull()
    expect(records.has(storageKey)).toBe(false)
  })

  it('saves and clears a valid snapshot', () => {
    const persistence = createManualArenaPersistence(storage, knownAugmentIds)
    persistence.save(snapshot())

    expect(persistence.load()).toEqual(snapshot())
    persistence.clear()
    expect(persistence.load()).toBeNull()
  })

  it('contains storage access failures', () => {
    const brokenStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
      getItem() { throw new Error('blocked') },
      setItem() { throw new Error('blocked') },
      removeItem() { throw new Error('blocked') },
    }
    const persistence = createManualArenaPersistence(brokenStorage, knownAugmentIds)

    expect(persistence.load()).toBeNull()
    expect(() => persistence.save(snapshot())).not.toThrow()
    expect(() => persistence.clear()).not.toThrow()
  })

  it('rejects a clearly restarted match but tolerates reconnect drift', () => {
    const saved = snapshot({ championKey: 103, gameTimeSeconds: 300 })

    expect(isManualArenaSnapshotCompatible(saved, {
      championKey: 103,
      gameTimeSeconds: 280,
      mode: 'arena',
      modeState: 'live',
    })).toBe(true)
    expect(isManualArenaSnapshotCompatible(saved, {
      championKey: 103,
      gameTimeSeconds: 200,
      mode: 'arena',
      modeState: 'live',
    })).toBe(false)
  })

  it('rejects a different champion and a fresh non-Arena mode', () => {
    const saved = snapshot()

    expect(isManualArenaSnapshotCompatible(saved, {
      championKey: 81,
      gameTimeSeconds: 310,
      mode: 'arena',
      modeState: 'live',
    })).toBe(false)
    expect(isManualArenaSnapshotCompatible(saved, {
      championKey: 103,
      gameTimeSeconds: 0,
      mode: 'ranked',
      modeState: 'live',
    })).toBe(false)
  })

  it('preserves state while mode or game time is unavailable or stale', () => {
    const saved = snapshot()

    expect(isManualArenaSnapshotCompatible(saved, {
      championKey: null,
      gameTimeSeconds: null,
      mode: null,
      modeState: 'unavailable',
    })).toBe(true)
    expect(isManualArenaSnapshotCompatible(saved, {
      championKey: 103,
      gameTimeSeconds: 0,
      mode: 'ranked',
      modeState: 'stale',
    })).toBe(true)
  })
})
