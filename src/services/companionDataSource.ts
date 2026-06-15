import type { GameMode, Match, PlayerIntel, PlayerRiotAccount } from '../types'
import type { LcuAdapter, LcuGamePhase, LcuPlayerSnapshot } from './lcuAdapter'

export type DetectedGameSession = {
  matchId: string | null
  mode: Exclude<GameMode, 'arena'> | null
  phase?: LcuGamePhase
  queueId?: number
  localSummonerName?: string
  players?: LcuPlayerSnapshot[]
  playerSource?: 'champ-select' | 'gameflow'
  source: 'mock' | 'lcu'
}

export type CompanionDataSource = {
  detectSession: () => Promise<DetectedGameSession | null>
  listMatches: () => Match[]
  getMatch: (matchId: string) => Match | null
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

export function applyLcuPlayersToMatch(
  match: Match,
  lcuPlayers: LcuPlayerSnapshot[] = [],
  preserveUnmatchedPlayers = true,
): Match {
  if (lcuPlayers.length === 0) {
    return preserveUnmatchedPlayers ? match : { ...match, players: [] }
  }

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
    players: match.players.flatMap((player) => {
      const lcuPlayer = lcuByMockPlayerId.get(player.id)
      if (!lcuPlayer) return preserveUnmatchedPlayers ? [player] : []

      return [{
        ...player,
        name: lcuPlayer.summonerName ?? lcuPlayer.riotAccount?.gameName ?? player.name,
        riotAccount: createRiotAccountFromLcu(lcuPlayer) ?? player.riotAccount,
      }]
    }),
  }
}

export function createCompanionDataSource(lcuAdapter: LcuAdapter, fallback: CompanionDataSource | null = null): CompanionDataSource {
  return {
    async detectSession() {
      const session = await lcuAdapter.readSession()
      if (!session) return fallback?.detectSession() ?? null

      const mode = session.mode

      return {
        matchId: mode ? `lcu-${session.queueId ?? mode}` : null,
        mode,
        phase: session.phase,
        queueId: session.queueId,
        localSummonerName: session.localSummonerName,
        players: session.players ?? [],
        playerSource: session.playerSource,
        source: 'lcu',
      }
    },

    listMatches() {
      return fallback?.listMatches() ?? []
    },

    getMatch(matchId) {
      return fallback?.getMatch(matchId) ?? null
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
