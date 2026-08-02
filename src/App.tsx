import './App.css'
import { useCompanionSession } from './app/useCompanionSession'
import { GameShell } from './components/GameShell'
import { OverlayPanel } from './components/OverlayPanel'
import { Toast } from './components/Toast'

function App() {
  const session = useCompanionSession()

  return (
    <>
      <GameShell activeMode={session.activeMode} champion={session.champion} match={session.match}>
        <OverlayPanel
          activeMode={session.activeMode}
          activePhase={session.effectivePhase}
          arenaDecisionModel={session.arenaDecisionModel}
          brief={session.brief}
          champion={session.champion}
          connectionStatusLabel={session.connectionStatusLabel}
          diagnostics={session.diagnostics}
          desktopHealth={session.desktopHealth}
          isAlwaysOnTop={session.isAlwaysOnTop}
          isChampionDataSyncing={session.isChampionDataSyncing}
          isCompact={session.isCompact}
          isDetected={session.isDetected}
          match={session.match}
          matches={session.availableMatches}
          recommendations={session.recommendations}
          onApplyLoadout={session.applyLoadout}
          onApplyRunePage={session.applyRunePage}
          onArenaCandidates={session.setArenaCandidates}
          onCopy={session.copyBrief}
          onDiscardRuntimeCache={session.discardInvalidRuntimeCache}
          onExportDiagnostics={session.exportDiagnostics}
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
