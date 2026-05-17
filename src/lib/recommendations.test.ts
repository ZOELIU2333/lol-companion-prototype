import { describe, expect, it } from 'vitest'
import { mockMatches } from '../data/mockMatches'
import { createBuildRecommendation, createRecommendations, rankAugments } from './recommendations'

const match = mockMatches[0]
const champion = match.champions.find((candidate) => candidate.id === match.currentChampionId)!

describe('recommendation rules', () => {
  it('adds magic resist advice into AP-heavy games', () => {
    const result = createBuildRecommendation(match, champion)

    expect(result.situationalItems.some((item) => item.tags.includes('magic-resist'))).toBe(true)
    expect(result.warnings.some((warning) => warning.includes('AP'))).toBe(true)
  })

  it('adds tenacity advice into crowd-control-heavy games', () => {
    const result = createBuildRecommendation(match, champion)

    expect(result.situationalItems.some((item) => item.tags.includes('tenacity'))).toBe(true)
    expect(result.warnings.some((warning) => warning.includes('控制'))).toBe(true)
  })

  it('adds penetration advice into tank-heavy games', () => {
    const result = createBuildRecommendation(match, champion)

    expect(result.situationalItems.some((item) => item.tags.includes('tank-counter'))).toBe(true)
    expect(result.warnings.some((warning) => warning.includes('前排'))).toBe(true)
  })

  it('raises augment scores when tags match the champion', () => {
    const ranked = rankAugments(match, champion)

    expect(ranked[0].score).toBeGreaterThan(ranked[ranked.length - 1].score)
    expect(ranked[0].synergy).toContain('契合')
  })

  it('uses previously selected augments when ranking hex candidates', () => {
    const augmentMatch = mockMatches.find((candidate) => candidate.mode === 'augment')!
    const augmentChampion = augmentMatch.champions.find((candidate) => candidate.id === augmentMatch.currentChampionId)!
    const ranked = rankAugments(augmentMatch, augmentChampion)

    expect(ranked[0].selectedSynergyScore).toBeGreaterThan(0)
    expect(ranked[0].selectedSynergy).toContain('已选')
  })

  it('creates an augment-aware item icon plan for live hex recommendations', () => {
    const augmentMatch = mockMatches.find((candidate) => candidate.mode === 'augment')!
    const recommendations = createRecommendations(augmentMatch, 'augment')

    expect(recommendations.live.augmentContext.itemPlan.items.length).toBeGreaterThan(0)
    expect(recommendations.live.augmentContext.itemPlan.score).toBeGreaterThan(0)
    expect(recommendations.live.nextTwoMinutes.join('')).not.toContain(recommendations.live.nextItem.name)
  })
})
