import { useEffect, useMemo, useState } from 'react'
import { buildChatBrief } from '../lib/chatBrief'
import { createCompanionDataSource } from '../services/companionDataSource'
import { emptyRecommendations } from '../services/emptyRecommendations'
import { applyLiveClientSnapshotToMatch, createTauriLiveClientDataHost, type LiveClientSnapshot } from '../services/liveClientData'
import { createLcuMatch } from '../services/lcuMatch'
import { loadOpggChampionDetail } from '../services/opggChampionData'
import { mockPluginActions } from '../services/pluginActions'
import { createTauriOpggMcpHost, isRunningInTauri, setOverlayAlwaysOnTop, setOverlayCompact, tauriLcuAdapter } from '../services/tauriHost'
import type { ConnectionDiagnostic, DiagnosticStatus, GameMode, InfoPhase, PlayerFilter } from '../types'
import type { LcuGamePhase } from '../services/lcuAdapter'
import type { MayhemRecommendationMode } from '../features/mayhem/types'

const companionDataSource = createCompanionDataSource(tauriLcuAdapter)
const pluginActions = mockPluginActions
const connectedPhases = new Set(['ChampSelect', 'GameStart', 'InProgress', 'WaitingForStats', 'EndOfGame'])
const idleMatch = createLcuMatch({ matchId: null, mode: null, source: 'lcu' })

type ConnectionStatus = 'detecting' | 'disconnected' | 'client' | 'syncing' | 'match'

const connectionLabels: Record<ConnectionStatus, string> = {
  detecting: '检测客户端中',
  disconnected: '等待 League Client',
  client: '已连接客户端',
  syncing: '正在识别当前对局',
  match: '已检测到对局',
}

function getShellDiagnostic(isDesktopShell: boolean): ConnectionDiagnostic {
  return isDesktopShell
    ? { id: 'shell', label: 'Desktop Shell', status: 'online', detail: '正在 Tauri 桌面壳内运行' }
    : { id: 'shell', label: 'Desktop Shell', status: 'offline', detail: '当前不在桌面壳内，无法访问本机 LOL 进程' }
}

function getLcuDiagnostic(
  connectionStatus: ConnectionStatus,
  phase: LcuGamePhase | null,
  queueId: number | null,
  playerSource: 'champ-select' | 'gameflow' | null,
): ConnectionDiagnostic {
  if (connectionStatus === 'match') {
    const source = playerSource ? `，玩家来源: ${playerSource}` : ''
    return { id: 'lcu', label: 'League Client', status: 'online', detail: `LCU phase: ${phase ?? 'Unknown'}，队列 ${queueId ?? 'Unknown'}${source}` }
  }

  if (connectionStatus === 'syncing') {
    return {
      id: 'lcu',
      label: 'League Client',
      status: 'checking',
      detail: `LCU phase: ${phase ?? 'Unknown'}，队列 ${queueId ?? 'Unknown'} 尚未映射，已停止使用默认模式`,
    }
  }

  if (connectionStatus === 'client') {
    if (phase === 'ClientRunning') {
      return { id: 'lcu', label: 'League Client', status: 'online', detail: '已检测到 League Client 进程，正在等待 LCU 接口就绪' }
    }

    return { id: 'lcu', label: 'League Client', status: 'online', detail: `LCU phase: ${phase ?? 'Unknown'}，等待选人或对局` }
  }

  if (connectionStatus === 'detecting') {
    return { id: 'lcu', label: 'League Client', status: 'checking', detail: '正在查找 LCU lockfile' }
  }

  return { id: 'lcu', label: 'League Client', status: 'offline', detail: '未发现 League Client，应用会继续自动检测' }
}

function getLiveClientDiagnostic(hostReady: boolean, snapshot: LiveClientSnapshot | null): ConnectionDiagnostic {
  if (snapshot) {
    return { id: 'live-client', label: 'Live Client', status: 'online', detail: `127.0.0.1:2999 已连接，${Math.floor(snapshot.gameTime / 60)} 分钟` }
  }

  if (!hostReady) {
    return { id: 'live-client', label: 'Live Client', status: 'offline', detail: '当前环境无法访问本机游戏进程' }
  }

  return { id: 'live-client', label: 'Live Client', status: 'offline', detail: '未进入游戏，或 2999 实时接口不可用' }
}

function getOpggDiagnostic(status: DiagnosticStatus): ConnectionDiagnostic {
  if (status === 'online') return { id: 'opgg', label: 'OP.GG MCP', status, detail: '最后一次请求成功，版本数据接口可用' }
  if (status === 'checking') return { id: 'opgg', label: 'OP.GG MCP', status, detail: '正在同步英雄版本数据' }
  return { id: 'opgg', label: 'OP.GG MCP', status, detail: '最后一次请求失败，继续使用本地缓存' }
}

