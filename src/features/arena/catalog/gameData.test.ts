import { describe, expect, it, vi } from 'vitest'
import { createGameDataIndex, loadCurrentGameData, parseChampionData, parseItemData } from './gameData'

const championsFile = {
  schemaVersion: 1,
  version: '16.15.1',
  generatedAt: '2026-08-03T00:00:00.000Z',
  champions: [
    {
      id: 'Ezreal',
      key: 81,
      name: '伊泽瑞尔',
      title: '探险家',
      rangeClass: 'ranged',
      tags: ['Marksman', 'Mage'],
      spells: [{ id: 'EzrealQ', name: '秘术射击', description: '发射一枚能量弹。' }],
      iconUrl: 'https://ddragon.leagueoflegends.com/cdn/16.15.1/img/champion/Ezreal.png',
    },
  ],
}

const itemsFile = {
  schemaVersion: 1,
  version: '16.15.1',
  generatedAt: '2026-08-03T00:00:00.000Z',
  items: [
    {
      id: 4629,
      name: '星界驱驰',
      description: '造成伤害时获得移动速度。',
      baseGold: 450,
      totalGold: 3000,
      from: [3113, 3108],
      purchasable: true,
      tags: ['AbilityHaste', 'AbilityPower'],
      iconUrl: 'https://ddragon.leagueoflegends.com/cdn/16.15.1/img/item/4629.png',
    },
    {
      id: 3108,
      name: '恶魔法典',
      description: '法术强度与技能急速。',
      baseGold: 250,
      totalGold: 850,
      purchasable: true,
      tags: ['AbilityHaste', 'AbilityPower'],
      iconUrl: 'https://ddragon.leagueoflegends.com/cdn/16.15.1/img/item/3108.png',
    },
  ],
}

describe('Arena current game data', () => {
  it('retains champion identity, spell text, and range class', () => {
    const gameData = createGameDataIndex(parseChampionData(championsFile), parseItemData(itemsFile))

    expect(gameData.version).toBe('16.15.1')
    expect(gameData.champions.get(81)).toMatchObject({
      id: 'Ezreal',
      name: '伊泽瑞尔',
      rangeClass: 'ranged',
    })
    expect(gameData.champions.get(81)?.spells[0]).toMatchObject({ name: '秘术射击' })
  })

  it('retains item recipes and localized icons for purchase planning', () => {
    const gameData = createGameDataIndex(parseChampionData(championsFile), parseItemData(itemsFile))
    const cosmicDrive = gameData.items.get(4629)

    expect(cosmicDrive).toMatchObject({ name: '星界驱驰', totalGold: 3000 })
    expect(cosmicDrive?.from).toEqual(expect.arrayContaining([3113, 3108]))
    expect(cosmicDrive?.iconUrl).toMatch(/\/img\/item\/4629\.png$/)
  })

  it('defaults a missing recipe to an empty list', () => {
    const parsed = parseItemData(itemsFile)

    expect(parsed.items.find((item) => item.id === 3108)?.from).toEqual([])
  })

  it('rejects duplicate identities, mismatched versions, and unsafe icons', () => {
    expect(() => parseChampionData({
      ...championsFile,
      champions: [...championsFile.champions, championsFile.champions[0]],
    })).toThrow('Duplicate champion key')
    expect(() => parseItemData({
      ...itemsFile,
      items: [...itemsFile.items, itemsFile.items[0]],
    })).toThrow('Duplicate item id')
    expect(() => parseItemData({
      ...itemsFile,
      items: [{ ...itemsFile.items[0], iconUrl: 'javascript:alert(1)' }],
    })).toThrow('invalid icon URL')
    expect(() => createGameDataIndex(
      parseChampionData(championsFile),
      parseItemData({ ...itemsFile, version: '16.14.1' }),
    )).toThrow('versions do not match')
  })

  it('loads both bundled files and filters unavailable items', async () => {
    const unavailable = { ...itemsFile.items[0], id: 9999, purchasable: false }
    const fetcher = vi.fn(async (url: string | URL | Request) => ({
      ok: true,
      json: async () => String(url).includes('champions')
        ? championsFile
        : { ...itemsFile, items: [...itemsFile.items, unavailable] },
    } as Response))

    const result = await loadCurrentGameData(fetcher)

    expect(result.version).toBe('16.15.1')
    expect(result.items.has(4629)).toBe(true)
    expect(result.items.has(9999)).toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
