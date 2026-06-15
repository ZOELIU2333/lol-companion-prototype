import { createServer } from 'node:http'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const port = Number(process.env.MOCK_LCU_PORT ?? 29999)
const password = process.env.MOCK_LCU_PASSWORD ?? 'mock-lcu-password'
const phase = process.env.MOCK_LCU_PHASE ?? 'ChampSelect'
const queueId = Number(process.env.MOCK_LCU_QUEUE_ID ?? (phase === 'ChampSelect' ? 420 : 2400))
const lockfileDir = process.env.MOCK_LCU_DIR ?? join(tmpdir(), 'lol-companion-mock-lcu')
const lockfilePath = join(lockfileDir, 'lockfile')

const players = [
  ['TOP', 266, 1001, '青钢影本影', 'ALLYTOP'],
  ['JUNGLE', 64, 1002, '河道蟹是我的', 'ALLYJG'],
  ['MIDDLE', 103, 1003, '狐狸会魅惑', 'ALLYMID'],
  ['BOTTOM', 81, 1004, '蓝量不够Q', 'ALLYAD'],
  ['UTILITY', 111, 1005, '眼位艺术家', 'ALLYSUP'],
  ['TOP', 82, 2001, '铁男不开大', 'ENEMYTOP'],
  ['JUNGLE', 254, 2002, '只抓下路', 'ENEMYJG'],
  ['MIDDLE', 134, 2003, '晕到就是秒', 'ENEMYMID'],
  ['BOTTOM', 119, 2004, '德莱文提款机', 'ENEMYAD'],
  ['UTILITY', 412, 2005, '泰坦必钩', 'ENEMYSUP'],
]

const summoners = Object.fromEntries(
  players.map(([, , summonerId, gameName, tagLine]) => [
    String(summonerId),
    {
      displayName: gameName,
      gameName,
      internalName: gameName,
      puuid: `mock-puuid-${summonerId}`,
      summonerId,
      tagLine,
    },
  ]),
)

function json(response, value, status = 200) {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(value))
}

function isAuthorized(request) {
  const auth = request.headers.authorization ?? ''
  return auth === `Basic ${Buffer.from(`riot:${password}`).toString('base64')}`
}

function champSelectPlayer([assignedPosition, championId, summonerId, summonerName], index) {
  return {
    assignedPosition,
    cellId: index,
    championId,
    puuid: `mock-puuid-${summonerId}`,
    summonerId,
    summonerName,
  }
}

await mkdir(lockfileDir, { recursive: true })
await writeFile(lockfilePath, `LeagueClient:4242:${port}:${password}:http`)

const server = createServer((request, response) => {
  if (!isAuthorized(request)) {
    json(response, { message: 'unauthorized mock LCU request' }, 401)
    return
  }

  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)

  if (url.pathname === '/lol-gameflow/v1/gameflow-phase') {
    json(response, phase)
    return
  }

  if (url.pathname === '/lol-gameflow/v1/session') {
    const isAugment = [2400, 2401, 2403, 2405, 3240, 3270].includes(queueId)
    json(response, {
      gameData: {
        queue: {
          id: queueId,
          description: isAugment ? '海克斯大乱斗' : 'Ranked Solo/Duo',
          gameMode: isAugment ? 'ARAM' : 'CLASSIC',
        },
        teamOne: players.slice(5).map(([selectedPosition, championId, summonerId, summonerName]) => ({
          championId,
          puuid: `mock-puuid-${summonerId}`,
          selectedPosition,
          summonerId,
          summonerName,
        })),
        teamTwo: players.slice(0, 5).map(([selectedPosition, championId, summonerId, summonerName]) => ({
          championId,
          puuid: `mock-puuid-${summonerId}`,
          selectedPosition,
          summonerId,
          summonerName,
        })),
      },
    })
    return
  }

  if (url.pathname === '/lol-summoner/v1/current-summoner') {
    json(response, summoners['1004'])
    return
  }

  if (url.pathname === '/lol-champ-select/v1/session') {
    json(response, {
      localPlayerCellId: 3,
      myTeam: players.slice(0, 5).map(champSelectPlayer),
      theirTeam: players.slice(5).map((player, index) => champSelectPlayer(player, index + 5)),
    })
    return
  }

  const summonerMatch = url.pathname.match(/^\/lol-summoner\/v1\/summoners\/(\d+)$/)
  if (summonerMatch) {
    json(response, summoners[summonerMatch[1]] ?? null, summoners[summonerMatch[1]] ? 200 : 404)
    return
  }

  json(response, { message: `mock LCU route not found: ${url.pathname}` }, 404)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Mock LCU listening on http://127.0.0.1:${port}`)
  console.log(`Phase: ${phase}, queue: ${queueId}`)
  console.log(`Lockfile: ${lockfilePath}`)
  console.log(`Use: LEAGUE_CLIENT_LOCKFILE=${lockfilePath} npm run tauri:dev`)
})

process.on('SIGINT', () => {
  server.close(() => process.exit(0))
})
