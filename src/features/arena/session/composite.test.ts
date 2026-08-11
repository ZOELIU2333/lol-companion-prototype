import { describe, expect, it } from 'vitest'
import { createCompositeArenaSession } from './composite'
import type { ArenaSessionPort } from './ports'

const live = <T>(value: T, observedAt: number, source: 'manual' | 'lcu' | 'live-client' = 'manual') => ({
  value, observedAt, source, state: 'live' as const,
})

describe('composite Arena session', () => {
  it('reports candidate discovery as unsupported without treating it as empty', async () => {
    const manualCandidateIds = [27, 65, 135]
    const ports: ArenaSessionPort[] = [
      {
        id: 'manual', fields: ['candidates'],
        read: async () => ({ candidates: live(manualCandidateIds, 100) }),
      },
      {
        id: 'lcu', fields: ['candidates'],
        read: async () => ({
          candidates: { value: [], source: 'lcu', observedAt: 200, state: 'unsupported' },
          capabilities: { candidates: 'unsupported' },
        }),
      },
    ]
    const session = await createCompositeArenaSession(ports).read(new AbortController().signal)

    expect(session.capabilities.candidates).toBe('unsupported')
    expect(session.candidates.value).toEqual(manualCandidateIds)
  })

  it('isolates one source failure and keeps successful fields', async () => {
    const ports: ArenaSessionPort[] = [
      { id: 'broken-lcu', fields: ['champion'], read: async () => { throw new Error('LCU offline') } },
      { id: 'live', fields: ['gold'], read: async () => ({ gold: live(1680, 200, 'live-client') }) },
    ]
    const session = await createCompositeArenaSession(ports).read(new AbortController().signal)

    expect(session.gold.value).toBe(1680)
    expect(session.capabilities.champion).toBe('error')
  })

  it('bounds a stalled adapter with its timeout', async () => {
    const ports: ArenaSessionPort[] = [{
      id: 'stalled', fields: ['items'], timeoutMs: 5,
      read: async () => new Promise(() => undefined),
    }]
    const session = await createCompositeArenaSession(ports).read(new AbortController().signal)

    expect(session.capabilities.items).toBe('error')
  })
})
