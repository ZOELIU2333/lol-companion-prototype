import type {
  OpggChampionDetail,
  OpggCounterDetail,
  OpggItemSet,
  OpggRuneSet,
} from '../data/opggKrHighEloDetails'

const positions = new Set<OpggChampionDetail['position']>(['top', 'jungle', 'mid', 'adc', 'support'])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isString = (value: unknown): value is string => typeof value === 'string'

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every(isNumber)

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString)

const isNameArray = (value: unknown): value is Array<string | number> =>
  Array.isArray(value) && value.every((entry) => isString(entry) || isNumber(entry))

function hasFiniteNumbers(value: Record<string, unknown>, keys: string[]) {
  return keys.every((key) => isNumber(value[key]))
}

function isItemSet(value: unknown): value is OpggItemSet {
  return isRecord(value)
    && isNumberArray(value.ids)
    && isNameArray(value.idsNames)
    && value.ids.length === value.idsNames.length
    && hasFiniteNumbers(value, ['pickRate', 'play', 'win', 'winRate'])
}

function isRuneSet(value: unknown): value is OpggRuneSet {
  return isRecord(value)
    && hasFiniteNumbers(value, [
      'id',
      'pickRate',
      'play',
      'primaryPageId',
      'secondaryPageId',
      'win',
      'winRate',
    ])
    && isString(value.primaryPageName)
    && isString(value.secondaryPageName)
    && isNumberArray(value.primaryRuneIds)
    && isStringArray(value.primaryRuneNames)
    && value.primaryRuneIds.length === value.primaryRuneNames.length
    && isNumberArray(value.secondaryRuneIds)
    && isStringArray(value.secondaryRuneNames)
    && value.secondaryRuneIds.length === value.secondaryRuneNames.length
    && isNumberArray(value.statModIds)
    && isNumberArray(value.statModNames)
}

function isCounter(value: unknown): value is OpggCounterDetail {
  return isRecord(value)
    && isNumber(value.championId)
    && isString(value.championName)
    && hasFiniteNumbers(value, ['play', 'win', 'winRate'])
}

export function isOpggChampionDetail(value: unknown): value is OpggChampionDetail {
  if (!isRecord(value)
    || !isString(value.champion)
    || !isString(value.championKey)
    || !isString(value.championName)
    || !isString(value.href)
    || !isString(value.position)
    || !positions.has(value.position as OpggChampionDetail['position'])
    || !isRecord(value.data)) {
    return false
  }

  const data = value.data
  if (!isItemSet(data.boots)
    || !isItemSet(data.coreItems)
    || !isItemSet(data.summonerSpells)
    || !Array.isArray(data.fourthItems)
    || !data.fourthItems.every(isItemSet)
    || !Array.isArray(data.fifthItems)
    || !data.fifthItems.every(isItemSet)
    || !isRuneSet(data.runes)
    || !Array.isArray(data.strongCounters)
    || !data.strongCounters.every(isCounter)
    || !Array.isArray(data.weakCounters)
    || !data.weakCounters.every(isCounter)
    || !isRecord(data.summary)
    || !isRecord(data.summary.averageStats)) {
    return false
  }

  const stats = data.summary.averageStats
  return hasFiniteNumbers(stats, ['banRate', 'kda', 'pickRate', 'play', 'rank', 'tier', 'winRate'])
    && isRecord(stats.tierData)
    && hasFiniteNumbers(stats.tierData, ['rank', 'rankPrev', 'rankPrevPatch', 'tier'])
}
