import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const endpoint = 'https://mcp-api.op.gg/mcp'
const championsInput = 'data/opgg/kr-diamond-plus-current-prototype.json'
const defaultJsonOutput = 'data/opgg/kr-diamond-plus-current-details.json'
const defaultTsOutput = 'src/data/opggKrHighEloDetails.ts'
const fields = [
  'champion',
  'position',
  'data.summary.average_stats.{ban_rate,kda,pick_rate,play,rank,tier,win_rate}',
  'data.summary.average_stats.tier_data.{rank,rank_prev,rank_prev_patch,tier}',
  'data.core_items.{ids[],ids_names[],pick_rate,play,win}',
  'data.boots.{ids[],ids_names[],pick_rate,play,win}',
  'data.fourth_items[].{ids[],ids_names[],pick_rate,play,win}',
  'data.fifth_items[].{ids[],ids_names[],pick_rate,play,win}',
  'data.runes.{id,pick_rate,play,primary_page_id,primary_page_name,primary_rune_ids[],primary_rune_names[],secondary_page_id,secondary_page_name,secondary_rune_ids[],secondary_rune_names[],stat_mod_ids[],stat_mod_names[],win}',
  'data.strong_counters[].{champion_id,champion_name,play,win,win_rate}',
  'data.weak_counters[].{champion_id,champion_name,play,win,win_rate}',
  'data.summoner_spells.{ids[],ids_names[],pick_rate,play,win}',
]

const championNameMap = {
  ahri: 'AHRI',
  camille: 'CAMILLE',
  draven: 'DRAVEN',
  ezreal: 'EZREAL',
  kaisa: 'KAISA',
  leesin: 'LEE_SIN',
  mordekaiser: 'MORDEKAISER',
  nautilus: 'NAUTILUS',
  syndra: 'SYNDRA',
  thresh: 'THRESH',
}

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

function CoreItems(ids, idsNames, pickRate, play, win) {
  return {
    ids,
    idsNames,
    pickRate,
    play,
    win,
    winRate: play ? Number((win / play * 100).toFixed(2)) : 0,
  }
}

function Runes(
  id,
  pickRate,
  play,
  primaryPageId,
  primaryPageName,
  primaryRuneIds,
  primaryRuneNames,
  secondaryPageId,
  secondaryPageName,
  secondaryRuneIds,
  secondaryRuneNames,
  statModIds,
  statModNames,
  win,
) {
  return {
    id,
    pickRate,
    play,
    primaryPageId,
    primaryPageName,
    primaryRuneIds,
    primaryRuneNames,
    secondaryPageId,
    secondaryPageName,
    secondaryRuneIds,
    secondaryRuneNames,
    statModIds,
    statModNames,
    win,
    winRate: play ? Number((win / play * 100).toFixed(2)) : 0,
  }
}

function StrongCounter(championId, championName, play, win, winRate) {
  return {
    championId,
    championName,
    play,
    win,
    winRate: Number((winRate * 100).toFixed(2)),
  }
}

