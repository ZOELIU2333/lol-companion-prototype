import { describe, expect, it } from 'vitest'
import {
  DATA_DRAGON_VERSION,
  createDataDragonCatalog,
  getDataDragonAssetUrl,
  getItemIconUrl,
  getRuneIconUrl,
  getVersionLabel,
  type DataDragonHost,
} from './dataDragon'

describe('data dragon metadata helpers', () => {
  it('builds versioned item icon urls', () => {
    expect(getItemIconUrl(3004)).toBe(
      `https://ddragon.leagueoflegends.com/cdn/${DATA_DRAGON_VERSION}/img/item/3004.png`,
    )
  })

  it('builds rune icon urls from perk image paths', () => {
    expect(getRuneIconUrl('perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png')).toBe(
      'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png',
    )
  })

  it('exposes a compact version label for UI pills', () => {
    expect(getVersionLabel()).toBe('16.10')
  })

  it('builds localized catalog urls', () => {
    expect(getDataDragonAssetUrl('16.10.1', 'item.json')).toBe(
      'https://ddragon.leagueoflegends.com/cdn/16.10.1/data/zh_CN/item.json',
    )
  })

  it('maps Data Dragon items, champions, and runes into local catalog records', async () => {
    const requestedUrls: string[] = []
    const host: DataDragonHost = {
      async fetchJson<T>(url: string): Promise<T | null> {
        requestedUrls.push(url)

        if (url.endsWith('/api/versions.json')) {
          return ['16.10.1'] as T
        }

        if (url.endsWith('/item.json')) {
          return {
            data: {
              '3004': {
                name: '魔宗',
                description: '装备说明',
                plaintext: '法力成长',
                image: { full: '3004.png' },
                tags: ['Damage'],
                gold: { total: 2900, sell: 2030 },
              },
            },
          } as T
        }

        if (url.endsWith('/champion.json')) {
          return {
            data: {
              Ezreal: {
                id: 'Ezreal',
                key: '81',
                name: '伊泽瑞尔',
                title: '探险家',
                image: { full: 'Ezreal.png' },
                tags: ['Marksman', 'Mage'],
              },
            },
          } as T
        }

        if (url.endsWith('/runesReforged.json')) {
          return [
            {
              id: 8000,
              key: 'Precision',
              name: '精密',
              icon: 'perk-images/Styles/7201_Precision.png',
              slots: [
                {
                  runes: [
                    {
                      id: 8005,
                      key: 'PressTheAttack',
                      name: '强攻',
                      icon: 'perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png',
                    },
                  ],
                },
              ],
            },
          ] as T
        }

        return null
      },
    }

    const catalog = createDataDragonCatalog(host)

    await expect(catalog.getLatestVersion()).resolves.toBe('16.10.1')
    await expect(catalog.getItems('16.10.1')).resolves.toEqual([
      {
        id: '3004',
        name: '魔宗',
        description: '装备说明',
        plaintext: '法力成长',
        iconUrl: 'https://ddragon.leagueoflegends.com/cdn/16.10.1/img/item/3004.png',
        tags: ['Damage'],
        gold: { total: 2900, sell: 2030 },
      },
    ])
    await expect(catalog.getChampions('16.10.1')).resolves.toEqual([
      {
        id: 'Ezreal',
        key: '81',
        name: '伊泽瑞尔',
        title: '探险家',
        iconUrl: 'https://ddragon.leagueoflegends.com/cdn/16.10.1/img/champion/Ezreal.png',
        tags: ['Marksman', 'Mage'],
      },
    ])
    await expect(catalog.getRunes('16.10.1')).resolves.toEqual([
      {
        id: 8005,
        key: 'PressTheAttack',
        name: '强攻',
        iconUrl:
          'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png',
        tree: '精密',
      },
    ])
    expect(requestedUrls).toContain('https://ddragon.leagueoflegends.com/api/versions.json')
  })
})
