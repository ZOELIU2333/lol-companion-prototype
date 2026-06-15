import type { GameMode, PlayerRiotAccount, TeamSide } from '../types'

export type LcuGamePhase =
  | 'ClientRunning'
  | 'None'
  | 'Lobby'
  | 'Matchmaking'
  | 'ReadyCheck'
  | 'ChampSelect'
  | 'GameStart'
  | 'InProgress'
  | 'WaitingForStats'
  | 'EndOfGame'

export type LcuSessionSnapshot = {
  phase: LcuGamePhase
  mode: Exclude<GameMode, 'arena'> | null
  queueId?: number
  localSummonerName?: string
  players?: LcuPlayerSnapshot[]
  playerSource?: 'champ-select' | 'gameflow'
}

export type LcuPlayerSnapshot = {
  id: string
  team: TeamSide
  role?: string
  championId?: number
  summonerId?: number
  summonerName?: string
  riotAccount?: Partial<PlayerRiotAccount>
}

export type LcuLockfile = {
  name: string
  password: string
  pid: number
  port: number
  protocol: 'http' | 'https'
}

export type LcuRequestOptions = {
  authHeader: string
  baseUrl: string
  path: string
}

export type LcuAdapter = {
  isAvailable: () => Promise<boolean>
  readSession: () => Promise<LcuSessionSnapshot | null>
}

export type LcuAdapterHost = {
  readLockfile: () => Promise<string | null>
  requestJson: <T>(options: LcuRequestOptions) => Promise<T | null>
}

type LcuChampSelectParticipant = {
  assignedPosition?: string
  cellId?: number
  championId?: number
  puuid?: string
  summonerId?: number
  summonerName?: string
}

type LcuChampSelectSession = {
  localPlayerCellId?: number
  myTeam?: LcuChampSelectParticipant[]
  theirTeam?: LcuChampSelectParticipant[]
}

type LcuGameflowParticipant = {
  championId?: number
  puuid?: string
  selectedPosition?: string
  summonerId?: number
  summonerInternalName?: string
  summonerName?: string
}

type LcuGameflowSession = {
  gameData?: {
    queue?: {
      id?: number
      description?: string
      gameMode?: string
      name?: string
      shortName?: string
    }
    teamOne?: LcuGameflowParticipant[]
    teamTwo?: LcuGameflowParticipant[]
  }
}

type LcuSummonerIdentity = {
  displayName?: string
  gameName?: string
  internalName?: string
  puuid?: string
  summonerId?: number
  tagLine?: string
}

export const unavailableLcuAdapter: LcuAdapter = {
  async isAvailable() {
    return false
  },

  async readSession() {
    return null
  },
}

export function mapLcuQueueToMode(
  queueDescription?: string,
  queueId?: number,
): Exclude<GameMode, 'arena'> | null {
  if ([2400, 2401, 2403, 2405, 3240, 3270].includes(queueId ?? -1)) {
    return 'augment'
  }

  if ([400, 420, 430, 440, 490].includes(queueId ?? -1)) {
    return 'ranked'
  }

  const normalized = queueDescription?.toLowerCase() ?? ''

  if (normalized.includes('arena') || normalized.includes('海克斯')) {
    return 'augment'
  }

  if (normalized.includes('rank') || normalized.includes('normal') || normalized.includes('匹配') || normalized.includes('排位')) {
    return 'ranked'
  }

  return null
}

function mapLcuPositionToRole(position?: string) {
  const normalized = position?.toUpperCase() ?? ''
  const roles: Record<string, string> = {
    TOP: '上单',
    JUNGLE: '打野',
    MIDDLE: '中路',
    MID: '中路',
    BOTTOM: '下路',
    ADC: '下路',
    UTILITY: '辅助',
    SUPPORT: '辅助',
  }

  return roles[normalized] ?? undefined
}

async function readChampSelectPlayers(
  request: <T>(path: string) => Promise<T | null>,
): Promise<LcuPlayerSnapshot[]> {
  const champSelect = await request<LcuChampSelectSession>('/lol-champ-select/v1/session')
  if (!champSelect) return []

  const participants = [
    ...(champSelect.myTeam ?? []).map((player) => ({ ...player, team: 'ally' as const })),
    ...(champSelect.theirTeam ?? []).map((player) => ({ ...player, team: 'enemy' as const })),
  ].filter((player) => Number.isFinite(player.summonerId) || player.summonerName || player.puuid)

  const identities = await Promise.all(
    participants.map((player) =>
      player.summonerId
        ? request<LcuSummonerIdentity>(`/lol-summoner/v1/summoners/${player.summonerId}`)
        : Promise.resolve(null),
    ),
  )

  return participants.map((player, index) => {
    const identity = identities[index]
    const gameName = identity?.gameName ?? player.summonerName

    return {
      id: `${player.team}-${player.cellId ?? player.summonerId ?? index}`,
      team: player.team,
      role: mapLcuPositionToRole(player.assignedPosition),
      championId: player.championId && player.championId > 0 ? player.championId : undefined,
      summonerId: player.summonerId,
      summonerName: identity?.displayName ?? gameName ?? identity?.internalName,
      riotAccount: {
        gameName,
        puuid: identity?.puuid ?? player.puuid,
        tagLine: identity?.tagLine,
      },
    }
  })
}

