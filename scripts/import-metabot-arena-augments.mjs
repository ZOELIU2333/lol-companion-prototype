import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const defaultSourceUrl = 'https://metabot.gg/zh_CN/league/arena/augments-tier-list'
const defaultJsonOutput = 'data/arena/metabot-zh-cn-augments-current.json'
const defaultTsOutput = 'src/data/metabotArenaAugments.ts'

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

function decodeHtmlEntities(value) {
  return String(value)
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
}

function extractNextFlightText(html) {
  let text = ''
  for (const match of html.matchAll(/self\.__next_f\.push\((.*?)\)<\/script>/gs)) {
    try {
      const payload = JSON.parse(match[1])
      if (Array.isArray(payload)) text += String(payload[1] ?? '')
    } catch {
      // Ignore non-data chunks; enough chunks remain for the structured ItemList.
    }
  }
  return text
}

function normalizeRows(text) {
  const rowPattern =
    /"position":(\d+),"item":\{"@type":"SoftwareApplication","@id":"https:\/\/metabot\.gg\/zh_CN\/league\/arena\/augments-tier-list","name":"([^"]+)","url":"[^"]+","applicationCategory":"GameApplication","image":"([^"]+)","description":"([^"]+)"\}\}/g
  const rows = []
  const seenNames = new Set()

  for (const match of text.matchAll(rowPattern)) {
    const name = decodeHtmlEntities(match[2]).trim()
    if (!name || seenNames.has(name)) continue

    const description = decodeHtmlEntities(match[4]).trim()
    const tierMatch = description.match(/\bis a ([SABCDF])-tier\b/i)
    const pickRateMatch = description.match(/([\d.]+)% pick rate/)
    const patchMatch = description.match(/Patch (\d+(?:\.\d+)*)/)

    rows.push({
      globalRank: rows.length + 1,
      iconUrl: decodeHtmlEntities(match[3]),
      name,
      patch: patchMatch?.[1] ?? null,
      pickRate: pickRateMatch ? Number(pickRateMatch[1]) : null,
      sourceDescription: description,
      tier: tierMatch?.[1]?.toUpperCase() ?? 'unknown',
      tierRank: Number(match[1]),
    })
    seenNames.add(name)
  }

  if (!rows.length) throw new Error('No MetaBot arena augment rows found')
  return rows
}

function normalizePayload(html, sourceUrl) {
  const titlePatch = html.match(/LoL 版本 ([\d.]+)/)?.[1] ?? html.match(/Patch ([\d.]+)/)?.[1] ?? null
  const count = Number(html.match(/在 (\d+) 个强化中/)?.[1] ?? 0)
  const rows = normalizeRows(extractNextFlightText(html))
  const patch = titlePatch ?? rows.find((row) => row.patch)?.patch ?? 'unknown'

  return {
    meta: {
      collectedAt: new Date().toISOString(),
      count: count || rows.length,
      locale: 'zh_CN',
      patch,
      source: 'metabot-zh-cn',
      sourceLabel: 'MetaBot.GG 中文斗魂竞技场',
      sourceUrl,
    },
    rows: rows.map((row) => ({
      ...row,
      patch: row.patch ?? patch,
    })),
  }
}

function renderTs(payload) {
  const rows = payload.rows
    .map((row) => `  {
    globalRank: ${row.globalRank},
    iconUrl: ${quote(row.iconUrl)},
    name: ${quote(row.name)},
    patch: ${quote(row.patch)},
    pickRate: ${row.pickRate ?? 'null'},
    sourceDescription: ${quote(row.sourceDescription)},
    tier: ${quote(row.tier)},
    tierRank: ${row.tierRank},
  },`)
    .join('\n')

  const meta = payload.meta

  return `export type MetabotArenaAugmentTier = 'S' | 'A' | 'B' | 'C' | 'D' | 'F' | 'unknown'

export type MetabotArenaAugment = {
  globalRank: number
  iconUrl: string
  name: string
  patch: string
  pickRate: number | null
  sourceDescription: string
  tier: MetabotArenaAugmentTier
  tierRank: number
}

export const metabotArenaAugmentsMeta = {
  collectedAt: ${quote(meta.collectedAt)},
  count: ${meta.count},
  locale: ${quote(meta.locale)},
  patch: ${quote(meta.patch)},
  source: ${quote(meta.source)},
  sourceLabel: ${quote(meta.sourceLabel)},
  sourceUrl: ${quote(meta.sourceUrl)},
} as const

export const metabotArenaAugments: MetabotArenaAugment[] = [
${rows}
]

export function getMetabotArenaAugmentByChineseName(name: string) {
  return metabotArenaAugments.find((augment) => augment.name === name)
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
  const response = await fetch(sourceUrl, {
    headers: {
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'User-Agent': 'Mozilla/5.0',
    },
  })
  if (!response.ok) throw new Error(`MetaBot HTTP ${response.status}`)
  payload = normalizePayload(await response.text(), sourceUrl)
}

const tsOutputText = renderTs(payload)

if (check) {
  const current = await readFile(tsOutput, 'utf8')
  if (current.replaceAll('\r\n', '\n') !== tsOutputText.replaceAll('\r\n', '\n')) {
    throw new Error(`${tsOutput} is out of date. Run npm run data:arena:metabot:import.`)
  }
} else {
  await ensureParent(jsonOutput)
  await ensureParent(tsOutput)
  await writeFile(jsonOutput, `${JSON.stringify(payload, null, 2)}\n`)
  await writeFile(tsOutput, tsOutputText)
}

console.log(`${check ? 'Checked' : 'Generated'} ${tsOutput} from ${fromCache ? jsonOutput : sourceUrl} (${payload.rows.length} augments)`)
