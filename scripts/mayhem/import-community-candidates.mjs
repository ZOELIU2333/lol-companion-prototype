import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { argValue, fetchText, writeJson, cleanText } from './shared.mjs'

const sourceUrls = [
  'https://aramgg.com/zh-CN',
  'https://arammayhem.com/',
  'https://arammayhem.com/zh-cn/tier-list/',
]

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

// Community sources only ever yield CANDIDATES. They never carry trustworthy
// sample sizes, so every statistical field is forced to null here regardless of
// what the raw object contains. Likes / views / site scores must never leak into
// games / wins / winRate / pickRate.
export function normalizeCommunityCandidate(raw = {}, patch = '26.12') {
  const augmentNames = Array.isArray(raw.augmentNames)
    ? raw.augmentNames.map((name) => cleanText(name)).filter(Boolean)
    : []
  const augmentName = raw.augmentName != null ? cleanText(raw.augmentName) : null
  return {
    sourceId: raw.sourceId ?? 'community-candidate',
    sourceUrl: raw.sourceUrl ?? null,
    patch,
    queue: 'aram-mayhem',
    population: 'all-ranks',
    championName: raw.championName != null ? cleanText(raw.championName) : null,
    augmentName,
    augmentNames,
    candidateAugmentId: raw.candidateAugmentId ?? null,
    selectedAugmentIds: Array.isArray(raw.selectedAugmentIds) ? raw.selectedAugmentIds : [],
    itemIds: Array.isArray(raw.itemIds) ? raw.itemIds : [],
    title: raw.title != null ? cleanText(raw.title) : null,
    rarity: raw.rarity != null ? cleanText(raw.rarity) : null,
    availability: raw.availability != null ? cleanText(raw.availability) : null,
    publishedAt: raw.publishedAt ?? null,
    games: null,
    wins: null,
    winRate: null,
    pickRate: null,
    sourceConfidence: 0.3,
    evidenceType: 'community-candidate',
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
  if (!index) return null
  return index.get(String(name ?? '').trim().toLowerCase()) ?? null
}

function absoluteLink(href, base) {
  if (!href) return null
  if (!base || !/^\//.test(href)) return href
  try {
    return new URL(href, base).toString()
  } catch {
    return href
  }
}

// arammayhem augment rows carry a bilingual `data-name="中文 english"` plus
// rarity/availability/rank metadata. We keep the English tail as the augment
// name (mappable to official ids) and never read rank into a statistical field.
function parseAugmentRows(text, ctx) {
  const rows = []
  const rowRe = /<[^>]*\bdata-name="([^"]+)"([^>]*)>/gi
  let match
  while ((match = rowRe.exec(text)) != null) {
    const fullName = cleanText(match[1])
    const attrs = match[2] ?? ''
    if (!fullName) continue
    const english = (fullName.match(/[A-Za-z][A-Za-z'’:\- ]+$/)?.[0] ?? '').trim()
    const augmentName = english || fullName
    const rarity = attrs.match(/data-rarity="([^"]*)"/i)?.[1] ?? null
    const availability = attrs.match(/data-availability="([^"]*)"/i)?.[1] ?? null
    rows.push({
      sourceId: ctx.sourceId ?? 'community-candidate',
      sourceUrl: ctx.sourceUrl ?? null,
      augmentName,
      title: fullName,
      rarity,
      availability,
    })
  }
  return rows
}

// aramgg / arammayhem champion tier lists expose `champion-card` anchors whose
// `data-search` holds the localized + canonical champion names and whose `title`
// carries community rank/winrate text. We keep the champion name and a build link
// only — the title's rank/winrate is intentionally dropped (community-candidate
// rule forbids letting it become statistical evidence).
function parseChampionCards(text, ctx) {
  const cards = []
  const cardRe = /<a\b([^>]*\bclass="[^"]*champion-card[^"]*"[^>]*)>/gi
  let match
  while ((match = cardRe.exec(text)) != null) {
    const attrs = match[1] ?? ''
    const href = attrs.match(/href="([^"]*)"/i)?.[1] ?? null
    const search = attrs.match(/data-search="([^"]*)"/i)?.[1] ?? ''
    const championName = cleanText(search.split(/\s+/)[0] ?? '')
    if (!championName) continue
    cards.push({
      sourceId: ctx.sourceId ?? 'community-candidate',
      sourceUrl: absoluteLink(href, ctx.sourceUrl) ?? ctx.sourceUrl ?? null,
      championName,
      title: championName,
    })
  }
  return cards
}

