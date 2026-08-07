import type { ArenaItemDefinition } from '../catalog/gameData'
import { inferItemCapabilities } from '../graph/capabilities'
import type { ArenaPurchaseChoice, ArenaPurchasePlan, ArenaRoutePathInput } from './types'

type RecipeCost = {
  cost: number | null
  missingIds: number[]
}

function ownershipCounts(ownedItemIds: number[]) {
  const counts = new Map<number, number>()
  for (const id of ownedItemIds) counts.set(id, (counts.get(id) ?? 0) + 1)
  return counts
}

function consumeOwned(id: number, owned: Map<number, number>) {
  const count = owned.get(id) ?? 0
  if (count <= 0) return false
  owned.set(id, count - 1)
  return true
}

function completionCost(
  id: number,
  catalog: Map<number, ArenaItemDefinition>,
  owned: Map<number, number>,
  visiting = new Set<number>(),
): RecipeCost {
  if (consumeOwned(id, owned)) return { cost: 0, missingIds: [] }
  const item = catalog.get(id)
  if (!item) return { cost: null, missingIds: [id] }
  if (visiting.has(id)) return { cost: null, missingIds: [id] }
  if (item.from.length === 0) return { cost: item.totalGold, missingIds: [] }

  const nextVisiting = new Set(visiting).add(id)
  let cost = item.baseGold
  const missingIds: number[] = []
  for (const componentId of item.from) {
    const component = completionCost(componentId, catalog, owned, nextVisiting)
    if (component.cost === null) missingIds.push(...component.missingIds)
    else cost += component.cost
  }
  return missingIds.length > 0 ? { cost: null, missingIds } : { cost, missingIds: [] }
}

function gatherCandidates(
  id: number,
  catalog: Map<number, ArenaItemDefinition>,
  ownedItemIds: number[],
  output: Map<number, ArenaPurchaseChoice>,
  missingIds: Set<number>,
  visiting = new Set<number>(),
) {
  if (ownedItemIds.includes(id) || visiting.has(id)) return
  const item = catalog.get(id)
  if (!item) {
    missingIds.add(id)
    return
  }
  const result = completionCost(id, catalog, ownershipCounts(ownedItemIds))
  if (result.cost === null) result.missingIds.forEach((missingId) => missingIds.add(missingId))
  else output.set(id, { ...item, purchaseCost: result.cost })
  const nextVisiting = new Set(visiting).add(id)
  item.from.forEach((componentId) => gatherCandidates(
    componentId, catalog, ownedItemIds, output, missingIds, nextVisiting,
  ))
}

function orderedTargets(route: ArenaRoutePathInput, ownedItemIds: number[]) {
  const remaining = route.completedItemIds.filter((id) => !ownedItemIds.includes(id))
  if (route.risk < 7 || !route.defensiveItemIds?.length) return remaining
  const defensive = remaining.filter((id) => route.defensiveItemIds?.includes(id))
  return [...defensive, ...remaining.filter((id) => !route.defensiveItemIds?.includes(id))]
}

function capabilityGain(candidate: ArenaItemDefinition, target: ArenaItemDefinition, route: ArenaRoutePathInput) {
  const targetCapabilities = new Set(inferItemCapabilities(target).map((entry) => entry.capability))
  const shared = inferItemCapabilities(candidate).filter((entry) => targetCapabilities.has(entry.capability)).length
  const graphWeight = route.edges
    .filter((edge) => edge.from === `item:${candidate.id}` || edge.to === `item:${candidate.id}`)
    .reduce((sum, edge) => sum + edge.weight, 0)
  const directComponent = target.from.includes(candidate.id) ? 2 : 0
  const completion = candidate.id === target.id ? 100 : 0
  return 1 + shared * 2 + graphWeight + directComponent + completion
}

export function createPurchasePlan(
  route: ArenaRoutePathInput,
  ownedItemIds: number[],
  gold: number,
  itemCatalog: Map<number, ArenaItemDefinition>,
): ArenaPurchasePlan {
  const targetIds = orderedTargets(route, ownedItemIds)
  const firstCompletedItem = itemCatalog.get(targetIds[0] ?? route.completedItemIds[0])
  if (!firstCompletedItem) throw new Error('Arena route has no valid first completed item')
  const laterItems = targetIds.slice(1).map((id) => itemCatalog.get(id)).filter((item): item is ArenaItemDefinition => Boolean(item))
  const candidates = new Map<number, ArenaPurchaseChoice>()
  const missingIds = new Set<number>()
  gatherCandidates(firstCompletedItem.id, itemCatalog, ownedItemIds, candidates, missingIds)
  const affordable = [...candidates.values()]
    .filter((candidate) => candidate.purchasable && candidate.purchaseCost <= gold)
    .sort((left, right) => {
      const leftRatio = capabilityGain(left, firstCompletedItem, route) / Math.max(1, left.purchaseCost)
      const rightRatio = capabilityGain(right, firstCompletedItem, route) / Math.max(1, right.purchaseCost)
      return rightRatio - leftRatio || right.purchaseCost - left.purchaseCost || left.id - right.id
    })
  const buyNow = affordable[0] ?? null

  if (buyNow) {
    const completionText = buyNow.id === firstCompletedItem.id ? `直接合成${firstCompletedItem.name}` : `先买${buyNow.name}`
    return {
      buyNow,
      firstCompletedItem,
      laterItems,
      remainingGold: Math.max(0, buyNow.purchaseCost - gold),
      reason: `${completionText}（${buyNow.purchaseCost} 金币），它是当前路线单位金币机制收益最高的选择。`,
    }
  }

  if (missingIds.size > 0) {
    return {
      buyNow: null,
      firstCompletedItem,
      laterItems,
      remainingGold: 0,
      reason: `配方数据缺失：${[...missingIds].join('、')}，暂不猜测购买组件。`,
    }
  }
  const cheapest = [...candidates.values()].sort((left, right) => left.purchaseCost - right.purchaseCost)[0]
  const remainingGold = cheapest ? Math.max(0, cheapest.purchaseCost - gold) : 0
  return {
    buyNow: null,
    firstCompletedItem,
    laterItems,
    remainingGold,
    reason: cheapest ? `暂不购买；距离${cheapest.name}还差 ${remainingGold} 金币。` : '当前路线已经完成。',
  }
}
