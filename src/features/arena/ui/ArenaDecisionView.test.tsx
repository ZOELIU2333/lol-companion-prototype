// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ArenaDecisionView } from './ArenaDecisionView'
import { fixtureModel } from './testFixtures'

afterEach(cleanup)

describe('Arena decision view', () => {
  it('shows candidate icons, affordable purchase, and a labeled combo chain', () => {
    render(<ArenaDecisionView model={fixtureModel} />)

    expect(screen.getByRole('heading', { name: '本轮选什么' })).toBeVisible()
    expect(screen.getByAltText('大地苏醒')).toHaveAttribute('src', expect.stringContaining('earthwake'))
    expect(screen.getByText('以太精魂')).toBeVisible()
    expect(screen.getByText('位移爆发循环')).toBeVisible()
    expect(screen.getAllByTestId('arena-candidate')).toHaveLength(3)
  })

  it('swaps a failed remote image to the bundled placeholder', () => {
    render(<ArenaDecisionView model={fixtureModel} />)
    const image = screen.getByAltText('大地苏醒')

    fireEvent.error(image)
    expect(image).toHaveAttribute('src', '/assets/arena-placeholder.svg')
  })

  it('opens the three-route expanded view', () => {
    render(<ArenaDecisionView model={fixtureModel} />)

    fireEvent.click(screen.getByRole('button', { name: '展开路线详情' }))
    expect(screen.getByRole('heading', { name: '三条构筑路线' })).toBeVisible()
    expect(screen.getByText('黑科技路线')).toBeVisible()
  })

  it('labels stale candidate observations', () => {
    render(<ArenaDecisionView model={{
      ...fixtureModel,
      session: { ...fixtureModel.session, candidates: { ...fixtureModel.session.candidates, state: 'stale' } },
    }} />)

    expect(screen.getByText('候选数据可能过期')).toBeVisible()
  })
})
