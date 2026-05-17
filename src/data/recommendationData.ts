import { itemCatalog } from './mockMatches'
import { getOpggKrHighEloChampionDetail, type OpggChampionDetail, type OpggItemSet } from './opggKrHighEloDetails'
import { getOpggKrHighEloChampionStat, opggKrHighEloMeta } from './opggKrHighEloStats'
import { getRuntimeOpggChampionDetail, getRuntimeOpggChampionDetailLabel } from '../services/opggChampionData'
import type { BuildRecommendation, Champion, Item, RecommendationDataMeta, RunePageRecommendation } from '../types'

export type ChampionBuildData = {
  meta?: RecommendationDataMeta
  title: string
  coreItems: Item[]
  stages: {
    label: string
    items: Item[]
    goal: string
  }[]
  loadouts: {
    id: string
    name: string
    scoreOffset: number
    style: string
    items: Item[]
    bestWhen: string
    tradeoff: string
    meta?: RecommendationDataMeta
  }[]
}

export type AugmentProfile = {
  tags: string[]
  plan: string
}

export type AugmentItemChain = {
  id: string
  label: string
  matchTags: string[]
  items: Item[]
}

const runeIcon = (path: string) => path
const rune = (id: string, name: string, icon: string) => ({ id, name, icon: runeIcon(icon) })

const runeIconById: Record<number, string> = {
  8008: 'perk-images/Styles/Precision/LethalTempo/LethalTempoTemp.png',
  8009: 'perk-images/Styles/Precision/PresenceOfMind/PresenceOfMind.png',
  8010: 'perk-images/Styles/Precision/Conqueror/Conqueror.png',
  8014: 'perk-images/Styles/Precision/CoupDeGrace/CoupDeGrace.png',
  8017: 'perk-images/Styles/Precision/CutDown/CutDown.png',
  8106: 'perk-images/Styles/Domination/UltimateHunter/UltimateHunter.png',
  8112: 'perk-images/Styles/Domination/Electrocute/Electrocute.png',
  8139: 'perk-images/Styles/Domination/TasteOfBlood/GreenTerror_TasteOfBlood.png',
  8140: 'perk-images/Styles/Domination/GrislyMementos/GrislyMementos.png',
  8210: 'perk-images/Styles/Sorcery/Transcendence/Transcendence.png',
  8226: 'perk-images/Styles/Sorcery/ManaflowBand/ManaflowBand.png',
  8242: 'perk-images/Styles/Resolve/Unflinching/Unflinching.png',
  8299: 'perk-images/Styles/Precision/LastStand/LastStand.png',
  8304: 'perk-images/Styles/Inspiration/MagicalFootwear/MagicalFootwear.png',
  8313: 'perk-images/Styles/Inspiration/TripleTonic/TripleTonic.png',
  8321: 'perk-images/Styles/Inspiration/CashBack/CashBack2.png',
  8345: 'perk-images/Styles/Inspiration/BiscuitDelivery/BiscuitDelivery.png',
  8347: 'perk-images/Styles/Inspiration/CosmicInsight/CosmicInsight.png',
  8369: 'perk-images/Styles/Inspiration/FirstStrike/FirstStrike.png',
  8401: 'perk-images/Styles/Resolve/MirrorShell/MirrorShell.png',
  8437: 'perk-images/Styles/Resolve/GraspOfTheUndying/GraspOfTheUndying.png',
  8439: 'perk-images/Styles/Resolve/VeteranAftershock/VeteranAftershock.png',
  8453: 'perk-images/Styles/Resolve/Revitalize/Revitalize.png',
  8463: 'perk-images/Styles/Resolve/FontOfLife/FontOfLife.png',
  8473: 'perk-images/Styles/Resolve/BonePlating/BonePlating.png',
  9103: 'perk-images/Styles/Precision/LegendBloodline/LegendBloodline.png',
  9104: 'perk-images/Styles/Precision/LegendAlacrity/LegendAlacrity.png',
  9105: 'perk-images/Styles/Precision/LegendHaste/LegendHaste.png',
  9111: 'perk-images/Styles/Precision/Triumph.png',
}

const itemByIconId = new Map(Object.values(itemCatalog).map((item) => [item.iconId, item]))

function itemFromOpgg(iconId: number, name: string): Item {
  return itemByIconId.get(iconId) ?? {
    id: `opgg-${iconId}`,
    iconId,
    name,
    category: 'core',
    tags: ['opgg'],
  }
}

function itemSetToItems(set: OpggItemSet) {
  return set.ids.map((id, index) => itemFromOpgg(id, String(set.idsNames[index] ?? id)))
}
const defaultOpggKrHighEloMeta: RecommendationDataMeta = {
  source: 'opgg-kr-high-elo',
  sourceLabel: opggKrHighEloMeta.sourceLabel,
  patch: opggKrHighEloMeta.patch,
  region: opggKrHighEloMeta.region,
  rank: opggKrHighEloMeta.rank,
  sampleSize: opggKrHighEloMeta.sampleSize,
  confidence: 'medium',
}

function getChampionRecommendationMeta(champion: Champion): RecommendationDataMeta {
  const detail = getRuntimeOpggChampionDetail(champion.id) ?? getOpggKrHighEloChampionDetail(champion.id)
  if (detail) return getOpggDetailMeta(champion.id, detail)

  const stat = getOpggKrHighEloChampionStat(champion.id)

  return {
    ...defaultOpggKrHighEloMeta,
    championRank: stat?.rank,
    counters: stat?.counters,
    pickRate: stat?.pickRate,
    sourceUrl: stat ? `https://op.gg${stat.href}` : opggKrHighEloMeta.sourceUrl,
    winRate: stat?.winRate,
  }
}

function getOpggDetailMeta(championId: string, detail: OpggChampionDetail): RecommendationDataMeta {
  const averageStats = detail.data.summary.averageStats

  return {
    ...defaultOpggKrHighEloMeta,
    championRank: averageStats.rank,
    counters: detail.data.strongCounters.map((counter) => ({
      championKey: String(counter.championId),
      championName: counter.championName,
    })),
    pickRate: averageStats.pickRate,
    sampleSize: averageStats.play,
    sourceLabel: getRuntimeOpggChampionDetailLabel(championId) ?? `${opggKrHighEloMeta.sourceLabel} · MCP缓存`,
    sourceUrl: `https://op.gg${detail.href}`,
    winRate: averageStats.winRate,
  }
}

