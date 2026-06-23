import type { Champion, LiveStatePlayer, Match, PlayerIntel, PlayerRiotAccount } from '../types'
import type { DetectedGameSession } from './companionDataSource'
import type { LcuPlayerSnapshot } from './lcuAdapter'

const unavailableRestrictedFields = {
  banCount: {
    status: 'unavailable' as const,
    label: '封号次数',
    reason: '无公开合法数据源',
  },
  reportCount: {
    status: 'unavailable' as const,
    label: '被举报次数',
    reason: '无公开合法数据源',
  },
}

function createPlayer(player: LcuPlayerSnapshot): PlayerIntel {
  const role = player.role ?? '未知'
  const fallbackName = player.isLocal
    ? '我'
    : player.team === 'ally'
      ? role === '未知' ? '我方召唤师' : `我方${role}`
      : role === '未知' ? '敌方召唤师' : `敌方${role}`

  return {
    id: player.id,
    name: player.summonerName ?? player.riotAccount?.gameName ?? fallbackName,
    riotAccount: player.riotAccount?.gameName || player.riotAccount?.puuid
      ? {
          gameName: player.riotAccount.gameName ?? player.summonerName ?? player.id,
          puuid: player.riotAccount.puuid,
          region: (import.meta.env.VITE_RIOT_DEFAULT_REGION ?? 'asia') as PlayerRiotAccount['region'],
          platform: import.meta.env.VITE_RIOT_DEFAULT_PLATFORM as PlayerRiotAccount['platform'],
          tagLine: player.riotAccount.tagLine,
        }
      : undefined,
    team: player.team,
    role,
    championId: player.championId ? String(player.championId) : '',
    rank: '',
    recentWinRate: 0,
    championWinRate: 0,
    kda: 0,
    csPerMin: 0,
    killParticipation: 0,
    mastery: 0,
    score: 0,
    recentRankedGames: 0,
    championGames: 0,
    averageDeaths: 0,
    visionScore: 0,
    damageShare: 0,
    goldDiffAt15: 0,
    trendTags: [],
    heroAdvice: '',
    matchupNote: '',
    risk: {
      level: 'low',
      labels: [],
      confidence: 'public-data',
    },
    restricted: unavailableRestrictedFields,
  }
}

/**
 * Converts a Live Client Data (2999) player into the PlayerIntel shape the
 * prototype 5v5 board (GameShell) renders. Carries only the real in-game signals
 * the live feed provides (champion / level / KDA) under `live`; ranked/history
 * fields stay empty so the board honestly shows "暂无" instead of fake stats.
 */
export function liveStatePlayerToIntel(player: LiveStatePlayer, index: number): PlayerIntel {
  // team should always be resolved (localPlayerResolved), but if the local player
  // could not be located it may be null — fall back to 'ally' so the player still
  // shows on the board rather than vanishing from both columns.
  const team = player.team ?? 'ally'
  const role = player.position ?? '未知'
  const fallbackName =
    team === 'ally'
      ? role === '未知'
        ? '我方召唤师'
        : `我方${role}`
      : role === '未知'
        ? '敌方召唤师'
        : `敌方${role}`

  return {
    id: `live-${team}-${player.summonerName ?? player.championName ?? index}`,
    name: player.summonerName ?? player.championName ?? fallbackName,
    riotAccount: undefined,
    team,
    role,
    championId: '',
    rank: '',
    recentWinRate: 0,
    championWinRate: 0,
    kda: 0,
    csPerMin: 0,
    killParticipation: 0,
    mastery: 0,
    score: 0,
    recentRankedGames: 0,
    championGames: 0,
    averageDeaths: 0,
    visionScore: 0,
    damageShare: 0,
    goldDiffAt15: 0,
    trendTags: [],
    heroAdvice: '',
    matchupNote: '',
    live: {
      championName: player.championName,
      level: player.level,
      kills: player.kills,
      deaths: player.deaths,
      assists: player.assists,
      isDead: player.isDead,
    },
    risk: {
      level: 'low',
      labels: [],
      confidence: 'public-data',
    },
    restricted: unavailableRestrictedFields,
  }
}

function createUnknownChampion(id = ''): Champion {
  return {
    id,
    name: '',
    role: '',
    damageProfile: 'mixed',
    powerWindow: '',
    identity: '',
    tags: [],
  }
}

export function createLcuMatch(session: DetectedGameSession): Match {
  const players = (session.players ?? []).map(createPlayer)
  const localSnapshot = session.players?.find((player) => player.isLocal)
  const localPlayer = players.find((player) => player.id === localSnapshot?.id) ?? players.find((player) => {
    const accountName = player.riotAccount?.gameName
    return Boolean(session.localSummonerName)
      && (player.name === session.localSummonerName || accountName === session.localSummonerName)
  })
  const currentChampionId = localPlayer?.championId ?? ''

  return {
    id: session.matchId ?? `lcu-${session.queueId ?? 'unknown'}`,
    mode: session.mode ?? 'ranked',
    map: session.mode === 'augment' ? '海克斯大乱斗' : session.mode === 'ranked' ? '召唤师峡谷' : '',
    status: 'detected',
    timer: '00:00',
    currentChampionId,
    champions: [createUnknownChampion(currentChampionId)],
    players,
    enemyComposition: {
      apThreat: 0,
      crowdControl: 0,
      tanks: 0,
      assassins: 0,
      sustain: 0,
      mobility: 0,
    },
    augmentCandidates: [],
    arenaThreats: [],
    intel: {
      allyAverageScore: 0,
      enemyAverageScore: 0,
      powerSpike: '',
      compositionNote: '',
      topThreat: '',
      winCondition: '',
      earlyPlan: '',
      midGamePlan: '',
      lateGamePlan: '',
      laneFocus: '',
      objectivePlan: '',
      fightPlan: '',
      targetCalls: [],
      threatBreakdown: [],
    },
    laneMatchup: {
      lane: '',
      allyChampion: '',
      enemyChampions: [],
      difficulty: '均势',
      confidence: 0,
      summary: '',
      levelOnePlan: '',
      wavePlan: '',
      tradePattern: '',
      dangerWindows: [],
      skillTips: [],
      junglePlan: '',
      summonerPlan: '',
      starterPlan: '',
    },
    liveState: {
      minute: null,
      goldOnHand: null,
      currentItems: [],
      selectedAugments: [],
      selectedAugmentIds: [],
      candidateAugmentIds: [],
      isLiveDataAuthoritative: false,
      players: [],
      currentSituation: '',
      nextObjective: '',
      immediateAction: '',
    },
  }
}
