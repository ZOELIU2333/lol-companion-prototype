// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AugmentPicker } from './AugmentPicker'
import { fixtureModel } from './testFixtures'

afterEach(cleanup)

describe('Arena manual augment picker', () => {
  it('searches Chinese, English, and API names with the keyboard', async () => {
    const user = userEvent.setup()
    render(<AugmentPicker catalog={fixtureModel.catalog} onConfirm={vi.fn()} />)

    await user.type(screen.getByRole('searchbox', { name: '搜索海克斯' }), 'Earthwake')
    expect(screen.getByRole('button', { name: /大地苏醒/ })).toBeVisible()
    expect(screen.queryByRole('button', { name: /法术苏醒/ })).not.toBeInTheDocument()
  })

  it('confirms only after exactly three unique choices', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<AugmentPicker catalog={fixtureModel.catalog} onConfirm={onConfirm} />)

    for (const name of ['大地苏醒', '超凡邪恶', '法术苏醒']) {
      await user.click(screen.getByRole('button', { name: new RegExp(name) }))
    }
    await user.click(screen.getByRole('button', { name: '确认三个候选' }))

    expect(onConfirm).toHaveBeenCalledWith([27, 65, 135])
  })
})
