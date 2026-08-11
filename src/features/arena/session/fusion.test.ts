import { describe, expect, it } from 'vitest'
import { classifyArenaChange, createEmptyArenaSession, mergeArenaSession } from './fusion'
import type { ArenaObservation, PartialArenaSession } from './types'

const observation = <T>(value: T, observedAt: number, source: ArenaObservation<T>['source'] = 'manual'): ArenaObservation<T> => ({
  value, observedAt, source, state: 'live',
})

function manualCandidatesAt(observedAt: number): PartialArenaSession {
  return { candidates: observation([27, 65, 135], observedAt) }
}

function automaticCandidatesUnavailableAt(observedAt: number): PartialArenaSession {
  return {
    candidates: { value: [], source: 'lcu', observedAt, state: 'unsupported' },
    capabilities: { candidates: 'unsupported' },
  }
}

describe('Arena session fusion', () => {
  it('does not replace a newer manual candidate set with missing automatic data', () => {
    const manual = mergeArenaSession(createEmptyArenaSession(), manualCandidatesAt(200))
    const merged = mergeArenaSession(manual, automaticCandidatesUnavailableAt(300))

    expect(merged.candidates.value).toHaveLength(3)
    expect(merged.candidates.source).toBe('manual')
    expect(merged.capabilities.candidates).toBe('unsupported')
  })

  it('keeps touched manual facts when a newer automatic source reports values', () => {
    const manual = mergeArenaSession(createEmptyArenaSession(), {
      candidates: observation([27, 65, 135], 100, 'manual'),
    })
    const merged = mergeArenaSession(manual, {
      candidates: observation([9, 10, 11], 200, 'lcu'),
    })

    expect(merged.candidates.value).toEqual([27, 65, 135])
    expect(merged.candidates.source).toBe('manual')
  })

  it('clears round candidates but keeps selected augments', () => {
    const roundOne = mergeArenaSession(createEmptyArenaSession(), {
      round: observation(1, 100, 'lcu'),
      candidates: observation([27, 65, 135], 110),
      selectedAugments: observation([27], 120),
    })
    const next = mergeArenaSession(roundOne, { round: observation(2, 400, 'lcu') })

    expect(next.candidates.value).toEqual([])
    expect(next.selectedAugments.value).toEqual(roundOne.selectedAugments.value)
  })

  it('accepts newer valid automatic values and rejects older observations', () => {
    const current = mergeArenaSession(createEmptyArenaSession(), { gold: observation(1200, 200, 'lcu') })
    const automatic = mergeArenaSession(current, { gold: observation(1680, 300, 'live-client') })
    const staleArrival = mergeArenaSession(automatic, { gold: observation(900, 250, 'live-client') })

    expect(automatic.gold).toMatchObject({ value: 1680, source: 'live-client' })
    expect(staleArrival.gold.value).toBe(1680)
  })

  it('preserves stale labels as valid provenance', () => {
    const merged = mergeArenaSession(createEmptyArenaSession(), {
      championKey: { value: 103, source: 'lcu', observedAt: 200, state: 'stale' },
    })

    expect(merged.championKey).toMatchObject({ value: 103, state: 'stale' })
  })

  it('distinguishes an unsupported source from a confirmed empty round', () => {
    const unsupported = mergeArenaSession(createEmptyArenaSession(), automaticCandidatesUnavailableAt(100))
    const empty = mergeArenaSession(createEmptyArenaSession(), {
      candidates: observation([], 100, 'lcu'), capabilities: { candidates: 'available' },
    })

    expect(unsupported.capabilities.candidates).toBe('unsupported')
    expect(empty.capabilities.candidates).toBe('available')
  })

  it('classifies completed items separately from gold-only changes', () => {
    const before = mergeArenaSession(createEmptyArenaSession(), {
      gold: observation(500, 100, 'live-client'),
      itemIds: observation([3108], 100, 'live-client'),
    })
    const goldOnly = mergeArenaSession(before, { gold: observation(900, 200, 'live-client') })
    const completed = mergeArenaSession(goldOnly, { itemIds: observation([4629], 300, 'live-client') })

    expect(classifyArenaChange(before, goldOnly)).toEqual(['gold-changed', 'purchase-input-changed'])
    expect(classifyArenaChange(goldOnly, completed)).toEqual(expect.arrayContaining([
      'items-changed', 'completed-item', 'route-input-changed',
    ]))
  })

  it('marks augment selection as route and notification relevant', () => {
    const before = createEmptyArenaSession()
    const after = mergeArenaSession(before, { selectedAugments: observation([27], 200) })

    expect(classifyArenaChange(before, after)).toEqual(expect.arrayContaining([
      'selected-augments-changed', 'route-input-changed', 'notification-relevant',
    ]))
  })
})
