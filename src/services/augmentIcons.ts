import { getArenaAugmentByApiName, getArenaAugmentByName } from '../data/arenaAugments'

const COMMUNITY_DRAGON_BASE = 'https://raw.communitydragon.org/latest'

const localizedAugmentApiNames: Record<string, string> = {
  主菜上桌: 'BreadAndButter',
  地震波: 'Earthwake',
  法术苏醒: 'Spellwake',
  现象级邪恶: 'PhenomenalEvil',
}

export function getAugmentIconUrl(name: string) {
  const augment = getArenaAugmentByName(name) ?? getArenaAugmentByApiName(localizedAugmentApiNames[name] ?? name)
  if (!augment?.iconSmall) return null

  return `${COMMUNITY_DRAGON_BASE}/${augment.iconSmall}`
}