async function readGameflowPlayers(
  request: <T>(path: string) => Promise<T | null>,
  gameflowSession: LcuGameflowSession | null,
  currentSummoner: { displayName?: string; gameName?: string; puuid?: string; summonerId?: number } | null,
): Promise<LcuPlayerSnapshot[]> {
  const isLocalPlayer = (player: LcuGameflowParticipant) =>
    (currentSummoner?.summonerId !== undefined && player.summonerId === currentSummoner.summonerId)
    || (Boolean(currentSummoner?.puuid) && player.puuid === currentSummoner?.puuid)
    || (Boolean(currentSummoner?.displayName) && player.summonerName === currentSummoner?.displayName)
    || (Boolean(currentSummoner?.gameName) && player.summonerName === currentSummoner?.gameName)
  const teamOne = gameflowSession?.gameData?.teamOne ?? []
  const teamTwo = gameflowSession?.gameData?.teamTwo ?? []
  const [allyTeam, enemyTeam] = teamTwo.some(isLocalPlayer) ? [teamTwo, teamOne] : [teamOne, teamTwo]
  const participants = [
    ...allyTeam.map((player) => ({ ...player, team: 'ally' as const })),
    ...enemyTeam.map((player) => ({ ...player, team: 'enemy' as const })),
  ].filter((player) => Number.isFinite(player.summonerId) || player.summonerName || player.summonerInternalName || player.puuid)

  const identities = await Promise.all(
    participants.map((player) =>
      player.summonerId
        ? request<LcuSummonerIdentity>(`/lol-summoner/v1/summoners/${player.summonerId}`)
        : Promise.resolve(null),
    ),
  )

  return participants.map((player, index) => {
    const identity = identities[index]
    const fallbackName = player.summonerName ?? player.summonerInternalName
    const gameName = identity?.gameName ?? fallbackName

    return {
      id: `${player.team}-${player.summonerId ?? player.puuid ?? index}`,
      team: player.team,
      role: mapLcuPositionToRole(player.selectedPosition),
      championId: player.championId && player.championId > 0 ? player.championId : undefined,
      summonerId: player.summonerId,
      summonerName: identity?.displayName ?? gameName ?? identity?.internalName,
      riotAccount: {
        gameName,
        puuid: identity?.puuid ?? player.puuid,
        tagLine: identity?.tagLine,
      },
    }
  })
}

export function parseLcuLockfile(rawLockfile: string): LcuLockfile | null {
  const parts = rawLockfile.trim().split(':')
  if (parts.length !== 5) return null

  const [name, pid, port, password, protocol] = parts
  const parsedPid = Number(pid)
  const parsedPort = Number(port)

  if (!name || !password || !Number.isInteger(parsedPid) || !Number.isInteger(parsedPort)) {
    return null
  }

  if (protocol !== 'http' && protocol !== 'https') {
    return null
  }

  return {
    name,
    password,
    pid: parsedPid,
    port: parsedPort,
    protocol,
  }
}

export function createLcuAuthHeader(password: string) {
  return `Basic ${btoa(`riot:${password}`)}`
}

export function createLcuBaseUrl(lockfile: LcuLockfile) {
  return `${lockfile.protocol}://127.0.0.1:${lockfile.port}`
}

export function createLcuAdapter(host: LcuAdapterHost): LcuAdapter {
  const readLockfile = async () => {
    const rawLockfile = await host.readLockfile()
    return rawLockfile ? parseLcuLockfile(rawLockfile) : null
  }

  return {
    async isAvailable() {
      return Boolean(await readLockfile())
    },

    async readSession() {
      const lockfile = await readLockfile()
      if (!lockfile) return null

      const baseUrl = createLcuBaseUrl(lockfile)
      const authHeader = createLcuAuthHeader(lockfile.password)
      const request = <T>(path: string) => host.requestJson<T>({ authHeader, baseUrl, path })

      const [phase, gameflowSession, currentSummoner] = await Promise.all([
        request<LcuGamePhase>('/lol-gameflow/v1/gameflow-phase'),
        request<LcuGameflowSession>('/lol-gameflow/v1/session'),
        request<{ displayName?: string; gameName?: string; puuid?: string; summonerId?: number }>('/lol-summoner/v1/current-summoner'),
      ])

      if (!phase) return null

      const queue = gameflowSession?.gameData?.queue
      const queueLabel = [queue?.name, queue?.shortName, queue?.description, queue?.gameMode].filter(Boolean).join(' ')
      const mode = mapLcuQueueToMode(queueLabel, queue?.id)
      const readsGameflowPlayers = phase === 'GameStart' || phase === 'InProgress' || phase === 'WaitingForStats'
      const players = phase === 'ChampSelect'
          ? await readChampSelectPlayers(request)
          : readsGameflowPlayers
          ? await readGameflowPlayers(request, gameflowSession, currentSummoner)
          : []

      return {
        phase,
        mode,
        queueId: queue?.id,
        localSummonerName: currentSummoner?.displayName ?? currentSummoner?.gameName,
        players,
        playerSource: phase === 'ChampSelect' ? 'champ-select' : readsGameflowPlayers ? 'gameflow' : undefined,
      }
    },
  }
}
