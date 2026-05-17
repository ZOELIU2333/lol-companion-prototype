import { describe, expect, it } from 'vitest'
import { mockMatches } from '../data/mockMatches'
import {
  createDemoPartyGroups,
  createDemoRecentMatches,
  inferPartyGroups,
  mapRecentMatchesToPlayerRows,
  type SharedMatchRecord,
} from './playerData'

describe('player data transforms', () => {
  it('creates compact demo recent match rows for the player history UI', () => {
    const player = mockMatches[0].players[0]
    const matches = createDemoRecentMatches(player)

    expect(matches).toHaveLength(10)
    expect(matches[0]).toMatchObject({
      id: `${player.id}-history-0`,
      mode: '单双排',
    })
    expect(matches[0].kda).toContain('/')
  })

  it('creates demo party groups from current team roles', () => {
    const groups = createDemoPartyGroups(mockMatches[0].players, 'ally')

    expect(groups).toHaveLength(2)
    expect(groups[0].playerIds).toEqual(['ally-adc', 'ally-support'])
    expect(groups[0].winRate).toBe(67)
  })

  it('infers party groups from repeated shared matches', () => {
    const records: SharedMatchRecord[] = [
      { id: '1', team: 'ally', playerIds: ['a', 'b', 'c'], won: true },
      { id: '2', team: 'ally', playerIds: ['a', 'b', 'd'], won: false },
      { id: '3', team: 'ally', playerIds: ['a', 'b', 'e'], won: true },
      { id: '4', team: 'ally', playerIds: ['c', 'd', 'e'], won: true },
      { id: '5', team: 'enemy', playerIds: ['a', 'b'], won: true },
    ]

    const groups = inferPartyGroups(records, 'ally')

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      playerIds: ['a', 'b'],
      games: 3,
      winRate: 67,
    })
  })

  it('maps Riot recent match summaries into player history rows', () => {
    const rows = mapRecentMatchesToPlayerRows([
      {
        id: 'KR_1',
        championName: 'Ezreal',
        result: 'win',
        queue: '单双排',
        kda: '8/2/11',
        csPerMin: 6.6,
        killParticipation: 61,
        score: 88,
      },
    ])

    expect(rows).toEqual([
      {
        id: 'KR_1',
        champion: 'Ezreal',
        result: '胜',
        mode: '单双排',
        time: '1 场前',
        kda: '8/2/11',
        cs: '6.6',
        kp: 61,
        score: 88,
      },
    ])
  })
})
