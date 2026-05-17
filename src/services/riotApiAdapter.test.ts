import { describe, expect, it } from 'vitest'
import { createRiotApiAdapter, unavailableRiotApiAdapter, type RiotApiHost } from './riotApiAdapter'

describe('riot api adapter boundary', () => {
  it('provides an unavailable fallback adapter', async () => {
    const account = { gameName: 'Demo', region: 'asia' as const, tagLine: 'KR1' }

    await expect(unavailableRiotApiAdapter.getPlayerIntel(account)).resolves.toBeNull()
    await expect(unavailableRiotApiAdapter.getRecentMatches(account, 10)).resolves.toEqual([])
  })

  it('fetches recent matches from Riot account and match-v5 endpoints', async () => {
    const requestedUrls: string[] = []
    const host: RiotApiHost = {
      apiKey: 'riot-key',
      async fetchJson<T>(url: string, init?: { headers?: Record<string, string> }): Promise<T | null> {
        requestedUrls.push(url)
        expect(init?.headers?.['X-Riot-Token']).toBe('riot-key')

        if (url.includes('/riot/account/v1/accounts/by-riot-id/')) {
          return { puuid: 'puuid-1', gameName: 'Demo', tagLine: 'KR1' } as T
        }

        if (url.includes('/lol/match/v5/matches/by-puuid/puuid-1/ids')) {
          return ['KR_1'] as T
        }

        if (url.includes('/lol/match/v5/matches/KR_1')) {
          return {
            metadata: {
              matchId: 'KR_1',
              participants: ['puuid-1'],
            },
            info: {
              gameCreation: 1778911382,
              queueId: 420,
              participants: [
                {
                  puuid: 'puuid-1',
                  teamId: 100,
                  championName: 'Ezreal',
                  win: true,
                  kills: 8,
                  deaths: 2,
                  assists: 11,
                  totalMinionsKilled: 190,
                  neutralMinionsKilled: 8,
                  totalDamageDealtToChampions: 24000,
                  visionScore: 22,
                  timePlayed: 1800,
                  challenges: {
                    killParticipation: 0.61,
                  },
                },
              ],
            },
          } as T
        }

        return null
      },
    }

    const adapter = createRiotApiAdapter(host)
    const matches = await adapter.getRecentMatches({ gameName: 'Demo', region: 'asia', tagLine: 'KR1' }, 10)

    expect(requestedUrls).toEqual([
      'https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Demo/KR1',
      'https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/puuid-1/ids?start=0&count=10',
      'https://asia.api.riotgames.com/lol/match/v5/matches/KR_1',
    ])
    expect(matches).toEqual([
      {
        id: 'KR_1',
        championName: 'Ezreal',
        result: 'win',
        queue: '单双排',
        kda: '8/2/11',
        csPerMin: 6.6,
        killParticipation: 61,
        score: 96,
      },
    ])
  })

  it('builds a player profile from match, ranked, and mastery endpoints', async () => {
    const host: RiotApiHost = {
      apiKey: 'riot-key',
      async fetchJson<T>(url: string): Promise<T | null> {
        if (url.includes('/riot/account/v1/accounts/by-riot-id/')) {
          return { puuid: 'puuid-1', gameName: 'Demo', tagLine: 'KR1' } as T
        }

        if (url.includes('/lol/match/v5/matches/by-puuid/puuid-1/ids')) {
          return ['KR_1'] as T
        }

        if (url.includes('/lol/match/v5/matches/KR_1')) {
          return {
            metadata: { matchId: 'KR_1', participants: ['puuid-1', 'puuid-2'] },
            info: {
              gameCreation: 1778911382,
              queueId: 420,
              participants: [
                {
                  puuid: 'puuid-1',
                  teamId: 100,
                  championName: 'Ezreal',
                  win: true,
                  kills: 8,
                  deaths: 2,
                  assists: 11,
                  totalMinionsKilled: 190,
                  neutralMinionsKilled: 8,
                  totalDamageDealtToChampions: 24000,
                  visionScore: 22,
                  timePlayed: 1800,
                  challenges: { killParticipation: 0.61 },
                },
                {
                  puuid: 'puuid-2',
                  teamId: 100,
                  championName: 'Nautilus',
                  win: true,
                  kills: 1,
                  deaths: 4,
                  assists: 16,
                  totalMinionsKilled: 35,
                  neutralMinionsKilled: 0,
                  totalDamageDealtToChampions: 8000,
                  visionScore: 61,
                  timePlayed: 1800,
                  challenges: { killParticipation: 0.55 },
                },
              ],
            },
          } as T
        }

        if (url.includes('/lol/summoner/v4/summoners/by-puuid/puuid-1')) {
          return { id: 'summoner-1', puuid: 'puuid-1' } as T
        }

        if (url.includes('/lol/champion-mastery/v4/champion-masteries/by-puuid/puuid-1/top')) {
          return [
            { championId: 81, championLevel: 7, championPoints: 1150000 },
            { championId: 145, championLevel: 7, championPoints: 880000 },
          ] as T
        }

        if (url.includes('/lol/league/v4/entries/by-summoner/summoner-1')) {
          return [
            {
              queueType: 'RANKED_SOLO_5x5',
              tier: 'EMERALD',
              rank: 'II',
              leaguePoints: 44,
              wins: 58,
              losses: 42,
            },
          ] as T
        }

        return null
      },
    }

    const profile = await createRiotApiAdapter(host).getPlayerProfile(
      { gameName: 'Demo', region: 'asia', platform: 'kr', tagLine: 'KR1' },
      10,
    )

    expect(profile).toMatchObject({
      puuid: 'puuid-1',
      rank: '翡翠 II 44LP',
      rankedGames: 100,
      rankedWinRate: 58,
      recentWinRate: 100,
      averageKda: 9.5,
      averageDeaths: 2,
      csPerMin: 6.6,
      killParticipation: 61,
      damageShare: 75,
      visionScore: 22,
      masteryTop3: [
        { championId: 81, level: 7, mastery: 1150000 },
        { championId: 145, level: 7, mastery: 880000 },
      ],
      source: 'riot-api',
    })
  })

  it('routes Riot requests through a local mock base url when configured', async () => {
    const requestedUrls: string[] = []
    const host: RiotApiHost = {
      apiKey: 'mock-key',
      baseUrl: 'http://127.0.0.1:30080',
      async fetchJson<T>(url: string): Promise<T | null> {
        requestedUrls.push(url)

        if (url.includes('/asia/riot/account/v1/accounts/by-riot-id/')) {
          return { puuid: 'puuid-1', gameName: 'Demo', tagLine: 'KR1' } as T
        }

        if (url.includes('/asia/lol/match/v5/matches/by-puuid/puuid-1/ids')) {
          return [] as T
        }

        return null
      },
    }

    await createRiotApiAdapter(host).getRecentMatches({ gameName: 'Demo', region: 'asia', tagLine: 'KR1' }, 10)

    expect(requestedUrls).toEqual([
      'http://127.0.0.1:30080/asia/riot/account/v1/accounts/by-riot-id/Demo/KR1',
      'http://127.0.0.1:30080/asia/lol/match/v5/matches/by-puuid/puuid-1/ids?start=0&count=10',
    ])
  })

  it('does not request Riot if the account cannot be resolved', async () => {
    const host: RiotApiHost = {
      async fetchJson() {
        throw new Error('should not be called')
      },
    }
    const adapter = createRiotApiAdapter(host)

    await expect(adapter.getRecentMatches({ gameName: 'Demo', region: 'asia' }, 10)).resolves.toEqual([])
  })
})
