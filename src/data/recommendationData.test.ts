import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  augmentItemChains,
  getChampionBuildData,
  getChampionRunePages,
  getRecommendationDataMeta,
  getSelectedAugmentProfile,
  listRecommendationChampionIds,
} from './recommendationData'
import { getOpggKrHighEloChampionStat, opggKrHighEloChampionStats, opggKrHighEloMeta } from './opggKrHighEloStats'
import { mockMatches } from './mockMatches'
import { getAugmentIconUrl } from '../services/augmentIcons'
import { createArenaCatalogIndex, parseArenaCatalog } from '../features/arena/catalog/catalog'
import type { Champion } from '../types'

const ezreal = mockMatches[0].champions.find((champion) => champion.id === 'ezreal')!
const ahri = mockMatches[1].champions.find((champion) => champion.id === 'ahri')!
const arenaCatalog = parseArenaCatalog(JSON.parse(readFileSync('public/data/arena/catalog.json', 'utf8')))
const arenaCatalogIndex = createArenaCatalogIndex(arenaCatalog)
const championStub = (id: string): Champion => ({
  id,
  name: id,
  role: '测试',
  damageProfile: 'mixed',
  powerWindow: '测试',
  identity: '测试',
  tags: [],
})

describe('recommendation data layer', () => {
  it('returns champion-specific build tables', () => {
    expect(getChampionBuildData(ezreal).loadouts.map((loadout) => loadout.id)).toContain('ezreal-opgg-core')
    expect(getChampionBuildData(ahri).loadouts.map((loadout) => loadout.id)).toContain('ahri-opgg-core')
  })

  it('returns champion-specific rune pages', () => {
    expect(getChampionRunePages(ezreal)[0]).toMatchObject({ id: 'ezreal-opgg-runes', primaryTree: '精密' })
    expect(getChampionRunePages(ahri)[0]).toMatchObject({ id: 'ahri-opgg-runes', primaryTree: '主宰' })
  })

  it('marks short-term meta data as OP.GG Korean high-elo seed data', () => {
    expect(getRecommendationDataMeta()).toMatchObject({
      confidence: 'medium',
      patch: '16.11',
      rank: 'diamond+',
      region: 'kr',
      sampleSize: 28275698,
      source: 'opgg-kr-high-elo',
      sourceLabel: 'OP.GG 韩服钻石+',
    })
    expect(getChampionBuildData(ezreal).loadouts[0].meta).toMatchObject({
      championRank: 85,
      pickRate: 19,
      sourceUrl: 'https://op.gg/zh-cn/lol/champions/ezreal/build/adc?region=kr&tier=diamond_plus',
      source: 'opgg-kr-high-elo',
      winRate: 47,
    })
    expect(getChampionRunePages(ezreal)[0].meta).toMatchObject({
      pickRate: 19,
      source: 'opgg-kr-high-elo',
      winRate: 47,
    })
  })

  it('keeps OP.GG Korean Diamond+ stats for prototype champions', () => {
    expect(opggKrHighEloMeta.sourceUrl).toContain('region=kr')
    expect(opggKrHighEloChampionStats).toHaveLength(10)
    expect(getOpggKrHighEloChampionStat('leesin')).toMatchObject({
      pickRate: 27.08,
      position: 'jungle',
      rank: 2,
      winRate: 52.69,
    })
  })

  it('keeps augment profiles and item chains data-driven', () => {
    expect(getSelectedAugmentProfile('法术苏醒')).toMatchObject({
      plan: '冷却消耗链',
      tags: expect.arrayContaining(['cooldown']),
    })
    expect(augmentItemChains.some((chain) => chain.id === 'haste-poke')).toBe(true)
  })

  it('uses externally imported CommunityDragon arena augment metadata', () => {
    expect(arenaCatalog.augments.length).toBeGreaterThan(200)
    expect(arenaCatalog.sources).toMatchObject({
      zhCn: expect.stringContaining('/zh_cn.json'),
      enUs: expect.stringContaining('/en_us.json'),
    })
    const spellwake = arenaCatalogIndex.find('Spellwake')!
    expect(spellwake).toMatchObject({ name: '法术苏醒', iconSmallUrl: expect.stringContaining('spellwake_small.png') })
    expect(getAugmentIconUrl(spellwake)).toBe(spellwake.iconSmallUrl)
    expect(getAugmentIconUrl('法术苏醒')).toContain('/latest/game/assets/')
  })

  it('covers the first match player champion pool with builds and runes', () => {
    const expectedChampionIds = [
      'ahri',
      'camille',
      'draven',
      'ezreal',
      'kaisa',
      'leesin',
      'mordekaiser',
      'nautilus',
      'syndra',
      'thresh',
    ]

    expect(listRecommendationChampionIds()).toEqual(expectedChampionIds)
    expectedChampionIds.forEach((championId) => {
      const champion = championStub(championId)
      expect(getChampionBuildData(champion).loadouts.length).toBeGreaterThanOrEqual(3)
      expect(getChampionRunePages(champion).length).toBeGreaterThanOrEqual(1)
    })
  })
})
