import type { ArenaAugmentDefinition, ArenaCatalogIndex } from './types'

export type ArenaAugmentSearchResult = {
  augment: ArenaAugmentDefinition
  disabledReason: string | null
  matchKind: 'exact' | 'prefix' | 'name' | 'description' | 'all'
}

const matchOrder: Record<ArenaAugmentSearchResult['matchKind'], number> = {
  exact: 0,
  prefix: 1,
  name: 2,
  description: 3,
  all: 4,
}

const rarityLabels: Record<ArenaAugmentDefinition['rarity'], string> = {
  silver: 'silver 白银 银色',
  gold: 'gold 黄金 金色',
  prismatic: 'prismatic 棱彩 彩色',
  unknown: 'unknown 未知',
}

function normalize(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
}

function classifyMatch(augment: ArenaAugmentDefinition, query: string): ArenaAugmentSearchResult['matchKind'] | null {
  if (!query) return 'all'

  const names = [augment.name, augment.englishName, augment.apiName].map(normalize)
  if (names.some((name) => name === query)) return 'exact'
  if (names.some((name) => name.startsWith(query))) return 'prefix'
  if (names.some((name) => name.includes(query))) return 'name'

  const description = normalize([
    augment.description,
    augment.tooltip,
    rarityLabels[augment.rarity],
  ].join(' '))
  return description.includes(query) ? 'description' : null
}

export function searchArenaAugments(
  catalog: ArenaCatalogIndex,
  query: string,
  unavailable: ReadonlyMap<number, string>,
  limit = 40,
): ArenaAugmentSearchResult[] {
  const normalizedQuery = normalize(query)
  const safeLimit = Math.max(0, Math.floor(limit))
  const results = catalog.catalog.augments.flatMap((augment) => {
    const matchKind = classifyMatch(augment, normalizedQuery)
    return matchKind
      ? [{ augment, disabledReason: unavailable.get(augment.id) ?? null, matchKind }]
      : []
  })

  if (normalizedQuery) {
    results.sort((left, right) =>
      matchOrder[left.matchKind] - matchOrder[right.matchKind]
      || left.augment.name.localeCompare(right.augment.name, 'zh-CN')
      || left.augment.id - right.augment.id)
  }

  return results.slice(0, safeLimit)
}
