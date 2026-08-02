import { canRecommendOffMeta } from '../graph/evidence'
import type { EvidenceRecord } from '../graph/types'
import type {
  ArenaPlannedRoute,
  ArenaRouteInput,
  ArenaRouteKind,
  ArenaRoutePathInput,
  ArenaRouteSet,
  ArenaScoreComponent,
  ArenaScoreComponentKey,
  ArenaScoredRouteCandidate,
} from './types'

const labels: Record<ArenaRouteKind, string> = {
  stable: '稳健路线',
  ceiling: '上限路线',
  'off-meta': '黑科技路线',
}

const componentLabels: Record<ArenaScoreComponentKey, string> = {
  championFit: '英雄契合',
  selectedSynergy: '已选协同',
  immediateValue: '即时收益',
  completionDistance: '成型距离',
  contextValue: '对局价值',
  evidenceValue: '证据强度',
  novelty: '路线新颖度',
  riskPenalty: '风险扣分',
}

const weights: Record<ArenaRouteKind, Record<ArenaScoreComponentKey, number>> = {
  stable: {
    championFit: 1,
    selectedSynergy: 1,
    immediateValue: 1.6,
    completionDistance: 1.5,
    contextValue: 1.2,
    evidenceValue: 1.5,
    novelty: 0.2,
    riskPenalty: 1.5,
  },
  ceiling: {
    championFit: 1.4,
    selectedSynergy: 1.5,
    immediateValue: 0.6,
    completionDistance: 1.2,
    contextValue: 0.8,
    evidenceValue: 0.8,
    novelty: 0.5,
    riskPenalty: 0.8,
  },
  'off-meta': {
    championFit: 0.8,
    selectedSynergy: 1,
    immediateValue: 0.5,
    completionDistance: 1.3,
    contextValue: 0.7,
    evidenceValue: 1,
    novelty: 2,
    riskPenalty: 1.2,
  },
}

function patchLine(patch: string) {
  return patch.split('.').slice(0, 2).join('.')
}

function currentEvidence(records: EvidenceRecord[], patch: string, now: Date) {
  return records.filter((record) => {
    if (record.kind !== 'current-statistics') return true
    const age = now.getTime() - Date.parse(record.collectedAt)
    return patchLine(record.patch) === patchLine(patch) && age >= 0 && age <= 30 * 24 * 60 * 60 * 1000
  })
}

function collectEvidence(candidate: ArenaRoutePathInput, patch: string, now: Date) {
  const unique = new Map<string, EvidenceRecord>()
  for (const edge of candidate.edges) {
    for (const record of currentEvidence(edge.evidence, patch, now)) unique.set(JSON.stringify(record), record)
  }
  return [...unique.values()]
}

function evidenceRaw(records: EvidenceRecord[]) {
  return records.reduce((sum, record) => {
    if (record.kind === 'current-statistics') return sum + 3
    if (record.kind === 'mechanism-verified') return sum + 2
    if (record.kind === 'community-sample') return sum + 1
    return sum
  }, 0)
}

function pathSynergy(candidate: ArenaRoutePathInput) {
  const positiveEdges = candidate.edges.filter((edge) => edge.relation !== 'conflicts')
  const loopBonus = candidate.edges.some((edge) => edge.relation === 'loops') ? 2 : 0
  return candidate.selectedSynergy + positiveEdges.reduce((sum, edge) => sum + edge.weight, 0) + loopBonus
}

function scoreComponent(
  kind: ArenaRouteKind,
  key: ArenaScoreComponentKey,
  raw: number,
  negative = false,
): ArenaScoreComponent {
  const points = Math.round(raw * weights[kind][key] * (negative ? -10 : 10)) / 10
  return {
    key,
    label: componentLabels[key],
    raw,
    points,
    reason: `${componentLabels[key]} ${negative ? '扣除' : '贡献'} ${Math.abs(points)} 分`,
  }
}

function signature(candidate: ArenaRoutePathInput) {
  const decisive = candidate.edges.find((edge) => edge.relation !== 'amplifies') ?? candidate.edges[0]
  const items = [...candidate.completedItemIds].slice(0, 2).sort((left, right) => left - right).join('+')
  const edge = decisive ? `${decisive.from}>${decisive.to}:${decisive.relation}` : 'no-edge'
  return `${candidate.augmentApiName}|${items}|${edge}`
}

function scoreCandidate(
  candidate: ArenaRoutePathInput,
  kind: ArenaRouteKind,
  patch: string,
  now: Date,
): ArenaScoredRouteCandidate {
  const evidence = collectEvidence(candidate, patch, now)
  const conflicts = candidate.edges.filter((edge) => edge.relation === 'conflicts').length
  const components = [
    scoreComponent(kind, 'championFit', candidate.championFit),
    scoreComponent(kind, 'selectedSynergy', pathSynergy(candidate)),
    scoreComponent(kind, 'immediateValue', candidate.immediateValue),
    scoreComponent(kind, 'completionDistance', candidate.missingNodes.length, true),
    scoreComponent(kind, 'contextValue', candidate.contextValue),
    scoreComponent(kind, 'evidenceValue', evidenceRaw(evidence)),
    scoreComponent(kind, 'novelty', candidate.novelty),
    scoreComponent(kind, 'riskPenalty', candidate.risk + conflicts * 3, true),
  ]
  const total = components.reduce((sum, component) => sum + component.points, 0)
  return {
    ...candidate,
    total,
    components,
    evidence,
    explanation: components.map((component) => `${component.label} ${component.points >= 0 ? '+' : ''}${component.points}`).join(' · '),
    riskSummary: conflicts > 0
      ? `存在 ${conflicts} 条机制冲突；另有 ${candidate.missingNodes.length} 个未成型节点。`
      : `机制无直接冲突；仍需 ${candidate.missingNodes.length} 个节点成型。`,
    coreSignature: signature(candidate),
  }
}

function selectRoute(
  kind: ArenaRouteKind,
  input: ArenaRouteInput,
  usedSignatures: Set<string>,
  now: Date,
): ArenaPlannedRoute {
  const candidates = input.candidates
    .filter((candidate) => kind !== 'off-meta' || canRecommendOffMeta(candidate.edges))
    .map((candidate) => scoreCandidate(candidate, kind, input.patch, now))
    .sort((left, right) => right.total - left.total || left.id.localeCompare(right.id))
  const selected = candidates.find((candidate) => !usedSignatures.has(candidate.coreSignature))
  if (!selected) {
    return {
      kind,
      label: labels[kind],
      coreSignature: `unavailable:${kind}`,
      candidates: [],
      alternativeUnavailable: true,
      unavailableReason: kind === 'off-meta'
        ? '没有同时满足机制复核与路线差异的黑科技组合。'
        : '没有可信且与已有路线不同的候选组合。',
    }
  }
  usedSignatures.add(selected.coreSignature)
  return { kind, label: labels[kind], coreSignature: selected.coreSignature, candidates: [selected] }
}

export function planArenaRoutes(input: ArenaRouteInput): ArenaRouteSet {
  const now = input.now ?? new Date()
  const usedSignatures = new Set<string>()
  return {
    routes: (['stable', 'ceiling', 'off-meta'] as const).map((kind) => selectRoute(kind, input, usedSignatures, now)),
  }
}
