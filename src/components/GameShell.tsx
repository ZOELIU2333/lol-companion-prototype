import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Match, PlayerIntel, PlayerMatchDetail, PlayerPartyGroup, PlayerRecentMatch } from '../types'
import { createBrowserRiotApiHost } from '../services/browserRiotHost'
import { getItemIconUrl } from '../services/dataDragon'
import { loadOpggMatchDetail, loadOpggPlayerProfile, loadOpggRecentMatches } from '../services/opggPlayerData'
import { getRiotAccountForPlayer, loadRiotPlayerProfile, loadRiotRecentMatches } from '../services/riotPlayerData'
import { createTauriOpggMcpHost } from '../services/tauriHost'
import { createTauriRiotApiHost } from '../services/tauriRiotHost'
import type { OpggMcpPlayerProfile } from '../services/opggMcpAdapter'
import type { RiotPlayerProfile } from '../services/riotApiAdapter'

type GameShellProps = {
  match: Match
  children: ReactNode
}

type PlayerDataStatus = 'loading' | 'opgg' | 'riot' | 'unavailable'

const roleShortLabels: Record<string, string> = {
  上单: '上',
  打野: '野',
  中路: '中',
  下路: '下',
  辅助: '辅',
}

function getRoleShortLabel(role: string) {
  return roleShortLabels[role] ?? role.slice(0, 1)
}

function formatMastery(value: number) {
  return `${Math.round(value / 10000)}万`
}

function formatChampionMasteryName(championId: number) {
  return `英雄 #${championId}`
}

function profileToPlayerIntel(player: PlayerIntel, profile?: RiotPlayerProfile, opggProfile?: OpggMcpPlayerProfile): PlayerIntel {
  if (!profile && !opggProfile) return player

  return {
    ...player,
    rank: profile?.rank !== '未查询到排位' ? profile?.rank ?? opggProfile?.rank ?? player.rank : opggProfile?.rank ?? player.rank,
    recentWinRate: profile?.recentWinRate || opggProfile?.rankedWinRate || player.recentWinRate,
    kda: profile?.averageKda || player.kda,
    csPerMin: profile?.csPerMin || player.csPerMin,
    killParticipation: profile?.killParticipation || player.killParticipation,
    score: profile?.score || player.score,
    recentRankedGames: profile?.rankedGames || opggProfile?.rankedGames || player.recentRankedGames,
    averageDeaths: profile?.averageDeaths || player.averageDeaths,
    visionScore: profile?.visionScore || player.visionScore,
    damageShare: profile?.damageShare || player.damageShare,
    risk: {
      ...player.risk,
      confidence: 'public-data',
    },
  }
}

async function runLimited<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  const queue = [...items]
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()
      if (item) await worker(item)
    }
  })

  await Promise.all(runners)
}

function getPlayerDataStatusLabel(status: PlayerDataStatus) {
  if (status === 'loading') return '同步中'
  if (status === 'opgg') return 'OP.GG'
  if (status === 'riot') return 'Riot'
  return '暂无数据'
}

function getPlayerDataStatusTitle(status: PlayerDataStatus) {
  if (status === 'loading') return '正在读取玩家公开数据'
  if (status === 'opgg') return '来自 OP.GG MCP 的公开玩家数据'
  if (status === 'riot') return '来自 Riot API 的公开玩家数据'
  return '没有查询到可用的公开数据'
}

function PlayerDataSource({ status }: { status: PlayerDataStatus }) {
  return (
    <span className={`player-data-source player-data-source--${status}`} title={getPlayerDataStatusTitle(status)}>
      {getPlayerDataStatusLabel(status)}
    </span>
  )
}

