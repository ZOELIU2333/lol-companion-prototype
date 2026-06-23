import type { LiveStatePlayer } from '../types'

type LivePlayerListProps = {
  players: LiveStatePlayer[]
}

/**
 * Renders the real-time player roster from the Live Client Data feed. Shared by
 * both the ranked and augment (Mayhem) live panels so the roster shows in every
 * in-game mode. Renders nothing when no players are available.
 */
export function LivePlayerList({ players }: LivePlayerListProps) {
  if (players.length === 0) return null

  return (
    <div className="live-players">
      <span>对局玩家（实时）</span>
      <ul className="live-player-list">
        {players.map((player, index) => {
          const displayName = player.summonerName ?? player.championName ?? '未知玩家'
          const championLabel = player.championName ?? '未知英雄'

          return (
            <li
              className={`live-player live-player--${player.team ?? 'unknown'}${player.isLocal ? ' live-player--local' : ''}${player.isDead ? ' live-player--dead' : ''}`}
              key={`${player.team ?? 'unknown'}-${player.summonerName ?? player.championName ?? index}`}
            >
              <strong className="live-player-name">{displayName}</strong>
              <span className="live-player-meta">
                {championLabel}
                {player.position ? ` · ${player.position}` : ''}
                {player.level ? ` · Lv${player.level}` : ''}
                {player.kills !== null && player.deaths !== null && player.assists !== null
                  ? ` · ${player.kills}/${player.deaths}/${player.assists}`
                  : ''}
                {player.itemIds.length > 0 ? ` · ${player.itemIds.length} 件装备` : ''}
                {player.isDead ? ' · 阵亡' : ''}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
