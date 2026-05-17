import type { ArenaRecommendation as ArenaRecommendationType } from '../types'

type ArenaRecommendationProps = {
  recommendation: ArenaRecommendationType
}

export function ArenaRecommendation({ recommendation }: ArenaRecommendationProps) {
  return (
    <section className="panel-section recommendation-card">
      <div className="section-title">
        <h3>斗魂策略</h3>
        <span className="status-warn">高机动局</span>
      </div>
      <p className="callout">{recommendation.priority}</p>
      <div className="threat-list">
        {recommendation.threats.map((threat) => (
          <div className={`threat ${threat.severity}`} key={threat.label}>
            <strong>{threat.label}</strong>
            <span>{threat.advice}</span>
          </div>
        ))}
      </div>
      <div className="item-row">
        {recommendation.upgrades.map((upgrade) => (
          <span className="item-chip" key={upgrade}>{upgrade}</span>
        ))}
      </div>
      <div className="arena-plan">
        {recommendation.roundPlan.map((step) => (
          <article key={step.phase}>
            <strong>{step.phase}</strong>
            <p>{step.action}</p>
          </article>
        ))}
      </div>
      <div className="matchup-rules">
        {recommendation.matchupRules.map((rule) => (
          <article key={rule.enemyStyle}>
            <span>{rule.enemyStyle}</span>
            <p>{rule.response}</p>
          </article>
        ))}
      </div>
      <p className="muted">{recommendation.strategy}</p>
    </section>
  )
}
