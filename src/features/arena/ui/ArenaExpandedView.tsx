import type { ArenaRouteSet } from '../recommendation/types'
import type { DesktopHealthSnapshot } from '../../../services/tauriHost'
import { DiagnosticsPanel } from './DiagnosticsPanel'

type ArenaExpandedViewProps = {
  routes: ArenaRouteSet
  health?: DesktopHealthSnapshot | null
  onRetry?: () => void | Promise<void>
  onManualMode?: () => void
  onDiscardCache?: () => boolean | Promise<boolean>
  onExport?: () => Promise<string>
}

export function ArenaExpandedView({
  routes,
  health = null,
  onRetry,
  onManualMode,
  onDiscardCache,
  onExport,
}: ArenaExpandedViewProps) {
  return (
    <section className="arena-expanded" aria-label="Arena 路线详情">
      <h2>三条构筑路线</h2>
      <div className="arena-expanded-grid">
        {routes.routes.map((route) => {
          const candidate = route.candidates[0]
          return (
            <article className={`arena-route arena-route--${route.kind}`} key={route.kind}>
              <header>
                <h3>{route.label}</h3>
                {candidate && <strong>{Math.round(candidate.total)}</strong>}
              </header>
              {route.alternativeUnavailable ? (
                <p className="arena-route-unavailable">{route.unavailableReason}</p>
              ) : candidate ? (
                <>
                  <p><b>{candidate.augmentName}</b> · {candidate.riskSummary}</p>
                  <div className="arena-route-components">
                    {candidate.components.map((component) => (
                      <span key={component.key}>{component.label} {component.points >= 0 ? '+' : ''}{component.points}</span>
                    ))}
                  </div>
                  <div className="arena-route-evidence">
                    {candidate.evidence.map((record, index) => <p key={`${record.kind}-${index}`}>{record.claim}</p>)}
                  </div>
                  {candidate.missingNodes.length > 0 && <small>还缺：{candidate.missingNodes.join('、')}</small>}
                </>
              ) : null}
            </article>
          )
        })}
      </div>
      <DiagnosticsPanel
        health={health}
        onRetry={onRetry}
        onManualMode={onManualMode}
        onDiscardCache={onDiscardCache}
        onExport={onExport}
      />
    </section>
  )
}
