import { useEffect, useMemo, useState } from 'react'
import { buildChatBrief } from '../lib/chatBrief'
import { createRecommendations } from '../lib/recommendations'
import { applyLcuPlayersToMatch, createCompanionDataSource } from '../services/companionDataSource'
import { applyLiveClientSnapshotToMatch, createTauriLiveClientDataHost, type LiveClientSnapshot } from '../services/liveClientData'
import { loadOpggChampionDetail } from '../services/opggChampionData'
import { mockPluginActions } from '../services/pluginActions'
import { createTauriOpggMcpHost, isRunningInTauri, setOverlayAlwaysOnTop, setOverlayCompact, tauriLcuAdapter } from '../services/tauriHost'
import type { ConnectionDiagnostic, DiagnosticStatus, GameMode, InfoPhase, PlayerFilter } from '../types'
import type { LcuGamePhase, LcuPlayerSnapshot } from '../services/lcuAdapter'
import type { MayhemRecommendationMode } from '../features/mayhem/types'

const companionDataSource = createCompanionDataSource(tauriLcuAdapter)
const pluginActions = mockPluginActions
const connectedPhases = new Set(['ChampSelect', 'GameStart', 'InProgress', 'WaitingForStats', 'EndOfGame'])

type ConnectionStatus = 'detecting' | 'demo' | 'client' | 'match'

const connectionLabels: Record<ConnectionStatus, string> = {
  detecting: '检测客户端中',
  demo: 'Demo 模式 · 未连接客户端',
  client: '已连接客户端',
  match: '已检测到对局',
}

function getShellDiagnostic(isDesktopShell: boolean): ConnectionDiagnostic {
  return isDesktopShell
    ? { id: 'shell', label: 'Desktop Shell', status: 'online', detail: '正在 Tauri 桌面壳内运行' }
    : { id: 'shell', label: 'Desktop Shell', status: 'demo', detail: '当前是浏览器 Demo，无法访问本机 LOL 进程' }
}

function getLcuDiagnostic(connectionStatus: ConnectionStatus, phase: LcuGamePhase | null): ConnectionDiagnostic {
  if (connectionStatus === 'match') {
    return { id: 'lcu', label: 'League Client', status: 'online', detail: `LCU phase: ${phase ?? 'Unknown'}，已检测到当前对局` }
  }

  if (connectionStatus === 'client') {
    return { id: 'lcu', label: 'League Client', status: 'online', detail: `LCU phase: ${phase ?? 'Unknown'}，等待选人或对局` }
  }

  if (connectionStatus === 'detecting') {
    return { id: 'lcu', label: 'League Client', status: 'checking', detail: '正在查找 LCU lockfile' }
  }

  return { id: 'lcu', label: 'League Client', status: 'demo', detail: '未连接客户端，当前使用 Demo 场景' }
}

function getLiveClientDiagnostic(hostReady: boolean, snapshot: LiveClientSnapshot | null): ConnectionDiagnostic {
  if (snapshot) {
    return { id: 'live-client', label: 'Live Client', status: 'online', detail: `127.0.0.1:2999 已连接，${Math.floor(snapshot.gameTime / 60)} 分钟` }
  }

  if (!hostReady) {
    return { id: 'live-client', label: 'Live Client', status: 'demo', detail: '浏览器 Demo 无法访问本机游戏进程' }
  }

  return { id: 'live-client', label: 'Live Client', status: 'offline', detail: '未进入游戏，或 2999 实时接口不可用' }
}

function getOpggDiagnostic(status: DiagnosticStatus): ConnectionDiagnostic {
  if (status === 'online') return { id: 'opgg', label: 'OP.GG MCP', status, detail: '最后一次请求成功，版本数据接口可用' }
  if (status === 'checking') return { id: 'opgg', label: 'OP.GG MCP', status, detail: '正在同步英雄版本数据' }
  if (status === 'demo') return { id: 'opgg', label: 'OP.GG MCP', status, detail: '浏览器 Demo 使用静态缓存，桌面壳内会走 MCP' }
  return { id: 'opgg', label: 'OP.GG MCP', status, detail: '最后一次请求失败，继续使用本地缓存' }
}

