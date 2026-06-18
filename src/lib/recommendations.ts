import { itemCatalog } from '../data/mockMatches'
import { mayhemSnapshot } from '../data/mayhemSnapshot'
import {
  augmentItemChains,
  augmentTagBridges,
  getChampionBuildData,
  getChampionRunePages,
  getSelectedAugmentProfile,
} from '../data/recommendationData'
import type { MayhemSnapshot } from '../features/mayhem/snapshot'
import { rankMayhemCandidates } from '../features/mayhem/scoring'
import type { MayhemRecommendationMode } from '../features/mayhem/types'
import type {
  AugmentRecommendation,
  BuildRecommendation,
  Champion,
  GameMode,
  Match,
  RecommendationViewModel,
} from '../types'

const uniqueById = <T extends { id: string }>(items: T[]) =>
  Array.from(new Map(items.map((item) => [item.id, item])).values())

function createAugmentItemPlan(match: Match, bestAugment?: AugmentRecommendation): RecommendationViewModel['live']['augmentContext']['itemPlan'] {
  const selectedTags = match.liveState.selectedAugments.flatMap((augment) => getSelectedAugmentProfile(augment).tags)
  const tags = new Set([...(bestAugment?.tags ?? []), ...selectedTags])
  const preferredChain = match.enemyComposition.assassins >= 2
    ? augmentItemChains.find((chain) => chain.id === 'safe-counter')
    : augmentItemChains.find((chain) => chain.matchTags.some((tag) => tags.has(tag)))
  const chain = preferredChain ?? augmentItemChains[augmentItemChains.length - 1]
  let items = chain.items

  if (match.enemyComposition.tanks >= 2 && !items.some((item) => item.tags.includes('tank-counter'))) {
    items = uniqueById([...items.slice(0, 2), itemCatalog.voidStaff, itemCatalog.liandry]).slice(0, 3)
  }

  return {
    id: `${chain.id}-${bestAugment?.id ?? 'pending'}`,
    label: chain.label,
    score: Math.min(99, (bestAugment?.probability ?? 72) + (match.liveState.selectedAugments.length > 1 ? 4 : 0)),
    items,
  }
}

export function createBuildRecommendation(match: Match, champion: Champion): BuildRecommendation {
  const buildData = getChampionBuildData(champion)
  const situational = []
  const warnings = []
  const pivots = []
  const counterPlans = []
  let score = champion.id === match.currentChampionId ? 86 : 78

  if (match.enemyComposition.apThreat >= 65) {
    situational.push(itemCatalog.maw, itemCatalog.mercs)
    warnings.push('敌方 AP 威胁偏高，建议提前补魔抗容错。')
    pivots.push('如果中野爆发开始滚雪球，第二件后优先补玛莫提乌斯。')
    counterPlans.push({
      trigger: '辛德拉/铁男 AP 爆发开始威胁后排',
      action: '提前补魔抗组件，鞋子优先水银鞋。',
      priority: match.enemyComposition.apThreat,
    })
    score += 3
  }

  if (match.enemyComposition.crowdControl >= 70) {
    situational.push(itemCatalog.mercs)
    warnings.push('敌方控制链偏长，水银鞋和净化类选择收益提高。')
    pivots.push('被连续先手两次后，把输出装顺位让给韧性/保命装。')
    counterPlans.push({
      trigger: '蔚大招 + 锤石钩 + 辛德拉推球形成连续控制',
      action: '水银鞋优先级升到第一档，团前保留位移。',
      priority: match.enemyComposition.crowdControl,
    })
    score += 2
  }

  if (match.enemyComposition.tanks >= 2) {
    situational.push(itemCatalog.serylda, itemCatalog.liandry)
    warnings.push('敌方前排数量较多，需要穿透或持续伤害。')
    pivots.push('如果前排开始站住河道，优先补穿透而不是纯爆发。')
    counterPlans.push({
      trigger: '铁男/蔚卡住河道入口，后排无法直接输出',
      action: '穿透装提前，围绕前排血线打消耗再接团。',
      priority: 68 + match.enemyComposition.tanks * 6,
    })
    score += 2
  }

  if (match.enemyComposition.assassins >= 2) {
    situational.push(itemCatalog.guardian, itemCatalog.zhonya)
    warnings.push('敌方刺客多，团战站位和保命装优先级提高。')
    pivots.push('连续被切时，先保生存再谈输出曲线。')
    counterPlans.push({
      trigger: '刺客连续切入或斗魂模式贴脸压力过高',
      action: '补保命装，站位从侧翼输出改成后排反打。',
      priority: 70 + match.enemyComposition.assassins * 5,
    })
  }

  const stages = buildData.stages.map((stage) => ({
    ...stage,
    items: uniqueById(stage.items),
  }))
  const loadouts = buildData.loadouts.map((loadout) => ({
    ...loadout,
    score: Math.min(96, 'score' in loadout ? loadout.score : score + loadout.scoreOffset),
    items: uniqueById(loadout.items),
  }))

  return {
    meta: buildData.meta,
    score: Math.min(score, 95),
    title: buildData.title,
    coreItems: uniqueById(buildData.coreItems),
    situationalItems: uniqueById(situational).slice(0, 5),
    loadouts,
    stages,
    counterPlans: counterPlans.sort((a, b) => b.priority - a.priority).slice(0, 4),
    warnings,
    explanation: `${champion.name} 本局定位是${champion.identity}。结合敌方阵容，推荐先保证核心节奏，再根据 AP、控制和前排压力调整防御与穿透。`,
    pivots: uniqueById(pivots.map((text, index) => ({ id: `${index}`, text }))).map((item) => item.text),
  }
}

