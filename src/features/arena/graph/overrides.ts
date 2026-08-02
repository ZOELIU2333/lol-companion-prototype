import type { ArenaCapability, EdgeRelation } from './types'

export const championStableKeys: Record<string, string> = {
  ahri: '103',
  ezreal: '81',
  kaisa: '145',
  leesin: '64',
  yasuo: '157',
}

export const championOverrides = {
  '103': ['dash', 'multi-dash', 'ability-hit', 'ap-scaling', 'ranged'],
  '81': ['ability-hit', 'attack-hit', 'cooldown', 'ranged'],
  '64': ['dash', 'multi-dash', 'ability-hit', 'shield', 'melee'],
  '145': ['ability-hit', 'attack-hit', 'on-hit', 'ap-scaling', 'ad-scaling', 'ranged'],
  '157': ['dash', 'multi-dash', 'attack-hit', 'critical-strike', 'shield', 'melee'],
} satisfies Record<string, ArenaCapability[]>

export const augmentOverrides = {
  Earthwake: ['dash-trigger', 'proc-damage'],
  Spellwake: ['ability-hit-trigger', 'repeat-cast', 'proc-damage'],
  PhenomenalEvil: ['ability-hit-trigger', 'ap-scaling', 'stacking'],
} satisfies Record<string, ArenaCapability[]>

export const itemOverrides = {
  4629: ['ability-haste', 'move-speed', 'ap-scaling', 'durability'],
  3115: ['attack-hit-trigger', 'on-hit', 'ap-scaling', 'attack-hit'],
  6653: ['burn', 'ap-scaling', 'max-health'],
} satisfies Record<number, ArenaCapability[]>

export type ReviewedEdgeOverride = {
  from: string
  to: string
  relation: EdgeRelation
  weight: number
  explanation: string
}

export const reviewedEdgeOverrides: ReviewedEdgeOverride[] = [
  {
    from: 'champion:103',
    to: 'augment:Earthwake',
    relation: 'triggers',
    weight: 1,
    explanation: '阿狸的多段位移可以连续触发大地苏醒的延迟伤害轨迹。',
  },
]