function parseAnalysisText(text) {
  const expression = text.match(/LolGetChampionAnalysis\(.+$/s)?.[0]
  if (!expression) throw new Error('OP.GG response did not include LolGetChampionAnalysis payload')

  const parse = new Function(
    'LolGetChampionAnalysis',
    'Data',
    'Summary',
    'AverageStats',
    'TierData',
    'CoreItems',
    'Runes',
    'StrongCounter',
    `return ${expression}`,
  )

  return parse(
    (champion, position, data) => ({ champion, position, data }),
    (summary, coreItems, boots, fourthItems, fifthItems, runes, strongCounters, weakCounters, summonerSpells) => ({
      summary,
      coreItems,
      boots,
      fourthItems,
      fifthItems,
      runes,
      strongCounters,
      weakCounters,
      summonerSpells,
    }),
    (averageStats) => ({ averageStats }),
    (banRate, kda, pickRate, play, rank, tier, winRate, tierData) => ({
      banRate: Number((banRate * 100).toFixed(2)),
      kda,
      pickRate: Number((pickRate * 100).toFixed(2)),
      play,
      rank,
      tier,
      winRate: Number((winRate * 100).toFixed(2)),
      tierData,
    }),
    (rank, rankPrev, rankPrevPatch, tier) => ({ rank, rankPrev, rankPrevPatch, tier }),
    CoreItems,
    Runes,
    StrongCounter,
  )
}

async function callChampionAnalysis(row) {
  const champion = championNameMap[row.championKey] ?? row.championKey.toUpperCase()
  const payload = {
    jsonrpc: '2.0',
    id: `${row.championKey}-${row.position}`,
    method: 'tools/call',
    params: {
      name: 'lol_get_champion_analysis',
      arguments: {
        game_mode: 'ranked',
        champion,
        position: row.position,
        lang: 'zh_CN',
        desired_output_fields: fields,
      },
    },
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) throw new Error(`OP.GG MCP HTTP ${response.status} for ${row.championKey}`)
  const json = await response.json()
  if (json.error) throw new Error(`OP.GG MCP error for ${row.championKey}: ${json.error.message}`)

  const text = json.result?.content?.find((part) => part.type === 'text')?.text
  if (!text) throw new Error(`OP.GG MCP returned no text content for ${row.championKey}`)

  return {
    championKey: row.championKey,
    championName: row.championName,
    href: row.href,
    rawText: text,
    ...parseAnalysisText(text),
    position: row.position,
  }
}

function renderValue(value, indent = 0) {
  if (Array.isArray(value)) {
    if (!value.length) return '[]'
    const pad = ' '.repeat(indent)
    const childPad = ' '.repeat(indent + 2)
    return `[\n${value.map((item) => `${childPad}${renderValue(item, indent + 2)}`).join(',\n')},\n${pad}]`
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
    if (!entries.length) return '{}'
    const pad = ' '.repeat(indent)
    const childPad = ' '.repeat(indent + 2)
    return `{\n${entries.map(([key, item]) => `${childPad}${key}: ${renderValue(item, indent + 2)}`).join(',\n')},\n${pad}}`
  }

  if (typeof value === 'string') return quote(value)
  return String(value)
}

function renderTs(payload) {
  return `export type OpggItemSet = {
  ids: number[]
  idsNames: Array<string | number>
  pickRate: number
  play: number
  win: number
  winRate: number
}

export type OpggRuneSet = {
  id: number
  pickRate: number
  play: number
  primaryPageId: number
  primaryPageName: string
  primaryRuneIds: number[]
  primaryRuneNames: string[]
  secondaryPageId: number
  secondaryPageName: string
  secondaryRuneIds: number[]
  secondaryRuneNames: string[]
  statModIds: number[]
  statModNames: number[]
  win: number
  winRate: number
}

export type OpggCounterDetail = {
  championId: number
  championName: string
  play: number
  win: number
  winRate: number
}

export type OpggChampionDetail = {
  champion: string
  championKey: string
  championName: string
  data: {
    boots: OpggItemSet
    coreItems: OpggItemSet
    fifthItems: OpggItemSet[]
    fourthItems: OpggItemSet[]
    runes: OpggRuneSet
    strongCounters: OpggCounterDetail[]
    summonerSpells: OpggItemSet
    summary: {
      averageStats: {
        banRate: number
        kda: number
        pickRate: number
        play: number
        rank: number
        tier: number
        tierData: {
          rank: number
          rankPrev: number
          rankPrevPatch: number
          tier: number
        }
        winRate: number
      }
    }
    weakCounters: OpggCounterDetail[]
  }
  href: string
  position: 'top' | 'jungle' | 'mid' | 'adc' | 'support'
}

export const opggKrHighEloChampionDetails: OpggChampionDetail[] = ${renderValue(payload.rows.map(({ rawText: _rawText, ...row }) => ({
    ...row,
    position: row.position.toLowerCase(),
  })))} as OpggChampionDetail[]

export function getOpggKrHighEloChampionDetail(championKey: string) {
  return opggKrHighEloChampionDetails.find((detail) => detail.championKey === championKey)
}
`
}

const inputPath = resolve(argValue('--input', championsInput))
const jsonOutputPath = resolve(argValue('--json-out', defaultJsonOutput))
const tsOutputPath = resolve(argValue('--ts-out', defaultTsOutput))
const seed = JSON.parse(await readFile(inputPath, 'utf8'))
const patch = argValue('--patch', seed.meta.patch)

let payload
if (process.argv.includes('--from-cache')) {
  payload = JSON.parse(await readFile(jsonOutputPath, 'utf8'))
} else {
  const rows = []
  for (const row of seed.rows) {
    console.log(`Fetching OP.GG MCP detail for ${row.championKey}/${row.position}`)
    rows.push(await callChampionAnalysis(row))
  }
  payload = {
    meta: {
      ...seed.meta,
      patch,
      detailSource: 'OP.GG MCP lol_get_champion_analysis',
      endpoint,
      importedAt: new Date().toISOString(),
    },
    rows,
  }
}

const tsOutput = renderTs(payload)

if (process.argv.includes('--check')) {
  const current = await readFile(tsOutputPath, 'utf8')
  if (current !== tsOutput) {
    throw new Error(`${tsOutputPath} is out of date. Run npm run data:opgg:details:import.`)
  }
} else {
  await writeFile(jsonOutputPath, `${JSON.stringify(payload, null, 2)}\n`)
  await writeFile(tsOutputPath, tsOutput)
}

console.log(`${process.argv.includes('--check') ? 'Checked' : 'Generated'} OP.GG champion details (${payload.rows.length} rows)`)
