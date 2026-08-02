import { mockMatches } from '../data/mockMatches'
import type { GameMode, Match, PlayerIntel, PlayerRiotAccount } from '../types'
import type { LcuAdapter, LcuGamePhase, LcuPlayerSnapshot } from './lcuAdapter'

export type DetectedGameSession = {
  matchId: string
  mode: GameMode
  phase?: LcuGamePhase
  players?: LcuPlayerSnapshot[]
  source: 'mock' | 'lcu'
}

export type CompanionDataSource = {
  detectSession: () => Promise<DetectedGameSession | null>
  listMatches: () => Match[]
  getMatch: (matchId: string) => Match | null
}

const visibleMatches = () => mockMatches

function findClosestMatch(mode: GameMode) {
  return visibleMatches().find((match) => match.mode === mode) ?? visibleMatches()[0]
}

function createRiotAccountFromLcu(player: LcuPlayerSnapshot): PlayerRiotAccount | undefined {
  const account = player.riotAccount
  if (!account?.gameName && !account?.puuid) return undefined

  return {
    gameName: account.gameName ?? player.summonerName ?? player.id,
    puuid: account.puuid,
    region: (import.meta.env.VITE_RIOT_DEFAULT_REGION ?? 'asia') as PlayerRiotAccount['region'],
    platform: import.meta.env.VITE_RIOT_DEFAULT_PLATFORM as PlayerRiotAccount['platform'],
    tagLine: account.tagLine,
  }
}

function findPlayerSlot(players: PlayerIntel[], lcuPlayer: LcuPlayerSnapshot, usedIds: Set<string>) {
  const roleMatch = players.find(
    (player) => !usedIds.has(player.id) && player.team === lcuPlayer.team && player.role === lcuPlayer.role,
  )
  if (roleMatch) return roleMatch

  return players.find((player) => !usedIds.has(player.id) && player.team === lcuPlayer.team)
}

export function applyLcuPlayersToMatch(match: Match, lcuPlayers: LcuPlayerSnapshot[] = []): Match {
  if (lcuPlayers.length === 0) return match

  const usedIds = new Set<string>()
  const lcuByMockPlayerId = new Map<string, LcuPlayerSnapshot>()

  lcuPlayers.forEach((lcuPlayer) => {
    const slot = findPlayerSlot(match.players, lcuPlayer, usedIds)
    if (!slot) return

    usedIds.add(slot.id)
    lcuByMockPlayerId.set(slot.id, lcuPlayer)
  })

  if (lcuByMockPlayerId.size === 0) return match

  return {
    ...match,
    players: match.players.map((player) => {
      const lcuPlayer = lcuByMockPlayerId.get(player.id)
      if (!lcuPlayer) return player

      return {
        ...player,
        name: lcuPlayer.summonerName ?? lcuPlayer.riotAccount?.gameName ?? player.name,
        riotAccount: createRiotAccountFromLcu(lcuPlayer) ?? player.riotAccount,
      }
    }),
  }
}

export const mockCompanionDataSource: CompanionDataSource = {
  async detectSession() {
    const match = findClosestMatch('ranked')

    return {
      matchId: match.id,
      mode: match.mode,
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

export function createCompanionDataSource(lcuAdapter: LcuAdapter, fallback: CompanionDataSource = mockCompanionDataSource): CompanionDataSource {
  return {
    async detectSession() {
      const session = await lcuAdapter.readSession()
      if (!session) return fallback.detectSession()

      const mode = session.mode ?? 'ranked'
      const match = findClosestMatch(mode)
      if (!match) return fallback.detectSession()

      return {
        matchId: match.id,
        mode,
        phase: session.phase,
        players: session.players ?? [],
        source: 'lcu',
      }
    },

    listMatches() {
      return fallback.listMatches()
    },

    getMatch(matchId) {
      return fallback.getMatch(matchId)
    },
  }
}

export const dataSourceRoadmap = {
  lcu: [
    'Detect League client and current game phase.',
    'Read local summoner and session context.',
    'Use local state to decide when the overlay switches between pregame and live augment views.',
  ],
  riotApi: [
    'Fetch ranked entries, recent match history, match details, and timelines.',
    'Derive player intel from public historical metrics only.',
    'Replace mock recent-match expansion with real recent matches.',
  ],
  dataDragon: [
    'Cache champion, item, rune, summoner spell, and localized metadata.',
    'Keep icon paths versioned so build and rune pages match the current patch.',
  ],
} as const
