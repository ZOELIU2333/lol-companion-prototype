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

export type LiveClientConnectionState = 'fresh' | 'reconnecting' | 'unavailable'
export type LiveClientFailureKind = 'connection' | 'timeout' | 'tls' | 'http' | 'json' | 'payload' | 'client'
export type LiveClientReading = {
  state: LiveClientConnectionState
  snapshot: LiveClientSnapshot | null
  ageSeconds: number | null
  failureKind: LiveClientFailureKind | null
}

export type LiveClientDataHost = {
  read: (signal?: AbortSignal) => Promise<LiveClientReading>
}

export function isArenaGameMode(gameMode: string | null | undefined): boolean {
  return /arena|cherry|kiwi/i.test(gameMode ?? '')
}

function liveObservation<T>(
  value: T,
  observedAt: number,
  state: 'live' | 'stale',
): ArenaObservation<T> {
  return { value, observedAt, source: 'live-client', state }
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
      const reading = await host.read(signal)
      const snapshot = reading.snapshot
      if (!snapshot) {
        return {
          capabilities: {
            mode: 'unavailable', champion: 'unavailable', level: 'unavailable', gold: 'unavailable',
            items: 'unavailable', gameTime: 'unavailable', candidates: 'unsupported',
          },
        }
      }
      const observationState = reading.state === 'reconnecting' ? 'stale' : 'live'
      const observedAt = Math.max(0, now() - (reading.ageSeconds ?? 0) * 1_000)
      const championKey = snapshot.championName
        ? championKeysByName.get(snapshot.championName.toLowerCase())
        : undefined
      const arenaMode = isArenaGameMode(snapshot.gameMode)
      const partial: PartialArenaSession = {
        gameTimeSeconds: liveObservation(snapshot.gameTime, observedAt, observationState),
        itemIds: liveObservation(snapshot.currentItemIds, observedAt, observationState),
        candidates: { value: [], observedAt, source: 'live-client', state: 'unsupported' },
        capabilities: {
          gameTime: 'available', items: 'available', candidates: 'unsupported',
          mode: arenaMode ? 'available' : 'unavailable',
          champion: championKey ? 'available' : 'unavailable',
          level: snapshot.level === null || snapshot.level === undefined ? 'unavailable' : 'available',
          gold: snapshot.currentGold === null || snapshot.currentGold === undefined ? 'unavailable' : 'available',
        },
      }
      if (arenaMode) partial.mode = liveObservation('arena', observedAt, observationState)
      if (championKey) partial.championKey = liveObservation(championKey, observedAt, observationState)
      if (snapshot.level !== null && snapshot.level !== undefined) {
        partial.level = liveObservation(snapshot.level, observedAt, observationState)
      }
      if (snapshot.currentGold !== null && snapshot.currentGold !== undefined) {
        partial.gold = liveObservation(snapshot.currentGold, observedAt, observationState)
      }
      return partial
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function optionalFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeLiveClientSnapshot(payload: unknown): LiveClientSnapshot | null {
  if (!isRecord(payload) || payload.source !== 'live-client-data') return null

  return {
    gameTime: Math.max(0, optionalFiniteNumber(payload.gameTime) ?? 0),
    gameMode: optionalString(payload.gameMode),
    activePlayerName: optionalString(payload.activePlayerName),
    championName: optionalString(payload.championName),
    level: optionalFiniteNumber(payload.level),
    currentGold: optionalFiniteNumber(payload.currentGold),
    currentItemIds: Array.isArray(payload.currentItemIds)
      ? payload.currentItemIds.filter((id): id is number => typeof id === 'number' && Number.isFinite(id) && id > 0)
      : [],
    source: 'live-client-data',
  }
}

const failureKinds = new Set<LiveClientFailureKind>([
  'connection', 'timeout', 'tls', 'http', 'json', 'payload', 'client',
])

function unavailable(failureKind: LiveClientFailureKind = 'payload'): LiveClientReading {
  return { state: 'unavailable', snapshot: null, ageSeconds: null, failureKind }
}

export function normalizeLiveClientReading(payload: unknown): LiveClientReading {
  if (!isRecord(payload)) return unavailable()
  const snapshot = normalizeLiveClientSnapshot(payload.snapshot)
  const ageSeconds = optionalFiniteNumber(payload.ageSeconds)
  const failureKind = typeof payload.failureKind === 'string'
    && failureKinds.has(payload.failureKind as LiveClientFailureKind)
    ? payload.failureKind as LiveClientFailureKind
    : null

  if (payload.state === 'fresh' && snapshot) {
    return { state: 'fresh', snapshot, ageSeconds: 0, failureKind: null }
  }
  if (payload.state === 'reconnecting' && snapshot) {
    return {
      state: 'reconnecting',
      snapshot,
      ageSeconds: ageSeconds === null ? null : Math.max(0, ageSeconds),
      failureKind: failureKind ?? 'payload',
    }
  }
  if (payload.state === 'unavailable') {
    return {
      state: 'unavailable',
      snapshot: null,
      ageSeconds: ageSeconds === null ? null : Math.max(0, ageSeconds),
      failureKind: failureKind ?? 'payload',
    }
  }
  return unavailable()
}

export function createTauriLiveClientDataHost(): LiveClientDataHost | null {
  if (!isTauri()) return null

  return {
    async read() {
      try {
        return normalizeLiveClientReading(await invoke<unknown>('read_live_client_snapshot'))
      } catch {
        return unavailable('client')
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

  const liveChampion = snapshot.championName
    ? match.champions.find((candidate) =>
      candidate.id.toLowerCase() === snapshot.championName?.toLowerCase()
      || candidate.name.toLowerCase() === snapshot.championName?.toLowerCase())
    : undefined
  const minute = Math.max(0, Math.floor(snapshot.gameTime / 60))
  const currentGold = snapshot.currentGold ?? match.liveState.goldOnHand
  const itemLabels = snapshot.currentItemIds.length > 0
    ? snapshot.currentItemIds.map((itemId) => `item:${itemId}`)
    : match.liveState.currentItems
  const levelText = snapshot.level ? `等级 ${snapshot.level}` : '等级未知'
  const championText = snapshot.championName ? `${snapshot.championName} ` : ''

  return {
    ...match,
    currentChampionId: liveChampion?.id ?? match.currentChampionId,
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
