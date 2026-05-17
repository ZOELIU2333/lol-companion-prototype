export type OpggItemSet = {
  ids: number[]
  idsNames: Array<string | number>
  pickRate: number
  play: number
  win: number
  winRate: number
}

export type OpggRuneSet = {
  id: number
  pickRate: number
  play: number
  primaryPageId: number
  primaryPageName: string
  primaryRuneIds: number[]
  primaryRuneNames: string[]
  secondaryPageId: number
  secondaryPageName: string
  secondaryRuneIds: number[]
  secondaryRuneNames: string[]
  statModIds: number[]
  statModNames: number[]
  win: number
  winRate: number
}

export type OpggCounterDetail = {
  championId: number
  championName: string
  play: number
  win: number
  winRate: number
}

export type OpggChampionDetail = {
  champion: string
  championKey: string
  championName: string
  data: {
    boots: OpggItemSet
    coreItems: OpggItemSet
    fifthItems: OpggItemSet[]
    fourthItems: OpggItemSet[]
    runes: OpggRuneSet
    strongCounters: OpggCounterDetail[]
    summonerSpells: OpggItemSet
    summary: {
      averageStats: {
        banRate: number
        kda: number
        pickRate: number
        play: number
        rank: number
        tier: number
        tierData: {
          rank: number
          rankPrev: number
          rankPrevPatch: number
          tier: number
        }
        winRate: number
      }
    }
    weakCounters: OpggCounterDetail[]
  }
  href: string
  position: 'top' | 'jungle' | 'mid' | 'adc' | 'support'
}