/**
 * 把候选强化的字符串 id 桥接到 26.12 Mayhem 数字 id。
 *
 * 当前 mock 候选用的是文案化字符串 id（如 'jewelled'），与官方数字 id 没有可信映射，
 * 因此只在 id 本身就是快照里存在的数字时才返回；否则返回 null，由上层走兜底。
 */
function resolveMayhemAugmentId(candidateId: string, snapshot: MayhemSnapshot): number | null {
  const numeric = Number(candidateId)
  if (!Number.isInteger(numeric)) return null
  return snapshot.augments.some((augment) => augment.id === numeric) ? numeric : null
}

function rankAugmentsByTagRules(match: Match, champion: Champion): AugmentRecommendation[] {
  const selectedProfiles = match.liveState.selectedAugments.map(getSelectedAugmentProfile)
  const selectedTags = Array.from(new Set(selectedProfiles.flatMap((profile) => profile.tags)))
  const selectedPlans = Array.from(new Set(selectedProfiles.map((profile) => profile.plan)))
  const augmentDataSourceLabel = '本地规则兜底 · 非版本统计'

  return match.augmentCandidates
    .map((augment) => {
      const tagMatches = augment.tags.filter((tag) => champion.tags.includes(tag)).length
      const directSelectedMatches = augment.tags.filter((tag) => selectedTags.includes(tag))
      const bridgeMatches = augment.tags.filter((tag) =>
        selectedTags.some((selectedTag) => augmentTagBridges[selectedTag]?.includes(tag)),
      )
      const selectedSynergyScore = Math.min(
        40,
        directSelectedMatches.length * 15 + bridgeMatches.length * 8,
      )
      const conflictPenalty =
        selectedTags.some((tag) => ['burst', 'mobility', 'poke'].includes(tag)) &&
        augment.tags.includes('defense') &&
        directSelectedMatches.length === 0
          ? 6
          : 0
      const score = Math.min(
        99,
        Math.round(
          augment.currentValue * 0.48 +
            augment.scalingValue * 0.26 +
            tagMatches * 6 +
            selectedSynergyScore -
            conflictPenalty,
        ),
      )
      const probability = Math.min(
        96,
        Math.round(score * 0.68 + tagMatches * 5 + selectedSynergyScore * 0.6 + augment.scalingValue * 0.1),
      )
      const comboTags = augment.tags.filter((tag) => champion.tags.includes(tag))
      const selectedComboTags = Array.from(new Set([...directSelectedMatches, ...bridgeMatches]))
      const selectedSynergy =
        selectedComboTags.length > 0
          ? `承接已选 ${match.liveState.selectedAugments.join('、')} 的 ${selectedPlans.join('/')}，关联标签：${selectedComboTags.join(' / ')}。`
          : `和已选 ${match.liveState.selectedAugments.join('、') || '暂无'} 没有强协同，更像独立补强。`
      const futureCombos = [
        {
          name: selectedPlans[0] ?? (augment.tags.includes('poke') ? '远程消耗链' : augment.tags.includes('mobility') ? '位移爆发链' : '稳定成长链'),
          probability: Math.min(94, probability + Math.round(selectedSynergyScore * 0.35) + 3),
          reason: augment.tags.includes('poke')
            ? '后续拿冷却、法术命中、技能增伤时会继续放大消耗收益。'
            : augment.tags.includes('mobility')
              ? '后续位移后增伤、冷却缩减会提高连续进出场能力。'
              : '成长类强化叠加后，后期收益曲线更稳定。',
        },
        {
          name: augment.tags.includes('defense') ? '容错防守链' : '输出转防守链',
          probability: Math.max(38, probability - 14),
          reason: '如果后续对手爆发过高，补护盾、韧性或复活类强化可以修正容错。',
        },
      ]

      return {
        ...augment,
        score,
        probability,
        dataSourceLabel: augmentDataSourceLabel,
        scoreLabel: '路线潜力',
        scoreReason:
          selectedSynergyScore >= 24
            ? '已选强化能直接接上同一条构筑链，优先级高。'
            : bridgeMatches.length > 0
              ? '和已选强化有桥接标签，适合作为下一轮转向。'
              : tagMatches > 0
                ? '更依赖英雄契合度，组合收益一般。'
                : '缺少已选强化协同，只建议在其他两个更差时选。',
        comboTags: comboTags.length > 0 ? comboTags : augment.tags.slice(0, 2),
        synergy: tagMatches > 1 ? '高度契合当前英雄标签' : tagMatches === 1 ? '有明确单点契合' : '偏通用收益',
        selectedSynergy,
        selectedSynergyScore,
        conflictNote: conflictPenalty > 0 ? '当前已选强化偏进攻节奏，这个选择会牺牲一部分构筑连续性。' : undefined,
        futurePotential:
          augment.scalingValue >= 85
            ? '后续组合上限高，适合作为构筑核心。'
            : '后续组合稳定，但更像补强而不是核心。',
        futureCombos,
      }
    })
    .sort((a, b) => b.score - a.score)
}

