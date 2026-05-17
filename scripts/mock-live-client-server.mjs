import http from 'node:http'

const port = Number(process.env.MOCK_LIVE_CLIENT_PORT ?? 30099)
const startedAt = Date.now()

function json(response, payload, status = 200) {
  response.writeHead(status, {
    'access-control-allow-origin': '*',
    'content-type': 'application/json',
  })
  response.end(JSON.stringify(payload))
}

function allGameData() {
  const gameTime = 420 + Math.floor((Date.now() - startedAt) / 1000)

  return {
    activePlayer: {
      currentGold: 1375 + (gameTime % 180),
      level: 8,
      summonerName: 'Live ADC',
    },
    allPlayers: [
      {
        championName: 'Ezreal',
        items: [
          { itemID: 3004, displayName: '魔宗' },
          { itemID: 3057, displayName: '耀光' },
          { itemID: 1001, displayName: '速度之靴' },
        ],
        level: 8,
        position: 'BOTTOM',
        summonerName: 'Live ADC',
        team: 'ORDER',
      },
      {
        championName: 'Ahri',
        items: [{ itemID: 6655, displayName: '卢登的激荡' }],
        level: 9,
        position: 'MIDDLE',
        summonerName: '狐狸会魅惑',
        team: 'ORDER',
      },
    ],
    events: {
      Events: [],
    },
    gameData: {
      gameMode: 'CLASSIC',
      gameTime,
      mapName: 'Map11',
    },
  }
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`)

  if (url.pathname === '/liveclientdata/allgamedata') {
    json(response, allGameData())
    return
  }

  json(response, { message: `mock Live Client route not found: ${url.pathname}` }, 404)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Mock Live Client Data listening on http://127.0.0.1:${port}`)
  console.log(`Use LIVE_CLIENT_DATA_BASE_URL=http://127.0.0.1:${port}`)
})
