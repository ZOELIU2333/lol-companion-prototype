import { useEffect, useMemo, useState } from 'react'
import type { LcuGamePhase, LcuPlayerSnapshot } from '../../../services/lcuAdapter'
import { createRiotAccountFromLcu } from '../../../services/companionDataSource'
import {
  loadOpggPlayerProfileForAccount,
  loadOpggRecentMatchesForAccount,
} from '../../../services/opggPlayerData'
import type { OpggMcpHost } from '../../../services/opggMcpAdapter'
import { loadRiotPlayerProfile, loadRiotRecentMatches } from '../../../services/riotPlayerData'
import type { RiotApiHost } from '../../../services/riotApiAdapter'
import type { GameMode, PlayerRecentMatch, PlayerRiotAccount } from '../../../types'
import { rateArenaTeammate, type ArenaTeammateRating } from './rating'

type VisibleArenaTeammateState = {
  teammateName: string
  championId?: number
}

export type ArenaTeammateState =
  | { status: 'hidden' }
  | (VisibleArenaTeammateState & { status: 'loading' })
  | (VisibleArenaTeammateState & { status: 'rated'; rating: ArenaTeammateRating })
  | (VisibleArenaTeammateState & { status: 'insufficient'; rating: ArenaTeammateRating; reason: string })

type ArenaTeammateLoaders = {
  loadOpgg: (host: OpggMcpHost | null, account: PlayerRiotAccount) => Promise<{
    matches: PlayerRecentMatch[]
    profileWinRate?: number
  }>
  loadRiot: (host: RiotApiHost | null, account: PlayerRiotAccount) => Promise<{
    matches: PlayerRecentMatch[]
    profileWinRate?: number
  }>
}

const defaultLoaders: ArenaTeammateLoaders = {
  async loadOpgg(host, account) {
    if (!host) return { matches: [] }
    const [profile, matches] = await Promise.all([
      loadOpggPlayerProfileForAccount(host, account),
      loadOpggRecentMatchesForAccount(host, account, 10),
    ])
    return { matches, profileWinRate: profile?.rankedWinRate }
  },
  async loadRiot(host, account) {
    if (!host) return { matches: [] }
    const [profile, matches] = await Promise.all([
      loadRiotPlayerProfile(host, account),
      loadRiotRecentMatches(host, account, 10),
    ])
    return { matches, profileWinRate: profile?.recentWinRate }
  },
}

export type UseArenaTeammateRatingInput = {
  mode: GameMode
  lcuPhase: LcuGamePhase | null
  players: LcuPlayerSnapshot[]
  localSummonerName?: string
  championNames?: ReadonlyMap<number, { name: string }>
  opggHost: OpggMcpHost | null
  riotHost: RiotApiHost | null
  loaders?: ArenaTeammateLoaders
}

const normalizeName = (value?: string) => value?.trim().toLocaleLowerCase() ?? ''

export function useArenaTeammateRating({
  mode,
  lcuPhase,
  players,
  localSummonerName,
  championNames,
  opggHost,
  riotHost,
  loaders = defaultLoaders,
}: UseArenaTeammateRatingInput): ArenaTeammateState {
  const teammate = useMemo(() => players.find((player) => {
    if (player.team !== 'ally' || player.isLocalPlayer) return false
    const playerName = player.summonerName ?? player.riotAccount?.gameName
    return !localSummonerName || normalizeName(playerName) !== normalizeName(localSummonerName)
  }), [localSummonerName, players])
  const account = useMemo(() => teammate ? createRiotAccountFromLcu(teammate) : undefined, [teammate])
  const teammateName = teammate?.summonerName ?? teammate?.riotAccount?.gameName ?? '未知队友'
  const championId = teammate?.championId
  const currentChampionName = championId ? championNames?.get(championId)?.name : undefined
  const accountKey = account
    ? `${account.platform ?? account.region}:${account.gameName}:${account.tagLine ?? account.puuid ?? ''}`
    : ''
  const requestKey = mode === 'arena' && lcuPhase === 'ChampSelect' && account
    ? `${teammate?.id ?? 'unknown'}:${accountKey}:${championId ?? 0}:${currentChampionName ?? ''}`
    : ''
  const [loaded, setLoaded] = useState<{ key: string; state: ArenaTeammateState } | null>(null)

  useEffect(() => {
    if (!requestKey || !account) return undefined

    let stale = false
    const resolvedAccount = account

    void (async () => {
      let bestRating = rateArenaTeammate({ matches: [], source: 'none' })
      try {
        const opgg = await loaders.loadOpgg(opggHost, resolvedAccount)
        const opggRating = rateArenaTeammate({
          currentChampionName,
          matches: opgg.matches,
          profileWinRate: opgg.profileWinRate,
          source: opgg.matches.length > 0 ? 'opgg' : 'none',
        })
        bestRating = opggRating
        if (opggRating.label !== '情报不足') {
          if (!stale) setLoaded({ key: requestKey, state: { status: 'rated', teammateName, championId, rating: opggRating } })
          return
        }
      } catch {
        // Continue to the configured Riot source.
      }

      try {
        const riot = await loaders.loadRiot(riotHost, resolvedAccount)
        const riotRating = rateArenaTeammate({
          currentChampionName,
          matches: riot.matches,
          profileWinRate: riot.profileWinRate,
          source: riot.matches.length > 0 ? 'riot' : 'none',
        })
        if (riotRating.sampleSize > bestRating.sampleSize) bestRating = riotRating
        if (riotRating.label !== '情报不足') {
          if (!stale) setLoaded({ key: requestKey, state: { status: 'rated', teammateName, championId, rating: riotRating } })
          return
        }
      } catch {
        // The card below remains explicit about missing evidence.
      }

      if (!stale) {
        setLoaded({
          key: requestKey,
          state: {
            status: 'insufficient',
            teammateName,
            championId,
            rating: bestRating,
            reason: bestRating.reasons[0] ?? '公开战绩暂不可用',
          },
        })
      }
    })()

    return () => { stale = true }
  }, [account, championId, currentChampionName, loaders, opggHost, requestKey, riotHost, teammateName])

  if (mode !== 'arena' || lcuPhase !== 'ChampSelect') return { status: 'hidden' }
  if (!teammate || !account) {
    const rating = rateArenaTeammate({ matches: [], source: 'none' })
    return {
      status: 'insufficient',
      teammateName,
      championId,
      rating,
      reason: teammate ? '队友 Riot ID 暂不可用' : '选人阶段尚未读取到队友身份',
    }
  }
  if (loaded?.key === requestKey) return loaded.state
  return { status: 'loading', teammateName, championId }
}