function getOpggDetailBuildData(champion: Champion, detail: OpggChampionDetail): BuildRecommendation {
  const meta = getOpggDetailMeta(champion.id, detail)
  const coreItems = itemSetToItems(detail.data.coreItems)
  const fourthItems = detail.data.fourthItems.slice(0, 3)
  const fifthItems = detail.data.fifthItems.slice(0, 3)
  const primaryFourth = fourthItems[0] ? itemSetToItems(fourthItems[0]) : []
  const primaryFifth = fifthItems[0] ? itemSetToItems(fifthItems[0]) : []

  const loadouts = [
    {
      id: `${champion.id}-opgg-core`,
      name: 'OP.GG 核心装',
      score: Math.round(detail.data.coreItems.winRate),
      style: '核心成型',
      items: coreItems,
      bestWhen: `${detail.data.coreItems.play.toLocaleString('en-US')} 场样本，胜率 ${detail.data.coreItems.winRate.toFixed(2)}%。`,
      tradeoff: '来自 OP.GG 当前分段统计，先按版本主流曲线执行。',
      meta,
    },
    ...fourthItems.map((set, index) => ({
      id: `${champion.id}-opgg-fourth-${set.ids.join('-')}`,
      name: `第 4 件 · ${set.idsNames.join('/')}`,
      score: Math.round(set.winRate),
      style: index === 0 ? '优先补强' : '局势分支',
      items: [...coreItems, ...itemSetToItems(set)],
      bestWhen: `${set.play.toLocaleString('en-US')} 场样本，胜率 ${set.winRate.toFixed(2)}%。`,
      tradeoff: '根据本局抗性、威胁和经济节奏选择，不固定模板。',
      meta,
    })),
  ]

  return {
    meta,
    score: Math.round(detail.data.coreItems.winRate),
    title: `${detail.championName} OP.GG 版本路线`,
    coreItems,
    situationalItems: [...primaryFourth, ...primaryFifth],
    loadouts,
    stages: [
      {
        label: '核心',
        items: coreItems,
        goal: `${detail.data.coreItems.play.toLocaleString('en-US')} 场样本，胜率 ${detail.data.coreItems.winRate.toFixed(2)}%。`,
      },
      {
        label: '第 4 件',
        items: primaryFourth,
        goal: fourthItems[0]
          ? `${fourthItems[0].idsNames.join('/')} · 胜率 ${fourthItems[0].winRate.toFixed(2)}%。`
          : '等待更多样本。',
      },
      {
        label: '第 5 件',
        items: primaryFifth,
        goal: fifthItems[0]
          ? `${fifthItems[0].idsNames.join('/')} · 胜率 ${fifthItems[0].winRate.toFixed(2)}%。`
          : '等待更多样本。',
      },
    ],
    counterPlans: detail.data.strongCounters.map((counter, index) => ({
      trigger: `遇到 ${counter.championName}`,
      action: `OP.GG 对位样本 ${counter.play.toLocaleString('en-US')}，该英雄对你胜率 ${counter.winRate.toFixed(2)}%。`,
      priority: index + 1,
    })),
    warnings: [],
    explanation: '来自 OP.GG MCP 英雄明细缓存，优先使用当前英雄/位置的核心装和后续装备统计。',
    pivots: fifthItems.map((set) => `${set.idsNames.join('/')} · ${set.winRate.toFixed(2)}%`),
  }
}
const runePage = (
  id: string,
  name: string,
  style: string,
  score: number,
  primaryTree: string,
  secondaryTree: string,
  runes: ReturnType<typeof rune>[],
) => ({
  id,
  meta: defaultOpggKrHighEloMeta,
  name,
  style,
  score,
  primaryTree,
  secondaryTree,
  runes,
})

const conquerorResolveRunes = [
  rune('conqueror', '征服者', 'perk-images/Styles/Precision/Conqueror/Conqueror.png'),
  rune('presence', '气定神闲', 'perk-images/Styles/Precision/PresenceOfMind/PresenceOfMind.png'),
  rune('haste', '传说：急速', 'perk-images/Styles/Precision/LegendHaste/LegendHaste.png'),
  rune('last-stand', '坚毅不倒', 'perk-images/Styles/Precision/LastStand/LastStand.png'),
  rune('bone-plating', '骸骨镀层', 'perk-images/Styles/Resolve/BonePlating/BonePlating.png'),
  rune('unflinching', '坚定', 'perk-images/Styles/Resolve/Unflinching/Unflinching.png'),
]

const electrocuteSorceryRunes = [
  rune('electrocute', '电刑', 'perk-images/Styles/Domination/Electrocute/Electrocute.png'),
  rune('taste', '血之滋味', 'perk-images/Styles/Domination/TasteOfBlood/GreenTerror_TasteOfBlood.png'),
  rune('eyeball', '眼球收集器', 'perk-images/Styles/Domination/EyeballCollection/EyeballCollection.png'),
  rune('ultimate', '终极猎人', 'perk-images/Styles/Domination/UltimateHunter/UltimateHunter.png'),
  rune('manaflow', '法力流系带', 'perk-images/Styles/Sorcery/ManaflowBand/ManaflowBand.png'),
  rune('transcendence', '超然', 'perk-images/Styles/Sorcery/Transcendence/Transcendence.png'),
]

const aftershockInspirationRunes = [
  rune('aftershock', '余震', 'perk-images/Styles/Resolve/VeteranAftershock/VeteranAftershock.png'),
  rune('font', '生命源泉', 'perk-images/Styles/Resolve/FontOfLife/FontOfLife.png'),
  rune('bone-plating', '骸骨镀层', 'perk-images/Styles/Resolve/BonePlating/BonePlating.png'),
  rune('unflinching', '坚定', 'perk-images/Styles/Resolve/Unflinching/Unflinching.png'),
  rune('hexflash', '海克斯闪现罗网', 'perk-images/Styles/Inspiration/HextechFlashtraption/HextechFlashtraption.png'),
  rune('cosmic', '星界洞悉', 'perk-images/Styles/Inspiration/CosmicInsight/CosmicInsight.png'),
]

const hailDominationRunes = [
  rune('hail', '丛刃', 'perk-images/Styles/Domination/HailOfBlades/HailOfBlades.png'),
  rune('taste', '血之滋味', 'perk-images/Styles/Domination/TasteOfBlood/GreenTerror_TasteOfBlood.png'),
  rune('eyeball', '眼球收集器', 'perk-images/Styles/Domination/EyeballCollection/EyeballCollection.png'),
  rune('treasure', '寻宝猎人', 'perk-images/Styles/Domination/TreasureHunter/TreasureHunter.png'),
  rune('presence', '气定神闲', 'perk-images/Styles/Precision/PresenceOfMind/PresenceOfMind.png'),
  rune('bloodline', '传说：血统', 'perk-images/Styles/Precision/LegendBloodline/LegendBloodline.png'),
]

