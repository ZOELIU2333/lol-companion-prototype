import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseArenaCatalog, createArenaCatalogIndex } from '../catalog/catalog'
import { inferAugmentCapabilities, inferChampionCapabilities, inferItemCapabilities } from './capabilities'
import type { ArenaItemDefinition } from '../catalog/gameData'
import type { Champion } from '../../../types'

const catalog = createArenaCatalogIndex(parseArenaCatalog(
  JSON.parse(readFileSync('public/data/arena/catalog.json', 'utf8')),
))

const ahri: Champion = {
  id: 'ahri',
  name: '阿狸',
  role: '法师',
  damageProfile: 'ap',
  powerWindow: '多段突进后排收割',
  identity: '技能命中与机动法刺',
  tags: ['dash', 'mage'],
}

describe('Arena capability inference', () => {
  it('recognizes Earthwake as a dash-triggered damage mechanic', () => {
    expect(inferAugmentCapabilities(catalog.find('Earthwake')!)).toEqual(expect.arrayContaining([
      expect.objectContaining({ capability: 'dash-trigger' }),
      expect.objectContaining({ capability: 'proc-damage' }),
    ]))
  })

  it('applies the reviewed Ahri multi-dash override', () => {
    expect(inferChampionCapabilities(ahri)).toEqual(expect.arrayContaining([
      expect.objectContaining({ capability: 'multi-dash', source: 'reviewed' }),
      expect.objectContaining({ capability: 'ability-hit' }),
    ]))
  })

  it('infers item haste and movement mechanics from localized text and tags', () => {
    const cosmicDrive: ArenaItemDefinition = {
      id: 4629,
      name: '星界驱驰',
      description: '技能急速；造成魔法伤害时提供移动速度。',
      baseGold: 450,
      totalGold: 3000,
      from: [3067, 3113, 3108],
      purchasable: true,
      tags: ['SpellDamage', 'AbilityHaste', 'NonbootsMovement'],
      iconUrl: 'https://example.com/4629.png',
    }

    expect(inferItemCapabilities(cosmicDrive)).toEqual(expect.arrayContaining([
      expect.objectContaining({ capability: 'ability-haste' }),
      expect.objectContaining({ capability: 'move-speed' }),
      expect.objectContaining({ capability: 'ap-scaling' }),
    ]))
  })
})
