import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlayerIntel, PlayerRecentMatch } from '../types'
import { getOpggAccountForPlayer, loadOpggRecentMatches } from './opggPlayerData'

const basePlayer: PlayerIntel = {
  averageDeaths: 4,
  championGames: 20,
  championId: 'ahri',
  championWinRate: 55,
  csPerMin: 7,
  damageShare: 24,
  goldDiffAt15: 100,
  heroAdvice: '',
  id: 'p1',
  kda: 3,
  killParticipation: 60,
  mastery: 100000,
  matchupNote: '',
  name: '测试玩家',
  rank: '钻石 IV',
  recentRankedGames: 20,
  recentWinRate: 55,
  restricted: {
    banCount: { label: '封号次数', status: 'unavailable' },
    reportCount: { label: '举报次数', status: 'unavailable' },
  },
  risk: { confidence: 'demo', labels: [], level: 'low' },
  role: '中路',
  score: 80,
  team: 'ally',
  trendTags: [],
  visionScore: 18,
}

describe('opgg player data helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps Riot account platform to OP.GG region', () => {
    expect(getOpggAccountForPlayer({
      ...basePlayer,
      riotAccount: {
        gameName: 'Hide on bush',
        platform: 'kr',
        region: 'asia',
        tagLine: 'KR1',
      },
    })).toEqual({
      gameName: 'Hide on bush',
      region: 'KR',
      tagLine: 'KR1',
    })
  })

  it('falls back to tag line when platform is missing', () => {
    expect(getOpggAccountForPlayer({
      ...basePlayer,
      riotAccount: {
        gameName: 'Somebody',
        region: 'americas',
        tagLine: 'NA1',
      },
    })).toEqual({
      gameName: 'Somebody',
      region: 'NA',
      tagLine: 'NA1',
    })
  })

  it('does not query OP.GG without a full Riot ID', () => {
    expect(getOpggAccountForPlayer(basePlayer)).toBeNull()
  })

  it('returns cached OP.GG history when the host is unavailable', async () => {
    const history: PlayerRecentMatch[] = [{
      champion: 'Ezreal',
      cs: '7.2',
      id: 'KR_1',
      kda: '8/2/9',
      kp: 61,
      mode: '单双排',
      result: '胜',
      score: 88,
      time: '1小时前',
    }]
    const store = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        removeItem: (key: string) => store.delete(key),
        setItem: (key: string, value: string) => store.set(key, value),
      },
    })

    store.set(
      'lol-companion:opgg-player:history:kr:hide on bush:kr1:10',
      JSON.stringify({ expiresAt: Date.now() + 1000, value: history }),
    )

    await expect(loadOpggRecentMatches(null, {
      ...basePlayer,
      riotAccount: {
        gameName: 'Hide on bush',
        platform: 'kr',
        region: 'asia',
        tagLine: 'KR1',
      },
    })).resolves.toEqual(history)
  })
})
