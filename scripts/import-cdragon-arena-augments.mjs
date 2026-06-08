import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const defaultSourceUrl = 'https://raw.communitydragon.org/latest/cdragon/arena/en_us.json'
const defaultJsonOutput = 'data/arena/communitydragon-augments-current.json'
const defaultTsOutput = 'src/data/arenaAugments.ts'

function argValue(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function quote(value) {
  return `'${String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\r', '\\r')
    .replaceAll('\n', '\\n')}'`
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/@[A-Za-z0-9_*]+@/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeIconPath(path) {
  if (typeof path !== 'string' || !path.trim()) return null
  const normalized = path.replaceAll('\\', '/').replace(/^\/+/, '')
  return normalized.startsWith('assets/')
    ? `plugins/rcp-be-lol-game-data/global/default/${normalized}`
    : normalized
}

function rarityLabel(rarity) {
  switch (rarity) {
    case 0:
      return 'silver'
    case 1:
      return 'gold'
    case 2:
      return 'prismatic'
    default:
      return 'unknown'
  }
}

function normalizePayload(raw, sourceUrl) {
  if (!raw || typeof raw !== 'object') throw new Error('CommunityDragon payload must be an object')
  if (!Array.isArray(raw.augments)) throw new Error('CommunityDragon payload must include augments array')

  const augments = raw.augments
    .map((augment) => ({
      apiName: String(augment.apiName ?? '').trim(),
      desc: cleanText(augment.desc),
      iconLarge: normalizeIconPath(augment.iconLarge),
      iconSmall: normalizeIconPath(augment.iconSmall),
      id: Number(augment.id),
      name: String(augment.name ?? '').trim(),
      rarity: rarityLabel(augment.rarity),
      tooltip: cleanText(augment.tooltip || augment.desc),
    }))
    .filter((augment) => Number.isFinite(augment.id) && augment.name && augment.apiName)
    .sort((a, b) => a.id - b.id)

  if (!augments.length) throw new Error('No augments found in CommunityDragon payload')

  return {
    meta: {
      collectedAt: new Date().toISOString(),
      count: augments.length,
      locale: 'en_us',
      source: 'communitydragon',
      sourceLabel: 'CommunityDragon Arena',
      sourceUrl,
    },
    augments,
  }
}

function renderTs(payload) {
  const rows = payload.augments
    .map((augment) => `  {
    apiName: ${quote(augment.apiName)},
    desc: ${quote(augment.desc)},
    iconLarge: ${augment.iconLarge ? quote(augment.iconLarge) : 'null'},
    iconSmall: ${augment.iconSmall ? quote(augment.iconSmall) : 'null'},
    id: ${augment.id},
    name: ${quote(augment.name)},
    rarity: ${quote(augment.rarity)},
    tooltip: ${quote(augment.tooltip)},
  },`)
    .join('\n')

  const meta = payload.meta

  return `export type ArenaAugmentRarity = 'silver' | 'gold' | 'prismatic' | 'unknown'

export type ArenaAugmentStat = {
  apiName: string
  desc: string
  iconLarge: string | null
  iconSmall: string | null
  id: number
  name: string
  rarity: ArenaAugmentRarity
  tooltip: string
}

export const arenaAugmentsMeta = {
  collectedAt: ${quote(meta.collectedAt)},
  count: ${meta.count},
  locale: ${quote(meta.locale)},
  source: ${quote(meta.source)},
  sourceLabel: ${quote(meta.sourceLabel)},
  sourceUrl: ${quote(meta.sourceUrl)},
} as const

export const arenaAugments: ArenaAugmentStat[] = [
${rows}
]

export function getArenaAugmentByName(name: string) {
  return arenaAugments.find((augment) => augment.name.toLowerCase() === name.toLowerCase())
}

export function getArenaAugmentByApiName(apiName: string) {
  return arenaAugments.find((augment) => augment.apiName.toLowerCase() === apiName.toLowerCase())
}

export function getArenaAugmentById(id: number) {
  return arenaAugments.find((augment) => augment.id === id)
}
`
}

async function ensureParent(path) {
  await mkdir(dirname(path), { recursive: true })
}

const sourceUrl = argValue('--source', defaultSourceUrl)
const jsonOutput = resolve(argValue('--json-out', defaultJsonOutput))
const tsOutput = resolve(argValue('--ts-out', defaultTsOutput))
const fromCache = process.argv.includes('--from-cache')
const check = process.argv.includes('--check')

let payload
if (fromCache) {
  payload = JSON.parse(await readFile(jsonOutput, 'utf8'))
} else {
  const response = await fetch(sourceUrl)
  if (!response.ok) throw new Error(`CommunityDragon HTTP ${response.status}`)
  payload = normalizePayload(await response.json(), sourceUrl)
}

const tsOutputText = renderTs(payload)

if (check) {
  const current = await readFile(tsOutput, 'utf8')
  if (current !== tsOutputText) {
    throw new Error(`${tsOutput} is out of date. Run npm run data:arena:augments:import.`)
  }
} else {
  await ensureParent(jsonOutput)
  await ensureParent(tsOutput)
  await writeFile(jsonOutput, `${JSON.stringify(payload, null, 2)}\n`)
  await writeFile(tsOutput, tsOutputText)
}

console.log(`${check ? 'Checked' : 'Generated'} ${tsOutput} from ${fromCache ? jsonOutput : sourceUrl} (${payload.augments.length} augments)`)
