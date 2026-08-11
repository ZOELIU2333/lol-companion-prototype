import type { ArenaSessionPort } from './ports'
import type { ArenaObservation, PartialArenaSession } from './types'

export type ManualArenaSessionStore = {
  setChampion: (championKey: number) => void
  addSelectedAugment: (augmentId: number) => void
  removeSelectedAugment: (augmentId: number) => void
  setCandidateSlot: (slot: 0 | 1 | 2, augmentId: number) => void
  clearCandidateSlot: (slot: 0 | 1 | 2) => void
  confirmCandidate: (augmentId: number) => void
  restore: (snapshot: ManualArenaSnapshotInput) => void
  resetMatch: () => void
  /** Compatibility wrapper for the legacy picker until its caller is replaced. */
  setCandidates: (candidateIds: number[]) => void
  /** Compatibility wrapper for the legacy picker until its caller is replaced. */
  selectAugment: (augmentId: number) => void
  resetRound: () => void
  read: () => PartialArenaSession
  port: ArenaSessionPort
}

export type ManualArenaSnapshotInput = {
  championKey?: number
  selectedAugmentIds: number[]
  candidateAugmentIds: number[]
}

function manualObservation<T>(value: T, observedAt: number): ArenaObservation<T> {
  return { value, source: 'manual', observedAt, state: 'live' }
}

export function createManualArenaSessionStore(
  knownAugmentIds: ReadonlySet<number>,
  now: () => number = () => Date.now(),
): ManualArenaSessionStore {
  let championKey: ArenaObservation<number | null> | undefined
  let candidateSlots: [number | null, number | null, number | null] = [null, null, null]
  let selectedAugmentIds: number[] = []
  let candidatesObservedAt = 0
  let selectedObservedAt = 0
  let candidatesTouched = false
  let selectedTouched = false

  function validateAugmentId(augmentId: number) {
    if (!Number.isInteger(augmentId) || !knownAugmentIds.has(augmentId)) {
      throw new Error(`Arena augment id is unknown: ${augmentId}`)
    }
  }

  function validateSnapshot(snapshot: ManualArenaSnapshotInput) {
    if (snapshot.championKey !== undefined && (!Number.isInteger(snapshot.championKey) || snapshot.championKey <= 0)) {
      throw new Error('Champion key must be a positive integer')
    }
    if (snapshot.selectedAugmentIds.length > 4) throw new Error('Arena selected history supports at most four augments')
    if (snapshot.candidateAugmentIds.length > 3) throw new Error('Arena candidates support at most three augments')
    snapshot.selectedAugmentIds.forEach(validateAugmentId)
    snapshot.candidateAugmentIds.forEach(validateAugmentId)
    if (new Set(snapshot.selectedAugmentIds).size !== snapshot.selectedAugmentIds.length) {
      throw new Error('Arena selected history contains a duplicate id')
    }
    if (new Set(snapshot.candidateAugmentIds).size !== snapshot.candidateAugmentIds.length) {
      throw new Error('Arena candidates contain a duplicate id')
    }
    if (snapshot.candidateAugmentIds.some((id) => snapshot.selectedAugmentIds.includes(id))) {
      throw new Error('Arena candidate is already selected')
    }
  }

  function touchCandidates(observedAt = now()) {
    candidatesTouched = true
    candidatesObservedAt = observedAt
  }

  function touchSelected(observedAt = now()) {
    selectedTouched = true
    selectedObservedAt = observedAt
  }

  function read(): PartialArenaSession {
    const result: PartialArenaSession = { capabilities: {} }
    if (championKey) {
      result.championKey = championKey
      result.capabilities!.champion = 'available'
    }
    if (candidatesTouched) {
      result.candidates = manualObservation(candidateSlots.filter((id): id is number => id !== null), candidatesObservedAt)
      result.capabilities!.candidates = 'available'
    }
    if (selectedTouched) {
      result.selectedAugments = manualObservation([...selectedAugmentIds], selectedObservedAt)
      result.capabilities!.selectedAugments = 'available'
    }
    return result
  }

  const store: ManualArenaSessionStore = {
    setChampion(value) {
      if (!Number.isInteger(value) || value <= 0) throw new Error('Champion key must be a positive integer')
      championKey = manualObservation(value, now())
    },
    addSelectedAugment(augmentId) {
      validateAugmentId(augmentId)
      if (selectedAugmentIds.includes(augmentId)) return
      if (candidateSlots.includes(augmentId)) throw new Error('Arena augment is already in the current candidates')
      if (selectedAugmentIds.length >= 4) throw new Error('Arena selected history supports at most four augments')
      selectedAugmentIds = [...selectedAugmentIds, augmentId]
      touchSelected()
    },
    removeSelectedAugment(augmentId) {
      validateAugmentId(augmentId)
      selectedAugmentIds = selectedAugmentIds.filter((id) => id !== augmentId)
      touchSelected()
    },
    setCandidateSlot(slot, augmentId) {
      validateAugmentId(augmentId)
      if (selectedAugmentIds.includes(augmentId)) throw new Error('Arena augment is already selected')
      if (candidateSlots.some((id, index) => index !== slot && id === augmentId)) {
        throw new Error('Arena candidates contain a duplicate id')
      }
      candidateSlots[slot] = augmentId
      touchCandidates()
    },
    clearCandidateSlot(slot) {
      candidateSlots[slot] = null
      touchCandidates()
    },
    confirmCandidate(augmentId) {
      validateAugmentId(augmentId)
      if (!candidateSlots.includes(augmentId)) throw new Error('Selected augment is not in the current candidates')
      if (!selectedAugmentIds.includes(augmentId) && selectedAugmentIds.length >= 4) {
        throw new Error('Arena selected history supports at most four augments')
      }
      const observedAt = now()
      selectedAugmentIds = [...new Set([...selectedAugmentIds, augmentId])]
      candidateSlots = [null, null, null]
      touchSelected(observedAt)
      touchCandidates(observedAt)
    },
    restore(snapshot) {
      validateSnapshot(snapshot)
      const observedAt = now()
      championKey = snapshot.championKey === undefined ? undefined : manualObservation(snapshot.championKey, observedAt)
      selectedAugmentIds = [...snapshot.selectedAugmentIds]
      candidateSlots = [
        snapshot.candidateAugmentIds[0] ?? null,
        snapshot.candidateAugmentIds[1] ?? null,
        snapshot.candidateAugmentIds[2] ?? null,
      ]
      touchSelected(observedAt)
      touchCandidates(observedAt)
    },
    resetMatch() {
      championKey = undefined
      selectedAugmentIds = []
      candidateSlots = [null, null, null]
      selectedTouched = false
      candidatesTouched = false
      selectedObservedAt = 0
      candidatesObservedAt = 0
    },
    setCandidates(candidateIds) {
      if (candidateIds.length !== 3) throw new Error('Arena candidate confirmation requires exactly three augments')
      candidateIds.forEach(validateAugmentId)
      if (new Set(candidateIds).size !== candidateIds.length) throw new Error('Arena candidates contain a duplicate id')
      if (candidateIds.some((id) => selectedAugmentIds.includes(id))) throw new Error('Arena candidate is already selected')
      candidateSlots = [candidateIds[0], candidateIds[1], candidateIds[2]]
      touchCandidates()
    },
    selectAugment(augmentId) {
      store.confirmCandidate(augmentId)
    },
    resetRound() {
      candidateSlots = [null, null, null]
      touchCandidates()
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
