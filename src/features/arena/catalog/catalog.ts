import type {
  ArenaAugmentDefinition,
  ArenaAugmentRarity,
  ArenaCatalog,
  ArenaCatalogIndex,
  ArenaCatalogManifest,
  ArenaCatalogSources,
} from './types'

const MINIMUM_AUGMENT_COUNT = 200
const rarities = new Set<ArenaAugmentRarity>(['silver', 'gold', 'prismatic', 'unknown'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`)
  return value.trim()
}

function nullableHttpUrl(value: unknown, label: string) {
  if (value === null) return null
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

function parseSources(value: unknown): ArenaCatalogSources {
  if (!isRecord(value)) throw new Error('Arena catalog sources must be an object')
  return {
    zhCn: requiredString(value.zhCn, 'Arena catalog Chinese source'),
    enUs: requiredString(value.enUs, 'Arena catalog English source'),
  }
}

function parseAugment(value: unknown, index: number): ArenaAugmentDefinition {
  if (!isRecord(value)) throw new Error(`Arena augment ${index} must be an object`)
  if (typeof value.id !== 'number' || !Number.isFinite(value.id)) {
    throw new Error(`Arena augment ${index} id must be a finite number`)
  }
  if (!rarities.has(value.rarity as ArenaAugmentRarity)) {
    throw new Error(`Arena augment ${value.id} has invalid rarity`)
  }

  return {
    id: value.id,
    apiName: requiredString(value.apiName, `Arena augment ${value.id} apiName`),
    name: requiredString(value.name, `Arena augment ${value.id} localized name`),
    englishName: requiredString(value.englishName, `Arena augment ${value.id} English name`),
    description: typeof value.description === 'string' ? value.description : '',
    tooltip: typeof value.tooltip === 'string' ? value.tooltip : '',
    iconLargeUrl: nullableHttpUrl(value.iconLargeUrl, `Arena augment ${value.id}`),
    iconSmallUrl: nullableHttpUrl(value.iconSmallUrl, `Arena augment ${value.id}`),
    rarity: value.rarity as ArenaAugmentRarity,
  }
}

export function parseArenaCatalog(value: unknown): ArenaCatalog {
  if (!isRecord(value)) throw new Error('Arena catalog must be an object')
  if (value.schemaVersion !== 1) throw new Error(`Unsupported Arena catalog schema: ${value.schemaVersion}`)
  if (!Array.isArray(value.augments)) throw new Error('Arena catalog augments must be an array')
  if (value.augments.length < MINIMUM_AUGMENT_COUNT) {
    throw new Error(`Arena catalog contains ${value.augments.length} augments; expected at least ${MINIMUM_AUGMENT_COUNT}`)
  }

  const ids = new Set<number>()
  const apiNames = new Set<string>()
  const augments = value.augments.map(parseAugment)
  for (const augment of augments) {
    if (ids.has(augment.id)) throw new Error(`Duplicate Arena augment id: ${augment.id}`)
    ids.add(augment.id)
    const apiName = augment.apiName.toLowerCase()
    if (apiNames.has(apiName)) throw new Error(`Duplicate Arena augment apiName: ${augment.apiName}`)
    apiNames.add(apiName)
  }

  return {
    schemaVersion: 1,
    generatedAt: requiredString(value.generatedAt, 'Arena catalog generatedAt'),
    sources: parseSources(value.sources),
    augments,
  }
}

function parseManifest(value: unknown): ArenaCatalogManifest {
  if (!isRecord(value)) throw new Error('Arena catalog manifest must be an object')
  if (value.schemaVersion !== 1) throw new Error(`Unsupported Arena catalog manifest schema: ${value.schemaVersion}`)
  if (typeof value.count !== 'number' || !Number.isInteger(value.count)) {
    throw new Error('Arena catalog manifest count must be an integer')
  }
  const contentHash = requiredString(value.contentHash, 'Arena catalog manifest contentHash')
  if (!/^sha256:[a-f0-9]{64}$/i.test(contentHash)) throw new Error('Arena catalog manifest contentHash is invalid')
  return {
    schemaVersion: 1,
    generatedAt: requiredString(value.generatedAt, 'Arena catalog manifest generatedAt'),
    count: value.count,
    contentHash: contentHash as `sha256:${string}`,
    sources: parseSources(value.sources),
  }
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function verifyArenaCatalogManifest(catalog: ArenaCatalog, value: unknown) {
  const manifest = parseManifest(value)
  if (manifest.count !== catalog.augments.length) throw new Error('Arena catalog augment count does not match manifest')
  if (JSON.stringify(manifest.sources) !== JSON.stringify(catalog.sources)) {
    throw new Error('Arena catalog sources do not match manifest')
  }
  const content = JSON.stringify({
    schemaVersion: catalog.schemaVersion,
    sources: catalog.sources,
    augments: catalog.augments,
  })
  const contentHash = `sha256:${await sha256(content)}`
  if (contentHash !== manifest.contentHash) throw new Error('Arena catalog content hash does not match manifest')
  return manifest
}

export function createArenaCatalogIndex(catalog: ArenaCatalog): ArenaCatalogIndex {
  const byId = new Map<number, ArenaAugmentDefinition>()
  const byName = new Map<string, ArenaAugmentDefinition>()
  for (const augment of catalog.augments) {
    byId.set(augment.id, augment)
    for (const name of [augment.apiName, augment.name, augment.englishName]) {
      byName.set(name.trim().toLowerCase(), augment)
    }
  }

  return {
    catalog,
    find(query) {
      return typeof query === 'number'
        ? byId.get(query) ?? null
        : byName.get(query.trim().toLowerCase()) ?? null
    },
  }
}
