import { describe, expect, it } from 'vitest'
import {
  applyLcuPlayersToMatch,
  createCompanionDataSource,
  type CompanionDataSource,
} from './companionDataSource'
import type { LcuAdapter } from './lcuAdapter'
import { mockCompanionDataSource } from './mockCompanionDataSource'

const createLcuStub = (session: Awaited<ReturnType<LcuAdapter['readSession']>>): LcuAdapter => ({
  async isAvailable() {
    return Boolean(session)
  },

  async readSession() {
    return session
  },
})

describe('companion data source', () => {
  it('uses an LCU session when a mapped mode is available', async () => {
    const dataSource = createCompanionDataSource(
      createLcuStub({
        phase: 'ChampSelect',
      mode: 'augment',
      localSummonerName: 'DemoSummoner',
      players: [
        {
          id: 'ally-3',
          team: 'ally',
          role: '下路',
          summonerName: 'Live ADC',
          riotAccount: {
            gameName: 'Live ADC',
            puuid: 'ally-puuid',
            tagLine: 'KR1',
          },
        },
      ],
    }),
    )

    await expect(dataSource.detectSession()).resolves.toMatchObject({
      matchId: 'lcu-augment',
      mode: 'augment',
      phase: 'ChampSelect',
      players: [
        {
          id: 'ally-3',
          team: 'ally',
          role: '下路',
          summonerName: 'Live ADC',
          riotAccount: {
            gameName: 'Live ADC',
            puuid: 'ally-puuid',
            tagLine: 'KR1',
          },
        },
      ],
      source: 'lcu',
    })
  })

  it('applies LCU player identities onto the matching mock player slots', () => {
    const match = mockCompanionDataSource.listMatches()[0]
    const hydrated = applyLcuPlayersToMatch(match, [
      {
        id: 'ally-3',
        team: 'ally',
        role: '下路',
        summonerName: 'Live ADC',
        riotAccount: {
          gameName: 'Live ADC',
          puuid: 'ally-puuid',
          tagLine: 'KR1',
        },
      },
    ])

    const adc = hydrated.players.find((player) => player.team === 'ally' && player.role === '下路')
    expect(adc).toMatchObject({
      name: 'Live ADC',
      riotAccount: {
        gameName: 'Live ADC',
        puuid: 'ally-puuid',
        region: 'asia',
        tagLine: 'KR1',
      },
    })
  })

  it('removes unmatched mock player slots for production sessions', () => {
    const match = mockCompanionDataSource.listMatches()[0]
    const hydrated = applyLcuPlayersToMatch(
      match,
      [
        {
          id: 'ally-3',
          team: 'ally',
          role: '下路',
          summonerName: 'Live ADC',
        },
      ],
      false,
    )

    expect(hydrated.players).toHaveLength(1)
    expect(hydrated.players[0].name).toBe('Live ADC')
  })

  it('keeps player intel available for the augment stage board', () => {
    const augmentMatch = mockCompanionDataSource.listMatches().find((match) => match.mode === 'augment')

    expect(augmentMatch?.players).toHaveLength(10)
    expect(augmentMatch?.players.some((player) => player.team === 'ally')).toBe(true)
    expect(augmentMatch?.players.some((player) => player.team === 'enemy')).toBe(true)
  })

  it('keeps an active unknown queue unmapped instead of guessing ranked', async () => {
    const dataSource = createCompanionDataSource(
      createLcuStub({
        phase: 'Lobby',
        mode: null,
      }),
    )

    await expect(dataSource.detectSession()).resolves.toMatchObject({
      matchId: null,
      mode: null,
      phase: 'Lobby',
      source: 'lcu',
    })
  })

  it('keeps the LCU source when only the League client process is ready', async () => {
    const dataSource = createCompanionDataSource(
      createLcuStub({
        phase: 'ClientRunning',
        mode: null,
      }),
    )

    await expect(dataSource.detectSession()).resolves.toMatchObject({
      matchId: null,
      mode: null,
      phase: 'ClientRunning',
      source: 'lcu',
    })
  })

  it('does not fall back to demo data by default when LCU is unavailable', async () => {
    const dataSource = createCompanionDataSource(createLcuStub(null))

    await expect(dataSource.detectSession()).resolves.toBeNull()
  })

  it('uses a demo source only when one is explicitly enabled', async () => {
    const fallback: CompanionDataSource = {
      async detectSession() {
        return {
          matchId: 'fallback-match',
          mode: 'ranked',
          source: 'mock',
        }
      },

      listMatches() {
        return []
      },

      getMatch() {
        return null
      },
    }
    const dataSource = createCompanionDataSource(createLcuStub(null), fallback)

    await expect(dataSource.detectSession()).resolves.toEqual({
      matchId: 'fallback-match',
      mode: 'ranked',
      source: 'mock',
    })
  })

  it('does not expose demo match templates to a production data source', () => {
    const dataSource = createCompanionDataSource(createLcuStub(null))

    expect(dataSource.listMatches()).toEqual([])
    expect(dataSource.getMatch('rift-ezreal-001')).toBeNull()
  })
})
