import { describe, expect, it } from 'vitest'
import type { RecommendationDataMeta } from '../types'
import { getRecommendationSourceDisplay } from './recommendationMeta'

const baseMeta: RecommendationDataMeta = {
  confidence: 'medium',
  patch: '16.11',
  rank: 'diamond_plus',
  region: 'kr',
  source: 'opgg-kr-high-elo',
}

describe('recommendation meta display', () => {
  it('condenses OP.GG runtime labels into scan-friendly source states', () => {
    expect(getRecommendationSourceDisplay({ ...baseMeta, sourceLabel: 'OP.GG 韩服钻石+ · MCP实时' })).toMatchObject({
      label: 'OP.GG 韩服钻石+',
      status: '实时',
      tone: 'live',
    })

    expect(getRecommendationSourceDisplay({ ...baseMeta, sourceLabel: 'OP.GG 韩服钻石+ · MCP本地缓存' })).toMatchObject({
      label: 'OP.GG 韩服钻石+',
      status: '本地缓存',
      tone: 'local',
    })
  })

  it('shows a temporary syncing state without changing the source label', () => {
    expect(getRecommendationSourceDisplay({ ...baseMeta, sourceLabel: 'OP.GG 韩服钻石+ · MCP缓存' }, true)).toMatchObject({
      label: 'OP.GG 韩服钻石+',
      status: '同步中',
      tone: 'loading',
    })
  })
})
