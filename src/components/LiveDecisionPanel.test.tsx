import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LiveDecisionPanel } from './LiveDecisionPanel'
import { emptyRecommendations } from '../services/emptyRecommendations'
import { mockMatches } from '../data/mockMatches'
import type { LiveStatePlayer, Match } from '../types'

const livePlayers: LiveStatePlayer[] = [
  {
    summonerName: '我本人',
    championName: 'Ezreal',
    team: 'ally',
    position: '下路',
    level: 7,
    isLocal: true,
    isBot: false,
    isDead: false,
    itemIds: [3004],
    kills: 3,
    deaths: 1,
    assists: 5,
    creepScore: 90,
  },
  {
    summonerName: '敌方中单',
    championName: 'Ahri',
    team: 'enemy',
    position: '中路',
    level: 8,
    isLocal: false,
    isBot: false,
    isDead: true,
    itemIds: [6655, 1058],
    kills: 2,
    deaths: 2,
    assists: 1,
    creepScore: 110,
  },
]

function matchWithLivePlayers(): Match {
  const base = mockMatches[0]
  return {
    ...base,
    liveState: { ...base.liveState, players: livePlayers, minute: 5, goldOnHand: 1200 },
  }
}

describe('LiveDecisionPanel real-time roster', () => {
  it('renders the live player list in ranked mode', () => {
    const html = renderToStaticMarkup(
      <LiveDecisionPanel activeMode="ranked" match={matchWithLivePlayers()} recommendations={emptyRecommendations} />,
    )

    expect(html).toContain('对局玩家（实时）')
    // Summoner names lead each row; champion names appear as secondary info.
    expect(html).toContain('我本人')
    expect(html).toContain('敌方中单')
    expect(html).toContain('Ezreal')
    expect(html).toContain('Ahri')
  })

  it('renders the live player list in augment (Mayhem) mode too', () => {
    const html = renderToStaticMarkup(
      <LiveDecisionPanel activeMode="augment" match={matchWithLivePlayers()} recommendations={emptyRecommendations} />,
    )

    expect(html).toContain('对局玩家（实时）')
    expect(html).toContain('我本人')
    expect(html).toContain('敌方中单')
    expect(html).toContain('Ezreal')
    expect(html).toContain('Ahri')
  })

  it('omits the roster entirely when there are no live players', () => {
    const base = mockMatches[0]
    const match: Match = { ...base, liveState: { ...base.liveState, players: [] } }
    const html = renderToStaticMarkup(
      <LiveDecisionPanel activeMode="augment" match={match} recommendations={emptyRecommendations} />,
    )

    expect(html).not.toContain('对局玩家（实时）')
  })
})
