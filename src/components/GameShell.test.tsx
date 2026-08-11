// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { mockMatches } from '../data/mockMatches'
import { GameShell } from './GameShell'

afterEach(cleanup)

const rankedMatch = mockMatches.find((match) => match.mode === 'ranked')!
const champion = rankedMatch.champions.find((entry) => entry.id === rankedMatch.currentChampionId)!

describe('GameShell real-session gates', () => {
  it('does not expose template player profiles without real LCU participant data', () => {
    render(
      <GameShell
        activeMode="ranked"
        champion={champion}
        hasRealPlayerIntel={false}
        liveSessionState="live"
        match={rankedMatch}
      >
        <div>overlay</div>
      </GameShell>,
    )

    expect(screen.getByText('玩家信息暂不可用')).toBeVisible()
    expect(screen.queryByText(rankedMatch.players[0].name)).not.toBeInTheDocument()
  })

  it('suppresses the match stage while waiting for Live Client data', () => {
    render(
      <GameShell
        activeMode="ranked"
        champion={champion}
        hasRealPlayerIntel={false}
        liveSessionState="waiting"
        match={rankedMatch}
      >
        <div>waiting overlay</div>
      </GameShell>,
    )

    expect(screen.queryByRole('region', { name: '实时游戏信息' })).not.toBeInTheDocument()
    expect(screen.getByText('waiting overlay')).toBeVisible()
  })
})