const buildDataByChampionId: Record<string, ChampionBuildData> = {
  ahri: {
    title: '冷却拉扯法强路线',
    coreItems: [itemCatalog.liandry, itemCatalog.zhonya],
    stages: [
      { label: '开局', items: [itemCatalog.liandry], goal: '先做持续伤害底座，避免只靠单次爆发。' },
      { label: '中期', items: [itemCatalog.zhonya], goal: '用金身吃掉突进回合，保留第二轮技能。' },
      { label: '后期', items: [itemCatalog.liandry, itemCatalog.zhonya, itemCatalog.mercs], goal: '围绕冷却和生存打连续收割。' },
    ],
    loadouts: [
      {
        id: 'ahri-kite',
        name: '冷却拉扯套',
        scoreOffset: 2,
        style: '稳定首选',
        items: [itemCatalog.liandry, itemCatalog.cosmic, itemCatalog.zhonya],
        bestWhen: '对面有前排或回合会拖长，需要第二轮技能继续收割。',
        tradeoff: '爆发没那么吓人，但胜在不容易一套打完开始逛街。',
      },
      {
        id: 'ahri-burst',
        name: '秒人开张套',
        scoreOffset: 0,
        style: '进攻压制',
        items: [itemCatalog.ludens, itemCatalog.rabadon, itemCatalog.voidStaff],
        bestWhen: '对面后排脆、魔抗少，我方需要你先把一个人点名下班。',
        tradeoff: '容错偏低，魅惑空了就先假装在等冷却。',
      },
      {
        id: 'ahri-safe',
        name: '保命反打套',
        scoreOffset: -1,
        style: '抗压容错',
        items: [itemCatalog.ludens, itemCatalog.zhonya, itemCatalog.banshee],
        bestWhen: '对面先手和 AP 爆发多，活着比多 80 点法强重要。',
        tradeoff: '伤害成型慢一点，但不容易被对面当提款机。',
      },
      {
        id: 'ahri-frontline',
        name: '打前排消耗套',
        scoreOffset: -2,
        style: '处理肉盾',
        items: [itemCatalog.liandry, itemCatalog.voidStaff, itemCatalog.cosmic],
        bestWhen: '前排站住河道，团前需要持续磨血而不是硬找后排。',
        tradeoff: '单点爆破感弱，适合慢慢把对面血条磨到想回城。',
      },
    ],
  },
  ezreal: {
    title: '魔切拉扯穿透路线',
    coreItems: [itemCatalog.manamune, itemCatalog.trinity, itemCatalog.serylda],
    stages: [
      { label: '开局', items: [itemCatalog.manamune], goal: '尽快叠魔切，保持安全补刀和 Q 消耗。' },
      { label: '两件套', items: [itemCatalog.manamune, itemCatalog.trinity], goal: '进入拉扯强势期，中路消耗逼资源。' },
      { label: '成型', items: [itemCatalog.manamune, itemCatalog.trinity, itemCatalog.serylda], goal: '补穿透处理前排，团前先打血线。' },
    ],
    loadouts: [
      {
        id: 'ezreal-standard',
        name: '魔切三相套',
        scoreOffset: 2,
        style: '稳定首选',
        items: [itemCatalog.manamune, itemCatalog.trinity, itemCatalog.serylda],
        bestWhen: '局势正常、能安全发育，两件套后开始接管中路线权。',
        tradeoff: '没有特别花，但胜在老实人也能赢。',
      },
      {
        id: 'ezreal-safe',
        name: '冰脉抗压套',
        scoreOffset: 0,
        style: '防突进',
        items: [itemCatalog.manamune, itemCatalog.iceborn, itemCatalog.serylda],
        bestWhen: '对面 AD 突脸和强开多，需要边退边打。',
        tradeoff: '爆发低一点，不过对面想摸到你会比较难受。',
      },
      {
        id: 'ezreal-haste',
        name: '技能急速套',
        scoreOffset: -1,
        style: '频繁拉扯',
        items: [itemCatalog.manamune, itemCatalog.shojin, itemCatalog.trinity],
        bestWhen: '需要频繁 Q 消耗和短冷却位移，围绕中路慢慢压血线。',
        tradeoff: '打坦速度一般，前排很肥时别硬装艺术家。',
      },
      {
        id: 'ezreal-tank',
        name: '前排处理套',
        scoreOffset: -2,
        style: '打肉专用',
        items: [itemCatalog.manamune, itemCatalog.bork, itemCatalog.serylda],
        bestWhen: '敌方双前排开始挡门，必须先把肉处理掉。',
        tradeoff: '对脆皮爆发不如三相路线，但打厚血条更讲道理。',
      },
    ],
  },
  camille: {
    title: '边线单带战士路线',
    coreItems: [itemCatalog.trinity, itemCatalog.shojin, itemCatalog.deathDance],
    stages: [
      { label: '开局', items: [itemCatalog.trinity], goal: '先拿三相成型，边线换血和拆塔节奏都更稳。' },
      { label: '中期', items: [itemCatalog.shojin, itemCatalog.deathDance], goal: '补技能急速和抗爆发，保证进场后还能拉出来。' },
      { label: '后期', items: [itemCatalog.trinity, itemCatalog.deathDance, itemCatalog.guardian], goal: '围绕侧翼进场和复活甲容错打后排。' },
    ],
    loadouts: [
      {
        id: 'camille-standard',
        name: '三相单带套',
        scoreOffset: 2,
        style: '单带首选',
        items: [itemCatalog.trinity, itemCatalog.shojin, itemCatalog.deathDance],
        bestWhen: '上路能带线牵制，需要你靠边线压力拉开地图。',
        tradeoff: '正面团第一时间没那么肉，进场角度要讲究。',
      },
      {
        id: 'camille-burst',
        name: '星蚀秒后排套',
        scoreOffset: 0,
        style: '切后排',
        items: [itemCatalog.eclipse, itemCatalog.blackCleaver, itemCatalog.guardian],
        bestWhen: '敌方后排没位移或闪现空窗，需要一脚把人锁死。',
        tradeoff: '持续单带略弱，打前排要等队友补伤害。',
      },
      {
        id: 'camille-safe',
        name: '护手抗压套',
        scoreOffset: -1,
        style: '容错抗压',
        items: [itemCatalog.trinity, itemCatalog.sterak, itemCatalog.deathDance],
        bestWhen: '对面强开多，进场后必须吃第一轮爆发。',
        tradeoff: '爆发慢一点，但更不容易切进去就蒸发。',
      },
    ],
  },
  leesin: {
    title: '前中期节奏打野路线',
    coreItems: [itemCatalog.eclipse, itemCatalog.blackCleaver, itemCatalog.deathDance],
    stages: [
      { label: '开局', items: [itemCatalog.eclipse], goal: '先保证小规模爆发和护盾，前 10 分钟多找人数差。' },
      { label: '中期', items: [itemCatalog.blackCleaver], goal: '补破甲和急速，帮队伍处理前排入口。' },
      { label: '后期', items: [itemCatalog.deathDance, itemCatalog.guardian], goal: '后期更多负责开团/踢回和第二条命容错。' },
    ],
    loadouts: [
      {
        id: 'leesin-tempo',
        name: '星蚀节奏套',
        scoreOffset: 2,
        style: '前期带节奏',
        items: [itemCatalog.eclipse, itemCatalog.blackCleaver, itemCatalog.deathDance],
        bestWhen: '前中期能频繁打小规模，队伍需要你主动找机会。',
        tradeoff: '拖到大后期输出会下滑，别把自己当纯 C。',
      },
      {
        id: 'leesin-peel',
        name: '黑切保排套',
        scoreOffset: 0,
        style: '开团保排',
        items: [itemCatalog.blackCleaver, itemCatalog.sterak, itemCatalog.guardian],
        bestWhen: '己方后排肥，对面刺客多，需要你踢走关键人。',
        tradeoff: '单杀味道淡一点，但团战工作更稳定。',
      },
      {
        id: 'leesin-antiburst',
        name: '死舞反打套',
        scoreOffset: -1,
        style: '抗爆反打',
        items: [itemCatalog.eclipse, itemCatalog.deathDance, itemCatalog.maw],
        bestWhen: '敌方 AP/AD 混合爆发都高，进场后要扛第一波。',
        tradeoff: '缺少纯输出峰值，适合把节奏交给队友收割。',
      },
    ],
  },
  kaisa: {
    title: '混伤进化射手路线',
    coreItems: [itemCatalog.kraken, itemCatalog.guinsoo, itemCatalog.nashor],
    stages: [
      { label: '开局', items: [itemCatalog.kraken], goal: '先拿稳定 DPS 底座，保证一件后小龙团输出。' },
      { label: '中期', items: [itemCatalog.guinsoo, itemCatalog.nashor], goal: '补攻速和混伤进化，扩大切前排能力。' },
      { label: '后期', items: [itemCatalog.guinsoo, itemCatalog.rabadon, itemCatalog.zhonya], goal: '后期根据进场压力选择爆发或金身容错。' },
    ],
    loadouts: [
      {
        id: 'kaisa-onhit',
        name: '海妖羊刀套',
        scoreOffset: 2,
        style: '持续输出',
        items: [itemCatalog.kraken, itemCatalog.guinsoo, itemCatalog.nashor],
        bestWhen: '前排多或团战会拖长，需要稳定打厚血条。',
        tradeoff: '单点秒人没那么夸张，但输出曲线很稳。',
      },
      {
        id: 'kaisa-ap',
        name: '纳什法强套',
        scoreOffset: 0,
        style: '混伤爆发',
        items: [itemCatalog.nashor, itemCatalog.rabadon, itemCatalog.zhonya],
        bestWhen: '敌方护甲高、魔抗少，或者需要你侧翼进场秒后排。',
        tradeoff: '成型更吃经济，前期别强行打艺术回合。',
      },
      {
        id: 'kaisa-safe',
        name: '保命收割套',
        scoreOffset: -1,
        style: '进场容错',
        items: [itemCatalog.kraken, itemCatalog.guinsoo, itemCatalog.guardian],
        bestWhen: '对面突进多，R 进去之后必须有第二条命。',
        tradeoff: '伤害峰值低一点，但不容易进场后直接黑屏。',
      },
    ],
  },
  nautilus: {
    title: '硬辅开团保护路线',
    coreItems: [itemCatalog.locket, itemCatalog.knightsVow, itemCatalog.zeke],
    stages: [
      { label: '开局', items: [itemCatalog.locket], goal: '优先补团队护盾，第一波小龙团容错更高。' },
      { label: '中期', items: [itemCatalog.knightsVow, itemCatalog.zeke], goal: '绑定核心输出，开团后让队友接伤害。' },
      { label: '后期', items: [itemCatalog.locket, itemCatalog.redemption, itemCatalog.knightsVow], goal: '围绕前排站位和群体保护打反开。' },
    ],
    loadouts: [
      {
        id: 'nautilus-engage',
        name: '烈阳开团套',
        scoreOffset: 2,
        style: '先手开团',
        items: [itemCatalog.locket, itemCatalog.zeke, itemCatalog.knightsVow],
        bestWhen: '我方需要稳定先手，且后排能跟上第一波控制。',
        tradeoff: '开空会很尴尬，视野没排干净不要硬钩。',
      },
      {
        id: 'nautilus-peel',
        name: '骑士保排套',
        scoreOffset: 0,
        style: '保护核心',
        items: [itemCatalog.knightsVow, itemCatalog.locket, itemCatalog.redemption],
        bestWhen: '己方 ADC 肥，对面刺客想直接切后排。',
        tradeoff: '主动性弱一点，但保护价值更稳定。',
      },
      {
        id: 'nautilus-antiap',
        name: '魔抗容错套',
        scoreOffset: -1,
        style: '抗 AP 爆发',
        items: [itemCatalog.locket, itemCatalog.mercs, itemCatalog.redemption],
        bestWhen: '敌方 AP 爆发和控制链多，团战需要你吃第一套。',
        tradeoff: '团队增伤少一些，更多是活着把控制打完。',
      },
    ],
  },
  syndra: {
    title: '中路爆发法师路线',
    coreItems: [itemCatalog.ludens, itemCatalog.rabadon, itemCatalog.voidStaff],
    stages: [
      { label: '开局', items: [itemCatalog.ludens], goal: '先拿清线和爆发底座，抢中路线权。' },
      { label: '中期', items: [itemCatalog.rabadon], goal: '两件后威胁后排血线，逼对手交防御资源。' },
      { label: '后期', items: [itemCatalog.voidStaff, itemCatalog.zhonya], goal: '补穿透和保命，避免被突进一换一。' },
    ],
    loadouts: [
      {
        id: 'syndra-burst',
        name: '卢登帽子套',
        scoreOffset: 2,
        style: '秒人压制',
        items: [itemCatalog.ludens, itemCatalog.rabadon, itemCatalog.voidStaff],
        bestWhen: '敌方后排脆，队伍需要你先把一个人压出战场。',
        tradeoff: '容错偏低，被开到之前要站在控制范围外。',
      },
      {
        id: 'syndra-safe',
        name: '金身防切套',
        scoreOffset: 0,
        style: '防突进',
        items: [itemCatalog.ludens, itemCatalog.zhonya, itemCatalog.rabadon],
        bestWhen: '对面蔚、盲僧、刺客多，团战会直接冲你。',
        tradeoff: '帽子时间略后，但能多活一个技能循环。',
      },
      {
        id: 'syndra-tank',
        name: '穿透打前排套',
        scoreOffset: -1,
        style: '处理魔抗',
        items: [itemCatalog.ludens, itemCatalog.voidStaff, itemCatalog.banshee],
        bestWhen: '敌方前排先补魔抗，后排暂时摸不到。',
        tradeoff: '秒脆皮爽感弱一点，但更能稳定破局。',
      },
    ],
  },
  draven: {
    title: '下路滚雪球暴击路线',
    coreItems: [itemCatalog.collector, itemCatalog.infinityEdge, itemCatalog.bloodthirster],
    stages: [
      { label: '开局', items: [itemCatalog.collector], goal: '尽快兑现提款节奏，第一波优势要转经济。' },
      { label: '中期', items: [itemCatalog.infinityEdge], goal: '暴击峰值成型后围绕中路和小龙团接管。' },
      { label: '后期', items: [itemCatalog.bloodthirster, itemCatalog.lordDominik], goal: '补吸血和穿甲，避免被前排拖住。' },
    ],
    loadouts: [
      {
        id: 'draven-snowball',
        name: '收集者提款套',
        scoreOffset: 2,
        style: '滚雪球',
        items: [itemCatalog.collector, itemCatalog.infinityEdge, itemCatalog.bloodthirster],
        bestWhen: '下路有线权，辅助能帮你开到提款机会。',
        tradeoff: '劣势局很难受，别为了斧头硬吃控制。',
      },
      {
        id: 'draven-safe',
        name: '饮血续航套',
        scoreOffset: 0,
        style: '抗压续航',
        items: [itemCatalog.bloodthirster, itemCatalog.infinityEdge, itemCatalog.guardian],
        bestWhen: '对面消耗多，需要靠护盾和吸血撑住对线。',
        tradeoff: '提款启动慢一些，但不容易被打回家。',
      },
      {
        id: 'draven-frontline',
        name: '穿甲打肉套',
        scoreOffset: -1,
        style: '处理前排',
        items: [itemCatalog.collector, itemCatalog.lordDominik, itemCatalog.infinityEdge],
        bestWhen: '敌方双前排挡门，必须先把肉削掉。',
        tradeoff: '续航少一点，站位要更保守。',
      },
    ],
  },
  thresh: {
    title: '钩子开团保护路线',
    coreItems: [itemCatalog.locket, itemCatalog.knightsVow, itemCatalog.zeke],
    stages: [
      { label: '开局', items: [itemCatalog.locket], goal: '先补团队护盾，让第一波资源团能吃住反打。' },
      { label: '中期', items: [itemCatalog.zeke], goal: '配合钩子和厄运钟摆打第一轮集火。' },
      { label: '后期', items: [itemCatalog.knightsVow, itemCatalog.redemption], goal: '灯笼和保护装围绕核心输出打容错。' },
    ],
    loadouts: [
      {
        id: 'thresh-pick',
        name: '基克抓机会套',
        scoreOffset: 2,
        style: '找钩开点',
        items: [itemCatalog.locket, itemCatalog.zeke, itemCatalog.knightsVow],
        bestWhen: '视野领先，能通过钩子先手抓掉边线或河道目标。',
        tradeoff: '钩空就别硬装开团，等下一波视野。',
      },
      {
        id: 'thresh-peel',
        name: '骑士灯笼套',
        scoreOffset: 0,
        style: '保排反开',
        items: [itemCatalog.knightsVow, itemCatalog.locket, itemCatalog.redemption],
        bestWhen: '己方 ADC 是核心，对面突进会直冲后排。',
        tradeoff: '进攻性少一些，但救人价值更高。',
      },
      {
        id: 'thresh-teamfight',
        name: '救赎团战套',
        scoreOffset: -1,
        style: '团战续航',
        items: [itemCatalog.locket, itemCatalog.redemption, itemCatalog.zeke],
        bestWhen: '正面 5v5 多，队伍需要多一层群体回复和护盾。',
        tradeoff: '单点保护不如骑士之誓稳定。',
      },
    ],
  },
  mordekaiser: {
    title: '法坦单挑前排路线',
    coreItems: [itemCatalog.riftmaker, itemCatalog.rylais, itemCatalog.jaksho],
    stages: [
      { label: '开局', items: [itemCatalog.riftmaker], goal: '先拿持续作战能力，对拼越久越有价值。' },
      { label: '中期', items: [itemCatalog.rylais], goal: '补减速黏人，保证大招里能持续输出。' },
      { label: '后期', items: [itemCatalog.jaksho, itemCatalog.zhonya], goal: '团战吃第一轮伤害，关键时刻用金身拖冷却。' },
    ],
    loadouts: [
      {
        id: 'mordekaiser-bruiser',
        name: '峡谷冰杖套',
        scoreOffset: 2,
        style: '持续单挑',
        items: [itemCatalog.riftmaker, itemCatalog.rylais, itemCatalog.jaksho],
        bestWhen: '需要你大招关掉一个核心，或者边线处理战士。',
        tradeoff: '爆发慢热，别在没叠起来前硬追太深。',
      },
      {
        id: 'mordekaiser-burn',
        name: '灼烧打肉套',
        scoreOffset: 0,
        style: '处理前排',
        items: [itemCatalog.liandry, itemCatalog.rylais, itemCatalog.voidStaff],
        bestWhen: '敌方前排多，团战会长时间拉扯。',
        tradeoff: '坦度下降，需要更小心被集火。',
      },
      {
        id: 'mordekaiser-safe',
        name: '贾修容错套',
        scoreOffset: -1,
        style: '抗压团战',
        items: [itemCatalog.jaksho, itemCatalog.riftmaker, itemCatalog.zhonya],
        bestWhen: '对面爆发高，你需要先活下来再开领域。',
        tradeoff: '单杀速度慢一点，但正面更耐打。',
      },
    ],
  },
}

