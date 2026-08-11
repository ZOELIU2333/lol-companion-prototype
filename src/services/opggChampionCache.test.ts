// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { opggKrHighEloChampionDetails } from '../data/opggKrHighEloDetails'

const key = 'lol-companion:opgg-champion-detail:ezreal'
const valid = opggKrHighEloChampionDetails.find((detail) => detail.championKey === 'ezreal')!

describe('OP.GG champion cache boundary', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  it('accepts a complete persisted detail', async () => {
    window.localStorage.setItem(key, JSON.stringify(valid))
    const { getRuntimeOpggChampionDetail } = await import('./opggChampionData')

    expect(getRuntimeOpggChampionDetail('ezreal')).toEqual(valid)
    expect(window.localStorage.getItem(key)).not.toBeNull()
  })

  it.each([
    '{broken json',
    JSON.stringify({ championKey: 'ezreal', data: {} }),
    JSON.stringify({ ...valid, data: { ...valid.data, fourthItems: undefined } }),
    JSON.stringify({
      ...valid,
      data: { ...valid.data, runes: { ...valid.data.runes, primaryRuneIds: undefined } },
    }),
  ])('evicts invalid persisted data and returns no runtime override', async (raw) => {
    window.localStorage.setItem(key, raw)
    const { getRuntimeOpggChampionDetail } = await import('./opggChampionData')

    expect(getRuntimeOpggChampionDetail('ezreal')).toBeUndefined()
    expect(window.localStorage.getItem(key)).toBeNull()
  })

  it('rejects invalid fresh data without persistence', async () => {
    const { registerRuntimeOpggChampionDetail } = await import('./opggChampionData')

    expect(registerRuntimeOpggChampionDetail({ championKey: 'ezreal', data: {} } as never)).toBe(false)
    expect(window.localStorage.getItem(key)).toBeNull()
  })
})
