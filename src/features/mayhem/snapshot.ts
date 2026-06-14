import type { MayhemSourceRecord } from './types'

type BuildInput = {
  patch: string
  officialAugmentIds: number[]
  records: MayhemSourceRecord[]
}

export function buildValidatedMayhemSnapshot(input: BuildInput) {
  const officialIds = new Set(input.officialAugmentIds)
  const records: MayhemSourceRecord[] = []
  const rejected: MayhemSourceRecord[] = []

  for (const record of input.records) {
    const valid =
      record.patch === input.patch &&
      record.queue === 'aram-mayhem' &&
      officialIds.has(record.candidateAugmentId)
    ;(valid ? records : rejected).push(record)
  }

  return {
    patch: input.patch,
    records,
    rejected,
    offMetaRecords: records.filter((record) => (record.games ?? 0) >= 500),
  }
}
