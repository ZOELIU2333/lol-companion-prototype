import { useState } from 'react'
import { Activity, Minimize2, Pin, RefreshCcw } from 'lucide-react'
import type { Champion, ConnectionDiagnostic, DiagnosticStatus, GameMode, Match, RecommendationViewModel } from '../types'
import { ArenaDecisionView } from '../features/arena/ui/ArenaDecisionView'
import { ArenaManualControls } from '../features/arena/ui/ArenaManualControls'
import { ArenaTeammateCard } from '../features/arena/teammate/ArenaTeammateCard'
import type { ArenaTeammateState } from '../features/arena/teammate/useArenaTeammateRating'
import { DiagnosticsPanel } from '../features/arena/ui/DiagnosticsPanel'
import type { ArenaDecisionViewModel } from '../features/arena/ui/types'
import type { DesktopHealthSnapshot } from '../services/tauriHost'
import type { LiveSessionState } from '../app/liveSessionAuthority'
import { ChampionSummary } from './ChampionSummary'
import { ChatBriefPanel } from './ChatBriefPanel'
import { SessionWaitingView } from './SessionWaitingView'
import type { InfoPhase } from '../types'
import type { LcuGamePhase } from '../services/lcuAdapter'
import { getRecommendationSourceDisplay } from '../services/recommendationMeta'

type OverlayPanelProps = {
  activeMode: GameMode
  activePhase: InfoPhase
  arenaDecisionModel: ArenaDecisionViewModel | null
  arenaCandidateSlots: readonly [number | null, number | null, number | null]
  arenaSelectedAugmentIds: number[]
  arenaTeammateState: ArenaTeammateState
  brief: string
  champion: Champion
  connectionStatusLabel: string
  diagnostics: ConnectionDiagnostic[]
  desktopHealth: DesktopHealthSnapshot | null
  isAlwaysOnTop: boolean
  isChampionDataSyncing: boolean
  isCompact: boolean
  isDetected: boolean
  liveSessionState: LiveSessionState
  lcuPhase: LcuGamePhase | null
  match: Match
  recommendations: RecommendationViewModel
  onRefreshDiagnostics: () => void
  onCopy: () => void
  onDiscardRuntimeCache: () => Promise<boolean>
  onExportDiagnostics: () => Promise<string>
  onSelectLeaguePath: (kind: 'directory' | 'lockfile') => Promise<string | null>
  onApplyLoadout: (loadoutName: string) => void
  onApplyRunePage: (pageName: string) => void
  onAddSelectedArenaAugment: (augmentId: number) => void
  onRemoveSelectedArenaAugment: (augmentId: number) => void
  onSetArenaCandidateSlot: (slot: 0 | 1 | 2, augmentId: number) => void
  onClearArenaCandidateSlot: (slot: 0 | 1 | 2) => void
  onConfirmArenaCandidate: (augmentId: number) => void
  onResetArenaMatch: () => void
  onToggleAlwaysOnTop: () => void
  onToggleCompact: () => void
  onSimulateSend: () => void
}

export function OverlayPanel({
  activeMode,
  activePhase,
  arenaDecisionModel,
  arenaCandidateSlots,
  arenaSelectedAugmentIds,
  arenaTeammateState,
  brief,
  champion,
  connectionStatusLabel,
  diagnostics,
  desktopHealth,
  isAlwaysOnTop,
  isChampionDataSyncing,
  isCompact,
  isDetected,
  liveSessionState,
  lcuPhase,
  match,
  recommendations,
  onRefreshDiagnostics,
  onCopy,
  onDiscardRuntimeCache,
  onExportDiagnostics,
  onSelectLeaguePath,
  onApplyLoadout,
  onApplyRunePage,
  onAddSelectedArenaAugment,
  onRemoveSelectedArenaAugment,
  onSetArenaCandidateSlot,
  onClearArenaCandidateSlot,
  onConfirmArenaCandidate,
  onResetArenaMatch,
  onToggleAlwaysOnTop,
  onToggleCompact,
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
          <button className="icon-button" type="button" onClick={onRefreshDiagnostics} aria-label="刷新连接状态" title="刷新连接状态">
            <RefreshCcw size={17} />
          </button>
        </div>
      </header>

      <div className="status-strip" data-tauri-drag-region>
        <span>
          <span className={isDetected ? 'dot online' : 'dot'} />
          {connectionStatusLabel}
        </span>
        <strong>{match.map}</strong>
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
            刷新状态
          </button>
          {diagnostics.map((item) => (
            <div className="diagnostic-row" key={item.id}>
              <span className={`diagnostic-dot diagnostic-dot--${item.status}`} />
              <strong>{item.label}</strong>
              <DiagnosticStatusLabel status={item.status} />
              <p>{item.detail}</p>
            </div>
          ))}
          {activeMode === 'ranked' && (
            <DiagnosticsPanel
              health={desktopHealth}
              onRetry={onRefreshDiagnostics}
              onDiscardCache={onDiscardRuntimeCache}
              onExport={onExportDiagnostics}
              onSelectLeaguePath={onSelectLeaguePath}
            />
          )}
        </div>
      )}

      {activeMode === 'arena' && lcuPhase === 'ChampSelect' && (
        <ArenaTeammateCard state={arenaTeammateState} />
      )}

      {liveSessionState === 'waiting' && !(activeMode === 'arena' && lcuPhase === 'ChampSelect') && (
        <SessionWaitingView connectionStatusLabel={connectionStatusLabel} />
      )}

      {liveSessionState !== 'waiting' && activeMode === 'ranked' && activePhase === 'pregame' && (
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

      {liveSessionState !== 'waiting' && activeMode === 'arena' && (
        arenaDecisionModel ? (
          <>
            <ArenaManualControls
              catalog={arenaDecisionModel.catalog}
              selectedIds={arenaSelectedAugmentIds}
              candidateSlots={arenaCandidateSlots}
              onAddSelected={onAddSelectedArenaAugment}
              onRemoveSelected={onRemoveSelectedArenaAugment}
              onSetCandidateSlot={onSetArenaCandidateSlot}
              onClearCandidateSlot={onClearArenaCandidateSlot}
              onConfirmCandidate={onConfirmArenaCandidate}
              onResetMatch={onResetArenaMatch}
            />
            <ArenaDecisionView
              model={arenaDecisionModel}
              onConfirmCandidate={onConfirmArenaCandidate}
              health={desktopHealth}
              onRetry={onRefreshDiagnostics}
              onDiscardCache={onDiscardRuntimeCache}
              onExport={onExportDiagnostics}
              onSelectLeaguePath={onSelectLeaguePath}
            />
          </>
        ) : <p className="arena-loading">正在校验海克斯与装备目录…</p>
      )}
    </aside>
  )
}

function DiagnosticStatusLabel({ status }: { status: DiagnosticStatus }) {
  const label = status === 'online' ? '正常' : status === 'checking' ? '检测中' : status === 'demo' ? 'Demo' : '未连接'
  return <em className={`diagnostic-status diagnostic-status--${status}`}>{label}</em>
}
