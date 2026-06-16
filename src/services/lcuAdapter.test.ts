import { describe, expect, it } from 'vitest'
import {
  createLcuAdapter,
  createLcuAuthHeader,
  createLcuBaseUrl,
  mapLcuQueueToMode,
  parseLcuLockfile,
  unavailableLcuAdapter,
  type LcuRequestOptions,
} from './lcuAdapter'

describe('lcu adapter boundary', () => {
  it('parses a valid lockfile from the local League client', () => {
    expect(parseLcuLockfile('LeagueClient:1234:2999:secret:https')).toEqual({
      name: 'LeagueClient',
      password: 'secret',
      pid: 1234,
      port: 2999,
      protocol: 'https',
    })
  })

  it('rejects malformed lockfiles', () => {
    expect(parseLcuLockfile('LeagueClient:1234:2999:secret')).toBeNull()
    expect(parseLcuLockfile('LeagueClient:not-pid:2999:secret:https')).toBeNull()
    expect(parseLcuLockfile('LeagueClient:1234:not-port:secret:https')).toBeNull()
    expect(parseLcuLockfile('LeagueClient:1234:2999:secret:ftp')).toBeNull()
  })

  it('creates local client request credentials', () => {
    const lockfile = parseLcuLockfile('LeagueClient:1234:2999:secret:https')

    expect(lockfile).not.toBeNull()
    expect(createLcuBaseUrl(lockfile!)).toBe('https://127.0.0.1:2999')
    expect(createLcuAuthHeader('secret')).toBe('Basic cmlvdDpzZWNyZXQ=')
  })

  it('maps known queue descriptions into product modes', () => {
    expect(mapLcuQueueToMode('Ranked Solo/Duo')).toBe('ranked')
    expect(mapLcuQueueToMode('Normal Draft')).toBe('ranked')
    expect(mapLcuQueueToMode('Arena')).toBe('augment')
    expect(mapLcuQueueToMode('CLASSIC', 420)).toBe('ranked')
    expect(mapLcuQueueToMode('ARAM', 2400)).toBe('augment')
    expect(mapLcuQueueToMode('极地大乱斗', 450)).toBeNull()
  })

  it('keeps unknown queues unmapped', () => {
    expect(mapLcuQueueToMode('Tutorial')).toBeNull()
  })

  it('provides an unavailable fallback adapter', async () => {
    await expect(unavailableLcuAdapter.isAvailable()).resolves.toBe(false)
    await expect(unavailableLcuAdapter.readSession()).resolves.toBeNull()
  })

  it('reads a session snapshot through the host bridge', async () => {
    const calls: LcuRequestOptions[] = []
    const adapter = createLcuAdapter({
      readLockfile: async () => 'LeagueClient:1234:2999:secret:https',
      requestJson: async <T,>(options: LcuRequestOptions) => {
        calls.push(options)

        if (options.path === '/lol-gameflow/v1/gameflow-phase') {
          return 'ChampSelect' as T
        }

        if (options.path === '/lol-gameflow/v1/session') {
          return {
            gameData: {
              queue: {
                id: 420,
                description: 'Ranked Solo/Duo',
              },
            },
          } as T
        }

        if (options.path === '/lol-summoner/v1/current-summoner') {
          return {
            displayName: 'DemoSummoner',
          } as T
        }

        if (options.path === '/lol-champ-select/v1/session') {
          return {
            localPlayerCellId: 3,
            myTeam: [
              {
                assignedPosition: 'bottom',
                cellId: 3,
                championId: 81,
                summonerId: 1001,
              },
            ],
            theirTeam: [
              {
                assignedPosition: 'utility',
                cellId: 8,
                championId: 412,
                summonerId: 2001,
              },
            ],
          } as T
        }

        if (options.path === '/lol-summoner/v1/summoners/1001') {
          return {
            displayName: 'Live ADC',
            gameName: 'Live ADC',
            puuid: 'ally-puuid',
            tagLine: 'KR1',
          } as T
        }

        if (options.path === '/lol-summoner/v1/summoners/2001') {
          return {
            displayName: 'Enemy Support',
            gameName: 'Enemy Support',
            puuid: 'enemy-puuid',
            tagLine: 'KR1',
          } as T
        }

        return null
      },
    })

    await expect(adapter.isAvailable()).resolves.toBe(true)
    await expect(adapter.readSession()).resolves.toEqual({
      phase: 'ChampSelect',
      mode: 'ranked',
      queueId: 420,
      localSummonerName: 'DemoSummoner',
      playerSource: 'champ-select',
      players: [
        {
          id: 'ally-3',
          team: 'ally',
          isLocal: true,
          role: '下路',
          championId: 81,
          summonerId: 1001,
          summonerName: 'Live ADC',
          riotAccount: {
            gameName: 'Live ADC',
            puuid: 'ally-puuid',
            tagLine: 'KR1',
          },
        },
        {
          id: 'enemy-8',
          team: 'enemy',
          isLocal: false,
          role: '辅助',
          championId: 412,
          summonerId: 2001,
          summonerName: 'Enemy Support',
          riotAccount: {
            gameName: 'Enemy Support',
            puuid: 'enemy-puuid',
            tagLine: 'KR1',
          },
        },
      ],
    })
    expect(calls).toEqual([
      {
        authHeader: 'Basic cmlvdDpzZWNyZXQ=',
        baseUrl: 'https://127.0.0.1:2999',
        path: '/lol-gameflow/v1/gameflow-phase',
      },
      {
        authHeader: 'Basic cmlvdDpzZWNyZXQ=',
        baseUrl: 'https://127.0.0.1:2999',
        path: '/lol-gameflow/v1/session',
      },
      {
        authHeader: 'Basic cmlvdDpzZWNyZXQ=',
        baseUrl: 'https://127.0.0.1:2999',
        path: '/lol-summoner/v1/current-summoner',
      },
      {
        authHeader: 'Basic cmlvdDpzZWNyZXQ=',
        baseUrl: 'https://127.0.0.1:2999',
        path: '/lol-champ-select/v1/session',
      },
      {
        authHeader: 'Basic cmlvdDpzZWNyZXQ=',
        baseUrl: 'https://127.0.0.1:2999',
        path: '/lol-summoner/v1/summoners/1001',
      },
      {
        authHeader: 'Basic cmlvdDpzZWNyZXQ=',
        baseUrl: 'https://127.0.0.1:2999',
        path: '/lol-summoner/v1/summoners/2001',
      },
    ])
  })

  it('stays unavailable when no local client lockfile exists', async () => {
    const adapter = createLcuAdapter({
      readLockfile: async () => null,
      requestJson: async () => null,
    })

    await expect(adapter.isAvailable()).resolves.toBe(false)
    await expect(adapter.readSession()).resolves.toBeNull()
  })

  it('keeps all allied champ-select slots even before identities are available', async () => {
    const adapter = createLcuAdapter({
      readLockfile: async () => 'LeagueClient:1234:2999:secret:https',
      requestJson: async <T,>({ path }: LcuRequestOptions) => {
        if (path === '/lol-gameflow/v1/gameflow-phase') return 'ChampSelect' as T
        if (path === '/lol-gameflow/v1/session') {
          return { gameData: { queue: { id: 420, description: 'Ranked Solo/Duo' } } } as T
        }
        if (path === '/lol-summoner/v1/current-summoner') return { displayName: 'Local Player' } as T
        if (path === '/lol-champ-select/v1/session') {
          return {
            localPlayerCellId: 1,
            myTeam: [
              { assignedPosition: 'top', cellId: 0, championId: 0 },
              { assignedPosition: 'jungle', cellId: 1, championId: 64 },
              { assignedPosition: 'middle', cellId: 2, championId: 0 },
              { assignedPosition: 'bottom', cellId: 3, championId: 0 },
              { assignedPosition: 'utility', cellId: 4, championId: 0 },
            ],
            theirTeam: [],
          } as T
        }
        return null
      },
    })

    const session = await adapter.readSession()
    expect(session?.players).toHaveLength(5)
    expect(session?.players?.map((player) => player.role)).toEqual(['上单', '打野', '中路', '下路', '辅助'])
    expect(session?.players?.find((player) => player.isLocal)).toMatchObject({
      id: 'ally-1',
      championId: 64,
      role: '打野',
    })
  })

  it('falls back to gameflow players when champ-select returns no slots', async () => {
    const adapter = createLcuAdapter({
      readLockfile: async () => 'LeagueClient:1234:2999:secret:https',
      requestJson: async <T,>({ path }: LcuRequestOptions) => {
        if (path === '/lol-gameflow/v1/gameflow-phase') return 'ChampSelect' as T
        if (path === '/lol-summoner/v1/current-summoner') {
          return { displayName: 'Local Player', summonerId: 2001, puuid: 'local-puuid' } as T
        }
        if (path === '/lol-gameflow/v1/session') {
          return {
            gameData: {
              queue: { id: 420, description: 'Ranked Solo/Duo' },
              teamOne: [
                { championId: 81, summonerId: 1001, summonerName: 'Enemy Player' },
              ],
              teamTwo: [
                { championId: 64, summonerId: 2001, summonerName: 'Local Player', puuid: 'local-puuid' },
              ],
            },
          } as T
        }
        if (path === '/lol-champ-select/v1/session') {
          return { localPlayerCellId: 1, myTeam: [], theirTeam: [] } as T
        }
        if (path === '/lol-summoner/v1/summoners/1001') {
          return { displayName: 'Enemy Player', gameName: 'Enemy Player' } as T
        }
        if (path === '/lol-summoner/v1/summoners/2001') {
          return { displayName: 'Local Player', gameName: 'Local Player', puuid: 'local-puuid' } as T
        }
        return null
      },
    })

    await expect(adapter.readSession()).resolves.toMatchObject({
      phase: 'ChampSelect',
      mode: 'ranked',
      queueId: 420,
      playerSource: 'gameflow',
      players: [
        { team: 'ally', summonerName: 'Local Player', championId: 64 },
        { team: 'enemy', summonerName: 'Enemy Player', championId: 81 },
      ],
    })
  })

  it('reads loading-screen players from gameflow and makes the local team allied', async () => {
    const adapter = createLcuAdapter({
      readLockfile: async () => 'LeagueClient:1234:2999:secret:https',
      requestJson: async <T,>({ path }: LcuRequestOptions) => {
        if (path === '/lol-gameflow/v1/gameflow-phase') return 'GameStart' as T
        if (path === '/lol-summoner/v1/current-summoner') {
          return { displayName: 'Local Player', summonerId: 2001, puuid: 'local-puuid' } as T
        }
        if (path === '/lol-gameflow/v1/session') {
          return {
            gameData: {
              queue: { id: 2400, name: '海克斯大乱斗' },
              teamOne: [
                { championId: 81, summonerId: 1001, summonerName: 'Blue Player' },
              ],
              teamTwo: [
                { championId: 115, summonerId: 2001, summonerName: 'Local Player', puuid: 'local-puuid' },
              ],
            },
          } as T
        }
        if (path === '/lol-summoner/v1/summoners/1001') {
          return { displayName: 'Blue Player', gameName: 'Blue Player' } as T
        }
        if (path === '/lol-summoner/v1/summoners/2001') {
          return { displayName: 'Local Player', gameName: 'Local Player', puuid: 'local-puuid' } as T
        }
        return null
      },
    })

    await expect(adapter.readSession()).resolves.toMatchObject({
      phase: 'GameStart',
      mode: 'augment',
      queueId: 2400,
      playerSource: 'gameflow',
      players: [
        { team: 'ally', summonerName: 'Local Player', championId: 115 },
        { team: 'enemy', summonerName: 'Blue Player', championId: 81 },
      ],
    })
  })
})
