import type { EvidenceRecord, MechanismEdge } from '../graph/types'

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
}

export type ArenaRouteSet = {
  routes: ArenaPlannedRoute[]
}
