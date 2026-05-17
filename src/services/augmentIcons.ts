const COMMUNITY_DRAGON_AUGMENT_ICON_BASE =
  'https://raw.communitydragon.org/14.4/plugins/rcp-be-lol-game-data/global/default/assets/ux/cherry/augments/icons'

const augmentIconSlugs: Record<string, string> = {
  主菜上桌: 'breadandbutter',
  地震波: 'earthwake',
  法术苏醒: 'spellwake',
  现象级邪恶: 'phenomenalevil',
}

export function getAugmentIconUrl(name: string) {
  const slug = augmentIconSlugs[name]
  if (!slug) return null

  return `${COMMUNITY_DRAGON_AUGMENT_ICON_BASE}/${slug}_small.arena_augments_v2.png`
}
