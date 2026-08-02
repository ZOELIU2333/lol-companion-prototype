import { describe, expect, it } from 'vitest'
import { collectArenaEvidence, type ArenaEvidenceContext, type ArenaEvidenceProvider } from './evidenceProvider'
import type { EvidenceRecord } from './types'

const now = new Date('2026-08-03T00:00:00.000Z')
const context: ArenaEvidenceContext = { patch: '16.15', championKey: '103', augmentApiNames: ['Earthwake'], itemIds: [4629] }

function provider(id: string, records: EvidenceRecord[]): ArenaEvidenceProvider {
  return { id, read: async () => records }
}

const reviewed: EvidenceRecord = {
  kind: 'mechanism-verified',
  claim: '阿狸位移会触发大地苏醒。',
  reviewedAt: '2026-08-01T00:00:00.000Z',
}

describe('Arena evidence providers', () => {
  it('excludes statistics without patch and collection metadata', async () => {
    const unqualified = { kind: 'current-statistics', claim: '胜率更高。' } as EvidenceRecord
    const snapshot = await collectArenaEvidence([provider('bad-stats', [unqualified])], context, now)

    expect(snapshot.records).toEqual([])
    expect(snapshot.health[0].status).toBe('rejected')
  })

  it('keeps mechanism evidence when statistical providers fail', async () => {
    const failing: ArenaEvidenceProvider = { id: 'failed-stats', read: async () => { throw new Error('offline') } }
    const snapshot = await collectArenaEvidence([failing, provider('reviewed', [reviewed])], context, now)

    expect(snapshot.records.map((record) => record.kind)).toContain('mechanism-verified')
    expect(snapshot.health).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'failed-stats', status: 'failed' }),
      expect.objectContaining({ id: 'reviewed', status: 'healthy' }),
    ]))
  })

  it('accepts qualified current-patch statistics and rejects an older patch', async () => {
    const statistic = (patch: string): EvidenceRecord => ({
      kind: 'current-statistics', claim: '前二率样本。', patch, sampleSize: 1000,
      collectedAt: '2026-08-01T00:00:00.000Z', metric: 'top2-rate', value: 0.53,
      sourceUrl: 'https://example.com/arena/sample',
    })
    const snapshot = await collectArenaEvidence([
      provider('current', [statistic('16.15.1')]),
      provider('old', [statistic('16.14')]),
    ], context, now)

    expect(snapshot.records).toHaveLength(1)
    expect(snapshot.records[0]).toMatchObject({ kind: 'current-statistics', patch: '16.15.1' })
    expect(snapshot.health.find((entry) => entry.id === 'old')?.status).toBe('rejected')
  })

  it('validates community sample URLs and reproducible claims', async () => {
    const snapshot = await collectArenaEvidence([provider('community', [{
      kind: 'community-sample',
      claim: '公开页面列出该组合与出装顺序。',
      collectedAt: '2026-08-01T00:00:00.000Z',
      sourceUrl: 'https://example.com/arena/build',
    }])], context, now)

    expect(snapshot.records).toHaveLength(1)
    expect(snapshot.records[0].kind).toBe('community-sample')
  })

  it('isolates provider timeouts', async () => {
    const stalled: ArenaEvidenceProvider = {
      id: 'stalled',
      timeoutMs: 5,
      read: async () => new Promise(() => undefined),
    }
    const snapshot = await collectArenaEvidence([stalled, provider('reviewed', [reviewed])], context, now)

    expect(snapshot.health.find((entry) => entry.id === 'stalled')?.status).toBe('timeout')
    expect(snapshot.records).toContainEqual(reviewed)
  })

  it('collapses duplicate evidence from multiple providers', async () => {
    const snapshot = await collectArenaEvidence([
      provider('one', [reviewed]),
      provider('two', [reviewed]),
    ], context, now)

    expect(snapshot.records).toEqual([reviewed])
  })
})
