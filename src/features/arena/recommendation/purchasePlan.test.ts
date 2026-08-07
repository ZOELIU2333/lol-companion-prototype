import { describe, expect, it } from 'vitest'
import type { ArenaItemDefinition } from '../catalog/gameData'
import { createPurchasePlan } from './purchasePlan'
import type { ArenaRoutePathInput } from './types'

const item = (
  id: number,
  name: string,
  totalGold: number,
  from: number[] = [],
  tags: string[] = [],
  baseGold = totalGold,
): ArenaItemDefinition => ({
  id, name, totalGold, from, tags, baseGold, purchasable: true, description: tags.join(' '),
  iconUrl: `https://example.com/${id}.png`,
})

const itemList = [
  item(1026, '爆裂魔杖', 850, [], ['SpellDamage']),
  item(1052, '增幅典籍', 400, [], ['SpellDamage']),
  item(3067, '燃烧宝石', 800, [], ['Health', 'AbilityHaste']),
  item(3113, '以太精魂', 850, [], ['SpellDamage', 'NonbootsMovement']),
  item(3108, '恶魔法典', 850, [1052], ['SpellDamage', 'AbilityHaste'], 450),
  item(4629, '星界驱驰', 3000, [3067, 3113, 3108], ['Health', 'SpellDamage', 'AbilityHaste'], 500),
  item(3191, '探索者的护臂', 1600, [1026], ['Armor', 'SpellDamage'], 750),
  item(3157, '中娅沙漏', 3250, [1026, 3191], ['Armor', 'SpellDamage'], 800),
]
const items = new Map<number, ArenaItemDefinition>(itemList.map((definition) => [definition.id, definition]))

const cosmicRoute: ArenaRoutePathInput = {
  id: 'cosmic', augmentApiName: 'Spellwake', augmentName: '法术苏醒',
  completedItemIds: [4629, 3157], edges: [], missingNodes: [], championFit: 8,
  selectedSynergy: 8, immediateValue: 7, contextValue: 6, novelty: 4, risk: 2,
}

describe('Arena purchase planning', () => {
  it('recommends an affordable component before the completed item', () => {
    const plan = createPurchasePlan(cosmicRoute, [], 1680, items)

    expect(plan.buyNow?.totalGold).toBeLessThanOrEqual(1680)
    expect(plan.buyNow?.id).not.toBe(4629)
    expect(plan.firstCompletedItem.id).toBe(4629)
  })

  it('does not recommend an already owned component', () => {
    const plan = createPurchasePlan(cosmicRoute, [3108], 900, items)

    expect(plan.buyNow?.id).not.toBe(3108)
  })

  it('completes the target item for its exact combine gold', () => {
    const plan = createPurchasePlan(cosmicRoute, [3067, 3113, 3108], 500, items)

    expect(plan.buyNow).toMatchObject({ id: 4629, purchaseCost: 500 })
  })

  it('reports exact remaining gold when nothing is affordable', () => {
    const plan = createPurchasePlan(cosmicRoute, [], 100, items)

    expect(plan.buyNow).toBeNull()
    expect(plan.reason).toContain('还差 300')
  })

  it('moves a defensive completion first under high route risk', () => {
    const plan = createPurchasePlan({
      ...cosmicRoute,
      risk: 8,
      defensiveItemIds: [3157],
    }, [], 900, items)

    expect(plan.firstCompletedItem.id).toBe(3157)
  })

  it('handles a missing recipe without inventing a component', () => {
    const broken = item(9999, '损坏装备', 2000, [9998], ['SpellDamage'], 500)
    const plan = createPurchasePlan({ ...cosmicRoute, completedItemIds: [9999] }, [], 1000, new Map([[9999, broken]]))

    expect(plan.buyNow).toBeNull()
    expect(plan.reason).toContain('配方数据缺失')
  })
})
