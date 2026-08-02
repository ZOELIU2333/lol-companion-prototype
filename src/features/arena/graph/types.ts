export type EdgeRelation = 'triggers' | 'amplifies' | 'converts' | 'loops' | 'conflicts'
export type EvidenceKind = 'current-statistics' | 'community-sample' | 'mechanism-verified' | 'theoretical'

export type ArenaCapability =
  | 'dash'
  | 'dash-trigger'
  | 'multi-dash'
  | 'blink'
  | 'teleport'
  | 'ability-hit-trigger'
  | 'ability-hit'
  | 'attack-hit-trigger'
  | 'attack-hit'
  | 'critical-strike'
  | 'heal'
  | 'shield'
  | 'burn'
  | 'cooldown'
  | 'ability-haste'
  | 'summon'
  | 'immobilize'
  | 'execute'
  | 'stacking'
  | 'revive'
  | 'proc-damage'
  | 'repeat-cast'
  | 'ap-scaling'
  | 'ad-scaling'
  | 'move-speed'
  | 'durability'
  | 'sustain'
  | 'on-hit'
  | 'basic-attack'
  | 'ranged'
  | 'melee'
  | 'max-health'
  | 'low-health'
  | 'mana'
  | 'area-damage'

export type CapabilityWeight = {
  capability: ArenaCapability
  weight: number
  source: 'inferred' | 'reviewed'
}

export type CurrentStatisticsEvidence = {
  kind: 'current-statistics'
  claim: string
  patch: string
  sampleSize: number
  collectedAt: string
  metric: string
  value: number
  sourceUrl: string
}

export type CommunitySampleEvidence = {
  kind: 'community-sample'
  claim: string
  collectedAt: string
  sourceUrl: string
}

export type MechanismVerifiedEvidence = {
  kind: 'mechanism-verified'
  claim: string
  reviewedAt: string
  sourceUrl?: string
}

export type TheoreticalEvidence = {
  kind: 'theoretical'
  claim: string
}

export type EvidenceRecord =
  | CurrentStatisticsEvidence
  | CommunitySampleEvidence
  | MechanismVerifiedEvidence
  | TheoreticalEvidence

export type MechanismNode = {
  id: string
  kind: 'champion' | 'augment' | 'item' | 'capability'
  label: string
  sourceKey: string | number
  capabilities: CapabilityWeight[]
}

export type MechanismEdge = {
  from: string
  to: string
  relation: EdgeRelation
  weight: number
  explanation: string
  evidence: EvidenceRecord[]
}

export type MechanismGraph = {
  nodes: MechanismNode[]
  edges: MechanismEdge[]
}
