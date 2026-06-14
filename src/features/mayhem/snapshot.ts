import type {
  MayhemConfidence,
  MayhemEvidenceType,
  MayhemSourceRecord,
} from './types'

type BuildInput = {
  patch: string
  officialAugmentIds: number[]
  records: MayhemSourceRecord[]
}

export function buildValidatedMayhemSnapshot(input: BuildInput) {
  const officialIds = new Set(input.officialAugmentIds)
  const records: MayhemSourceRecord[] = []
  const rejected: MayhemSourceRecord[] = []

  for (const record of input.records) {
    const valid =
      record.patch === input.patch &&
      record.queue === 'aram-mayhem' &&
      officialIds.has(record.candidateAugmentId)
    ;(valid ? records : rejected).push(record)
  }

  return {
    patch: input.patch,
    records,
    rejected,
    offMetaRecords: records.filter((record) => (record.games ?? 0) >= 500),
  }
}

export type MayhemSourceKind = 'official' | 'aggregate' | 'community'
export type MayhemSourceStatus = 'online' | 'offline'

export type MayhemSourceHealth = {
  sourceId: string
  kind: MayhemSourceKind
  status: MayhemSourceStatus
  reason?: string
  sourceUrl?: string
}

export type MayhemAugmentMeta = {
  id: number
  apiName?: string
  name: string
  rarity?: string
  description?: string
  iconUrl?: string
}

export type MayhemRecommendation = {
  augmentId: number
  score: number
  winRate: number | null
  games: number
  pickRate: number | null
  sourceCount: number
  confidence: MayhemConfidence
  observing: boolean
  evidenceType: MayhemEvidenceType
  sources: string[]
  sourceUrls: string[]
}

export type MayhemSnapshot = {
  schemaVersion: 1
  queue: 'aram-mayhem'
  patch: string
  generatedAt: string
  expiresAt: string
  completeness: number
  officialCoverage: number
  sources: MayhemSourceHealth[]
  augments: MayhemAugmentMeta[]
  recommendations: {
    strength: MayhemRecommendation[]
    offMeta: MayhemRecommendation[]
  }
}

export type AggregateInput = {
  patch: string
  officialAugmentIds: number[]
  records: MayhemSourceRecord[]
  baselineWinRate?: number
  augments?: MayhemAugmentMeta[]
  sources?: MayhemSourceHealth[]
  generatedAt?: string
}

const DEFAULT_BASELINE_WIN_RATE = 50
const SNAPSHOT_TTL_MS = 36 * 60 * 60 * 1000
const CONFLICT_THRESHOLD_PP = 10
const OFF_META_MIN_GAMES = 500
const OFF_META_MAX_PICK_RATE = 15

function dedupeKey(record: MayhemSourceRecord): string {
  return [
    record.sourceId,
    record.candidateAugmentId,
    record.championId ?? '',
    record.winRate ?? '',
    record.games ?? '',
    [...(record.selectedAugmentIds ?? [])].sort((a, b) => a - b).join('+'),
  ].join('|')
}

function recordWeight(record: MayhemSourceRecord): number {
  const confidence = record.sourceConfidence ?? 0.5
  const games = record.games ?? 0
  // freshnessFactor defaults to 1; no live date-window logic is required here.
  const freshnessFactor = 1
  return confidence * Math.log10(games + 10) * freshnessFactor
}

function deriveConfidence(args: {
  sourceCount: number
  totalGames: number
  conflicting: boolean
}): MayhemConfidence {
  if (args.conflicting) return 'low'
  if (args.sourceCount >= 2 && args.totalGames >= 1000) return 'high'
  if (args.totalGames >= 500) return 'medium'
  return 'low'
}

