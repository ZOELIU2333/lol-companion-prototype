import { describe, expect, it } from 'vitest'
import type { Champion } from '../types'
import {
  getRuntimeOpggChampionDetail,
  getRuntimeOpggChampionDetailLabel,
  loadOpggChampionDetail,
} from './opggChampionData'
import type { OpggMcpHost } from './opggMcpAdapter'

const ezreal: Champion = {
  damageProfile: 'mixed',
  id: 'ezreal',
  identity: '消耗、拉扯、反打',
  name: '伊泽瑞尔',
  powerWindow: '',
  role: '下路',
  tags: [],
}

const analysisText = 'class LolGetChampionAnalysis: champion,position,data\nclass Data: summary,core_items,boots,fourth_items,fifth_items,runes,strong_counters,weak_counters,summoner_spells\nclass Summary: average_stats\nclass AverageStats: ban_rate,kda,pick_rate,play,rank,tier,win_rate,tier_data\nclass TierData: rank,rank_prev,rank_prev_patch,tier\nclass CoreItems: ids,ids_names,pick_rate,play,win\nclass Runes: id,pick_rate,play,primary_page_id,primary_page_name,primary_rune_ids,primary_rune_names,secondary_page_id,secondary_page_name,secondary_rune_ids,secondary_rune_names,stat_mod_ids,stat_mod_names,win\nclass StrongCounter: champion_id,champion_name,play,win,win_rate\n\nLolGetChampionAnalysis("EZREAL","ADC",Data(Summary(AverageStats(0.09,2.38,0.2,6872980,81,3,0.47,TierData(81,81,88,3))),CoreItems([3070,3078,3042],["女神之泪","三相之力","魔切"],0.45,41283,22208),CoreItems([3158],["明朗之靴"],0.73,84576,40713),[CoreItems([6694],["赛瑞尔达的怨恨"],0.33,19556,10189)],[CoreItems([3161],["朔极之矛"],0.19,4671,2347)],Runes(8008,0.35,45358,8000,"精密",[8008,8009,9103,8014],["致命节奏","气定神闲","传说：血统","致命一击"],8300,"启迪",[8304,8345],["神奇之鞋","饼干配送"],[5005,5008,5001],[5005,5008,5001],21446),[StrongCounter(42,"英勇投弹手",1038,546,0.53)],[StrongCounter(901,"炽炎雏龙",11791,5122,0.57)],CoreItems([4,21],[4,21],0.92,117367,56147)))'

function createMockHost(): OpggMcpHost {
  return {
    async fetchJson<T>(_url: string, init?: { body?: string }) {
      const body = JSON.parse(init?.body ?? '{}') as {
        params?: {
          arguments?: {
            champion?: string
            position?: string
          }
          name?: string
        }
      }

      expect(body.params?.name).toBe('lol_get_champion_analysis')
      expect(body.params?.arguments?.champion).toBe('EZREAL')
      expect(body.params?.arguments?.position).toBe('adc')

      return {
        result: {
          content: [{ text: analysisText, type: 'text' }],
        },
      } as T
    },
  }
}

describe('OP.GG dynamic champion data', () => {
  it('loads champion detail from OP.GG MCP and registers runtime cache', async () => {
    const detail = await loadOpggChampionDetail(createMockHost(), ezreal)

    expect(detail).toMatchObject({
      champion: 'EZREAL',
      championKey: 'ezreal',
      championName: '伊泽瑞尔',
      position: 'adc',
      data: {
        coreItems: {
          ids: [3070, 3078, 3042],
          winRate: 53.79,
        },
        summary: {
          averageStats: {
            play: 6872980,
            rank: 81,
            winRate: 47,
          },
        },
      },
    })
    expect(getRuntimeOpggChampionDetail('ezreal')).toBe(detail)
    expect(getRuntimeOpggChampionDetailLabel('ezreal')).toBe('OP.GG 韩服钻石+ · MCP实时')
  })
})
