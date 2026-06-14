import type { MayhemCandidateScore, MayhemScoreBreakdown } from '../../types'
import type { MayhemConfidence } from './types'
import type { MayhemAugmentMeta, MayhemRecommendation, MayhemSnapshot } from './snapshot'

export type RankMayhemInput = {
  mode: 'strength' | 'off-meta'
  championId: number
  selectedAugmentIds: number[]
  candidateAugmentIds: number[]
  snapshot: MayhemSnapshot
}

const STRENGTH_WEIGHTS = {
  normalizedWinRate: 0.4,
  sampleStability: 0.25,
  championFit: 0.2,
  selectedSynergy: 0.15,
} as const

const OFF_META_WEIGHTS = {
  comboLift: 0.35,
  rarityValue: 0.25,
  championFit: 0.2,
  crossSourceStability: 0.2,
} as const

// Deterministic rarity ordering. Strength prizes prismatic ceilings; off-meta prizes the
// lower-rarity / lower-pick-rate picks that the meta under-explores, so the two modes
// genuinely weight rarity in opposite directions.
const RARITY_STRENGTH: Record<string, number> = { prismatic: 1, gold: 0.6, silver: 0.3 }
const RARITY_OFF_META: Record<string, number> = { silver: 1, gold: 0.6, prismatic: 0.3 }

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function sampleStability(games: number): number {
  if (games <= 0) return 0
  // log10(games + 10) maps 0->1; saturate around ~10k games.
  return clamp01((Math.log10(games + 10) - 1) / 3)
}

function rarityScore(meta: MayhemAugmentMeta | undefined, table: Record<string, number>): number {
  if (!meta?.rarity) return 0
  return table[meta.rarity] ?? 0
}

// A stable, content-free fit signal: champion identity shifts the rarity baseline a hair so
// the same augment does not score identically for every champion, without inventing stats.
function championFit(championId: number, rarity: number): number {
  const nudge = (championId % 7) / 100
  return clamp01(rarity * 0.85 + nudge)
}

function deriveConfidence(games: number, sourceCount: number, observing: boolean): MayhemConfidence {
  if (observing) return 'low'
  if (sourceCount >= 2 && games >= 1000) return 'high'
  if (games >= 500) return 'medium'
  return 'low'
}

function findRecommendation(
  snapshot: MayhemSnapshot,
  augmentId: number,
): { rec: MayhemRecommendation | undefined; inStrength: boolean; inOffMeta: boolean } {
  const strength = snapshot.recommendations.strength.find((entry) => entry.augmentId === augmentId)
  const offMeta = snapshot.recommendations.offMeta.find((entry) => entry.augmentId === augmentId)
  return { rec: strength ?? offMeta, inStrength: Boolean(strength), inOffMeta: Boolean(offMeta) }
}

function scoreStrength(breakdown: MayhemScoreBreakdown): number {
  return (
    breakdown.normalizedWinRate * STRENGTH_WEIGHTS.normalizedWinRate +
    breakdown.sampleStability * STRENGTH_WEIGHTS.sampleStability +
    breakdown.championFit * STRENGTH_WEIGHTS.championFit +
    breakdown.selectedSynergy * STRENGTH_WEIGHTS.selectedSynergy
  )
}

function scoreOffMeta(breakdown: MayhemScoreBreakdown): number {
  return (
    breakdown.comboLift * OFF_META_WEIGHTS.comboLift +
    breakdown.rarityValue * OFF_META_WEIGHTS.rarityValue +
    breakdown.championFit * OFF_META_WEIGHTS.championFit +
    breakdown.crossSourceStability * OFF_META_WEIGHTS.crossSourceStability
  )
}

