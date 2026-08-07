import { invoke, isTauri } from '@tauri-apps/api/core'
import type { ArenaSessionPort } from '../features/arena/session/ports'
import type { ArenaObservation, PartialArenaSession } from '../features/arena/session/types'
import type { Match } from '../types'

export type LiveClientSnapshot = {
  gameTime: number
  gameMode?: string | null
  activePlayerName?: string | null
  championName?: string | null
  level?: number | null
  currentGold?: number | null
  currentItemIds: number[]
  source: 'live-client-data'
}

export type LiveClientDataHost = {
  readSnapshot: (signal?: AbortSignal) => Promise<LiveClientSnapshot | null>
}

function liveObservation<T>(value: T, observedAt: number): ArenaObservation<T> {
  return { value, observedAt, source: 'live-client', state: 'live' }
}

export function createLiveClientArenaPort(
  host: LiveClientDataHost,
  championKeysByName: Map<string, number>,
  now: () => number = () => Date.now(),
): ArenaSessionPort {
  return {
    id: 'live-client-data',
    fields: ['mode', 'champion', 'level', 'gold', 'items', 'gameTime', 'candidates'],
    async read(signal) {
      const snapshot = await host.readSnapshot(signal)
      if (!snapshot) {
        return {
          capabilities: {
            mode: 'unavailable', champion: 'unavailable', level: 'unavailable', gold: 'unavailable',
            items: 'unavailable', gameTime: 'unavailable', candidates: 'unsupported',
          },
        }
      }
      const observedAt = now()
      const championKey = snapshot.championName
        ? championKeysByName.get(snapshot.championName.toLowerCase())
        : undefined
      const arenaMode = /arena|cherry/i.test(snapshot.gameMode ?? '')
      const partial: PartialArenaSession = {
        gameTimeSeconds: liveObservation(snapshot.gameTime, observedAt),
        itemIds: liveObservation(snapshot.currentItemIds, observedAt),
        candidates: { value: [], observedAt, source: 'live-client', state: 'unsupported' },
        capabilities: {
          gameTime: 'available', items: 'available', candidates: 'unsupported',
          mode: arenaMode ? 'available' : 'unavailable',
          champion: championKey ? 'available' : 'unavailable',
          level: snapshot.level === null || snapshot.level === undefined ? 'unavailable' : 'available',
          gold: snapshot.currentGold === null || snapshot.currentGold === undefined ? 'unavailable' : 'available',
        },
      }
      if (arenaMode) partial.mode = liveObservation('arena', observedAt)
      if (championKey) partial.championKey = liveObservation(championKey, observedAt)
      if (snapshot.level !== null && snapshot.level !== undefined) partial.level = liveObservation(snapshot.level, observedAt)
      if (snapshot.currentGold !== null && snapshot.currentGold !== undefined) partial.gold = liveObservation(snapshot.currentGold, observedAt)
      return partial
    },
  }
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

  return {
    ...match,
    timer: `${minute.toString().padStart(2, '0')}:${Math.floor(snapshot.gameTime % 60).toString().padStart(2, '0')}`,
    liveState: {
      ...match.liveState,
      minute,
      goldOnHand: currentGold,
      currentItems: itemLabels,
      currentSituation: `${championText}${levelText}，当前金币 ${currentGold}。`,
      nextObjective: inferNextObjective(minute, match.liveState.nextObjective),
      immediateAction:
        currentGold >= 1300
          ? '金币已经够一波关键组件，下一次回城可以优先补强版本核心路线。'
          : '金币还没到关键回城点，先围绕兵线和资源视野继续攒经济。',
    },
  }
}
