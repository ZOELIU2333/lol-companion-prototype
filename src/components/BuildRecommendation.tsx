import type { BuildRecommendation as BuildRecommendationType } from '../types'
import { getItemIconUrl } from '../services/dataDragon'

type BuildRecommendationProps = {
  embedded?: boolean
  onApplyLoadout: (loadoutName: string) => void
  recommendation: BuildRecommendationType
}

export function BuildRecommendation({ embedded = false, onApplyLoadout, recommendation }: BuildRecommendationProps) {
  if (embedded) {
    return (
      <section className="embedded-recommendation recommendation-card embedded-builds">
        <div className="section-title">
          <h3>版本强势出装</h3>
        </div>

        <div className="embedded-build-list">
          {recommendation.loadouts.slice(0, 3).map((loadout) => (
            <article className="embedded-build-row" key={loadout.id}>
              <div className="embedded-row-meta">
                <strong>{loadout.style}</strong>
                <span>{loadout.score}%</span>
              </div>
              <div className="item-icon-row">
                {loadout.items.map((item) => (
                  <img
                    alt={item.name}
                    className="item-icon"
                    key={`${loadout.id}-${item.id}`}
                    src={getItemIconUrl(item.iconId)}
                    title={item.name}
                  />
                ))}
              </div>
              <button className="apply-loadout-button" type="button" onClick={() => onApplyLoadout(loadout.name)}>
                一键应用
              </button>
            </article>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className={embedded ? 'embedded-recommendation recommendation-card' : 'panel-section recommendation-card'}>
      <div className="section-title">
        <h3>版本强势出装</h3>
      </div>

      <div className="loadout-grid">
        {recommendation.loadouts.map((loadout) => (
          <article className="loadout-card" key={loadout.id}>
            <div className="loadout-header">
              <div>
                <span>{loadout.score}%</span>
                <strong>{loadout.style}</strong>
              </div>
              <button className="apply-loadout-button" type="button" onClick={() => onApplyLoadout(loadout.name)}>
                一键应用
              </button>
            </div>
            <div className="item-icon-row">
              {loadout.items.map((item) => (
                <img
                  alt={item.name}
                  className="item-icon"
                  key={`${loadout.id}-${item.id}`}
                  src={getItemIconUrl(item.iconId)}
                  title={item.name}
                />
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
