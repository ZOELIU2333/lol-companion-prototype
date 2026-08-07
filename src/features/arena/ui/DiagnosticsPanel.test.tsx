// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DesktopHealthSnapshot } from '../../../services/tauriHost'
import { DiagnosticsPanel } from './DiagnosticsPanel'

afterEach(cleanup)

const ready = (code: string) => ({ code, status: 'ready' as const, detail: `${code} ready` })
const baseHealth: DesktopHealthSnapshot = {
  generatedAtMs: 1000,
  shell: ready('shell'),
  webview2: ready('webview2'),
  leagueDiscovery: ready('league-discovery'),
  lcu: ready('lcu'),
  liveClient: ready('live-client'),
  augmentCapability: ready('augment-capability'),
  catalog: ready('catalog'),
  runtimeCache: ready('runtime-cache'),
  logs: ready('logs'),
}

describe('desktop diagnostics panel', () => {
  it('offers automatic retry and both native League path selectors', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const onSelectLeaguePath = vi.fn()
      .mockResolvedValueOnce('D:\\Riot Games\\League of Legends')
      .mockResolvedValueOnce('E:\\League\\League of Legends')
    render(<DiagnosticsPanel health={{
      ...baseHealth,
      leagueDiscovery: {
        code: 'league-not-found', status: 'missing', detail: 'League lockfile was not found',
        recoveryCode: 'select-league-path',
      },
    }} onRetry={onRetry} onSelectLeaguePath={onSelectLeaguePath} />)

    await user.click(screen.getByRole('button', { name: '重新检测' }))
    await user.click(screen.getByRole('button', { name: '选择 League 目录' }))
    expect(await screen.findByText('D:\\Riot Games\\League of Legends')).toBeVisible()
    await user.click(screen.getByRole('button', { name: '选择 lockfile' }))
    expect(await screen.findByText('E:\\League\\League of Legends')).toBeVisible()
    expect(onRetry).toHaveBeenCalledTimes(3)
    expect(onSelectLeaguePath).toHaveBeenNthCalledWith(1, 'directory')
    expect(onSelectLeaguePath).toHaveBeenNthCalledWith(2, 'lockfile')
  })

  it('explains reconnecting realtime data and unsupported automatic augment capture', () => {
    render(<DiagnosticsPanel health={{
      ...baseHealth,
      liveClient: {
        code: 'live-client-reconnecting', status: 'stale', detail: '暂时保留最近快照', ageSeconds: 6,
        recoveryCode: 'retry',
      },
      augmentCapability: {
        code: 'augment-unsupported', status: 'unsupported', detail: 'endpoint unavailable',
        recoveryCode: 'manual-arena',
      },
    }} />)

    expect(screen.getByText(/Live Client 正在重连/)).toBeVisible()
    expect(screen.getByText(/6 秒前/)).toBeVisible()
    expect(screen.getByText('自动候选不可用，请改用三个图标手动选择')).toBeVisible()
  })

  it('shows only the safe lockfile parse category', () => {
    render(<DiagnosticsPanel health={{
      ...baseHealth,
      leagueDiscovery: {
        code: 'league-invalid',
        status: 'degraded',
        detail: '找到了 League 路径，但 lockfile 无法解析（协议无效）',
        recoveryCode: 'select-league-path',
      },
    }} />)

    expect(screen.getByText(/lockfile 无法解析/)).toBeVisible()
    expect(document.body.textContent).not.toContain('fixture-password')
  })

  it('shows cache and WebView2 recovery actions', () => {
    render(<DiagnosticsPanel health={{
      ...baseHealth,
      webview2: {
        code: 'webview2-missing', status: 'missing', detail: 'runtime missing',
        recoveryCode: 'install-webview2',
      },
      runtimeCache: {
        code: 'cache-corrupt', status: 'degraded', detail: 'invalid json',
        recoveryCode: 'discard-cache',
      },
    }} />)

    expect(screen.getByText('需要安装或修复 WebView2 Runtime')).toBeVisible()
    expect(screen.getByRole('button', { name: '查看安装说明' })).toBeVisible()
    expect(screen.getByText('运行缓存损坏，已回退到内置数据')).toBeVisible()
    expect(screen.getByRole('button', { name: '丢弃无效缓存' })).toBeVisible()
  })

  it('reports diagnostic export success and failure', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const onExport = vi.fn()
      .mockResolvedValueOnce('C:\\Logs\\diagnostics.zip')
      .mockRejectedValueOnce(new Error('failed'))
    render(<DiagnosticsPanel health={baseHealth} onExport={onExport} />)

    const button = screen.getByRole('button', { name: '导出诊断包' })
    await user.click(button)
    expect(await screen.findByText('C:\\Logs\\diagnostics.zip')).toBeVisible()
    await user.click(screen.getByRole('button', { name: '复制路径' }))
    expect(writeText).toHaveBeenCalledWith('C:\\Logs\\diagnostics.zip')
    await user.click(button)
    expect(await screen.findByText('诊断包导出失败')).toBeVisible()
  })
})
