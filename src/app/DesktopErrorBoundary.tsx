import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react'

type DesktopErrorBoundaryProps = {
  children: ReactNode
}

type DesktopErrorBoundaryState = {
  error: Error | null
}

const fallbackStyle = {
  boxSizing: 'border-box',
  minHeight: '100vh',
  padding: '32px 24px',
  background: '#070b12',
  color: '#e5e7eb',
  font: '14px/1.6 system-ui, sans-serif',
} as const

export class DesktopErrorBoundary extends Component<DesktopErrorBoundaryProps, DesktopErrorBoundaryState> {
  state: DesktopErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): DesktopErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const boot = window.__LOL_COMPANION_BOOT__
    if (boot) {
      boot.ready = true
      const detail = [error.message, error.stack, info.componentStack]
        .filter(Boolean)
        .join(' | ')
        .slice(0, 500)
      boot.report('react-render-error', detail)
    }

    const fallback = document.getElementById('boot-fallback')
    if (fallback) fallback.hidden = true
  }

  render() {
    if (this.state.error) {
      return (
        <main role="alert" style={fallbackStyle}>
          <h1 style={{ margin: '0 0 12px', fontSize: 20 }}>界面渲染失败</h1>
          <p style={{ margin: 0, color: '#94a3b8' }}>
            已阻止黑屏。请关闭后重新打开；如果仍然失败，请发送最新诊断日志。
          </p>
          <code style={{ display: 'block', marginTop: 16, color: '#60a5fa' }}>
            %LOCALAPPDATA%\LOL Companion\logs
          </code>
        </main>
      )
    }

    return this.props.children
  }
}

export function FrontendReadyMarker() {
  useEffect(() => {
    const boot = window.__LOL_COMPANION_BOOT__
    if (boot) {
      boot.ready = true
      boot.report('frontend-ready')
    }
    const fallback = document.getElementById('boot-fallback')
    if (fallback) fallback.hidden = true
  }, [])

  return null
}
