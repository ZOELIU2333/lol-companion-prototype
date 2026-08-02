// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ArenaExpandedView } from './ArenaExpandedView'
import { fixtureRoutes } from './testFixtures'

afterEach(cleanup)

describe('Arena expanded routes', () => {
  it('renders all three objectives and their evidence', () => {
    render(<ArenaExpandedView routes={fixtureRoutes} />)

    expect(screen.getByText('稳健路线')).toBeVisible()
    expect(screen.getByText('上限路线')).toBeVisible()
    expect(screen.getByText('黑科技路线')).toBeVisible()
    expect(screen.getAllByText('已核对位移触发。')).toHaveLength(3)
  })

  it('explains when no credible alternative exists', () => {
    render(<ArenaExpandedView routes={{ routes: [
      fixtureRoutes.routes[0],
      fixtureRoutes.routes[1],
      {
        kind: 'off-meta', label: '黑科技路线', coreSignature: 'unavailable:off-meta', candidates: [],
        alternativeUnavailable: true, unavailableReason: '没有同时满足机制复核与路线差异的黑科技组合。',
      },
    ] }} />)

    expect(screen.getByText('没有同时满足机制复核与路线差异的黑科技组合。')).toBeVisible()
  })
})
