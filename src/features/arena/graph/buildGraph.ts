import type { Champion } from '../../../types'
import type { ArenaItemDefinition } from '../catalog/gameData'
import type { ArenaAugmentDefinition } from '../catalog/types'
import {
  inferAugmentCapabilities,
  inferChampionCapabilities,
  inferItemCapabilities,
  stableChampionKey,
} from './capabilities'
import { reviewedEdgeOverrides } from './overrides'
import type { ArenaCapability, MechanismEdge, MechanismGraph, MechanismNode } from './types'

type GraphInput = {
  champion: Champion & { key?: number | string; spells?: { name: string; description: string }[] }
  augments: ArenaAugmentDefinition[]
  items: ArenaItemDefinition[]
}

const triggerPairs: [ArenaCapability, ArenaCapability][] = [
  ['dash', 'dash-trigger'],
  ['multi-dash', 'dash-trigger'],
  ['blink', 'dash-trigger'],
  ['teleport', 'dash-trigger'],
  ['ability-hit', 'ability-hit-trigger'],
  ['attack-hit', 'attack-hit-trigger'],
]

const amplifyCapabilities = new Set<ArenaCapability>([
  'ap-scaling', 'ad-scaling', 'ability-haste', 'critical-strike', 'heal', 'shield', 'burn',
  'proc-damage', 'move-speed', 'durability', 'sustain', 'on-hit', 'basic-attack', 'max-health',
])

function capabilityMap(node: MechanismNode) {
  return new Map(node.capabilities.map((capability) => [capability.capability, capability]))
}

function inferredEdge(from: MechanismNode, to: MechanismNode): MechanismEdge | null {
  const source = capabilityMap(from)
  const target = capabilityMap(to)
  for (const [producer, trigger] of triggerPairs) {
    if (source.has(producer) && target.has(trigger)) {
      const reviewed = source.get(producer)?.source === 'reviewed' && target.get(trigger)?.source === 'reviewed'
      return {
        from: from.id,
        to: to.id,
        relation: 'triggers',
        weight: (source.get(producer)!.weight + target.get(trigger)!.weight) / 2,
        explanation: `${from.label}的${producer}会触发${to.label}的${trigger}机制。`,
        evidence: reviewed
          ? [{ kind: 'mechanism-verified', claim: `${producer} → ${trigger}`, reviewedAt: '2026-08-03T00:00:00.000Z' }]
          : [{ kind: 'theoretical', claim: `文本机制匹配：${producer} → ${trigger}` }],
      }
    }
  }

  const shared = [...source.keys()].find((capability) => target.has(capability) && amplifyCapabilities.has(capability))
  if (shared) {
    const reviewed = source.get(shared)?.source === 'reviewed' && target.get(shared)?.source === 'reviewed'
    return {
      from: from.id,
      to: to.id,
      relation: 'amplifies',
      weight: (source.get(shared)!.weight + target.get(shared)!.weight) / 2,
      explanation: `${from.label}与${to.label}共同强化${shared}。`,
      evidence: reviewed
        ? [{ kind: 'mechanism-verified', claim: `共同强化${shared}`, reviewedAt: '2026-08-03T00:00:00.000Z' }]
        : [{ kind: 'theoretical', claim: `共享机制标签：${shared}` }],
    }
  }
  return null
}

export function buildMechanismGraph(input: GraphInput): MechanismGraph {
  const championId = `champion:${stableChampionKey(input.champion)}`
  const nodes: MechanismNode[] = [
    {
      id: championId,
      kind: 'champion',
      label: input.champion.name,
      sourceKey: stableChampionKey(input.champion),
      capabilities: inferChampionCapabilities(input.champion),
    },
    ...input.augments.map((augment): MechanismNode => ({
      id: `augment:${augment.apiName}`,
      kind: 'arena-augment',
      label: augment.name,
      sourceKey: augment.apiName,
      capabilities: inferAugmentCapabilities(augment),
    })),
    ...input.items.map((item): MechanismNode => ({
      id: `item:${item.id}`,
      kind: 'item',
      label: item.name,
      sourceKey: item.id,
      capabilities: inferItemCapabilities(item),
    })),
  ]

  const edgeByIdentity = new Map<string, MechanismEdge>()
  for (const from of nodes) {
    for (const to of nodes) {
      if (from.id === to.id) continue
      const edge = inferredEdge(from, to)
      if (edge) edgeByIdentity.set(`${edge.from}|${edge.to}|${edge.relation}`, edge)
    }
  }
  const nodeIds = new Set(nodes.map((node) => node.id))
  for (const override of reviewedEdgeOverrides) {
    if (!nodeIds.has(override.from) || !nodeIds.has(override.to)) continue
    edgeByIdentity.set(`${override.from}|${override.to}|${override.relation}`, {
      ...override,
      evidence: [{
        kind: 'mechanism-verified',
        claim: override.explanation,
        reviewedAt: '2026-08-03T00:00:00.000Z',
      }],
    })
  }

  return {
    nodes,
    edges: [...edgeByIdentity.values()].sort((left, right) =>
      `${left.from}|${left.to}|${left.relation}`.localeCompare(`${right.from}|${right.to}|${right.relation}`)),
  }
}
