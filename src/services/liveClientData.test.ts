import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockMatches } from '../data/mockMatches'
import { applyLiveClientSnapshotToMatch, createTauriLiveClientDataHost } from './liveClientData'

const tauriMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  isTauri: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: tauriMocks.invoke,
  isTauri: tauriMocks.isTauri,
}))

describe('live client data bridge', () => {
  beforeEach(() => {
    tauriMocks.invoke.mockReset()
    tauriMocks.isTauri.mockReset()
  })

  it('stays unavailable outside the Tauri shell', () => {
    tauriMocks.isTauri.mockReturnValue(false)

    expect(createTauriLiveClientDataHost()).toBeNull()
    expect(tauriMocks.invoke).not.toHaveBeenCalled()
  })

  it('reads and normalizes the Tauri live client snapshot', async () => {
    tauriMocks.isTauri.mockReturnValue(true)
    tauriMocks.invoke.mockResolvedValue({
      gameTime: 914.2,
      gameMode: 'CLASSIC',
      activePlayerName: 'Demo ADC',
      championName: 'Ezreal',
      level: 9,
      currentGold: 1475,
      currentItemIds: [3004, 3078, 0],
      source: 'live-client-data',
    })

    const host = createTauriLiveClientDataHost()

    await expect(host?.readSnapshot()).resolves.toEqual({
      gameTime: 914.2,
      gameMode: 'CLASSIC',
      activePlayerName: 'Demo ADC',
      championName: 'Ezreal',
      level: 9,
      currentGold: 1475,
      currentItemIds: [3004, 3078],
      selectedAugmentIds: [],
      selectedAugmentNames: [],
      candidateAugmentIds: [],
      source: 'live-client-data',
    })
    expect(tauriMocks.invoke).toHaveBeenCalledWith('read_live_client_snapshot')
  })

  it('carries mayhem augment ids and names through the bridge', async () => {
    tauriMocks.isTauri.mockReturnValue(true)
    tauriMocks.invoke.mockResolvedValue({
      gameTime: 914,
      currentItemIds: [3004],
      selectedAugmentIds: [11, 12],
      selectedAugmentNames: ['法术苏醒', '现象级邪恶'],
      candidateAugmentIds: [21, 22, 23],
      source: 'live-client-data',
    })

    const host = createTauriLiveClientDataHost()

    expect((await host?.readSnapshot())?.selectedAugmentIds).toEqual([11, 12])
    expect((await host?.readSnapshot())?.selectedAugmentNames).toEqual(['法术苏醒', '现象级邪恶'])
    expect((await host?.readSnapshot())?.candidateAugmentIds).toEqual([21, 22, 23])
  })

  it('overrides demo augments only when the live snapshot is authoritative', () => {
    const live = applyLiveClientSnapshotToMatch(mockMatches[0], {
      gameTime: 600,
      currentItemIds: [],
      selectedAugmentIds: [11, 12],
      selectedAugmentNames: ['法术苏醒', '现象级邪恶'],
      candidateAugmentIds: [21, 22, 23],
      source: 'live-client-data',
    })

    expect(live.liveState.selectedAugments).toEqual(['法术苏醒', '现象级邪恶'])
    expect(live.liveState.candidateAugmentIds).toEqual([21, 22, 23])
    expect(live.liveState.isLiveDataAuthoritative).toBe(true)
  })

  it('keeps demo augments when the live snapshot exposes no augment data', () => {
    const demoAugments = mockMatches[0].liveState.selectedAugments
    const live = applyLiveClientSnapshotToMatch(mockMatches[0], {
      gameTime: 600,
      currentItemIds: [3004],
      selectedAugmentIds: [],
      selectedAugmentNames: [],
      candidateAugmentIds: [],
      source: 'live-client-data',
    })

    expect(live.liveState.selectedAugments).toEqual(demoAugments)
    expect(live.liveState.candidateAugmentIds).toEqual([])
    expect(live.liveState.isLiveDataAuthoritative).toBe(false)
  })

  it('projects live client data into the match live state', () => {
    const match = applyLiveClientSnapshotToMatch(mockMatches[0], {
      gameTime: 126.9,
      gameMode: 'CLASSIC',
      activePlayerName: 'Demo ADC',
      championName: 'Ezreal',
      level: 3,
      currentGold: 820,
      currentItemIds: [1055, 2003],
      source: 'live-client-data',
    })

    expect(match.timer).toBe('02:06')
    expect(match.liveState.minute).toBe(2)
    expect(match.liveState.goldOnHand).toBe(820)
    expect(match.liveState.currentItems).toEqual(['item:1055', 'item:2003'])
    expect(match.liveState.currentSituation).toContain('Ezreal')
  })
})
