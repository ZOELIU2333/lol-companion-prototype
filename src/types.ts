import type { MayhemConfidence } from './features/mayhem/types'

export type GameMode = 'ranked' | 'augment' | 'arena'
export type InfoPhase = 'pregame' | 'live'
export type TeamSide = 'ally' | 'enemy'
export type PlayerFilter = 'ally' | 'enemy'
export type DamageProfile = 'ad' | 'ap' | 'mixed' | 'tank'
export type RiskLevel = 'low' | 'medium' | 'high'
export type RestrictedFieldStatus = 'unavailable' | 'pending-source' | 'available'
export type DiagnosticStatus = 'online' | 'checking' | 'offline' | 'demo'

export type ConnectionDiagnostic = {
  id: 'shell' | 'lcu' | 'live-client' | 'opgg'
  label: string
  status: DiagnosticStatus
  detail: string
}

export type RestrictedAccountField = {
  status: RestrictedFieldStatus
  label: string
  value?: string | number
  reason?: string
}

export type RecommendationDataMeta = {
  source: 'opgg-kr-high-elo' | 'opgg-manual' | 'manual-seed' | 'riot-aggregate' | 'community'
  patch: string
  region?: string
  rank?: string
  sourceLabel?: string
  sampleSize?: number
  winRate?: number
  pickRate?: number
  championRank?: number
  counters?: {
    championKey: string
    championName: string
  }[]
  sourceUrl?: string
  confidence: 'low' | 'medium' | 'high'
  collectedAt?: string
}

export type PlayerRiotAccount = {
  gameName: string
  puuid?: string
  region: 'americas' | 'asia' | 'europe' | 'sea'
  platform?: 'br1' | 'eun1' | 'euw1' | 'jp1' | 'kr' | 'la1' | 'la2' | 'me1' | 'na1' | 'oc1' | 'ru' | 'sg2' | 'tr1' | 'tw2' | 'vn2'
  tagLine?: string
}

export type Champion = {
  id: string
  name: string
  role: string
  damageProfile: DamageProfile
  powerWindow: string
  identity: string
  tags: string[]
}

export type PlayerIntel = {
  id: string
  name: string
  riotAccount?: PlayerRiotAccount
  team: TeamSide
  role: string
  championId: string
  rank: string
  recentWinRate: number
  championWinRate: number
  kda: number
  csPerMin: number
  killParticipation: number
  mastery: number
  score: number
  recentRankedGames: number
  championGames: number
  averageDeaths: number
  visionScore: number
  damageShare: number
  goldDiffAt15: number
  trendTags: string[]
  heroAdvice: string
  matchupNote: string
  risk: {
    level: RiskLevel
    labels: string[]
    confidence: 'demo' | 'inferred' | 'public-data'
  }
  restricted: {
    banCount: RestrictedAccountField
    reportCount: RestrictedAccountField
  }
}

export type PlayerRecentMatch = {
  id: string
  champion: string
  createdAt?: string
  result: '胜' | '负'
  mode: string
  time: string
  kda: string
  cs: string
  kp: number
  score: number
}

export type PlayerMatchDetail = {
  createdAt: string
  durationSeconds: number
  gameType: string
  id: string
  teams: {
    key: 'BLUE' | 'RED'
    isWin: boolean
    kills: number
    gold: number
    towers: number
    dragons: number
    barons: number
    participants: {
      championName: string
      death: number
      assist: number
      kill: number
      damage: number
      items: {
        id: number
        name: string
      }[]
      opScore: number
      position: string
      summonerName: string
      tagLine: string
      vision: number
    }[]
  }[]
  source: 'opgg-mcp'
}

export type PlayerPartyGroup = {
  id: string
  team: TeamSide
  playerIds: string[]
  games: number
  winRate: number
  color: 'cyan' | 'amber' | 'rose' | 'violet'
}

export type TeamComposition = {
  apThreat: number
  crowdControl: number
  tanks: number
  assassins: number
  sustain: number
  mobility: number
}

export type Item = {
  id: string
  iconId: number
  name: string
  category: 'core' | 'defense' | 'penetration' | 'utility' | 'boots'
  tags: string[]
}

export type Augment = {
  id: string
  name: string
  tier: 'silver' | 'gold' | 'prismatic'
  tags: string[]
  currentValue: number
  scalingValue: number
  note: string
}

export type ArenaThreat = {
  label: string
  severity: RiskLevel
  advice: string
}

