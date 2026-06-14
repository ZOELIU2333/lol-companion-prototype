import { describe, expect, it } from 'vitest'
import type { MayhemSnapshot } from './snapshot'
import { rankMayhemCandidates } from './scoring'

const snapshot: MayhemSnapshot = {
  schemaVersion: 1,
  queue: 'aram-mayhem',
  patch: '26.12',
  generatedAt: '2026-06-14T00:00:00.000Z',
  expiresAt: '2026-06-15T12:00:00.000Z',
  completeness: 0.9,
  officialCoverage: 1,
  sources: [
    { sourceId: 'metasrc', kind: 'aggregate', status: 'online' },
    { sourceId: 'opgg', kind: 'aggregate', status: 'online' },
  ],
  augments: [
    { id: 21, name: 'Prismatic Pick', rarity: 'prismatic' },
    { id: 22, name: 'Gold Pick', rarity: 'gold' },
    { id: 23, name: 'Silver Pick', rarity: 'silver' },
  ],
  recommendations: {
    strength: [
      {
        augmentId: 21,
        score: 90,
        winRate: 58,
        games: 2400,
        pickRate: 18,
        sourceCount: 2,
        confidence: 'high',
        observing: false,
        evidenceType: 'aggregate',
        sources: ['metasrc', 'opgg'],
        sourceUrls: [],
      },
      {
        augmentId: 22,
        score: 70,
        winRate: 53,
        games: 900,
        pickRate: 9,
        sourceCount: 1,
        confidence: 'medium',
        observing: false,
        evidenceType: 'aggregate',
        sources: ['metasrc'],
        sourceUrls: [],
      },
    ],
    offMeta: [
      {
        augmentId: 23,
        score: 65,
        winRate: 54,
        games: 700,
        pickRate: 4,
        sourceCount: 2,
        confidence: 'medium',
        observing: false,
        evidenceType: 'aggregate',
        sources: ['metasrc', 'opgg'],
        sourceUrls: [],
      },
    ],
  },
}

const input = {
  championId: 103,
  selectedAugmentIds: [11],
  candidateAugmentIds: [21, 22, 23],
  snapshot,
}

describe('rankMayhemCandidates', () => {
  it('ranks only the three current candidates', () => {
    const ranked = rankMayhemCandidates({
      mode: 'strength',
      championId: 103,
      selectedAugmentIds: [11],
      candidateAugmentIds: [21, 22, 23],
      snapshot,
    })
    expect(ranked.map((entry) => entry.augmentId).sort()).toEqual([21, 22, 23])
  })

  it('uses a different weighting model for off-meta mode', () => {
    const strength = rankMayhemCandidates({ ...input, mode: 'strength' })
    const offMeta = rankMayhemCandidates({ ...input, mode: 'off-meta' })
    expect(strength.map((entry) => entry.augmentId)).not.toEqual(offMeta.map((entry) => entry.augmentId))
    // Strength prizes the prismatic, high-win-rate pick; off-meta prizes the low-pick-rate sleeper.
    expect(strength[0].augmentId).toBe(21)
    expect(offMeta[0].augmentId).toBe(23)
  })

  it('returns the full evidence shape on every entry', () => {
    const ranked = rankMayhemCandidates({ ...input, mode: 'strength' })
    for (const entry of ranked) {
      expect(entry).toHaveProperty('scoreBreakdown')
      expect(entry).toHaveProperty('games')
      expect(entry).toHaveProperty('sourceCount')
      expect(entry).toHaveProperty('confidence')
      expect(entry).toHaveProperty('reason')
      expect(Array.isArray(entry.itemIds)).toBe(true)
    }
  })

  it('surfaces zeros and lowest confidence honestly when stats are missing', () => {
    const ranked = rankMayhemCandidates({
      mode: 'strength',
      championId: 103,
      selectedAugmentIds: [],
      candidateAugmentIds: [21, 22, 23],
      snapshot: { ...snapshot, recommendations: { strength: [], offMeta: [] } },
    })
    for (const entry of ranked) {
      expect(entry.games).toBe(0)
      expect(entry.sourceCount).toBe(0)
      expect(entry.confidence).toBe('low')
      expect(entry.scoreBreakdown.normalizedWinRate).toBe(0)
    }
    // championFit / rarity still produce a stable, non-arbitrary order
    expect(ranked.map((entry) => entry.augmentId)).toEqual([21, 22, 23])
  })
})
