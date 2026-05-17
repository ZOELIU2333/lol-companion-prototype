import type { RunePageRecommendation } from '../types'
import { getRuneIconUrl } from '../services/dataDragon'

type RuneRecommendationProps = {
  embedded?: boolean
  onApplyRunePage: (pageName: string) => void
  runePages: RunePageRecommendation[]
}

export function RuneRecommendation({ embedded = false, onApplyRunePage, runePages }: RuneRecommendationProps) {
  if (embedded) {
    return (
      <section className="embedded-recommendation recommendation-card embedded-runes">
        <div className="section-title">
          <h3>版本强势天赋</h3>
        </div>

        <div className="embedded-rune-list">
          {runePages.slice(0, 2).map((page) => (
            <article className="embedded-rune-row" key={page.id}>
              <div className="embedded-row-meta">
                <strong>{page.name}</strong>
                <span>{page.style}</span>
              </div>
              <div className="rune-icon-row">
                {page.runes.map((rune, index) => (
                  <img
                    alt={rune.name}
                    className={index === 0 ? 'rune-icon keystone' : 'rune-icon'}
                    key={`${page.id}-${rune.id}`}
                    src={getRuneIconUrl(rune.icon)}
                    title={rune.name}
                  />
                ))}
              </div>
              <button className="apply-loadout-button" type="button" onClick={() => onApplyRunePage(page.name)}>
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
        <h3>版本强势天赋</h3>
      </div>

      <div className="rune-page-grid">
        {runePages.map((page) => (
          <article className="rune-page-card" key={page.id}>
            <div className="loadout-header">
              <div>
                <span>{page.style} · {page.primaryTree}/{page.secondaryTree}</span>
                <strong>{page.name}</strong>
              </div>
              <button className="apply-loadout-button" type="button" onClick={() => onApplyRunePage(page.name)}>
                一键应用
              </button>
            </div>
            <div className="rune-icon-row">
              {page.runes.map((rune, index) => (
                <img
                  alt={rune.name}
                  className={index === 0 ? 'rune-icon keystone' : 'rune-icon'}
                  key={`${page.id}-${rune.id}`}
                  src={getRuneIconUrl(rune.icon)}
                  title={rune.name}
                />
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