export type MatchIntel = {
  allyAverageScore: number
  enemyAverageScore: number
  powerSpike: string
  compositionNote: string
  topThreat: string
  winCondition: string
  earlyPlan: string
  midGamePlan: string
  lateGamePlan: string
  laneFocus: string
  objectivePlan: string
  fightPlan: string
  targetCalls: string[]
  threatBreakdown: {
    label: string
    value: number
    note: string
  }[]
}

export type LiveState = {
  minute: number
  goldOnHand: number
  currentItems: string[]
  selectedAugments: string[]
  selectedAugmentIds: number[]
  candidateAugmentIds: number[]
  isLiveDataAuthoritative: boolean
  currentSituation: string
  nextObjective: string
  immediateAction: string
}

export type LaneMatchup = {
  lane: string
  allyChampion: string
  enemyChampions: string[]
  difficulty: '优势' | '均势' | '劣势'
  confidence: number
  summary: string
  levelOnePlan: string
  wavePlan: string
  tradePattern: string
  dangerWindows: {
    timing: string
    threat: string
    response: string
  }[]
  skillTips: {
    label: string
    detail: string
  }[]
  junglePlan: string
  summonerPlan: string
  starterPlan: string
}

export type Match = {
  id: string
  mode: GameMode
  map: string
  status: 'detecting' | 'detected'
  timer: string
  currentChampionId: string
  champions: Champion[]
  players: PlayerIntel[]
  enemyComposition: TeamComposition
  augmentCandidates: Augment[]
  arenaThreats: ArenaThreat[]
  intel: MatchIntel
  laneMatchup: LaneMatchup
  liveState: LiveState
}

export type BuildRecommendation = {
  meta?: RecommendationDataMeta
  score: number
  title: string
  coreItems: Item[]
  situationalItems: Item[]
  loadouts: {
    id: string
    name: string
    score: number
    style: string
    items: Item[]
    bestWhen: string
    tradeoff: string
    meta?: RecommendationDataMeta
  }[]
  stages: {
    label: string
    items: Item[]
    goal: string
  }[]
  counterPlans: {
    trigger: string
    action: string
    priority: number
  }[]
  warnings: string[]
  explanation: string
  pivots: string[]
}

export type RunePageRecommendation = {
  id: string
  meta?: RecommendationDataMeta
  name: string
  style: string
  score: number
  primaryTree: string
  secondaryTree: string
  runes: {
    id: string
    name: string
    icon: string
  }[]
}

export type AugmentRecommendation = Augment & {
  score: number
  probability: number
  dataSourceLabel: string
  scoreLabel: string
  scoreReason: string
  comboTags: string[]
  synergy: string
  selectedSynergy: string
  selectedSynergyScore: number
  conflictNote?: string
  futurePotential: string
  futureCombos: {
    name: string
    probability: number
    reason: string
  }[]
  // Real Mayhem snapshot evidence; only present when the version-aggregate path is taken.
  // Absent on local-fallback entries so the UI can show honest placeholders instead of
  // fabricated numbers.
  mayhemGames?: number
  mayhemConfidence?: MayhemConfidence
  observing?: boolean
}

export type MayhemScoreBreakdown = {
  normalizedWinRate: number
  sampleStability: number
  championFit: number
  selectedSynergy: number
  comboLift: number
  rarityValue: number
  crossSourceStability: number
}

export type MayhemCandidateScore = {
  augmentId: number
  score: number
  scoreBreakdown: MayhemScoreBreakdown
  games: number
  sourceCount: number
  confidence: MayhemConfidence
  reason: string
  itemIds: number[]
}

export type ArenaRecommendation = {
  priority: string
  threats: ArenaThreat[]
  upgrades: string[]
  roundPlan: {
    phase: string
    action: string
  }[]
  matchupRules: {
    enemyStyle: string
    response: string
  }[]
  strategy: string
}

export type RecommendationViewModel = {
  build: BuildRecommendation
  runes: RunePageRecommendation[]
  augments: AugmentRecommendation[]
  arena: ArenaRecommendation
  live: {
    nextItem: Item
    tacticalRead: string
    nextTwoMinutes: string[]
    augmentContext: {
      selected: string[]
      bestCandidate: string
      reason: string
      comboScore: number
      itemPlan: {
        id: string
        label: string
        score: number
        items: Item[]
      }
    }
  }
}
