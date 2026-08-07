import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const versionsUrl = 'https://ddragon.leagueoflegends.com/api/versions.json'
const defaults = {
  champions: 'public/data/game/champions-zh-cn.json',
  items: 'public/data/game/items-zh-cn.json',
}

function argValue(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchJson(url, label) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'User-Agent': 'lol-companion-game-data/1',
    },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error(`${label} HTTP ${response.status}`)
  return response.json()
}

async function resolveVersion(explicitVersion) {
  if (explicitVersion) return explicitVersion
  const versions = await fetchJson(versionsUrl, 'Data Dragon versions')
  if (!Array.isArray(versions) || typeof versions[0] !== 'string') {
    throw new Error('Data Dragon versions manifest is invalid')
  }
  return versions[0]
}

function assertPayload(payload, label) {
  if (!payload || typeof payload !== 'object' || !payload.data || typeof payload.data !== 'object') {
    throw new Error(`${label} payload must include a data object`)
  }
}

function normalizeChampions(payload, version, generatedAt) {
  assertPayload(payload, 'Champion')
  const champions = Object.values(payload.data)
    .map((champion) => ({
      id: String(champion.id),
      key: Number(champion.key),
      name: String(champion.name).trim(),
      title: String(champion.title ?? '').trim(),
      rangeClass: Number(champion.stats?.attackrange) > 250 ? 'ranged' : 'melee',
      tags: Array.isArray(champion.tags) ? champion.tags.map(String) : [],
      spells: Array.isArray(champion.spells)
        ? champion.spells.map((spell) => ({
            id: String(spell.id),
            name: String(spell.name).trim(),
            description: cleanText(spell.description),
          }))
        : [],
      iconUrl: `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion.image.full}`,
    }))
    .sort((left, right) => left.key - right.key)

  if (champions.length < 150) throw new Error(`Champion payload contains only ${champions.length} champions`)
  const keys = new Set()
  for (const champion of champions) {
    if (!Number.isInteger(champion.key) || !champion.name || !champion.id) throw new Error('Champion payload has invalid identity')
    if (keys.has(champion.key)) throw new Error(`Duplicate champion key: ${champion.key}`)
    keys.add(champion.key)
  }
  return { schemaVersion: 1, version, generatedAt, champions }
}

function normalizeItems(payload, version, generatedAt) {
  assertPayload(payload, 'Item')
  const items = Object.entries(payload.data)
    .map(([rawId, item]) => ({
      id: Number(rawId),
      name: String(item.name ?? '').trim(),
      description: cleanText(item.description || item.plaintext),
      baseGold: Number(item.gold?.base ?? 0),
      totalGold: Number(item.gold?.total ?? 0),
      from: Array.isArray(item.from) ? item.from.map(Number).filter(Number.isInteger) : [],
      purchasable: item.gold?.purchasable === true,
      tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
      iconUrl: `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${item.image?.full ?? `${rawId}.png`}`,
    }))
    .filter((item) => Number.isInteger(item.id) && item.name)
    .sort((left, right) => left.id - right.id)

  if (items.length < 500) throw new Error(`Item payload contains only ${items.length} items`)
  const ids = new Set()
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`Duplicate item id: ${item.id}`)
    if (!Number.isFinite(item.baseGold) || !Number.isFinite(item.totalGold)) throw new Error(`Item ${item.id} has invalid gold`)
    ids.add(item.id)
  }
  return { schemaVersion: 1, version, generatedAt, items }
}

function comparable(file, collectionKey) {
  return {
    schemaVersion: file.schemaVersion,
    version: file.version,
    [collectionKey]: file[collectionKey],
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

const championPath = resolve(argValue('--champions-out', defaults.champions))
const itemPath = resolve(argValue('--items-out', defaults.items))
const fromCache = process.argv.includes('--from-cache')
const check = process.argv.includes('--check')
const explicitVersion = argValue('--version', undefined)

let championsFile
let itemsFile
if (fromCache) {
  championsFile = await readJson(championPath)
  itemsFile = await readJson(itemPath)
  if (championsFile.version !== itemsFile.version) throw new Error('Cached champion and item versions do not match')
  championsFile = normalizeChampions(
    { data: Object.fromEntries(championsFile.champions.map((champion) => [champion.id, {
      ...champion,
      key: String(champion.key),
      stats: { attackrange: champion.rangeClass === 'ranged' ? 550 : 125 },
      image: { full: champion.iconUrl.split('/').at(-1) },
    }])) },
    championsFile.version,
    championsFile.generatedAt,
  )
  itemsFile = normalizeItems(
    { data: Object.fromEntries(itemsFile.items.map((item) => [String(item.id), {
      ...item,
      gold: { base: item.baseGold, total: item.totalGold, purchasable: item.purchasable },
      image: { full: item.iconUrl.split('/').at(-1) },
    }])) },
    itemsFile.version,
    itemsFile.generatedAt,
  )
} else {
  const version = await resolveVersion(explicitVersion)
  const baseUrl = `https://ddragon.leagueoflegends.com/cdn/${version}/data/zh_CN`
  const [championPayload, itemPayload] = await Promise.all([
    fetchJson(`${baseUrl}/championFull.json`, 'Data Dragon champions'),
    fetchJson(`${baseUrl}/item.json`, 'Data Dragon items'),
  ])
  const generatedAt = new Date().toISOString()
  championsFile = normalizeChampions(championPayload, version, generatedAt)
  itemsFile = normalizeItems(itemPayload, version, generatedAt)
}

if (check) {
  const [existingChampions, existingItems] = await Promise.all([readJson(championPath), readJson(itemPath)])
  if (JSON.stringify(comparable(existingChampions, 'champions')) !== JSON.stringify(comparable(championsFile, 'champions'))) {
    throw new Error(`${championPath} is out of date. Run npm run data:game:import.`)
  }
  if (JSON.stringify(comparable(existingItems, 'items')) !== JSON.stringify(comparable(itemsFile, 'items'))) {
    throw new Error(`${itemPath} is out of date. Run npm run data:game:import.`)
  }
  console.log(`Checked Data Dragon ${championsFile.version}: ${championsFile.champions.length} champions, ${itemsFile.items.length} items`)
} else {
  await Promise.all([writeJson(championPath, championsFile), writeJson(itemPath, itemsFile)])
  console.log(`Generated Data Dragon ${championsFile.version}: ${championsFile.champions.length} champions, ${itemsFile.items.length} items`)
}
