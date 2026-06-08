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
    champion: 'AHRI',
    position: 'mid',
    data: {
      summary: {
        averageStats: {
          banRate: 4,
          kda: 2.56,
          pickRate: 11,
          play: 226119,
          rank: 8,
          tier: 2,
          winRate: 51,
          tierData: {
            rank: 8,
            rankPrev: 8,
            rankPrevPatch: 10,
            tier: 2,
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
        pickRate: 0.12,
        play: 15008,
        win: 7828,
        winRate: 52.16,
      },
      boots: {
        ids: [
          3020,
        ],
        idsNames: [
          '法师之靴',
        ],
        pickRate: 0.54,
        play: 104919,
        win: 53646,
        winRate: 51.13,
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
          play: 15742,
          win: 9179,
          winRate: 58.31,
        },
        {
          ids: [
            3157,
          ],
          idsNames: [
            '中娅沙漏',
          ],
          pickRate: 0.26,
          play: 12791,
          win: 7438,
          winRate: 58.15,
        },
        {
          ids: [
            3135,
          ],
          idsNames: [
            '虚空之杖',
          ],
          pickRate: 0.08,
          play: 4182,
          win: 2205,
          winRate: 52.73,
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
          pickRate: 0.21,
          play: 2636,
          win: 1648,
          winRate: 62.52,
        },
        {
          ids: [
            3135,
          ],
          idsNames: [
            '虚空之杖',
          ],
          pickRate: 0.17,
          play: 2124,
          win: 1198,
          winRate: 56.4,
        },
        {
          ids: [
            3157,
          ],
          idsNames: [
            '中娅沙漏',
          ],
          pickRate: 0.16,
          play: 2094,
          win: 1267,
          winRate: 60.51,
        },
      ],
      runes: {
        id: 8112,
        pickRate: 0.51,
        play: 100648,
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
        win: 50605,
        winRate: 50.28,
      },
      strongCounters: [
        {
          championId: 901,
          championName: '炽炎雏龙',
          play: 469,
          win: 263,
          winRate: 56,
        },
        {
          championId: 777,
          championName: '封魔剑魂',
          play: 3938,
          win: 2179,
          winRate: 55,
        },
        {
          championId: 163,
          championName: '岩雀',
          play: 1563,
          win: 852,
          winRate: 55,
        },
      ],
      weakCounters: [
        {
          championId: 238,
          championName: '影流之主',
          play: 6388,
          win: 3063,
          winRate: 52,
        },
        {
          championId: 55,
          championName: '不祥之刃',
          play: 5799,
          win: 2793,
          winRate: 52,
        },
        {
          championId: 8,
          championName: '猩红收割者',
          play: 4222,
          win: 2036,
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
        play: 105431,
        win: 52751,
        winRate: 50.03,
      },
    },
  },
  {
    championKey: 'camille',
    championName: '青钢影',
    href: '/zh-cn/lol/champions/camille/build/top?region=kr&tier=diamond_plus',
    champion: 'CAMILLE',
    position: 'top',
    data: {
      summary: {
        averageStats: {
          banRate: 1,
          kda: 1.92,
          pickRate: 4,
          play: 82549,
          rank: 125,
          tier: 4,
          winRate: 50,
          tierData: {
            rank: 125,
            rankPrev: 126,
            rankPrevPatch: 112,
            tier: 4,
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
        pickRate: 0.33,
        play: 8604,
        win: 4975,
        winRate: 57.82,
      },
      boots: {
        ids: [
          3047,
        ],
        idsNames: [
          '铁板靴',
        ],
        pickRate: 0.6,
        play: 26792,
        win: 13676,
        winRate: 51.05,
      },
      fourthItems: [
        {
          ids: [
            6333,
          ],
          idsNames: [
            '死亡之舞',
          ],
          pickRate: 0.29,
          play: 2792,
          win: 1637,
          winRate: 58.63,
        },
        {
          ids: [
            3053,
          ],
          idsNames: [
            '斯特拉克的挑战护手',
          ],
          pickRate: 0.23,
          play: 2151,
          win: 1232,
          winRate: 57.28,
        },
        {
          ids: [
            3161,
          ],
          idsNames: [
            '朔极之矛',
          ],
          pickRate: 0.14,
          play: 1312,
          win: 809,
          winRate: 61.66,
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
          pickRate: 0.36,
          play: 835,
          win: 502,
          winRate: 60.12,
        },
        {
          ids: [
            3053,
          ],
          idsNames: [
            '斯特拉克的挑战护手',
          ],
          pickRate: 0.14,
          play: 331,
          win: 216,
          winRate: 65.26,
        },
        {
          ids: [
            6333,
          ],
          idsNames: [
            '死亡之舞',
          ],
          pickRate: 0.1,
          play: 233,
          win: 144,
          winRate: 61.8,
        },
      ],
      runes: {
        id: 8437,
        pickRate: 0.21,
        play: 10671,
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
        win: 5242,
        winRate: 49.12,
      },
      strongCounters: [
        {
          championId: 799,
          championName: '铁血狼母',
          play: 903,
          win: 498,
          winRate: 55,
        },
        {
          championId: 86,
          championName: '德玛西亚之力',
          play: 2723,
          win: 1465,
          winRate: 54,
        },
        {
          championId: 126,
          championName: '未来守护者',
          play: 1120,
          win: 608,
          winRate: 54,
        },
      ],
      weakCounters: [
        {
          championId: 98,
          championName: '暮光之眼',
          play: 888,
          win: 386,
          winRate: 57,
        },
        {
          championId: 13,
          championName: '符文法师',
          play: 133,
          win: 57,
          winRate: 57,
        },
        {
          championId: 69,
          championName: '魔蛇之拥',
          play: 129,
          win: 57,
          winRate: 56,
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
        pickRate: 0.58,
        play: 28891,
        win: 14490,
        winRate: 50.15,
      },
    },
  },
  {
    championKey: 'draven',
    championName: '荣耀行刑官',
    href: '/zh-cn/lol/champions/draven/build/adc?region=kr&tier=diamond_plus',
    champion: 'DRAVEN',
    position: 'adc',
    data: {
      summary: {
        averageStats: {
          banRate: 13,
          kda: 1.93,
          pickRate: 4,
          play: 92097,
          rank: 153,
          tier: 5,
          winRate: 48,
          tierData: {
            rank: 153,
            rankPrev: 154,
            rankPrevPatch: 124,
            tier: 5,
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
        pickRate: 0.21,
        play: 13087,
        win: 7122,
        winRate: 54.42,
      },
      boots: {
        ids: [
          3006,
        ],
        idsNames: [
          '狂战士胫甲',
        ],
        pickRate: 0.47,
        play: 33696,
        win: 16497,
        winRate: 48.96,
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
          play: 15576,
          win: 9360,
          winRate: 60.09,
        },
        {
          ids: [
            3031,
          ],
          idsNames: [
            '无尽之刃',
          ],
          pickRate: 0.18,
          play: 7388,
          win: 4248,
          winRate: 57.5,
        },
        {
          ids: [
            3033,
          ],
          idsNames: [
            '凡性的提醒',
          ],
          pickRate: 0.11,
          play: 4315,
          win: 2290,
          winRate: 53.07,
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
          pickRate: 0.18,
          play: 3688,
          win: 2184,
          winRate: 59.22,
        },
        {
          ids: [
            3094,
          ],
          idsNames: [
            '疾射火炮',
          ],
          pickRate: 0.17,
          play: 3344,
          win: 1989,
          winRate: 59.48,
        },
        {
          ids: [
            3072,
          ],
          idsNames: [
            '饮血剑',
          ],
          pickRate: 0.13,
          play: 2628,
          win: 1559,
          winRate: 59.32,
        },
      ],
      runes: {
        id: 8008,
        pickRate: 0.23,
        play: 18104,
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
        win: 8560,
        winRate: 47.28,
      },
      strongCounters: [
        {
          championId: 429,
          championName: '复仇之矛',
          play: 538,
          win: 294,
          winRate: 55,
        },
        {
          championId: 145,
          championName: '虚空之女',
          play: 3243,
          win: 1713,
          winRate: 53,
        },
        {
          championId: 136,
          championName: '铸星龙王',
          play: 210,
          win: 112,
          winRate: 53,
        },
      ],
      weakCounters: [
        {
          championId: 161,
          championName: '虚空之眼',
          play: 401,
          win: 156,
          winRate: 61,
        },
        {
          championId: 17,
          championName: '迅捷斥候',
          play: 127,
          win: 53,
          winRate: 58,
        },
        {
          championId: 235,
          championName: '涤魂圣枪',
          play: 2611,
          win: 1145,
          winRate: 56,
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
        pickRate: 0.85,
        play: 67180,
        win: 32953,
        winRate: 49.05,
      },
    },
  },
  {
    championKey: 'ezreal',
    championName: '探险家',
    href: '/zh-cn/lol/champions/ezreal/build/adc?region=kr&tier=diamond_plus',
    champion: 'EZREAL',
    position: 'adc',
    data: {
      summary: {
        averageStats: {
          banRate: 9,
          kda: 2.38,
          pickRate: 19,
          play: 396524,
          rank: 85,
          tier: 4,
          winRate: 47,
          tierData: {
            rank: 85,
            rankPrev: 84,
            rankPrevPatch: 88,
            tier: 4,
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
        pickRate: 0.4,
        play: 100189,
        win: 53889,
        winRate: 53.79,
      },
      boots: {
        ids: [
          3158,
        ],
        idsNames: [
          '明朗之靴',
        ],
        pickRate: 0.7,
        play: 221034,
        win: 105610,
        winRate: 47.78,
      },
      fourthItems: [
        {
          ids: [
            3161,
          ],
          idsNames: [
            '朔极之矛',
          ],
          pickRate: 0.33,
          play: 47891,
          win: 25642,
          winRate: 53.54,
        },
        {
          ids: [
            6694,
          ],
          idsNames: [
            '赛瑞尔达的怨恨',
          ],
          pickRate: 0.29,
          play: 42233,
          win: 21836,
          winRate: 51.7,
        },
        {
          ids: [
            2517,
          ],
          idsNames: [
            '无穷饥渴',
          ],
          pickRate: 0.17,
          play: 24459,
          win: 13238,
          winRate: 54.12,
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
          pickRate: 0.3,
          play: 17341,
          win: 9091,
          winRate: 52.42,
        },
        {
          ids: [
            3110,
          ],
          idsNames: [
            '冰霜之心',
          ],
          pickRate: 0.16,
          play: 9403,
          win: 4866,
          winRate: 51.75,
        },
        {
          ids: [
            2517,
          ],
          idsNames: [
            '无穷饥渴',
          ],
          pickRate: 0.14,
          play: 8312,
          win: 4339,
          winRate: 52.2,
        },
      ],
      runes: {
        id: 8008,
        pickRate: 0.36,
        play: 121330,
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
        win: 56995,
        winRate: 46.98,
      },
      strongCounters: [
        {
          championId: 42,
          championName: '英勇投弹手',
          play: 2084,
          win: 1062,
          winRate: 51,
        },
        {
          championId: 51,
          championName: '皮城女警',
          play: 27159,
          win: 13575,
          winRate: 50,
        },
        {
          championId: 804,
          championName: '不破之誓',
          play: 7352,
          win: 3698,
          winRate: 50,
        },
      ],
      weakCounters: [
        {
          championId: 157,
          championName: '疾风剑豪',
          play: 1434,
          win: 591,
          winRate: 59,
        },
        {
          championId: 101,
          championName: '远古巫灵',
          play: 1373,
          win: 596,
          winRate: 57,
        },
        {
          championId: 161,
          championName: '虚空之眼',
          play: 1180,
          win: 510,
          winRate: 57,
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
        pickRate: 0.91,
        play: 300560,
        win: 143107,
        winRate: 47.61,
      },
    },
  },
  {
    championKey: 'kaisa',
    championName: '虚空之女',
    href: '/zh-cn/lol/champions/kaisa/build/adc?region=kr&tier=diamond_plus',
    champion: 'KAISA',
    position: 'adc',
    data: {
      summary: {
        averageStats: {
          banRate: 1,
          kda: 2.36,
          pickRate: 13,
          play: 275517,
          rank: 77,
          tier: 3,
          winRate: 49,
          tierData: {
            rank: 77,
            rankPrev: 76,
            rankPrevPatch: 117,
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
        pickRate: 0.26,
        play: 49941,
        win: 26151,
        winRate: 52.36,
      },
      boots: {
        ids: [
          3006,
        ],
        idsNames: [
          '狂战士胫甲',
        ],
        pickRate: 0.9,
        play: 204666,
        win: 99904,
        winRate: 48.81,
      },
      fourthItems: [
        {
          ids: [
            3157,
          ],
          idsNames: [
            '中娅沙漏',
          ],
          pickRate: 0.43,
          play: 51724,
          win: 27807,
          winRate: 53.76,
        },
        {
          ids: [
            3031,
          ],
          idsNames: [
            '无尽之刃',
          ],
          pickRate: 0.1,
          play: 11722,
          win: 6702,
          winRate: 57.17,
        },
        {
          ids: [
            3115,
          ],
          idsNames: [
            '纳什之牙',
          ],
          pickRate: 0.08,
          play: 10197,
          win: 5744,
          winRate: 56.33,
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
          pickRate: 0.19,
          play: 10264,
          win: 5528,
          winRate: 53.86,
        },
        {
          ids: [
            3157,
          ],
          idsNames: [
            '中娅沙漏',
          ],
          pickRate: 0.18,
          play: 9624,
          win: 5225,
          winRate: 54.29,
        },
        {
          ids: [
            4645,
          ],
          idsNames: [
            '影焰',
          ],
          pickRate: 0.11,
          play: 5773,
          win: 3067,
          winRate: 53.13,
        },
      ],
      runes: {
        id: 8008,
        pickRate: 0.42,
        play: 101459,
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
        win: 48626,
        winRate: 47.93,
      },
      strongCounters: [
        {
          championId: 81,
          championName: '探险家',
          play: 25515,
          win: 13184,
          winRate: 52,
        },
        {
          championId: 202,
          championName: '戏命师',
          play: 16546,
          win: 8578,
          winRate: 52,
        },
        {
          championId: 115,
          championName: '爆破鬼才',
          play: 1618,
          win: 840,
          winRate: 52,
        },
      ],
      weakCounters: [
        {
          championId: 895,
          championName: '不羁之悦',
          play: 1260,
          win: 535,
          winRate: 58,
        },
        {
          championId: 50,
          championName: '诺克萨斯统领',
          play: 1327,
          win: 572,
          winRate: 57,
        },
        {
          championId: 45,
          championName: '邪恶小法师',
          play: 779,
          win: 338,
          winRate: 57,
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
        play: 210098,
        win: 102494,
        winRate: 48.78,
      },
    },
  },
  {
    championKey: 'leesin',
    championName: '盲僧',
    href: '/zh-cn/lol/champions/leesin/build/jungle?region=kr&tier=diamond_plus',
    champion: 'LEE_SIN',
    position: 'jungle',
    data: {
      summary: {
        averageStats: {
          banRate: 22,
          kda: 2.97,
          pickRate: 16,
          play: 336018,
          rank: 7,
          tier: 2,
          winRate: 50,
          tierData: {
            rank: 7,
            rankPrev: 7,
            rankPrevPatch: 7,
            tier: 2,
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
        play: 44927,
        win: 25175,
        winRate: 56.04,
      },
      boots: {
        ids: [
          3047,
        ],
        idsNames: [
          '铁板靴',
        ],
        pickRate: 0.5,
        play: 127641,
        win: 64194,
        winRate: 50.29,
      },
      fourthItems: [
        {
          ids: [
            3026,
          ],
          idsNames: [
            '守护天使',
          ],
          pickRate: 0.32,
          play: 24973,
          win: 15602,
          winRate: 62.48,
        },
        {
          ids: [
            6333,
          ],
          idsNames: [
            '死亡之舞',
          ],
          pickRate: 0.2,
          play: 15657,
          win: 9011,
          winRate: 57.55,
        },
        {
          ids: [
            3156,
          ],
          idsNames: [
            '玛莫提乌斯之噬',
          ],
          pickRate: 0.12,
          play: 9225,
          win: 5068,
          winRate: 54.94,
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
          pickRate: 0.34,
          play: 6310,
          win: 3751,
          winRate: 59.45,
        },
        {
          ids: [
            6333,
          ],
          idsNames: [
            '死亡之舞',
          ],
          pickRate: 0.1,
          play: 1919,
          win: 1076,
          winRate: 56.07,
        },
        {
          ids: [
            3053,
          ],
          idsNames: [
            '斯特拉克的挑战护手',
          ],
          pickRate: 0.09,
          play: 1691,
          win: 971,
          winRate: 57.42,
        },
      ],
      runes: {
        id: 8010,
        pickRate: 0.61,
        play: 175920,
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
        win: 88836,
        winRate: 50.5,
      },
      strongCounters: [
        {
          championId: 54,
          championName: '熔岩巨兽',
          play: 651,
          win: 373,
          winRate: 57,
        },
        {
          championId: 238,
          championName: '影流之主',
          play: 3032,
          win: 1707,
          winRate: 56,
        },
        {
          championId: 799,
          championName: '铁血狼母',
          play: 2372,
          win: 1299,
          winRate: 55,
        },
      ],
      weakCounters: [
        {
          championId: 33,
          championName: '披甲龙龟',
          play: 1600,
          win: 741,
          winRate: 54,
        },
        {
          championId: 950,
          championName: '百裂冥犬',
          play: 8310,
          win: 3938,
          winRate: 53,
        },
        {
          championId: 233,
          championName: '狂厄蔷薇',
          play: 5033,
          win: 2378,
          winRate: 53,
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
        play: 281222,
        win: 141291,
        winRate: 50.24,
      },
    },
  },
  {
    championKey: 'mordekaiser',
    championName: '铁铠冥魂',
    href: '/zh-cn/lol/champions/mordekaiser/build/top?region=kr&tier=diamond_plus',
    champion: 'MORDEKAISER',
    position: 'top',
    data: {
      summary: {
        averageStats: {
          banRate: 7,
          kda: 1.77,
          pickRate: 5,
          play: 108461,
          rank: 141,
          tier: 4,
          winRate: 49,
          tierData: {
            rank: 141,
            rankPrev: 143,
            rankPrevPatch: 119,
            tier: 4,
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
        pickRate: 0.12,
        play: 6522,
        win: 3651,
        winRate: 55.98,
      },
      boots: {
        ids: [
          3047,
        ],
        idsNames: [
          '铁板靴',
        ],
        pickRate: 0.61,
        play: 52260,
        win: 25404,
        winRate: 48.61,
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
          play: 5608,
          win: 3237,
          winRate: 57.72,
        },
        {
          ids: [
            3075,
          ],
          idsNames: [
            '荆棘之甲',
          ],
          pickRate: 0.18,
          play: 4915,
          win: 2685,
          winRate: 54.63,
        },
        {
          ids: [
            3157,
          ],
          idsNames: [
            '中娅沙漏',
          ],
          pickRate: 0.13,
          play: 3611,
          win: 2062,
          winRate: 57.1,
        },
      ],
      fifthItems: [
        {
          ids: [
            3065,
          ],
          idsNames: [
            '振奋盔甲',
          ],
          pickRate: 0.17,
          play: 1397,
          win: 800,
          winRate: 57.27,
        },
        {
          ids: [
            3075,
          ],
          idsNames: [
            '荆棘之甲',
          ],
          pickRate: 0.14,
          play: 1179,
          win: 633,
          winRate: 53.69,
        },
        {
          ids: [
            6665,
          ],
          idsNames: [
            '千变者贾修',
          ],
          pickRate: 0.13,
          play: 1105,
          win: 629,
          winRate: 56.92,
        },
      ],
      runes: {
        id: 8010,
        pickRate: 0.48,
        play: 43056,
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
        win: 20814,
        winRate: 48.34,
      },
      strongCounters: [
        {
          championId: 4,
          championName: '卡牌大师',
          play: 164,
          win: 92,
          winRate: 56,
        },
        {
          championId: 77,
          championName: '兽灵行者',
          play: 216,
          win: 119,
          winRate: 55,
        },
        {
          championId: 54,
          championName: '熔岩巨兽',
          play: 3511,
          win: 1886,
          winRate: 54,
        },
      ],
      weakCounters: [
        {
          championId: 84,
          championName: '离群之刺',
          play: 865,
          win: 366,
          winRate: 58,
        },
        {
          championId: 19,
          championName: '祖安怒兽',
          play: 745,
          win: 322,
          winRate: 57,
        },
        {
          championId: 23,
          championName: '蛮族之王',
          play: 1045,
          win: 462,
          winRate: 56,
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
        pickRate: 0.72,
        play: 63799,
        win: 31562,
        winRate: 49.47,
      },
    },
  },
  {
    championKey: 'nautilus',
    championName: '深海泰坦',
    href: '/zh-cn/lol/champions/nautilus/build/support?region=kr&tier=diamond_plus',
    champion: 'NAUTILUS',
    position: 'support',
    data: {
      summary: {
        averageStats: {
          banRate: 14,
          kda: 2.47,
          pickRate: 11,
          play: 230480,
          rank: 21,
          tier: 3,
          winRate: 50,
          tierData: {
            rank: 21,
            rankPrev: 21,
            rankPrevPatch: 69,
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
        pickRate: 0.09,
        play: 5852,
        win: 3600,
        winRate: 61.52,
      },
      boots: {
        ids: [
          3047,
        ],
        idsNames: [
          '铁板靴',
        ],
        pickRate: 0.58,
        play: 112276,
        win: 56572,
        winRate: 50.39,
      },
      fourthItems: [
        {
          ids: [
            2525,
          ],
          idsNames: [
            '原生质护带',
          ],
          pickRate: 0.2,
          play: 1874,
          win: 1111,
          winRate: 59.28,
        },
        {
          ids: [
            3075,
          ],
          idsNames: [
            '荆棘之甲',
          ],
          pickRate: 0.2,
          play: 1834,
          win: 1067,
          winRate: 58.18,
        },
        {
          ids: [
            3109,
          ],
          idsNames: [
            '骑士之誓',
          ],
          pickRate: 0.13,
          play: 1156,
          win: 666,
          winRate: 57.61,
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
          pickRate: 0.17,
          play: 21,
          win: 9,
          winRate: 42.86,
        },
        {
          ids: [
            2525,
          ],
          idsNames: [
            '原生质护带',
          ],
          pickRate: 0.15,
          play: 18,
          win: 7,
          winRate: 38.89,
        },
        {
          ids: [
            2524,
          ],
          idsNames: [
            '班德尔音管',
          ],
          pickRate: 0.1,
          play: 12,
          win: 7,
          winRate: 58.33,
        },
      ],
      runes: {
        id: 8439,
        pickRate: 0.31,
        play: 63161,
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
        win: 31548,
        winRate: 49.95,
      },
      strongCounters: [
        {
          championId: 800,
          championName: '流光镜影',
          play: 1076,
          win: 654,
          winRate: 61,
        },
        {
          championId: 142,
          championName: '暮光星灵',
          play: 776,
          win: 431,
          winRate: 56,
        },
        {
          championId: 350,
          championName: '魔法猫咪',
          play: 4220,
          win: 2339,
          winRate: 55,
        },
      ],
      weakCounters: [
        {
          championId: 526,
          championName: '镕铁少女',
          play: 4757,
          win: 2144,
          winRate: 55,
        },
        {
          championId: 44,
          championName: '瓦洛兰之盾',
          play: 1399,
          win: 625,
          winRate: 55,
        },
        {
          championId: 89,
          championName: '曙光女神',
          play: 7863,
          win: 3586,
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
        play: 145592,
        win: 72755,
        winRate: 49.97,
      },
    },
  },
  {
    championKey: 'syndra',
    championName: '暗黑元首',
    href: '/zh-cn/lol/champions/syndra/build/mid?region=kr&tier=diamond_plus',
    champion: 'SYNDRA',
    position: 'mid',
    data: {
      summary: {
        averageStats: {
          banRate: 2,
          kda: 2.12,
          pickRate: 5,
          play: 95367,
          rank: 123,
          tier: 4,
          winRate: 49,
          tierData: {
            rank: 123,
            rankPrev: 124,
            rankPrevPatch: 109,
            tier: 4,
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
        play: 13320,
        win: 6977,
        winRate: 52.38,
      },
      boots: {
        ids: [
          3020,
        ],
        idsNames: [
          '法师之靴',
        ],
        pickRate: 0.68,
        play: 52265,
        win: 25909,
        winRate: 49.57,
      },
      fourthItems: [
        {
          ids: [
            3157,
          ],
          idsNames: [
            '中娅沙漏',
          ],
          pickRate: 0.3,
          play: 7441,
          win: 4121,
          winRate: 55.38,
        },
        {
          ids: [
            3089,
          ],
          idsNames: [
            '灭世者的死亡之帽',
          ],
          pickRate: 0.26,
          play: 6412,
          win: 3678,
          winRate: 57.36,
        },
        {
          ids: [
            3135,
          ],
          idsNames: [
            '虚空之杖',
          ],
          pickRate: 0.15,
          play: 3760,
          win: 1954,
          winRate: 51.97,
        },
      ],
      fifthItems: [
        {
          ids: [
            3157,
          ],
          idsNames: [
            '中娅沙漏',
          ],
          pickRate: 0.21,
          play: 1711,
          win: 948,
          winRate: 55.41,
        },
        {
          ids: [
            3135,
          ],
          idsNames: [
            '虚空之杖',
          ],
          pickRate: 0.21,
          play: 1701,
          win: 921,
          winRate: 54.14,
        },
        {
          ids: [
            3089,
          ],
          idsNames: [
            '灭世者的死亡之帽',
          ],
          pickRate: 0.12,
          play: 1004,
          win: 589,
          winRate: 58.67,
        },
      ],
      runes: {
        id: 8369,
        pickRate: 0.26,
        play: 20354,
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
        win: 9744,
        winRate: 47.87,
      },
      strongCounters: [
        {
          championId: 901,
          championName: '炽炎雏龙',
          play: 206,
          win: 131,
          winRate: 64,
        },
        {
          championId: 268,
          championName: '沙漠皇帝',
          play: 526,
          win: 306,
          winRate: 58,
        },
        {
          championId: 800,
          championName: '流光镜影',
          play: 1006,
          win: 567,
          winRate: 56,
        },
      ],
      weakCounters: [
        {
          championId: 55,
          championName: '不祥之刃',
          play: 2031,
          win: 892,
          winRate: 56,
        },
        {
          championId: 245,
          championName: '时间刺客',
          play: 1172,
          win: 521,
          winRate: 56,
        },
        {
          championId: 105,
          championName: '潮汐海灵',
          play: 2155,
          win: 966,
          winRate: 55,
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
        pickRate: 0.8,
        play: 62158,
        win: 30582,
        winRate: 49.2,
      },
    },
  },
  {
    championKey: 'thresh',
    championName: '魂锁典狱长',
    href: '/zh-cn/lol/champions/thresh/build/support?region=kr&tier=diamond_plus',
    champion: 'THRESH',
    position: 'support',
    data: {
      summary: {
        averageStats: {
          banRate: 8,
          kda: 2.82,
          pickRate: 13,
          play: 278790,
          rank: 2,
          tier: 1,
          winRate: 52,
          tierData: {
            rank: 2,
            rankPrev: 2,
            rankPrevPatch: 6,
            tier: 1,
          },
        },
      },
      coreItems: {
        ids: [
          3190,
          3109,
          3050,
        ],
        idsNames: [
          '钢铁烈阳之匣',
          '骑士之誓',
          '基克的聚合',
        ],
        pickRate: 0.1,
        play: 9477,
        win: 5632,
        winRate: 59.43,
      },
      boots: {
        ids: [
          3009,
        ],
        idsNames: [
          '轻灵之靴',
        ],
        pickRate: 0.6,
        play: 145580,
        win: 77268,
        winRate: 53.08,
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
          play: 4533,
          win: 2551,
          winRate: 56.28,
        },
        {
          ids: [
            2524,
          ],
          idsNames: [
            '班德尔音管',
          ],
          pickRate: 0.12,
          play: 2284,
          win: 1354,
          winRate: 59.28,
        },
        {
          ids: [
            3110,
          ],
          idsNames: [
            '冰霜之心',
          ],
          pickRate: 0.11,
          play: 2004,
          win: 1148,
          winRate: 57.29,
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
          pickRate: 0.15,
          play: 32,
          win: 16,
          winRate: 50,
        },
        {
          ids: [
            3107,
          ],
          idsNames: [
            '救赎',
          ],
          pickRate: 0.12,
          play: 26,
          win: 12,
          winRate: 46.15,
        },
        {
          ids: [
            2524,
          ],
          idsNames: [
            '班德尔音管',
          ],
          pickRate: 0.1,
          play: 21,
          win: 9,
          winRate: 42.86,
        },
      ],
      runes: {
        id: 8439,
        pickRate: 0.3,
        play: 76728,
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
        win: 39237,
        winRate: 51.14,
      },
      strongCounters: [
        {
          championId: 800,
          championName: '流光镜影',
          play: 2244,
          win: 1309,
          winRate: 58,
        },
        {
          championId: 350,
          championName: '魔法猫咪',
          play: 4734,
          win: 2715,
          winRate: 57,
        },
        {
          championId: 517,
          championName: '解脱者',
          play: 959,
          win: 537,
          winRate: 56,
        },
      ],
      weakCounters: [
        {
          championId: 60,
          championName: '蜘蛛女皇',
          play: 875,
          win: 420,
          winRate: 52,
        },
        {
          championId: 147,
          championName: '星籁歌姬',
          play: 11386,
          win: 5596,
          winRate: 51,
        },
        {
          championId: 89,
          championName: '曙光女神',
          play: 9196,
          win: 4534,
          winRate: 51,
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
        play: 173427,
        win: 89474,
        winRate: 51.59,
      },
    },
  },
] as OpggChampionDetail[]

export function getOpggKrHighEloChampionDetail(championKey: string) {
  return opggKrHighEloChampionDetails.find((detail) => detail.championKey === championKey)
}
