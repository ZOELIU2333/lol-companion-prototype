import { useState } from 'react'
import type { PlayerFilter, PlayerIntel } from '../types'
import { createDemoPartyGroups, createDemoRecentMatches } from '../services/playerData'

type PlayerIntelListProps = {
  players: PlayerIntel[]
  filter: PlayerFilter
  onFilterChange: (filter: PlayerFilter) => void
}

const filterLabels: Record<PlayerFilter, string> = {
  ally: '我方',
  enemy: '敌方',
}

function formatMastery(value: number) {
  return `${Math.round(value / 10000)}万`
}

export function PlayerIntelList({ players, filter, onFilterChange }: PlayerIntelListProps) {
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null)
  const visiblePlayers = players.filter((player) => player.team === filter)
  const parties = createDemoPartyGroups(players, filter)
  const playerById = new Map(players.map((player) => [player.id, player]))
  const playerPartyMap = new Map(parties.flatMap((party, index) =>
    party.playerIds.map((playerId) => [playerId, { color: party.color, label: String.fromCharCode(65 + index) }]),
  ))

  return (
    <section className="panel-section">
      <div className="section-title">
        <h3>玩家情报</h3>
        <div className="mini-tabs">
          {(Object.keys(filterLabels) as PlayerFilter[]).map((option) => (
            <button
              key={option}
              className={option === filter ? 'mini-tab active' : 'mini-tab'}
              type="button"
              onClick={() => onFilterChange(option)}
            >
              {filterLabels[option]}
            </button>
          ))}
        </div>
      </div>
      {parties.length > 0 && (
        <div className="party-list" aria-label={`${filterLabels[filter]}组队情况`}>
          {parties.map((party, index) => (
            <article className={`party-card ${party.color}`} key={party.id}>
              <span className="party-code">{String.fromCharCode(65 + index)}</span>
              <div className="party-members" aria-label={party.playerIds.map((playerId) => playerById.get(playerId)?.name).join('、')}>
                {party.playerIds.map((playerId) => {
                  const member = playerById.get(playerId)
                  if (!member) return null
                  return (
                  <span className={`party-avatar ${party.color}`} key={member.id} title={member.name}>
                    {member.role.slice(0, 1)}
                  </span>
                  )
                })}
              </div>
              <span className="party-games">{party.games}</span>
              <b>{party.winRate}%</b>
            </article>
          ))}
        </div>
      )}
      <div className="player-list">
        {visiblePlayers.length === 0 && (
          <p className="empty-state">当前模式暂无玩家公开战绩数据，后续可接入真实数据源。</p>
        )}
        {visiblePlayers.map((player) => {
          const isExpanded = expandedPlayerId === player.id
          const history = createDemoRecentMatches(player)
          const party = playerPartyMap.get(player.id)

          return (
            <article className={`player-card ${player.team} ${party ? `party-${party.color}` : ''} ${isExpanded ? 'expanded' : ''}`} key={player.id}>
              <button
                className="player-card-button"
                type="button"
                aria-expanded={isExpanded}
                onClick={() => setExpandedPlayerId(isExpanded ? null : player.id)}
              >
                <div className="avatar-wrap">
                  <div className="avatar">{player.role.slice(0, 1)}</div>
                  {party && <span className={`party-dot ${party.color}`}>{party.label}</span>}
                </div>
                <div className="player-main">
                  <div className="player-line">
                    <strong>{player.name}</strong>
                    <div className="player-actions">
                      <span>{player.score}</span>
                      <span className="history-cta" aria-hidden="true">{isExpanded ? '收起' : '查看近10场'}</span>
                    </div>
                  </div>
                  <div className="player-meta">
                    {player.role} · {player.rank} · 近{player.recentRankedGames}场排位胜率 {player.recentWinRate}%
                  </div>
                  <div className="player-stats">
                    <span>近{player.championGames}场英雄 {player.championWinRate}%</span>
                    <span>KDA {player.kda}</span>
                    <span>熟练 {formatMastery(player.mastery)}</span>
                  </div>
                  <div className="risk-row">
                    {player.trendTags.map((tag) => (
                      <span className="tag" key={tag}>{tag}</span>
                    ))}
                    {player.risk.labels.map((label) => (
                      <span className={`risk ${player.risk.level}`} key={label}>{label}</span>
                    ))}
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="player-history">
                  <div className="metric-grid">
                    <span>场均死亡 <strong>{player.averageDeaths}</strong></span>
                    <span>场均补刀 <strong>{player.csPerMin}/分</strong></span>
                    <span>参团率 <strong>{player.killParticipation}%</strong></span>
                    <span>场均视野 <strong>{player.visionScore}</strong></span>
                    <span>伤害占比 <strong>{player.damageShare}%</strong></span>
                    <span>15分经济差 <strong>{player.goldDiffAt15 > 0 ? '+' : ''}{player.goldDiffAt15}</strong></span>
                  </div>
                  <div className="history-title">
                    <strong>最近 10 场战绩</strong>
                    <span>Demo · 后续接入 Riot Match API</span>
                  </div>
                  {history.map((historyMatch) => (
                    <div className={`history-row ${historyMatch.result === '胜' ? 'win' : 'loss'}`} key={historyMatch.id}>
                      <span>{historyMatch.result}</span>
                      <div className="history-main">
                        <strong>{historyMatch.champion}</strong>
                        <p>{historyMatch.mode} · {historyMatch.time}</p>
                      </div>
                      <div className="history-stats">
                        <strong>{historyMatch.kda}</strong>
                        <p>CS {historyMatch.cs} · KP {historyMatch.kp}%</p>
                      </div>
                      <b>{historyMatch.score}</b>
                    </div>
                  ))}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
