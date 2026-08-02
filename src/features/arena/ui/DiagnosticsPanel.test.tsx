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
  it('offers manual Arena mode when League is not found', () => {
    render(<DiagnosticsPanel health={{
      ...baseHealth,
      leagueDiscovery: {
        code: 'league-not-found', status: 'missing', detail: 'League lockfile was not found',
        recoveryCode: 'manual-arena',
      },
    }} />)

    expect(screen.getByText('未找到 League，仍可使用手动 Arena 模式')).toBeVisible()
    expect(screen.getByRole('button', { name: '使用手动模式' })).toBeVisible()
  })

  it('explains stale realtime data and unsupported automatic augment capture', () => {
    render(<DiagnosticsPanel health={{
      ...baseHealth,
      liveClient: {
        code: 'live-client-stale', status: 'stale', detail: 'snapshot stale', ageSeconds: 18,
        recoveryCode: 'retry',
      },
      augmentCapability: {
        code: 'augment-unsupported', status: 'unsupported', detail: 'endpoint unavailable',
        recoveryCode: 'manual-arena',
      },
    }} />)

    expect(screen.getByText('实时数据已过期 18 秒')).toBeVisible()
    expect(screen.getByText('自动候选不可用，请改用三个图标手动选择')).toBeVisible()
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
    const onExport = vi.fn()
      .mockResolvedValueOnce('C:\\Logs\\diagnostics.zip')
      .mockRejectedValueOnce(new Error('failed'))
    render(<DiagnosticsPanel health={baseHealth} onExport={onExport} />)

    const button = screen.getByRole('button', { name: '导出诊断包' })
    await user.click(button)
    expect(await screen.findByText('诊断包已导出')).toBeVisible()
    await user.click(button)
    expect(await screen.findByText('诊断包导出失败')).toBeVisible()
  })
})
