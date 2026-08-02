import { describe, expect, it } from 'vitest'
import type { Champion } from '../../../types'
import type { ArenaAugmentDefinition } from '../catalog/types'
import type { ArenaItemDefinition } from '../catalog/gameData'
import { buildMechanismGraph } from './buildGraph'

const ahri: Champion = {
  id: 'ahri', name: '阿狸', role: '法师', damageProfile: 'ap',
  powerWindow: '多段位移', identity: '技能命中法刺', tags: ['dash', 'mage'],
}
const earthwake: ArenaAugmentDefinition = {
  id: 27, apiName: 'Earthwake', name: '大地苏醒', englishName: 'Earthwake',
  description: '冲刺后留下伤害轨迹。', tooltip: '冲刺、闪烁或传送后造成物理伤害。',
  iconLargeUrl: null, iconSmallUrl: null, rarity: 'prismatic',
}
const cosmicDrive: ArenaItemDefinition = {
  id: 4629, name: '星界驱驰', description: '技能急速，造成魔法伤害后获得移动速度。',
  baseGold: 450, totalGold: 3000, from: [3067, 3113, 3108], purchasable: true,
  tags: ['SpellDamage', 'AbilityHaste', 'NonbootsMovement'], iconUrl: 'https://example.com/4629.png',
}

describe('Arena mechanism graph', () => {
  it('connects Ahri movement to Earthwake with reviewed trigger evidence', () => {
    const graph = buildMechanismGraph({ champion: ahri, augments: [earthwake], items: [cosmicDrive] })
    const edge = graph.edges.find((candidate) => candidate.to === 'augment:Earthwake')

    expect(edge).toMatchObject({ from: 'champion:103', relation: 'triggers' })
    expect(edge?.evidence.map((record) => record.kind)).toContain('mechanism-verified')
  })

  it('creates stable unique nodes and an amplification edge for shared AP mechanics', () => {
    const graph = buildMechanismGraph({ champion: ahri, augments: [earthwake], items: [cosmicDrive] })

    expect(new Set(graph.nodes.map((node) => node.id)).size).toBe(graph.nodes.length)
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'item:4629', to: 'champion:103', relation: 'amplifies' }),
    ]))
  })
})
