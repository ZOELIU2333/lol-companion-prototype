import { describe, expect, it } from 'vitest'
import { createOpggMcpAdapter, type OpggMcpHost } from './opggMcpAdapter'

const profileText = 'class LolGetSummonerProfile: data\nclass Data: summoner\nclass Summoner: game_name,tagline,puuid,level,profile_image_url,league_stats,ranked_most_champions\nclass LeagueStat: tier_info,game_type,win,lose\nclass TierInfo: division,lp,tier\nclass RankedMostChampions: my_champion_stats\nclass MyChampionStat: champion_name,play,win,lose,basic\nclass Basic: kill,death,assist,cs,kill_participation,vision_score,damage_participation,op_score\n\nLolGetSummonerProfile(Data(Summoner("Hide on bush","KR1","puuid-1",907,"https://example.com/profile.jpg",[LeagueStat(TierInfo(1,1896,"CHALLENGER"),"SOLORANKED",235,178)],RankedMostChampions([MyChampionStat("双界灵兔",51,29,22,Basic(361,221,299,11761,24.35,1715,14.18,299.81)),MyChampionStat("冰晶凤凰",29,21,8,Basic(150,94,247,5666,13.56,1103,6.77,183.73)),MyChampionStat("符文法师",28,17,11,Basic(184,114,190,6853,14.42,918,6.94,169.11))]))))'

const matchesText = 'class LolListSummonerMatches: data\nclass Data: game_history\nclass GameHistory: participants,created_at,game_length_second,game_type,id\nclass Participant: stats,champion_name\nclass Stats: assist,death,kill,minion_kill,neutral_minion_kill,op_score,result\n\nLolListSummonerMatches(Data([GameHistory([Participant(Stats(10,2,7,16,109,10,"WIN"),"生化魔人")],"2026-05-16T02:32:09+09:00",1199,"SOLORANKED","game-1"),GameHistory([Participant(Stats(11,3,5,297,8,5.89,"LOSE"),"冰晶凤凰")],"2026-05-16T02:02:31+09:00",1930,"SOLORANKED","game-2")]))'

const detailText = 'class LolGetSummonerGameDetail: data\nclass Data: game_detail\nclass GameDetail: teams,created_at,game_length_second,game_type,id\nclass Team: game_stat,participants\nclass GameStat: baron_kill,champion_kill,dragon_kill,gold_earned,is_win,tower_kill\nclass Participant: stats,summoner,champion_name,items,items_names,position,team_key\nclass Stats: assist,death,kill,op_score,total_damage_dealt_to_champions,vision_wards_bought_in_game,ward_place\nclass Summoner: game_name,puuid,tagline\n\nLolGetSummonerGameDetail(Data(GameDetail([Team(GameStat(0,22,0,40727,true,1),[Participant(Stats(10,2,7,10,12654,2,3),Summoner("Hide on bush","puuid-1","KR1"),"生化魔人",[3152,3047],["海克斯科技火箭腰带","铁板靴"],"JUNGLE","BLUE")]),Team(GameStat(0,12,2,35729,false,2),[Participant(Stats(2,5,2,2.5,7568,3,11),Summoner("Heaven","puuid-2","KR1"),"盲僧",[6692,3156],["星蚀","玛莫提乌斯之噬"],"JUNGLE","RED")])],"2026-05-16T02:32:09+09:00",1199,"SOLORANKED","game-1")))'

function createMockHost(): OpggMcpHost {
  return {
    async fetchJson<T>(_url: string, init?: { body?: string }) {
      const body = JSON.parse(init?.body ?? '{}') as { params?: { name?: string } }
      const text =
        body.params?.name === 'lol_get_summoner_profile'
          ? profileText
          : body.params?.name === 'lol_get_summoner_game_detail'
            ? detailText
            : matchesText
      return {
        result: {
          content: [{ text, type: 'text' }],
        },
      } as T
    },
  }
}

describe('opgg MCP adapter', () => {
  it('maps OP.GG summoner profile text into player profile metrics', async () => {
    const adapter = createOpggMcpAdapter(createMockHost())
    const profile = await adapter.getPlayerProfile({ gameName: 'Hide on bush', region: 'KR', tagLine: 'KR1' })

    expect(profile).toMatchObject({
      championPoolTop3: [
        { championName: '双界灵兔', games: 51, winRate: 57 },
        { championName: '冰晶凤凰', games: 29, winRate: 72 },
        { championName: '符文法师', games: 28, winRate: 61 },
      ],
      gameName: 'Hide on bush',
      rank: '王者 1 1896LP',
      rankedGames: 413,
      rankedWinRate: 57,
      source: 'opgg-mcp',
    })
  })

  it('maps OP.GG match history text into recent match rows', async () => {
    const adapter = createOpggMcpAdapter(createMockHost())
    const matches = await adapter.getRecentMatches({ gameName: 'Hide on bush', region: 'KR', tagLine: 'KR1' }, 10)

    expect(matches).toEqual([
      expect.objectContaining({
        champion: '生化魔人',
        createdAt: '2026-05-16T02:32:09+09:00',
        cs: '6.3',
        id: 'game-1',
        kda: '7/2/10',
        mode: '单双排',
        result: '胜',
        score: 96,
      }),
      expect.objectContaining({
        champion: '冰晶凤凰',
        result: '负',
        score: 59,
      }),
    ])
  })

  it('maps OP.GG full game detail into both team lineups', async () => {
    const adapter = createOpggMcpAdapter(createMockHost())
    const detail = await adapter.getMatchDetail(
      { gameName: 'Hide on bush', region: 'KR', tagLine: 'KR1' },
      {
        champion: '生化魔人',
        createdAt: '2026-05-16T02:32:09+09:00',
        cs: '6.3',
        id: 'game-1',
        kda: '7/2/10',
        kp: 0,
        mode: '单双排',
        result: '胜',
        score: 96,
        time: '1 场前',
      },
    )

    expect(detail).toMatchObject({
      durationSeconds: 1199,
      gameType: 'SOLORANKED',
      id: 'game-1',
      source: 'opgg-mcp',
      teams: [
        {
          gold: 40727,
          isWin: true,
          key: 'BLUE',
          kills: 22,
          participants: [
            {
              championName: '生化魔人',
              items: [
                { id: 3152, name: '海克斯科技火箭腰带' },
                { id: 3047, name: '铁板靴' },
              ],
              summonerName: 'Hide on bush',
              vision: 5,
            },
          ],
        },
        {
          isWin: false,
          key: 'RED',
          participants: [
            {
              championName: '盲僧',
              summonerName: 'Heaven',
            },
          ],
        },
      ],
    })
  })
})