export function useCompanionSession() {
  const [activeMode, setActiveMode] = useState<GameMode>('ranked')
  const [mayhemRecommendationMode, setMayhemRecommendationMode] = useState<MayhemRecommendationMode>('strength')
  const [matchIndex, setMatchIndex] = useState(0)
  const [activePhase, setActivePhase] = useState<InfoPhase>('pregame')
  const [isDetected, setIsDetected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('detecting')
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true)
  const [isCompact, setIsCompact] = useState(false)
  const [playerFilter, setPlayerFilter] = useState<PlayerFilter>('ally')
  const [lcuPhase, setLcuPhase] = useState<LcuGamePhase | null>(null)
  const [lcuPlayers, setLcuPlayers] = useState<LcuPlayerSnapshot[]>([])
  const [liveSnapshot, setLiveSnapshot] = useState<LiveClientSnapshot | null>(null)
  const [recommendationDataVersion, setRecommendationDataVersion] = useState(0)
  const [diagnosticRefreshKey, setDiagnosticRefreshKey] = useState(0)
  const [isChampionDataSyncing, setIsChampionDataSyncing] = useState(false)
  const [opggMcpStatus, setOpggMcpStatus] = useState<DiagnosticStatus>('checking')
  const [toast, setToast] = useState('')
  const isDesktopShell = useMemo(() => isRunningInTauri(), [])
  const liveClientDataHost = useMemo(() => createTauriLiveClientDataHost(), [])
  const opggMcpHost = useMemo(() => createTauriOpggMcpHost(), [])

  const matches = useMemo(() => companionDataSource.listMatches(), [])
  const availableMatches = matches
  const baseMatch = availableMatches[matchIndex] ?? availableMatches[0]
  const match = useMemo(
    () => applyLiveClientSnapshotToMatch(applyLcuPlayersToMatch(baseMatch, lcuPlayers), liveSnapshot),
    [baseMatch, lcuPlayers, liveSnapshot],
  )
  const champion = match.champions.find((candidate) => candidate.id === match.currentChampionId) ?? match.champions[0]
  const effectivePhase: InfoPhase = activeMode === 'augment' ? 'live' : 'pregame'
  const recommendations = useMemo(
    () => {
      void recommendationDataVersion
      return createRecommendations(match, activeMode, mayhemRecommendationMode)
    },
    [activeMode, match, mayhemRecommendationMode, recommendationDataVersion],
  )
  const brief = useMemo(() => buildChatBrief(match, match.players), [match])
  const diagnostics = useMemo(
    () => [
      getShellDiagnostic(isDesktopShell),
      getLcuDiagnostic(connectionStatus, lcuPhase),
      getLiveClientDiagnostic(Boolean(liveClientDataHost), liveSnapshot),
      getOpggDiagnostic(opggMcpStatus),
    ],
    [connectionStatus, isDesktopShell, lcuPhase, liveClientDataHost, liveSnapshot, opggMcpStatus],
  )

  useEffect(() => {
    let isStale = false

    const detectSession = () => companionDataSource.detectSession().then((session) => {
      if (isStale || !session) return

      if (session.source === 'lcu') {
        const detectedIndex = availableMatches.findIndex((candidate) => candidate.id === session.matchId)
        if (detectedIndex >= 0) {
          setMatchIndex(detectedIndex)
        }

        setActiveMode(session.mode)
        setActivePhase(session.mode === 'augment' ? 'live' : 'pregame')
        setConnectionStatus(session.phase && connectedPhases.has(session.phase) ? 'match' : 'client')
        setLcuPhase(session.phase ?? null)
        setLcuPlayers(session.players ?? [])
        setIsDetected(true)
        return
      }

      setConnectionStatus('demo')
      setLcuPhase(null)
      setLcuPlayers([])
      setIsDetected(false)
    })

    detectSession()
    const interval = window.setInterval(detectSession, 4000)

    return () => {
      isStale = true
      window.clearInterval(interval)
    }
  }, [availableMatches, diagnosticRefreshKey])

  useEffect(() => {
    if (!liveClientDataHost) {
      return undefined
    }

    let isStale = false
    const readSnapshot = () => liveClientDataHost.readSnapshot().then((snapshot) => {
      if (!isStale) setLiveSnapshot(snapshot)
    })

    readSnapshot()
    const interval = window.setInterval(readSnapshot, 2500)

    return () => {
      isStale = true
      window.clearInterval(interval)
    }
  }, [diagnosticRefreshKey, liveClientDataHost])

  useEffect(() => {
    if (!toast) return undefined

    const timer = window.setTimeout(() => setToast(''), 1800)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!opggMcpHost || activeMode !== 'ranked') {
      const timer = window.setTimeout(() => {
        setIsChampionDataSyncing(false)
        setOpggMcpStatus(opggMcpHost ? 'online' : 'demo')
      }, 0)
      return () => window.clearTimeout(timer)
    }

    let isStale = false

    Promise.resolve()
      .then(() => {
        setIsChampionDataSyncing(true)
        setOpggMcpStatus('checking')
        return loadOpggChampionDetail(opggMcpHost, champion)
      })
      .then((detail) => {
        if (isStale) return
        setOpggMcpStatus(detail ? 'online' : 'offline')
        if (!detail) return
        setRecommendationDataVersion((version) => version + 1)
      })
      .finally(() => {
        if (!isStale) setIsChampionDataSyncing(false)
      })

    return () => {
      isStale = true
    }
  }, [activeMode, champion, diagnosticRefreshKey, opggMcpHost])

  const resetForMatch = (nextMode: GameMode) => {
    setIsDetected(false)
    setActiveMode(nextMode === 'arena' ? 'ranked' : nextMode)
    setPlayerFilter('ally')
    setActivePhase(nextMode === 'augment' ? 'live' : 'pregame')
    setLcuPlayers([])
    setLiveSnapshot(null)
  }

  const refreshMatch = () => {
    if (availableMatches.length === 0 || !match) return

    const currentVisibleIndex = availableMatches.findIndex((candidate) => candidate.id === match.id)
    const nextMatch = availableMatches[(currentVisibleIndex + 1) % availableMatches.length]
    const nextIndex = availableMatches.findIndex((candidate) => candidate.id === nextMatch.id)

    setMatchIndex(nextIndex)
    resetForMatch(nextMatch.mode)
    setToast('已刷新一组 Demo 对局')
  }

  const refreshDiagnostics = () => {
    setDiagnosticRefreshKey((value) => value + 1)
    setToast('已刷新连接诊断')
  }

  const selectScenario = (matchId: string) => {
    const nextIndex = availableMatches.findIndex((candidate) => candidate.id === matchId)
    if (nextIndex < 0) return

    const nextMatch = availableMatches[nextIndex]
    setMatchIndex(nextIndex)
    resetForMatch(nextMatch.mode)
    setToast('已切换 Demo 场景')
  }

  const copyBrief = async () => {
    try {
      await navigator.clipboard.writeText(brief)
      setToast('聊天简报已复制')
    } catch {
      setToast('当前浏览器不允许复制，请手动选择文本')
    }
  }

  const simulateSend = async () => {
    const result = await pluginActions.sendChatBrief(brief)
    setToast(result.message)
  }

  const applyLoadout = async (loadoutName: string) => {
    const result = await pluginActions.applyItemLoadout(loadoutName)
    setToast(result.message)
  }

  const applyRunePage = async (pageName: string) => {
    const result = await pluginActions.applyRunePage(pageName)
    setToast(result.message)
  }

  const toggleAlwaysOnTop = async () => {
    const nextValue = !isAlwaysOnTop
    const didApply = await setOverlayAlwaysOnTop(nextValue)
    setIsAlwaysOnTop(nextValue)
    setToast(didApply ? (nextValue ? '悬浮窗已置顶' : '悬浮窗取消置顶') : '浏览器 Demo 中暂不支持窗口置顶')
  }

  const toggleCompact = async () => {
    const nextValue = !isCompact
    const didApply = await setOverlayCompact(nextValue)
    setIsCompact(nextValue)
    setToast(didApply ? (nextValue ? '已切换紧凑窗口' : '已恢复标准窗口') : '浏览器 Demo 中暂不支持窗口缩放')
  }

  return {
    activeMode,
    activePhase,
    applyLoadout,
    applyRunePage,
    availableMatches,
    brief,
    champion,
    connectionStatus,
    connectionStatusLabel: connectionLabels[connectionStatus],
    copyBrief,
    diagnostics,
    effectivePhase,
    isAlwaysOnTop,
    isChampionDataSyncing,
    isCompact,
    isDetected,
    match,
    mayhemRecommendationMode,
    onMayhemModeChange: setMayhemRecommendationMode,
    playerFilter,
    recommendations,
    refreshDiagnostics,
    refreshMatch,
    selectScenario,
    setActivePhase,
    setPlayerFilter,
    simulateSend,
    toggleAlwaysOnTop,
    toggleCompact,
    toast,
  }
}
