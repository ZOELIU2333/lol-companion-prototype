import type { RecommendationDataMeta } from '../types'

export type RecommendationSourceDisplay = {
  label: string
  status: string
  tone: 'live' | 'local' | 'static' | 'fallback' | 'loading'
  title: string
}

export function formatRecommendationDataSource(meta?: RecommendationDataMeta) {
  if (!meta) return '数据源待接入'
  if (meta.sourceLabel) return meta.sourceLabel

  if (meta.source === 'opgg-kr-high-elo') return 'OP.GG 韩服钻石+'
  if (meta.source === 'opgg-manual') return 'OP.GG 手动种子'
  if (meta.source === 'riot-aggregate') return 'Riot 聚合数据'
  if (meta.source === 'community') return '社区数据'
  return '内置种子数据'
}

export function getRecommendationSourceDisplay(meta?: RecommendationDataMeta, isSyncing = false): RecommendationSourceDisplay {
  const rawLabel = formatRecommendationDataSource(meta)
  const label = rawLabel.split(' · ')[0] || rawLabel

  if (isSyncing) {
    return {
      label,
      status: '同步中',
      tone: 'loading',
      title: `${rawLabel}，正在尝试刷新 OP.GG MCP 实时数据`,
    }
  }

  if (rawLabel.includes('MCP实时')) {
    return {
      label,
      status: '实时',
      tone: 'live',
      title: `${rawLabel}，来自本次运行时 OP.GG MCP 请求`,
    }
  }

  if (rawLabel.includes('MCP本地缓存')) {
    return {
      label,
      status: '本地缓存',
      tone: 'local',
      title: `${rawLabel}，来自上次成功读取后保存在本机的缓存`,
    }
  }

  if (rawLabel.includes('MCP缓存')) {
    return {
      label,
      status: '静态缓存',
      tone: 'static',
      title: `${rawLabel}，来自随应用打包的 OP.GG MCP 缓存`,
    }
  }

  if (meta?.source === 'opgg-kr-high-elo') {
    return {
      label,
      status: '榜单种子',
      tone: 'static',
      title: `${rawLabel}，当前只使用榜单统计，详细出装天赋会继续尝试刷新`,
    }
  }

  return {
    label,
    status: meta ? '兜底' : '待接入',
    tone: 'fallback',
    title: rawLabel,
  }
}

function formatRate(value?: number) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(2)}%` : null
}

function formatSampleSize(value?: number) {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value).toLocaleString('en-US')} 场样本` : null
}

export function formatRecommendationRate(value?: number) {
  return formatRate(value) ?? '-'
}

export function formatRecommendationSampleSize(value?: number) {
  return formatSampleSize(value) ?? ''
}

export function formatRecommendationMetaLine(meta?: RecommendationDataMeta) {
  const parts = [`数据来源：${formatRecommendationDataSource(meta)}`]

  const winRate = formatRate(meta?.winRate)
  if (winRate) parts.push(`胜率 ${winRate}`)

  const pickRate = formatRate(meta?.pickRate)
  if (pickRate) parts.push(`登场率 ${pickRate}`)

  if (meta?.championRank) parts.push(`榜单 #${meta.championRank}`)

  const sampleSize = formatSampleSize(meta?.sampleSize)
  if (sampleSize) parts.push(sampleSize)

  return parts.join(' · ')
}
