import { describe, expect, it } from 'vitest'
import { buildValidatedMayhemSnapshot } from './snapshot'

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
})
