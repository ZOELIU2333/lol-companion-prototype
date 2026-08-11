// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ArenaDecisionView } from './ArenaDecisionView'
import { fixtureModel } from './testFixtures'

afterEach(cleanup)

describe('Arena decision view', () => {
  it('shows candidate icons, affordable purchase, and a labeled combo chain', () => {
    render(<ArenaDecisionView model={fixtureModel} onConfirmCandidate={vi.fn()} />)

    expect(screen.getByRole('heading', { name: '本轮选什么' })).toBeVisible()
    expect(screen.getByAltText('大地苏醒')).toHaveAttribute('src', expect.stringContaining('earthwake'))
    expect(screen.getByText('以太精魂')).toBeVisible()
    expect(screen.getByText('位移爆发循环')).toBeVisible()
    expect(screen.getAllByTestId('arena-candidate')).toHaveLength(3)
  })

  it('swaps a failed remote image to the bundled placeholder', () => {
    render(<ArenaDecisionView model={fixtureModel} onConfirmCandidate={vi.fn()} />)
    const image = screen.getByAltText('大地苏醒')

    fireEvent.error(image)
    expect(image).toHaveAttribute('src', '/assets/arena-placeholder.svg')
  })

  it('opens the three-route expanded view', () => {
    render(<ArenaDecisionView model={fixtureModel} onConfirmCandidate={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '展开路线详情' }))
    expect(screen.getByRole('heading', { name: '三条构筑路线' })).toBeVisible()
    expect(screen.getAllByText('黑科技路线')).toHaveLength(2)
  })

  it('labels stale candidate observations', () => {
    render(<ArenaDecisionView onConfirmCandidate={vi.fn()} model={{
      ...fixtureModel,
      session: { ...fixtureModel.session, candidates: { ...fixtureModel.session.candidates, state: 'stale' } },
    }} />)

    expect(screen.getByText('候选数据可能过期')).toBeVisible()
  })

  it('confirms a ranked candidate from the visible card', async () => {
    const user = userEvent.setup()
    const onConfirmCandidate = vi.fn()
    render(<ArenaDecisionView model={fixtureModel} onConfirmCandidate={onConfirmCandidate} />)

    await user.click(screen.getByRole('button', { name: '我选了大地苏醒' }))
    expect(onConfirmCandidate).toHaveBeenCalledWith(27)
  })

  it('keeps equipment and combination advice visible without candidates', () => {
    const baselineRoute = {
      ...fixtureModel.routes.routes[0],
      candidates: [{
        ...fixtureModel.routes.routes[0].candidates[0],
        source: 'baseline' as const,
        augmentApiName: 'ChampionBaseline',
        augmentName: '英雄基础路线',
      }],
    }
    render(<ArenaDecisionView onConfirmCandidate={vi.fn()} model={{
      ...fixtureModel,
      session: {
        ...fixtureModel.session,
        candidates: { ...fixtureModel.session.candidates, value: [] },
      },
      routes: { routes: [baselineRoute, ...fixtureModel.routes.routes.slice(1)] },
    }} />)

    expect(screen.getByRole('heading', { name: '回城买什么' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '组合方向' })).toBeVisible()
    expect(screen.getByText('英雄基础路线')).toBeVisible()
    expect(screen.getByText('以太精魂')).toBeVisible()
  })
})
