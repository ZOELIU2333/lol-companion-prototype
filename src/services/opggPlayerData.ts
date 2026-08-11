import type { PlayerIntel, PlayerMatchDetail, PlayerRecentMatch, PlayerRiotAccount } from '../types'
import { createOpggMcpAdapter, type OpggMcpHost, type OpggMcpPlayerProfile, type OpggMcpRiotAccount } from './opggMcpAdapter'

const cachePrefix = 'lol-companion:opgg-player:'
const cacheTtlMs = 1000 * 60 * 30

type CacheEnvelope<T> = {
  expiresAt: number
  value: T
}

const platformToOpggRegion: Record<string, string> = {
  br1: 'BR',
  eun1: 'EUNE',
  euw1: 'EUW',
  jp1: 'JP',
  kr: 'KR',
  la1: 'LAN',
  la2: 'LAS',
  na1: 'NA',
  oc1: 'OCE',
  ru: 'RU',
  sg2: 'SG',
  tr1: 'TR',
  tw2: 'TW',
  vn2: 'VN',
}

function regionFromTagLine(tagLine?: string) {
  if (!tagLine) return null
  const normalized = tagLine.toUpperCase()
  if (normalized === 'KR1') return 'KR'
  if (normalized === 'NA1') return 'NA'
  if (normalized === 'EUW') return 'EUW'
  return normalized.replace(/\d+$/, '')
}

function normalizeAccountKey(account: OpggMcpRiotAccount) {
  return `${account.region}:${account.gameName}:${account.tagLine}`.toLowerCase()
}

function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined' || !window.localStorage) return null

  try {
    const raw = window.localStorage.getItem(`${cachePrefix}${key}`)
    if (!raw) return null

    const envelope = JSON.parse(raw) as CacheEnvelope<T>
    if (!envelope || envelope.expiresAt < Date.now()) {
      window.localStorage.removeItem(`${cachePrefix}${key}`)
      return null
    }

    return envelope.value
  } catch {
    return null
  }
}

function writeCache<T>(key: string, value: T) {
  if (typeof window === 'undefined' || !window.localStorage) return

  try {
    const envelope: CacheEnvelope<T> = {
      expiresAt: Date.now() + cacheTtlMs,
      value,
    }
    window.localStorage.setItem(`${cachePrefix}${key}`, JSON.stringify(envelope))
  } catch {
    // Best-effort cache only. Real API reads and demo fallback remain available.
  }
}

export function getOpggAccountForPlayer(player: PlayerIntel): OpggMcpRiotAccount | null {
  return getOpggAccount(player.riotAccount ?? null)
}

export function getOpggAccount(account: PlayerRiotAccount | null): OpggMcpRiotAccount | null {
  if (!account?.gameName || !account.tagLine) return null

  return {
    gameName: account.gameName,
    region: (account.platform && platformToOpggRegion[account.platform]) || regionFromTagLine(account.tagLine) || 'KR',
    tagLine: account.tagLine,
  }
}

export async function loadOpggPlayerProfileForAccount(
  host: OpggMcpHost | null,
  riotAccount: PlayerRiotAccount | null,
): Promise<OpggMcpPlayerProfile | null> {
  const account = getOpggAccount(riotAccount)
  if (!account) return null
  const cacheKey = `profile:${normalizeAccountKey(account)}`
  const cached = readCache<OpggMcpPlayerProfile>(cacheKey)
  if (cached) return cached
  if (!host) return null

  const profile = await createOpggMcpAdapter(host).getPlayerProfile(account)
  if (profile) writeCache(cacheKey, profile)
  return profile
}

export async function loadOpggRecentMatchesForAccount(
  host: OpggMcpHost | null,
  riotAccount: PlayerRiotAccount | null,
  limit = 10,
): Promise<PlayerRecentMatch[]> {
  const account = getOpggAccount(riotAccount)
  if (!account) return []
  const cacheKey = `history:${normalizeAccountKey(account)}:${limit}`
  const cached = readCache<PlayerRecentMatch[]>(cacheKey)
  if (cached) return cached
  if (!host) return []

  const history = await createOpggMcpAdapter(host).getRecentMatches(account, limit)
  if (history.length > 0) writeCache(cacheKey, history)
  return history
}

export async function loadOpggPlayerProfile(host: OpggMcpHost | null, player: PlayerIntel): Promise<OpggMcpPlayerProfile | null> {
  return loadOpggPlayerProfileForAccount(host, player.riotAccount ?? null)
}

export async function loadOpggRecentMatches(host: OpggMcpHost | null, player: PlayerIntel, limit = 10): Promise<PlayerRecentMatch[]> {
  return loadOpggRecentMatchesForAccount(host, player.riotAccount ?? null, limit)
}

export async function loadOpggMatchDetail(
  host: OpggMcpHost | null,
  player: PlayerIntel,
  match: PlayerRecentMatch,
): Promise<PlayerMatchDetail | null> {
  const account = getOpggAccountForPlayer(player)
  if (!account) return null
  const cacheKey = `match:${normalizeAccountKey(account)}:${match.id}`
  const cached = readCache<PlayerMatchDetail>(cacheKey)
  if (cached) return cached
  if (!host) return null

  const detail = await createOpggMcpAdapter(host).getMatchDetail(account, match)
  if (detail) writeCache(cacheKey, detail)
  return detail
}
