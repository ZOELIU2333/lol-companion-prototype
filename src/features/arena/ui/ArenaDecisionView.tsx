import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { ArenaExpandedView } from './ArenaExpandedView'
import { ArenaIcon } from './ArenaIcon'
import type { ArenaDecisionViewModel } from './types'
import type { DesktopHealthSnapshot } from '../../../services/tauriHost'

type ArenaDecisionViewProps = {
  model: ArenaDecisionViewModel
  onConfirmCandidate: (augmentId: number) => void
  health?: DesktopHealthSnapshot | null
  onRetry?: () => void | Promise<void>
  onDiscardCache?: () => boolean | Promise<boolean>
  onExport?: () => Promise<string>
  onSelectLeaguePath?: (kind: 'directory' | 'lockfile') => Promise<string | null>
}

export function ArenaDecisionView({
  model,
  onConfirmCandidate,
  health = null,
  onRetry,
  onDiscardCache,
  onExport,
  onSelectLeaguePath,
}: ArenaDecisionViewProps) {
  const [expanded, setExpanded] = useState(false)
  const candidates = model.session.candidates.value.slice(0, 3)
    .map((id) => model.catalog.find(id))
    .filter((candidate) => candidate !== null)
  const leadingRoute = model.routes.routes.find((route) => !route.alternativeUnavailable && route.purchasePlan)
  const purchase = leadingRoute?.purchasePlan

  return (
    <div className="arena-decision">
      <div className="arena-decision-meta">
        <span>{model.sourceLabel}</span>
        {model.session.candidates.state === 'stale' && <strong>候选数据可能过期</strong>}
      </div>

      <section className="arena-step" aria-labelledby="arena-choice-heading">
        <div className="arena-step-heading"><span>01</span><h2 id="arena-choice-heading">本轮选什么</h2></div>
        {candidates.length === 3 ? (
          <div className="arena-candidate-grid">
            {candidates.map((augment) => {
              const routeCandidate = model.routes.routes
                .flatMap((route) => route.candidates)
                .find((candidate) => candidate.augmentApiName === augment.apiName)
              return (
                <article className="arena-candidate-card" data-testid="arena-candidate" key={augment.id}>
                  <ArenaIcon alt={augment.name} src={augment.iconLargeUrl ?? augment.iconSmallUrl} />
                  <div><strong>{augment.name}</strong><span>{routeCandidate ? Math.round(routeCandidate.total) : '—'}</span></div>
                  <small>{routeCandidate?.components[0]?.reason ?? augment.description}</small>
                  <button
                    aria-label={`我选了${augment.name}`}
                    className="arena-candidate-confirm"
                    type="button"
                    onClick={() => onConfirmCandidate(augment.id)}
                  >我选了这个</button>
                </article>
              )
            })}
          </div>
        ) : (
          <p className="arena-empty-state">还需录入 {3 - candidates.length} 个候选；组合与装备基础路线已经可用。</p>
        )}
      </section>

      <section className="arena-step" aria-labelledby="arena-combination-heading">
        <div className="arena-step-heading"><span>02</span><h2 id="arena-combination-heading">组合方向</h2></div>
        <p className="arena-combination-label">{model.comboLabel}</p>
        <div className="arena-combination-routes">
          {model.routes.routes.map((route) => {
            const candidate = route.candidates[0]
            if (!candidate) {
              return <article className={`arena-combination-route arena-combination-route--${route.kind}`} key={route.kind}>
                <strong>{route.label}</strong><span>{route.unavailableReason}</span>
              </article>
            }
            const sourceLabel = candidate.source === 'future-target'
              ? '后续寻找'
              : candidate.source === 'baseline'
                ? '英雄基础'
                : candidate.source === 'selected-combination'
                  ? '已选联动'
                  : '本轮候选'
            return (
              <article className={`arena-combination-route arena-combination-route--${route.kind}`} key={route.kind}>
                <div><strong>{route.label}</strong><em>{sourceLabel}</em></div>
                <span>{candidate.augmentName}</span>
                {route.purchasePlan && <small>→ {route.purchasePlan.firstCompletedItem.name}</small>}
              </article>
            )
          })}
        </div>
      </section>

      <section className="arena-step" aria-labelledby="arena-buy-heading">
        <div className="arena-step-heading"><span>03</span><h2 id="arena-buy-heading">回城买什么</h2></div>
        {purchase ? (
          <div className="arena-purchase-row">
            {purchase.buyNow && (
              <div className="arena-purchase-primary">
                <ArenaIcon alt={purchase.buyNow.name} src={purchase.buyNow.iconUrl} />
                <p><small>现在买 · {purchase.buyNow.purchaseCost}g</small><strong>{purchase.buyNow.name}</strong></p>
              </div>
            )}
            <i>→</i>
            <div className="arena-purchase-target">
              <ArenaIcon alt={purchase.firstCompletedItem.name} src={purchase.firstCompletedItem.iconUrl} />
              <p><small>第一件成装</small><strong>{purchase.firstCompletedItem.name}</strong></p>
            </div>
            {purchase.laterItems[0] && (
              <><i>→</i><div className="arena-purchase-later"><ArenaIcon alt={purchase.laterItems[0].name} src={purchase.laterItems[0].iconUrl} /><small>后续</small></div></>
            )}
          </div>
        ) : <p className="arena-empty-state">等待装备与金币数据。</p>}
      </section>

      <button className="arena-expand-button" type="button" onClick={() => setExpanded((value) => !value)}>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        {expanded ? '收起路线详情' : '展开路线详情'}
      </button>
      {expanded && (
        <ArenaExpandedView
          routes={model.routes}
          health={health}
          onRetry={onRetry}
          onDiscardCache={onDiscardCache}
          onExport={onExport}
          onSelectLeaguePath={onSelectLeaguePath}
        />
      )}
    </div>
  )
}