const runeDataByChampionId: Record<string, RunePageRecommendation[]> = {
  ahri: [
    {
      id: 'ahri-electrocute',
      name: '电刑爆发页',
      style: '版本强势',
      score: 92,
      primaryTree: '主宰',
      secondaryTree: '巫术',
      runes: [
        { id: 'electrocute', name: '电刑', icon: runeIcon('perk-images/Styles/Domination/Electrocute/Electrocute.png') },
        { id: 'taste', name: '血之滋味', icon: runeIcon('perk-images/Styles/Domination/TasteOfBlood/GreenTerror_TasteOfBlood.png') },
        { id: 'eyeball', name: '眼球收集器', icon: runeIcon('perk-images/Styles/Domination/EyeballCollection/EyeballCollection.png') },
        { id: 'ultimate', name: '终极猎人', icon: runeIcon('perk-images/Styles/Domination/UltimateHunter/UltimateHunter.png') },
        { id: 'manaflow', name: '法力流系带', icon: runeIcon('perk-images/Styles/Sorcery/ManaflowBand/ManaflowBand.png') },
        { id: 'transcendence', name: '超然', icon: runeIcon('perk-images/Styles/Sorcery/Transcendence/Transcendence.png') },
      ],
    },
    {
      id: 'ahri-aery',
      name: '艾黎消耗页',
      style: '高容错',
      score: 89,
      primaryTree: '巫术',
      secondaryTree: '启迪',
      runes: [
        { id: 'aery', name: '召唤：艾黎', icon: runeIcon('perk-images/Styles/Sorcery/SummonAery/SummonAery.png') },
        { id: 'manaflow', name: '法力流系带', icon: runeIcon('perk-images/Styles/Sorcery/ManaflowBand/ManaflowBand.png') },
        { id: 'transcendence', name: '超然', icon: runeIcon('perk-images/Styles/Sorcery/Transcendence/Transcendence.png') },
        { id: 'scorch', name: '焦灼', icon: runeIcon('perk-images/Styles/Sorcery/Scorch/Scorch.png') },
        { id: 'footwear', name: '神奇之鞋', icon: runeIcon('perk-images/Styles/Inspiration/MagicalFootwear/MagicalFootwear.png') },
        { id: 'cosmic', name: '星界洞悉', icon: runeIcon('perk-images/Styles/Inspiration/CosmicInsight/CosmicInsight.png') },
      ],
    },
  ],
  ezreal: [
    {
      id: 'ezreal-pta',
      name: '强攻魔切页',
      style: '版本强势',
      score: 94,
      primaryTree: '精密',
      secondaryTree: '启迪',
      runes: [
        { id: 'pta', name: '强攻', icon: runeIcon('perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png') },
        { id: 'presence', name: '气定神闲', icon: runeIcon('perk-images/Styles/Precision/PresenceOfMind/PresenceOfMind.png') },
        { id: 'bloodline', name: '传说：血统', icon: runeIcon('perk-images/Styles/Precision/LegendBloodline/LegendBloodline.png') },
        { id: 'coup', name: '致命一击', icon: runeIcon('perk-images/Styles/Precision/CoupDeGrace/CoupDeGrace.png') },
        { id: 'footwear', name: '神奇之鞋', icon: runeIcon('perk-images/Styles/Inspiration/MagicalFootwear/MagicalFootwear.png') },
        { id: 'biscuit', name: '饼干配送', icon: runeIcon('perk-images/Styles/Inspiration/BiscuitDelivery/BiscuitDelivery.png') },
      ],
    },
    {
      id: 'ezreal-first-strike',
      name: '先攻发育页',
      style: '经济滚动',
      score: 91,
      primaryTree: '启迪',
      secondaryTree: '巫术',
      runes: [
        { id: 'first-strike', name: '先攻', icon: runeIcon('perk-images/Styles/Inspiration/FirstStrike/FirstStrike.png') },
        { id: 'footwear', name: '神奇之鞋', icon: runeIcon('perk-images/Styles/Inspiration/MagicalFootwear/MagicalFootwear.png') },
        { id: 'biscuit', name: '饼干配送', icon: runeIcon('perk-images/Styles/Inspiration/BiscuitDelivery/BiscuitDelivery.png') },
        { id: 'cosmic', name: '星界洞悉', icon: runeIcon('perk-images/Styles/Inspiration/CosmicInsight/CosmicInsight.png') },
        { id: 'manaflow', name: '法力流系带', icon: runeIcon('perk-images/Styles/Sorcery/ManaflowBand/ManaflowBand.png') },
        { id: 'transcendence', name: '超然', icon: runeIcon('perk-images/Styles/Sorcery/Transcendence/Transcendence.png') },
      ],
    },
    {
      id: 'ezreal-conqueror',
      name: '征服者持续页',
      style: '拉扯对拼',
      score: 88,
      primaryTree: '精密',
      secondaryTree: '巫术',
      runes: [
        { id: 'conqueror', name: '征服者', icon: runeIcon('perk-images/Styles/Precision/Conqueror/Conqueror.png') },
        { id: 'presence', name: '气定神闲', icon: runeIcon('perk-images/Styles/Precision/PresenceOfMind/PresenceOfMind.png') },
        { id: 'haste', name: '传说：急速', icon: runeIcon('perk-images/Styles/Precision/LegendHaste/LegendHaste.png') },
        { id: 'cutdown', name: '砍倒', icon: runeIcon('perk-images/Styles/Precision/CutDown/CutDown.png') },
        { id: 'manaflow', name: '法力流系带', icon: runeIcon('perk-images/Styles/Sorcery/ManaflowBand/ManaflowBand.png') },
        { id: 'transcendence', name: '超然', icon: runeIcon('perk-images/Styles/Sorcery/Transcendence/Transcendence.png') },
      ],
    },
  ],
  camille: [
    runePage('camille-grasp', '不灭单带页', '边线换血', 92, '坚决', '启迪', [
      rune('grasp', '不灭之握', 'perk-images/Styles/Resolve/GraspOfTheUndying/GraspOfTheUndying.png'),
      rune('shield-bash', '护盾猛击', 'perk-images/Styles/Resolve/MirrorShell/MirrorShell.png'),
      rune('bone-plating', '骸骨镀层', 'perk-images/Styles/Resolve/BonePlating/BonePlating.png'),
      rune('overgrowth', '过度生长', 'perk-images/Styles/Resolve/Overgrowth/Overgrowth.png'),
      rune('footwear', '神奇之鞋', 'perk-images/Styles/Inspiration/MagicalFootwear/MagicalFootwear.png'),
      rune('biscuit', '饼干配送', 'perk-images/Styles/Inspiration/BiscuitDelivery/BiscuitDelivery.png'),
    ]),
    runePage('camille-conqueror', '征服者持续页', '长线对拼', 89, '精密', '坚决', conquerorResolveRunes),
  ],
  leesin: [
    runePage('leesin-conqueror', '征服者节奏页', '小规模团', 93, '精密', '启迪', [
      rune('conqueror', '征服者', 'perk-images/Styles/Precision/Conqueror/Conqueror.png'),
      rune('triumph', '凯旋', 'perk-images/Styles/Precision/Triumph.png'),
      rune('haste', '传说：急速', 'perk-images/Styles/Precision/LegendHaste/LegendHaste.png'),
      rune('coup', '致命一击', 'perk-images/Styles/Precision/CoupDeGrace/CoupDeGrace.png'),
      rune('footwear', '神奇之鞋', 'perk-images/Styles/Inspiration/MagicalFootwear/MagicalFootwear.png'),
      rune('cosmic', '星界洞悉', 'perk-images/Styles/Inspiration/CosmicInsight/CosmicInsight.png'),
    ]),
    runePage('leesin-electrocute', '电刑爆发页', '前期抓人', 88, '主宰', '精密', [
      rune('electrocute', '电刑', 'perk-images/Styles/Domination/Electrocute/Electrocute.png'),
      rune('sudden', '猛然冲击', 'perk-images/Styles/Domination/SuddenImpact/SuddenImpact.png'),
      rune('eyeball', '眼球收集器', 'perk-images/Styles/Domination/EyeballCollection/EyeballCollection.png'),
      rune('relentless', '无情猎手', 'perk-images/Styles/Domination/RelentlessHunter/RelentlessHunter.png'),
      rune('triumph', '凯旋', 'perk-images/Styles/Precision/Triumph.png'),
      rune('coup', '致命一击', 'perk-images/Styles/Precision/CoupDeGrace/CoupDeGrace.png'),
    ]),
  ],
  kaisa: [
    runePage('kaisa-hail', '丛刃进化页', '爆发启动', 93, '主宰', '精密', hailDominationRunes),
    runePage('kaisa-pta', '强攻持续页', '打前排', 90, '精密', '启迪', [
      rune('pta', '强攻', 'perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png'),
      rune('presence', '气定神闲', 'perk-images/Styles/Precision/PresenceOfMind/PresenceOfMind.png'),
      rune('bloodline', '传说：血统', 'perk-images/Styles/Precision/LegendBloodline/LegendBloodline.png'),
      rune('cutdown', '砍倒', 'perk-images/Styles/Precision/CutDown/CutDown.png'),
      rune('footwear', '神奇之鞋', 'perk-images/Styles/Inspiration/MagicalFootwear/MagicalFootwear.png'),
      rune('biscuit', '饼干配送', 'perk-images/Styles/Inspiration/BiscuitDelivery/BiscuitDelivery.png'),
    ]),
  ],
  nautilus: [
    runePage('nautilus-aftershock', '余震开团页', '稳定先手', 92, '坚决', '启迪', aftershockInspirationRunes),
    runePage('nautilus-guardian', '守护者保排页', '保护核心', 87, '坚决', '启迪', [
      rune('guardian', '守护者', 'perk-images/Styles/Resolve/Guardian/Guardian.png'),
      rune('font', '生命源泉', 'perk-images/Styles/Resolve/FontOfLife/FontOfLife.png'),
      rune('bone-plating', '骸骨镀层', 'perk-images/Styles/Resolve/BonePlating/BonePlating.png'),
      rune('revitalize', '复苏', 'perk-images/Styles/Resolve/Revitalize/Revitalize.png'),
      rune('hexflash', '海克斯闪现罗网', 'perk-images/Styles/Inspiration/HextechFlashtraption/HextechFlashtraption.png'),
      rune('cosmic', '星界洞悉', 'perk-images/Styles/Inspiration/CosmicInsight/CosmicInsight.png'),
    ]),
  ],
  syndra: [
    runePage('syndra-electrocute', '电刑秒人页', '爆发压制', 92, '主宰', '巫术', electrocuteSorceryRunes),
    runePage('syndra-comet', '奥术彗星页', '消耗清线', 88, '巫术', '启迪', [
      rune('comet', '奥术彗星', 'perk-images/Styles/Sorcery/ArcaneComet/ArcaneComet.png'),
      rune('manaflow', '法力流系带', 'perk-images/Styles/Sorcery/ManaflowBand/ManaflowBand.png'),
      rune('transcendence', '超然', 'perk-images/Styles/Sorcery/Transcendence/Transcendence.png'),
      rune('scorch', '焦灼', 'perk-images/Styles/Sorcery/Scorch/Scorch.png'),
      rune('footwear', '神奇之鞋', 'perk-images/Styles/Inspiration/MagicalFootwear/MagicalFootwear.png'),
      rune('cosmic', '星界洞悉', 'perk-images/Styles/Inspiration/CosmicInsight/CosmicInsight.png'),
    ]),
  ],
  draven: [
    runePage('draven-hail', '丛刃提款页', '对线压制', 93, '主宰', '精密', hailDominationRunes),
    runePage('draven-pta', '强攻暴击页', '持续输出', 89, '精密', '主宰', [
      rune('pta', '强攻', 'perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png'),
      rune('triumph', '凯旋', 'perk-images/Styles/Precision/Triumph.png'),
      rune('bloodline', '传说：血统', 'perk-images/Styles/Precision/LegendBloodline/LegendBloodline.png'),
      rune('coup', '致命一击', 'perk-images/Styles/Precision/CoupDeGrace/CoupDeGrace.png'),
      rune('taste', '血之滋味', 'perk-images/Styles/Domination/TasteOfBlood/GreenTerror_TasteOfBlood.png'),
      rune('treasure', '寻宝猎人', 'perk-images/Styles/Domination/TreasureHunter/TreasureHunter.png'),
    ]),
  ],
  thresh: [
    runePage('thresh-aftershock', '余震找钩页', '开点控制', 91, '坚决', '启迪', aftershockInspirationRunes),
    runePage('thresh-guardian', '守护者灯笼页', '保排反开', 88, '坚决', '启迪', [
      rune('guardian', '守护者', 'perk-images/Styles/Resolve/Guardian/Guardian.png'),
      rune('font', '生命源泉', 'perk-images/Styles/Resolve/FontOfLife/FontOfLife.png'),
      rune('bone-plating', '骸骨镀层', 'perk-images/Styles/Resolve/BonePlating/BonePlating.png'),
      rune('revitalize', '复苏', 'perk-images/Styles/Resolve/Revitalize/Revitalize.png'),
      rune('hexflash', '海克斯闪现罗网', 'perk-images/Styles/Inspiration/HextechFlashtraption/HextechFlashtraption.png'),
      rune('cosmic', '星界洞悉', 'perk-images/Styles/Inspiration/CosmicInsight/CosmicInsight.png'),
    ]),
  ],
  mordekaiser: [
    runePage('mordekaiser-conqueror', '征服者法坦页', '持续单挑', 92, '精密', '坚决', conquerorResolveRunes),
    runePage('mordekaiser-phase', '相位拉扯页', '追击容错', 87, '巫术', '坚决', [
      rune('phase-rush', '相位猛冲', 'perk-images/Styles/Sorcery/PhaseRush/PhaseRush.png'),
      rune('nimbus', '灵光披风', 'perk-images/Styles/Sorcery/NimbusCloak/6361.png'),
      rune('celerity', '迅捷', 'perk-images/Styles/Sorcery/Celerity/CelerityTemp.png'),
      rune('waterwalking', '水上行走', 'perk-images/Styles/Sorcery/Waterwalking/Waterwalking.png'),
      rune('bone-plating', '骸骨镀层', 'perk-images/Styles/Resolve/BonePlating/BonePlating.png'),
      rune('revitalize', '复苏', 'perk-images/Styles/Resolve/Revitalize/Revitalize.png'),
    ]),
  ],
}

