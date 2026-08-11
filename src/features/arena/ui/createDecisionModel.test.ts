import { describe, expect, it } from 'vitest'
import type { Champion } from '../../../types'
import type { ArenaItemDefinition, CurrentGameData } from '../catalog/gameData'
import type { ArenaObservation } from '../session/types'
import { createEmptyArenaSession, mergeArenaSession } from '../session/fusion'
import { createArenaDecisionModel } from './createDecisionModel'
import { fixtureModel } from './testFixtures'

const observation = <T,>(value: T): ArenaObservation<T> => ({
  value,
  source: 'manual',
  observedAt: 100,
  state: 'live',
})

const champion: Champion = {
  id: 'ahri',
  name: '阿狸',
  role: '中路',
  damageProfile: 'ap',
  powerWindow: '中期',
  identity: '位移法师',
  tags: ['位移', '法术'],
}

const item = (id: number, name: string, totalGold: number, tags: string[] = []): ArenaItemDefinition => ({
  id,
  name,
  description: name,
  baseGold: totalGold,
  totalGold,
  from: [],
  purchasable: true,
  tags,
  iconUrl: `https://example.com/${id}.png`,
})

const itemDefinitions = [
  item(4629, '星界驱驰', 3000, ['SpellDamage', 'AbilityHaste']),
  item(3157, '中娅沙漏', 3250, ['Armor', 'SpellDamage']),
  item(6655, '卢登的回声', 2750, ['SpellDamage', 'Mana']),
  item(4645, '影焰', 3200, ['SpellDamage', 'MagicPenetration']),
  item(3115, '纳什之牙', 2900, ['AttackSpeed', 'SpellDamage', 'OnHit']),
  item(3006, '狂战士胫甲', 1100, ['AttackSpeed', 'Boots']),
]
const gameData: CurrentGameData = {
  version: '16.11.1',
  champions: new Map(),
  items: new Map(itemDefinitions.map((definition) => [definition.id, definition])),
}

const liveSessionWithoutAugments = mergeArenaSession(createEmptyArenaSession(), {
  championKey: observation(103),
  selectedAugments: observation([]),
  candidates: observation([]),
  itemIds: observation([]),
  gold: observation(1200),
  level: observation(8),
})

const sessionWithSelected = (ids: number[]) => mergeArenaSession(liveSessionWithoutAugments, {
  selectedAugments: observation(ids),
})

describe('Arena decision model', () => {
  it('creates item advice without selected augments or current candidates', () => {
    const model = createArenaDecisionModel({
      champion,
      session: liveSessionWithoutAugments,
      catalog: fixtureModel.catalog,
      gameData,
    })
    const purchase = model.routes.routes.find((route) => route.purchasePlan)?.purchasePlan

    expect(purchase?.firstCompletedItem).toBeDefined()
  })

  it('uses selected augments to rerank combined item paths', () => {
    const baseline = createArenaDecisionModel({
      champion,
      session: liveSessionWithoutAugments,
      catalog: fixtureModel.catalog,
      gameData,
    })
    const selected = createArenaDecisionModel({
      champion,
      session: sessionWithSelected([27]),
      catalog: fixtureModel.catalog,
      gameData,
    })

    expect(selected.routes.routes[0].coreSignature).not.toBe(baseline.routes.routes[0].coreSignature)
  })

  it('labels catalog suggestions as future targets when current candidates are empty', () => {
    const model = createArenaDecisionModel({
      champion,
      session: sessionWithSelected([27]),
      catalog: fixtureModel.catalog,
      gameData,
    })

    expect(model.futureTargets.length).toBeGreaterThan(0)
    expect(model.routes.routes.some((route) => route.candidates[0]?.source === 'future-target')).toBe(true)
  })

  it('marks entered candidates as current choices rather than future targets', () => {
    const session = mergeArenaSession(liveSessionWithoutAugments, { candidates: observation([27, 65, 135]) })
    const model = createArenaDecisionModel({ champion, session, catalog: fixtureModel.catalog, gameData })

    expect(model.routes.routes.filter((route) => route.candidates.length > 0)
      .every((route) => route.candidates[0].source === 'current-candidate')).toBe(true)
    expect(model.futureTargets).toEqual([])
  })
})
