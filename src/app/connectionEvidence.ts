import type { LcuGamePhase } from '../services/lcuAdapter'
import type { LiveClientReading } from '../services/liveClientData'

export type LcuEvidenceState = 'detecting' | 'ready' | 'unavailable'
export type ConnectionStatus = 'detecting' | 'demo' | 'client' | 'match' | 'reconnecting'
export type ConnectionPresentation = {
  status: ConnectionStatus
  label: string
  isDetected: boolean
}

const matchPhases = new Set<LcuGamePhase>([
  'ChampSelect', 'GameStart', 'InProgress', 'WaitingForStats', 'EndOfGame',
])

export function deriveConnectionPresentation(input: {
  lcuState: LcuEvidenceState
  lcuPhase: LcuGamePhase | null
  live: LiveClientReading
}): ConnectionPresentation {
  if (input.live.state === 'fresh' && input.live.snapshot) {
    return {
      status: 'match',
      label: input.lcuState === 'ready' ? '实时对局' : '实时对局 · LCU 待恢复',
      isDetected: true,
    }
  }

  if (input.live.state === 'reconnecting' && input.live.snapshot) {
    const age = input.live.ageSeconds === null ? '' : ` · ${Math.floor(input.live.ageSeconds)} 秒前`
    return { status: 'reconnecting', label: `实时数据重连中${age}`, isDetected: true }
  }

  if (input.lcuState === 'ready') {
    return matchPhases.has(input.lcuPhase ?? 'None')
      ? { status: 'match', label: '已检测到对局', isDetected: true }
      : { status: 'client', label: '已连接客户端', isDetected: true }
  }

  if (input.lcuState === 'detecting') {
    return { status: 'detecting', label: '检测客户端中', isDetected: false }
  }

  return { status: 'demo', label: 'Demo 模式 · 未连接客户端', isDetected: false }
}
