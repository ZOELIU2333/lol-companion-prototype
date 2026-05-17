import type { PlayerIntel, PlayerRecentMatch, PlayerRiotAccount } from '../types'
import { mapRecentMatchesToPlayerRows } from './playerData'
import { createRiotApiAdapter, type RiotAccountRef, type RiotApiHost, type RiotPlayerProfile } from './riotApiAdapter'

type RiotAccountOverrideMap = Record<string, PlayerRiotAccount>
const cachePrefix = 'lol-companion:riot-player:'
const cacheTtlMs = 1000 * 60 * 30

type CacheEnvelope<T> = {
  expiresAt: number
  value: T
}

function normalizeAccountKey(account: PlayerRiotAccount) {
  return `${account.platform ?? account.region}:${account.gameName}:${account.tagLine ?? account.puuid ?? ''}`.toLowerCase()
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

export function parseRiotAccountOverrides(raw?: string): RiotAccountOverrideMap {
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

    return Object.fromEntries(
      Object.entries(parsed as Record<string, Partial<PlayerRiotAccount>>)
        .filter(([, account]) => Boolean(account.gameName && account.region && (account.puuid || account.tagLine)))
        .map(([key, account]) => [
          key,
          {
            gameName: account.gameName as string,
            puuid: account.puuid,
            region: account.region as PlayerRiotAccount['region'],
            platform: account.platform as PlayerRiotAccount['platform'],
            tagLine: account.tagLine,
          },
        ]),
    )
  } catch {
    return {}
  }
}

export function getRiotAccountForPlayer(
  player: PlayerIntel,
  overrides = parseRiotAccountOverrides(import.meta.env.VITE_RIOT_ACCOUNT_OVERRIDES),
): PlayerRiotAccount | null {
  return player.riotAccount ?? overrides[player.id] ?? overrides[player.name] ?? null
}

export async function loadRiotRecentMatches(
  host: RiotApiHost | null,
  account: PlayerRiotAccount | null,
  count = 10,
): Promise<PlayerRecentMatch[]> {
  if (!account) return []
  const cacheKey = `history:${normalizeAccountKey(account)}:${count}`
  const cached = readCache<PlayerRecentMatch[]>(cacheKey)
  if (cached) return cached
  if (!host) return []

  const adapter = createRiotApiAdapter(host)
  const matches = await adapter.getRecentMatches(account as RiotAccountRef, count)
  const rows = mapRecentMatchesToPlayerRows(matches)
  if (rows.length > 0) writeCache(cacheKey, rows)
  return rows
}

export async function loadRiotPlayerProfile(
  host: RiotApiHost | null,
  account: PlayerRiotAccount | null,
): Promise<RiotPlayerProfile | null> {
  if (!account) return null
  const cacheKey = `profile:${normalizeAccountKey(account)}`
  const cached = readCache<RiotPlayerProfile>(cacheKey)
  if (cached) return cached
  if (!host) return null

  const adapter = createRiotApiAdapter(host)
  const profile = await adapter.getPlayerProfile(account as RiotAccountRef, 20)
  if (profile) writeCache(cacheKey, profile)
  return profile
}
