import { useState } from 'react'
import { Activity, Minimize2, Pin, RefreshCcw } from 'lucide-react'
import type { Champion, ConnectionDiagnostic, DiagnosticStatus, GameMode, Match, RecommendationViewModel } from '../types'
import type { MayhemRecommendationMode } from '../features/mayhem/types'
import { AugmentRecommendation } from './AugmentRecommendation'
import { ChampionSummary } from './ChampionSummary'
import { ChatBriefPanel } from './ChatBriefPanel'
import { LiveDecisionPanel } from './LiveDecisionPanel'
import type { InfoPhase } from '../types'
import { getRecommendationSourceDisplay } from '../services/recommendationMeta'

type OverlayPanelProps = {
  activeMode: GameMode
  activePhase: InfoPhase
  brief: string
  champion: Champion
  connectionStatusLabel: string
  diagnostics: ConnectionDiagnostic[]
  isAlwaysOnTop: boolean
  isChampionDataSyncing: boolean
  isCompact: boolean
  isDetected: boolean
  hasActiveSession: boolean
  hasTrustedRecommendationData: boolean
  isClientConnected: boolean
  match: Match
  mayhemRecommendationMode: MayhemRecommendationMode
  recommendations: RecommendationViewModel
  onRefreshDiagnostics: () => void
  onCopy: () => void
  onApplyLoadout: (loadoutName: string) => void
  onApplyRunePage: (pageName: string) => void
  onMayhemModeChange: (mode: MayhemRecommendationMode) => void
  onToggleAlwaysOnTop: () => void
  onToggleCompact: () => void
  onRefresh: () => void
  onSimulateSend: () => void
}

export function OverlayPanel({
  activeMode,
  activePhase,
  brief,
  champion,
  connectionStatusLabel,
  diagnostics,
  isAlwaysOnTop,
  isChampionDataSyncing,
  isCompact,
  isDetected,
  hasActiveSession,
  hasTrustedRecommendationData,
  isClientConnected,
  match,
  mayhemRecommendationMode,
  recommendations,
  onRefreshDiagnostics,
  onCopy,
  onApplyLoadout,
  onApplyRunePage,
  onMayhemModeChange,
  onToggleAlwaysOnTop,
  onToggleCompact,
  onRefresh,
  onSimulateSend,
}: OverlayPanelProps) {
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false)
  const sourceDisplay = getRecommendationSourceDisplay(recommendations.build.meta, isChampionDataSyncing)
  const worstStatus = diagnostics.some((item) => item.status === 'offline')
    ? 'offline'
    : diagnostics.some((item) => item.status === 'checking')
      ? 'checking'
      : diagnostics.some((item) => item.status === 'demo')
        ? 'demo'
        : 'online'

  return (
    <aside className="overlay-panel" aria-label="LOL companion overlay">
      <header className="overlay-header" data-tauri-drag-region>
        <div>
          <p className="eyebrow">LOL Companion</p>
          <h1>本局助手</h1>
        </div>
        <div className="header-actions" data-tauri-drag-region="false">
          <button
            className={isAlwaysOnTop ? 'icon-button active' : 'icon-button'}
            type="button"
            onClick={onToggleAlwaysOnTop}
            aria-label={isAlwaysOnTop ? '取消置顶' : '置顶悬浮窗'}
            title={isAlwaysOnTop ? '取消置顶' : '置顶悬浮窗'}
          >
            <Pin size={16} />
          </button>
          <button
            className={isCompact ? 'icon-button active' : 'icon-button'}
            type="button"
            onClick={onToggleCompact}
            aria-label={isCompact ? '恢复标准窗口' : '切换紧凑窗口'}
            title={isCompact ? '恢复标准窗口' : '切换紧凑窗口'}
          >
            <Minimize2 size={16} />
          </button>
          <button className="icon-button" type="button" onClick={onRefresh} aria-label="刷新情报" title="刷新情报">
            <RefreshCcw size={17} />
          </button>
        </div>
      </header>

      <div className="status-strip" data-tauri-drag-region>
        <span>
          <span className={isDetected ? 'dot online' : 'dot'} />
          {connectionStatusLabel}
        </span>
        {hasActiveSession && <strong>{match.map}</strong>}
        <button
          className={`diagnostic-toggle diagnostic-toggle--${worstStatus}`}
          type="button"
          onClick={() => setIsDiagnosticsOpen((value) => !value)}
          aria-expanded={isDiagnosticsOpen}
          aria-label="查看连接诊断"
          title="查看连接诊断"
        >
          <Activity size={14} />
          诊断
        </button>
      </div>

      {isDiagnosticsOpen && (
        <div className="diagnostic-panel">
          <button className="diagnostic-refresh" type="button" onClick={onRefreshDiagnostics}>
            重新检测
          </button>
          {diagnostics.map((item) => (
            <div className="diagnostic-row" key={item.id}>
              <span className={`diagnostic-dot diagnostic-dot--${item.status}`} />
              <strong>{item.label}</strong>
              <DiagnosticStatusLabel status={item.status} />
              <p>{item.detail}</p>
            </div>
          ))}
        </div>
      )}

      {!hasActiveSession && (
        <section className="connection-waiting" aria-live="polite">
          <span className={isClientConnected ? 'connection-waiting-dot online' : 'connection-waiting-dot'} />
          <h2>{isClientConnected ? '已连接客户端，等待对局' : '等待 League Client'}</h2>
          <p>{isClientConnected ? '进入选人或游戏后，情报会自动出现。' : '启动英雄联盟客户端后会自动连接，无需手动刷新。'}</p>
        </section>
      )}

      {hasActiveSession && !hasTrustedRecommendationData && (
        <section className="session-intel-waiting">
          <h2>真实对局已连接</h2>
          <p>正在同步玩家公开数据。英雄与版本推荐会在确认真实英雄后显示。</p>
        </section>
      )}

      {hasActiveSession && hasTrustedRecommendationData && activeMode === 'ranked' && activePhase === 'pregame' && (
        <>
          <div className="recommendation-source-line" title={sourceDisplay.title}>
            <span>数据来源：{sourceDisplay.label}</span>
            <span className={`source-status source-status--${sourceDisplay.tone}`}>{sourceDisplay.status}</span>
          </div>
          <ChampionSummary
            champion={champion}
            recommendation={recommendations.build}
            runePages={recommendations.runes}
            score={recommendations.build.score}
            onApplyLoadout={onApplyLoadout}
            onApplyRunePage={onApplyRunePage}
          />
          <ChatBriefPanel brief={brief} onCopy={onCopy} onSimulateSend={onSimulateSend} />
        </>
      )}

      {hasActiveSession && hasTrustedRecommendationData && activeMode === 'augment' && (
        <>
          <LiveDecisionPanel activeMode={activeMode} match={match} recommendations={recommendations} />
          <AugmentRecommendation
            augments={recommendations.augments}
            mode={mayhemRecommendationMode}
            onModeChange={onMayhemModeChange}
          />
        </>
      )}
    </aside>
  )
}

function DiagnosticStatusLabel({ status }: { status: DiagnosticStatus }) {
  const label = status === 'online' ? '正常' : status === 'checking' ? '检测中' : status === 'demo' ? 'Demo' : '未连接'
  return <em className={`diagnostic-status diagnostic-status--${status}`}>{label}</em>
}
