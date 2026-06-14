import { describe, expect, it } from 'vitest'
import official from '../../../data/mayhem/26.12/official-augments.json'
import type { MayhemSourceRecord } from './types'
import {
  aggregateMayhemRecords,
  buildValidatedMayhemSnapshot,
  type AggregateInput,
} from './snapshot'

function record(overrides: Partial<MayhemSourceRecord> = {}): MayhemSourceRecord {
  return {
    sourceId: 'metasrc',
    sourceUrl: 'https://example.test',
    collectedAt: '2026-06-14T00:00:00.000Z',
    patch: '26.12',
    queue: 'aram-mayhem',
    population: 'all-ranks',
    locale: 'en_us',
    championId: null,
    selectedAugmentIds: [],
    candidateAugmentId: 101,
    itemIds: [],
    games: 1000,
    wins: 600,
    winRate: 55,
    pickRate: 10,
    sourceConfidence: 0.8,
    evidenceType: 'aggregate',
    ...overrides,
  }
}

describe('Mayhem snapshot validation', () => {
  it('rejects Arena and old-patch records', () => {
    const result = buildValidatedMayhemSnapshot({
      patch: '26.12',
      officialAugmentIds: [101],
      records: [
        { sourceId: 'a', patch: '26.11', queue: 'aram-mayhem', candidateAugmentId: 101, games: 900 },
        { sourceId: 'b', patch: '26.12', queue: 'arena', candidateAugmentId: 101, games: 900 },
      ],
    })

    expect(result.records).toHaveLength(0)
    expect(result.rejected).toHaveLength(2)
  })

  it('keeps a 500-game off-meta record and rejects 499 games', () => {
    const result = buildValidatedMayhemSnapshot({
      patch: '26.12',
      officialAugmentIds: [101, 102],
      records: [
        { sourceId: 'a', patch: '26.12', queue: 'aram-mayhem', candidateAugmentId: 101, games: 499 },
        { sourceId: 'b', patch: '26.12', queue: 'aram-mayhem', candidateAugmentId: 102, games: 500 },
      ],
    })

    expect(result.offMetaRecords.map((record) => record.candidateAugmentId)).toEqual([102])
  })

  it('contains only patch 26.12 Mayhem augments with unique ids', () => {
    expect(official.meta.patch).toBe('26.12')
    expect(official.meta.queue).toBe('aram-mayhem')
    expect(official.augments.length).toBeGreaterThan(0)
    expect(new Set(official.augments.map((augment) => augment.id)).size).toBe(official.augments.length)
    expect(official.augments.every((augment) => augment.name && augment.iconUrl)).toBe(true)
  })

  it('deduplicates records and lowers confidence on source conflict', () => {
    const snapshot = aggregateMayhemRecords({
      patch: '26.12',
      officialAugmentIds: [101],
      records: [
        record({ sourceId: 'metasrc', candidateAugmentId: 101, games: 1000, winRate: 60 }),
        record({ sourceId: 'metasrc', candidateAugmentId: 101, games: 1000, winRate: 60 }),
        record({ sourceId: 'opgg', candidateAugmentId: 101, games: 1000, winRate: 45 }),
      ],
    })

    expect(snapshot.recommendations.strength[0].sourceCount).toBe(2)
    expect(snapshot.recommendations.strength[0].confidence).toBe('low')
  })

  it('gates off-meta to high-sample low-pick above-baseline aggregate records only', () => {
    const snapshot = aggregateMayhemRecords({
      patch: '26.12',
      officialAugmentIds: [101, 102, 103, 104],
      baselineWinRate: 50,
      records: [
        // qualifies: aggregate, 600 games, pickRate 8 <= 15, winRate 55 > 50
        record({ sourceId: 'metasrc', candidateAugmentId: 101, games: 600, pickRate: 8, winRate: 55 }),
        // fails games gate (499)
        record({ sourceId: 'metasrc', candidateAugmentId: 102, games: 499, pickRate: 8, winRate: 55 }),
        // fails pickRate gate (20 > 15)
        record({ sourceId: 'metasrc', candidateAugmentId: 103, games: 600, pickRate: 20, winRate: 55 }),
        // fails winRate gate (49 <= 50)
        record({ sourceId: 'metasrc', candidateAugmentId: 104, games: 600, pickRate: 8, winRate: 49 }),
      ],
    })

    expect(snapshot.recommendations.offMeta.map((rec) => rec.augmentId)).toEqual([101])
  })

  it('never lists community-candidate records as off-meta recommendations', () => {
    const snapshot = aggregateMayhemRecords({
      patch: '26.12',
      officialAugmentIds: [101],
      records: [
        record({
          sourceId: 'community',
          candidateAugmentId: 101,
          evidenceType: 'community-candidate',
          games: null,
          winRate: null,
          pickRate: null,
          sourceConfidence: 0.3,
        }),
      ],
    })

    expect(snapshot.recommendations.strength).toHaveLength(0)
    expect(snapshot.recommendations.offMeta).toHaveLength(0)
  })
})

describe('Mayhem aggregation JS mirror parity', () => {
  const fixtures: AggregateInput[] = [
    {
      patch: '26.12',
      officialAugmentIds: [101, 102, 103],
      baselineWinRate: 50,
      generatedAt: '2026-06-14T00:00:00.000Z',
      records: [
        record({ sourceId: 'metasrc', candidateAugmentId: 101, games: 1000, winRate: 60, pickRate: 8 }),
        record({ sourceId: 'metasrc', candidateAugmentId: 101, games: 1000, winRate: 60, pickRate: 8 }),
        record({ sourceId: 'opgg', candidateAugmentId: 101, games: 800, winRate: 45, pickRate: 9 }),
        record({ sourceId: 'metasrc', candidateAugmentId: 102, games: 600, winRate: 55, pickRate: 7 }),
        record({ sourceId: 'opgg', candidateAugmentId: 103, games: 300, winRate: 52, pickRate: 12 }),
      ],
      augments: [{ id: 101, name: 'A' }, { id: 102, name: 'B' }, { id: 103, name: 'C' }],
      sources: [
        { sourceId: 'metasrc', kind: 'aggregate', status: 'online' },
        { sourceId: 'opgg', kind: 'aggregate', status: 'offline' },
      ],
    },
  ]

  it('produces identical output to scripts/mayhem/aggregate.mjs', async () => {
    const jsModule = await import('../../../scripts/mayhem/aggregate.mjs')
    for (const fixture of fixtures) {
      const tsResult = aggregateMayhemRecords(fixture)
      const jsResult = jsModule.aggregateMayhemRecords(fixture)
      expect(jsResult).toEqual(tsResult)
    }
  })
})
