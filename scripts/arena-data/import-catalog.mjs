import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createManifest, normalizeCatalog, validateCatalog } from './catalog-lib.mjs'

const defaults = {
  zhSource: 'https://raw.communitydragon.org/latest/cdragon/arena/zh_cn.json',
  enSource: 'https://raw.communitydragon.org/latest/cdragon/arena/en_us.json',
  output: 'public/data/arena/catalog.json',
  manifest: 'public/data/arena/manifest.json',
}

function argValue(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

async function fetchJson(url, label) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'User-Agent': 'lol-companion-arena-catalog/1',
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`${label} HTTP ${response.status}`)
  return response.json()
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function ensureParent(path) {
  await mkdir(dirname(path), { recursive: true })
}

function comparableManifest(manifest) {
  return {
    schemaVersion: manifest.schemaVersion,
    count: manifest.count,
    contentHash: manifest.contentHash,
    sources: manifest.sources,
  }
}

const zhSource = argValue('--zh-source', defaults.zhSource)
const enSource = argValue('--en-source', defaults.enSource)
const outputPath = resolve(argValue('--out', defaults.output))
const manifestPath = resolve(argValue('--manifest', defaults.manifest))
const fromCache = process.argv.includes('--from-cache')
const check = process.argv.includes('--check')

let catalog
if (fromCache) {
  catalog = validateCatalog(await readJson(outputPath))
} else {
  const [zhPayload, enPayload] = await Promise.all([
    fetchJson(zhSource, 'CommunityDragon zh_cn'),
    fetchJson(enSource, 'CommunityDragon en_us'),
  ])
  catalog = normalizeCatalog(zhPayload, enPayload, {
    generatedAt: new Date().toISOString(),
    sources: { zhCn: zhSource, enUs: enSource },
  })
}

const manifest = createManifest(catalog)

if (check) {
  const existingManifest = await readJson(manifestPath)
  if (JSON.stringify(comparableManifest(existingManifest)) !== JSON.stringify(comparableManifest(manifest))) {
    throw new Error(`${manifestPath} does not match ${outputPath}. Run npm run data:arena:import.`)
  }
  console.log(`Checked ${catalog.augments.length} Arena augments (${manifest.contentHash})`)
} else {
  await ensureParent(outputPath)
  await ensureParent(manifestPath)
  await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`)
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Generated ${catalog.augments.length} Arena augments (${manifest.contentHash})`)
}
