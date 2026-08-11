import { describe, expect, it } from 'vitest'
import type { PlayerRecentMatch } from '../../../types'
import { rateArenaTeammate } from './rating'

const match = (
  score: number,
  result: '胜' | '负',
  champion = '阿狸',
  mode = '斗魂竞技场',
): PlayerRecentMatch => ({
  id: `${champion}-${score}-${result}-${mode}`,
  champion,
  result,
  mode,
  time: '刚刚',
  kda: '5/2/7',
  cs: '6.0',
  kp: 60,
  score,
})

describe('Arena teammate rating', () => {
  it('classifies strong sufficient Arena evidence as 上等马', () => {
    const rating = rateArenaTeammate({
      currentChampionName: '阿狸',
      matches: [82, 79, 76, 84, 74, 80].map((score) => match(score, '胜')),
      profileWinRate: 57,
      source: 'opgg',
    })

    expect(rating).toMatchObject({ label: '上等马', confidence: 'high', sampleSize: 6 })
    expect(rating.reasons).toContainEqual(expect.stringMatching(/竞技场/))
  })

  it('does not call a player 下等马 from too little data', () => {
    const rating = rateArenaTeammate({
      matches: [match(49, '负'), match(46, '负')],
      source: 'opgg',
    })

    expect(rating).toMatchObject({ label: '情报不足', score: null, sampleSize: 2 })
  })

  it('uses the deterministic middle and lower thresholds', () => {
    expect(rateArenaTeammate({ matches: [60, 58, 57].map((score) => match(score, '胜')), source: 'riot' }).label).toBe('中等马')
    expect(rateArenaTeammate({ matches: [45, 50, 52].map((score) => match(score, '负')), source: 'riot' }).label).toBe('下等马')
  })

  it('falls back to mixed real history when Arena samples are scarce', () => {
    const rating = rateArenaTeammate({
      matches: [match(75, '胜'), match(70, '胜'), match(65, '胜', '阿狸', '单双排')],
      source: 'opgg',
    })

    expect(rating).toMatchObject({ label: '中等马', confidence: 'low', sampleSize: 3 })
    expect(rating.reasons[0]).toMatch(/公开战绩/)
  })

  it('uses current champion evidence and reports medium confidence at five usable rows', () => {
    const rating = rateArenaTeammate({
      currentChampionName: '阿狸',
      matches: [match(80, '胜'), match(82, '胜'), match(60, '胜', '盖伦'), match(59, '负', '盖伦'), match(58, '负', '盖伦')],
      source: 'opgg',
    })

    expect(rating.confidence).toBe('medium')
    expect(rating.reasons).toContainEqual(expect.stringMatching(/阿狸样本 2 场/))
  })

  it('returns honest empty evidence', () => {
    expect(rateArenaTeammate({ matches: [], source: 'none' })).toEqual({
      label: '情报不足',
      score: null,
      confidence: 'low',
      sampleSize: 0,
      reasons: ['没有读取到可用公开战绩'],
      source: 'none',
    })
  })
})
