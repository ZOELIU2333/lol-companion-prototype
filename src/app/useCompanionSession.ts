import { useEffect, useMemo, useRef, useState } from 'react'
import { createArenaCatalogIndex, parseArenaCatalog, verifyArenaCatalogManifest } from '../features/arena/catalog/catalog'
import { loadCurrentGameData, type CurrentGameData } from '../features/arena/catalog/gameData'
import type { ArenaCatalogIndex } from '../features/arena/catalog/types'
import { createCompositeArenaSession } from '../features/arena/session/composite'
import { classifyArenaChange, createEmptyArenaSession, mergeArenaSession } from '../features/arena/session/fusion'
import { createManualArenaSessionStore } from '../features/arena/session/manualStore'
import {
  createManualArenaPersistence,
  isManualArenaSnapshotCompatible,
  type ManualArenaPersistence,
} from '../features/arena/session/manualPersistence'
import type { ArenaSession } from '../features/arena/session/types'
import { createArenaDecisionModel } from '../features/arena/ui/createDecisionModel'
import { useArenaTeammateRating } from '../features/arena/teammate/useArenaTeammateRating'
import { buildChatBrief } from '../lib/chatBrief'
import { createRecommendations } from '../lib/recommendations'
import { applyLcuPlayersToMatch, createCompanionDataSource } from '../services/companionDataSource'
import {
  applyLiveClientSnapshotToMatch,
  createLiveClientArenaPort,
  createTauriLiveClientDataHost,
  type LiveClientReading,
} from '../services/liveClientData'
import { loadOpggChampionDetail } from '../services/opggChampionData'
import { mockPluginActions } from '../services/pluginActions'
import {
  chooseLeagueInstallation,
  createTauriArenaLcuPort,
  createTauriOpggMcpHost,
  discardRuntimeCache,
  exportDesktopDiagnostics,
  isRunningInTauri,
  readDesktopHealth,
  setOverlayAlwaysOnTop,
  setOverlayCompact,
  tauriLcuAdapter,
  type DesktopHealthSnapshot,
} from '../services/tauriHost'
import type { ConnectionDiagnostic, DiagnosticStatus, GameMode, InfoPhase, PlayerFilter } from '../types'
import type { LcuGamePhase, LcuPlayerSnapshot } from '../services/lcuAdapter'
import { createTauriRiotApiHost } from '../services/tauriRiotHost'
import {
  deriveConnectionPresentation,
  type LcuEvidenceState,
} from './connectionEvidence'
import {
  deriveLiveSessionState,
  hasUsableLiveSnapshot,
  resolveAuthoritativeMode,
} from './liveSessionAuthority'

const companionDataSource = createCompanionDataSource(tauriLcuAdapter)
const pluginActions = mockPluginActions

function unavailableLiveReading(failureKind: LiveClientReading['failureKind'] = 'connection'): LiveClientReading {
  return { state: 'unavailable', snapshot: null, ageSeconds: null, failureKind }
}

function getShellDiagnostic(isDesktopShell: boolean): ConnectionDiagnostic {
  return isDesktopShell
    ? { id: 'shell', label: 'Desktop Shell', status: 'online', detail: '正在 Tauri 桌面壳内运行' }
    : { id: 'shell', label: 'Desktop Shell', status: 'demo', detail: '当前是浏览器 Demo，无法访问本机 LOL 进程' }
}

function getLcuDiagnostic(state: LcuEvidenceState, phase: LcuGamePhase | null): ConnectionDiagnostic {
  if (state === 'ready') {
    return { id: 'lcu', label: 'League Client', status: 'online', detail: `LCU phase: ${phase ?? 'Unknown'}，本地客户端接口可用` }
  }

  if (state === 'detecting') {
    return { id: 'lcu', label: 'League Client', status: 'checking', detail: '正在查找 LCU lockfile' }
  }

  return { id: 'lcu', label: 'League Client', status: 'offline', detail: 'LCU 暂时不可用；Live Client 仍会独立检测对局' }
}