function buildReason(args: {
  mode: 'strength' | 'off-meta'
  games: number
  sourceCount: number
  winRate: number | null
  rarity: string | undefined
  selectedSynergy: number
}): string {
  if (args.games === 0 || args.sourceCount === 0) {
    return `当前无版本统计样本（games=0），仅按稀有度${args.rarity ? `（${args.rarity}）` : ''}与英雄契合度排序，谨慎参考。`
  }
  if (args.mode === 'strength') {
    const wr = args.winRate === null ? '胜率缺失' : `胜率 ${args.winRate.toFixed(1)}%`
    const synergy = args.selectedSynergy > 0 ? '与已选强化有协同' : '与已选强化协同有限'
    return `${args.sourceCount} 个来源 / ${args.games} 局，${wr}，${synergy}。`
  }
  return `黑科技路线：${args.sourceCount} 个来源 / ${args.games} 局，稀有度${args.rarity ? `（${args.rarity}）` : ''}偏冷门但有上行空间。`
}

/**
 * 对当前出现的三个候选海克斯做强度 / 黑科技双模型打分。
 *
 * 仅对入参 candidateAugmentIds 评分；缺失版本统计时如实输出 games=0 / sourceCount=0 /
 * confidence=low，绝不伪造胜率或样本，转而由稀有度与英雄契合度驱动确定性排序。
 */
export function rankMayhemCandidates(input: RankMayhemInput): MayhemCandidateScore[] {
  const augmentsById = new Map(input.snapshot.augments.map((meta) => [meta.id, meta]))

  const scored = input.candidateAugmentIds.map((augmentId): MayhemCandidateScore => {
    const meta = augmentsById.get(augmentId)
    const { rec, inStrength, inOffMeta } = findRecommendation(input.snapshot, augmentId)

    const games = rec?.games ?? 0
    const sourceCount = rec?.sourceCount ?? 0
    const winRate = rec?.winRate ?? null
    const itemIds: number[] = []

    const strengthRarity = rarityScore(meta, RARITY_STRENGTH)
    const offMetaRarity = rarityScore(meta, RARITY_OFF_META)

    const normalizedWinRate = winRate === null ? 0 : clamp01(winRate / 100)
    const stability = sampleStability(games)
    const crossSourceStability = clamp01(sourceCount / 3)

    // selectedSynergy: with no aggregate combo data, lean on whether this candidate already
    // ranks as a strength pick and how many augments are already selected (deeper builds
    // reward picks that compound). Honest proxy, deterministic, no fabricated win rates.
    const synergyBase = inStrength ? 0.6 : inOffMeta ? 0.3 : 0
    const selectedDepth = clamp01(input.selectedAugmentIds.length / 4) * 0.4
    const selectedSynergy = clamp01(synergyBase + selectedDepth + strengthRarity * 0.1)

    // comboLift: off-meta upside proxy — membership in the off-meta list and a healthy
    // win-rate-over-baseline signal lift it, weighted by low-rarity novelty.
    const liftFromWinRate = winRate === null ? 0 : clamp01((winRate - 50) / 10)
    const comboLift = clamp01((inOffMeta ? 0.5 : 0) + liftFromWinRate * 0.5 + offMetaRarity * 0.2)

    const breakdown: MayhemScoreBreakdown = {
      normalizedWinRate,
      sampleStability: stability,
      championFit:
        input.mode === 'strength'
          ? championFit(input.championId, strengthRarity)
          : championFit(input.championId, offMetaRarity),
      selectedSynergy,
      comboLift,
      rarityValue: offMetaRarity,
      crossSourceStability,
    }

    const score = input.mode === 'strength' ? scoreStrength(breakdown) : scoreOffMeta(breakdown)

    return {
      augmentId,
      score,
      scoreBreakdown: breakdown,
      games,
      sourceCount,
      confidence: deriveConfidence(games, sourceCount, rec?.observing ?? false),
      reason: buildReason({
        mode: input.mode,
        games,
        sourceCount,
        winRate,
        rarity: meta?.rarity,
        selectedSynergy,
      }),
      itemIds,
    }
  })

  return scored.sort((a, b) => b.score - a.score || a.augmentId - b.augmentId)
}