export const selectedAugmentProfiles: Record<string, AugmentProfile> = {
  法术苏醒: {
    tags: ['haste', 'cooldown', 'poke', 'mana'],
    plan: '冷却消耗链',
  },
  地震波: {
    tags: ['mobility', 'burst'],
    plan: '位移爆发链',
  },
  现象级邪恶: {
    tags: ['ap', 'scaling'],
    plan: '法强成长链',
  },
  主菜上桌: {
    tags: ['cooldown', 'pick'],
    plan: '关键技能命中链',
  },
}

export const augmentTagBridges: Record<string, string[]> = {
  haste: ['cooldown', 'poke', 'pick'],
  cooldown: ['haste', 'poke', 'pick', 'mobility'],
  poke: ['haste', 'cooldown', 'ap'],
  mana: ['poke', 'cooldown'],
  mobility: ['burst', 'cooldown', 'pick'],
  burst: ['mobility', 'ap', 'pick'],
  ap: ['burst', 'scaling', 'poke'],
  scaling: ['ap', 'defense'],
  defense: ['scaling', 'sustain'],
}

export const augmentItemChains: AugmentItemChain[] = [
  {
    id: 'safe-counter',
    label: '容错反打链',
    matchTags: ['defense'],
    items: [itemCatalog.ludens, itemCatalog.zhonya, itemCatalog.banshee],
  },
  {
    id: 'burst-entry',
    label: '爆发进场链',
    matchTags: ['burst', 'mobility'],
    items: [itemCatalog.ludens, itemCatalog.rabadon, itemCatalog.voidStaff],
  },
  {
    id: 'ap-scaling',
    label: '成长法强链',
    matchTags: ['scaling', 'ap'],
    items: [itemCatalog.liandry, itemCatalog.rabadon, itemCatalog.voidStaff],
  },
  {
    id: 'haste-poke',
    label: '冷却消耗链',
    matchTags: ['haste', 'cooldown', 'poke', 'mana'],
    items: [itemCatalog.liandry, itemCatalog.cosmic, itemCatalog.zhonya],
  },
]

