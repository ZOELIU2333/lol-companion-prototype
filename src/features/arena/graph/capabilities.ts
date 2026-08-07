import type { Champion } from '../../../types'
import type { ArenaItemDefinition } from '../catalog/gameData'
import type { ArenaAugmentDefinition } from '../catalog/types'
import { augmentOverrides, championOverrides, championStableKeys, itemOverrides } from './overrides'
import type { ArenaCapability, CapabilityWeight } from './types'

type ChampionMechanicInput = Champion & { key?: number | string; spells?: { name: string; description: string }[] }

const tokenRules: [ArenaCapability, RegExp][] = [
  ['dash', /冲刺|突进|位移|跳跃|\bdash(?:es)?\b/i],
  ['blink', /闪烁|\bblink/i],
  ['teleport', /传送|\bteleport/i],
  ['ability-hit', /技能.{0,8}命中|ability.{0,8}hit/i],
  ['ability-hit-trigger', /(?:当|在|用).{0,5}技能.{0,8}命中|on ability hit/i],
  ['attack-hit', /攻击命中|普攻|basic attack|attack hit/i],
  ['attack-hit-trigger', /(?:攻击命中|普攻).{0,8}(?:时|会)|on attack hit|on-hit/i],
  ['critical-strike', /暴击|critical strike|\bcrit\b/i],
  ['heal', /治疗|回复生命|\bheal/i],
  ['shield', /护盾|\bshield/i],
  ['burn', /灼烧|燃烧|每秒.{0,8}伤害|\bburn/i],
  ['cooldown', /冷却|cooldown/i],
  ['ability-haste', /技能急速|ability haste/i],
  ['summon', /召唤|summon/i],
  ['immobilize', /定身|禁锢|眩晕|击飞|immobili[sz]e|stun/i],
  ['execute', /处决|斩杀|execute/i],
  ['stacking', /叠加|永久提供|每层|stack/i],
  ['revive', /复活|revive|resurrect/i],
  ['repeat-cast', /再次施放|重复施放|额外施放|repeat cast/i],
  ['move-speed', /移动速度|movement speed/i],
  ['durability', /生命值|护甲|魔抗|damage reduction/i],
  ['sustain', /全能吸血|生命偷取|回复|omnivamp|lifesteal/i],
  ['on-hit', /攻击特效|on-hit/i],
  ['max-health', /最大生命值|max(?:imum)? health/i],
  ['low-health', /低生命值|生命值低于|low health/i],
  ['mana', /法力|mana/i],
  ['area-damage', /范围伤害|附近敌人|area damage|nearby enem/i],
  ['proc-damage', /造成.{0,12}伤害|伤害轨迹|deal.{0,12}damage/i],
]

function mergeCapabilities(inferred: ArenaCapability[], reviewed: readonly ArenaCapability[] = []) {
  const weights = new Map<ArenaCapability, CapabilityWeight>()
  for (const capability of inferred) {
    weights.set(capability, { capability, weight: 0.6, source: 'inferred' })
  }
  for (const capability of reviewed) {
    weights.set(capability, { capability, weight: 1, source: 'reviewed' })
  }
  return [...weights.values()].sort((left, right) => left.capability.localeCompare(right.capability))
}

function inferTokens(text: string) {
  return tokenRules.filter(([, pattern]) => pattern.test(text)).map(([capability]) => capability)
}

export function stableChampionKey(champion: ChampionMechanicInput) {
  if (champion.key !== undefined) return String(champion.key)
  return championStableKeys[champion.id.toLowerCase()] ?? champion.id.toLowerCase()
}

export function inferChampionCapabilities(champion: ChampionMechanicInput): CapabilityWeight[] {
  const spellText = champion.spells?.map((spell) => `${spell.name} ${spell.description}`).join(' ') ?? ''
  const text = [champion.name, champion.role, champion.identity, champion.powerWindow, ...champion.tags, spellText].join(' ')
  const inferred = inferTokens(text)
  if (champion.damageProfile === 'ap') inferred.push('ap-scaling')
  if (champion.damageProfile === 'ad') inferred.push('ad-scaling')
  if (champion.damageProfile === 'tank') inferred.push('durability')
  const stableKey = stableChampionKey(champion)
  return mergeCapabilities(inferred, championOverrides[stableKey as keyof typeof championOverrides])
}

export function inferAugmentCapabilities(augment: ArenaAugmentDefinition): CapabilityWeight[] {
  const text = [augment.apiName, augment.englishName, augment.name, augment.description, augment.tooltip].join(' ')
  return mergeCapabilities(
    inferTokens(text),
    augmentOverrides[augment.apiName as keyof typeof augmentOverrides],
  )
}

export function inferItemCapabilities(item: ArenaItemDefinition): CapabilityWeight[] {
  const text = [item.name, item.description, ...item.tags].join(' ')
  const inferred = inferTokens(text)
  if (item.tags.includes('SpellDamage')) inferred.push('ap-scaling')
  if (item.tags.includes('Damage')) inferred.push('ad-scaling')
  if (item.tags.includes('AttackSpeed')) inferred.push('basic-attack')
  if (item.tags.includes('OnHit')) inferred.push('on-hit')
  return mergeCapabilities(inferred, itemOverrides[item.id as keyof typeof itemOverrides])
}
