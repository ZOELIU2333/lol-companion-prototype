import type { Champion } from '../../../types'
import type { CurrentGameData } from '../catalog/gameData'
import type { ArenaAugmentDefinition, ArenaCatalogIndex } from '../catalog/types'
import { buildMechanismGraph } from '../graph/buildGraph'
import type { MechanismEdge, MechanismGraph } from '../graph/types'
import { planArenaRoutes } from '../recommendation/routePlanner'
import type { ArenaRoutePathInput, ArenaRoutePathSource } from '../recommendation/types'
import type { ArenaSession } from '../session/types'
import type { ArenaDecisionViewModel } from './types'

const itemPackages = [
  [4629, 3157],
  [6655, 4645],
  [3115, 3006],
]

function theoreticalEdge(championKey: number | null, apiName: string): MechanismEdge {
  return {
    from: `champion:${championKey ?? 'unknown'}`,
    to: `augment:${apiName}`,
    relation: 'amplifies',
    weight: 0.4,
    explanation: '尚未形成已复核的直接触发边。',
    evidence: [{ kind: 'theoretical', claim: '仅按文本机制保留为候选。' }],
  }
}

function uniqueAugments(augments: ArenaAugmentDefinition[]) {
  return [...new Map(augments.map((augment) => [augment.id, augment])).values()]
}

function edgesWithin(graph: MechanismGraph, nodeIds: ReadonlySet<string>) {
  return graph.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
}

function hasVerifiedEvidence(edge: MechanismEdge) {
  return edge.evidence.some((record) => record.kind === 'mechanism-verified')
}

function rankFutureTargets(input: {
  champion: Champion
  selected: ArenaAugmentDefinition[]
  available: ArenaAugmentDefinition[]
  items: CurrentGameData['items'] extends Map<number, infer Item> ? Item[] : never
}) {
  if (input.available.length === 0) return []
  const graph = buildMechanismGraph({
    champion: input.champion,
    augments: [...input.selected, ...input.available],
    items: input.items,
  })
  const championNode = graph.nodes.find((node) => node.kind === 'champion')?.id
  const fixedNodes = new Set([
    championNode,
    ...input.selected.map((augment) => `augment:${augment.apiName}`),
    ...input.items.map((item) => `item:${item.id}`),
  ].filter((id): id is string => Boolean(id)))

  return [...input.available]
    .map((augment) => {
      const targetNode = `augment:${augment.apiName}`
      const score = graph.edges
        .filter((edge) =>
          (edge.from === targetNode && fixedNodes.has(edge.to))
          || (edge.to === targetNode && fixedNodes.has(edge.from)))
        .reduce((sum, edge) => sum + edge.weight + (hasVerifiedEvidence(edge) ? 3 : 0), 0)
      return { augment, score }
    })
    .sort((left, right) => right.score - left.score || left.augment.id - right.augment.id)
    .slice(0, 12)
    .map(({ augment }) => augment)
}

