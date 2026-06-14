import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { argValue, fetchText, writeJson } from './shared.mjs'

const baseUrl = 'https://www.metasrc.com/lol/mayhem'

const cloudflareMarkers = [
  'just a moment',
  'cf-browser-verification',
  'attention required',
  'cf-challenge',
  'enable javascript and cookies to continue',
]

export function isCloudflareChallenge(html) {
  const text = String(html ?? '').toLowerCase()
  return cloudflareMarkers.some((marker) => text.includes(marker))
}

function parseGames(html) {
  const match = String(html).match(/analyzed\s+([\d,]+)\s+[A-Za-z' .]+games/i)
  if (!match) return null
  const value = Number(match[1].replace(/,/g, ''))
  return Number.isFinite(value) ? value : null
}

function parseWinRate(html) {
  const match = String(html).match(/(\d+(?:\.\d+)?)%\s*win rate/i)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

function parsePatch(html) {
  const match = String(html).match(/Patch\s+(\d+(?:\.\d+)+)/i)
  return match ? match[1] : null
}

function parseAugmentNames(html) {
  const phrase = String(html).match(/augment choices include\s+([^.\n]+)/i)
  if (!phrase) return []
  return phrase[1]
    .replace(/\s+and\s+/gi, ',')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
}

export function parseMetasrcChampionPage(html, ctx = {}) {
  return {
    championId: ctx.championId ?? null,
    sourceUrl: ctx.sourceUrl ?? null,
    patch: parsePatch(html),
    games: parseGames(html),
    winRate: parseWinRate(html),
    augmentNames: parseAugmentNames(html),
  }
}

async function loadAugmentNameIndex(patch) {
  const path = resolve(`data/mayhem/${patch}/official-augments.json`)
  const payload = JSON.parse(await readFile(path, 'utf8'))
  const index = new Map()
  for (const augment of payload.augments ?? []) {
    const key = String(augment.name ?? '').trim().toLowerCase()
    if (key && !index.has(key)) index.set(key, Number(augment.id))
  }
  return index
}

function resolveAugmentId(name, index) {
  return index.get(String(name ?? '').trim().toLowerCase()) ?? null
}

function buildRecords(parsed, augmentIndex, { sourceUrl, collectedAt, patch }) {
  const records = []
  for (const name of parsed.augmentNames) {
    const candidateAugmentId = resolveAugmentId(name, augmentIndex)
    if (candidateAugmentId == null) continue
    records.push({
      sourceId: 'metasrc-mayhem',
      sourceUrl,
      collectedAt,
      patch,
      queue: 'aram-mayhem',
      population: 'all-ranks',
      championId: parsed.championId,
      selectedAugmentIds: [],
      candidateAugmentId,
      itemIds: [],
      games: parsed.games,
      winRate: parsed.winRate,
      pickRate: null,
      sourceConfidence: 0.75,
      evidenceType: 'aggregate',
    })
  }
  return records
}

async function runLiveImport(patch, jsonOutput) {
  const sourceUrl = baseUrl
  const checkedAt = new Date().toISOString()

  let html
  try {
    html = await fetchText(sourceUrl)
  } catch (error) {
    await writeUnavailable(jsonOutput, {
      reason: `fetch failed: ${error.message}`,
      sourceUrl,
      checkedAt,
    })
    return
  }

  if (isCloudflareChallenge(html)) {
    await writeUnavailable(jsonOutput, {
      reason: 'Cloudflare challenge returned instead of page content',
      sourceUrl,
      checkedAt,
    })
    return
  }

  let augmentIndex
  try {
    augmentIndex = await loadAugmentNameIndex(patch)
  } catch (error) {
    await writeUnavailable(jsonOutput, {
      reason: `could not load official augments index: ${error.message}`,
      sourceUrl,
      checkedAt,
    })
    return
  }

  const parsed = parseMetasrcChampionPage(html, { championId: null, sourceUrl })
  if ((parsed.patch == null && parsed.games == null && parsed.winRate == null) || parsed.augmentNames.length === 0) {
    await writeUnavailable(jsonOutput, {
      reason: 'page reachable but expected Mayhem stat structure not found (structure changed or not yet published)',
      sourceUrl,
      checkedAt,
    })
    return
  }

  const collectedAt = checkedAt
  const records = buildRecords(parsed, augmentIndex, { sourceUrl, collectedAt, patch })
  if (records.length === 0) {
    await writeUnavailable(jsonOutput, {
      reason: 'parsed augment names did not match any official augment ids',
      sourceUrl,
      checkedAt,
    })
    return
  }

  await writeJson(jsonOutput, {
    meta: {
      sourceId: 'metasrc-mayhem',
      patch,
      queue: 'aram-mayhem',
      sourceUrl,
      collectedAt,
      count: records.length,
    },
    records,
  })
  console.log(`Wrote ${jsonOutput} from ${sourceUrl} (${records.length} records)`)
}

async function writeUnavailable(jsonOutput, { reason, sourceUrl, checkedAt }) {
  await writeJson(jsonOutput, { status: 'unavailable', reason, sourceUrl, checkedAt })
  console.log(`metasrc unavailable: ${reason} (${sourceUrl})`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const patch = argValue('--patch', '26.12')
  const jsonOutput = resolve(argValue('--out', `data/mayhem/${patch}/metasrc.json`))
  await runLiveImport(patch, jsonOutput)
}