function buildRecommendation(records: MayhemSourceRecord[]): MayhemRecommendation {
  const augmentId = records[0].candidateAugmentId
  const evidenceType: MayhemEvidenceType = records[0].evidenceType ?? 'aggregate'

  const distinctSources = new Set(records.map((record) => record.sourceId))
  const sourceCount = distinctSources.size

  let totalGames = 0
  let weightSum = 0
  let weightedWinRateSum = 0
  let weightedPickRateSum = 0
  let pickRateWeightSum = 0

  for (const record of records) {
    const weight = recordWeight(record)
    totalGames += record.games ?? 0
    if (record.winRate !== null && record.winRate !== undefined) {
      weightedWinRateSum += record.winRate * weight
      weightSum += weight
    }
    if (record.pickRate !== null && record.pickRate !== undefined) {
      weightedPickRateSum += record.pickRate * weight
      pickRateWeightSum += weight
    }
  }

  const winRate = weightSum > 0 ? weightedWinRateSum / weightSum : null
  const pickRate = pickRateWeightSum > 0 ? weightedPickRateSum / pickRateWeightSum : null

  // Conflict: independent sources whose winRates differ by more than the threshold.
  const winRatesBySource = new Map<string, number>()
  for (const record of records) {
    if (record.winRate === null || record.winRate === undefined) continue
    if (!winRatesBySource.has(record.sourceId)) {
      winRatesBySource.set(record.sourceId, record.winRate)
    }
  }
  const observed = [...winRatesBySource.values()]
  const conflicting =
    observed.length >= 2 &&
    Math.max(...observed) - Math.min(...observed) > CONFLICT_THRESHOLD_PP

  const confidence = deriveConfidence({ sourceCount, totalGames, conflicting })

  // Deterministic aggregate score for ordering. Full scoring lives in Task 6.
  const score = winRate === null ? 0 : winRate * Math.log10(totalGames + 10)

  return {
    augmentId,
    score,
    winRate,
    games: totalGames,
    pickRate,
    sourceCount,
    confidence,
    observing: conflicting,
    evidenceType,
    sources: [...distinctSources],
    sourceUrls: [
      ...new Set(records.map((record) => record.sourceUrl).filter((url): url is string => Boolean(url))),
    ],
  }
}

/**
 * 聚合强度与黑科技快照的权威纯函数实现。
 *
 * 仅做内存计算，不做任何文件 I/O；文件读写由 scripts/mayhem/build-snapshot.mjs 负责。
 * build-snapshot.mjs 内部用 JS 镜像了 dedup / 冲突 / off-meta 门槛逻辑，
 * 并由 snapshot.test.ts 的 parity 测试守护防止漂移。
 */
export function aggregateMayhemRecords(input: AggregateInput): MayhemSnapshot {
  const baselineWinRate = input.baselineWinRate ?? DEFAULT_BASELINE_WIN_RATE
  const augments = input.augments ?? []
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const expiresAt = new Date(new Date(generatedAt).getTime() + SNAPSHOT_TTL_MS).toISOString()

  const { records: validRecords } = buildValidatedMayhemSnapshot({
    patch: input.patch,
    officialAugmentIds: input.officialAugmentIds,
    records: input.records,
  })

  // Dedup exact-duplicate rows from the SAME source so sourceCount counts distinct sources.
  const seen = new Set<string>()
  const dedupedRecords: MayhemSourceRecord[] = []
  for (const record of validRecords) {
    const key = dedupeKey(record)
    if (seen.has(key)) continue
    seen.add(key)
    dedupedRecords.push(record)
  }

  const groups = new Map<number, MayhemSourceRecord[]>()
  for (const record of dedupedRecords) {
    const group = groups.get(record.candidateAugmentId)
    if (group) group.push(record)
    else groups.set(record.candidateAugmentId, [record])
  }

  const aggregateGroups = [...groups.values()].filter((group) =>
    group.some((record) => (record.evidenceType ?? 'aggregate') === 'aggregate'),
  )

  const strength = aggregateGroups
    .map((group) => buildRecommendation(group))
    .sort((a, b) => b.score - a.score || a.augmentId - b.augmentId)

  const offMeta = strength
    .filter((rec) => {
      return (
        rec.evidenceType === 'aggregate' &&
        rec.games >= OFF_META_MIN_GAMES &&
        rec.pickRate !== null &&
        rec.pickRate <= OFF_META_MAX_PICK_RATE &&
        rec.winRate !== null &&
        rec.winRate > baselineWinRate
      )
    })
    .sort((a, b) => b.score - a.score || a.augmentId - b.augmentId)

  const officialIds = new Set(input.officialAugmentIds)
  const officialCoverage =
    officialIds.size === 0
      ? 1
      : augments.length === 0
        ? 1
        : augments.filter((augment) => officialIds.has(augment.id)).length / officialIds.size

  const sources = input.sources ?? []
  const aggregateSources = sources.filter((source) => source.kind === 'aggregate')
  const onlineAggregateSources = aggregateSources.filter((source) => source.status === 'online')
  // Completeness reflects reality: official identity is one layer, but missing aggregate
  // stats should drag the overall score below 1. When no source health is supplied we
  // fall back to coverage-derived signal based on whether any strength entries exist.
  let completeness: number
  if (aggregateSources.length > 0) {
    const aggregateHealth = onlineAggregateSources.length / aggregateSources.length
    completeness = officialCoverage * 0.5 + aggregateHealth * 0.5
  } else {
    completeness = strength.length > 0 ? officialCoverage : officialCoverage * 0.5
  }

  return {
    schemaVersion: 1,
    queue: 'aram-mayhem',
    patch: input.patch,
    generatedAt,
    expiresAt,
    completeness,
    officialCoverage,
    sources,
    augments,
    recommendations: { strength, offMeta },
  }
}