export function createArenaDecisionModel(input: {
  champion: Champion
  session: ArenaSession
  catalog: ArenaCatalogIndex
  gameData: CurrentGameData
}): ArenaDecisionViewModel {
  const selected = input.session.selectedAugments.value
    .map((id) => input.catalog.find(id))
    .filter((augment): augment is ArenaAugmentDefinition => augment !== null)
  const enteredCandidates = input.session.candidates.value
    .map((id) => input.catalog.find(id))
    .filter((augment): augment is ArenaAugmentDefinition => augment !== null)
  const currentCandidates = enteredCandidates.length === 3 ? enteredCandidates : []
  const packageDefinitions = itemPackages
    .map((ids) => ({
      availableIds: ids.filter((id) => input.gameData.items.has(id)),
      missingIds: ids.filter((id) => !input.gameData.items.has(id)),
    }))
    .filter((pack) => pack.availableIds.length > 0)
  const packageItems = [...new Set(packageDefinitions.flatMap((pack) => pack.availableIds))]
    .map((id) => input.gameData.items.get(id))
    .filter((item): item is NonNullable<typeof item> => item !== undefined)

  const unavailableIds = new Set([...selected, ...enteredCandidates].map((augment) => augment.id))
  const futureTargets = currentCandidates.length > 0 || selected.length === 0
    ? []
    : rankFutureTargets({
        champion: input.champion,
        selected,
        available: input.catalog.catalog.augments.filter((augment) => !unavailableIds.has(augment.id)),
        items: packageItems,
      })
  const routeAugments = uniqueAugments([...selected, ...currentCandidates, ...futureTargets])
  const graph = buildMechanismGraph({ champion: input.champion, augments: routeAugments, items: packageItems })
  const championNodeId = graph.nodes.find((node) => node.kind === 'champion')?.id
    ?? `champion:${input.session.championKey.value ?? 'unknown'}`
  const selectedNodeIds = selected.map((augment) => `augment:${augment.apiName}`)

  const createPath = (
    source: ArenaRoutePathSource,
    target: ArenaAugmentDefinition | null,
    packageIndex: number,
  ): ArenaRoutePathInput => {
    const pack = packageDefinitions[packageIndex]
    const apiName = target?.apiName
      ?? (source === 'selected-combination'
        ? `SelectedCombination:${selected.map((augment) => augment.apiName).join('+')}`
        : 'ChampionBaseline')
    const name = target?.name
      ?? (source === 'selected-combination' ? `已选组合：${selected.map((augment) => augment.name).join(' + ')}` : '英雄基础路线')
    const relevantNodeIds = new Set([
      championNodeId,
      ...selectedNodeIds,
      ...(target ? [`augment:${target.apiName}`] : []),
      ...pack.availableIds.map((id) => `item:${id}`),
    ])
    const graphEdges = edgesWithin(graph, relevantNodeIds)
    const targetOrItemNodes = new Set([
      ...(target ? [`augment:${target.apiName}`] : []),
      ...pack.availableIds.map((id) => `item:${id}`),
    ])
    const selectedEdges = graphEdges.filter((edge) =>
      edge.relation !== 'conflicts'
      && ((selectedNodeIds.includes(edge.from) && targetOrItemNodes.has(edge.to))
        || (selectedNodeIds.includes(edge.to) && targetOrItemNodes.has(edge.from))))
    const edges = graphEdges.length > 0
      ? graphEdges.slice(0, 6)
      : [theoreticalEdge(input.session.championKey.value, apiName)]
    const reviewedCount = edges.filter(hasVerifiedEvidence).length
    const sourceImmediateValue = source === 'current-candidate' ? 8 : source === 'selected-combination' ? 9 : 6
    const sourceNovelty = source === 'future-target' ? 7 : source === 'baseline' ? 1 : 4

    return {
      id: `${source}-${apiName}-${packageIndex}`,
      source,
      augmentApiName: apiName,
      augmentName: name,
      completedItemIds: pack.availableIds,
      defensiveItemIds: pack.availableIds.includes(3157) ? [3157] : undefined,
      edges,
      missingNodes: pack.missingIds.map((id) => `装备 #${id}`),
      championFit: 6 + Math.min(3, reviewedCount * 2),
      selectedSynergy: selected.length + selectedEdges.reduce((sum, edge) => sum + edge.weight, 0),
      immediateValue: sourceImmediateValue + (packageIndex === 0 ? 2 : 0),
      contextValue: input.session.level.value < 10 && packageIndex === 0 ? 8 : 6,
      novelty: sourceNovelty + (packageIndex === 2 ? 3 : packageIndex),
      risk: source === 'future-target' ? 3 + packageIndex : packageIndex === 2 ? 5 : 1 + packageIndex,
    }
  }

  let candidates: ArenaRoutePathInput[]
  if (currentCandidates.length === 3) {
    candidates = currentCandidates.flatMap((augment) =>
      packageDefinitions.map((_, packageIndex) => createPath('current-candidate', augment, packageIndex)))
  } else if (selected.length > 0) {
    candidates = [
      ...packageDefinitions.map((_, packageIndex) => createPath('selected-combination', null, packageIndex)),
      ...futureTargets.flatMap((augment) =>
        packageDefinitions.map((_, packageIndex) => createPath('future-target', augment, packageIndex))),
    ]
  } else {
    candidates = packageDefinitions.map((_, packageIndex) => createPath('baseline', null, packageIndex))
  }

  const routes = planArenaRoutes({
    patch: input.gameData.version,
    candidates,
    purchase: {
      ownedItemIds: input.session.itemIds.value,
      gold: input.session.gold.value,
      itemCatalog: input.gameData.items,
    },
  })
  const leadingApiName = routes.routes[0]?.candidates[0]?.augmentApiName
  const comboLabel = leadingApiName === 'Earthwake'
    ? '位移爆发循环'
    : leadingApiName === 'Spellwake'
      ? '技能震波循环'
      : selected.length > 0
        ? '已选海克斯联动'
        : '英雄基础构筑'
  const routedFutureNames = new Set(routes.routes
    .map((route) => route.candidates[0])
    .filter((candidate) => candidate?.source === 'future-target')
    .map((candidate) => candidate.augmentApiName))

  return {
    session: input.session,
    routes,
    catalog: input.catalog,
    comboLabel,
    futureTargets: futureTargets.filter((augment) => routedFutureNames.has(augment.apiName)).slice(0, 3),
    sourceLabel: input.session.gold.source === 'live-client'
      ? '实时数据 · 本地机制图谱'
      : '手动海克斯 · 离线机制图谱',
  }
}
