import { invoke, isTauri } from '@tauri-apps/api/core'
import type { ArenaSessionPort } from '../features/arena/session/ports'
import type { ArenaObservationState, ArenaSourceCapability, PartialArenaSession } from '../features/arena/session/types'
import type { GameMode } from '../types'
import type { LcuAdapter, LcuGamePhase, LcuPlayerSnapshot, LcuSessionSnapshot } from './lcuAdapter'
import type { OpggMcpHost } from './opggMcpAdapter'

type TauriLcuSessionPayload = {
  phase: string
  mode: GameMode | null
  localSummonerName?: string
  players?: LcuPlayerSnapshot[]
  source: 'lcu'
}

type TauriArenaLcuPayload = {
  mode?: GameMode | null
  championKey?: number | null
  round?: number | null
  selectedAugmentIds?: number[]
  candidateAugmentIds?: number[]
  candidateCapability: ArenaSourceCapability
  source: 'lcu'
}

export type DesktopHealthStatus = 'ready' | 'degraded' | 'unavailable' | 'unsupported' | 'stale' | 'error' | 'missing'

export type DesktopRecoveryCode =
  | 'retry'
  | 'manual-arena'
  | 'discard-cache'
  | 'install-webview2'
  | 'open-logs'
  | 'export-diagnostics'
  | 'select-league-path'

export type DesktopHealthCheck = {
  code: string
  status: DesktopHealthStatus
  detail: string
  recoveryCode?: DesktopRecoveryCode | null
  safePath?: string | null
  ageSeconds?: number | null
  version?: string | null
}

export type DesktopHealthSnapshot = {
  generatedAtMs: number
  shell: DesktopHealthCheck
  webview2: DesktopHealthCheck
  leagueDiscovery: DesktopHealthCheck
  lcu: DesktopHealthCheck
  liveClient: DesktopHealthCheck
  augmentCapability: DesktopHealthCheck
  catalog: DesktopHealthCheck
  runtimeCache: DesktopHealthCheck
  logs: DesktopHealthCheck
}

const knownLcuPhases: readonly LcuGamePhase[] = [
  'None',
  'Lobby',
  'Matchmaking',
  'ReadyCheck',
  'ChampSelect',
  'GameStart',
  'InProgress',
  'WaitingForStats',
  'EndOfGame',
]

function isKnownLcuPhase(phase: string): phase is LcuGamePhase {
  return knownLcuPhases.includes(phase as LcuGamePhase)
}

function normalizeLcuPayload(payload: TauriLcuSessionPayload | null): LcuSessionSnapshot | null {
  if (!payload || !isKnownLcuPhase(payload.phase)) return null

  return {
    phase: payload.phase,
    mode: payload.mode,
    localSummonerName: payload.localSummonerName,
    players: payload.players ?? [],
  }
}

export function isRunningInTauri() {
  return isTauri()
}

export async function readDesktopHealth(): Promise<DesktopHealthSnapshot | null> {
  if (!isTauri()) return null
  try {
    const health = await invoke<DesktopHealthSnapshot>('get_desktop_health')
    return health && typeof health.generatedAtMs === 'number' ? health : null
  } catch {
    return null
  }
}

export async function exportDesktopDiagnostics(): Promise<string> {
  if (!isTauri()) throw new Error('诊断导出仅在桌面客户端可用')
  return invoke<string>('export_diagnostics')
}

export async function chooseLeagueInstallation(kind: 'directory' | 'lockfile'): Promise<string | null> {
  if (!isTauri()) return null
  return invoke<string | null>('choose_league_installation', { kind })
}

export async function discardRuntimeCache(): Promise<boolean> {
  if (!isTauri()) return false
  return Boolean(await invoke<boolean>('discard_runtime_cache'))
}

export const tauriLcuAdapter: LcuAdapter = {
  async isAvailable() {
    if (!isTauri()) return false

    try {
      return Boolean(normalizeLcuPayload(await invoke<TauriLcuSessionPayload | null>('read_lcu_session')))
    } catch {
      return false
    }
  },

  async readSession() {
    if (!isTauri()) return null

    try {
      return normalizeLcuPayload(await invoke<TauriLcuSessionPayload | null>('read_lcu_session'))
    } catch {
      return null
    }
  },
}

function observationState(capability: ArenaSourceCapability): ArenaObservationState {
  return capability === 'available' ? 'live' : capability
}

export function createTauriArenaLcuPort(now: () => number = () => Date.now()): ArenaSessionPort | null {
  if (!isTauri()) return null
  return {
    id: 'tauri-arena-lcu',
    fields: ['mode', 'champion', 'round', 'selectedAugments', 'candidates'],
    async read(signal) {
      if (signal.aborted) throw new DOMException('Arena LCU read aborted', 'AbortError')
      const payload = await invoke<TauriArenaLcuPayload | null>('read_arena_lcu_session')
      if (!payload) {
        return { capabilities: {
          mode: 'unavailable', champion: 'unavailable', round: 'unavailable',
          selectedAugments: 'unavailable', candidates: 'unavailable',
        } }
      }
      const observedAt = now()
      const partial: PartialArenaSession = {
        candidates: {
          value: payload.candidateAugmentIds ?? [], source: 'lcu', observedAt,
          state: observationState(payload.candidateCapability),
        },
        capabilities: {
          mode: payload.mode === 'arena' ? 'available' : 'unavailable',
          champion: payload.championKey ? 'available' : 'unavailable',
          round: payload.round === null || payload.round === undefined ? 'unavailable' : 'available',
          selectedAugments: payload.selectedAugmentIds ? 'available' : 'unsupported',
          candidates: payload.candidateCapability,
        },
      }
      if (payload.mode === 'arena') partial.mode = { value: 'arena', source: 'lcu', observedAt, state: 'live' }
      if (payload.championKey) partial.championKey = { value: payload.championKey, source: 'lcu', observedAt, state: 'live' }
      if (payload.round !== null && payload.round !== undefined) {
        partial.round = { value: payload.round, source: 'lcu', observedAt, state: 'live' }
      }
      if (payload.selectedAugmentIds) {
        partial.selectedAugments = { value: payload.selectedAugmentIds, source: 'lcu', observedAt, state: 'live' }
      }
      return partial
    },
  }
}

export async function setOverlayAlwaysOnTop(enabled: boolean) {
  if (!isTauri()) return false

  try {
    await invoke('set_overlay_always_on_top', { enabled })
    return true
  } catch {
    return false
  }
}

export async function setOverlayCompact(enabled: boolean) {
  if (!isTauri()) return false

  try {
    await invoke('set_overlay_compact', { enabled })
    return true
  } catch {
    return false
  }
}

export function createTauriOpggMcpHost(): OpggMcpHost | null {
  if (!isTauri()) return null

  return {
    async fetchJson(_url, init) {
      try {
        const body = JSON.parse(init?.body ?? '{}') as {
          params?: {
            arguments?: unknown
            name?: string
          }
        }
        if (!body.params?.name) return null

        return invoke('opgg_mcp_call', {
          arguments: body.params.arguments ?? {},
          toolName: body.params.name,
        })
      } catch {
        return null
      }
    },
  }
}
