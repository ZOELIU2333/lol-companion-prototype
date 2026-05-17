import type { PlayerFilter, PlayerIntel, PlayerPartyGroup, PlayerRecentMatch, TeamSide } from '../types'
import type { RecentMatchSummary } from './riotApiAdapter'

export type SharedMatchRecord = {
  id: string
  team: TeamSide
  playerIds: string[]
  won: boolean
}

export function createDemoRecentMatches(player: PlayerIntel, count = 10): PlayerRecentMatch[] {
  const champions = ['伊泽瑞尔', '阿狸', '卡莎', '盲僧', '泰坦']
  const baseDeaths = Math.max(1, Math.round(player.averageDeaths))

  return Array.from({ length: count }, (_, index) => {
    const won = (player.score + index * 7) % 10 >= 4
    const kills = Math.max(1, Math.round(player.kda * 2.1) + (won ? index : -index))
    const deaths = Math.max(1, baseDeaths + (won ? -1 : 1) + (index % 2))
    const assists = Math.max(3, Math.round(player.killParticipation / 9) + index)

    return {
      id: `${player.id}-history-${index}`,
      champion: champions[(player.name.length + index) % champions.length],
      result: won ? '胜' : '负',
      mode: index % 2 === 0 ? '单双排' : '灵活排位',
      time: `${index + 1} 场前`,
      kda: `${kills}/${deaths}/${assists}`,
      cs: Math.max(4.2, player.csPerMin + (won ? 0.2 : -0.4) - index * 0.1).toFixed(1),
      kp: Math.max(28, player.killParticipation + (won ? 3 : -5) - index),
      score: Math.max(48, Math.min(96, player.score + (won ? 3 : -5) - index * 2)),
    }
  })
}

export function mapRecentMatchesToPlayerRows(matches: RecentMatchSummary[]): PlayerRecentMatch[] {
  return matches.map((match, index) => ({
    id: match.id,
    champion: match.championName,
    result: match.result === 'win' ? '胜' : '负',
    mode: match.queue,
    time: `${index + 1} 场前`,
    kda: match.kda,
    cs: match.csPerMin.toFixed(1),
    kp: match.killParticipation,
    score: match.score,
  }))
}

const demoPartyRoles = {
  ally: [
    { roles: ['下路', '辅助'], games: 18, winRate: 67, color: 'cyan' },
    { roles: ['打野', '中路'], games: 12, winRate: 58, color: 'amber' },
  ],
  enemy: [
    { roles: ['上单', '打野', '中路'], games: 21, winRate: 62, color: 'rose' },
    { roles: ['下路', '辅助'], games: 15, winRate: 53, color: 'violet' },
  ],
} satisfies Record<PlayerFilter, { roles: string[]; games: number; winRate: number; color: PlayerPartyGroup['color'] }[]>

export function createDemoPartyGroups(players: PlayerIntel[], team: PlayerFilter): PlayerPartyGroup[] {
  return demoPartyRoles[team]
    .map((party, index) => {
      const playerIds = party.roles
        .map((role) => players.find((player) => player.team === team && player.role === role)?.id)
        .filter((id): id is string => Boolean(id))

      return {
        id: `${team}-party-${index}`,
        team,
        playerIds,
        games: party.games,
        winRate: party.winRate,
        color: party.color,
      }
    })
    .filter((party) => party.playerIds.length > 1)
}

const partyColors: PlayerPartyGroup['color'][] = ['cyan', 'amber', 'rose', 'violet']

export function inferPartyGroups(records: SharedMatchRecord[], team: TeamSide, minSharedGames = 3): PlayerPartyGroup[] {
  const pairStats = new Map<string, { playerIds: [string, string]; games: number; wins: number }>()

  records
    .filter((record) => record.team === team)
    .forEach((record) => {
      const uniqueIds = Array.from(new Set(record.playerIds)).sort()
      for (let left = 0; left < uniqueIds.length; left += 1) {
        for (let right = left + 1; right < uniqueIds.length; right += 1) {
          const playerIds: [string, string] = [uniqueIds[left], uniqueIds[right]]
          const key = playerIds.join('::')
          const current = pairStats.get(key) ?? { playerIds, games: 0, wins: 0 }
          current.games += 1
          current.wins += record.won ? 1 : 0
          pairStats.set(key, current)
        }
      }
    })

  const qualifiedPairs = Array.from(pairStats.values()).filter((pair) => pair.games >= minSharedGames)
  const groups: Set<string>[] = []

  qualifiedPairs.forEach((pair) => {
    const existingGroups = groups.filter((group) => pair.playerIds.some((playerId) => group.has(playerId)))
    if (existingGroups.length === 0) {
      groups.push(new Set(pair.playerIds))
      return
    }

    const merged = new Set(pair.playerIds)
    existingGroups.forEach((group) => {
      group.forEach((playerId) => merged.add(playerId))
      groups.splice(groups.indexOf(group), 1)
    })
    groups.push(merged)
  })

  return groups.map((group, index) => {
    const playerIds = Array.from(group)
    const matchingRecords = records.filter(
      (record) => record.team === team && playerIds.every((playerId) => record.playerIds.includes(playerId)),
    )
    const wins = matchingRecords.filter((record) => record.won).length

    return {
      id: `${team}-inferred-party-${index}`,
      team,
      playerIds,
      games: matchingRecords.length,
      winRate: matchingRecords.length > 0 ? Math.round((wins / matchingRecords.length) * 100) : 0,
      color: partyColors[index % partyColors.length],
    }
  })
}