export function useCompanionSession() {
  const [activeMode, setActiveMode] = useState<GameMode>('ranked')
  const [mayhemRecommendationMode, setMayhemRecommendationMode] = useState<MayhemRecommendationMode>('strength')
  const [activePhase, setActivePhase] = useState<InfoPhase>('pregame')
  const [isDetected, setIsDetected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('detecting')
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true)
  const [isCompact, setIsCompact] = useState(false)
  const [playerFilter, setPlayerFilter] = useState<PlayerFilter>('ally')
  const [lcuPhase, setLcuPhase] = useState<LcuGamePhase | null>(null)
  const [lcuQueueId, setLcuQueueId] = useState<number | null>(null)
  const [lcuPlayerSource, setLcuPlayerSource] = useState<'champ-select' | 'gameflow' | null>(null)
  const [lcuMatch, setLcuMatch] = useState<ReturnType<typeof createLcuMatch> | null>(null)
  const [liveSnapshot, setLiveSnapshot] = useState<LiveClientSnapshot | null>(null)
  const [diagnosticRefreshKey, setDiagnosticRefreshKey] = useState(0)
  const [isChampionDataSyncing, setIsChampionDataSyncing] = useState(false)
  const [opggMcpStatus, setOpggMcpStatus] = useState<DiagnosticStatus>('checking')
  const [toast, setToast] = useState('')
  const isDesktopShell = useMemo(() => isRunningInTauri(), [])
  const liveClientDataHost = useMemo(() => createTauriLiveClientDataHost(), [])
  const opggMcpHost = useMemo(() => createTauriOpggMcpHost(), [])

  const availableMatches = useMemo(() => companionDataSource.listMatches(), [])
  const baseMatch = lcuMatch ?? idleMatch
  const match = useMemo(
    () => applyLiveClientSnapshotToMatch(baseMatch, liveSnapshot),
    [baseMatch, liveSnapshot],
  )
  const champion = match.champions.find((candidate) => candidate.id === match.currentChampionId) ?? match.champions[0]
  const effectivePhase: InfoPhase = activeMode === 'augment' ? 'live' : 'pregame'
  const recommendations = emptyRecommendations
  const brief = useMemo(() => buildChatBrief(match, match.players), [match])
  const diagnostics = useMemo(
    () => [
      getShellDiagnostic(isDesktopShell),
      getLcuDiagnostic(connectionStatus, lcuPhase, lcuQueueId, lcuPlayerSource),
      getLiveClientDiagnostic(Boolean(liveClientDataHost), liveSnapshot),
      getOpggDiagnostic(opggMcpStatus),
    ],
    [connectionStatus, isDesktopShell, lcuPhase, lcuPlayerSource, lcuQueueId, liveClientDataHost, liveSnapshot, opggMcpStatus],
  )

  useEffect(() => {
    let isStale = false

    const detectSession = () => companionDataSource.detectSession().then((session) => {
      if (isStale) return

      if (!session) {
        setConnectionStatus('disconnected')
        setLcuPhase(null)
        setLcuQueueId(null)
        setLcuPlayerSource(null)
        setLcuMatch(null)
        setLiveSnapshot(null)
        setIsDetected(false)
        return
      }

      if (session.source === 'lcu') {
        if (session.mode) {
          setActiveMode(session.mode)
          setActivePhase(session.mode === 'augment' ? 'live' : 'pregame')
        }
        const isActivePhase = Boolean(session.phase && connectedPhases.has(session.phase))
        setConnectionStatus(isActivePhase ? (session.mode ? 'match' : 'syncing') : 'client')
        setLcuPhase(session.phase ?? null)
        setLcuQueueId(session.queueId ?? null)
        setLcuPlayerSource(session.playerSource ?? null)
        setLcuMatch(session.mode ? createLcuMatch(session) : null)
        setIsDetected(isActivePhase && Boolean(session.mode))
        return
      }

      setConnectionStatus('disconnected')
      setLcuPhase(null)
      setLcuQueueId(null)
      setLcuPlayerSource(null)
      setLcuMatch(null)
      setIsDetected(false)
    })

    detectSession()
    const interval = window.setInterval(detectSession, 4000)

    return () => {
      isStale = true
      window.clearInterval(interval)
    }
  }, [diagnosticRefreshKey])

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
    const hasVisibleSession = connectionStatus === 'match'
    if (!hasVisibleSession || !opggMcpHost || activeMode !== 'ranked' || !champion?.name) {
      const timer = window.setTimeout(() => {
        setIsChampionDataSyncing(false)
        setOpggMcpStatus(opggMcpHost ? 'online' : 'offline')
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
      })
      .finally(() => {
        if (!isStale) setIsChampionDataSyncing(false)
      })

    return () => {
      isStale = true
    }
  }, [activeMode, champion, connectionStatus, diagnosticRefreshKey, opggMcpHost])

  const refreshMatch = () => {
    setDiagnosticRefreshKey((value) => value + 1)
    setToast('已重新检测客户端')
  }

  const refreshDiagnostics = () => {
    setDiagnosticRefreshKey((value) => value + 1)
    setToast('已刷新连接诊断')
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
    setToast(didApply ? (nextValue ? '悬浮窗已置顶' : '悬浮窗取消置顶') : '浏览器预览中暂不支持窗口置顶')
  }

  const toggleCompact = async () => {
    const nextValue = !isCompact
    const didApply = await setOverlayCompact(nextValue)
    setIsCompact(nextValue)
    setToast(didApply ? (nextValue ? '已切换紧凑窗口' : '已恢复标准窗口') : '浏览器预览中暂不支持窗口缩放')
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
    isDemoEnabled: false,
    hasActiveSession: connectionStatus === 'match',
    isClientConnected: connectionStatus === 'client' || connectionStatus === 'syncing' || connectionStatus === 'match',
    match,
    mayhemRecommendationMode,
    onMayhemModeChange: setMayhemRecommendationMode,
    playerFilter,
    recommendations,
    refreshDiagnostics,
    refreshMatch,
    selectScenario: () => undefined,
    setActivePhase,
    setPlayerFilter,
    simulateSend,
    toggleAlwaysOnTop,
    toggleCompact,
    toast,
  }
}
