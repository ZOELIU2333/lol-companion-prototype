import type { PlayerRecentMatch } from '../../../types'

export type ArenaTeammateEvidence = {
  currentChampionName?: string
  matches: PlayerRecentMatch[]
  profileWinRate?: number
  source: 'opgg' | 'riot' | 'none'
}

export type ArenaTeammateRating = {
  label: '上等马' | '中等马' | '下等马' | '情报不足'
  score: number | null
  confidence: 'high' | 'medium' | 'low'
  sampleSize: number
  reasons: string[]
  source: 'opgg' | 'riot' | 'none'
}

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))
const average = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length

export function isArenaMatchMode(mode: string) {
  const normalized = mode.trim().toLowerCase()
  return ['arena', '斗魂竞技场', 'cherry', 'kiwi'].some((keyword) => normalized.includes(keyword))
}

export function rateArenaTeammate(input: ArenaTeammateEvidence): ArenaTeammateRating {
  const realMatches = input.matches.filter((match) => Number.isFinite(match.score))
  const arenaMatches = realMatches.filter((match) => isArenaMatchMode(match.mode))
  const usableMatches = arenaMatches.length >= 3 ? arenaMatches : realMatches

  if (usableMatches.length < 3) {
    return {
      label: '情报不足',
      score: null,
      confidence: 'low',
      sampleSize: usableMatches.length,
      reasons: [usableMatches.length === 0 ? '没有读取到可用公开战绩' : `仅有 ${usableMatches.length} 场可用战绩，不足以评级`],
      source: input.source,
    }
  }

  const formScore = average(usableMatches.map((match) => clamp(match.score, 0, 100)))
  const championRows = input.currentChampionName
    ? usableMatches.filter((match) => match.champion === input.currentChampionName)
    : []
  const championScore = championRows.length >= 2
    ? average(championRows.map((match) => clamp(match.score, 0, 100)))
    : formScore
  const profileScore = input.profileWinRate === undefined || !Number.isFinite(input.profileWinRate)
    ? formScore
    : clamp(50 + (input.profileWinRate - 50) * 1.5, 35, 75)
  const score = Math.round(formScore * 0.7 + championScore * 0.2 + profileScore * 0.1)
  const label = score >= 72 ? '上等马' : score >= 56 ? '中等马' : '下等马'
  const confidence = arenaMatches.length >= 6 ? 'high' : usableMatches.length >= 5 ? 'medium' : 'low'
  const reasons = [
    arenaMatches.length >= 3
      ? `竞技场近 ${arenaMatches.length} 场均分 ${Math.round(average(arenaMatches.map((match) => match.score)))}`
      : `公开战绩近 ${usableMatches.length} 场均分 ${Math.round(formScore)}`,
  ]
  if (championRows.length >= 2 && input.currentChampionName) {
    reasons.push(`${input.currentChampionName}样本 ${championRows.length} 场，均分 ${Math.round(championScore)}`)
  }
  if (input.profileWinRate !== undefined && Number.isFinite(input.profileWinRate)) {
    reasons.push(`公开资料胜率 ${Math.round(input.profileWinRate)}%`)
  }

  return {
    label,
    score,
    confidence,
    sampleSize: usableMatches.length,
    reasons: reasons.slice(0, 3),
    source: input.source,
  }
}
