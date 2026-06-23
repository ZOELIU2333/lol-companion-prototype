import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GameShell } from './GameShell'
import { liveStatePlayerToIntel } from '../services/lcuMatch'
import { mockMatches } from '../data/mockMatches'
import type { LiveStatePlayer, Match } from '../types'

const liveRoster: LiveStatePlayer[] = [
  {
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
  },
  {
    summonerName: '句缺TiAmo',
    championName: 'Lux',
    team: 'enemy',
    position: '辅助',
    level: 5,
    isLocal: false,
    isBot: false,
    isDead: true,
    itemIds: [3070],
    kills: 0,
    deaths: 3,
    assists: 1,
    creepScore: 12,
  },
]

function matchWithLiveRoster(): Match {
  const base = mockMatches[0]
  return {
    ...base,
    players: liveRoster.map((player, index) => liveStatePlayerToIntel(player, index)),
  }
}

describe('GameShell 5v5 versus board with live roster', () => {
  it('renders both teams with summoner name and live champion/level/KDA', () => {
    const html = renderToStaticMarkup(
      <GameShell match={matchWithLiveRoster()}>
        <div />
      </GameShell>,
    )

    // Both ally and enemy players show on the versus board.
    expect(html).toContain('小猫咪')
    expect(html).toContain('句缺TiAmo')
    // Live champion + level + KDA appear.
    expect(html).toContain('Ahri')
    expect(html).toContain('Lux')
    expect(html).toContain('Lv6')
    expect(html).toContain('2/1/4')
    // Dead player is marked.
    expect(html).toContain('阵亡')
    // No ranked data → honest "公开数据暂无", never fabricated stats.
    expect(html).toContain('公开数据暂无')
  })

  it('renders nothing on the board when there are no players', () => {
    const base = mockMatches[0]
    const html = renderToStaticMarkup(
      <GameShell match={{ ...base, players: [] }}>
        <div />
      </GameShell>,
    )

    expect(html).not.toContain('stage-versus-grid')
  })
})
