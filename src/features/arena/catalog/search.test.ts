import { describe, expect, it } from 'vitest'
import { fixtureModel } from '../ui/testFixtures'
import { searchArenaAugments } from './search'

describe('Arena augment search', () => {
  it('ranks exact and prefix names ahead of description matches', () => {
    const results = searchArenaAugments(fixtureModel.catalog, '大地', new Map())

    expect(results[0]).toMatchObject({ augment: { name: '大地苏醒' }, matchKind: 'prefix' })
  })

  it('searches English and API names case-insensitively', () => {
    expect(searchArenaAugments(fixtureModel.catalog, 'spellwake', new Map())[0].augment.id).toBe(135)
  })

  it('searches normalized description text and rarity labels', () => {
    expect(searchArenaAugments(fixtureModel.catalog, '机制', new Map())).toHaveLength(3)
    expect(searchArenaAugments(fixtureModel.catalog, '棱彩', new Map())).toHaveLength(3)
  })

  it('keeps unavailable results visible and explains why they are disabled', () => {
    const results = searchArenaAugments(
      fixtureModel.catalog,
      'Earthwake',
      new Map([[27, '已在本轮候选中']]),
    )

    expect(results[0].disabledReason).toBe('已在本轮候选中')
  })

  it('returns deterministic catalog results for an empty query and applies the limit', () => {
    const results = searchArenaAugments(fixtureModel.catalog, '', new Map(), 2)

    expect(results.map((result) => result.augment.id)).toEqual([27, 65])
    expect(results.every((result) => result.matchKind === 'all')).toBe(true)
  })
})
