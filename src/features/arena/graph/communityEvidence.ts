import type { ArenaEvidenceContext, ArenaEvidenceProvider } from './evidenceProvider'
import type { EdgeRelation } from './types'

export type ReviewedCommunityEvidenceEntry = {
  championKey?: string
  augmentApiNames: string[]
  itemIds: number[]
  sourceUrl: string
  collectedAt: string
  claim: string
  reviewedEdges: {
    from: string
    to: string
    relation: EdgeRelation
  }[]
}

// Deliberately empty until a reviewer records a reproducible public sample.
// Canonical definitions and local mechanism overrides remain available without it.
export const reviewedCommunityEvidence: ReviewedCommunityEvidenceEntry[] = []

function matches(entry: ReviewedCommunityEvidenceEntry, context: ArenaEvidenceContext) {
  if (entry.championKey && entry.championKey !== context.championKey) return false
  if (entry.augmentApiNames.some((name) => !context.augmentApiNames.includes(name))) return false
  return entry.itemIds.every((id) => context.itemIds.includes(id))
}

export const communityEvidenceProvider: ArenaEvidenceProvider = {
  id: 'reviewed-community-evidence',
  async read(context) {
    return reviewedCommunityEvidence.filter((entry) => matches(entry, context)).map((entry) => ({
      kind: 'community-sample' as const,
      claim: entry.claim,
      collectedAt: entry.collectedAt,
      sourceUrl: entry.sourceUrl,
    }))
  },
}
