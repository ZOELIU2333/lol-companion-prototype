import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Copy, Download, FileText, FolderOpen, RotateCcw } from 'lucide-react'
import type { DesktopHealthCheck, DesktopHealthSnapshot } from '../../../services/tauriHost'

type DiagnosticsPanelProps = {
  health: DesktopHealthSnapshot | null
  onRetry?: () => void | Promise<void>
  onDiscardCache?: () => boolean | Promise<boolean>
  onExport?: () => Promise<string>
  onSelectLeaguePath?: (kind: 'directory' | 'lockfile') => Promise<string | null>
}

type OperationStatus =
  | { kind: 'idle' }
  | { kind: 'success'; path: string }
  | { kind: 'failure'; message: string }

type RecoveryItem = {
  check: DesktopHealthCheck
  message: string
  actionLabel: string
  action: () => unknown
}

export function DiagnosticsPanel({
  health,
  onRetry = () => undefined,
  onDiscardCache = () => false,
  onExport,
  onSelectLeaguePath,
}: DiagnosticsPanelProps) {
  const [selectionStatus, setSelectionStatus] = useState<OperationStatus>({ kind: 'idle' })
  const [exportStatus, setExportStatus] = useState<OperationStatus>({ kind: 'idle' })
  const leagueNeedsSelection = health?.leagueDiscovery.status === 'missing'
    || health?.leagueDiscovery.status === 'degraded'

  if (!health) {
    return <p className="desktop-health-unavailable">桌面诊断仅在 Windows 客户端内可用。</p>
  }

  const recoveries: RecoveryItem[] = []
  if (health.webview2.status !== 'ready') {
    recoveries.push({
      check: health.webview2,
      message: '需要安装或修复 WebView2 Runtime',
      actionLabel: '查看安装说明',
      action: () => window.open('https://developer.microsoft.com/microsoft-edge/webview2/', '_blank', 'noopener,noreferrer'),
    })
  }
  if (!leagueNeedsSelection && health.lcu.status !== 'ready') {
    recoveries.push({
      check: health.lcu,
      message: 'League 客户端暂时无法连接',
      actionLabel: '重新检测',
      action: onRetry,
    })
  }
  if (health.liveClient.status === 'stale') {
    recoveries.push({
      check: health.liveClient,
      message: health.liveClient.ageSeconds === null || health.liveClient.ageSeconds === undefined
        ? 'Live Client 正在重连'
        : `Live Client 正在重连，最近数据为 ${health.liveClient.ageSeconds} 秒前`,
      actionLabel: '重新检测',
      action: onRetry,
    })
  } else if (health.liveClient.status === 'error') {
    recoveries.push({
      check: health.liveClient,
      message: 'Live Client 实时接口连接失败',
      actionLabel: '重新检测',
      action: onRetry,
    })
  }
  if (health.augmentCapability.status === 'unsupported') {
    recoveries.push({
      check: health.augmentCapability,
      message: '自动候选不可用，请改用三个图标手动选择',
      actionLabel: '定位手动输入',
      action: () => {
        const manual = document.querySelector<HTMLElement>('.arena-manual')
        manual?.scrollIntoView?.({ block: 'start' })
        manual?.querySelector<HTMLButtonElement>('[aria-label="添加已选海克斯"]')?.focus()
      },
    })
  }
  if (health.catalog.status !== 'ready') {
    recoveries.push({
      check: health.catalog,
      message: '海克斯目录校验失败，已阻止使用不可信数据',
      actionLabel: '重新检测',
      action: onRetry,
    })
  }
  if (health.runtimeCache.status === 'degraded' || health.runtimeCache.status === 'error') {
    recoveries.push({
      check: health.runtimeCache,
      message: '运行缓存损坏，已回退到内置数据',
      actionLabel: '丢弃无效缓存',
      action: onDiscardCache,
    })
  }

  const exportDiagnostics = async () => {
    if (!onExport) {
      setExportStatus({ kind: 'failure', message: '诊断导出仅在 Windows 客户端内可用' })
      return
    }
    try {
      const path = await onExport()
      setExportStatus({ kind: 'success', path })
    } catch (error) {
      void error
      setExportStatus({
        kind: 'failure',
        message: '诊断包导出失败',
      })
    }
  }

  const selectLeaguePath = async (kind: 'directory' | 'lockfile') => {
    if (!onSelectLeaguePath) {
      setSelectionStatus({ kind: 'failure', message: '路径选择仅在 Windows 客户端内可用' })
      return
    }
    try {
      const path = await onSelectLeaguePath(kind)
      if (!path) {
        setSelectionStatus({ kind: 'idle' })
        return
      }
      setSelectionStatus({ kind: 'success', path })
      await onRetry()
    } catch (error) {
      setSelectionStatus({
        kind: 'failure',
        message: error instanceof Error ? error.message : 'League 路径验证失败',
      })
    }
  }

  const copyExportPath = async () => {
    if (exportStatus.kind !== 'success') return
    await navigator.clipboard.writeText(exportStatus.path)
  }

  return (
    <section className="desktop-health" aria-label="Windows 连接诊断">
      <header>
        <div>
          <h3>Windows 连接诊断</h3>
          <small>{recoveries.length === 0 && !leagueNeedsSelection ? '全部关键通道正常' : `${recoveries.length + Number(leagueNeedsSelection)} 项需要处理`}</small>
        </div>
        {recoveries.length === 0 && !leagueNeedsSelection ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
      </header>

      {recoveries.map((item) => (
        <article className="desktop-health-item" key={`${item.check.code}-${item.message}`}>
          <div><strong>{item.message}</strong><small>{item.check.detail}</small></div>
          <button type="button" onClick={() => void item.action()}>
            <RotateCcw size={13} />{item.actionLabel}
          </button>
        </article>
      ))}

      {leagueNeedsSelection && (
        <article className="desktop-health-path-recovery">
          <div>
            <strong>未能自动连接 League 客户端</strong>
            <small>{health.leagueDiscovery.detail}</small>
          </div>
          <div className="desktop-health-path-actions">
            <button type="button" onClick={() => void onRetry()}>
              <RotateCcw size={13} />重新检测
            </button>
            <button type="button" onClick={() => void selectLeaguePath('directory')}>
              <FolderOpen size={13} />选择 League 目录
            </button>
            <button type="button" onClick={() => void selectLeaguePath('lockfile')}>
              <FileText size={13} />选择 lockfile
            </button>
          </div>
          {selectionStatus.kind === 'success' && (
            <p className="desktop-health-operation-result">
              已保存：<code>{selectionStatus.path}</code>
            </p>
          )}
          {selectionStatus.kind === 'failure' && (
            <p className="desktop-health-operation-error">{selectionStatus.message}</p>
          )}
        </article>
      )}

      <div className="desktop-health-export">
        <button type="button" onClick={() => void exportDiagnostics()}>
          <Download size={14} />导出诊断包
        </button>
        {exportStatus.kind === 'success' && (
          <div className="desktop-health-operation-result">
            <code>{exportStatus.path}</code>
            <button type="button" onClick={() => void copyExportPath()}><Copy size={13} />复制路径</button>
          </div>
        )}
        {exportStatus.kind === 'failure' && <span>{exportStatus.message}</span>}
      </div>
    </section>
  )
}
