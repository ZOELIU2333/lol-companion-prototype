import type { PlayerIntel } from '../types'

export type RiotRegion = 'americas' | 'asia' | 'europe' | 'sea'
export type RiotPlatformRegion =
  | 'br1'
  | 'eun1'
  | 'euw1'
  | 'jp1'
  | 'kr'
  | 'la1'
  | 'la2'
  | 'me1'
  | 'na1'
  | 'oc1'
  | 'ru'
  | 'sg2'
  | 'tr1'
  | 'tw2'
  | 'vn2'

export type RiotAccountRef = {
  gameName: string
  puuid?: string
  region: RiotRegion
  platform?: RiotPlatformRegion
  tagLine?: string
}

export type RecentMatchSummary = {
  id: string
  championName: string
  result: 'win' | 'loss'
  queue: string
  kda: string
  csPerMin: number
  killParticipation: number
  score: number
}

export type RiotMasteryChampion = {
  championId: number
  mastery: number
  level: number
}

export type RiotPlayerProfile = {
  puuid: string
  rank: string
  rankedGames: number
  rankedWinRate: number
  recentWinRate: number
  averageKda: number
  averageDeaths: number
  csPerMin: number
  killParticipation: number
  damageShare: number
  visionScore: number
  score: number
  masteryTop3: RiotMasteryChampion[]
  source: 'riot-api'
}

export type RiotApiHost = {
  apiKey?: string
  baseUrl?: string
  fetchJson: <T>(url: string, init?: { headers?: Record<string, string> }) => Promise<T | null>
}

export type RiotApiAdapter = {
  getPlayerIntel: (account: RiotAccountRef) => Promise<PlayerIntel | null>
  getPlayerProfile: (account: RiotAccountRef, count?: number) => Promise<RiotPlayerProfile | null>
  getRecentMatches: (account: RiotAccountRef, count: number) => Promise<RecentMatchSummary[]>
}

type RiotAccountDto = {
  puuid: string
  gameName: string
  tagLine: string
}

type RiotMatchDto = {
  metadata: {
    matchId: string
    participants: string[]
  }
  info: {
    gameCreation: number
    queueId: number
    participants: RiotMatchParticipantDto[]
  }
}

type RiotMatchParticipantDto = {
  puuid: string
  teamId: number
  riotIdGameName?: string
  riotIdTagline?: string
  summonerName?: string
  championName: string
  win: boolean
  kills: number
  deaths: number
  assists: number
  totalMinionsKilled: number
  neutralMinionsKilled: number
  totalDamageDealtToChampions?: number
  visionScore?: number
  timePlayed: number
  challenges?: {
    killParticipation?: number
  }
}

type RiotSummonerDto = {
  id: string
  puuid: string
}

type RiotLeagueEntryDto = {
  queueType: string
  tier: string
  rank: string
  leaguePoints: number
  wins: number
  losses: number
}

type RiotChampionMasteryDto = {
  championId: number
  championLevel: number
  championPoints: number
}

const queueLabels: Record<number, string> = {
  420: '单双排',
  430: '匹配',
  440: '灵活排位',
  450: '极地大乱斗',
  1700: '斗魂竞技场',
}

function authHeaders(apiKey?: string) {
  return apiKey ? { 'X-Riot-Token': apiKey } : undefined
}

function riotApiUrl(region: RiotRegion | RiotPlatformRegion, path: string, host?: RiotApiHost) {
  if (host?.baseUrl) {
    return `${host.baseUrl.replace(/\/$/, '')}/${region}${path}`
  }

  return `https://${region}.api.riotgames.com${path}`
}

async function resolveAccount(host: RiotApiHost, account: RiotAccountRef) {
  if (account.puuid) return account.puuid
  if (!account.tagLine) return null

  const gameName = encodeURIComponent(account.gameName)
  const tagLine = encodeURIComponent(account.tagLine)
  const payload = await host.fetchJson<RiotAccountDto>(
    riotApiUrl(account.region, `/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`, host),
    { headers: authHeaders(host.apiKey) },
  )

  return payload?.puuid ?? null
}

