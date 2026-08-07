import { createArenaCatalogIndex } from '../catalog/catalog'
import type { ArenaItemDefinition } from '../catalog/gameData'
import type { ArenaAugmentDefinition, ArenaCatalog } from '../catalog/types'
import type { ArenaPlannedRoute, ArenaRouteSet } from '../recommendation/types'
import { createEmptyArenaSession, mergeArenaSession } from '../session/fusion'
import type { ArenaDecisionViewModel } from './types'

const augment = (id: number, apiName: string, name: string, icon: string): ArenaAugmentDefinition => ({
  id, apiName, name, englishName: apiName, description: `${name}描述`, tooltip: `${name}机制`,
  rarity: 'prismatic', iconLargeUrl: icon, iconSmallUrl: icon,
})

export const fixtureAugments = [
  augment(27, 'Earthwake', '大地苏醒', 'https://example.com/earthwake.png'),
  augment(65, 'PhenomenalEvil', '超凡邪恶', 'https://example.com/phenomenal.png'),
  augment(135, 'Spellwake', '法术苏醒', 'https://example.com/spellwake.png'),
]

const catalog: ArenaCatalog = {
  schemaVersion: 1,
  generatedAt: '2026-08-03T00:00:00.000Z',
  sources: { zhCn: 'https://example.com/zh', enUs: 'https://example.com/en' },
  augments: fixtureAugments,
}

const item = (id: number, name: string): ArenaItemDefinition => ({
  id, name, description: name, baseGold: 850, totalGold: 850, from: [], purchasable: true, tags: [],
  iconUrl: `https://example.com/item/${id}.png`,
})

const route = (kind: ArenaPlannedRoute['kind'], augmentIndex: number): ArenaPlannedRoute => ({
  kind,
  label: kind === 'stable' ? '稳健路线' : kind === 'ceiling' ? '上限路线' : '黑科技路线',
  coreSignature: `${kind}-${augmentIndex}`,
  candidates: [{
    id: `${kind}-candidate`,
    augmentApiName: fixtureAugments[augmentIndex].apiName,
    augmentName: fixtureAugments[augmentIndex].name,
    completedItemIds: [4629, 3157],
    edges: [],
    missingNodes: [],
    championFit: 8,
    selectedSynergy: 7,
    immediateValue: 8,
    contextValue: 7,
    novelty: 5,
    risk: 2,
    total: 82 - augmentIndex,
    components: [{ key: 'championFit', label: '英雄契合', raw: 8, points: 8, reason: '位移契合' }],
    evidence: [{ kind: 'mechanism-verified', claim: '已核对位移触发。', reviewedAt: '2026-08-01T00:00:00.000Z' }],
    explanation: '英雄契合 +8',
    riskSummary: '无直接冲突',
    coreSignature: `${kind}-${augmentIndex}`,
  }],
})

export const fixtureRoutes: ArenaRouteSet = {
  routes: [route('stable', 0), route('ceiling', 2), route('off-meta', 1)],
}

fixtureRoutes.routes[0].purchasePlan = {
  buyNow: { ...item(3113, '以太精魂'), purchaseCost: 850 },
  firstCompletedItem: { ...item(4629, '星界驱驰'), totalGold: 3000 },
  laterItems: [{ ...item(3157, '中娅沙漏'), totalGold: 3250 }],
  remainingGold: 0,
  reason: '先买以太精魂，再完成星界驱驰。',
}

export const fixtureModel: ArenaDecisionViewModel = {
  session: mergeArenaSession(createEmptyArenaSession(), {
    candidates: { value: [27, 65, 135], source: 'manual', observedAt: 200, state: 'live' },
    selectedAugments: { value: [], source: 'manual', observedAt: 200, state: 'live' },
    gold: { value: 1680, source: 'live-client', observedAt: 200, state: 'live' },
  }),
  routes: fixtureRoutes,
  catalog: createArenaCatalogIndex(catalog),
  comboLabel: '位移爆发循环',
  sourceLabel: '实时数据 · 本地机制图谱',
}
