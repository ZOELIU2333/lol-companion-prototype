import type { PlayerMatchDetail, PlayerRecentMatch, PlayerRiotAccount } from '../types'

export type OpggMcpHost = {
  endpoint?: string
  fetchJson: <T>(url: string, init?: { body?: string; headers?: Record<string, string>; method?: string }) => Promise<T | null>
}

export type OpggMcpRiotAccount = Pick<PlayerRiotAccount, 'gameName' | 'tagLine'> & {
  region: string
}

export type OpggMcpChampionPoolEntry = {
  championName: string
  games: number
  winRate: number
  kda: number
  opScore: number
}

export type OpggMcpPlayerProfile = {
  gameName: string
  tagLine: string
  puuid: string
  level: number
  profileImageUrl: string
  rank: string
  rankedGames: number
  rankedWinRate: number
  championPoolTop3: OpggMcpChampionPoolEntry[]
  source: 'opgg-mcp'
}

type JsonRpcResponse = {
  error?: {
    code: number
    message: string
  }
  result?: {
    content?: {
      text?: string
      type: string
    }[]
  }
}

type ParsedProfile = {
  data: {
    summoner: {
      gameName: string
      tagLine: string
      puuid: string
      level: number
      profileImageUrl: string
      leagueStats: {
        gameType: string
        lose: number | null
        tierInfo: {
          division: number | null
          lp: number | null
          tier: string | null
        }
        win: number | null
      }[]
      rankedMostChampions: {
        myChampionStats: {
          basic: {
            assist: number
            cs: number
            death: number
            kill: number
            opScore: number
          }
          championName: string
          lose: number
          play: number
          win: number
        }[]
      }
    }
  }
}

type ParsedMatchHistory = {
  data: {
    gameHistory: {
      createdAt: string
      gameLengthSecond: number
      gameType: string
      id: string
      participants: {
        championName: string
        stats: {
          assist: number
          death: number
          kill: number
          minionKill: number
          neutralMinionKill: number
          opScore: number
          result: 'WIN' | 'LOSE' | 'UNKNOWN'
        }
      }[]
    }[]
  }
}

type ParsedGameDetail = {
  data: {
    gameDetail: {
      createdAt: string
      gameLengthSecond: number
      gameType: string
      id: string
      teams: {
        gameStat: {
          baronKill: number
          championKill: number
          dragonKill: number
          goldEarned: number
          isWin: boolean
          towerKill: number
        }
        participants: {
          championName: string
          items: number[]
          itemsNames: string[]
          position: string
          stats: {
            assist: number
            death: number
            kill: number
            opScore: number
            totalDamageDealtToChampions: number
            visionWardsBoughtInGame: number
            wardPlace: number
          }
          summoner: {
            gameName: string
            puuid: string
            tagLine: string
          }
          teamKey: 'BLUE' | 'RED'
        }[]
      }[]
    }
  }
}

const defaultEndpoint = 'https://mcp-api.op.gg/mcp'
const profileFields = [
  'data.summoner.{game_name,tagline,puuid,level,profile_image_url}',
  'data.summoner.league_stats[].tier_info.{division,lp,tier}',
  'data.summoner.league_stats[].{game_type,win,lose}',
  'data.summoner.ranked_most_champions.my_champion_stats[].{champion_name,play,win,lose}',
  'data.summoner.ranked_most_champions.my_champion_stats[].basic.{kill,death,assist,cs,op_score}',
]
const matchFields = [
  'data.game_history[].participants[].stats.{assist,death,kill,minion_kill,neutral_minion_kill,op_score,result}',
  'data.game_history[].participants[].{champion_name}',
  'data.game_history[].{created_at,game_length_second,game_type,id}',
]
const gameDetailFields = [
  'data.game_detail.teams[].game_stat.{baron_kill,champion_kill,dragon_kill,gold_earned,is_win,tower_kill}',
  'data.game_detail.teams[].participants[].stats.{assist,death,kill,op_score,total_damage_dealt_to_champions,vision_wards_bought_in_game,ward_place}',
  'data.game_detail.teams[].participants[].summoner.{game_name,puuid,tagline}',
  'data.game_detail.teams[].participants[].{champion_name,items[],items_names[],position,team_key}',
  'data.game_detail.{created_at,game_length_second,game_type,id}',
]

function TierInfo(division: number | null, lp: number | null, tier: string | null) {
  return { division, lp, tier }
}

function LeagueStat(tierInfo: ReturnType<typeof TierInfo>, gameType: string, win: number | null, lose: number | null) {
  return { gameType, lose, tierInfo, win }
}

function Basic(kill: number, death: number, assist: number, cs: number, _killParticipation: number, _visionScore: number, _damageParticipation: number, opScore: number) {
  return { assist, cs, death, kill, opScore }
}

function MyChampionStat(championName: string, play: number, win: number, lose: number, basic: ReturnType<typeof Basic>) {
  return { basic, championName, lose, play, win }
}

function Stats(assist: number, death: number, kill: number, minionKill: number, neutralMinionKill: number, opScore: number, result: 'WIN' | 'LOSE' | 'UNKNOWN') {
  return { assist, death, kill, minionKill, neutralMinionKill, opScore, result }
}

