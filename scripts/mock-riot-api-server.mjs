import { createServer } from 'node:http'

const port = Number(process.env.MOCK_RIOT_PORT ?? 30080)
const platforms = new Set(['br1', 'eun1', 'euw1', 'jp1', 'kr', 'la1', 'la2', 'me1', 'na1', 'oc1', 'ru', 'sg2', 'tr1', 'tw2', 'vn2'])

const playerNames = [
  ['青钢影本影', 'ALLYTOP', 1001, 266],
  ['河道蟹是我的', 'ALLYJG', 1002, 64],
  ['狐狸会魅惑', 'ALLYMID', 1003, 103],
  ['蓝量不够Q', 'ALLYAD', 1004, 81],
  ['眼位艺术家', 'ALLYSUP', 1005, 111],
  ['铁男不开大', 'ENEMYTOP', 2001, 82],
  ['只抓下路', 'ENEMYJG', 2002, 254],
  ['晕到就是秒', 'ENEMYMID', 2003, 134],
  ['德莱文提款机', 'ENEMYAD', 2004, 119],
  ['泰坦必钩', 'ENEMYSUP', 2005, 412],
]

const accounts = Object.fromEntries(
  playerNames.map(([gameName, tagLine, summonerId, championId], index) => [
    gameName,
    {
      championId,
      gameName,
      index,
      puuid: `mock-puuid-${summonerId}`,
      summonerId: `mock-summoner-${summonerId}`,
      tagLine,
    },
  ]),
)

const byPuuid = Object.fromEntries(Object.values(accounts).map((account) => [account.puuid, account]))
const bySummonerId = Object.fromEntries(Object.values(accounts).map((account) => [account.summonerId, account]))

function json(response, value, status = 200) {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(value))
}

function participantFor(account, matchIndex) {
  const won = (account.index + matchIndex) % 3 !== 0
  const deaths = 2 + ((account.index + matchIndex) % 6)
  const kills = Math.max(1, 4 + ((account.index * 2 + matchIndex) % 9) + (won ? 2 : -1))
  const assists = 5 + ((account.index + matchIndex * 2) % 12)
  const timePlayed = 1680 + matchIndex * 18

  return {
    assists,
    challenges: {
      killParticipation: Math.min(0.82, 0.42 + account.index * 0.025 + matchIndex * 0.018),
    },
    championName: ['Aatrox', 'LeeSin', 'Ahri', 'Ezreal', 'Nautilus', 'Mordekaiser', 'Vi', 'Syndra', 'Draven', 'Thresh'][
      account.index % 10
    ],
    deaths,
    kills,
    neutralMinionsKilled: account.index === 1 || account.index === 6 ? 112 + matchIndex * 3 : 4 + matchIndex,
    puuid: account.puuid,
    teamId: account.index < 5 ? 100 : 200,
    timePlayed,
    totalDamageDealtToChampions: 14000 + account.index * 1300 + matchIndex * 650,
    totalMinionsKilled: account.index === 1 || account.index === 6 ? 38 : 132 + matchIndex * 6,
    visionScore: 14 + account.index * 2 + matchIndex,
    win: won,
  }
}

function matchPayload(matchId) {
  const matchIndex = Number(matchId.split('_').at(-1) ?? 0)
  return {
    metadata: {
      matchId,
      participants: Object.values(accounts).map((account) => account.puuid),
    },
    info: {
      gameCreation: Date.now() - matchIndex * 3600_000,
      participants: Object.values(accounts).map((account) => participantFor(account, matchIndex)),
      queueId: matchIndex % 2 === 0 ? 420 : 440,
    },
  }
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)
  const [, regionOrPlatform, ...parts] = url.pathname.split('/')
  const path = `/${parts.join('/')}`

  if (!regionOrPlatform) {
    json(response, { message: 'missing mock region' }, 404)
    return
  }

  const accountMatch = path.match(/^\/riot\/account\/v1\/accounts\/by-riot-id\/([^/]+)\/([^/]+)$/)
  if (accountMatch) {
    const gameName = decodeURIComponent(accountMatch[1])
    const account = accounts[gameName]
    json(response, account ? { puuid: account.puuid, gameName: account.gameName, tagLine: account.tagLine } : null, account ? 200 : 404)
    return
  }

  const matchIdsMatch = path.match(/^\/lol\/match\/v5\/matches\/by-puuid\/([^/]+)\/ids$/)
  if (matchIdsMatch) {
    const puuid = decodeURIComponent(matchIdsMatch[1])
    const count = Math.max(1, Math.min(Number(url.searchParams.get('count') ?? 10), 20))
    json(response, byPuuid[puuid] ? Array.from({ length: count }, (_, index) => `MOCK_${index + 1}`) : [])
    return
  }

  const matchDetailMatch = path.match(/^\/lol\/match\/v5\/matches\/([^/]+)$/)
  if (matchDetailMatch) {
    json(response, matchPayload(decodeURIComponent(matchDetailMatch[1])))
    return
  }

  const summonerMatch = path.match(/^\/lol\/summoner\/v4\/summoners\/by-puuid\/([^/]+)$/)
  if (summonerMatch && platforms.has(regionOrPlatform)) {
    const account = byPuuid[decodeURIComponent(summonerMatch[1])]
    json(response, account ? { id: account.summonerId, puuid: account.puuid } : null, account ? 200 : 404)
    return
  }

  const masteryMatch = path.match(/^\/lol\/champion-mastery\/v4\/champion-masteries\/by-puuid\/([^/]+)\/top$/)
  if (masteryMatch && platforms.has(regionOrPlatform)) {
    const account = byPuuid[decodeURIComponent(masteryMatch[1])]
    if (!account) {
      json(response, [], 404)
      return
    }

    json(response, [
      { championId: account.championId, championLevel: 7, championPoints: 850000 + account.index * 65000 },
      { championId: 81, championLevel: 6, championPoints: 420000 + account.index * 30000 },
      { championId: 103, championLevel: 6, championPoints: 350000 + account.index * 25000 },
    ])
    return
  }

  const leagueMatch = path.match(/^\/lol\/league\/v4\/entries\/by-summoner\/([^/]+)$/)
  if (leagueMatch && platforms.has(regionOrPlatform)) {
    const account = bySummonerId[decodeURIComponent(leagueMatch[1])]
    if (!account) {
      json(response, [], 404)
      return
    }

    json(response, [
      {
        leaguePoints: 20 + account.index * 7,
        losses: 42 + account.index,
        queueType: 'RANKED_SOLO_5x5',
        rank: ['IV', 'III', 'II', 'I'][account.index % 4],
        tier: ['EMERALD', 'DIAMOND', 'EMERALD', 'PLATINUM'][account.index % 4],
        wins: 48 + account.index * 3,
      },
    ])
    return
  }

  json(response, { message: `mock Riot route not found: ${url.pathname}` }, 404)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Mock Riot API listening on http://127.0.0.1:${port}`)
  console.log(`Use: RIOT_API_BASE_URL=http://127.0.0.1:${port} VITE_RIOT_API_BASE_URL=http://127.0.0.1:${port}`)
})

process.on('SIGINT', () => {
  server.close(() => process.exit(0))
})