const fallbackBuildData = buildDataByChampionId.ezreal

export function getChampionBuildData(champion: Champion) {
  const detail = getRuntimeOpggChampionDetail(champion.id) ?? getOpggKrHighEloChampionDetail(champion.id)
  if (detail) return getOpggDetailBuildData(champion, detail)

  const data = buildDataByChampionId[champion.id] ?? fallbackBuildData
  const meta = data.meta ?? getChampionRecommendationMeta(champion)

  return {
    ...data,
    meta,
    loadouts: data.loadouts.map((loadout) => ({
      ...loadout,
      meta: loadout.meta ?? meta,
    })),
  }
}

export function getChampionRunePages(champion: Champion) {
  const detail = getRuntimeOpggChampionDetail(champion.id) ?? getOpggKrHighEloChampionDetail(champion.id)
  if (detail) {
    const meta = getOpggDetailMeta(champion.id, detail)
    const runes = detail.data.runes
    const runeIds = [...runes.primaryRuneIds, ...runes.secondaryRuneIds]
    const runeNames = [...runes.primaryRuneNames, ...runes.secondaryRuneNames]

    return [
      {
        id: `${champion.id}-opgg-runes`,
        meta,
        name: `${runeNames[0] ?? '主系'}版本页`,
        primaryTree: runes.primaryPageName,
        runes: runeIds.map((id, index) => ({
          id: String(id),
          icon: runeIconById[id] ?? 'perk-images/Styles/RunesIcon.png',
          name: runeNames[index] ?? String(id),
        })),
        score: Math.round(runes.winRate),
        secondaryTree: runes.secondaryPageName,
        style: `${runes.play.toLocaleString('en-US')} 场 · ${runes.winRate.toFixed(2)}%`,
      },
    ]
  }

  const championMeta = getChampionRecommendationMeta(champion)

  return (runeDataByChampionId[champion.id] ?? runeDataByChampionId.ezreal).map((page) => ({
    ...page,
    meta: page.meta ?? championMeta,
  }))
}

export function getRecommendationDataMeta() {
  return defaultOpggKrHighEloMeta
}

export function listRecommendationChampionIds() {
  return Object.keys(buildDataByChampionId).sort()
}

export function getSelectedAugmentProfile(augmentName: string): AugmentProfile {
  return selectedAugmentProfiles[augmentName] ?? {
    tags: [augmentName.toLowerCase()],
    plan: '已选强化链',
  }
}
