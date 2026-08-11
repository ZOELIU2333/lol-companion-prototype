// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SessionWaitingView } from './SessionWaitingView'

afterEach(cleanup)

describe('SessionWaitingView', () => {
  it('shows a real connection waiting state without Demo controls', () => {
    render(<SessionWaitingView connectionStatusLabel="已连接客户端" />)

    expect(screen.getByRole('heading', { name: '等待进入游戏' })).toBeVisible()
    expect(screen.getByText('已连接客户端')).toBeVisible()
    expect(screen.getByText(/进入对局后会自动读取/)).toBeVisible()
    expect(document.body.textContent).not.toContain('Demo 场景')
  })
})
