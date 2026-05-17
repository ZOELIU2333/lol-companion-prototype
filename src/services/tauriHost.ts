import { invoke, isTauri } from '@tauri-apps/api/core'
import type { GameMode } from '../types'
import type { LcuAdapter, LcuGamePhase, LcuPlayerSnapshot, LcuSessionSnapshot } from './lcuAdapter'
import type { OpggMcpHost } from './opggMcpAdapter'

type TauriLcuSessionPayload = {
  phase: string
  mode: Exclude<GameMode, 'arena'> | null
  localSummonerName?: string
  players?: LcuPlayerSnapshot[]
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
