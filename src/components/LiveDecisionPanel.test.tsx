import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LiveDecisionPanel } from './LiveDecisionPanel'
import { emptyRecommendations } from '../services/emptyRecommendations'
import { mockMatches } from '../data/mockMatches'
import type { Match } from '../types'

function matchWithLive(overrides: Partial<Match['liveState']> = {}): Match {
  const base = mockMatches[0]
  return {
    ...base,
    liveState: { ...base.liveState, minute: 5, goldOnHand: 1200, ...overrides },
  }
}

describe('LiveDecisionPanel', () => {
  it('shows the live gold in ranked mode', () => {
    const html = renderToStaticMarkup(
      <LiveDecisionPanel activeMode="ranked" match={matchWithLive()} recommendations={emptyRecommendations} />,
    )

    expect(html).toContain('当前金币')
    expect(html).toContain('1200')
  })

  it('shows 未同步 when gold is missing', () => {
    const html = renderToStaticMarkup(
      <LiveDecisionPanel activeMode="ranked" match={matchWithLive({ goldOnHand: null })} recommendations={emptyRecommendations} />,
    )

    expect(html).toContain('未同步')
  })

  it('renders the augment strip in augment (Mayhem) mode', () => {
    const html = renderToStaticMarkup(
      <LiveDecisionPanel activeMode="augment" match={matchWithLive()} recommendations={emptyRecommendations} />,
    )

    expect(html).toContain('已选海克斯')
  })
})