// Extract structured candidate entries from a community page. Two real shapes are
// supported: augment rows (off-meta augment pool) and champion tier cards. We keep
// only entries that carry a real champion or augment name and never fabricate
// metrics. Unmapped augment names are still admitted (they are candidates, not
// scored records).
export function parseCommunityCandidates(html, ctx = {}) {
  const text = String(html ?? '')
  const augments = parseAugmentRows(text, ctx)
  const champions = parseChampionCards(text, ctx)
  const merged = [...augments, ...champions]
  const seen = new Set()
  const candidates = []
  for (const item of merged) {
    const key = `${item.augmentName ?? ''}|${item.championName ?? ''}`.toLowerCase()
    if (key === '|') continue
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push(item)
  }
  return candidates
}

function sourceIdFor(url) {
  if (url.includes('aramgg.com')) return 'aramgg'
  if (url.includes('arammayhem.com')) return 'arammayhem'
  return 'community-candidate'
}

async function collectFromSource(url, augmentIndex, patch) {
  const health = { sourceUrl: url, status: 'ok', reason: null }
  let html
  try {
    html = await fetchText(url)
  } catch (error) {
    health.status = 'error'
    health.reason = `fetch failed: ${error.message}`
    return { health, candidates: [] }
  }
  if (isCloudflareChallenge(html)) {
    health.status = 'blocked'
    health.reason = 'Cloudflare challenge returned instead of page content'
    return { health, candidates: [] }
  }
  const sourceId = sourceIdFor(url)
  const raw = parseCommunityCandidates(html, { sourceId, sourceUrl: url })
  if (raw.length === 0) {
    health.status = 'empty'
    health.reason = 'page reachable but no candidate combos parsed (client-rendered or structure changed)'
    return { health, candidates: [] }
  }
  const candidates = raw.map((item) => {
    const candidate = normalizeCommunityCandidate(item, patch)
    const mapped = resolveAugmentId(candidate.augmentName, augmentIndex)
    if (mapped != null) candidate.candidateAugmentId = mapped
    return candidate
  })
  return { health, candidates }
}

async function runLiveImport(patch, jsonOutput) {
  const checkedAt = new Date().toISOString()

  let augmentIndex = null
  try {
    augmentIndex = await loadAugmentNameIndex(patch)
  } catch {
    // Augment index is best-effort: candidates remain valid without id mapping.
    augmentIndex = null
  }

  const sources = []
  const candidates = []
  for (const url of sourceUrls) {
    const { health, candidates: found } = await collectFromSource(url, augmentIndex, patch)
    sources.push(health)
    candidates.push(...found)
  }

  const anyOk = sources.some((source) => source.status === 'ok')
  if (!anyOk || candidates.length === 0) {
    await writeJson(jsonOutput, {
      status: 'unavailable',
      reason: 'all community candidate sources failed, were blocked, or exposed no parseable combos',
      sources,
      checkedAt,
    })
    console.log(`community candidates unavailable: no usable source (${sources.map((source) => `${source.sourceUrl}=${source.status}`).join(', ')})`)
    return
  }

  await writeJson(jsonOutput, {
    meta: {
      patch,
      queue: 'aram-mayhem',
      collectedAt: checkedAt,
      sources: sources.map(({ sourceUrl, status }) => ({ sourceUrl, status })),
      count: candidates.length,
    },
    candidates,
  })
  console.log(`Wrote ${jsonOutput} (${candidates.length} candidates from ${sources.filter((source) => source.status === 'ok').length}/${sources.length} sources)`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const patch = argValue('--patch', '26.12')
  const jsonOutput = resolve(argValue('--out', `data/mayhem/${patch}/community-candidates.json`))
  await runLiveImport(patch, jsonOutput)
}
