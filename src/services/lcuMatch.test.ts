import { describe, expect, it } from 'vitest'
import { createLcuMatch, liveStatePlayerToIntel } from './lcuMatch'
import type { LiveStatePlayer } from '../types'

describe('LCU production match', () => {
  it('contains only values supplied by the real session', () => {
    const match = createLcuMatch({
      matchId: 'lcu-2400',
      mode: 'augment',
      queueId: 2400,
      localSummonerName: 'Local Player',
      source: 'lcu',
      players: [
        {
          id: 'ally-1',
          team: 'ally',
          isLocal: true,
          role: '下路',
          championId: 115,
          summonerName: 'Local Player',
          riotAccount: {
            gameName: 'Local Player',
            puuid: 'local-puuid',
          },
        },
      ],
    })

    expect(match.map).toBe('海克斯大乱斗')
    expect(match.currentChampionId).toBe('115')
    expect(match.players).toHaveLength(1)
    expect(match.players[0]).toMatchObject({
      name: 'Local Player',
      role: '下路',
      championId: '115',
      recentRankedGames: 0,
      recentWinRate: 0,
    })
    expect(match.players.some((player) => player.name.includes('伊泽瑞尔'))).toBe(false)
    expect(match.augmentCandidates).toEqual([])
  })

  it('uses honest allied slot labels while champ-select identities are pending', () => {
    const match = createLcuMatch({
      matchId: 'lcu-420',
      mode: 'ranked',
      queueId: 420,
      source: 'lcu',
      players: [
        { id: 'ally-0', team: 'ally', role: '上单' },
        { id: 'ally-1', team: 'ally', role: '打野', isLocal: true, championId: 64 },
      ],
    })

    expect(match.players.map((player) => player.name)).toEqual(['我方上单', '我'])
    expect(match.currentChampionId).toBe('64')
  })
})

describe('liveStatePlayerToIntel (2999 → PlayerIntel)', () => {
  const livePlayer: LiveStatePlayer = {
    summonerName: '小猫咪',
    championName: 'Ahri',
    team: 'ally',
    position: '中路',
    level: 6,
    isLocal: true,
    isBot: false,
    isDead: false,
    itemIds: [6655],
    kills: 2,
    deaths: 1,
    assists: 4,
    creepScore: 80,
  }

  it('carries the real in-game signals and leaves ranked fields empty', () => {
    const intel = liveStatePlayerToIntel(livePlayer, 0)

    expect(intel.name).toBe('小猫咪')
    expect(intel.team).toBe('ally')
    expect(intel.role).toBe('中路')
    expect(intel.live).toMatchObject({ championName: 'Ahri', level: 6, kills: 2, deaths: 1, assists: 4, isDead: false })
    // Ranked/history fields stay empty so the board honestly shows "暂无".
    expect(intel.rank).toBe('')
    expect(intel.recentRankedGames).toBe(0)
    expect(intel.score).toBe(0)
    expect(intel.riotAccount).toBeUndefined()
    expect(intel.championId).toBe('')
  })

  it('falls back to the champion name then an honest slot label for the display name', () => {
    const noName = liveStatePlayerToIntel({ ...livePlayer, summonerName: null }, 1)
    expect(noName.name).toBe('Ahri')

    const noNameNoChamp = liveStatePlayerToIntel(
      { ...livePlayer, summonerName: null, championName: null, team: 'enemy', position: '辅助' },
      2,
    )
    expect(noNameNoChamp.name).toBe('敌方辅助')
    expect(noNameNoChamp.team).toBe('enemy')
  })

  it('defaults team to ally when it could not be resolved', () => {
    const intel = liveStatePlayerToIntel({ ...livePlayer, team: null }, 3)
    expect(intel.team).toBe('ally')
  })
})
