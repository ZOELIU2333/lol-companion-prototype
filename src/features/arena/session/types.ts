export type ArenaObservationState = 'live' | 'stale' | 'unsupported' | 'unavailable' | 'error'
export type ArenaSource = 'lcu' | 'live-client' | 'manual' | 'bundled-cache' | 'runtime-cache'
export type ArenaSourceCapability = 'available' | 'unsupported' | 'unavailable' | 'error'

export type ArenaObservation<T> = {
  value: T
  source: ArenaSource
  observedAt: number
  state: ArenaObservationState
}

export type ArenaSessionCapabilities = {
  mode: ArenaSourceCapability
  champion: ArenaSourceCapability
  level: ArenaSourceCapability
  gold: ArenaSourceCapability
  items: ArenaSourceCapability
  gameTime: ArenaSourceCapability
  round: ArenaSourceCapability
  selectedAugments: ArenaSourceCapability
  candidates: ArenaSourceCapability
}

export type ArenaSession = {
  mode: ArenaObservation<'arena' | null>
  championKey: ArenaObservation<number | null>
  level: ArenaObservation<number>
  gold: ArenaObservation<number>
  itemIds: ArenaObservation<number[]>
  gameTimeSeconds: ArenaObservation<number>
  round: ArenaObservation<number | null>
  selectedAugments: ArenaObservation<number[]>
  candidates: ArenaObservation<number[]>
  capabilities: ArenaSessionCapabilities
}

export type PartialArenaSession = Partial<Omit<ArenaSession, 'capabilities'>> & {
  capabilities?: Partial<ArenaSessionCapabilities>
}

export type ArenaSessionChange =
  | 'mode-changed'
  | 'champion-changed'
  | 'level-changed'
  | 'gold-changed'
  | 'items-changed'
  | 'completed-item'
  | 'game-time-changed'
  | 'round-changed'
  | 'selected-augments-changed'
  | 'candidates-changed'
  | 'route-input-changed'
  | 'purchase-input-changed'
  | 'notification-relevant'
