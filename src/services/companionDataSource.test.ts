import { describe, expect, it } from 'vitest'
import {
  applyLcuPlayersToMatch,
  createCompanionDataSource,
  mockCompanionDataSource,
  type CompanionDataSource,
} from './companionDataSource'
import type { LcuAdapter } from './lcuAdapter'

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
      mode: 'arena',
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
      matchId: 'augment-ahri-002',
      mode: 'arena',
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

  it('keeps player intel available for the augment stage board', () => {
    const augmentMatch = mockCompanionDataSource.listMatches().find((match) => match.mode === 'arena')

    expect(augmentMatch?.players).toHaveLength(10)
    expect(augmentMatch?.players.some((player) => player.team === 'ally')).toBe(true)
    expect(augmentMatch?.players.some((player) => player.team === 'enemy')).toBe(true)
  })

  it('keeps the LCU source when the client is open but not in a mapped queue', async () => {
    const dataSource = createCompanionDataSource(
      createLcuStub({
        phase: 'Lobby',
        mode: null,
      }),
    )

    await expect(dataSource.detectSession()).resolves.toMatchObject({
      matchId: 'rift-ezreal-001',
      mode: 'ranked',
      phase: 'Lobby',
      source: 'lcu',
    })
  })

  it('falls back to the demo source when LCU is unavailable', async () => {
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

  it('keeps demo match access available while real history is not wired', () => {
    const dataSource = createCompanionDataSource(createLcuStub(null))
    const firstMatch = mockCompanionDataSource.listMatches()[0]

    expect(dataSource.listMatches()).toEqual(mockCompanionDataSource.listMatches())
    expect(dataSource.getMatch(firstMatch.id)).toEqual(firstMatch)
  })
})
