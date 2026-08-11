import { describe, expect, it } from 'vitest'
import type { LiveClientReading } from '../services/liveClientData'
import { deriveConnectionPresentation } from './connectionEvidence'

const unavailable: LiveClientReading = {
  state: 'unavailable', snapshot: null, ageSeconds: null, failureKind: 'connection',
}
const fresh: LiveClientReading = {
  state: 'fresh',
  snapshot: {
    gameTime: 120, gameMode: 'CHERRY', currentItemIds: [], source: 'live-client-data',
  },
  ageSeconds: 0,
  failureKind: null,
}
const reconnecting: LiveClientReading = {
  ...fresh, state: 'reconnecting', ageSeconds: 6, failureKind: 'timeout',
}

describe('connection evidence presentation', () => {
  it('keeps an available LCU client out of Demo mode', () => {
    expect(deriveConnectionPresentation({ lcuState: 'ready', lcuPhase: 'Lobby', live: unavailable }))
      .toEqual({ status: 'client', label: '已连接客户端', isDetected: true })
  })

  it('uses fresh Live Client evidence even when LCU is unavailable', () => {
    expect(deriveConnectionPresentation({ lcuState: 'unavailable', lcuPhase: null, live: fresh }))
      .toEqual({ status: 'match', label: '实时对局 · LCU 待恢复', isDetected: true })
  })

  it('shows the age while retaining a reconnecting snapshot', () => {
    expect(deriveConnectionPresentation({ lcuState: 'unavailable', lcuPhase: null, live: reconnecting }))
      .toEqual({ status: 'reconnecting', label: '实时数据重连中 · 6 秒前', isDetected: true })
  })

  it('shows a waiting state when both real sources are unavailable', () => {
    expect(deriveConnectionPresentation({ lcuState: 'unavailable', lcuPhase: null, live: unavailable }))
      .toEqual({ status: 'offline', label: '未连接客户端 · 等待进入游戏', isDetected: false })
  })

  it('recognizes a match phase from LCU without Live Client', () => {
    expect(deriveConnectionPresentation({ lcuState: 'ready', lcuPhase: 'ChampSelect', live: unavailable }))
      .toEqual({ status: 'match', label: '已检测到对局', isDetected: true })
  })
})
