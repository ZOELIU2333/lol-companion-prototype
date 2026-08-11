export type ArenaAugmentRarity = 'silver' | 'gold' | 'prismatic' | 'unknown'

export type ArenaAugmentDefinition = {
  id: number
  apiName: string
  name: string
  englishName: string
  description: string
  tooltip: string
  iconLargeUrl: string | null
  iconSmallUrl: string | null
  rarity: ArenaAugmentRarity
}

export type ArenaCatalogSources = {
  zhCn: string
  enUs: string
}

export type ArenaCatalog = {
  schemaVersion: 1
  generatedAt: string
  sources: ArenaCatalogSources
  augments: ArenaAugmentDefinition[]
}

export type ArenaCatalogManifest = {
  schemaVersion: 1
  generatedAt: string
  count: number
  contentHash: `sha256:${string}`
  sources: ArenaCatalogSources
}

export type ArenaCatalogIndex = {
  catalog: ArenaCatalog
  find: (query: string | number) => ArenaAugmentDefinition | null
}