function GameDetailStats(
  assist: number,
  death: number,
  kill: number,
  opScore: number,
  totalDamageDealtToChampions: number,
  visionWardsBoughtInGame: number,
  wardPlace: number,
) {
  return { assist, death, kill, opScore, totalDamageDealtToChampions, visionWardsBoughtInGame, wardPlace }
}

function parseTextPayload<T>(text: string, expressionName: string, helpers: Record<string, (...args: never[]) => unknown>) {
  const startIndex = text.indexOf(`${expressionName}(`)
  const expression = startIndex >= 0 ? text.slice(startIndex) : ''
  if (!expression) throw new Error(`OP.GG MCP response did not include ${expressionName}`)

  const names = Object.keys(helpers)
  const parse = new Function(...names, `return ${expression}`) as (...args: ((...args: never[]) => unknown)[]) => T
  return parse(...Object.values(helpers))
}

function parseProfileText(text: string): ParsedProfile {
  return parseTextPayload<ParsedProfile>(text, 'LolGetSummonerProfile', {
    Basic,
    Data: (summoner) => ({ summoner }),
    LeagueStat,
    LolGetSummonerProfile: (data) => ({ data }),
    MyChampionStat,
    RankedMostChampions: (myChampionStats) => ({ myChampionStats }),
    Summoner: (
      gameName,
      tagLine,
      puuid,
      level,
      profileImageUrl,
      leagueStats,
      rankedMostChampions,
    ) => ({
      gameName,
      tagLine,
      puuid,
      level,
      profileImageUrl,
      leagueStats,
      rankedMostChampions,
    }),
    TierInfo,
  } as Record<string, (...args: never[]) => unknown>)
}

function parseMatchesText(text: string): ParsedMatchHistory {
  return parseTextPayload<ParsedMatchHistory>(text, 'LolListSummonerMatches', {
    Data: (gameHistory) => ({ gameHistory }),
    GameHistory: (participants, createdAt, gameLengthSecond, gameType, id) => ({
      createdAt,
      gameLengthSecond,
      gameType,
      id,
      participants,
    }),
    LolListSummonerMatches: (data) => ({ data }),
    Participant: (stats, championName) => ({ championName, stats }),
    Stats,
  } as Record<string, (...args: never[]) => unknown>)
}

function parseGameDetailText(text: string): ParsedGameDetail {
  return parseTextPayload<ParsedGameDetail>(text, 'LolGetSummonerGameDetail', {
    Data: (gameDetail) => ({ gameDetail }),
    GameDetail: (teams, createdAt, gameLengthSecond, gameType, id) => ({
      createdAt,
      gameLengthSecond,
      gameType,
      id,
      teams,
    }),
    GameStat: (baronKill, championKill, dragonKill, goldEarned, isWin, towerKill) => ({
      baronKill,
      championKill,
      dragonKill,
      goldEarned,
      isWin,
      towerKill,
    }),
    LolGetSummonerGameDetail: (data) => ({ data }),
    Participant: (stats, summoner, championName, items, itemsNames, position, teamKey) => ({
      championName,
      items,
      itemsNames,
      position,
      stats,
      summoner,
      teamKey,
    }),
    Stats: GameDetailStats,
    Summoner: (gameName, puuid, tagLine) => ({ gameName, puuid, tagLine }),
    Team: (gameStat, participants) => ({ gameStat, participants }),
  } as Record<string, (...args: never[]) => unknown>)
}

function formatRank(tier?: string | null, division?: number | null, lp?: number | null) {
  if (!tier) return '未查询到排位'
  const tierLabels: Record<string, string> = {
    BRONZE: '青铜',
    CHALLENGER: '王者',
    DIAMOND: '钻石',
    EMERALD: '翡翠',
    GOLD: '黄金',
    GRANDMASTER: '宗师',
    IRON: '黑铁',
    MASTER: '大师',
    PLATINUM: '铂金',
    SILVER: '白银',
  }
  const rankSuffix = division ? ` ${division}` : ''
  const lpSuffix = typeof lp === 'number' ? ` ${lp}LP` : ''
  return `${tierLabels[tier] ?? tier}${rankSuffix}${lpSuffix}`
}

function mapProfile(parsed: ParsedProfile): OpggMcpPlayerProfile {
  const summoner = parsed.data.summoner
  const soloRank = summoner.leagueStats.find((entry) => entry.gameType === 'SOLORANKED') ?? summoner.leagueStats[0]
  const rankedGames = (soloRank?.win ?? 0) + (soloRank?.lose ?? 0)
  const rankedWinRate = rankedGames > 0 ? Math.round(((soloRank?.win ?? 0) / rankedGames) * 100) : 0

  return {
    championPoolTop3: summoner.rankedMostChampions.myChampionStats.slice(0, 3).map((entry) => ({
      championName: entry.championName,
      games: entry.play,
      kda: Number(((entry.basic.kill + entry.basic.assist) / Math.max(1, entry.basic.death)).toFixed(1)),
      opScore: Number(entry.basic.opScore.toFixed(1)),
      winRate: entry.play > 0 ? Math.round((entry.win / entry.play) * 100) : 0,
    })),
    gameName: summoner.gameName,
    level: summoner.level,
    profileImageUrl: summoner.profileImageUrl,
    puuid: summoner.puuid,
    rank: formatRank(soloRank?.tierInfo.tier, soloRank?.tierInfo.division, soloRank?.tierInfo.lp),
    rankedGames,
    rankedWinRate,
    source: 'opgg-mcp',
    tagLine: summoner.tagLine,
  }
}