/**
 * 强化排序入口：实时模式只接受 Live Client 提供的数字候选 id，并要求快照覆盖；
 * Demo 模式的文案 id 无法可信映射时才回退到本地标签规则。
 *
 * 真实候选没有统计覆盖时返回空列表，由 UI 显示等待状态，不把 Demo 推荐冒充实时数据。
 */
export function rankAugments(
  match: Match,
  champion: Champion,
  mayhemMode: MayhemRecommendationMode = 'strength',
): AugmentRecommendation[] {
  const hasLiveCandidates =
    match.liveState.isLiveDataAuthoritative &&
    match.liveState.candidateAugmentIds.length > 0
  const resolvedIds = hasLiveCandidates
    ? match.liveState.candidateAugmentIds
    : match.augmentCandidates.map((augment) =>
        resolveMayhemAugmentId(augment.id, mayhemSnapshot),
      )
  const allResolved = resolvedIds.every((id): id is number => id !== null)
  const modeEntries =
    mayhemMode === 'off-meta'
      ? mayhemSnapshot.recommendations.offMeta
      : mayhemSnapshot.recommendations.strength
  const coveredBySnapshot =
    allResolved &&
    resolvedIds.every((id) => modeEntries.some((entry) => entry.augmentId === id))

  if (!coveredBySnapshot) {
    return hasLiveCandidates ? [] : rankAugmentsByTagRules(match, champion)
  }

  const ranked = rankMayhemCandidates({
    mode: mayhemMode,
    // The snapshot currently has no champion-specific evidence, so scoring deliberately
    // ignores this value until a real champion-id keyed source is available.
    championId: 0,
    selectedAugmentIds: match.liveState.selectedAugmentIds,
    candidateAugmentIds: resolvedIds.filter((id): id is number => id !== null),
    snapshot: mayhemSnapshot,
  })
  const evidenceByAugmentId = new Map(modeEntries.map((entry) => [entry.augmentId, entry]))
  const metaByAugmentId = new Map(mayhemSnapshot.augments.map((entry) => [entry.id, entry]))

  return ranked.map((entry) => {
    const meta = metaByAugmentId.get(entry.augmentId)
    const evidence = evidenceByAugmentId.get(entry.augmentId)
    const tier =
      meta?.rarity === 'silver' || meta?.rarity === 'gold' || meta?.rarity === 'prismatic'
        ? meta.rarity
        : 'gold'
    const score = Math.round(entry.score * 100)

    return {
      id: String(entry.augmentId),
      name: meta?.name ?? `强化 ${entry.augmentId}`,
      tier,
      tags: [],
      currentValue: score,
      scalingValue: score,
      note: meta?.description ?? '',
      score,
      probability: evidence?.winRate ?? score,
      dataSourceLabel: `版本聚合 · ${mayhemSnapshot.patch}`,
      scoreLabel: mayhemMode === 'strength' ? '强度' : '黑科技',
      scoreReason: entry.reason,
      comboTags: [],
      synergy: '暂无英雄专属样本',
      selectedSynergy: '当前数据源尚未提供已选海克斯组合样本。',
      selectedSynergyScore: 0,
      futurePotential: '等待组合样本后评估。',
      futureCombos: [],
      mayhemGames: entry.games,
      mayhemConfidence: entry.confidence,
      observing: entry.confidence === 'low' || evidence?.observing,
    }
  })
}

