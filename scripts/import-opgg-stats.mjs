import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const positions = new Set(['top', 'jungle', 'mid', 'adc', 'support'])
const defaultInput = 'data/opgg/kr-diamond-plus-current-prototype.json'
const defaultOutput = 'src/data/opggKrHighEloStats.ts'

function argValue(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function parseChampionFilter() {
  const raw = argValue('--champions')
  if (!raw) return null
  return new Set(raw.split(',').map((id) => id.trim()).filter(Boolean))
}

function quote(value) {
  return `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
}

function assertString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid ${label}`)
  return value.trim()
}

function assertNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid ${label}`)
  return value
}

function normalizeRow(row) {
  const position = assertString(row.position, 'row.position')
  if (!positions.has(position)) throw new Error(`Invalid position: ${position}`)

  return {
    championKey: assertString(row.championKey, 'row.championKey').toLowerCase(),
    championName: assertString(row.championName, 'row.championName'),
    counters: Array.isArray(row.counters)
      ? row.counters.map((counter) => ({
        championKey: assertString(counter.championKey, 'counter.championKey').toLowerCase(),
        championName: assertString(counter.championName, 'counter.championName'),
      }))
      : [],
    href: assertString(row.href, 'row.href'),
    pickRate: assertNumber(row.pickRate, 'row.pickRate'),
    position,
    rank: assertNumber(row.rank, 'row.rank'),
    winRate: assertNumber(row.winRate, 'row.winRate'),
  }
}

function normalizePayload(payload, championFilter) {
  if (!payload || typeof payload !== 'object') throw new Error('Input must be an object')
  if (!payload.meta || typeof payload.meta !== 'object') throw new Error('Input must include meta')
  if (!Array.isArray(payload.rows)) throw new Error('Input must include rows array')

  const rows = payload.rows
    .map(normalizeRow)
    .filter((row) => !championFilter || championFilter.has(row.championKey))
    .sort((a, b) => a.championKey.localeCompare(b.championKey))

  if (!rows.length) throw new Error('No rows remained after filtering')

  return { meta: payload.meta, rows }
}

function renderTs(payload) {
  const meta = payload.meta
  const rows = payload.rows
    .map((row) => {
      const counters = row.counters
        .map((counter) => `      { championKey: ${quote(counter.championKey)}, championName: ${quote(counter.championName)} },`)
        .join('\n')

      return `  {
    championKey: ${quote(row.championKey)},
    championName: ${quote(row.championName)},
    counters: [
${counters}
    ],
    href: ${quote(row.href)},
    pickRate: ${row.pickRate},
    position: ${quote(row.position)},
    rank: ${row.rank},
    winRate: ${row.winRate},
  },`
    })
    .join('\n')

  return `export type OpggChampionStat = {
  championKey: string
  championName: string
  counters: {
    championKey: string
    championName: string
  }[]
  href: string
  pickRate: number
  position: 'top' | 'jungle' | 'mid' | 'adc' | 'support'
  rank: number
  winRate: number
}

export const opggKrHighEloMeta = {
  patch: ${quote(meta.patch)},
  queue: ${quote(meta.queue)},
  rank: ${quote(meta.rank)},
  region: ${quote(meta.region)},
  sampleSize: ${assertNumber(meta.sampleSize, 'meta.sampleSize')},
  source: ${quote(meta.source)},
  sourceLabel: ${quote(meta.sourceLabel)},
  sourceUrl: ${quote(meta.sourceUrl)},
} as const

export const opggKrHighEloChampionStats: OpggChampionStat[] = [
${rows}
]

export function getOpggKrHighEloChampionStat(championKey: string) {
  return opggKrHighEloChampionStats.find((stat) => stat.championKey === championKey)
}
`
}

const inputPath = resolve(argValue('--input', defaultInput))
const outputPath = resolve(argValue('--out', defaultOutput))
const championFilter = parseChampionFilter()
const payload = normalizePayload(JSON.parse(await readFile(inputPath, 'utf8')), championFilter)
const output = renderTs(payload)

if (process.argv.includes('--check')) {
  const current = await readFile(outputPath, 'utf8')
  if (current !== output) {
    throw new Error(`${outputPath} is out of date. Run npm run data:opgg:import.`)
  }
} else {
  await writeFile(outputPath, output)
}

console.log(`${process.argv.includes('--check') ? 'Checked' : 'Generated'} ${outputPath} from ${inputPath} (${payload.rows.length} rows)`)