export function GameShell({ match, children }: GameShellProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerIntel | null>(null)
  const [selectedHistoryMatch, setSelectedHistoryMatch] = useState<PlayerRecentMatch | null>(null)
  const [matchDetailById, setMatchDetailById] = useState<Record<string, PlayerMatchDetail>>({})
  const [matchDetailStatusById, setMatchDetailStatusById] = useState<Record<string, 'loading' | 'opgg' | 'unavailable'>>({})
  const [realHistoryByPlayerId, setRealHistoryByPlayerId] = useState<Record<string, PlayerRecentMatch[]>>({})
  const [historyStatusByPlayerId, setHistoryStatusByPlayerId] = useState<Record<string, PlayerDataStatus>>({})
  const [profileByPlayerId, setProfileByPlayerId] = useState<Record<string, RiotPlayerProfile>>({})
  const [opggProfileByPlayerId, setOpggProfileByPlayerId] = useState<Record<string, OpggMcpPlayerProfile>>({})
  const [profileStatusByPlayerId, setProfileStatusByPlayerId] = useState<Record<string, PlayerDataStatus>>({})
  const riotHost = useMemo(() => createTauriRiotApiHost() ?? createBrowserRiotApiHost(), [])
  const opggHost = useMemo(() => createTauriOpggMcpHost(), [])
  const hydratedPlayers = useMemo(
    () => match.players.map((player) => profileToPlayerIntel(player, profileByPlayerId[player.id], opggProfileByPlayerId[player.id])),
    [match.players, opggProfileByPlayerId, profileByPlayerId],
  )
  const allyPlayers = hydratedPlayers.filter((player) => player.team === 'ally')
  const enemyPlayers = hydratedPlayers.filter((player) => player.team === 'enemy')
  const hasStageIntel = allyPlayers.length > 0 || enemyPlayers.length > 0
  const parties: PlayerPartyGroup[] = []
  const playerById = new Map(hydratedPlayers.map((player) => [player.id, player]))
  const playerPartyMap = new Map(
    parties.flatMap((party, index) =>
      party.playerIds.map((playerId) => [
        playerId,
        {
          color: party.color,
          games: party.games,
          label: String.fromCharCode(65 + index),
          winRate: party.winRate,
        },
      ]),
    ),
  )
  const openPlayerDetail = (player: PlayerIntel) => {
    setSelectedHistoryMatch(null)
    setSelectedPlayer(player)

    const account = getRiotAccountForPlayer(player)
    setHistoryStatusByPlayerId((current) => ({
      ...current,
      [player.id]: (riotHost || opggHost) && account && !realHistoryByPlayerId[player.id]
        ? 'loading'
        : current[player.id] ?? 'unavailable',
    }))
    setProfileStatusByPlayerId((current) => ({
      ...current,
      [player.id]: (riotHost || opggHost) && account && !profileByPlayerId[player.id] && !opggProfileByPlayerId[player.id]
        ? 'loading'
        : current[player.id] ?? 'unavailable',
    }))
  }
  const renderTeam = (teamPlayers: typeof allyPlayers, team: 'ally' | 'enemy') => {
    const teamParties = parties.filter((party) => party.team === team)

    return (
      <div className={`stage-team ${team}`}>
        {teamParties.length > 0 && (
          <div className="stage-party-row">
            {teamParties.map((party, index) => (
              <span className={`stage-party-pill ${party.color}`} key={party.id}>
                <b>{String.fromCharCode(65 + index)}</b>
                {party.playerIds
                  .map((playerId) => {
                    const role = playerById.get(playerId)?.role
                    return role ? getRoleShortLabel(role) : null
                  })
                  .filter(Boolean)
                  .join('/')} · {party.games}场 {party.winRate}%
              </span>
            ))}
          </div>
        )}
        {teamPlayers.map((player) => {
          const party = playerPartyMap.get(player.id)
          const riotProfile = profileByPlayerId[player.id]
          const opggProfile = opggProfileByPlayerId[player.id]
          const hasPublicProfile = Boolean(riotProfile || opggProfile)
          const profileStatus = profileStatusByPlayerId[player.id]
          const publicScore = riotProfile?.score ?? opggProfile?.championPoolTop3[0]?.opScore
          return (
            <button
              className={`stage-player ${party ? `party-${party.color}` : ''}`}
              key={player.id}
              type="button"
              onClick={() => openPlayerDetail(player)}
            >
              <div className="stage-player-top">
                <span className="stage-role" data-role={getRoleShortLabel(player.role)} aria-label={player.role} />
                <div>
                  <strong>{player.name}</strong>
                  <span>
                    {hasPublicProfile
                      ? `${player.rank} · 近${player.recentRankedGames}场 ${player.recentWinRate}%`
                      : profileStatus === 'loading' ? '公开数据同步中' : '公开数据暂无'}
                  </span>
                </div>
                {party && <b title={`${party.games}场车队胜率 ${party.winRate}%`}>{party.label}</b>}
                <em>{publicScore ? Math.round(publicScore) : '--'}</em>
              </div>
              {player.live && (
                <div className={`stage-player-live ${player.live.isDead ? 'dead' : ''}`}>
                  <span className="stage-player-live-champion">{player.live.championName ?? '未知英雄'}</span>
                  <span className="stage-player-live-stat">
                    {player.live.level ? `Lv${player.live.level}` : 'Lv-'}
                    {player.live.kills !== null && player.live.deaths !== null && player.live.assists !== null
                      ? ` · ${player.live.kills}/${player.live.deaths}/${player.live.assists}`
                      : ''}
                    {player.live.isDead ? ' · 阵亡' : ''}
                  </span>
                </div>
              )}
              {riotProfile && (
                <div className="stage-player-metrics">
                  <span><i>排位</i> <strong>{riotProfile.rankedGames}场</strong> <strong>{riotProfile.recentWinRate}%</strong></span>
                  <span><i>KDA</i> <strong>{riotProfile.averageKda}</strong></span>
                  <span><i>均死</i> <strong>{riotProfile.averageDeaths}</strong></span>
                </div>
              )}
              {!riotProfile && opggProfile && (
                <div className="stage-player-metrics">
                  <span><i>排位</i> <strong>{opggProfile.rankedGames}场</strong> <strong>{opggProfile.rankedWinRate}%</strong></span>
                  {opggProfile.championPoolTop3[0] && (
                    <span><i>常用</i> <strong>{opggProfile.championPoolTop3[0].championName}</strong></span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    )
  }
  const selectedParty = selectedPlayer ? playerPartyMap.get(selectedPlayer.id) : null
  const selectedHistory = selectedPlayer ? realHistoryByPlayerId[selectedPlayer.id] ?? [] : []
  const selectedHistoryStatus = selectedPlayer
    ? historyStatusByPlayerId[selectedPlayer.id] ?? 'unavailable'
    : 'unavailable'
  const selectedProfile = selectedPlayer ? profileByPlayerId[selectedPlayer.id] : null
  const selectedOpggProfile = selectedPlayer ? opggProfileByPlayerId[selectedPlayer.id] : null
  const hasSelectedProfileData = Boolean(selectedProfile || selectedOpggProfile)
  const selectedPublicScore = selectedProfile?.score ?? selectedOpggProfile?.championPoolTop3[0]?.opScore
  const selectedProfileStatus = selectedPlayer
    ? profileStatusByPlayerId[selectedPlayer.id] ?? 'unavailable'
    : 'unavailable'
  const selectedMastery =
    selectedProfile?.masteryTop3.length
      ? selectedProfile.masteryTop3.map((entry) => ({
          champion: formatChampionMasteryName(entry.championId),
          games: entry.level,
          mastery: entry.mastery,
          winRate: 0,
        }))
      : selectedOpggProfile?.championPoolTop3.length
        ? selectedOpggProfile.championPoolTop3.map((entry) => ({
            champion: entry.championName,
            games: entry.games,
            mastery: 0,
            winRate: entry.winRate,
          }))
      : []
  const selectedRealMatchDetail = selectedHistoryMatch ? matchDetailById[selectedHistoryMatch.id] : null
  const selectedMatchDetailStatus = selectedHistoryMatch
    ? matchDetailStatusById[selectedHistoryMatch.id] ?? 'unavailable'
    : 'unavailable'

  useEffect(() => {
    if (!riotHost) return undefined

    const playersToLoad = match.players
      .map((player) => ({ player, account: getRiotAccountForPlayer(player) }))
      .filter(
        (entry) => {
          const needsProfile = !profileByPlayerId[entry.player.id] && !opggProfileByPlayerId[entry.player.id] && !profileStatusByPlayerId[entry.player.id]
          const needsHistory = !realHistoryByPlayerId[entry.player.id] && !historyStatusByPlayerId[entry.player.id]

          return Boolean(entry.account && riotHost && (needsProfile || needsHistory))
        },
      )

    if (playersToLoad.length === 0) return undefined

    let isStale = false

    void Promise.resolve().then(() =>
      runLimited(playersToLoad, 2, async ({ player, account }) => {
        if (!account || isStale) return

        setProfileStatusByPlayerId((current) => ({ ...current, [player.id]: 'loading' }))
        setHistoryStatusByPlayerId((current) => ({ ...current, [player.id]: 'loading' }))

        const [profile, history] = await Promise.all([
          profileByPlayerId[player.id] ? Promise.resolve(profileByPlayerId[player.id]) : loadRiotPlayerProfile(riotHost, account),
          realHistoryByPlayerId[player.id]
            ? Promise.resolve(realHistoryByPlayerId[player.id])
            : loadRiotRecentMatches(riotHost, account, 10),
        ])

        if (isStale) return

        if (profile) {
          setProfileByPlayerId((current) => ({ ...current, [player.id]: profile }))
          setProfileStatusByPlayerId((current) => ({ ...current, [player.id]: 'riot' }))
        } else {
          setProfileStatusByPlayerId((current) => ({ ...current, [player.id]: 'unavailable' }))
        }

        if (history.length > 0) {
          setRealHistoryByPlayerId((current) => ({ ...current, [player.id]: history }))
          setHistoryStatusByPlayerId((current) => ({ ...current, [player.id]: 'riot' }))
        } else {
          setHistoryStatusByPlayerId((current) => ({ ...current, [player.id]: 'unavailable' }))
        }
      }),
    )

    return () => {
      isStale = true
    }
  }, [
    historyStatusByPlayerId,
    match.players,
    opggProfileByPlayerId,
    profileByPlayerId,
    profileStatusByPlayerId,
    realHistoryByPlayerId,
    riotHost,
  ])

  useEffect(() => {
    if (!selectedPlayer) return undefined

    const account = getRiotAccountForPlayer(selectedPlayer)
    if (!account || (!riotHost && !opggHost) || realHistoryByPlayerId[selectedPlayer.id]) return undefined

    let isStale = false

    Promise.resolve()
      .then(async () => {
        const riotHistory = riotHost ? await loadRiotRecentMatches(riotHost, account, 10) : []
        if (riotHistory.length > 0) return { history: riotHistory, source: 'riot' as const }
        return { history: await loadOpggRecentMatches(opggHost, selectedPlayer, 10), source: 'opgg' as const }
      })
      .then(({ history, source }) => {
      if (isStale) return
      if (history.length === 0) {
        setHistoryStatusByPlayerId((current) => ({ ...current, [selectedPlayer.id]: 'unavailable' }))
        return
      }

      setRealHistoryByPlayerId((current) => ({ ...current, [selectedPlayer.id]: history }))
      setHistoryStatusByPlayerId((current) => ({ ...current, [selectedPlayer.id]: source }))
    })

    return () => {
      isStale = true
    }
  }, [opggHost, realHistoryByPlayerId, riotHost, selectedPlayer])

  useEffect(() => {
    if (!selectedPlayer) return undefined

    const account = getRiotAccountForPlayer(selectedPlayer)
    if (!account || (!riotHost && !opggHost) || profileByPlayerId[selectedPlayer.id] || opggProfileByPlayerId[selectedPlayer.id]) return undefined

    let isStale = false

    Promise.resolve()
      .then(async () => {
        const riotProfile = riotHost ? await loadRiotPlayerProfile(riotHost, account) : null
        if (riotProfile) return { riotProfile }
        const opggProfile = await loadOpggPlayerProfile(opggHost, selectedPlayer)
        return { opggProfile }
      })
      .then(({ riotProfile, opggProfile }) => {
      if (isStale) return
      if (!riotProfile && !opggProfile) {
        setProfileStatusByPlayerId((current) => ({ ...current, [selectedPlayer.id]: 'unavailable' }))
        return
      }

      if (riotProfile) {
        setProfileByPlayerId((current) => ({ ...current, [selectedPlayer.id]: riotProfile }))
      }
      if (opggProfile) {
        setOpggProfileByPlayerId((current) => ({ ...current, [selectedPlayer.id]: opggProfile }))
      }
      setProfileStatusByPlayerId((current) => ({ ...current, [selectedPlayer.id]: riotProfile ? 'riot' : 'opgg' }))
    })

    return () => {
      isStale = true
    }
  }, [opggHost, opggProfileByPlayerId, profileByPlayerId, riotHost, selectedPlayer])

  const openHistoryMatch = (historyMatch: PlayerRecentMatch) => {
    setSelectedHistoryMatch(historyMatch)
    if (!matchDetailById[historyMatch.id]) {
      setMatchDetailStatusById((current) => ({
        ...current,
        [historyMatch.id]: opggHost && historyMatch.createdAt ? 'loading' : 'unavailable',
      }))
    }
  }

  useEffect(() => {
    if (!selectedPlayer || !selectedHistoryMatch || matchDetailById[selectedHistoryMatch.id]) return undefined

    let isStale = false

    loadOpggMatchDetail(opggHost, selectedPlayer, selectedHistoryMatch).then((detail) => {
      if (isStale) return
      if (!detail) {
        setMatchDetailStatusById((current) => ({
          ...current,
          [selectedHistoryMatch.id]: 'unavailable',
        }))
        return
      }

      setMatchDetailById((current) => ({ ...current, [selectedHistoryMatch.id]: detail }))
      setMatchDetailStatusById((current) => ({ ...current, [selectedHistoryMatch.id]: 'opgg' }))
    })

    return () => {
      isStale = true
    }
  }, [matchDetailById, opggHost, selectedHistoryMatch, selectedPlayer])

  return (
    <main className="game-shell" data-tauri-drag-region>
      <section className="game-stage" aria-label="对局情报" data-tauri-drag-region>
        <div className="lane-glow lane-one" />
        <div className="lane-glow lane-two" />
        {hasStageIntel && (
          <div className="stage-intel-board" data-tauri-drag-region>
            <div className="stage-versus-grid">
              {renderTeam(allyPlayers, 'ally')}
              {renderTeam(enemyPlayers, 'enemy')}
            </div>
          </div>
        )}
      </section>
      {children}
      {selectedPlayer && createPortal(
        <div className="player-detail-backdrop" role="dialog" aria-modal="true" aria-label={`${selectedPlayer.name} 玩家详情`}>
          <div className={`player-detail-panel ${selectedPlayer.team}`}>
            <div className="player-detail-header">
              <div>
                <span>{selectedPlayer.team === 'ally' ? '我方' : '敌方'} · {selectedPlayer.role}</span>
                <h3>{selectedPlayer.name}</h3>
                <p>
                  {hasSelectedProfileData
                    ? `${selectedProfile?.rank ?? selectedOpggProfile?.rank ?? selectedPlayer.rank} · 近${
                        selectedProfile?.rankedGames ?? selectedOpggProfile?.rankedGames ?? selectedPlayer.recentRankedGames
                      }场胜率 ${
                        selectedProfile?.recentWinRate ?? selectedOpggProfile?.rankedWinRate ?? selectedPlayer.recentWinRate
                      }%`
                    : '正在查询公开玩家数据'}
                </p>
              </div>
              <button type="button" onClick={() => {
                setSelectedHistoryMatch(null)
                setSelectedPlayer(null)
              }} aria-label="关闭玩家详情">关闭</button>
            </div>

            {hasSelectedProfileData && (
              <>
                <div className="player-detail-score">
                  <strong>
                    {selectedPublicScore === undefined ? '--' : Math.round(selectedPublicScore)}
                  </strong>
                  <div>
                    <span>
                      <em>KDA</em>
                      <b>{selectedProfile?.averageKda ?? selectedOpggProfile?.championPoolTop3[0]?.kda ?? '-'}</b>
                    </span>
                    <span>
                      <em>排位胜率</em>
                      <b>{selectedProfile?.recentWinRate ?? selectedOpggProfile?.rankedWinRate ?? selectedPlayer.recentWinRate}%</b>
                    </span>
                    <span>
                      <em>排位场次</em>
                      <b>{selectedProfile?.rankedGames ?? selectedOpggProfile?.rankedGames ?? selectedPlayer.recentRankedGames}</b>
                    </span>
                  </div>
                </div>

                <div className="player-detail-metrics">
                  {selectedProfile && (
                    <>
                      <span>场均死亡 <strong>{selectedProfile.averageDeaths}</strong></span>
                      <span>CS/分 <strong>{selectedProfile.csPerMin}</strong></span>
                      <span>参团率 <strong>{selectedProfile.killParticipation}%</strong></span>
                      <span>场均视野 <strong>{selectedProfile.visionScore}</strong></span>
                      <span>伤害占比 <strong>{selectedProfile.damageShare}%</strong></span>
                    </>
                  )}
                  {selectedOpggProfile?.championPoolTop3[0] && (
                    <span>
                      常用英雄 <strong>{selectedOpggProfile.championPoolTop3[0].championName}</strong>
                    </span>
                  )}
                </div>
              </>
            )}

            {!hasSelectedProfileData && (
              <p className="player-detail-empty">暂未查询到可信的公开指标，不使用模拟数据补位。</p>
            )}

            {selectedParty && (
              <div className={`player-detail-party ${selectedParty.color}`}>
                <b>{selectedParty.label}</b>
                <span>车队 · {selectedParty.games} 场 · 胜率 {selectedParty.winRate}%</span>
              </div>
            )}

            <div className="player-detail-section">
              <div className="player-detail-title">
                <strong>英雄熟练度 Top 3</strong>
                <PlayerDataSource status={selectedProfileStatus} />
              </div>
              <div className="mastery-list">
                {selectedMastery.map((entry, index) => (
                  <div className="mastery-row" key={entry.champion}>
                    <b>{index + 1}</b>
                    <div>
                      <strong>{entry.champion}</strong>
                      <span>
                        {selectedProfile?.masteryTop3.length
                          ? `等级 ${entry.games} · 熟练 ${formatMastery(entry.mastery)}`
                          : `${entry.games}场 · 胜率 ${entry.winRate}%`}
                      </span>
                    </div>
                  </div>
                ))}
                {selectedMastery.length === 0 && <p className="player-detail-empty">暂无可信的英雄熟练度数据。</p>}
              </div>
            </div>

            <div className="player-detail-section">
              <div className="player-detail-title">
                <strong>最近 10 场战绩</strong>
                <PlayerDataSource status={selectedHistoryStatus} />
              </div>
              <div className="detail-history-list">
                {selectedHistory.map((historyMatch) => (
                  <button
                    className={`detail-history-row ${historyMatch.result === '胜' ? 'win' : 'loss'} ${selectedHistoryMatch?.id === historyMatch.id ? 'active' : ''}`}
                    key={historyMatch.id}
                    type="button"
                    onClick={() => openHistoryMatch(historyMatch)}
                  >
                    <span>{historyMatch.result}</span>
                    <div>
                      <strong>{historyMatch.champion}</strong>
                      <p>{historyMatch.mode} · {historyMatch.time}</p>
                    </div>
                    <div>
                      <strong>{historyMatch.kda}</strong>
                      <p>CS {historyMatch.cs} · KP {historyMatch.kp}%</p>
                    </div>
                    <b>{historyMatch.score}</b>
                  </button>
                ))}
                {selectedHistory.length === 0 && <p className="player-detail-empty">暂无可用的最近战绩。</p>}
              </div>
            </div>

            {selectedHistoryMatch && selectedRealMatchDetail && (
              <div className="match-record-panel">
                <div className="player-detail-title">
                  <strong>单局详情</strong>
                  <PlayerDataSource status={selectedMatchDetailStatus === 'opgg' ? 'opgg' : selectedMatchDetailStatus} />
                </div>
                <div className={`match-record-result ${selectedHistoryMatch.result === '胜' ? 'win' : 'loss'}`}>
                  <span>{selectedHistoryMatch.result}</span>
                  <div>
                    <strong>{selectedHistoryMatch.champion}</strong>
                    <p>{selectedHistoryMatch.kda} · 评分 {selectedHistoryMatch.score}</p>
                  </div>
                </div>
                <div className="match-team-summary">
                  {selectedRealMatchDetail.teams.map((team) => (
                    <div className={team.isWin ? 'match-team win' : 'match-team loss'} key={team.key}>
                      <strong>{team.key === 'BLUE' ? '蓝方' : '红方'} · {team.isWin ? '胜' : '负'}</strong>
                      <span>{team.kills}杀 · {team.towers}塔 · {team.dragons}龙 · {Math.round(team.gold / 1000)}k经济</span>
                    </div>
                  ))}
                </div>
                <div className="match-lineup-grid">
                  {selectedRealMatchDetail.teams.map((team) => (
                    <div className="match-lineup" key={team.key}>
                      {team.participants.map((participant) => (
                        <div className="match-lineup-row" key={`${team.key}-${participant.summonerName}-${participant.championName}`}>
                          <div>
                            <strong>{participant.championName}</strong>
                            <span>{participant.position} · {participant.kill}/{participant.death}/{participant.assist} · {participant.opScore.toFixed(1)}</span>
                          </div>
                          <div className="match-item-row">
                            {participant.items.slice(0, 6).map((item) => (
                              <img alt={item.name} key={`${participant.summonerName}-${item.id}-${item.name}`} src={getItemIconUrl(item.id)} title={item.name} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </main>
  )
}
