import { describe, expect, it } from 'vitest'
import { createManualArenaSessionStore } from './manualStore'

describe('manual Arena session store', () => {
  it('requires exactly three unique candidates', () => {
    const store = createManualArenaSessionStore(new Set([27, 65, 135]))

    expect(() => store.setCandidates([27, 65])).toThrow('exactly three')
    expect(() => store.setCandidates([27, 27, 65])).toThrow('duplicate')
    expect(() => store.setCandidates([27, 65, 999])).toThrow('unknown')
  })

  it('stores a champion and confirmed candidate with stable ids', () => {
    const store = createManualArenaSessionStore(new Set([27, 65, 135]), () => 200)
    store.setChampion(103)
    store.setCandidates([27, 65, 135])
    store.selectAugment(27)

    expect(store.read()).toMatchObject({
      championKey: { value: 103, source: 'manual' },
      candidates: { value: [] },
      selectedAugments: { value: [27] },
    })
  })

  it('deduplicates selected history across rounds', () => {
    const store = createManualArenaSessionStore(new Set([27, 65, 135]))
    store.setCandidates([27, 65, 135])
    store.selectAugment(27)
    store.setCandidates([27, 65, 135])
    store.selectAugment(27)

    expect(store.read().selectedAugments?.value).toEqual([27])
  })

  it('resets only the current round candidates', () => {
    const store = createManualArenaSessionStore(new Set([27, 65, 135]))
    store.setCandidates([27, 65, 135])
    store.selectAugment(65)
    store.setCandidates([27, 65, 135])
    store.resetRound()

    expect(store.read().candidates?.value).toEqual([])
    expect(store.read().selectedAugments?.value).toEqual([65])
  })
})
