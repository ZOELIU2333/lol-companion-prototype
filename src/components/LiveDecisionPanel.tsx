import type { GameMode, Match, RecommendationViewModel } from '../types'
import { getAugmentIconUrl } from '../services/augmentIcons'
import { getItemIconUrl } from '../services/dataDragon'

type LiveDecisionPanelProps = {
  activeMode: GameMode
  match: Match
  recommendations: RecommendationViewModel
}

export function LiveDecisionPanel({ activeMode, match, recommendations }: LiveDecisionPanelProps) {
  if (activeMode === 'augment') {
    return (
      <section className="panel-section live-panel augment-live-panel">
        <div className="section-title">
          <h3>实时对局</h3>
          <span className="status-good">{match.liveState.minute} 分钟</span>
        </div>

        <div className="selected-augment-strip">
          <span>已选海克斯</span>
          <div className="selected-augment-list">
            {recommendations.live.augmentContext.selected.length === 0 && (
              <span className="status-muted">等待游戏同步</span>
            )}
            {recommendations.live.augmentContext.selected.map((augment) => {
              const iconUrl = getAugmentIconUrl(augment)

              return (
                <div className="selected-augment-card" key={augment}>
                  <div className="selected-augment-icon" aria-hidden="true">
                    {iconUrl && <img alt="" src={iconUrl} />}
                  </div>
                  <strong>{augment}</strong>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="panel-section live-panel">
      <div className="section-title">
        <h3>实时对局</h3>
        <span className="status-good">{match.liveState.minute} 分钟</span>
      </div>

      <p className="callout">{recommendations.live.tacticalRead}</p>

      <div className="live-state-grid">
        <div>
          <span>当前金币</span>
          <strong>{match.liveState.goldOnHand}</strong>
        </div>
        <div>
          <span>下个资源</span>
          <strong>{match.liveState.nextObjective}</strong>
        </div>
      </div>

      <div className="live-action-list">
        {recommendations.live.nextTwoMinutes.map((action) => (
          <p key={action}>{action}</p>
        ))}
      </div>

      {activeMode === 'ranked' && (
        <div className="next-item-card">
          <span>下一件建议</span>
          <div className="item-icon-row live-icons">
            <img
              alt=""
              aria-hidden="true"
              className="item-icon"
              src={getItemIconUrl(recommendations.live.nextItem.iconId)}
            />
          </div>
        </div>
      )}
    </section>
  )
}
