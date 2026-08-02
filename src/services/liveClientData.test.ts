import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockMatches } from '../data/mockMatches'
import { applyLiveClientSnapshotToMatch, createLiveClientArenaPort, createTauriLiveClientDataHost } from './liveClientData'

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
      source: 'live-client-data',
    })
    expect(tauriMocks.invoke).toHaveBeenCalledWith('read_live_client_snapshot')
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

  it('projects automatic fields into an Arena session port', async () => {
    const port = createLiveClientArenaPort({
      readSnapshot: async () => ({
        gameTime: 126.9,
        gameMode: 'CHERRY',
        championName: 'Ezreal',
        level: 3,
        currentGold: 820,
        currentItemIds: [1055, 2003],
        source: 'live-client-data',
      }),
    }, new Map([['ezreal', 81]]), () => 200)

    await expect(port.read(new AbortController().signal)).resolves.toMatchObject({
      mode: { value: 'arena', source: 'live-client' },
      championKey: { value: 81 },
      level: { value: 3 },
      gold: { value: 820 },
      itemIds: { value: [1055, 2003] },
      gameTimeSeconds: { value: 126.9 },
      capabilities: { candidates: 'unsupported' },
    })
  })
})