async function fetchRecentMatchDetails(host: RiotApiHost, account: RiotAccountRef, count: number) {
  const puuid = await resolveAccount(host, account)
  if (!puuid) return null

  const safeCount = Math.max(1, Math.min(count, 20))
  const matchIds = await host.fetchJson<string[]>(
    riotApiUrl(
      account.region,
      `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=${safeCount}`,
      host,
    ),
    { headers: authHeaders(host.apiKey) },
  )
  if (!matchIds?.length) return { puuid, matches: [] }

  const matchDetails = await Promise.all(
    matchIds.map((matchId) =>
      host.fetchJson<RiotMatchDto>(riotApiUrl(account.region, `/lol/match/v5/matches/${encodeURIComponent(matchId)}`, host), {
        headers: authHeaders(host.apiKey),
      }),
    ),
  )

  return {
    puuid,
    matches: matchDetails.filter((match): match is RiotMatchDto => Boolean(match)),
  }
}

function scoreParticipant(participant: RiotMatchParticipantDto) {
  const deaths = Math.max(1, participant.deaths)
  const kda = (participant.kills + participant.assists) / deaths
  const csPerMin =
    participant.timePlayed > 0
      ? ((participant.totalMinionsKilled + participant.neutralMinionsKilled) / participant.timePlayed) * 60
      : 0
  const killParticipation = Math.round((participant.challenges?.killParticipation ?? 0) * 100)
  const rawScore = 48 + (participant.win ? 12 : 0) + kda * 6 + csPerMin * 2 + killParticipation * 0.12

  return Math.max(45, Math.min(96, Math.round(rawScore)))
}

function mapMatchSummary(match: RiotMatchDto, puuid: string): RecentMatchSummary | null {
  const participant = match.info.participants.find((entry) => entry.puuid === puuid)
  if (!participant) return null

  const minions = participant.totalMinionsKilled + participant.neutralMinionsKilled
  const csPerMin = participant.timePlayed > 0 ? (minions / participant.timePlayed) * 60 : 0

  return {
    id: match.metadata.matchId,
    championName: participant.championName,
    result: participant.win ? 'win' : 'loss',
    queue: queueLabels[match.info.queueId] ?? `队列 ${match.info.queueId}`,
    kda: `${participant.kills}/${participant.deaths}/${participant.assists}`,
    csPerMin: Number(csPerMin.toFixed(1)),
    killParticipation: Math.round((participant.challenges?.killParticipation ?? 0) * 100),
    score: scoreParticipant(participant),
  }
}

