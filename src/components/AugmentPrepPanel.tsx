import type { Match } from '../types'

type AugmentPrepPanelProps = {
  match: Match
}

export function AugmentPrepPanel({ match }: AugmentPrepPanelProps) {
  const champion = match.champions.find((candidate) => candidate.id === match.currentChampionId) ?? match.champions[0]

  return (
    <section className="panel-section augment-prep">
      <div className="section-title">
        <h3>海克斯选择原则</h3>
        <span className="demo-pill">对局前</span>
      </div>
      <p className="callout">
        这里不预测某一轮的 3 选 1；只先定本局构筑方向。等候选真的出现后，实时对局页再按已选强化和当前候选重新评分。
      </p>
      <div className="augment-direction-grid">
        <div>
          <span>本局构筑锚点</span>
          <strong>{champion.name} · {champion.identity}</strong>
          <p>优先让强化服务英雄打法，不要看到高评分就把构筑拧成麻花。</p>
        </div>
        <div>
          <span>第一轮思路</span>
          <strong>启动主打法</strong>
          <p>第一轮更看重能不能建立核心节奏：冷却、命中收益、位移后增伤、稳定输出。</p>
        </div>
      </div>
      <div className="target-calls">
        <span>第 1 轮：先拿能启动主打法的强化，别急着补边角料。</span>
        <span>第 2/3 轮：围绕已选强化找同标签或桥接标签，形成一条构筑链。</span>
        <span>避坑：单看当前评分、不看前面已选强化，最容易把一局选成散装拼盘。</span>
      </div>
    </section>
  )
}
