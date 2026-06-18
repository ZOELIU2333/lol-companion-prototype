import { invoke, isTauri } from '@tauri-apps/api/core'
import type { LiveStatePlayer, Match } from '../types'

export type LiveClientPlayer = {
  summonerName?: string | null
  riotId?: string | null
  championName?: string | null
  team?: string | null
  position?: string | null
  level?: number | null
  isLocal: boolean
  isBot: boolean
  isDead: boolean
  itemIds: number[]
  kills?: number | null
  deaths?: number | null
  assists?: number | null
  creepScore?: number | null
}

export type LiveClientSnapshot = {
  gameTime: number | null
  gameMode?: string | null
  activePlayerName?: string | null
  championName?: string | null
  level?: number | null
  currentGold?: number | null
  currentItemIds: number[]
  selectedAugmentIds?: number[]
  selectedAugmentNames?: string[]
  candidateAugmentIds?: number[]
  players: LiveClientPlayer[]
  source: 'live-client-data'
}

export type LiveClientDataHost = {
  readSnapshot: () => Promise<LiveClientSnapshot | null>
}

function normalizeLiveClientPlayer(player: LiveClientPlayer | null | undefined): LiveClientPlayer | null {
  if (!player) return null

  return {
    summonerName: player.summonerName ?? null,
    riotId: player.riotId ?? null,
    championName: player.championName ?? null,
    team: player.team ?? null,
    position: player.position ?? null,
    level: player.level ?? null,
    isLocal: Boolean(player.isLocal),
    isBot: Boolean(player.isBot),
    isDead: Boolean(player.isDead),
    itemIds: Array.isArray(player.itemIds) ? player.itemIds.filter((id) => id > 0) : [],
    kills: player.kills ?? null,
    deaths: player.deaths ?? null,
    assists: player.assists ?? null,
    creepScore: player.creepScore ?? null,
  }
}

function normalizeLiveClientSnapshot(payload: LiveClientSnapshot | null): LiveClientSnapshot | null {
  if (!payload || payload.source !== 'live-client-data') return null

  return {
    gameTime: typeof payload.gameTime === 'number' && Number.isFinite(payload.gameTime) ? Math.max(0, payload.gameTime) : null,
    gameMode: payload.gameMode ?? null,
    activePlayerName: payload.activePlayerName ?? null,
    championName: payload.championName ?? null,
    level: payload.level ?? null,
    currentGold: payload.currentGold ?? null,
    currentItemIds: Array.isArray(payload.currentItemIds) ? payload.currentItemIds.filter((id) => id > 0) : [],
    selectedAugmentIds: Array.isArray(payload.selectedAugmentIds) ? payload.selectedAugmentIds.filter((id) => id > 0) : [],
    selectedAugmentNames: Array.isArray(payload.selectedAugmentNames)
      ? payload.selectedAugmentNames.filter((name) => typeof name === 'string' && name.length > 0)
      : [],
    candidateAugmentIds: Array.isArray(payload.candidateAugmentIds) ? payload.candidateAugmentIds.filter((id) => id > 0) : [],
    players: Array.isArray(payload.players)
      ? payload.players.map(normalizeLiveClientPlayer).filter((player): player is LiveClientPlayer => player !== null)
      : [],
    source: 'live-client-data',
  }
}

export function createTauriLiveClientDataHost(): LiveClientDataHost | null {
  if (!isTauri()) return null

  return {
    async readSnapshot() {
      try {
        return normalizeLiveClientSnapshot(await invoke<LiveClientSnapshot | null>('read_live_client_snapshot'))
      } catch {
        return null
      }
    },
  }
}

function inferNextObjective(minute: number, current: string) {
  if (minute < 6) return current
  if (minute < 14) return '小龙 / 虚空巢虫'
  if (minute < 20) return '小龙 / 先锋窗口'
  return '小龙 / 男爵视野'
}

