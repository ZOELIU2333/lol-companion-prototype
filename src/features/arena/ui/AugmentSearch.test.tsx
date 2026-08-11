// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AugmentSearch } from './AugmentSearch'
import { fixtureModel } from './testFixtures'

afterEach(cleanup)

describe('Arena augment search UI', () => {
  it('searches English names and selects an icon result', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<AugmentSearch catalog={fixtureModel.catalog} unavailable={new Map()} onSelect={onSelect} />)

    await user.type(screen.getByRole('searchbox', { name: '搜索海克斯' }), 'Earthwake')
    await user.click(screen.getByRole('button', { name: /大地苏醒/ }))

    expect(onSelect).toHaveBeenCalledWith(27)
    expect(screen.getByAltText('大地苏醒')).toHaveAttribute('src', expect.stringContaining('earthwake'))
  })

  it('keeps duplicate results visible but disabled with a reason', async () => {
    const user = userEvent.setup()
    render(<AugmentSearch
      catalog={fixtureModel.catalog}
      unavailable={new Map([[27, '已在已选海克斯中']])}
      onSelect={vi.fn()}
    />)

    await user.type(screen.getByRole('searchbox', { name: '搜索海克斯' }), 'Earthwake')
    expect(screen.getByRole('button', { name: /大地苏醒/ })).toBeDisabled()
    expect(screen.getByText('已在已选海克斯中')).toBeVisible()
  })

  it('shows a local empty result state', async () => {
    const user = userEvent.setup()
    render(<AugmentSearch catalog={fixtureModel.catalog} unavailable={new Map()} onSelect={vi.fn()} />)

    await user.type(screen.getByRole('searchbox', { name: '搜索海克斯' }), '不存在的海克斯')
    expect(screen.getByText('没有找到匹配的海克斯')).toBeVisible()
  })
})
