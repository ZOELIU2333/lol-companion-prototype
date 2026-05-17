import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Match } from '../types'

type MatchIntelProps = {
  match: Match
}

export function MatchIntel({ match }: MatchIntelProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const delta = match.intel.allyAverageScore - match.intel.enemyAverageScore

  return (
    <section className="panel-section">
      <div className="section-title">
        <h3>对局情报</h3>
        <span className={delta >= 0 ? 'status-good' : 'status-warn'}>
          {delta >= 0 ? `我方 +${delta}` : `敌方 +${Math.abs(delta)}`}
        </span>
      </div>
      <div className="intel-grid">
        <div>
          <span>我方均分</span>
          <strong>{match.intel.allyAverageScore}</strong>
        </div>
        <div>
          <span>敌方均分</span>
          <strong>{match.intel.enemyAverageScore}</strong>
        </div>
        <div>
          <span>控制压力</span>
          <strong>{match.enemyComposition.crowdControl}</strong>
        </div>
        <div>
          <span>AP 威胁</span>
          <strong>{match.enemyComposition.apThreat}</strong>
        </div>
      </div>

      <button className="open-detail-button" type="button" onClick={() => setIsDetailOpen(true)}>
        查看完整详情
      </button>

      {isDetailOpen && createPortal(
        <div className="match-detail-backdrop" role="dialog" aria-modal="true" aria-label="对局详情">
          <div className="match-detail-panel">
            <div className="match-detail-header">
              <div>
                <span>对局详情</span>
                <h3>阵容与威胁拆解</h3>
              </div>
              <button type="button" onClick={() => setIsDetailOpen(false)} aria-label="关闭对局详情">关闭</button>
            </div>

            <div className="intel-grid detail-grid">
              <div>
                <span>我方均分</span>
                <strong>{match.intel.allyAverageScore}</strong>
              </div>
              <div>
                <span>敌方均分</span>
                <strong>{match.intel.enemyAverageScore}</strong>
              </div>
              <div>
                <span>控制压力</span>
                <strong>{match.enemyComposition.crowdControl}</strong>
              </div>
              <div>
                <span>AP 威胁</span>
                <strong>{match.enemyComposition.apThreat}</strong>
              </div>
            </div>

            <div className="threat-meters">
              {match.intel.threatBreakdown.map((threat) => (
                <div className="threat-meter" key={threat.label}>
                  <div className="meter-head">
                    <span>{threat.label}</span>
                    <strong>{threat.value}</strong>
                  </div>
                  <div className="meter-track">
                    <div style={{ width: `${threat.value}%` }} />
                  </div>
                  <p>{threat.note}</p>
                </div>
              ))}
            </div>

            <div className="plan-grid intel-summary-grid">
              <div>
                <span>阵容倾向</span>
                <p>{match.intel.compositionNote}</p>
              </div>
              <div>
                <span>强势窗口</span>
                <p>{match.intel.powerSpike}</p>
              </div>
              <div>
                <span>最高威胁</span>
                <p>{match.intel.topThreat}</p>
              </div>
              <div>
                <span>胜负抓手</span>
                <p>{match.intel.winCondition}</p>
              </div>
            </div>

            <div className="target-calls detail-calls">
              {match.intel.targetCalls.map((call) => (
                <span key={call}>{call}</span>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  )
}