function mapLiveClientPosition(position: string | null | undefined): string | null {
  switch ((position ?? '').toUpperCase()) {
    case 'TOP':
      return '上单'
    case 'JUNGLE':
      return '打野'
    case 'MIDDLE':
      return '中路'
    case 'BOTTOM':
      return '下路'
    case 'UTILITY':
      return '辅助'
    default:
      return null
  }
}

function mapLiveClientPlayersToLiveState(players: LiveClientPlayer[]): LiveStatePlayer[] {
  // The local player's raw team ("ORDER"/"CHAOS") anchors which side is "ally".
  // When the local player can't be located we leave team null rather than guessing.
  const localTeam = players.find((player) => player.isLocal)?.team ?? null

  return players.map((player) => ({
    summonerName: player.summonerName ?? null,
    championName: player.championName ?? null,
    team: localTeam && player.team ? (player.team === localTeam ? 'ally' : 'enemy') : null,
    position: mapLiveClientPosition(player.position),
    level: player.level ?? null,
    isLocal: player.isLocal,
    isBot: player.isBot,
    isDead: player.isDead,
    itemIds: player.itemIds,
    kills: player.kills ?? null,
    deaths: player.deaths ?? null,
    assists: player.assists ?? null,
    creepScore: player.creepScore ?? null,
  }))
}

export function applyLiveClientSnapshotToMatch(match: Match, snapshot: LiveClientSnapshot | null): Match {
  if (!snapshot) return match

  // gameTime / currentGold may be null when only the player list is available
  // (gamestats / activeplayer endpoints down). Keep them null instead of
  // coercing to 0 so the UI can show "未同步" rather than a fake real value.
  const hasGameTime = typeof snapshot.gameTime === 'number'
  const minute = hasGameTime ? Math.max(0, Math.floor((snapshot.gameTime as number) / 60)) : null
  const timer = hasGameTime
    ? `${(minute as number).toString().padStart(2, '0')}:${Math.floor((snapshot.gameTime as number) % 60).toString().padStart(2, '0')}`
    : match.timer
  const currentGold = snapshot.currentGold ?? null
  const itemLabels = snapshot.currentItemIds.length > 0
    ? snapshot.currentItemIds.map((itemId) => `item:${itemId}`)
    : match.liveState.currentItems
  const levelText = snapshot.level ? `等级 ${snapshot.level}` : '等级未知'
  const championText = snapshot.championName ? `${snapshot.championName} ` : ''
  const goldText = currentGold === null ? '金币未同步' : `当前金币 ${currentGold}`

  const liveSelectedAugmentNames = snapshot.selectedAugmentNames ?? []
  const liveSelectedAugmentIds = snapshot.selectedAugmentIds ?? []
  const liveCandidateAugmentIds = snapshot.candidateAugmentIds ?? []
  const isLiveDataAuthoritative =
    liveSelectedAugmentNames.length > 0 ||
    liveSelectedAugmentIds.length > 0 ||
    liveCandidateAugmentIds.length > 0

  return {
    ...match,
    timer,
    liveState: {
      ...match.liveState,
      minute,
      goldOnHand: currentGold,
      currentItems: itemLabels,
      selectedAugments: liveSelectedAugmentNames,
      selectedAugmentIds: liveSelectedAugmentIds,
      candidateAugmentIds: liveCandidateAugmentIds,
      isLiveDataAuthoritative,
      players: mapLiveClientPlayersToLiveState(snapshot.players ?? []),
      currentSituation: `${championText}${levelText}，${goldText}。`,
      nextObjective: inferNextObjective(minute ?? 0, match.liveState.nextObjective),
      immediateAction:
        currentGold === null
          ? '实时金币暂未同步，待 2999 接口恢复后会显示装备建议。'
          : currentGold >= 1300
            ? '金币已经够一波关键组件，下一次回城可以优先补强版本核心路线。'
            : '金币还没到关键回城点，先围绕兵线和资源视野继续攒经济。',
    },
  }
}
