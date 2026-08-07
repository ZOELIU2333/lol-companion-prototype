import type { EvidenceRecord } from './types'

export type ArenaEvidenceContext = {
  patch: string
  championKey?: string
  augmentApiNames: string[]
  itemIds: number[]
}

export type ArenaEvidenceProvider = {
  id: string
  timeoutMs?: number
  read: (context: ArenaEvidenceContext, signal: AbortSignal) => Promise<EvidenceRecord[]>
}

export type ArenaEvidenceProviderHealth = {
  id: string
  status: 'healthy' | 'rejected' | 'failed' | 'timeout'
  accepted: number
  detail?: string
}

export type ArenaEvidenceSnapshot = {
  records: EvidenceRecord[]
  health: ArenaEvidenceProviderHealth[]
  collectedAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim())
}

function validDate(value: unknown): value is string {
  return nonEmptyString(value) && Number.isFinite(Date.parse(value))
}

function validHttpUrl(value: unknown): value is string {
  if (!nonEmptyString(value)) return false
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

function patchLine(patch: string) {
  return patch.split('.').slice(0, 2).join('.')
}

function isFreshCollection(collectedAt: string, now: Date) {
  const age = now.getTime() - Date.parse(collectedAt)
  return age >= -24 * 60 * 60 * 1000 && age <= 30 * 24 * 60 * 60 * 1000
}

function validateEvidence(value: unknown, context: ArenaEvidenceContext, now: Date): EvidenceRecord | null {
  if (!isRecord(value) || !nonEmptyString(value.kind) || !nonEmptyString(value.claim)) return null
  if (value.kind === 'current-statistics') {
    if (!nonEmptyString(value.patch) || patchLine(value.patch) !== patchLine(context.patch)) return null
    if (typeof value.sampleSize !== 'number' || !Number.isInteger(value.sampleSize) || value.sampleSize <= 0) return null
    if (!validDate(value.collectedAt) || !isFreshCollection(value.collectedAt, now)) return null
    if (!nonEmptyString(value.metric) || typeof value.value !== 'number' || !Number.isFinite(value.value)) return null
    if (!validHttpUrl(value.sourceUrl)) return null
    return value as CurrentStatisticsCandidate
  }
  if (value.kind === 'community-sample') {
    if (!validDate(value.collectedAt) || !validHttpUrl(value.sourceUrl)) return null
    return value as CommunitySampleCandidate
  }
  if (value.kind === 'mechanism-verified') {
    if (!validDate(value.reviewedAt)) return null
    if (value.sourceUrl !== undefined && !validHttpUrl(value.sourceUrl)) return null
    return value as MechanismCandidate
  }
  if (value.kind === 'theoretical') return value as EvidenceRecord
  return null
}

type CurrentStatisticsCandidate = Extract<EvidenceRecord, { kind: 'current-statistics' }>
type CommunitySampleCandidate = Extract<EvidenceRecord, { kind: 'community-sample' }>
type MechanismCandidate = Extract<EvidenceRecord, { kind: 'mechanism-verified' }>

class ProviderTimeoutError extends Error {}

async function readProvider(
  provider: ArenaEvidenceProvider,
  context: ArenaEvidenceContext,
  now: Date,
): Promise<{ records: EvidenceRecord[]; health: ArenaEvidenceProviderHealth }> {
  const controller = new AbortController()
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined
  try {
    const records = await Promise.race([
      provider.read(context, controller.signal),
      new Promise<never>((_, reject) => {
        timeoutId = globalThis.setTimeout(() => {
          controller.abort()
          reject(new ProviderTimeoutError(`Provider ${provider.id} timed out`))
        }, provider.timeoutMs ?? 3_000)
      }),
    ])
    const accepted = Array.isArray(records)
      ? records.map((record) => validateEvidence(record, context, now)).filter((record): record is EvidenceRecord => record !== null)
      : []
    return {
      records: accepted,
      health: {
        id: provider.id,
        status: accepted.length > 0 || records.length === 0 ? 'healthy' : 'rejected',
        accepted: accepted.length,
        detail: accepted.length === records.length ? undefined : `${records.length - accepted.length} 条证据未通过校验`,
      },
    }
  } catch (error) {
    const timedOut = error instanceof ProviderTimeoutError
    return {
      records: [],
      health: {
        id: provider.id,
        status: timedOut ? 'timeout' : 'failed',
        accepted: 0,
        detail: error instanceof Error ? error.message : String(error),
      },
    }
  } finally {
    if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId)
  }
}

function evidenceIdentity(record: EvidenceRecord) {
  return JSON.stringify(record)
}

export async function collectArenaEvidence(
  providers: ArenaEvidenceProvider[],
  context: ArenaEvidenceContext,
  now = new Date(),
): Promise<ArenaEvidenceSnapshot> {
  const results = await Promise.all(providers.map((provider) => readProvider(provider, context, now)))
  const unique = new Map<string, EvidenceRecord>()
  for (const result of results) {
    for (const record of result.records) unique.set(evidenceIdentity(record), record)
  }
  return {
    records: [...unique.values()],
    health: results.map((result) => result.health),
    collectedAt: now.toISOString(),
  }
}
