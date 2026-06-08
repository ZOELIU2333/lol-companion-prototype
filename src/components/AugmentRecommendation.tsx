import type { AugmentRecommendation as AugmentRecommendationType } from '../types'
import { getAugmentIconUrl } from '../services/augmentIcons'

type AugmentRecommendationProps = {
  augments: AugmentRecommendationType[]
}

export function AugmentRecommendation({ augments }: AugmentRecommendationProps) {
  const dataSourceLabel = augments[0]?.dataSourceLabel ?? '本地规则推理'

  return (
    <section className="panel-section recommendation-card">
      <div className="section-title">
        <div>
          <h3>本轮待选海克斯</h3>
          <span className="augment-source-note">{dataSourceLabel}</span>
        </div>
        <span className="demo-pill">3 选 1</span>
      </div>
      <div className="augment-list">
        {augments.map((augment, index) => {
          const iconUrl = getAugmentIconUrl(augment.name)

          return (
            <article className="augment-card" key={augment.id}>
              <div className="augment-card-icon" aria-hidden="true">
                {iconUrl && <img alt="" src={iconUrl} />}
              </div>
              <div>
                <span className="rank-label">#{index + 1}</span>
                <strong>{augment.name}</strong>
                <div className="selected-synergy">
                  <span>与已选强化</span>
                  <strong>协同 {augment.selectedSynergyScore}</strong>
                </div>
                <p className="augment-reason">{augment.selectedSynergy}</p>
                <p className="augment-reason augment-score-reason">{augment.scoreReason}</p>
              </div>
              <div className="augment-score">
                <strong>{augment.score}</strong>
                <span>{augment.scoreLabel}</span>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
