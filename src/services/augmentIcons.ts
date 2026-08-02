import type { ArenaAugmentDefinition } from '../features/arena/catalog/types'

const COMMUNITY_DRAGON_GAME_ASSET_BASE = 'https://raw.communitydragon.org/latest/game/assets/ux/cherry/augments/icons'

const localizedAugmentApiNames: Record<string, string> = {
  主菜上桌: 'BreadAndButter',
  地震波: 'Earthwake',
  法术苏醒: 'Spellwake',
  现象级邪恶: 'PhenomenalEvil',
}

function apiNameToIconFile(apiName: string) {
  return `${apiName.replaceAll(/[^A-Za-z0-9]/g, '').toLowerCase()}_small.png`
}

export function getAugmentIconUrl(augment: string | Pick<ArenaAugmentDefinition, 'iconLargeUrl' | 'iconSmallUrl'>) {
  if (typeof augment !== 'string') return augment.iconSmallUrl ?? augment.iconLargeUrl

  const apiName = localizedAugmentApiNames[augment] ?? augment
  return `${COMMUNITY_DRAGON_GAME_ASSET_BASE}/${apiNameToIconFile(apiName)}`
}
