import {
  isArenaGameMode,
  type LiveClientReading,
  type LiveClientSnapshot,
} from '../services/liveClientData'
import type { GameMode } from '../types'

export type LiveSessionState = 'waiting' | 'live' | 'reconnecting'

type UsableLiveClientReading = LiveClientReading & {
  state: 'fresh' | 'reconnecting'
  snapshot: LiveClientSnapshot
}

export function hasUsableLiveSnapshot(reading: LiveClientReading): reading is UsableLiveClientReading {
  return Boolean(reading.snapshot && (reading.state === 'fresh' || reading.state === 'reconnecting'))
}

export function deriveLiveSessionState(reading: LiveClientReading): LiveSessionState {
  if (reading.state === 'fresh' && reading.snapshot) return 'live'
  if (reading.state === 'reconnecting' && reading.snapshot) return 'reconnecting'
  return 'waiting'
}

export function resolveAuthoritativeMode(input: {
  live: LiveClientReading
  lcuMode: GameMode | null
  fallbackMode: GameMode
}): GameMode {
  if (hasUsableLiveSnapshot(input.live)) {
    return isArenaGameMode(input.live.snapshot?.gameMode) ? 'arena' : 'ranked'
  }

  return input.lcuMode ?? input.fallbackMode
}
