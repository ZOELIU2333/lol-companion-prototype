import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { argValue, fetchText, writeJson } from './shared.mjs'

const baseUrl = 'https://op.gg/lol/modes/aram-mayhem'

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

function parseNumber(value) {
  if (value == null) return null
  const cleaned = String(value).replace(/,/g, '')
  const num = Number(cleaned)
  return Number.isFinite(num) ? num : null
}

// OP.GG renders Mayhem data client-side via embedded JSON. Extract only the
// fields actually present; never invent stats for fields the page omits.
export function parseOpggMayhemPage(html, ctx = {}) {
  const text = String(html ?? '')
  const patch = text.match(/"?version"?\s*[:=]\s*"?(\d+\.\d+)"?/i)?.[1]
    ?? text.match(/Patch\s+(\d+\.\d+)/i)?.[1]
    ?? null
  const winRate = parseNumber(text.match(/"win_?rate"\s*:\s*"?([\d.]+)"?/i)?.[1])
  const pickRate = parseNumber(text.match(/"pick_?rate"\s*:\s*"?([\d.]+)"?/i)?.[1])
  const games = parseNumber(
    text.match(/"(?:games|play|sample_?size|count)"\s*:\s*"?([\d,]+)"?/i)?.[1],
  )
  return {
    championId: ctx.championId ?? null,
    sourceUrl: ctx.sourceUrl ?? null,
    patch,
    games,
    winRate,
    pickRate,
    augmentNames: [],
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
      sourceId: 'opgg-mayhem',
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
      pickRate: parsed.pickRate,
      sourceConfidence: 0.8,
      evidenceType: 'aggregate',
    })
  }
  return records
}

async function writeUnavailable(jsonOutput, { reason, sourceUrl, checkedAt }) {
  await writeJson(jsonOutput, { status: 'unavailable', reason, sourceUrl, checkedAt })
  console.log(`opgg unavailable: ${reason} (${sourceUrl})`)
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

  const parsed = parseOpggMayhemPage(html, { championId: null, sourceUrl })
  const collectedAt = checkedAt
  const records = buildRecords(parsed, augmentIndex, { sourceUrl, collectedAt, patch })
  if (records.length === 0) {
    await writeUnavailable(jsonOutput, {
      reason: 'page reachable but no usable Mayhem augment records exposed (client-rendered or structure changed)',
      sourceUrl,
      checkedAt,
    })
    return
  }

  await writeJson(jsonOutput, {
    meta: {
      sourceId: 'opgg-mayhem',
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const patch = argValue('--patch', '26.12')
  const jsonOutput = resolve(argValue('--out', `data/mayhem/${patch}/opgg.json`))
  await runLiveImport(patch, jsonOutput)
}