function mapMatchHistory(parsed: ParsedMatchHistory): PlayerRecentMatch[] {
  return parsed.data.gameHistory.map((match, index) => {
    const participant = match.participants[0]
    const stats = participant.stats
    const minutes = match.gameLengthSecond > 0 ? match.gameLengthSecond / 60 : 1

    return {
      champion: participant.championName,
      createdAt: match.createdAt,
      cs: ((stats.minionKill + stats.neutralMinionKill) / minutes).toFixed(1),
      id: match.id,
      kda: `${stats.kill}/${stats.death}/${stats.assist}`,
      kp: 0,
      mode: match.gameType === 'SOLORANKED' ? '单双排' : match.gameType,
      result: stats.result === 'WIN' ? '胜' : '负',
      score: Math.max(45, Math.min(96, Math.round(stats.opScore * 10))),
      time: `${index + 1} 场前`,
    }
  })
}

function mapGameDetail(parsed: ParsedGameDetail): PlayerMatchDetail {
  const detail = parsed.data.gameDetail

  return {
    createdAt: detail.createdAt,
    durationSeconds: detail.gameLengthSecond,
    gameType: detail.gameType,
    id: detail.id,
    source: 'opgg-mcp',
    teams: detail.teams.map((team) => ({
      barons: team.gameStat.baronKill,
      dragons: team.gameStat.dragonKill,
      gold: team.gameStat.goldEarned,
      isWin: team.gameStat.isWin,
      key: team.participants[0]?.teamKey ?? 'BLUE',
      kills: team.gameStat.championKill,
      participants: team.participants.map((participant) => ({
        assist: participant.stats.assist,
        championName: participant.championName,
        damage: participant.stats.totalDamageDealtToChampions,
        death: participant.stats.death,
        items: participant.items.map((id, index) => ({
          id,
          name: String(participant.itemsNames[index] ?? id),
        })),
        kill: participant.stats.kill,
        opScore: participant.stats.opScore,
        position: participant.position,
        summonerName: participant.summoner.gameName,
        tagLine: participant.summoner.tagLine,
        vision: participant.stats.wardPlace + participant.stats.visionWardsBoughtInGame,
      })),
      towers: team.gameStat.towerKill,
    })),
  }
}

async function callTool(host: OpggMcpHost, name: string, args: Record<string, unknown>) {
  const response = await host.fetchJson<JsonRpcResponse>(host.endpoint ?? defaultEndpoint, {
    body: JSON.stringify({
      id: name,
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        arguments: args,
        name,
      },
    }),
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  if (!response || response.error) return null
  return response.result?.content?.find((part) => part.type === 'text')?.text ?? null
}

export function createOpggMcpAdapter(host: OpggMcpHost) {
  return {
    async getPlayerProfile(account: OpggMcpRiotAccount): Promise<OpggMcpPlayerProfile | null> {
      if (!account.tagLine) return null
      const text = await callTool(host, 'lol_get_summoner_profile', {
        desired_output_fields: profileFields,
        game_name: account.gameName,
        lang: 'zh_CN',
        region: account.region,
        tag_line: account.tagLine,
      })
      if (!text) return null
      return mapProfile(parseProfileText(text))
    },

    async getRecentMatches(account: OpggMcpRiotAccount, limit = 10): Promise<PlayerRecentMatch[]> {
      if (!account.tagLine) return []
      const text = await callTool(host, 'lol_list_summoner_matches', {
        desired_output_fields: matchFields,
        game_name: account.gameName,
        lang: 'zh_CN',
        limit: Math.max(5, Math.min(20, limit)),
        region: account.region,
        tag_line: account.tagLine,
      })
      if (!text) return []
      return mapMatchHistory(parseMatchesText(text)).slice(0, limit)
    },

    async getMatchDetail(account: OpggMcpRiotAccount, match: PlayerRecentMatch): Promise<PlayerMatchDetail | null> {
      if (!account.tagLine || !match.createdAt) return null
      const text = await callTool(host, 'lol_get_summoner_game_detail', {
        created_at: match.createdAt,
        desired_output_fields: gameDetailFields,
        game_id: match.id,
        lang: 'zh_CN',
        region: account.region,
      })
      if (!text) return null
      return mapGameDetail(parseGameDetailText(text))
    },
  }
}

export const fetchOpggMcpHost: OpggMcpHost = {
  async fetchJson(url, init) {
    const response = await fetch(url, init)
    if (!response.ok) return null
    return response.json()
  },
}
