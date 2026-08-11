import { isArenaGameMode, type LiveClientReading } from '../services/liveClientData'
import type { GameMode } from '../types'

export type LiveSessionState = 'waiting' | 'live' | 'reconnecting'

export function hasUsableLiveSnapshot(reading: LiveClientReading): boolean {
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
