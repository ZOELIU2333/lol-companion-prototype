import { describe, expect, it } from 'vitest'
import { createManualArenaSessionStore } from './manualStore'

describe('manual Arena session store', () => {
  it('does not emit untouched manual fields', () => {
    const store = createManualArenaSessionStore(new Set([27, 65, 135]))

    expect(store.read().candidates).toBeUndefined()
    expect(store.read().selectedAugments).toBeUndefined()
  })

  it('validates candidate ids and duplicate slots', () => {
    const store = createManualArenaSessionStore(new Set([27, 65, 135]))

    store.setCandidateSlot(0, 27)
    expect(() => store.setCandidateSlot(1, 27)).toThrow('duplicate')
    expect(() => store.setCandidateSlot(1, 999)).toThrow('unknown')
  })

  it('stores a champion and confirmed candidate with stable ids', () => {
    const store = createManualArenaSessionStore(new Set([27, 65, 135]), () => 200)
    store.setChampion(103)
    store.setCandidateSlot(0, 27)
    store.setCandidateSlot(1, 65)
    store.setCandidateSlot(2, 135)
    store.confirmCandidate(27)

    expect(store.read()).toMatchObject({
      championKey: { value: 103, source: 'manual' },
      candidates: { value: [] },
      selectedAugments: { value: [27] },
    })
  })

  it('keeps repeated selected-history additions idempotent', () => {
    const store = createManualArenaSessionStore(new Set([27, 65, 135]))
    store.addSelectedAugment(27)
    store.addSelectedAugment(27)

    expect(store.read().selectedAugments?.value).toEqual([27])
  })

  it('resets only the current round candidates', () => {
    const store = createManualArenaSessionStore(new Set([9, 27, 65, 135]))
    store.setCandidateSlot(0, 27)
    store.setCandidateSlot(1, 65)
    store.setCandidateSlot(2, 135)
    store.confirmCandidate(65)
    store.setCandidateSlot(0, 9)
    store.setCandidateSlot(1, 27)
    store.setCandidateSlot(2, 135)
    store.resetRound()

    expect(store.read().candidates?.value).toEqual([])
    expect(store.read().selectedAugments?.value).toEqual([65])
  })

  it('edits candidate slots and confirms one candidate atomically', () => {
    const store = createManualArenaSessionStore(new Set([27, 65, 135]), () => 200)
    store.setCandidateSlot(0, 27)
    store.setCandidateSlot(1, 65)
    store.setCandidateSlot(2, 135)
    expect(store.getCandidateSlots()).toEqual([27, 65, 135])
    store.confirmCandidate(65)

    expect(store.read().selectedAugments?.value).toEqual([65])
    expect(store.read().candidates?.value).toEqual([])
  })

  it('supports direct selected-history add, undo, and full match reset', () => {
    const store = createManualArenaSessionStore(new Set([27, 65, 135]))
    store.addSelectedAugment(27)
    store.addSelectedAugment(65)
    store.removeSelectedAugment(27)
    expect(store.read().selectedAugments?.value).toEqual([65])
    store.resetMatch()
    expect(store.read().selectedAugments).toBeUndefined()
    expect(store.read().candidates).toBeUndefined()
  })

  it('rejects duplicates across selected history and candidate slots', () => {
    const store = createManualArenaSessionStore(new Set([27, 65, 135]))
    store.addSelectedAugment(27)

    expect(() => store.setCandidateSlot(0, 27)).toThrow('already selected')
    store.setCandidateSlot(0, 65)
    expect(() => store.setCandidateSlot(1, 65)).toThrow('duplicate')
  })

  it('restores a validated compact snapshot', () => {
    const store = createManualArenaSessionStore(new Set([27, 65, 135]))
    store.restore({ championKey: 103, selectedAugmentIds: [27], candidateAugmentIds: [65, 135] })

    expect(store.read()).toMatchObject({
      championKey: { value: 103 },
      selectedAugments: { value: [27] },
      candidates: { value: [65, 135] },
    })
  })
})
