import type { AugmentRecommendation as AugmentRecommendationType } from '../types'
import type { MayhemConfidence, MayhemRecommendationMode } from '../features/mayhem/types'
import { mayhemSnapshot } from '../data/mayhemSnapshot'
import { getAugmentIconUrl } from '../services/augmentIcons'

type AugmentRecommendationProps = {
  augments: AugmentRecommendationType[]
  mode: MayhemRecommendationMode
  onModeChange: (mode: MayhemRecommendationMode) => void
}

const confidenceLabels: Record<MayhemConfidence, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

const snapshotIsStale = Date.now() > Date.parse(mayhemSnapshot.expiresAt)

export function AugmentRecommendation({ augments, mode, onModeChange }: AugmentRecommendationProps) {
  const dataSourceLabel = augments[0]?.dataSourceLabel ?? '本地规则推理'

  return (
    <section className="panel-section recommendation-card">
      <div className="section-title">
        <div>
          <h3>本轮待选海克斯</h3>
          <span className="augment-source-note">
            {dataSourceLabel} · {mayhemSnapshot.patch}
            {snapshotIsStale && <span className="status-warn">数据版本 {mayhemSnapshot.patch} · 已过期</span>}
          </span>
        </div>
        <div className="mayhem-mode-switch" role="group" aria-label="海克斯推荐模式">
          <button type="button" aria-pressed={mode === 'strength'} onClick={() => onModeChange('strength')}>
            强度
          </button>
          <button type="button" aria-pressed={mode === 'off-meta'} onClick={() => onModeChange('off-meta')}>
            黑科技
          </button>
        </div>
      </div>
      <div className="augment-list">
        {augments.map((augment, index) => {
          const iconUrl = getAugmentIconUrl(augment.name)
          const sample = typeof augment.mayhemGames === 'number' ? `${augment.mayhemGames} 局` : '样本 —'
          const confidence = augment.mayhemConfidence ? `置信 ${confidenceLabels[augment.mayhemConfidence]}` : '置信 —'

          return (
            <article className="augment-card" key={augment.id}>
              <div className="augment-card-icon" aria-hidden="true">
                {iconUrl && <img alt="" src={iconUrl} />}
              </div>
              <div>
                <span className="rank-label">#{index + 1}</span>
                <strong>{augment.name}</strong>
                {augment.observing && <span className="status-muted">观察中</span>}
                <p className="augment-reason augment-score-reason">{augment.scoreReason}</p>
                <span className="augment-evidence">
                  {sample} · {confidence}
                </span>
                {/* Item-icon row is intentionally omitted: demo/fallback entries carry no
                    associated item ids, and fabricating items would violate the honest-data rule.
                    It renders here once real per-augment itemIds are threaded onto the entry. */}
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
