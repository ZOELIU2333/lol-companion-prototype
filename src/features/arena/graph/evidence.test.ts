import { describe, expect, it } from 'vitest'
import { canRecommendOffMeta, evidenceConfidence } from './evidence'
import type { MechanismEdge } from './types'

function edge(evidence: MechanismEdge['evidence']): MechanismEdge {
  return {
    from: 'champion:103',
    to: 'augment:Earthwake',
    relation: 'triggers',
    weight: 1,
    explanation: '位移会触发大地苏醒。',
    evidence,
  }
}

describe('Arena mechanism evidence', () => {
  it('rejects an off-meta chain supported only by theory', () => {
    expect(canRecommendOffMeta([edge([{ kind: 'theoretical', claim: '可能形成联动。' }])])).toBe(false)
  })

  it('accepts a chain with reviewed mechanism evidence', () => {
    expect(canRecommendOffMeta([edge([{
      kind: 'mechanism-verified',
      claim: '位移触发伤害轨迹。',
      reviewedAt: '2026-08-03T00:00:00.000Z',
    }])])).toBe(true)
  })

  it('grades mixed current and reviewed evidence higher than a single weak source', () => {
    expect(evidenceConfidence([{ kind: 'theoretical', claim: '理论路线。' }])).toBe('low')
    expect(evidenceConfidence([{
      kind: 'mechanism-verified',
      claim: '已核对机制。',
      reviewedAt: '2026-08-03T00:00:00.000Z',
    }])).toBe('medium')
    expect(evidenceConfidence([
      { kind: 'mechanism-verified', claim: '已核对机制。', reviewedAt: '2026-08-03T00:00:00.000Z' },
      {
        kind: 'current-statistics',
        claim: '当前版本样本。',
        patch: '16.15',
        sampleSize: 1200,
        collectedAt: '2026-08-03T00:00:00.000Z',
        metric: 'top2-rate',
        value: 0.54,
        sourceUrl: 'https://example.com/sample',
      },
    ])).toBe('high')
  })
})
