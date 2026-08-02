import type { ArenaSessionPort } from './ports'
import type { ArenaObservation, PartialArenaSession } from './types'

export type ManualArenaSessionStore = {
  setChampion: (championKey: number) => void
  setCandidates: (candidateIds: number[]) => void
  selectAugment: (augmentId: number) => void
  resetRound: () => void
  read: () => PartialArenaSession
  port: ArenaSessionPort
}

function manualObservation<T>(value: T, observedAt: number): ArenaObservation<T> {
  return { value, source: 'manual', observedAt, state: 'live' }
}

export function createManualArenaSessionStore(
  knownAugmentIds: Set<number>,
  now: () => number = () => Date.now(),
): ManualArenaSessionStore {
  let championKey: ArenaObservation<number | null> | undefined
  let candidates = manualObservation<number[]>([], now())
  let selectedAugments = manualObservation<number[]>([], now())

  function read(): PartialArenaSession {
    return {
      championKey,
      candidates,
      selectedAugments,
      capabilities: { champion: 'available', candidates: 'available', selectedAugments: 'available' },
    }
  }

  const store: ManualArenaSessionStore = {
    setChampion(value) {
      if (!Number.isInteger(value) || value <= 0) throw new Error('Champion key must be a positive integer')
      championKey = manualObservation(value, now())
    },
    setCandidates(candidateIds) {
      if (candidateIds.length !== 3) throw new Error('Arena candidate confirmation requires exactly three augments')
      if (new Set(candidateIds).size !== candidateIds.length) throw new Error('Arena candidates contain a duplicate id')
      const unknown = candidateIds.find((id) => !knownAugmentIds.has(id))
      if (unknown !== undefined) throw new Error(`Arena candidates contain unknown id: ${unknown}`)
      candidates = manualObservation([...candidateIds], now())
    },
    selectAugment(augmentId) {
      if (!candidates.value.includes(augmentId)) throw new Error('Selected augment is not in the current candidates')
      selectedAugments = manualObservation([...new Set([...selectedAugments.value, augmentId])], now())
      candidates = manualObservation([], now())
    },
    resetRound() {
      candidates = manualObservation([], now())
    },
    read,
    port: {
      id: 'manual-arena-session',
      fields: ['champion', 'candidates', 'selectedAugments'],
      async read() {
        return read()
      },
    },
  }
  return store
}