function getLiveClientDiagnostic(hostReady: boolean, reading: LiveClientReading): ConnectionDiagnostic {
  if (!hostReady) {
    return { id: 'live-client', label: 'Live Client', status: 'demo', detail: '浏览器 Demo 无法访问本机游戏进程' }
  }

  if (reading.state === 'fresh' && reading.snapshot) {
    return { id: 'live-client', label: 'Live Client', status: 'online', detail: `127.0.0.1:2999 已连接，${Math.floor(reading.snapshot.gameTime / 60)} 分钟` }
  }

  if (reading.state === 'reconnecting' && reading.snapshot) {
    const age = reading.ageSeconds === null ? '' : `，最近数据为 ${Math.floor(reading.ageSeconds)} 秒前`
    return { id: 'live-client', label: 'Live Client', status: 'checking', detail: `2999 接口正在重连${age}` }
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
  const [matchIndex, setMatchIndex] = useState(0)
  const [activePhase, setActivePhase] = useState<InfoPhase>('pregame')
  const [lcuState, setLcuState] = useState<LcuEvidenceState>('detecting')
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true)
  const [isCompact, setIsCompact] = useState(false)
  const [playerFilter, setPlayerFilter] = useState<PlayerFilter>('ally')
  const [lcuPhase, setLcuPhase] = useState<LcuGamePhase | null>(null)
  const [lcuPlayers, setLcuPlayers] = useState<LcuPlayerSnapshot[]>([])
  const [localSummonerName, setLocalSummonerName] = useState<string>()
  const [liveReading, setLiveReading] = useState<LiveClientReading>(() => unavailableLiveReading())
  const [recommendationDataVersion, setRecommendationDataVersion] = useState(0)
  const [diagnosticRefreshKey, setDiagnosticRefreshKey] = useState(0)
  const [isChampionDataSyncing, setIsChampionDataSyncing] = useState(false)
  const [opggMcpStatus, setOpggMcpStatus] = useState<DiagnosticStatus>('checking')
  const [toast, setToast] = useState('')
  const [desktopHealth, setDesktopHealth] = useState<DesktopHealthSnapshot | null>(null)
  const [arenaCatalog, setArenaCatalog] = useState<ArenaCatalogIndex | null>(null)
  const [arenaGameData, setArenaGameData] = useState<CurrentGameData | null>(null)
  const [arenaSession, setArenaSession] = useState<ArenaSession>(() => createEmptyArenaSession())
  const arenaSessionRef = useRef(arenaSession)
  const restoredManualStoreRef = useRef<ReturnType<typeof createManualArenaSessionStore> | null>(null)
  const liveReadingRef = useRef(liveReading)
  const activeModeRef = useRef(activeMode)
  const isDesktopShell = useMemo(() => isRunningInTauri(), [])
  const liveClientDataHost = useMemo(() => createTauriLiveClientDataHost(), [])
  const opggMcpHost = useMemo(() => createTauriOpggMcpHost(), [])
  const riotApiHost = useMemo(() => createTauriRiotApiHost(), [])
  const manualArenaStore = useMemo(
    () => arenaCatalog
      ? createManualArenaSessionStore(new Set(arenaCatalog.catalog.augments.map((augment) => augment.id)))
      : null,
    [arenaCatalog],
  )
  const manualArenaPersistence = useMemo<ManualArenaPersistence | null>(
    () => arenaCatalog && typeof window !== 'undefined' && window.localStorage
      ? createManualArenaPersistence(
          window.localStorage,
          new Set(arenaCatalog.catalog.augments.map((augment) => augment.id)),
        )
      : null,
    [arenaCatalog],
  )

  const matches = useMemo(() => companionDataSource.listMatches(), [])
  const availableMatches = matches
  const liveSnapshot = liveReading.snapshot
  const liveSessionState = deriveLiveSessionState(liveReading)
  const connectionPresentation = useMemo(
    () => deriveConnectionPresentation({ lcuState, lcuPhase, live: liveReading }),
    [lcuPhase, lcuState, liveReading],
  )
  const baseMatch = availableMatches[matchIndex] ?? availableMatches[0]
  const match = useMemo(
    () => applyLiveClientSnapshotToMatch(applyLcuPlayersToMatch(baseMatch, lcuPlayers), liveSnapshot),
    [baseMatch, lcuPlayers, liveSnapshot],
  )
  const champion = match.champions.find((candidate) => candidate.id === match.currentChampionId) ?? match.champions[0]
  const effectivePhase: InfoPhase = activeMode === 'arena' ? 'live' : 'pregame'
  const recommendations = useMemo(
    () => {
      void recommendationDataVersion
      return createRecommendations(match, activeMode)
    },
    [activeMode, match, recommendationDataVersion],
  )
  const arenaDecisionModel = useMemo(
    () => activeMode === 'arena' && arenaCatalog && arenaGameData
      ? createArenaDecisionModel({ champion, session: arenaSession, catalog: arenaCatalog, gameData: arenaGameData })
      : null,
    [activeMode, arenaCatalog, arenaGameData, arenaSession, champion],
  )
  const arenaTeammateState = useArenaTeammateRating({
    mode: activeMode,
    lcuPhase,
    players: lcuPlayers,
    localSummonerName,
    championNames: arenaGameData?.champions,
    opggHost: opggMcpHost,
    riotHost: riotApiHost,
  })
  const arenaCandidateSlots = useMemo<readonly [number | null, number | null, number | null]>(() => {
    if (manualArenaStore?.read().candidates) return manualArenaStore.getCandidateSlots()
    return [
      arenaSession.candidates.value[0] ?? null,
      arenaSession.candidates.value[1] ?? null,
      arenaSession.candidates.value[2] ?? null,
    ]
  }, [arenaSession, manualArenaStore])
  const brief = useMemo(() => buildChatBrief(match, match.players), [match])
  const diagnostics = useMemo(
    () => [
      getShellDiagnostic(isDesktopShell),
      getLcuDiagnostic(lcuState, lcuPhase),
      getLiveClientDiagnostic(Boolean(liveClientDataHost), liveReading),
      getOpggDiagnostic(opggMcpStatus),
    ],
    [isDesktopShell, lcuPhase, lcuState, liveClientDataHost, liveReading, opggMcpStatus],
  )

  useEffect(() => {
    arenaSessionRef.current = arenaSession
  }, [arenaSession])

  useEffect(() => {
    liveReadingRef.current = liveReading
  }, [liveReading])

  useEffect(() => {
    activeModeRef.current = activeMode
  }, [activeMode])

  useEffect(() => {
    let isStale = false
    if (!isDesktopShell) {
      return () => { isStale = true }
    }
    void readDesktopHealth().then((health) => {
      if (!isStale) setDesktopHealth(health)
    })
    return () => { isStale = true }
  }, [diagnosticRefreshKey, isDesktopShell])

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      fetch('/data/arena/catalog.json', { signal: controller.signal }).then((response) => response.json()),
      fetch('/data/arena/manifest.json', { signal: controller.signal }).then((response) => response.json()),
      loadCurrentGameData((input, init) => fetch(input, { ...init, signal: controller.signal })),
    ]).then(async ([catalogValue, manifestValue, gameData]) => {
      const catalog = parseArenaCatalog(catalogValue)
      await verifyArenaCatalogManifest(catalog, manifestValue)
      if (!controller.signal.aborted) {
        setArenaCatalog(createArenaCatalogIndex(catalog))
        setArenaGameData(gameData)
      }
    }).catch(() => undefined)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (activeMode !== 'arena' || !manualArenaStore || !manualArenaPersistence) return
    if (restoredManualStoreRef.current === manualArenaStore) return

    const saved = manualArenaPersistence.load()
    if (!saved) {
      restoredManualStoreRef.current = manualArenaStore
      return
    }

    const current = arenaSessionRef.current
    const championKey = current.championKey.state === 'live' && current.championKey.source !== 'manual'
      ? current.championKey.value
      : null
    if (championKey === null) return

    const compatible = isManualArenaSnapshotCompatible(saved, {
      mode: current.mode.value,
      modeState: current.mode.state,
      championKey,
      gameTimeSeconds: current.gameTimeSeconds.state === 'live' || current.gameTimeSeconds.state === 'stale'
        ? current.gameTimeSeconds.value
        : null,
    })
    if (!compatible) {
      manualArenaPersistence.clear()
      restoredManualStoreRef.current = manualArenaStore
      return
    }

    manualArenaStore.restore({
      selectedAugmentIds: saved.selectedAugmentIds,
      candidateAugmentIds: saved.candidateAugmentIds,
    })
    const restored = mergeArenaSession(current, manualArenaStore.read())
    arenaSessionRef.current = restored
    setArenaSession(restored)
    restoredManualStoreRef.current = manualArenaStore
  }, [activeMode, arenaSession, manualArenaPersistence, manualArenaStore])

  useEffect(() => {
    if (activeMode !== 'arena' || !manualArenaStore || !arenaGameData) return undefined
    const controller = new AbortController()
    const championKeys = new Map<string, number>()
    arenaGameData.champions.forEach((definition) => {
      championKeys.set(definition.id.toLowerCase(), definition.key)
      championKeys.set(definition.name.toLowerCase(), definition.key)
    })
    const ports = [manualArenaStore.port]
    const lcuPort = createTauriArenaLcuPort()
    if (lcuPort) ports.push(lcuPort)
    if (liveClientDataHost) ports.push(createLiveClientArenaPort(liveClientDataHost, championKeys))
    const composite = createCompositeArenaSession(ports, arenaSessionRef.current)
    let timer: number | undefined
    let hasObserved = false
    const poll = async () => {
      try {
        const next = await composite.read(controller.signal)
        if (controller.signal.aborted) return
        const changes = classifyArenaChange(arenaSessionRef.current, next)
        if (changes.length > 0) {
          arenaSessionRef.current = next
          setArenaSession(next)
          if (hasObserved && changes.includes('notification-relevant')) setToast('竞技场构筑已根据实况更新')
        }
        hasObserved = true
      } catch {
        // Per-port health is already represented in the fused session.
      } finally {
        if (!controller.signal.aborted) timer = window.setTimeout(poll, 1500)
      }
    }
    void poll()
    return () => {
      controller.abort()
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [activeMode, arenaGameData, diagnosticRefreshKey, liveClientDataHost, manualArenaStore])

  useEffect(() => {
    let isStale = false
    let timer: number | undefined

    const detectSession = async () => {
      try {
        const session = await companionDataSource.detectSession()
        if (isStale || !session) return

        if (session.source === 'lcu') {
          if (!hasUsableLiveSnapshot(liveReadingRef.current)) {
            const detectedIndex = availableMatches.findIndex((candidate) => candidate.id === session.matchId)
            if (detectedIndex >= 0) {
              setMatchIndex(detectedIndex)
            }
          }

          const nextMode = resolveAuthoritativeMode({
            live: liveReadingRef.current,
            lcuMode: session.mode,
            fallbackMode: activeModeRef.current,
          })
          activeModeRef.current = nextMode
          setActiveMode(nextMode)
          setActivePhase(nextMode === 'arena' ? 'live' : 'pregame')
          setLcuState('ready')
          setLcuPhase(session.phase ?? null)
          setLocalSummonerName(session.localSummonerName)
          if ((session.players?.length ?? 0) > 0) {
            setLcuPlayers(session.players ?? [])
          } else if (!session.phase || ['None', 'Lobby', 'EndOfGame'].includes(session.phase)) {
            setLcuPlayers([])
          }
        } else {
          setLcuState('unavailable')
          setLcuPhase(null)
          setLocalSummonerName(undefined)
          setLcuPlayers([])
        }
      } catch {
        if (!isStale) {
          setLcuState('unavailable')
          setLcuPhase(null)
          setLocalSummonerName(undefined)
          setLcuPlayers([])
        }
      } finally {
        if (!isStale) timer = window.setTimeout(detectSession, 4000)
      }
    }

    void detectSession()

    return () => {
      isStale = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [availableMatches, diagnosticRefreshKey])

  useEffect(() => {
    if (!liveClientDataHost) {
      return undefined
    }

    let isStale = false
    let timer: number | undefined
    const readSnapshot = async () => {
      try {
        const reading = await liveClientDataHost.read()
        if (!isStale) {
          liveReadingRef.current = reading
          setLiveReading(reading)
          if (hasUsableLiveSnapshot(reading)) {
            const inferredMode = resolveAuthoritativeMode({
              live: reading,
              lcuMode: null,
              fallbackMode: activeModeRef.current,
            })
            activeModeRef.current = inferredMode
            setActiveMode(inferredMode)
            setActivePhase(inferredMode === 'arena' ? 'live' : 'pregame')

            const championName = reading.snapshot.championName?.toLowerCase()
            if (championName) {
              const detectedIndex = availableMatches.findIndex((candidate) =>
                candidate.mode === inferredMode
                && candidate.champions.some((entry) =>
                  entry.id.toLowerCase() === championName || entry.name.toLowerCase() === championName),
              )
              if (detectedIndex >= 0) setMatchIndex(detectedIndex)
            }
          }
        }
      } catch {
        if (!isStale) setLiveReading(unavailableLiveReading('client'))
      } finally {
        if (!isStale) timer = window.setTimeout(readSnapshot, 2500)
      }
    }

    void readSnapshot()

    return () => {
      isStale = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [availableMatches, diagnosticRefreshKey, liveClientDataHost])

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

  const refreshDiagnostics = () => {
    setDiagnosticRefreshKey((value) => value + 1)
    setToast('已刷新连接诊断')
  }

  const exportDiagnostics = async () => {
    try {
      const path = await exportDesktopDiagnostics()
      setToast('诊断包已导出')
      return path
    } catch (error) {
      setToast('诊断包导出失败')
      throw error
    }
  }

  const selectLeagueInstallation = async (kind: 'directory' | 'lockfile') => {
    try {
      const path = await chooseLeagueInstallation(kind)
      if (path) {
        setDiagnosticRefreshKey((value) => value + 1)
        setToast('已保存 League 客户端路径')
      }
      return path
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'League 路径验证失败')
      throw error
    }
  }

  const discardInvalidRuntimeCache = async () => {
    try {
      const removed = await discardRuntimeCache()
      setDiagnosticRefreshKey((value) => value + 1)
      setToast(removed ? '已丢弃无效缓存' : '没有需要清理的缓存')
      return removed
    } catch {
      setToast('缓存清理失败')
      return false
    }
  }

  const persistManualArenaState = (next: ArenaSession) => {
    if (!manualArenaPersistence || !Number.isInteger(next.championKey.value) || next.championKey.value === null) return
    const manual = manualArenaStore?.read()
    manualArenaPersistence.save({
      schemaVersion: 1,
      championKey: next.championKey.value,
      selectedAugmentIds: manual?.selectedAugments?.value ?? [],
      candidateAugmentIds: manual?.candidates?.value ?? [],
      gameTimeSeconds: Math.max(0, next.gameTimeSeconds.value),
    })
  }

  const applyManualArenaAction = (action: () => void, successMessage: string) => {
    if (!manualArenaStore) return
    try {
      action()
      const next = mergeArenaSession(arenaSessionRef.current, manualArenaStore.read())
      arenaSessionRef.current = next
      setArenaSession(next)
      restoredManualStoreRef.current = manualArenaStore
      persistManualArenaState(next)
      setToast(successMessage)
    } catch (error) {
      setToast(error instanceof Error ? error.message : '海克斯更新失败')
    }
  }

  const addSelectedArenaAugment = (augmentId: number) => {
    applyManualArenaAction(() => manualArenaStore?.addSelectedAugment(augmentId), '已添加已选海克斯')
  }

  const removeSelectedArenaAugment = (augmentId: number) => {
    applyManualArenaAction(() => manualArenaStore?.removeSelectedAugment(augmentId), '已撤销已选海克斯')
  }

  const setArenaCandidateSlot = (slot: 0 | 1 | 2, augmentId: number) => {
    applyManualArenaAction(() => manualArenaStore?.setCandidateSlot(slot, augmentId), `已更新候选 ${slot + 1}`)
  }

  const clearArenaCandidateSlot = (slot: 0 | 1 | 2) => {
    applyManualArenaAction(() => manualArenaStore?.clearCandidateSlot(slot), `已清空候选 ${slot + 1}`)
  }

  const confirmArenaCandidate = (augmentId: number) => {
    applyManualArenaAction(() => manualArenaStore?.confirmCandidate(augmentId), '已记录本轮选择')
  }

  const resetArenaMatch = () => {
    if (!manualArenaStore) return
    manualArenaStore.resetMatch()
    manualArenaPersistence?.clear()
    const empty = createEmptyArenaSession()
    const current = arenaSessionRef.current
    const next: ArenaSession = {
      ...current,
      championKey: current.championKey.source === 'manual' ? empty.championKey : current.championKey,
      selectedAugments: current.selectedAugments.source === 'manual' ? empty.selectedAugments : current.selectedAugments,
      candidates: current.candidates.source === 'manual' ? empty.candidates : current.candidates,
      capabilities: {
        ...current.capabilities,
        champion: current.championKey.source === 'manual' ? 'unavailable' : current.capabilities.champion,
        selectedAugments: current.selectedAugments.source === 'manual' ? 'unavailable' : current.capabilities.selectedAugments,
        candidates: current.candidates.source === 'manual' ? 'unavailable' : current.capabilities.candidates,
      },
    }
    arenaSessionRef.current = next
    setArenaSession(next)
    restoredManualStoreRef.current = manualArenaStore
    setToast('已重置本局海克斯')
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
    addSelectedArenaAugment,
    activeMode,
    activePhase,
    arenaDecisionModel,
    arenaCandidateSlots,
    arenaTeammateState,
    arenaSelectedAugmentIds: arenaSession.selectedAugments.value,
    applyLoadout,
    applyRunePage,
    brief,
    champion,
    connectionStatus: connectionPresentation.status,
    connectionStatusLabel: connectionPresentation.label,
    copyBrief,
    clearArenaCandidateSlot,
    diagnostics,
    desktopHealth,
    discardInvalidRuntimeCache,
    effectivePhase,
    exportDiagnostics,
    isAlwaysOnTop,
    isChampionDataSyncing,
    isCompact,
    isDetected: connectionPresentation.isDetected,
    hasRealPlayerIntel: lcuPlayers.length > 0,
    liveSessionState,
    lcuPhase,
    match,
    playerFilter,
    recommendations,
    refreshDiagnostics,
    removeSelectedArenaAugment,
    resetArenaMatch,
    selectLeagueInstallation,
    setArenaCandidateSlot,
    setActivePhase,
    setPlayerFilter,
    simulateSend,
    confirmArenaCandidate,
    toggleAlwaysOnTop,
    toggleCompact,
    toast,
  }
}
