import { parseArenaCatalog, verifyArenaCatalogManifest } from './catalog'
import type { ArenaCatalog, ArenaCatalogManifest } from './types'

export type ArenaCatalogCandidate = {
  catalog: unknown
  manifest: unknown
}

export type ArenaCatalogSnapshot = {
  source: 'bundled-cache' | 'runtime-cache'
  freshness: 'fresh' | 'aging' | 'stale'
  catalog: ArenaCatalog
  manifest: ArenaCatalogManifest
}

export type ArenaCatalogRefreshResult = {
  updated: boolean
  snapshot: ArenaCatalogSnapshot
  reason?: 'unavailable' | 'timeout' | 'invalid' | 'not-newer'
}

export type ArenaCatalogRuntimeCache = {
  read: () => Promise<ArenaCatalogCandidate | null>
  promote?: (candidate: ArenaCatalogCandidate) => Promise<void>
}

export type ArenaCatalogRepositoryOptions = {
  bundled: ArenaCatalogCandidate
  runtime?: ArenaCatalogRuntimeCache
  refreshSource?: () => Promise<ArenaCatalogCandidate>
  refreshTimeoutMs?: number
  now?: () => Date
}

export type ArenaCatalogRepository = {
  load: () => Promise<ArenaCatalogSnapshot>
  refresh: () => Promise<ArenaCatalogRefreshResult>
}

const DAY_MS = 24 * 60 * 60 * 1000

function generatedTime(catalog: ArenaCatalog) {
  const timestamp = Date.parse(catalog.generatedAt)
  if (!Number.isFinite(timestamp)) throw new Error('Arena catalog generatedAt must be a valid timestamp')
  return timestamp
}

function freshnessOf(catalog: ArenaCatalog, now: Date): ArenaCatalogSnapshot['freshness'] {
  const ageDays = Math.max(0, (now.getTime() - generatedTime(catalog)) / DAY_MS)
  if (ageDays <= 3) return 'fresh'
  if (ageDays <= 14) return 'aging'
  return 'stale'
}

async function validateCandidate(
  candidate: ArenaCatalogCandidate,
  source: ArenaCatalogSnapshot['source'],
  now: Date,
): Promise<ArenaCatalogSnapshot> {
  const catalog = parseArenaCatalog(candidate.catalog)
  const manifest = await verifyArenaCatalogManifest(catalog, candidate.manifest)
  generatedTime(catalog)
  return { source, freshness: freshnessOf(catalog, now), catalog, manifest }
}

function newerOrEqual(candidate: ArenaCatalogSnapshot, baseline: ArenaCatalogSnapshot) {
  return generatedTime(candidate.catalog) >= generatedTime(baseline.catalog)
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number) {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = globalThis.setTimeout(() => reject(new Error('Arena catalog refresh timed out')), milliseconds)
      }),
    ])
  } finally {
    if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId)
  }
}

export function createArenaCatalogRepository(options: ArenaCatalogRepositoryOptions): ArenaCatalogRepository {
  const now = options.now ?? (() => new Date())
  const refreshTimeoutMs = options.refreshTimeoutMs ?? 10_000

  async function load() {
    const bundled = await validateCandidate(options.bundled, 'bundled-cache', now())
    if (!options.runtime) return bundled

    try {
      const candidate = await options.runtime.read()
      if (!candidate) return bundled
      const runtime = await validateCandidate(candidate, 'runtime-cache', now())
      return newerOrEqual(runtime, bundled) ? runtime : bundled
    } catch {
      return bundled
    }
  }

  async function refresh(): Promise<ArenaCatalogRefreshResult> {
    const current = await load()
    if (!options.refreshSource) return { updated: false, snapshot: current, reason: 'unavailable' }

    let candidate: ArenaCatalogCandidate
    try {
      candidate = await withTimeout(options.refreshSource(), refreshTimeoutMs)
    } catch (error) {
      const reason = error instanceof Error && error.message.includes('timed out') ? 'timeout' : 'unavailable'
      return { updated: false, snapshot: current, reason }
    }

    let downloaded: ArenaCatalogSnapshot
    try {
      downloaded = await validateCandidate(candidate, 'runtime-cache', now())
    } catch {
      return { updated: false, snapshot: current, reason: 'invalid' }
    }
    if (!newerOrEqual(downloaded, current)) {
      return { updated: false, snapshot: current, reason: 'not-newer' }
    }

    await options.runtime?.promote?.(candidate)
    return { updated: true, snapshot: downloaded }
  }

  return { load, refresh }
}
