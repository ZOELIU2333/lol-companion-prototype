import type { ArenaSessionCapabilities, PartialArenaSession } from './types'

export type ArenaSessionField = keyof ArenaSessionCapabilities

export type ArenaSessionPort = {
  id: string
  fields: ArenaSessionField[]
  timeoutMs?: number
  read: (signal: AbortSignal) => Promise<PartialArenaSession>
}

export type CompositeArenaSession = {
  read: (signal: AbortSignal) => Promise<import('./types').ArenaSession>
}
