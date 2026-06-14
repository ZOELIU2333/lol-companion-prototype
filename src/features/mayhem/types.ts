export type MayhemQueue = 'aram-mayhem'
export type MayhemPopulation = 'all-ranks'
export type MayhemEvidenceType = 'official' | 'aggregate' | 'community-candidate'

export type MayhemSourceRecord = {
  sourceId: string
  sourceUrl?: string
  collectedAt?: string
  patch: string
  queue: string
  population?: MayhemPopulation
  locale?: string
  championId?: number | null
  selectedAugmentIds?: number[]
  candidateAugmentId: number
  itemIds?: number[]
  games: number | null
  wins?: number | null
  winRate?: number | null
  pickRate?: number | null
  sourceConfidence?: number
  evidenceType?: MayhemEvidenceType
}

export type MayhemRecommendationMode = 'strength' | 'off-meta'
export type MayhemConfidence = 'low' | 'medium' | 'high'
