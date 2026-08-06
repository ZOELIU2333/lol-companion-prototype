// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DesktopErrorBoundary } from './DesktopErrorBoundary'

afterEach(() => {
  cleanup()
  delete window.__LOL_COMPANION_BOOT__
})

function BrokenView(): never {
  throw new Error('render exploded')
}

describe('DesktopErrorBoundary', () => {
  it('replaces a render crash with recovery UI and a diagnostic stage', () => {
    const report = vi.fn()
    window.__LOL_COMPANION_BOOT__ = { ready: false, report }

    render(<DesktopErrorBoundary><BrokenView /></DesktopErrorBoundary>)

    expect(screen.getByRole('heading', { name: '界面渲染失败' })).toBeVisible()
    expect(screen.getByText(/重新打开/)).toBeVisible()
    expect(report).toHaveBeenCalledWith('react-render-error', expect.stringContaining('render exploded'))
  })
})
