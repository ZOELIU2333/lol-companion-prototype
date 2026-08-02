import { describe, expect, it } from 'vitest'
import { createManifest, iconUrl, normalizeCatalog, validateCatalog } from './catalog-lib.mjs'

const augment = (overrides: Record<string, unknown> = {}) => ({
  id: 27,
  apiName: 'Earthwake',
  name: '大地苏醒',
  desc: '位移后留下<spellName>爆炸轨迹</spellName>。<br>造成伤害。',
  tooltip: '位移后留下轨迹。',
  iconLarge: 'assets/ux/cherry/augments/icons/earthwake_large.png',
  iconSmall: 'assets/ux/cherry/augments/icons/earthwake_small.png',
  rarity: 2,
  ...overrides,
})

const sourceMeta = {
  generatedAt: '2026-08-03T00:00:00.000Z',
  sources: {
    zhCn: 'https://raw.communitydragon.org/latest/cdragon/arena/zh_cn.json',
    enUs: 'https://raw.communitydragon.org/latest/cdragon/arena/en_us.json',
  },
}

describe('Arena catalog importer', () => {
  it('joins localized definitions by id and API name', () => {
    const result = normalizeCatalog(
      { augments: [augment()] },
      { augments: [augment({ name: 'Earthwake', desc: 'Dashes leave a trail.' })] },
      sourceMeta,
      { minimumCount: 1 },
    )

    expect(result.augments[0]).toMatchObject({
      id: 27,
      apiName: 'Earthwake',
      name: '大地苏醒',
      englishName: 'Earthwake',
      description: '位移后留下爆炸轨迹。 造成伤害。',
      rarity: 'prismatic',
    })
  })

  it('uses English identity and text as a fallback', () => {
    const result = normalizeCatalog(
      { augments: [augment({ apiName: '', name: '', desc: '' })] },
      { augments: [augment({ name: 'Earthwake', desc: 'Dashes leave a trail.' })] },
      sourceMeta,
      { minimumCount: 1 },
    )

    expect(result.augments[0]).toMatchObject({
      apiName: 'Earthwake',
      name: 'Earthwake',
      description: 'Dashes leave a trail.',
    })
  })

  it('normalizes game asset icon URLs', () => {
    expect(iconUrl('assets/ux/cherry/augments/icons/earthwake_large.png')).toBe(
      'https://raw.communitydragon.org/latest/game/assets/ux/cherry/augments/icons/earthwake_large.png',
    )
    expect(iconUrl('plugins/example/icon.png')).toBe(
      'https://raw.communitydragon.org/latest/plugins/example/icon.png',
    )
    expect(iconUrl(null)).toBeNull()
  })

  it('sorts deterministically and maps unsupported rarity to unknown', () => {
    const result = normalizeCatalog(
      { augments: [augment({ id: 30, apiName: 'Later' }), augment({ id: 10, apiName: 'Earlier', rarity: 4 })] },
      { augments: [augment({ id: 30, apiName: 'Later' }), augment({ id: 10, apiName: 'Earlier', rarity: 4 })] },
      sourceMeta,
      { minimumCount: 2 },
    )

    expect(result.augments.map((item) => item.id)).toEqual([10, 30])
    expect(result.augments[0].rarity).toBe('unknown')
  })

  it('rejects missing payload arrays and duplicate identifiers', () => {
    expect(() => normalizeCatalog({}, { augments: [] }, sourceMeta, { minimumCount: 1 })).toThrow(
      'Chinese CommunityDragon payload must include an augments array',
    )
    expect(() => normalizeCatalog(
      { augments: [augment(), augment()] },
      { augments: [augment()] },
      sourceMeta,
      { minimumCount: 1 },
    )).toThrow('Duplicate Arena augment id: 27')
  })

  it('enforces minimum live coverage', () => {
    expect(() => validateCatalog({
      schemaVersion: 1,
      generatedAt: sourceMeta.generatedAt,
      sources: sourceMeta.sources,
      augments: [augment()],
    }, { minimumCount: 200 })).toThrow('Arena catalog contains 1 augments; expected at least 200')
  })

  it('creates a stable manifest hash independent of generation time', () => {
    const first = normalizeCatalog(
      { augments: [augment()] },
      { augments: [augment({ name: 'Earthwake' })] },
      sourceMeta,
      { minimumCount: 1 },
    )
    const second = { ...first, generatedAt: '2026-08-04T00:00:00.000Z' }

    expect(createManifest(first).contentHash).toBe(createManifest(second).contentHash)
    expect(createManifest(first)).toMatchObject({ schemaVersion: 1, count: 1 })
  })
})
