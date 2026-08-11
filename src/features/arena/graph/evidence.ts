import type { EvidenceRecord, MechanismEdge } from './types'

export function canRecommendOffMeta(edges: readonly Pick<MechanismEdge, 'evidence'>[]) {
  return edges.some((edge) => edge.evidence.some((record) => record.kind === 'mechanism-verified'))
}

export function evidenceConfidence(records: readonly EvidenceRecord[]): 'low' | 'medium' | 'high' {
  const kinds = new Set(records.map((record) => record.kind))
  if (kinds.has('mechanism-verified') && kinds.has('current-statistics')) return 'high'
  if (kinds.has('mechanism-verified') || kinds.has('current-statistics') || kinds.has('community-sample')) {
    return 'medium'
  }
  return 'low'
}
