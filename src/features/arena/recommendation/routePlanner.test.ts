import { describe, expect, it } from 'vitest'
import { planArenaRoutes } from './routePlanner'
import type { ArenaRouteInput, ArenaRoutePathInput } from './types'
import type { EvidenceRecord, MechanismEdge } from '../graph/types'

const verified: EvidenceRecord = {
  kind: 'mechanism-verified', claim: '已核对触发关系。', reviewedAt: '2026-08-01T00:00:00.000Z',
}
const theory: EvidenceRecord = { kind: 'theoretical', claim: '仅为理论推导。' }
const current: EvidenceRecord = {
  kind: 'current-statistics', claim: '当前补丁样本。', patch: '16.15', sampleSize: 1200,
  collectedAt: '2026-08-01T00:00:00.000Z', metric: 'top2-rate', value: 0.54,
  sourceUrl: 'https://example.com/arena/stats',
}

function edge(from: string, to: string, relation: MechanismEdge['relation'], evidence = [verified]): MechanismEdge {
  return { from, to, relation, evidence, weight: 1, explanation: `${from} ${relation} ${to}` }
}

function path(overrides: Partial<ArenaRoutePathInput> & Pick<ArenaRoutePathInput, 'id' | 'augmentApiName'>): ArenaRoutePathInput {
  return {
    source: 'current-candidate',
    augmentName: overrides.augmentApiName,
    completedItemIds: [4629],
    edges: [edge('champion:103', `augment:${overrides.augmentApiName}`, 'triggers')],
    missingNodes: [],
    championFit: 7,
    selectedSynergy: 6,
    immediateValue: 7,
    contextValue: 6,
    novelty: 3,
    risk: 2,
    ...overrides,
  }
}

const ahriFixture: ArenaRouteInput = {
  patch: '16.15',
  now: new Date('2026-08-03T00:00:00.000Z'),
  candidates: [
    path({ id: 'stable-earthwake', augmentApiName: 'Earthwake', completedItemIds: [4629, 3157], immediateValue: 10, risk: 1, edges: [edge('champion:103', 'augment:Earthwake', 'triggers', [verified, current])] }),
    path({ id: 'ceiling-spellwake', augmentApiName: 'Spellwake', completedItemIds: [6655, 4645], championFit: 9, immediateValue: 5, novelty: 5, edges: [
      edge('champion:103', 'augment:Spellwake', 'triggers'),
      edge('augment:Spellwake', 'item:6655', 'amplifies'),
      edge('item:6655', 'champion:103', 'loops'),
    ] }),
    path({ id: 'offmeta-earthwake', augmentApiName: 'Earthwake', completedItemIds: [3115, 3006], championFit: 5, immediateValue: 4, novelty: 10, risk: 5, edges: [
      edge('champion:103', 'augment:Earthwake', 'triggers'),
      edge('augment:Earthwake', 'item:3115', 'converts'),
    ] }),
    path({ id: 'theory-only', augmentApiName: 'PhenomenalEvil', completedItemIds: [3071], novelty: 10, edges: [
      edge('champion:103', 'augment:PhenomenalEvil', 'amplifies', [theory]),
    ] }),
  ],
}

describe('Arena route planner', () => {
  it('produces three distinct route objectives for Ahri candidates', () => {
    const result = planArenaRoutes(ahriFixture)

    expect(result.routes.map((route) => route.kind)).toEqual(['stable', 'ceiling', 'off-meta'])
    expect(new Set(result.routes.map((route) => route.coreSignature)).size).toBe(3)
  })

  it('derives total and explanation from identical components', () => {
    const candidate = planArenaRoutes(ahriFixture).routes[0].candidates[0]

    expect(candidate.total).toBe(candidate.components.reduce((sum, part) => sum + part.points, 0))
    expect(candidate.explanation).toContain(candidate.components[0].label)
  })

  it('preserves route provenance through scoring', () => {
    const candidate = planArenaRoutes(ahriFixture).routes[0].candidates[0]

    expect(candidate.source).toBe('current-candidate')
  })

  it('uses deterministic candidate ids to break exact ties', () => {
    const tie = path({ id: 'a-route', augmentApiName: 'A' })
    const result = planArenaRoutes({ ...ahriFixture, candidates: [{ ...tie, id: 'b-route' }, tie] })

    expect(result.routes[0].candidates[0].id).toBe('a-route')
  })

  it('marks a route unavailable when no credible distinct signature remains', () => {
    const only = path({ id: 'only', augmentApiName: 'Earthwake' })
    const result = planArenaRoutes({ ...ahriFixture, candidates: [only] })

    expect(result.routes[1]).toMatchObject({ alternativeUnavailable: true, candidates: [] })
    expect(result.routes[2]).toMatchObject({ alternativeUnavailable: true, candidates: [] })
  })

  it('rejects a theory-only off-meta route', () => {
    const theoryOnly = path({
      id: 'theory', augmentApiName: 'Theory', novelty: 10,
      edges: [edge('champion:103', 'augment:Theory', 'amplifies', [theory])],
    })
    const result = planArenaRoutes({ ...ahriFixture, candidates: [theoryOnly] })

    expect(result.routes.find((route) => route.kind === 'off-meta')?.alternativeUnavailable).toBe(true)
  })

  it('excludes stale statistics from evidence value', () => {
    const stale = path({
      id: 'stale', augmentApiName: 'Stale', edges: [edge('champion:103', 'augment:Stale', 'triggers', [{
        ...current, patch: '16.14', collectedAt: '2026-05-01T00:00:00.000Z',
      }])],
    })
    const result = planArenaRoutes({ ...ahriFixture, candidates: [stale] })
    const evidencePart = result.routes[0].candidates[0].components.find((part) => part.key === 'evidenceValue')

    expect(evidencePart?.raw).toBe(0)
  })

  it('rewards a two-to-three-step completed loop for ceiling routes', () => {
    const result = planArenaRoutes(ahriFixture)

    expect(result.routes.find((route) => route.kind === 'ceiling')?.candidates[0].id).toBe('ceiling-spellwake')
  })

  it('applies a conflict edge as a risk penalty', () => {
    const conflicted = path({
      id: 'conflict', augmentApiName: 'Conflict', risk: 0,
      edges: [edge('champion:103', 'augment:Conflict', 'conflicts', [verified])],
    })
    const result = planArenaRoutes({ ...ahriFixture, candidates: [conflicted] })
    const penalty = result.routes[0].candidates[0].components.find((part) => part.key === 'riskPenalty')

    expect(penalty?.points).toBeLessThan(0)
  })
})
