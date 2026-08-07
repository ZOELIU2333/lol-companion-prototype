import type { EvidenceRecord, MechanismEdge } from '../graph/types'
import type { ArenaItemDefinition } from '../catalog/gameData'

export type ArenaRouteKind = 'stable' | 'ceiling' | 'off-meta'

export type ArenaScoreComponentKey =
  | 'championFit'
  | 'selectedSynergy'
  | 'immediateValue'
  | 'completionDistance'
  | 'contextValue'
  | 'evidenceValue'
  | 'novelty'
  | 'riskPenalty'

export type ArenaRoutePathInput = {
  id: string
  augmentApiName: string
  augmentName: string
  completedItemIds: number[]
  defensiveItemIds?: number[]
  edges: MechanismEdge[]
  missingNodes: string[]
  championFit: number
  selectedSynergy: number
  immediateValue: number
  contextValue: number
  novelty: number
  risk: number
}

export type ArenaRouteInput = {
  patch: string
  now?: Date
  candidates: ArenaRoutePathInput[]
  purchase?: {
    ownedItemIds: number[]
    gold: number
    itemCatalog: Map<number, ArenaItemDefinition>
  }
}

export type ArenaPurchaseChoice = ArenaItemDefinition & {
  purchaseCost: number
}

export type ArenaPurchasePlan = {
  buyNow: ArenaPurchaseChoice | null
  firstCompletedItem: ArenaItemDefinition
  laterItems: ArenaItemDefinition[]
  remainingGold: number
  reason: string
}

export type ArenaScoreComponent = {
  key: ArenaScoreComponentKey
  label: string
  raw: number
  points: number
  reason: string
}

export type ArenaScoredRouteCandidate = ArenaRoutePathInput & {
  total: number
  components: ArenaScoreComponent[]
  evidence: EvidenceRecord[]
  explanation: string
  riskSummary: string
  coreSignature: string
}

export type ArenaPlannedRoute = {
  kind: ArenaRouteKind
  label: string
  coreSignature: string
  candidates: ArenaScoredRouteCandidate[]
  alternativeUnavailable?: boolean
  unavailableReason?: string
  purchasePlan?: ArenaPurchasePlan
}

export type ArenaRouteSet = {
  routes: ArenaPlannedRoute[]
}
