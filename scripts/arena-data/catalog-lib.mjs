import { createHash } from 'node:crypto'

const DEFAULT_MINIMUM_COUNT = 200
const ALLOWED_RARITIES = new Set(['silver', 'gold', 'prismatic', 'unknown'])

function assertAugmentArray(payload, label) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.augments)) {
    throw new Error(`${label} CommunityDragon payload must include an augments array`)
  }
}

export function cleanText(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/@[A-Za-z0-9_*]+@/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function iconUrl(path) {
  if (typeof path !== 'string' || !path.trim()) return null
  const normalized = path.replaceAll('\\', '/').replace(/^\/+/, '')
  return normalized.startsWith('assets/')
    ? `https://raw.communitydragon.org/latest/game/${normalized}`
    : `https://raw.communitydragon.org/latest/${normalized}`
}

export function rarityLabel(rarity) {
  switch (Number(rarity)) {
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

function indexEnglishAugments(augments) {
  const byId = new Map()
  const byApiName = new Map()

  for (const augment of augments) {
    const id = Number(augment?.id)
    const apiName = String(augment?.apiName ?? '').trim().toLowerCase()
    if (Number.isFinite(id)) byId.set(id, augment)
    if (apiName) byApiName.set(apiName, augment)
  }

  return { byId, byApiName }
}

export function validateCatalog(catalog, options = {}) {
  const minimumCount = options.minimumCount ?? DEFAULT_MINIMUM_COUNT
  if (!catalog || typeof catalog !== 'object') throw new Error('Arena catalog must be an object')
  if (catalog.schemaVersion !== 1) throw new Error(`Unsupported Arena catalog schema: ${catalog.schemaVersion}`)
  if (!Array.isArray(catalog.augments)) throw new Error('Arena catalog must include an augments array')
  if (catalog.augments.length < minimumCount) {
    throw new Error(`Arena catalog contains ${catalog.augments.length} augments; expected at least ${minimumCount}`)
  }

  const ids = new Set()
  const apiNames = new Set()
  for (const augment of catalog.augments) {
    if (!Number.isFinite(augment?.id)) throw new Error('Arena augment id must be a finite number')
    if (ids.has(augment.id)) throw new Error(`Duplicate Arena augment id: ${augment.id}`)
    ids.add(augment.id)

    const apiName = String(augment.apiName ?? '').trim()
    if (!apiName) throw new Error(`Arena augment ${augment.id} is missing apiName`)
    const normalizedApiName = apiName.toLowerCase()
    if (apiNames.has(normalizedApiName)) throw new Error(`Duplicate Arena augment apiName: ${apiName}`)
    apiNames.add(normalizedApiName)

    if (!String(augment.name ?? '').trim()) throw new Error(`Arena augment ${apiName} is missing localized name`)
    if (!ALLOWED_RARITIES.has(augment.rarity)) throw new Error(`Arena augment ${apiName} has invalid rarity`)
  }

  return catalog
}

export function normalizeCatalog(zhPayload, enPayload, sourceMeta, options = {}) {
  assertAugmentArray(zhPayload, 'Chinese')
  assertAugmentArray(enPayload, 'English')

  const english = indexEnglishAugments(enPayload.augments)
  const augments = zhPayload.augments
    .map((zh) => {
      const id = Number(zh?.id)
      const apiKey = String(zh?.apiName ?? '').trim().toLowerCase()
      const en = english.byId.get(id) ?? english.byApiName.get(apiKey)
      const apiName = String(zh?.apiName || en?.apiName || '').trim()
      const localizedName = String(zh?.name || en?.name || apiName).trim()

      return {
        id,
        apiName,
        name: localizedName,
        englishName: String(en?.name || en?.apiName || apiName).trim(),
        description: cleanText(zh?.desc || en?.desc),
        tooltip: cleanText(zh?.tooltip || zh?.desc || en?.tooltip || en?.desc),
        iconLargeUrl: iconUrl(zh?.iconLarge || en?.iconLarge),
        iconSmallUrl: iconUrl(zh?.iconSmall || en?.iconSmall),
        rarity: rarityLabel(zh?.rarity ?? en?.rarity),
      }
    })
    .sort((left, right) => left.id - right.id || left.apiName.localeCompare(right.apiName))

  return validateCatalog({
    schemaVersion: 1,
    generatedAt: sourceMeta.generatedAt,
    sources: sourceMeta.sources,
    augments,
  }, options)
}

function hashableCatalog(catalog) {
  return {
    schemaVersion: catalog.schemaVersion,
    sources: catalog.sources,
    augments: catalog.augments,
  }
}

export function createManifest(catalog) {
  validateCatalog(catalog, { minimumCount: 1 })
  const contentHash = createHash('sha256')
    .update(JSON.stringify(hashableCatalog(catalog)))
    .digest('hex')

  return {
    schemaVersion: catalog.schemaVersion,
    generatedAt: catalog.generatedAt,
    count: catalog.augments.length,
    contentHash: `sha256:${contentHash}`,
    sources: catalog.sources,
  }
}
