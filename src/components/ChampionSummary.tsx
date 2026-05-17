import type { BuildRecommendation as BuildRecommendationType, Champion, RunePageRecommendation } from '../types'
import { formatRecommendationRate, formatRecommendationSampleSize } from '../services/recommendationMeta'
import { getChampionIconUrl } from '../services/dataDragon'
import { BuildRecommendation } from './BuildRecommendation'
import { RuneRecommendation } from './RuneRecommendation'

type ChampionSummaryProps = {
  champion: Champion
  onApplyLoadout?: (loadoutName: string) => void
  onApplyRunePage?: (pageName: string) => void
  recommendation?: BuildRecommendationType
  runePages?: RunePageRecommendation[]
  showScore?: boolean
  score: number
}

export function ChampionSummary({
  champion,
  onApplyLoadout,
  onApplyRunePage,
  recommendation,
  runePages = [],
  showScore = true,
  score,
}: ChampionSummaryProps) {
  const meta = recommendation?.meta
  const counters = recommendation?.meta?.counters ?? []

  return (
    <section className="panel-section champion-summary">
      <div className="champion-summary-main">
        <div className="opgg-hero-head">
          <img src={getChampionIconUrl(champion.id)} alt={champion.name} />
          <div>
            <p className="eyebrow">当前英雄</p>
            <h2>{champion.name}</h2>
            <p>{champion.role} · {champion.identity}</p>
          </div>
        </div>
        {showScore && (
          <div className="champion-score">
            <strong>{score}</strong>
            <span>适配</span>
          </div>
        )}
      </div>

      {meta && (
        <div className="champion-opgg-stats" aria-label="OP.GG hero statistics">
          <div>
            <span>胜率</span>
            <strong>{formatRecommendationRate(meta.winRate)}</strong>
          </div>
          <div>
            <span>登场率</span>
            <strong>{formatRecommendationRate(meta.pickRate)}</strong>
          </div>
          <div>
            <span>榜单</span>
            <strong>{meta.championRank ? `#${meta.championRank}` : '-'}</strong>
          </div>
          <div>
            <span>适配</span>
            <strong>{score}</strong>
          </div>
          <small>{formatRecommendationSampleSize(meta.sampleSize)}</small>
        </div>
      )}

      {counters.length > 0 && (
        <div className="counter-strip">
          <span>克制关注</span>
          <div>
            {counters.slice(0, 3).map((counter) => (
              <img
                alt={counter.championName}
                key={counter.championKey}
                src={getChampionIconUrl(counter.championKey)}
                title={counter.championName}
              />
            ))}
          </div>
        </div>
      )}

      {onApplyRunePage && runePages.length > 0 && (
        <RuneRecommendation embedded runePages={runePages} onApplyRunePage={onApplyRunePage} />
      )}

      {onApplyLoadout && recommendation && (
        <BuildRecommendation embedded recommendation={recommendation} onApplyLoadout={onApplyLoadout} />
      )}
    </section>
  )
}
