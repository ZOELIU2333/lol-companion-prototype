import type {
  ArenaObservation,
  ArenaObservationState,
  ArenaSession,
  ArenaSessionChange,
  ArenaSessionCapabilities,
  PartialArenaSession,
} from './types'

const validStates = new Set<ArenaObservationState>(['live', 'stale'])

function emptyObservation<T>(value: T): ArenaObservation<T> {
  return { value, source: 'bundled-cache', observedAt: 0, state: 'unavailable' }
}

export function createEmptyArenaSession(): ArenaSession {
  const unavailable: ArenaSessionCapabilities = {
    mode: 'unavailable', champion: 'unavailable', level: 'unavailable', gold: 'unavailable',
    items: 'unavailable', gameTime: 'unavailable', round: 'unavailable',
    selectedAugments: 'unavailable', candidates: 'unavailable',
  }
  return {
    mode: emptyObservation(null),
    championKey: emptyObservation(null),
    level: emptyObservation(0),
    gold: emptyObservation(0),
    itemIds: emptyObservation([]),
    gameTimeSeconds: emptyObservation(0),
    round: emptyObservation(null),
    selectedAugments: emptyObservation([]),
    candidates: emptyObservation([]),
    capabilities: unavailable,
  }
}

function valid<T>(observation: ArenaObservation<T>) {
  return validStates.has(observation.state)
}

function newerValid<T>(current: ArenaObservation<T>, incoming?: ArenaObservation<T>) {
  if (!incoming || !valid(incoming)) return current
  if (valid(current) && current.source === 'manual' && incoming.source !== 'manual') return current
  if (!valid(current) || incoming.observedAt >= current.observedAt) return incoming
  return current
}

export function mergeArenaSession(current: ArenaSession, incoming: PartialArenaSession): ArenaSession {
  const roundChanged = Boolean(
    incoming.round && valid(incoming.round) && incoming.round.observedAt >= current.round.observedAt &&
    incoming.round.value !== current.round.value,
  )
  const baseCandidates = roundChanged
    ? { value: [], source: incoming.round!.source, observedAt: incoming.round!.observedAt, state: 'live' as const }
    : current.candidates

  return {
    mode: newerValid(current.mode, incoming.mode),
    championKey: newerValid(current.championKey, incoming.championKey),
    level: newerValid(current.level, incoming.level),
    gold: newerValid(current.gold, incoming.gold),
    itemIds: newerValid(current.itemIds, incoming.itemIds),
    gameTimeSeconds: newerValid(current.gameTimeSeconds, incoming.gameTimeSeconds),
    round: newerValid(current.round, incoming.round),
    selectedAugments: newerValid(current.selectedAugments, incoming.selectedAugments),
    candidates: newerValid(baseCandidates, incoming.candidates),
    capabilities: { ...current.capabilities, ...incoming.capabilities },
  }
}

function sameValue<T>(left: T, right: T) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function hasNewItem(before: number[], after: number[]) {
  const remaining = [...before]
  return after.some((id) => {
    const index = remaining.indexOf(id)
    if (index >= 0) {
      remaining.splice(index, 1)
      return false
    }
    return true
  })
}

export function classifyArenaChange(before: ArenaSession, after: ArenaSession): ArenaSessionChange[] {
  const changes: ArenaSessionChange[] = []
  let routeInputChanged = false
  let purchaseInputChanged = false
  let notificationRelevant = false

  if (!sameValue(before.mode.value, after.mode.value)) changes.push('mode-changed')
  if (!sameValue(before.championKey.value, after.championKey.value)) {
    changes.push('champion-changed')
    routeInputChanged = true
  }
  if (before.level.value !== after.level.value) {
    changes.push('level-changed')
    routeInputChanged = true
  }
  if (before.gold.value !== after.gold.value) {
    changes.push('gold-changed')
    purchaseInputChanged = true
  }
  if (!sameValue(before.itemIds.value, after.itemIds.value)) {
    changes.push('items-changed')
    routeInputChanged = true
    purchaseInputChanged = true
    if (hasNewItem(before.itemIds.value, after.itemIds.value)) {
      changes.push('completed-item')
      notificationRelevant = true
    }
  }
  if (before.gameTimeSeconds.value !== after.gameTimeSeconds.value) changes.push('game-time-changed')
  if (before.round.value !== after.round.value) {
    changes.push('round-changed')
    routeInputChanged = true
  }
  if (!sameValue(before.selectedAugments.value, after.selectedAugments.value)) {
    changes.push('selected-augments-changed')
    routeInputChanged = true
    notificationRelevant = true
  }
  if (!sameValue(before.candidates.value, after.candidates.value)) {
    changes.push('candidates-changed')
    routeInputChanged = true
  }
  if (routeInputChanged) changes.push('route-input-changed')
  if (purchaseInputChanged) changes.push('purchase-input-changed')
  if (notificationRelevant) changes.push('notification-relevant')
  return changes
}
