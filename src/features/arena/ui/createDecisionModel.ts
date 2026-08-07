import type { Champion } from '../../../types'
import type { ArenaCatalogIndex } from '../catalog/types'
import type { CurrentGameData } from '../catalog/gameData'
import { buildMechanismGraph } from '../graph/buildGraph'
import type { MechanismEdge } from '../graph/types'
import { planArenaRoutes } from '../recommendation/routePlanner'
import type { ArenaRoutePathInput } from '../recommendation/types'
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

export function createArenaDecisionModel(input: {
  champion: Champion
  session: ArenaSession
  catalog: ArenaCatalogIndex
  gameData: CurrentGameData
}): ArenaDecisionViewModel {
  const augments = input.session.candidates.value
    .map((id) => input.catalog.find(id))
    .filter((augment) => augment !== null)
  const packageItems = itemPackages.flatMap((ids) => ids)
    .map((id) => input.gameData.items.get(id))
    .filter((item) => item !== undefined)
  const graph = buildMechanismGraph({ champion: input.champion, augments, items: packageItems })
  const candidates: ArenaRoutePathInput[] = augments.flatMap((augment, augmentIndex) =>
    itemPackages.map((itemIds, packageIndex) => {
      const relevantNodeIds = new Set([`augment:${augment.apiName}`, ...itemIds.map((id) => `item:${id}`)])
      const edges = graph.edges.filter((edge) =>
        relevantNodeIds.has(edge.from) || relevantNodeIds.has(edge.to)).slice(0, 3)
      const isReviewed = edges.some((edge) => edge.evidence.some((record) => record.kind === 'mechanism-verified'))
      return {
        id: `${augment.apiName}-${packageIndex}`,
        augmentApiName: augment.apiName,
        augmentName: augment.name,
        completedItemIds: itemIds,
        defensiveItemIds: [3157],
        edges: edges.length > 0 ? edges : [theoreticalEdge(input.session.championKey.value, augment.apiName)],
        missingNodes: itemIds.filter((id) => !input.gameData.items.has(id)).map((id) => `装备 #${id}`),
        championFit: 6 + (isReviewed ? 3 : 0) + (augmentIndex === 0 ? 1 : 0),
        selectedSynergy: 4 + edges.filter((edge) => edge.relation !== 'conflicts').length,
        immediateValue: packageIndex === 0 ? 9 : packageIndex === 1 ? 6 : 4,
        contextValue: input.session.level.value < 10 && packageIndex === 0 ? 8 : 6,
        novelty: packageIndex === 2 ? 10 : packageIndex === 1 ? 5 : 2,
        risk: packageIndex === 2 ? 6 : packageIndex === 1 ? 3 : 1,
      }
    }))
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
      : '机制联动路线'
  return {
    session: input.session,
    routes,
    catalog: input.catalog,
    comboLabel,
    sourceLabel: input.session.gold.source === 'live-client'
      ? '实时数据 · 本地机制图谱'
      : '手动候选 · 离线机制图谱',
  }
}
