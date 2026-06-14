import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { argValue, fetchText, writeJson } from './shared.mjs'

const sourceUrl = 'https://arammayhem.com/augments/'

function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export function parseAramMayhemAugments(html) {
  const rows = []
  const rowPattern =
    /<a href="([^"]+)" class="augment-rank-row[\s\S]*?data-name="([^"]+)"[^>]*data-rarity="([^"]+)"[^>]*data-availability="([^"]+)"[^>]*>[\s\S]*?<img[^>]*alt="([^"]+)"[\s\S]*?<div class="text-right text-base[^>]*>\s*([\d.]+)%\s*<\/div>[\s\S]*?<div class="hidden text-right text-sm[^>]*>\s*([\d.]+)%/g

  let match
  while ((match = rowPattern.exec(String(html ?? ''))) !== null) {
    if (match[4] !== 'live') continue
    rows.push({
      sourcePath: match[1],
      rarity: match[3],
      name: match[5],
      winRate: Number(match[6]),
      pickRate: Number(match[7]),
    })
  }
  return rows
}

async function loadAugmentIndex(patch) {
  const payload = JSON.parse(
    await readFile(resolve(`data/mayhem/${patch}/official-augments.json`), 'utf8'),
  )
  const index = new Map()
  for (const augment of payload.augments ?? []) {
    for (const value of [augment.name, augment.apiName]) {
      const key = normalizeName(value)
      if (key && !index.has(key)) index.set(key, Number(augment.id))
    }
  }
  return index
}

async function runLiveImport(patch, jsonOutput) {
  const collectedAt = new Date().toISOString()
  let html
  try {
    html = await fetchText(sourceUrl)
  } catch (error) {
    await writeJson(jsonOutput, {
      status: 'unavailable',
      reason: `fetch failed: ${error.message}`,
      sourceUrl,
      checkedAt: collectedAt,
    })
    return
  }

  const rows = parseAramMayhemAugments(html)
  const augmentIndex = await loadAugmentIndex(patch)
  const records = rows.flatMap((row) => {
    const candidateAugmentId = augmentIndex.get(normalizeName(row.name))
    if (candidateAugmentId == null) return []
    return [{
      sourceId: 'arammayhem-stats',
      sourceUrl: new URL(row.sourcePath, sourceUrl).toString(),
      collectedAt,
      patch,
      queue: 'aram-mayhem',
      population: 'all-ranks',
      championId: null,
      selectedAugmentIds: [],
      candidateAugmentId,
      itemIds: [],
      games: null,
      wins: null,
      winRate: row.winRate,
      pickRate: row.pickRate,
      sourceConfidence: 0.55,
      evidenceType: 'aggregate',
    }]
  })

  if (records.length === 0) {
    await writeJson(jsonOutput, {
      status: 'unavailable',
      reason: 'page reachable but no live augment statistics matched official ids',
      sourceUrl,
      checkedAt: collectedAt,
    })
    return
  }

  await writeJson(jsonOutput, {
    meta: {
      sourceId: 'arammayhem-stats',
      patch,
      queue: 'aram-mayhem',
      sourceUrl,
      collectedAt,
      parsedRows: rows.length,
      count: records.length,
      sampleDisclosure: 'source publishes win/pick rates but not game counts',
    },
    records,
  })
  console.log(`Wrote ${jsonOutput} from ${sourceUrl} (${records.length}/${rows.length} mapped records)`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const patch = argValue('--patch', '26.12')
  const jsonOutput = resolve(argValue('--out', `data/mayhem/${patch}/arammayhem.json`))
  await runLiveImport(patch, jsonOutput)
}
