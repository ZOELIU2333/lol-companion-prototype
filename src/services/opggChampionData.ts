import type { Champion } from '../types'
import type { OpggChampionDetail, OpggItemSet, OpggRuneSet } from '../data/opggKrHighEloDetails'
import type { OpggMcpHost } from './opggMcpAdapter'
import { isOpggChampionDetail } from './opggChampionDetailValidation'

const championNameMap: Record<string, string> = {
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

const rolePositionMap: Record<string, OpggChampionDetail['position']> = {
  上单: 'top',
  打野: 'jungle',
  中路: 'mid',
  下路: 'adc',
  辅助: 'support',
}

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

type JsonRpcResponse = {
  error?: {
    code: number
    message: string
  }
  result?: {
    content?: {
      text?: string
      type: string
    }[]
  }
}

const runtimeDetails = new Map<string, OpggChampionDetail>()
const runtimeLabels = new Map<string, string>()
const storagePrefix = 'lol-companion:opgg-champion-detail:'
const runtimeLabel = 'OP.GG 韩服钻石+ · MCP实时'
const persistedLabel = 'OP.GG 韩服钻石+ · MCP本地缓存'

function CoreItems(ids: number[], idsNames: Array<string | number>, pickRate: number, play: number, win: number): OpggItemSet {
  return {
    ids,
    idsNames,
    pickRate,
    play,
    win,
    winRate: play ? Number(((win / play) * 100).toFixed(2)) : 0,
  }
}

function Runes(
  id: number,
  pickRate: number,
  play: number,
  primaryPageId: number,
  primaryPageName: string,
  primaryRuneIds: number[],
  primaryRuneNames: string[],
  secondaryPageId: number,
  secondaryPageName: string,
  secondaryRuneIds: number[],
  secondaryRuneNames: string[],
  statModIds: number[],
  statModNames: number[],
  win: number,
): OpggRuneSet {
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
    winRate: play ? Number(((win / play) * 100).toFixed(2)) : 0,
  }
}

function StrongCounter(championId: number, championName: string, play: number, win: number, winRate: number) {
  return {
    championId,
    championName,
    play,
    win,
    winRate: Number((winRate * 100).toFixed(2)),
  }
}

function parseAnalysisText(text: string) {
  const startIndex = text.indexOf('LolGetChampionAnalysis(')
  const expression = startIndex >= 0 ? text.slice(startIndex) : ''
  if (!expression) throw new Error('OP.GG MCP response did not include LolGetChampionAnalysis')

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
  ) as (...args: unknown[]) => Pick<OpggChampionDetail, 'champion' | 'data'>

  return parse(
    (champion: string, _position: string, data: OpggChampionDetail['data']) => ({ champion, data }),
    (
      summary: OpggChampionDetail['data']['summary'],
      coreItems: OpggItemSet,
      boots: OpggItemSet,
      fourthItems: OpggItemSet[],
      fifthItems: OpggItemSet[],
      runes: OpggRuneSet,
      strongCounters: OpggChampionDetail['data']['strongCounters'],
      weakCounters: OpggChampionDetail['data']['weakCounters'],
      summonerSpells: OpggItemSet,
    ) => ({ boots, coreItems, fifthItems, fourthItems, runes, strongCounters, summonerSpells, summary, weakCounters }),
    (averageStats: OpggChampionDetail['data']['summary']['averageStats']) => ({ averageStats }),
    (banRate: number, kda: number, pickRate: number, play: number, rank: number, tier: number, winRate: number, tierData: OpggChampionDetail['data']['summary']['averageStats']['tierData']) => ({
      banRate: Number((banRate * 100).toFixed(2)),
      kda,
      pickRate: Number((pickRate * 100).toFixed(2)),
      play,
      rank,
      tier,
      tierData,
      winRate: Number((winRate * 100).toFixed(2)),
    }),
    (rank: number, rankPrev: number, rankPrevPatch: number, tier: number) => ({ rank, rankPrev, rankPrevPatch, tier }),
    CoreItems,
    Runes,
    StrongCounter,
  )
}

function normalizeChampionName(champion: Champion) {
  return championNameMap[champion.id] ?? champion.id.replace(/[^a-z0-9]/gi, '_').toUpperCase()
}

export function getOpggPositionForChampion(champion: Champion): OpggChampionDetail['position'] | null {
  return rolePositionMap[champion.role] ?? null
}

export function getRuntimeOpggChampionDetail(championKey: string) {
  const runtimeDetail = runtimeDetails.get(championKey)
  if (runtimeDetail) return runtimeDetail

  const persistedDetail = readPersistedDetail(championKey)
  if (!persistedDetail) return undefined

  runtimeDetails.set(championKey, persistedDetail)
  runtimeLabels.set(championKey, persistedLabel)
  return persistedDetail
}

export function getRuntimeOpggChampionDetailLabel(championKey: string) {
  return runtimeLabels.get(championKey)
}

export function registerRuntimeOpggChampionDetail(detail: OpggChampionDetail, label = runtimeLabel) {
  if (!isOpggChampionDetail(detail)) return false

  runtimeDetails.set(detail.championKey, detail)
  runtimeLabels.set(detail.championKey, label)
  persistDetail(detail)
  return true
}

function readPersistedDetail(championKey: string) {
  if (typeof window === 'undefined' || !window.localStorage) return null

  const key = `${storagePrefix}${championKey}`
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (isOpggChampionDetail(parsed) && parsed.championKey === championKey) return parsed
  } catch {
    // Invalid cache is removed below.
  }

  try {
    window.localStorage.removeItem(key)
  } catch {
    // Best-effort cleanup. The bundled fallback remains authoritative.
  }
  return null
}

function persistDetail(detail: OpggChampionDetail) {
  if (typeof window === 'undefined' || !window.localStorage) return

  try {
    window.localStorage.setItem(`${storagePrefix}${detail.championKey}`, JSON.stringify(detail))
  } catch {
    // Best-effort cache only. The static seed and demo fallback remain authoritative.
  }
}

export async function loadOpggChampionDetail(host: OpggMcpHost | null, champion: Champion): Promise<OpggChampionDetail | null> {
  if (!host || getRuntimeOpggChampionDetail(champion.id)) return getRuntimeOpggChampionDetail(champion.id) ?? null

  const position = getOpggPositionForChampion(champion)
  if (!position) return null

  const response = await host.fetchJson<JsonRpcResponse>('', {
    body: JSON.stringify({
      id: `champion-${champion.id}-${position}`,
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        arguments: {
          champion: normalizeChampionName(champion),
          desired_output_fields: fields,
          game_mode: 'ranked',
          lang: 'zh_CN',
          position,
        },
        name: 'lol_get_champion_analysis',
      },
    }),
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  const text = response?.result?.content?.find((part) => part.type === 'text')?.text
  if (!text || response?.error) return null

  const parsed = parseAnalysisText(text)
  const detail: OpggChampionDetail = {
    champion: parsed.champion,
    championKey: champion.id,
    championName: champion.name,
    data: parsed.data,
    href: `/zh-cn/lol/champions/${champion.id}/build/${position}?region=kr&tier=diamond_plus`,
    position,
  }

  return registerRuntimeOpggChampionDetail(detail) ? detail : null
}