export const createRuneRecommendations = getChampionRunePages

export function createArenaRecommendation(match: Match, mode: GameMode): RecommendationViewModel['arena'] {
  const threats = match.arenaThreats
  const upgrades = [
    match.enemyComposition.mobility >= 70 ? '冷却缩减 / 位移后增伤' : '稳定输出强化',
    match.enemyComposition.sustain >= 70 ? '重伤 / 灼烧 / 持续伤害' : '爆发补强',
    match.enemyComposition.assassins >= 2 ? '金身 / 护盾 / 复活类容错' : '伤害窗口强化',
  ]

  return {
    priority: mode === 'arena' ? '先保留位移与控制技能，围绕对手关键进场反打。' : '作为娱乐模式参考，优先选择泛用收益。',
    threats,
    upgrades,
    roundPlan: [
      { phase: '前两轮', action: '少追残血，先记录对手突进/保命强化，保血量比强杀更重要。' },
      { phase: '中期强化', action: '优先补冷却、重伤或位移后增伤，让阿狸能打第二轮技能。' },
      { phase: '决胜圈', action: '留一段位移穿过危险区，魅惑只交给突进后摇或被迫进场目标。' },
    ],
    matchupRules: [
      { enemyStyle: '高机动刺客', response: '第一段位移只躲技能，不主动追；等对方突进落点后魅惑反控。' },
      { enemyStyle: '高续航前排', response: '优先重伤/灼烧，不要把全部资源交给第一轮爆发。' },
      { enemyStyle: '双远程消耗', response: '利用草丛和边缘视野逼走位，别在开阔区慢慢换血。' },
    ],
    strategy: '前两轮不要强行追残血，先用边缘走位骗关键控制。等对手突进交掉后，再用控制或位移拉开输出窗口。',
  }
}

export function createRecommendations(
  match: Match,
  mode: GameMode,
  mayhemMode: MayhemRecommendationMode = 'strength',
): RecommendationViewModel {
  const champion = match.champions.find((candidate) => candidate.id === match.currentChampionId) ?? match.champions[0]
  const build = createBuildRecommendation(match, champion)
  const runes = createRuneRecommendations(champion)
  const augments = rankAugments(match, champion, mayhemMode)
  const nextItem = build.situationalItems[0] ?? build.coreItems[Math.min(1, build.coreItems.length - 1)]
  const bestAugment = augments[0]
  const augmentItemPlan = createAugmentItemPlan(match, bestAugment)

  return {
    build,
    runes,
    augments,
    arena: createArenaRecommendation(match, mode),
    live: {
      nextItem,
      tacticalRead: `${match.liveState.currentSituation} ${match.liveState.goldOnHand === null ? '金币暂未同步' : `当前金币 ${match.liveState.goldOnHand}`}，下一步优先围绕 ${match.liveState.nextObjective} 做装备和站位选择。`,
      nextTwoMinutes: [
        match.liveState.immediateAction,
        match.enemyComposition.crowdControl >= 70 ? '团前不要先交位移，等锤石/蔚第一波控制失败再反打。' : '先推中线，再提前落位资源区。',
        mode === 'augment' ? '装备链跟随已选强化调整，先看图标路线，不走固定模板。' : '保持当前核心路线，暂不需要强行变装。',
      ],
      augmentContext: {
        selected: match.liveState.selectedAugments,
        bestCandidate: bestAugment?.name ?? '暂无候选',
        reason: bestAugment
          ? `${bestAugment.name} 与已选强化协同 ${bestAugment.selectedSynergyScore} 分。${bestAugment.selectedSynergy}`
          : '等待下一轮候选海克斯出现。',
        comboScore: bestAugment?.probability ?? 0,
        itemPlan: augmentItemPlan,
      },
    },
  }
}
