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
    expect(mapLcuQueueToMode('Arena')).toBe('arena')
    expect(mapLcuQueueToMode('CHERRY')).toBe('arena')
    expect(mapLcuQueueToMode('KIWI')).toBe('arena')
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
      localSummonerName: 'DemoSummoner',
      players: [
        {
          id: 'ally-3',
          isLocalPlayer: true,
          team: 'ally',
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
          isLocalPlayer: false,
          team: 'enemy',
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
})
