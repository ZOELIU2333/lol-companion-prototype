export type ArenaRangeClass = 'melee' | 'ranged' | 'unknown'

export type ArenaChampionSpell = {
  id: string
  name: string
  description: string
}

export type ArenaChampionDefinition = {
  id: string
  key: number
  name: string
  title: string
  rangeClass: ArenaRangeClass
  tags: string[]
  spells: ArenaChampionSpell[]
  iconUrl: string
}

export type ArenaItemDefinition = {
  id: number
  name: string
  description: string
  baseGold: number
  totalGold: number
  from: number[]
  purchasable: boolean
  tags: string[]
  iconUrl: string
}

export type ArenaChampionDataFile = {
  schemaVersion: 1
  version: string
  generatedAt: string
  champions: ArenaChampionDefinition[]
}

export type ArenaItemDataFile = {
  schemaVersion: 1
  version: string
  generatedAt: string
  items: ArenaItemDefinition[]
}

export type CurrentGameData = {
  version: string
  champions: Map<number, ArenaChampionDefinition>
  items: Map<number, ArenaItemDefinition>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`)
  return value.trim()
}

function finiteNumber(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`)
  return value
}

function stringList(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${label} must be a string array`)
  }
  return value.map((entry) => entry.trim()).filter(Boolean)
}

function httpUrl(value: unknown, label: string) {
  const raw = requiredString(value, label)
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error(`${label} has invalid icon URL`)
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`${label} has invalid icon URL`)
  return raw
}

function parseSpell(value: unknown, label: string): ArenaChampionSpell {
  if (!isRecord(value)) throw new Error(`${label} must be an object`)
  return {
    id: requiredString(value.id, `${label} id`),
    name: requiredString(value.name, `${label} name`),
    description: typeof value.description === 'string' ? value.description : '',
  }
}

function parseChampion(value: unknown, index: number): ArenaChampionDefinition {
  if (!isRecord(value)) throw new Error(`Champion ${index} must be an object`)
  const key = finiteNumber(value.key, `Champion ${index} key`)
  if (!Number.isInteger(key)) throw new Error(`Champion ${index} key must be an integer`)
  if (!['melee', 'ranged', 'unknown'].includes(String(value.rangeClass))) {
    throw new Error(`Champion ${key} has invalid range class`)
  }
  if (!Array.isArray(value.spells)) throw new Error(`Champion ${key} spells must be an array`)

  return {
    id: requiredString(value.id, `Champion ${key} id`),
    key,
    name: requiredString(value.name, `Champion ${key} name`),
    title: typeof value.title === 'string' ? value.title : '',
    rangeClass: value.rangeClass as ArenaRangeClass,
    tags: stringList(value.tags, `Champion ${key} tags`),
    spells: value.spells.map((spell, spellIndex) => parseSpell(spell, `Champion ${key} spell ${spellIndex}`)),
    iconUrl: httpUrl(value.iconUrl, `Champion ${key}`),
  }
}

function parseItem(value: unknown, index: number): ArenaItemDefinition {
  if (!isRecord(value)) throw new Error(`Item ${index} must be an object`)
  const id = finiteNumber(value.id, `Item ${index} id`)
  if (!Number.isInteger(id)) throw new Error(`Item ${index} id must be an integer`)
  const from = value.from === undefined ? [] : value.from
  if (!Array.isArray(from) || from.some((entry) => typeof entry !== 'number' || !Number.isInteger(entry))) {
    throw new Error(`Item ${id} recipe must be an integer array`)
  }
  if (typeof value.purchasable !== 'boolean') throw new Error(`Item ${id} purchasable must be a boolean`)

  return {
    id,
    name: requiredString(value.name, `Item ${id} name`),
    description: typeof value.description === 'string' ? value.description : '',
    baseGold: finiteNumber(value.baseGold, `Item ${id} baseGold`),
    totalGold: finiteNumber(value.totalGold, `Item ${id} totalGold`),
    from: [...from],
    purchasable: value.purchasable,
    tags: stringList(value.tags, `Item ${id} tags`),
    iconUrl: httpUrl(value.iconUrl, `Item ${id}`),
  }
}

function parseHeader(value: unknown, label: string) {
  if (!isRecord(value)) throw new Error(`${label} must be an object`)
  if (value.schemaVersion !== 1) throw new Error(`Unsupported ${label} schema: ${value.schemaVersion}`)
  return {
    value,
    version: requiredString(value.version, `${label} version`),
    generatedAt: requiredString(value.generatedAt, `${label} generatedAt`),
  }
}

export function parseChampionData(value: unknown): ArenaChampionDataFile {
  const header = parseHeader(value, 'champion data')
  if (!Array.isArray(header.value.champions)) throw new Error('Champion data champions must be an array')
  const champions = header.value.champions.map(parseChampion)
  const keys = new Set<number>()
  const ids = new Set<string>()
  for (const champion of champions) {
    if (keys.has(champion.key)) throw new Error(`Duplicate champion key: ${champion.key}`)
    if (ids.has(champion.id.toLowerCase())) throw new Error(`Duplicate champion id: ${champion.id}`)
    keys.add(champion.key)
    ids.add(champion.id.toLowerCase())
  }
  return { schemaVersion: 1, version: header.version, generatedAt: header.generatedAt, champions }
}

export function parseItemData(value: unknown): ArenaItemDataFile {
  const header = parseHeader(value, 'item data')
  if (!Array.isArray(header.value.items)) throw new Error('Item data items must be an array')
  const items = header.value.items.map(parseItem)
  const ids = new Set<number>()
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`Duplicate item id: ${item.id}`)
    ids.add(item.id)
  }
  return { schemaVersion: 1, version: header.version, generatedAt: header.generatedAt, items }
}

export function createGameDataIndex(
  championData: ArenaChampionDataFile,
  itemData: ArenaItemDataFile,
): CurrentGameData {
  if (championData.version !== itemData.version) {
    throw new Error(`Champion and item data versions do not match: ${championData.version} / ${itemData.version}`)
  }
  return {
    version: championData.version,
    champions: new Map(championData.champions.map((champion) => [champion.key, champion])),
    items: new Map(itemData.items.filter((item) => item.purchasable).map((item) => [item.id, item])),
  }
}

export async function loadCurrentGameData(
  fetcher: typeof fetch = globalThis.fetch,
): Promise<CurrentGameData> {
  const [championResponse, itemResponse] = await Promise.all([
    fetcher('/data/game/champions-zh-cn.json'),
    fetcher('/data/game/items-zh-cn.json'),
  ])
  if (!championResponse.ok) throw new Error(`Failed to load champion data: HTTP ${championResponse.status}`)
  if (!itemResponse.ok) throw new Error(`Failed to load item data: HTTP ${itemResponse.status}`)
  const [champions, items] = await Promise.all([championResponse.json(), itemResponse.json()])
  return createGameDataIndex(parseChampionData(champions), parseItemData(items))
}
