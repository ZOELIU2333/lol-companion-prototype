import './App.css'
import { useCompanionSession } from './app/useCompanionSession'
import { GameShell } from './components/GameShell'
import { OverlayPanel } from './components/OverlayPanel'
import { Toast } from './components/Toast'

function App() {
  const session = useCompanionSession()

  return (
    <>
      <GameShell
        activeMode={session.activeMode}
        champion={session.champion}
        hasRealPlayerIntel={session.hasRealPlayerIntel}
        key={session.liveSessionState}
        liveSessionState={session.liveSessionState}
        match={session.match}
      >
        <OverlayPanel
          activeMode={session.activeMode}
          activePhase={session.effectivePhase}
          arenaDecisionModel={session.arenaDecisionModel}
          arenaCandidateSlots={session.arenaCandidateSlots}
          arenaSelectedAugmentIds={session.arenaSelectedAugmentIds}
          arenaTeammateState={session.arenaTeammateState}
          brief={session.brief}
          champion={session.champion}
          connectionStatusLabel={session.connectionStatusLabel}
          diagnostics={session.diagnostics}
          desktopHealth={session.desktopHealth}
          isAlwaysOnTop={session.isAlwaysOnTop}
          isChampionDataSyncing={session.isChampionDataSyncing}
          isCompact={session.isCompact}
          isDetected={session.isDetected}
          liveSessionState={session.liveSessionState}
          lcuPhase={session.lcuPhase}
          match={session.match}
          recommendations={session.recommendations}
          onApplyLoadout={session.applyLoadout}
          onApplyRunePage={session.applyRunePage}
          onAddSelectedArenaAugment={session.addSelectedArenaAugment}
          onRemoveSelectedArenaAugment={session.removeSelectedArenaAugment}
          onSetArenaCandidateSlot={session.setArenaCandidateSlot}
          onClearArenaCandidateSlot={session.clearArenaCandidateSlot}
          onConfirmArenaCandidate={session.confirmArenaCandidate}
          onResetArenaMatch={session.resetArenaMatch}
          onCopy={session.copyBrief}
          onDiscardRuntimeCache={session.discardInvalidRuntimeCache}
          onExportDiagnostics={session.exportDiagnostics}
          onRefreshDiagnostics={session.refreshDiagnostics}
          onSelectLeaguePath={session.selectLeagueInstallation}
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
