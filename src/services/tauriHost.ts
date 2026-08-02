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
