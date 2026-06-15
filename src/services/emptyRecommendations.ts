import type { RecommendationViewModel } from '../types'

const unavailableItem = {
  id: 'unavailable',
  iconId: 0,
  name: '',
  category: 'utility' as const,
  tags: [],
}

export const emptyRecommendations: RecommendationViewModel = {
  build: {
    score: 0,
    title: '',
    coreItems: [],
    situationalItems: [],
    loadouts: [],
    stages: [],
    counterPlans: [],
    warnings: [],
    explanation: '',
    pivots: [],
  },
  runes: [],
  augments: [],
  arena: {
    priority: '',
    threats: [],
    upgrades: [],
    roundPlan: [],
    matchupRules: [],
    strategy: '',
  },
  live: {
    nextItem: unavailableItem,
    tacticalRead: '',
    nextTwoMinutes: [],
    augmentContext: {
      selected: [],
      bestCandidate: '',
      reason: '',
      comboScore: 0,
      itemPlan: {
        id: 'unavailable',
        label: '',
        score: 0,
        items: [],
      },
    },
  },
}