function formatLeagueRank(entry: RiotLeagueEntryDto | undefined) {
  if (!entry) return '未查询到排位'
  const tierLabels: Record<string, string> = {
    IRON: '黑铁',
    BRONZE: '青铜',
    SILVER: '白银',
    GOLD: '黄金',
    PLATINUM: '铂金',
    EMERALD: '翡翠',
    DIAMOND: '钻石',
    MASTER: '大师',
    GRANDMASTER: '宗师',
    CHALLENGER: '王者',
  }
  return `${tierLabels[entry.tier] ?? entry.tier} ${entry.rank} ${entry.leaguePoints}LP`
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function createProfileFromMatches(
  puuid: string,
  matches: RiotMatchDto[],
  leagueEntry?: RiotLeagueEntryDto,
  masteryTop3: RiotMasteryChampion[] = [],
): RiotPlayerProfile {
  const participants = matches
    .map((match) => {
      const participant = match.info.participants.find((entry) => entry.puuid === puuid)
      if (!participant) return null

      const teamDamage = match.info.participants
        .filter((entry) => entry.teamId === participant.teamId)
        .reduce((sum, entry) => sum + (entry.totalDamageDealtToChampions ?? 0), 0)

      return {
        participant,
        damageShare:
          teamDamage > 0 ? ((participant.totalDamageDealtToChampions ?? 0) / teamDamage) * 100 : 0,
      }
    })
    .filter((entry): entry is { participant: RiotMatchParticipantDto; damageShare: number } => Boolean(entry))

  const winRate =
    participants.length > 0
      ? Math.round((participants.filter(({ participant }) => participant.win).length / participants.length) * 100)
      : 0
  const kdas = participants.map(({ participant }) => (participant.kills + participant.assists) / Math.max(1, participant.deaths))
  const csPerMinute = participants.map(({ participant }) => {
    const minions = participant.totalMinionsKilled + participant.neutralMinionsKilled
    return participant.timePlayed > 0 ? (minions / participant.timePlayed) * 60 : 0
  })
  const killParticipations = participants.map(({ participant }) => (participant.challenges?.killParticipation ?? 0) * 100)
  const rankedGames = leagueEntry ? leagueEntry.wins + leagueEntry.losses : 0
  const rankedWinRate = rankedGames > 0 && leagueEntry ? Math.round((leagueEntry.wins / rankedGames) * 100) : 0
  const profileScore =
    48 +
    winRate * 0.24 +
    average(kdas) * 5 +
    average(csPerMinute) * 1.7 +
    average(killParticipations) * 0.1 -
    average(participants.map(({ participant }) => participant.deaths)) * 1.5

  return {
    puuid,
    rank: formatLeagueRank(leagueEntry),
    rankedGames,
    rankedWinRate,
    recentWinRate: winRate,
    averageKda: Number(average(kdas).toFixed(1)),
    averageDeaths: Number(average(participants.map(({ participant }) => participant.deaths)).toFixed(1)),
    csPerMin: Number(average(csPerMinute).toFixed(1)),
    killParticipation: Math.round(average(killParticipations)),
    damageShare: Math.round(average(participants.map(({ damageShare }) => damageShare))),
    visionScore: Math.round(average(participants.map(({ participant }) => participant.visionScore ?? 0))),
    score: Math.max(45, Math.min(96, Math.round(profileScore))),
    masteryTop3,
    source: 'riot-api',
  }
}

export const unavailableRiotApiAdapter: RiotApiAdapter = {
  async getPlayerIntel() {
    return null
  },

  async getPlayerProfile() {
    return null
  },

  async getRecentMatches() {
    return []
  },
}

export function createRiotApiAdapter(host: RiotApiHost): RiotApiAdapter {
  return {
    async getPlayerIntel() {
      return null
    },

    async getPlayerProfile(account, count = 20) {
      const result = await fetchRecentMatchDetails(host, account, count)
      if (!result) return null

      let leagueEntry: RiotLeagueEntryDto | undefined
      let masteryTop3: RiotMasteryChampion[] = []

      if (account.platform) {
        const [summoner, mastery] = await Promise.all([
          host.fetchJson<RiotSummonerDto>(
            riotApiUrl(account.platform, `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(result.puuid)}`, host),
            { headers: authHeaders(host.apiKey) },
          ),
          host.fetchJson<RiotChampionMasteryDto[]>(
            riotApiUrl(
              account.platform,
              `/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(result.puuid)}/top?count=3`,
              host,
            ),
            { headers: authHeaders(host.apiKey) },
          ),
        ])

        masteryTop3 = (mastery ?? []).map((entry) => ({
          championId: entry.championId,
          mastery: entry.championPoints,
          level: entry.championLevel,
        }))

        if (summoner?.id) {
          const entries = await host.fetchJson<RiotLeagueEntryDto[]>(
            riotApiUrl(account.platform, `/lol/league/v4/entries/by-summoner/${encodeURIComponent(summoner.id)}`, host),
            { headers: authHeaders(host.apiKey) },
          )
          leagueEntry =
            entries?.find((entry) => entry.queueType === 'RANKED_SOLO_5x5') ??
            entries?.find((entry) => entry.queueType === 'RANKED_FLEX_SR')
        }
      }

      return createProfileFromMatches(result.puuid, result.matches, leagueEntry, masteryTop3)
    },

    async getRecentMatches(account, count) {
      const result = await fetchRecentMatchDetails(host, account, count)
      if (!result) return []

      return result.matches
        .map((match) => mapMatchSummary(match, result.puuid))
        .filter((match): match is RecentMatchSummary => Boolean(match))
    },
  }
}
