import type { Match, PlayerIntel } from '../types'

const percent = (value: number) => `${value}%`

const horseTier = (player: PlayerIntel) => {
  const momentum =
    player.score +
    (player.recentWinRate - 50) * 0.55 +
    (player.kda - 2.4) * 4 +
    (player.killParticipation - 45) * 0.18 -
    Math.max(0, player.averageDeaths - 5) * 2

  if (momentum >= 83) {
    return {
      label: '上等马',
      tone: '这位数据会自己发光，建议给点资源，别让千里马在野区吃草。',
    }
  }

  if (momentum >= 72) {
    return {
      label: '中等马',
      tone: '能跑，偶尔也会思考人生；正常沟通就行，别逼他表演奇迹。',
    }
  }

  return {
    label: '下等马',
    tone: '数据比较朴素，主打一个参与游戏；少给压力，多给信号。',
  }
}

const compactPlayerLine = (player: PlayerIntel) => {
  const tier = horseTier(player)

  return `${tier.label} ${player.role}${player.name}：近${player.recentRankedGames}场 ${percent(player.recentWinRate)}，KDA ${player.kda.toFixed(1)}，均死 ${player.averageDeaths.toFixed(1)}`
}

const countTiers = (players: PlayerIntel[]) => {
  const counts = { 上等马: 0, 中等马: 0, 下等马: 0 }

  players.forEach((player) => {
    counts[horseTier(player).label as keyof typeof counts] += 1
  })

  return counts
}

export function buildChatBrief(match: Match, players: PlayerIntel[]): string {
  const allies = players.filter((player) => player.team === 'ally')
  const enemies = players.filter((player) => player.team === 'enemy')
  const allyRanking = [...allies].sort((a, b) => b.score - a.score)
  const enemyRanking = [...enemies].sort((a, b) => b.score - a.score)
  const allyTop = allyRanking[0]
  const allyBottom = allyRanking[allyRanking.length - 1]
  const enemyTop = enemyRanking[0]
  const enemyBottom = enemyRanking[enemyRanking.length - 1]
  const allyAvgWinRate = Math.round(allies.reduce((sum, player) => sum + player.recentWinRate, 0) / allies.length)
  const enemyAvgWinRate = Math.round(enemies.reduce((sum, player) => sum + player.recentWinRate, 0) / enemies.length)
  const allyTiers = countTiers(allies)
  const enemyTiers = countTiers(enemies)

  return [
    `[玩家历史] 我方均分 ${match.intel.allyAverageScore}/${percent(allyAvgWinRate)}，敌方 ${match.intel.enemyAverageScore}/${percent(enemyAvgWinRate)}；我方 ${allyTiers.上等马} 上 ${allyTiers.中等马} 中 ${allyTiers.下等马} 下，敌方 ${enemyTiers.上等马} 上 ${enemyTiers.中等马} 中 ${enemyTiers.下等马} 下。`,
    allyTop ? `我方大腿：${compactPlayerLine(allyTop)}，看起来像来上班的。` : '',
    allyBottom && allyBottom.id !== allyTop?.id ? `我方风险位：${compactPlayerLine(allyBottom)}，少给压力，多给信号。` : '',
    enemyTop ? `敌方大腿：${compactPlayerLine(enemyTop)}，别让他玩成付费陪练。` : '',
    enemyBottom && enemyBottom.id !== enemyTop?.id ? `敌方突破口：${compactPlayerLine(enemyBottom)}，这位数据比较有礼貌。` : '',
    '结论：上等马拉车，中等马别翻车，下等马听 ping；先稳住心态，别把自己打成景点。',
  ]
    .filter(Boolean)
    .slice(0, 5)
    .join('｜')
}
