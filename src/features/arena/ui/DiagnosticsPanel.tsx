import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, RotateCcw } from 'lucide-react'
import type { DesktopHealthCheck, DesktopHealthSnapshot } from '../../../services/tauriHost'

type DiagnosticsPanelProps = {
  health: DesktopHealthSnapshot | null
  onRetry?: () => void | Promise<void>
  onManualMode?: () => void
  onDiscardCache?: () => boolean | Promise<boolean>
  onExport?: () => Promise<string>
}

type RecoveryItem = {
  check: DesktopHealthCheck
  message: string
  actionLabel: string
  action: () => unknown
}

export function DiagnosticsPanel({
  health,
  onRetry = () => undefined,
  onManualMode = () => undefined,
  onDiscardCache = () => false,
  onExport,
}: DiagnosticsPanelProps) {
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'failure'>('idle')

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
  if (health.leagueDiscovery.status === 'missing') {
    recoveries.push({
      check: health.leagueDiscovery,
      message: '未找到 League，仍可使用手动 Arena 模式',
      actionLabel: '使用手动模式',
      action: onManualMode,
    })
  } else if (!['ready', 'degraded'].includes(health.lcu.status)) {
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
      message: `实时数据已过期 ${health.liveClient.ageSeconds ?? 0} 秒`,
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
      actionLabel: '使用手动模式',
      action: onManualMode,
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
      setExportStatus('failure')
      return
    }
    try {
      await onExport()
      setExportStatus('success')
    } catch {
      setExportStatus('failure')
    }
  }

  return (
    <section className="desktop-health" aria-label="Windows 连接诊断">
      <header>
        <div>
          <h3>Windows 连接诊断</h3>
          <small>{recoveries.length === 0 ? '全部关键通道正常' : `${recoveries.length} 项需要处理`}</small>
        </div>
        {recoveries.length === 0 ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
      </header>

      {recoveries.map((item) => (
        <article className="desktop-health-item" key={`${item.check.code}-${item.message}`}>
          <div><strong>{item.message}</strong><small>{item.check.detail}</small></div>
          <button type="button" onClick={() => void item.action()}>
            <RotateCcw size={13} />{item.actionLabel}
          </button>
        </article>
      ))}

      <div className="desktop-health-export">
        <button type="button" onClick={() => void exportDiagnostics()}>
          <Download size={14} />导出诊断包
        </button>
        {exportStatus === 'success' && <span>诊断包已导出</span>}
        {exportStatus === 'failure' && <span>诊断包导出失败</span>}
      </div>
    </section>
  )
}
