import './App.css'
import { useEffect } from 'react'
import { useCompanionSession } from './app/useCompanionSession'
import { GameShell } from './components/GameShell'
import { OverlayPanel } from './components/OverlayPanel'
import { Toast } from './components/Toast'
import { startOverlayDragging } from './services/tauriHost'
import { shouldStartWindowDrag } from './services/windowDrag'

function App() {
  const session = useCompanionSession()

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      const isScrollbar = event.clientX >= document.documentElement.clientWidth
        || event.clientY >= document.documentElement.clientHeight
      if (isScrollbar || !shouldStartWindowDrag(event.target, event.button)) return

      void startOverlayDragging()
    }

    document.addEventListener('mousedown', handleMouseDown, true)
    return () => document.removeEventListener('mousedown', handleMouseDown, true)
  }, [])

  return (
    <>
      <GameShell activeMode={session.activeMode} champion={session.champion} match={session.match}>
        <OverlayPanel
          activeMode={session.activeMode}
          activePhase={session.effectivePhase}
          brief={session.brief}
          champion={session.champion}
          connectionStatusLabel={session.connectionStatusLabel}
          diagnostics={session.diagnostics}
          isAlwaysOnTop={session.isAlwaysOnTop}
          isChampionDataSyncing={session.isChampionDataSyncing}
          isCompact={session.isCompact}
          isDetected={session.isDetected}
          match={session.match}
          matches={session.availableMatches}
          mayhemRecommendationMode={session.mayhemRecommendationMode}
          recommendations={session.recommendations}
          onApplyLoadout={session.applyLoadout}
          onApplyRunePage={session.applyRunePage}
          onCopy={session.copyBrief}
          onMayhemModeChange={session.onMayhemModeChange}
          onRefreshDiagnostics={session.refreshDiagnostics}
          onRefresh={session.refreshMatch}
          onScenarioChange={session.selectScenario}
          onSimulateSend={session.simulateSend}
          onToggleAlwaysOnTop={session.toggleAlwaysOnTop}
          onToggleCompact={session.toggleCompact}
        />
      </GameShell>
      {session.toast && <Toast message={session.toast} />}
    </>
  )
}

export default App
