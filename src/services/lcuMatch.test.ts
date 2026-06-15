import { describe, expect, it } from 'vitest'
import { createLcuMatch } from './lcuMatch'

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
})
