import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { argValue, cleanText, fetchJson, hasFlag, writeJson } from './shared.mjs'

const cherryUrl = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/cherry-augments.json'
const arenaUrl = 'https://raw.communitydragon.org/latest/cdragon/arena/en_us.json'

function rarityLabel(rarity) {
  switch (String(rarity)) {
    case 'kSilver':
      return 'silver'
    case 'kGold':
      return 'gold'
    case 'kPrismatic':
      return 'prismatic'
    default:
      return 'unknown'
  }
}

function iconUrl(path) {
  if (typeof path !== 'string' || !path.trim()) return null
  const relative = path
    .replaceAll('\\', '/')
    .replace(/^\/lol-game-data\/assets\/assets\//i, '')
    .replace(/^\/lol-game-data\/assets\//i, '')
    .replace(/^\/+/, '')
    .toLowerCase()
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/${relative}`
}

function buildAugments(cherry, arena) {
  if (!Array.isArray(cherry)) throw new Error('cherry-augments payload must be an array')
  const arenaByApiName = new Map(
    (Array.isArray(arena?.augments) ? arena.augments : []).map((augment) => [
      String(augment.apiName ?? '').toLowerCase(),
      augment,
    ]),
  )

  const seen = new Set()
  return cherry
    .filter((augment) => String(augment.augmentNameId ?? '').startsWith('ARAM_'))
    .map((augment) => {
      const apiName = String(augment.augmentNameId ?? '').replace(/^ARAM_/, '')
      const arenaMatch = arenaByApiName.get(apiName.toLowerCase())
      return {
        id: Number(augment.id),
        apiName,
        name: cleanText(augment.nameTRA),
        rarity: rarityLabel(augment.rarity),
        description: cleanText(arenaMatch?.desc),
        iconUrl: iconUrl(augment.augmentSmallIconPath),
      }
    })
    .filter((augment) => {
      if (!Number.isFinite(augment.id)) return false
      if (!augment.name || !augment.iconUrl) return false
      if (seen.has(augment.id)) return false
      seen.add(augment.id)
      return true
    })
    .sort((a, b) => a.id - b.id)
}

async function buildPayload(patch, fromCache, jsonOutput) {
  if (fromCache) {
    return JSON.parse(await readFile(jsonOutput, 'utf8'))
  }
  const [cherry, arena] = await Promise.all([fetchJson(cherryUrl), fetchJson(arenaUrl)])
  const augments = buildAugments(cherry, arena)
  if (!augments.length) {
    console.error('No ARAM Mayhem augments found in CommunityDragon cherry-augments payload')
    process.exit(1)
  }
  return {
    meta: {
      patch,
      queue: 'aram-mayhem',
      sourceIds: ['communitydragon'],
      sourceUrl: cherryUrl,
      collectedAt: new Date().toISOString(),
    },
    augments,
  }
}

const patch = argValue('--patch', '26.12')
const jsonOutput = resolve(argValue('--out', `data/mayhem/${patch}/official-augments.json`))
const fromCache = hasFlag('--from-cache')
const check = hasFlag('--check')

const normalized = (value) =>
  `${JSON.stringify({ ...value, meta: { ...value.meta, collectedAt: 'ignored' } }, null, 2)}\n`

if (check) {
  // Re-derive the expected JSON straight from the live source and compare it
  // against the on-disk file (ignoring the volatile collectedAt timestamp), so
  // the check fails whenever the committed snapshot drifts from the source.
  const expected = await buildPayload(patch, false, jsonOutput)
  const current = JSON.parse(await readFile(jsonOutput, 'utf8'))
  if (normalized(current) !== normalized(expected)) {
    throw new Error(`${jsonOutput} is out of date. Run npm run data:mayhem:official:import.`)
  }
  console.log(`Checked ${jsonOutput} (${expected.augments.length} augments)`)
} else {
  const payload = await buildPayload(patch, fromCache, jsonOutput)
  await writeJson(jsonOutput, payload)
  console.log(`Wrote ${jsonOutput} from ${fromCache ? jsonOutput : cherryUrl} (${payload.augments.length} augments)`)
}
