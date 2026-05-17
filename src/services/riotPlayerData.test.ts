import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadRiotPlayerProfile, loadRiotRecentMatches, parseRiotAccountOverrides } from './riotPlayerData'
import type { RiotApiHost } from './riotApiAdapter'

describe('riot player data bridge', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('parses player account overrides from env-style json', () => {
    const overrides = parseRiotAccountOverrides(JSON.stringify({
      '蓝量不够Q': {
        gameName: 'Hide on bush',
        tagLine: 'KR1',
        region: 'asia',
        platform: 'kr',
      },
      broken: {
        gameName: 'Missing tag',
      },
    }))

    expect(overrides).toEqual({
      '蓝量不够Q': {
        gameName: 'Hide on bush',
        tagLine: 'KR1',
        region: 'asia',
        platform: 'kr',
      },
    })
  })

  it('returns no rows when riot host or account is unavailable', async () => {
    await expect(loadRiotRecentMatches(null, null)).resolves.toEqual([])
  })

  it('maps real riot adapter summaries to player history rows', async () => {
    const host: RiotApiHost = {
      async fetchJson<T>(url: string): Promise<T | null> {
        if (url.includes('/riot/account/v1/accounts/by-riot-id/')) {
          return { puuid: 'puuid-1', gameName: 'Demo', tagLine: 'KR1' } as T
        }

        if (url.includes('/lol/match/v5/matches/by-puuid/puuid-1/ids')) {
          return ['KR_1'] as T
        }

        if (url.includes('/lol/match/v5/matches/KR_1')) {
          return {
            metadata: { matchId: 'KR_1', participants: ['puuid-1'] },
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
              ],
            },
          } as T
        }

        return null
      },
    }

    const rows = await loadRiotRecentMatches(host, { gameName: 'Demo', tagLine: 'KR1', region: 'asia' })

    expect(rows[0]).toMatchObject({
      id: 'KR_1',
      champion: 'Ezreal',
      result: '胜',
      mode: '单双排',
      kda: '8/2/11',
    })
  })

  it('loads riot player profile through the bridge', async () => {
    const host: RiotApiHost = {
      async fetchJson<T>(url: string): Promise<T | null> {
        if (url.includes('/riot/account/v1/accounts/by-riot-id/')) {
          return { puuid: 'puuid-1', gameName: 'Demo', tagLine: 'KR1' } as T
        }
        if (url.includes('/lol/match/v5/matches/by-puuid/puuid-1/ids')) {
          return ['KR_1'] as T
        }
        if (url.includes('/lol/match/v5/matches/KR_1')) {
          return {
            metadata: { matchId: 'KR_1', participants: ['puuid-1'] },
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
              ],
            },
          } as T
        }
        return null
      },
    }

    const profile = await loadRiotPlayerProfile(host, { gameName: 'Demo', tagLine: 'KR1', region: 'asia' })

    expect(profile).toMatchObject({
      puuid: 'puuid-1',
      recentWinRate: 100,
      averageKda: 9.5,
      csPerMin: 6.6,
      source: 'riot-api',
    })
  })

  it('ignores expired cached Riot history rows', async () => {
    const store = new Map<string, string>()
    const removedKeys: string[] = []
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        removeItem: (key: string) => {
          removedKeys.push(key)
          return store.delete(key)
        },
        setItem: (key: string, value: string) => store.set(key, value),
      },
    })

    store.set(
      'lol-companion:riot-player:history:kr:demo:kr1:10',
      JSON.stringify({ expiresAt: Date.now() - 1, value: [{ id: 'old' }] }),
    )

    await expect(loadRiotRecentMatches(null, {
      gameName: 'Demo',
      platform: 'kr',
      region: 'asia',
      tagLine: 'KR1',
    })).resolves.toEqual([])
    expect(removedKeys).toEqual(['lol-companion:riot-player:history:kr:demo:kr1:10'])
  })
})
