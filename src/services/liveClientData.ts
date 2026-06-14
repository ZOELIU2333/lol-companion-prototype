import { invoke, isTauri } from '@tauri-apps/api/core'
import type { Match } from '../types'

export type LiveClientSnapshot = {
  gameTime: number
  gameMode?: string | null
  activePlayerName?: string | null
  championName?: string | null
  level?: number | null
  currentGold?: number | null
  currentItemIds: number[]
  selectedAugmentIds?: number[]
  selectedAugmentNames?: string[]
  candidateAugmentIds?: number[]
  source: 'live-client-data'
}

export type LiveClientDataHost = {
  readSnapshot: () => Promise<LiveClientSnapshot | null>
}

function normalizeLiveClientSnapshot(payload: LiveClientSnapshot | null): LiveClientSnapshot | null {
  if (!payload || payload.source !== 'live-client-data') return null

  return {
    gameTime: Number.isFinite(payload.gameTime) ? Math.max(0, payload.gameTime) : 0,
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

export function applyLiveClientSnapshotToMatch(match: Match, snapshot: LiveClientSnapshot | null): Match {
  if (!snapshot) return match

  const minute = Math.max(0, Math.floor(snapshot.gameTime / 60))
  const currentGold = snapshot.currentGold ?? match.liveState.goldOnHand
  const itemLabels = snapshot.currentItemIds.length > 0
    ? snapshot.currentItemIds.map((itemId) => `item:${itemId}`)
    : match.liveState.currentItems
  const levelText = snapshot.level ? `等级 ${snapshot.level}` : '等级未知'
  const championText = snapshot.championName ? `${snapshot.championName} ` : ''

  const liveSelectedAugmentNames = snapshot.selectedAugmentNames ?? []
  const liveCandidateAugmentIds = snapshot.candidateAugmentIds ?? []
  // Empty arrays mean Live Client Data did not expose Mayhem augment state, so we keep the
  // demo scenario data and mark the projection non-authoritative; the UI then shows the
  // "waiting for candidate sync" state instead of presenting demo candidates as live.
  const isLiveDataAuthoritative = liveSelectedAugmentNames.length > 0 || liveCandidateAugmentIds.length > 0
  const selectedAugments = liveSelectedAugmentNames.length > 0
    ? liveSelectedAugmentNames
    : match.liveState.selectedAugments

  return {
    ...match,
    timer: `${minute.toString().padStart(2, '0')}:${Math.floor(snapshot.gameTime % 60).toString().padStart(2, '0')}`,
    liveState: {
      ...match.liveState,
      minute,
      goldOnHand: currentGold,
      currentItems: itemLabels,
      selectedAugments,
      candidateAugmentIds: liveCandidateAugmentIds,
      isLiveDataAuthoritative,
      currentSituation: `${championText}${levelText}，当前金币 ${currentGold}。`,
      nextObjective: inferNextObjective(minute, match.liveState.nextObjective),
      immediateAction:
        currentGold >= 1300
          ? '金币已经够一波关键组件，下一次回城可以优先补强版本核心路线。'
          : '金币还没到关键回城点，先围绕兵线和资源视野继续攒经济。',
    },
  }
}
