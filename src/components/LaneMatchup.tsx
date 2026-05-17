import type { LaneMatchup as LaneMatchupType } from '../types'

type LaneMatchupProps = {
  matchup: LaneMatchupType
}

export function LaneMatchup({ matchup }: LaneMatchupProps) {
  return (
    <section className="panel-section lane-matchup">
      <div className="section-title">
        <h3>对线风险</h3>
        <span className={matchup.difficulty === '劣势' ? 'status-warn' : 'status-good'}>
          {matchup.difficulty} · {matchup.confidence}
        </span>
      </div>

      <div className="lane-versus">
        <strong>{matchup.lane}</strong>
        <span>{matchup.allyChampion} vs {matchup.enemyChampions.join(' + ')}</span>
      </div>

      <div className="lane-plan-grid compact-lane">
        <div>
          <span>风险摘要</span>
          <p>{matchup.enemyChampions.join(' + ')} 对线压制强度 {matchup.confidence}，当前判定为{matchup.difficulty}。</p>
        </div>
        <div>
          <span>主要窗口</span>
          <p>{matchup.dangerWindows[0]?.timing} · {matchup.dangerWindows[0]?.threat}</p>
        </div>
      </div>

      <div className="danger-window-list">
        {matchup.dangerWindows.slice(0, 2).map((window) => (
          <article key={window.timing}>
            <strong>{window.timing}</strong>
            <p>{window.threat}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
