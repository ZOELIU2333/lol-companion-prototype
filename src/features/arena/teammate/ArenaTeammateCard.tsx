import { UserRoundSearch } from 'lucide-react'
import type { ArenaTeammateState } from './useArenaTeammateRating'

export function ArenaTeammateCard({ state }: { state: ArenaTeammateState }) {
  if (state.status === 'hidden') return null

  const iconUrl = state.championId
    ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${state.championId}.png`
    : null

  return (
    <section className={`arena-teammate arena-teammate--${state.status}`} aria-label="本局队友">
      <div className="arena-teammate-avatar">
        {iconUrl ? <img alt="" src={iconUrl} /> : <UserRoundSearch aria-hidden="true" size={22} />}
      </div>
      <div className="arena-teammate-main">
        <div className="arena-teammate-heading">
          <p><span>本局队友</span><strong>{state.teammateName}</strong></p>
          {state.status === 'loading' ? (
            <em>正在读取公开战绩</em>
          ) : (
            <div className={`arena-horse-tier arena-horse-tier--${state.rating.label}`}>
              <strong>{state.rating.label}</strong>
              {state.rating.score !== null && <b>{state.rating.score}</b>}
            </div>
          )}
        </div>
        {state.status === 'loading' ? (
          <div className="arena-teammate-loading"><i /><span>OP.GG 优先，Riot 数据兜底</span></div>
        ) : state.status === 'insufficient' ? (
          <p className="arena-teammate-reason">{state.reason}</p>
        ) : (
          <p className="arena-teammate-reason">{state.rating.reasons.join(' · ')}</p>
        )}
        {state.status !== 'loading' && (
          <div className="arena-teammate-meta">
            <span>{state.rating.source === 'opgg' ? 'OP.GG' : state.rating.source === 'riot' ? 'Riot API' : '暂无来源'}</span>
            <span>{state.rating.sampleSize} 场样本</span>
            <span>{state.rating.confidence === 'high' ? '高置信' : state.rating.confidence === 'medium' ? '中置信' : '低置信'}</span>
          </div>
        )}
      </div>
    </section>
  )
}
