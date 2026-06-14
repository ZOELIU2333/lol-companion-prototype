// Mayhem 快照聚合 — JS 镜像版。
//
// 权威实现是 src/features/mayhem/snapshot.ts 的 aggregateMayhemRecords（由 vitest 测试）。
// node 无法直接 import 严格 TS 模块，故此处用纯 JS 1:1 镜像 dedup / 冲突 / off-meta 门槛 /
// 评分逻辑。两份实现由 snapshot.test.ts 的 parity 测试守护，防止漂移。
// 修改聚合规则时务必同步改两处。

const DEFAULT_BASELINE_WIN_RATE = 50
const SNAPSHOT_TTL_MS = 36 * 60 * 60 * 1000
const CONFLICT_THRESHOLD_PP = 10
const OFF_META_MIN_GAMES = 500
const OFF_META_MAX_PICK_RATE = 15

function validateRecords(patch, officialAugmentIds, records) {
  const officialIds = new Set(officialAugmentIds)
  const valid = []
  for (const record of records) {
    if (
      record.patch === patch &&
      record.queue === 'aram-mayhem' &&
      officialIds.has(record.candidateAugmentId)
    ) {
      valid.push(record)
    }
  }
  return valid
}

function dedupeKey(record) {
  return [
    record.sourceId,
    record.candidateAugmentId,
    record.championId ?? '',
    record.winRate ?? '',
    record.games ?? '',
    [...(record.selectedAugmentIds ?? [])].sort((a, b) => a - b).join('+'),
  ].join('|')
}

function recordWeight(record) {
  const confidence = record.sourceConfidence ?? 0.5
  const games = record.games ?? 0
  const freshnessFactor = 1
  return confidence * Math.log10(games + 10) * freshnessFactor
}

function deriveConfidence({ sourceCount, totalGames, conflicting }) {
  if (conflicting) return 'low'
  if (sourceCount >= 2 && totalGames >= 1000) return 'high'
  if (totalGames >= 500) return 'medium'
  return 'low'
}

function buildRecommendation(records) {
  const augmentId = records[0].candidateAugmentId
  const evidenceType = records[0].evidenceType ?? 'aggregate'

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

  const winRatesBySource = new Map()
  for (const record of records) {
    if (record.winRate === null || record.winRate === undefined) continue
    if (!winRatesBySource.has(record.sourceId)) {
      winRatesBySource.set(record.sourceId, record.winRate)
    }
  }
  const observed = [...winRatesBySource.values()]
  const conflicting =
    observed.length >= 2 && Math.max(...observed) - Math.min(...observed) > CONFLICT_THRESHOLD_PP

  const confidence = deriveConfidence({ sourceCount, totalGames, conflicting })
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
      ...new Set(records.map((record) => record.sourceUrl).filter((url) => Boolean(url))),
    ],
  }
}

export function aggregateMayhemRecords(input) {
  const baselineWinRate = input.baselineWinRate ?? DEFAULT_BASELINE_WIN_RATE
  const augments = input.augments ?? []
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const expiresAt = new Date(new Date(generatedAt).getTime() + SNAPSHOT_TTL_MS).toISOString()

  const validRecords = validateRecords(input.patch, input.officialAugmentIds, input.records)

  const seen = new Set()
  const dedupedRecords = []
  for (const record of validRecords) {
    const key = dedupeKey(record)
    if (seen.has(key)) continue
    seen.add(key)
    dedupedRecords.push(record)
  }

  const groups = new Map()
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
    .filter(
      (rec) =>
        rec.evidenceType === 'aggregate' &&
        rec.games >= OFF_META_MIN_GAMES &&
        rec.pickRate !== null &&
        rec.pickRate <= OFF_META_MAX_PICK_RATE &&
        rec.winRate !== null &&
        rec.winRate > baselineWinRate,
    )
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
  let completeness
  if (aggregateSources.length > 0) {
    const aggregateHealth = onlineAggregateSources.length / aggregateSources.length
    completeness = officialCoverage * 0.5 + aggregateHealth * 0.5
  } else {
    completeness = strength.length > 0 ? officialCoverage : officialCoverage * 0.5
  }

  return {
    schemaVersion: 1,
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
