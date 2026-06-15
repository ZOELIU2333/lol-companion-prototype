import { mockMatches } from '../data/mockMatches'
import type { GameMode } from '../types'
import type { CompanionDataSource } from './companionDataSource'

const visibleMatches = () => mockMatches.filter((match) => match.mode !== 'arena')

function findClosestMatch(mode: Exclude<GameMode, 'arena'>) {
  return visibleMatches().find((match) => match.mode === mode) ?? visibleMatches()[0]
}

export const mockCompanionDataSource: CompanionDataSource = {
  async detectSession() {
    const match = findClosestMatch('ranked')

    return {
      matchId: match.id,
      mode: match.mode === 'arena' ? 'ranked' : match.mode,
      source: 'mock',
    }
  },

  listMatches() {
    return visibleMatches()
  },

  getMatch(matchId) {
    return visibleMatches().find((match) => match.id === matchId) ?? null
  },
}