export const opggKrHighEloChampionDetails: OpggChampionDetail[] = [
  {
    championKey: 'ahri',
    championName: '九尾妖狐',
    href: '/zh-cn/lol/champions/ahri/build/mid?region=kr&tier=diamond_plus',
    position: 'mid',
    champion: 'AHRI',
    data: {
      summary: {
        averageStats: {
          banRate: 4,
          kda: 2.56,
          pickRate: 11,
          play: 3816038,
          rank: 10,
          tier: 1,
          winRate: 52,
          tierData: {
            rank: 10,
            rankPrev: 10,
            rankPrevPatch: 13,
            tier: 1,
          },
        },
      },
      coreItems: {
        ids: [
          3118,
          4645,
          3157,
        ],
        idsNames: [
          '残疫',
          '影焰',
          '中娅沙漏',
        ],
        pickRate: 0.13,
        play: 5863,
        win: 3162,
        winRate: 53.93,
      },
      boots: {
        ids: [
          3020,
        ],
        idsNames: [
          '法师之靴',
        ],
        pickRate: 0.54,
        play: 38245,
        win: 19944,
        winRate: 52.15,
      },
      fourthItems: [
        {
          ids: [
            3089,
          ],
          idsNames: [
            '灭世者的死亡之帽',
          ],
          pickRate: 0.32,
          play: 6331,
          win: 3740,
          winRate: 59.07,
        },
        {
          ids: [
            3157,
          ],
          idsNames: [
            '中娅沙漏',
          ],
          pickRate: 0.26,
          play: 5109,
          win: 3029,
          winRate: 59.29,
        },
        {
          ids: [
            3135,
          ],
          idsNames: [
            '虚空之杖',
          ],
          pickRate: 0.08,
          play: 1623,
          win: 877,
          winRate: 54.04,
        },
      ],
      fifthItems: [
        {
          ids: [
            3089,
          ],
          idsNames: [
            '灭世者的死亡之帽',
          ],
          pickRate: 0.2,
          play: 1000,
          win: 632,
          winRate: 63.2,
        },
        {
          ids: [
            3135,
          ],
          idsNames: [
            '虚空之杖',
          ],
          pickRate: 0.17,
          play: 853,
          win: 486,
          winRate: 56.98,
        },
        {
          ids: [
            3157,
          ],
          idsNames: [
            '中娅沙漏',
          ],
          pickRate: 0.16,
          play: 820,
          win: 509,
          winRate: 62.07,
        },
      ],
      runes: {
        id: 8112,
        pickRate: 0.5,
        play: 37728,
        primaryPageId: 8100,
        primaryPageName: '主宰',
        primaryRuneIds: [
          8112,
          8139,
          8140,
          8106,
        ],
        primaryRuneNames: [
          '电刑',
          '血之滋味',
          '可怖纪念品',
          '终极猎人',
        ],
        secondaryPageId: 8200,
        secondaryPageName: '巫术',
        secondaryRuneIds: [
          8210,
          8226,
        ],
        secondaryRuneNames: [
          '超然',
          '法力流系带',
        ],
        statModIds: [
          5005,
          5008,
          5001,
        ],
        statModNames: [
          5005,
          5008,
          5001,
        ],
        win: 19282,
        winRate: 51.11,
      },
      strongCounters: [
        {
          championId: 84,
          championName: '离群之刺',
          play: 1970,
          win: 1095,
          winRate: 56,
        },
        {
          championId: 268,
          championName: '沙漠皇帝',
          play: 515,
          win: 288,
          winRate: 56,
        },
        {
          championId: 777,
          championName: '封魔剑魂',
          play: 1483,
          win: 806,
          winRate: 54,
        },
      ],
      weakCounters: [
        {
          championId: 1,
          championName: '黑暗之女',
          play: 1297,
          win: 611,
          winRate: 53,
        },
        {
          championId: 134,
          championName: '暗黑元首',
          play: 1603,
          win: 777,
          winRate: 52,
        },
        {
          championId: 950,
          championName: '百裂冥犬',
          play: 861,
          win: 414,
          winRate: 52,
        },
      ],
      summonerSpells: {
        ids: [
          4,
          12,
        ],
        idsNames: [
          4,
          12,
        ],
        pickRate: 0.54,
        play: 40432,
        win: 20425,
        winRate: 50.52,
      },
    },
  },
  {
    championKey: 'camille',
    championName: '青钢影',
    href: '/zh-cn/lol/champions/camille/build/top?region=kr&tier=diamond_plus',
    position: 'top',
    champion: 'CAMILLE',
    data: {
      summary: {
        averageStats: {
          banRate: 1,
          kda: 1.9,
          pickRate: 4,
          play: 1312112,
          rank: 108,
          tier: 3,
          winRate: 50,
          tierData: {
            rank: 108,
            rankPrev: 108,
            rankPrevPatch: 109,
            tier: 3,
          },
        },
      },
      coreItems: {
        ids: [
          3078,
          3074,
          6333,
        ],
        idsNames: [
          '三相之力',
          '贪欲九头蛇',
          '死亡之舞',
        ],
        pickRate: 0.32,
        play: 3205,
        win: 1878,
        winRate: 58.6,
      },
      boots: {
        ids: [
          3047,
        ],
        idsNames: [
          '铁板靴',
        ],
        pickRate: 0.61,
        play: 10053,
        win: 5220,
        winRate: 51.92,
      },
      fourthItems: [
        {
          ids: [
            6333,
          ],
          idsNames: [
            '死亡之舞',
          ],
          pickRate: 0.31,
          play: 1249,
          win: 731,
          winRate: 58.53,
        },
        {
          ids: [
            3053,
          ],
          idsNames: [
            '斯特拉克的挑战护手',
          ],
          pickRate: 0.23,
          play: 932,
          win: 574,
          winRate: 61.59,
        },
        {
          ids: [
            3161,
          ],
          idsNames: [
            '朔极之矛',
          ],
          pickRate: 0.14,
          play: 567,
          win: 333,
          winRate: 58.73,
        },
      ],
      fifthItems: [
        {
          ids: [
            3026,
          ],
          idsNames: [
            '守护天使',
          ],
          pickRate: 0.33,
          play: 324,
          win: 211,
          winRate: 65.12,
        },
        {
          ids: [
            3053,
          ],
          idsNames: [
            '斯特拉克的挑战护手',
          ],
          pickRate: 0.14,
          play: 136,
          win: 71,
          winRate: 52.21,
        },
        {
          ids: [
            6333,
          ],
          idsNames: [
            '死亡之舞',
          ],
          pickRate: 0.1,
          play: 98,
          win: 61,
          winRate: 62.24,
        },
      ],
      runes: {
        id: 8437,
        pickRate: 0.21,
        play: 4176,
        primaryPageId: 8400,
        primaryPageName: '坚决',
        primaryRuneIds: [
          8437,
          8401,
          8473,
          8242,
        ],
        primaryRuneNames: [
          '不灭之握',
          '护盾猛击',
          '骸骨镀层',
          '坚定',
        ],
        secondaryPageId: 8300,
        secondaryPageName: '启迪',
        secondaryRuneIds: [
          8304,
          8345,
        ],
        secondaryRuneNames: [
          '神奇之鞋',
          '饼干配送',
        ],
        statModIds: [
          5005,
          5008,
          5001,
        ],
        statModNames: [
          5005,
          5008,
          5001,
        ],
        win: 2042,
        winRate: 48.9,
      },
      strongCounters: [
        {
          championId: 86,
          championName: '德玛西亚之力',
          play: 1069,
          win: 579,
          winRate: 54,
        },
        {
          championId: 58,
          championName: '荒漠屠夫',
          play: 616,
          win: 315,
          winRate: 51,
        },
        {
          championId: 24,
          championName: '武器大师',
          play: 541,
          win: 272,
          winRate: 50,
        },
      ],
      weakCounters: [
        {
          championId: 122,
          championName: '诺克萨斯之手',
          play: 579,
          win: 272,
          winRate: 53,
        },
      ],
      summonerSpells: {
        ids: [
          4,
          14,
        ],
        idsNames: [
          4,
          14,
        ],
        pickRate: 0.59,
        play: 11502,
        win: 5867,
        winRate: 51.01,
      },
    },
  },
  {
    championKey: 'draven',
    championName: '荣耀行刑官',
    href: '/zh-cn/lol/champions/draven/build/adc?region=kr&tier=diamond_plus',
    position: 'adc',
    champion: 'DRAVEN',
    data: {
      summary: {
        averageStats: {
          banRate: 14,
          kda: 1.96,
          pickRate: 4,
          play: 1557838,
          rank: 121,
          tier: 3,
          winRate: 50,
          tierData: {
            rank: 121,
            rankPrev: 121,
            rankPrevPatch: 128,
            tier: 3,
          },
        },
      },
      coreItems: {
        ids: [
          6697,
          2523,
          3031,
        ],
        idsNames: [
          '狂妄',
          '海克斯镜片 C44',
          '无尽之刃',
        ],
        pickRate: 0.22,
        play: 5036,
        win: 2785,
        winRate: 55.3,
      },
      boots: {
        ids: [
          3006,
        ],
        idsNames: [
          '狂战士胫甲',
        ],
        pickRate: 0.51,
        play: 13345,
        win: 6684,
        winRate: 50.09,
      },
      fourthItems: [
        {
          ids: [
            3036,
          ],
          idsNames: [
            '多米尼克领主的致意',
          ],
          pickRate: 0.39,
          play: 6415,
          win: 3882,
          winRate: 60.51,
        },
        {
          ids: [
            3031,
          ],
          idsNames: [
            '无尽之刃',
          ],
          pickRate: 0.2,
          play: 3261,
          win: 1919,
          winRate: 58.85,
        },
        {
          ids: [
            3033,
          ],
          idsNames: [
            '凡性的提醒',
          ],
          pickRate: 0.11,
          play: 1751,
          win: 931,
          winRate: 53.17,
        },
      ],
      fifthItems: [
        {
          ids: [
            6673,
          ],
          idsNames: [
            '不朽盾弓',
          ],
          pickRate: 0.17,
          play: 1489,
          win: 854,
          winRate: 57.35,
        },
        {
          ids: [
            3094,
          ],
          idsNames: [
            '疾射火炮',
          ],
          pickRate: 0.16,
          play: 1347,
          win: 803,
          winRate: 59.61,
        },
        {
          ids: [
            3072,
          ],
          idsNames: [
            '饮血剑',
          ],
          pickRate: 0.13,
          play: 1084,
          win: 663,
          winRate: 61.16,
        },
      ],
      runes: {
        id: 8008,
        pickRate: 0.23,
        play: 6901,
        primaryPageId: 8000,
        primaryPageName: '精密',
        primaryRuneIds: [
          8008,
          8009,
          9104,
          8017,
        ],
        primaryRuneNames: [
          '致命节奏',
          '气定神闲',
          '传说：欢欣',
          '砍倒',
        ],
        secondaryPageId: 8300,
        secondaryPageName: '启迪',
        secondaryRuneIds: [
          8313,
          8321,
        ],
        secondaryRuneNames: [
          '三重补药',
          '返现',
        ],
        statModIds: [
          5005,
          5008,
          5011,
        ],
        statModNames: [
          5005,
          5008,
          5011,
        ],
        win: 3328,
        winRate: 48.22,
      },
      strongCounters: [
        {
          championId: 523,
          championName: '残月之肃',
          play: 552,
          win: 296,
          winRate: 54,
        },
        {
          championId: 81,
          championName: '探险家',
          play: 2222,
          win: 1167,
          winRate: 53,
        },
        {
          championId: 145,
          championName: '虚空之女',
          play: 1103,
          win: 584,
          winRate: 53,
        },
      ],
      weakCounters: [
        {
          championId: 901,
          championName: '炽炎雏龙',
          play: 3265,
          win: 1539,
          winRate: 53,
        },
        {
          championId: 22,
          championName: '寒冰射手',
          play: 1883,
          win: 905,
          winRate: 52,
        },
        {
          championId: 222,
          championName: '暴走萝莉',
          play: 1420,
          win: 678,
          winRate: 52,
        },
      ],
      summonerSpells: {
        ids: [
          4,
          21,
        ],
        idsNames: [
          4,
          21,
        ],
        pickRate: 0.87,
        play: 26021,
        win: 12970,
        winRate: 49.84,
      },
    },
  },
  {
    championKey: 'ezreal',
    championName: '探险家',
    href: '/zh-cn/lol/champions/ezreal/build/adc?region=kr&tier=diamond_plus',
    position: 'adc',
    champion: 'EZREAL',
    data: {
      summary: {
        averageStats: {
          banRate: 9,
          kda: 2.38,
          pickRate: 20,
          play: 6872980,
          rank: 81,
          tier: 3,
          winRate: 47,
          tierData: {
            rank: 81,
            rankPrev: 81,
            rankPrevPatch: 88,
            tier: 3,
          },
        },
      },
      coreItems: {
        ids: [
          3070,
          3078,
          3042,
          2517,
        ],
        idsNames: [
          '女神之泪',
          '三相之力',
          '魔切',
          '无穷饥渴',
        ],
        pickRate: 0.45,
        play: 41283,
        win: 22208,
        winRate: 53.79,
      },
      boots: {
        ids: [
          3158,
        ],
        idsNames: [
          '明朗之靴',
        ],
        pickRate: 0.73,
        play: 84576,
        win: 40713,
        winRate: 48.14,
      },
      fourthItems: [
        {
          ids: [
            6694,
          ],
          idsNames: [
            '赛瑞尔达的怨恨',
          ],
          pickRate: 0.33,
          play: 19556,
          win: 10189,
          winRate: 52.1,
        },
        {
          ids: [
            3161,
          ],
          idsNames: [
            '朔极之矛',
          ],
          pickRate: 0.29,
          play: 16856,
          win: 9047,
          winRate: 53.67,
        },
        {
          ids: [
            2517,
          ],
          idsNames: [
            '无穷饥渴',
          ],
          pickRate: 0.14,
          play: 8536,
          win: 4623,
          winRate: 54.16,
        },
      ],
      fifthItems: [
        {
          ids: [
            6694,
          ],
          idsNames: [
            '赛瑞尔达的怨恨',
          ],
          pickRate: 0.27,
          play: 6463,
          win: 3392,
          winRate: 52.48,
        },
        {
          ids: [
            3161,
          ],
          idsNames: [
            '朔极之矛',
          ],
          pickRate: 0.19,
          play: 4671,
          win: 2347,
          winRate: 50.25,
        },
        {
          ids: [
            3110,
          ],
          idsNames: [
            '冰霜之心',
          ],
          pickRate: 0.15,
          play: 3620,
          win: 1871,
          winRate: 51.69,
        },
      ],
      runes: {
        id: 8008,
        pickRate: 0.35,
        play: 45358,
        primaryPageId: 8000,
        primaryPageName: '精密',
        primaryRuneIds: [
          8008,
          8009,
          9103,
          8014,
        ],
        primaryRuneNames: [
          '致命节奏',
          '气定神闲',
          '传说：血统',
          '致命一击',
        ],
        secondaryPageId: 8300,
        secondaryPageName: '启迪',
        secondaryRuneIds: [
          8304,
          8345,
        ],
        secondaryRuneNames: [
          '神奇之鞋',
          '饼干配送',
        ],
        statModIds: [
          5005,
          5008,
          5001,
        ],
        statModNames: [
          5005,
          5008,
          5001,
        ],
        win: 21446,
        winRate: 47.28,
      },
      strongCounters: [
        {
          championId: 42,
          championName: '英勇投弹手',
          play: 1038,
          win: 546,
          winRate: 53,
        },
        {
          championId: 804,
          championName: '不破之誓',
          play: 3056,
          win: 1540,
          winRate: 50,
        },
        {
          championId: 523,
          championName: '残月之肃',
          play: 2358,
          win: 1180,
          winRate: 50,
        },
      ],
      weakCounters: [
        {
          championId: 901,
          championName: '炽炎雏龙',
          play: 11791,
          win: 5122,
          winRate: 57,
        },
        {
          championId: 895,
          championName: '不羁之悦',
          play: 530,
          win: 236,
          winRate: 55,
        },
        {
          championId: 67,
          championName: '暗夜猎手',
          play: 2800,
          win: 1284,
          winRate: 54,
        },
      ],
      summonerSpells: {
        ids: [
          4,
          21,
        ],
        idsNames: [
          4,
          21,
        ],
        pickRate: 0.92,
        play: 117367,
        win: 56147,
        winRate: 47.84,
      },
    },
  },
  {
    championKey: 'kaisa',
    championName: '虚空之女',
    href: '/zh-cn/lol/champions/kaisa/build/adc?region=kr&tier=diamond_plus',
    position: 'adc',
    champion: 'KAISA',
    data: {
      summary: {
        averageStats: {
          banRate: 2,
          kda: 2.34,
          pickRate: 12,
          play: 4254738,
          rank: 113,
          tier: 3,
          winRate: 48,
          tierData: {
            rank: 113,
            rankPrev: 113,
            rankPrevPatch: 92,
            tier: 3,
          },
        },
      },
      coreItems: {
        ids: [
          6672,
          3124,
          2510,
        ],
        idsNames: [
          '海妖杀手',
          '鬼索的狂暴之刃',
          '黄昏与黎明',
        ],
        pickRate: 0.28,
        play: 17627,
        win: 9242,
        winRate: 52.43,
      },
      boots: {
        ids: [
          3006,
        ],
        idsNames: [
          '狂战士胫甲',
        ],
        pickRate: 0.91,
        play: 67512,
        win: 32721,
        winRate: 48.47,
      },
      fourthItems: [
        {
          ids: [
            3157,
          ],
          idsNames: [
            '中娅沙漏',
          ],
          pickRate: 0.46,
          play: 19740,
          win: 10508,
          winRate: 53.23,
        },
        {
          ids: [
            3031,
          ],
          idsNames: [
            '无尽之刃',
          ],
          pickRate: 0.08,
          play: 3531,
          win: 2029,
          winRate: 57.46,
        },
        {
          ids: [
            2510,
          ],
          idsNames: [
            '黄昏与黎明',
          ],
          pickRate: 0.08,
          play: 3295,
          win: 1862,
          winRate: 56.51,
        },
      ],
      fifthItems: [
        {
          ids: [
            3089,
          ],
          idsNames: [
            '灭世者的死亡之帽',
          ],
          pickRate: 0.25,
          play: 4759,
          win: 2524,
          winRate: 53.04,
        },
        {
          ids: [
            3157,
          ],
          idsNames: [
            '中娅沙漏',
          ],
          pickRate: 0.17,
          play: 3345,
          win: 1851,
          winRate: 55.34,
        },
        {
          ids: [
            3302,
          ],
          idsNames: [
            '界弓',
          ],
          pickRate: 0.08,
          play: 1488,
          win: 769,
          winRate: 51.68,
        },
      ],
      runes: {
        id: 8008,
        pickRate: 0.43,
        play: 34471,
        primaryPageId: 8000,
        primaryPageName: '精密',
        primaryRuneIds: [
          8008,
          8009,
          9103,
          8014,
        ],
        primaryRuneNames: [
          '致命节奏',
          '气定神闲',
          '传说：血统',
          '致命一击',
        ],
        secondaryPageId: 8300,
        secondaryPageName: '启迪',
        secondaryRuneIds: [
          8304,
          8345,
        ],
        secondaryRuneNames: [
          '神奇之鞋',
          '饼干配送',
        ],
        statModIds: [
          5005,
          5008,
          5001,
        ],
        statModNames: [
          5005,
          5008,
          5001,
        ],
        win: 16544,
        winRate: 47.99,
      },
      strongCounters: [
        {
          championId: 42,
          championName: '英勇投弹手',
          play: 661,
          win: 342,
          winRate: 52,
        },
        {
          championId: 81,
          championName: '探险家',
          play: 9151,
          win: 4699,
          winRate: 51,
        },
        {
          championId: 202,
          championName: '戏命师',
          play: 5105,
          win: 2617,
          winRate: 51,
        },
      ],
      weakCounters: [
        {
          championId: 901,
          championName: '炽炎雏龙',
          play: 8234,
          win: 3590,
          winRate: 56,
        },
        {
          championId: 22,
          championName: '寒冰射手',
          play: 4659,
          win: 2108,
          winRate: 55,
        },
        {
          championId: 360,
          championName: '沙漠玫瑰',
          play: 1603,
          win: 726,
          winRate: 55,
        },
      ],
      summonerSpells: {
        ids: [
          4,
          21,
        ],
        idsNames: [
          4,
          21,
        ],
        pickRate: 0.9,
        play: 72755,
        win: 35196,
        winRate: 48.38,
      },
    },
  },
  {
    championKey: 'leesin',
    championName: '盲僧',
    href: '/zh-cn/lol/champions/leesin/build/jungle?region=kr&tier=diamond_plus',
    position: 'jungle',
    champion: 'LEE_SIN',
    data: {
      summary: {
        averageStats: {
          banRate: 18,
          kda: 3.01,
          pickRate: 15,
          play: 5273847,
          rank: 5,
          tier: 1,
          winRate: 51,
          tierData: {
            rank: 5,
            rankPrev: 5,
            rankPrevPatch: 21,
            tier: 1,
          },
        },
      },
      coreItems: {
        ids: [
          6692,
          6610,
          6333,
        ],
        idsNames: [
          '星蚀',
          '焚天',
          '死亡之舞',
        ],
        pickRate: 0.24,
        play: 15502,
        win: 8918,
        winRate: 57.53,
      },
      boots: {
        ids: [
          3047,
        ],
        idsNames: [
          '铁板靴',
        ],
        pickRate: 0.5,
        play: 43494,
        win: 22528,
        winRate: 51.8,
      },
      fourthItems: [
        {
          ids: [
            3026,
          ],
          idsNames: [
            '守护天使',
          ],
          pickRate: 0.31,
          play: 9297,
          win: 5917,
          winRate: 63.64,
        },
        {
          ids: [
            6333,
          ],
          idsNames: [
            '死亡之舞',
          ],
          pickRate: 0.19,
          play: 5820,
          win: 3337,
          winRate: 57.34,
        },
        {
          ids: [
            3156,
          ],
          idsNames: [
            '玛莫提乌斯之噬',
          ],
          pickRate: 0.11,
          play: 3176,
          win: 1763,
          winRate: 55.51,
        },
      ],
      fifthItems: [
        {
          ids: [
            3026,
          ],
          idsNames: [
            '守护天使',
          ],
          pickRate: 0.33,
          play: 2351,
          win: 1440,
          winRate: 61.25,
        },
        {
          ids: [
            6333,
          ],
          idsNames: [
            '死亡之舞',
          ],
          pickRate: 0.1,
          play: 699,
          win: 419,
          winRate: 59.94,
        },
        {
          ids: [
            3053,
          ],
          idsNames: [
            '斯特拉克的挑战护手',
          ],
          pickRate: 0.09,
          play: 645,
          win: 404,
          winRate: 62.64,
        },
      ],
      runes: {
        id: 8010,
        pickRate: 0.62,
        play: 62720,
        primaryPageId: 8000,
        primaryPageName: '精密',
        primaryRuneIds: [
          8010,
          9111,
          9104,
          8014,
        ],
        primaryRuneNames: [
          '征服者',
          '凯旋',
          '传说：欢欣',
          '致命一击',
        ],
        secondaryPageId: 8300,
        secondaryPageName: '启迪',
        secondaryRuneIds: [
          8304,
          8347,
        ],
        secondaryRuneNames: [
          '神奇之鞋',
          '星界洞悉',
        ],
        statModIds: [
          5005,
          5008,
          5001,
        ],
        statModNames: [
          5005,
          5008,
          5001,
        ],
        win: 32244,
        winRate: 51.41,
      },
      strongCounters: [
        {
          championId: 133,
          championName: '德玛西亚之翼',
          play: 844,
          win: 496,
          winRate: 59,
        },
        {
          championId: 24,
          championName: '武器大师',
          play: 647,
          win: 360,
          winRate: 56,
        },
        {
          championId: 238,
          championName: '影流之主',
          play: 1229,
          win: 671,
          winRate: 55,
        },
      ],
      weakCounters: [
        {
          championId: 421,
          championName: '虚空遁地兽',
          play: 1411,
          win: 648,
          winRate: 54,
        },
        {
          championId: 200,
          championName: '虚空女皇',
          play: 675,
          win: 312,
          winRate: 54,
        },
        {
          championId: 427,
          championName: '翠神',
          play: 529,
          win: 242,
          winRate: 54,
        },
      ],
      summonerSpells: {
        ids: [
          4,
          11,
        ],
        idsNames: [
          4,
          11,
        ],
        pickRate: 1,
        play: 100098,
        win: 51285,
        winRate: 51.23,
      },
    },
  },
  {
    championKey: 'mordekaiser',
    championName: '铁铠冥魂',
    href: '/zh-cn/lol/champions/mordekaiser/build/top?region=kr&tier=diamond_plus',
    position: 'top',
    champion: 'MORDEKAISER',
    data: {
      summary: {
        averageStats: {
          banRate: 7,
          kda: 1.75,
          pickRate: 6,
          play: 1953301,
          rank: 117,
          tier: 3,
          winRate: 49,
          tierData: {
            rank: 117,
            rankPrev: 117,
            rankPrevPatch: 53,
            tier: 3,
          },
        },
      },
      coreItems: {
        ids: [
          3116,
          4633,
          6653,
        ],
        idsNames: [
          '瑞莱的冰晶节杖',
          '裂隙制造者',
          '兰德里的折磨',
        ],
        pickRate: 0.11,
        play: 2527,
        win: 1375,
        winRate: 54.41,
      },
      boots: {
        ids: [
          3047,
        ],
        idsNames: [
          '铁板靴',
        ],
        pickRate: 0.62,
        play: 20311,
        win: 10013,
        winRate: 49.3,
      },
      fourthItems: [
        {
          ids: [
            3065,
          ],
          idsNames: [
            '振奋盔甲',
          ],
          pickRate: 0.21,
          play: 2500,
          win: 1451,
          winRate: 58.04,
        },
        {
          ids: [
            3075,
          ],
          idsNames: [
            '荆棘之甲',
          ],
          pickRate: 0.18,
          play: 2087,
          win: 1140,
          winRate: 54.62,
        },
        {
          ids: [
            3157,
          ],
          idsNames: [
            '中娅沙漏',
          ],
          pickRate: 0.14,
          play: 1601,
          win: 930,
          winRate: 58.09,
        },
      ],
      fifthItems: [
        {
          ids: [
            3075,
          ],
          idsNames: [
            '荆棘之甲',
          ],
          pickRate: 0.16,
          play: 586,
          win: 324,
          winRate: 55.29,
        },
        {
          ids: [
            3065,
          ],
          idsNames: [
            '振奋盔甲',
          ],
          pickRate: 0.15,
          play: 545,
          win: 308,
          winRate: 56.51,
        },
        {
          ids: [
            6665,
          ],
          idsNames: [
            '千变者贾修',
          ],
          pickRate: 0.13,
          play: 468,
          win: 254,
          winRate: 54.27,
        },
      ],
      runes: {
        id: 8010,
        pickRate: 0.47,
        play: 16889,
        primaryPageId: 8000,
        primaryPageName: '精密',
        primaryRuneIds: [
          8010,
          9111,
          9105,
          8299,
        ],
        primaryRuneNames: [
          '征服者',
          '凯旋',
          '传说：急速',
          '坚毅不倒',
        ],
        secondaryPageId: 8400,
        secondaryPageName: '坚决',
        secondaryRuneIds: [
          8453,
          8473,
        ],
        secondaryRuneNames: [
          '复苏',
          '骸骨镀层',
        ],
        statModIds: [
          5005,
          5008,
          5001,
        ],
        statModNames: [
          5005,
          5008,
          5001,
        ],
        win: 8248,
        winRate: 48.84,
      },
      strongCounters: [
        {
          championId: 420,
          championName: '海兽祭司',
          play: 510,
          win: 272,
          winRate: 53,
        },
        {
          championId: 17,
          championName: '迅捷斥候',
          play: 908,
          win: 469,
          winRate: 52,
        },
        {
          championId: 875,
          championName: '腕豪',
          play: 834,
          win: 436,
          winRate: 52,
        },
      ],
      weakCounters: [
        {
          championId: 67,
          championName: '暗夜猎手',
          play: 569,
          win: 251,
          winRate: 56,
        },
        {
          championId: 777,
          championName: '封魔剑魂',
          play: 771,
          win: 351,
          winRate: 54,
        },
        {
          championId: 799,
          championName: '铁血狼母',
          play: 553,
          win: 253,
          winRate: 54,
        },
      ],
      summonerSpells: {
        ids: [
          4,
          14,
        ],
        idsNames: [
          4,
          14,
        ],
        pickRate: 0.73,
        play: 26318,
        win: 13119,
        winRate: 49.85,
      },
    },
  },
  {
    championKey: 'nautilus',
    championName: '深海泰坦',
    href: '/zh-cn/lol/champions/nautilus/build/support?region=kr&tier=diamond_plus',
    position: 'support',
    champion: 'NAUTILUS',
    data: {
      summary: {
        averageStats: {
          banRate: 13,
          kda: 2.42,
          pickRate: 9,
          play: 3289556,
          rank: 69,
          tier: 3,
          winRate: 50,
          tierData: {
            rank: 69,
            rankPrev: 69,
            rankPrevPatch: 61,
            tier: 3,
          },
        },
      },
      coreItems: {
        ids: [
          3190,
          2524,
          3109,
        ],
        idsNames: [
          '钢铁烈阳之匣',
          '班德尔音管',
          '骑士之誓',
        ],
        pickRate: 0.11,
        play: 2055,
        win: 1242,
        winRate: 60.44,
      },
      boots: {
        ids: [
          3047,
        ],
        idsNames: [
          '铁板靴',
        ],
        pickRate: 0.6,
        play: 35498,
        win: 17732,
        winRate: 49.95,
      },
      fourthItems: [
        {
          ids: [
            2525,
          ],
          idsNames: [
            '原生质护带',
          ],
          pickRate: 0.21,
          play: 656,
          win: 394,
          winRate: 60.06,
        },
        {
          ids: [
            3075,
          ],
          idsNames: [
            '荆棘之甲',
          ],
          pickRate: 0.19,
          play: 570,
          win: 313,
          winRate: 54.91,
        },
        {
          ids: [
            3109,
          ],
          idsNames: [
            '骑士之誓',
          ],
          pickRate: 0.14,
          play: 418,
          win: 233,
          winRate: 55.74,
        },
      ],
      fifthItems: [
        {
          ids: [
            3110,
          ],
          idsNames: [
            '冰霜之心',
          ],
          pickRate: 0.27,
          play: 12,
          win: 4,
          winRate: 33.33,
        },
        {
          ids: [
            2504,
          ],
          idsNames: [
            '败魔',
          ],
          pickRate: 0.11,
          play: 5,
          win: 1,
          winRate: 20,
        },
        {
          ids: [
            3075,
          ],
          idsNames: [
            '荆棘之甲',
          ],
          pickRate: 0.11,
          play: 5,
          win: 2,
          winRate: 40,
        },
      ],
      runes: {
        id: 8439,
        pickRate: 0.31,
        play: 19894,
        primaryPageId: 8400,
        primaryPageName: '坚决',
        primaryRuneIds: [
          8439,
          8401,
          8473,
          8242,
        ],
        primaryRuneNames: [
          '余震',
          '护盾猛击',
          '骸骨镀层',
          '坚定',
        ],
        secondaryPageId: 8300,
        secondaryPageName: '启迪',
        secondaryRuneIds: [
          8345,
          8347,
        ],
        secondaryRuneNames: [
          '饼干配送',
          '星界洞悉',
        ],
        statModIds: [
          5007,
          5001,
          5001,
        ],
        statModNames: [
          5007,
          5001,
          5001,
        ],
        win: 9768,
        winRate: 49.1,
      },
      strongCounters: [
        {
          championId: 350,
          championName: '魔法猫咪',
          play: 1478,
          win: 814,
          winRate: 55,
        },
        {
          championId: 101,
          championName: '远古巫灵',
          play: 883,
          win: 478,
          winRate: 54,
        },
        {
          championId: 43,
          championName: '天启者',
          play: 3177,
          win: 1670,
          winRate: 53,
        },
      ],
      weakCounters: [
        {
          championId: 526,
          championName: '镕铁少女',
          play: 1268,
          win: 561,
          winRate: 56,
        },
        {
          championId: 201,
          championName: '弗雷尔卓德之心',
          play: 2793,
          win: 1267,
          winRate: 55,
        },
        {
          championId: 89,
          championName: '曙光女神',
          play: 2024,
          win: 915,
          winRate: 55,
        },
      ],
      summonerSpells: {
        ids: [
          4,
          14,
        ],
        idsNames: [
          4,
          14,
        ],
        pickRate: 0.75,
        play: 48465,
        win: 23998,
        winRate: 49.52,
      },
    },
  },
  {
    championKey: 'syndra',
    championName: '暗黑元首',
    href: '/zh-cn/lol/champions/syndra/build/mid?region=kr&tier=diamond_plus',
    position: 'mid',
    champion: 'SYNDRA',
    data: {
      summary: {
        averageStats: {
          banRate: 2,
          kda: 2.13,
          pickRate: 4,
          play: 1556334,
          rank: 109,
          tier: 3,
          winRate: 50,
          tierData: {
            rank: 109,
            rankPrev: 109,
            rankPrevPatch: 108,
            tier: 3,
          },
        },
      },
      coreItems: {
        ids: [
          6655,
          4645,
          3089,
        ],
        idsNames: [
          '卢登的回声',
          '影焰',
          '灭世者的死亡之帽',
        ],
        pickRate: 0.25,
        play: 4724,
        win: 2551,
        winRate: 54,
      },
      boots: {
        ids: [
          3020,
        ],
        idsNames: [
          '法师之靴',
        ],
        pickRate: 0.69,
        play: 18609,
        win: 9371,
        winRate: 50.36,
      },
      fourthItems: [
        {
          ids: [
            3157,
          ],
          idsNames: [
            '中娅沙漏',
          ],
          pickRate: 0.31,
          play: 2975,
          win: 1712,
          winRate: 57.55,
        },
        {
          ids: [
            3089,
          ],
          idsNames: [
            '灭世者的死亡之帽',
          ],
          pickRate: 0.25,
          play: 2460,
          win: 1396,
          winRate: 56.75,
        },
        {
          ids: [
            3135,
          ],
          idsNames: [
            '虚空之杖',
          ],
          pickRate: 0.16,
          play: 1553,
          win: 818,
          winRate: 52.67,
        },
      ],
      fifthItems: [
        {
          ids: [
            3135,
          ],
          idsNames: [
            '虚空之杖',
          ],
          pickRate: 0.23,
          play: 756,
          win: 430,
          winRate: 56.88,
        },
        {
          ids: [
            3157,
          ],
          idsNames: [
            '中娅沙漏',
          ],
          pickRate: 0.2,
          play: 659,
          win: 376,
          winRate: 57.06,
        },
        {
          ids: [
            3102,
          ],
          idsNames: [
            '女妖面纱',
          ],
          pickRate: 0.12,
          play: 411,
          win: 221,
          winRate: 53.77,
        },
      ],
      runes: {
        id: 8369,
        pickRate: 0.25,
        play: 7341,
        primaryPageId: 8300,
        primaryPageName: '启迪',
        primaryRuneIds: [
          8369,
          8304,
          8345,
          8347,
        ],
        primaryRuneNames: [
          '先攻',
          '神奇之鞋',
          '饼干配送',
          '星界洞悉',
        ],
        secondaryPageId: 8200,
        secondaryPageName: '巫术',
        secondaryRuneIds: [
          8210,
          8226,
        ],
        secondaryRuneNames: [
          '超然',
          '法力流系带',
        ],
        statModIds: [
          5005,
          5008,
          5001,
        ],
        statModNames: [
          5005,
          5008,
          5001,
        ],
        win: 3611,
        winRate: 49.19,
      },
      strongCounters: [
        {
          championId: 777,
          championName: '封魔剑魂',
          play: 502,
          win: 284,
          winRate: 57,
        },
        {
          championId: 103,
          championName: '九尾妖狐',
          play: 1603,
          win: 826,
          winRate: 52,
        },
        {
          championId: 90,
          championName: '虚空先知',
          play: 800,
          win: 418,
          winRate: 52,
        },
      ],
      weakCounters: [
        {
          championId: 105,
          championName: '潮汐海灵',
          play: 726,
          win: 308,
          winRate: 58,
        },
        {
          championId: 55,
          championName: '不祥之刃',
          play: 719,
          win: 302,
          winRate: 58,
        },
        {
          championId: 127,
          championName: '冰霜女巫',
          play: 566,
          win: 250,
          winRate: 56,
        },
      ],
      summonerSpells: {
        ids: [
          4,
          12,
        ],
        idsNames: [
          4,
          12,
        ],
        pickRate: 0.79,
        play: 22819,
        win: 11293,
        winRate: 49.49,
      },
    },
  },
  {
    championKey: 'thresh',
    championName: '魂锁典狱长',
    href: '/zh-cn/lol/champions/thresh/build/support?region=kr&tier=diamond_plus',
    position: 'support',
    champion: 'THRESH',
    data: {
      summary: {
        averageStats: {
          banRate: 7,
          kda: 2.77,
          pickRate: 12,
          play: 4224297,
          rank: 6,
          tier: 1,
          winRate: 52,
          tierData: {
            rank: 6,
            rankPrev: 6,
            rankPrevPatch: 11,
            tier: 1,
          },
        },
      },
      coreItems: {
        ids: [
          3190,
          3050,
          3109,
        ],
        idsNames: [
          '钢铁烈阳之匣',
          '基克的聚合',
          '骑士之誓',
        ],
        pickRate: 0.09,
        play: 2923,
        win: 1725,
        winRate: 59.01,
      },
      boots: {
        ids: [
          3009,
        ],
        idsNames: [
          '轻灵之靴',
        ],
        pickRate: 0.6,
        play: 47272,
        win: 24958,
        winRate: 52.8,
      },
      fourthItems: [
        {
          ids: [
            3075,
          ],
          idsNames: [
            '荆棘之甲',
          ],
          pickRate: 0.24,
          play: 1589,
          win: 874,
          winRate: 55,
        },
        {
          ids: [
            3110,
          ],
          idsNames: [
            '冰霜之心',
          ],
          pickRate: 0.11,
          play: 764,
          win: 463,
          winRate: 60.6,
        },
        {
          ids: [
            3109,
          ],
          idsNames: [
            '骑士之誓',
          ],
          pickRate: 0.11,
          play: 734,
          win: 436,
          winRate: 59.4,
        },
      ],
      fifthItems: [
        {
          ids: [
            3107,
          ],
          idsNames: [
            '救赎',
          ],
          pickRate: 0.14,
          play: 11,
          win: 5,
          winRate: 45.45,
        },
        {
          ids: [
            3075,
          ],
          idsNames: [
            '荆棘之甲',
          ],
          pickRate: 0.13,
          play: 10,
          win: 3,
          winRate: 30,
        },
        {
          ids: [
            3110,
          ],
          idsNames: [
            '冰霜之心',
          ],
          pickRate: 0.11,
          play: 9,
          win: 4,
          winRate: 44.44,
        },
      ],
      runes: {
        id: 8439,
        pickRate: 0.28,
        play: 23482,
        primaryPageId: 8400,
        primaryPageName: '坚决',
        primaryRuneIds: [
          8439,
          8463,
          8473,
          8242,
        ],
        primaryRuneNames: [
          '余震',
          '生命源泉',
          '骸骨镀层',
          '坚定',
        ],
        secondaryPageId: 8300,
        secondaryPageName: '启迪',
        secondaryRuneIds: [
          8345,
          8347,
        ],
        secondaryRuneNames: [
          '饼干配送',
          '星界洞悉',
        ],
        statModIds: [
          5008,
          5008,
          5001,
        ],
        statModNames: [
          5008,
          5008,
          5001,
        ],
        win: 11985,
        winRate: 51.04,
      },
      strongCounters: [
        {
          championId: 800,
          championName: '流光镜影',
          play: 802,
          win: 447,
          winRate: 56,
        },
        {
          championId: 117,
          championName: '仙灵女巫',
          play: 3543,
          win: 1910,
          winRate: 54,
        },
        {
          championId: 111,
          championName: '深海泰坦',
          play: 3482,
          win: 1876,
          winRate: 54,
        },
      ],
      weakCounters: [
        {
          championId: 143,
          championName: '荆棘之兴',
          play: 860,
          win: 400,
          winRate: 53,
        },
        {
          championId: 147,
          championName: '星籁歌姬',
          play: 3937,
          win: 1874,
          winRate: 52,
        },
        {
          championId: 16,
          championName: '众星之子',
          play: 1855,
          win: 899,
          winRate: 52,
        },
      ],
      summonerSpells: {
        ids: [
          4,
          14,
        ],
        idsNames: [
          4,
          14,
        ],
        pickRate: 0.7,
        play: 59357,
        win: 30657,
        winRate: 51.65,
      },
    },
  },
] as OpggChampionDetail[]

export function getOpggKrHighEloChampionDetail(championKey: string) {
  return opggKrHighEloChampionDetails.find((detail) => detail.championKey === championKey)
}
