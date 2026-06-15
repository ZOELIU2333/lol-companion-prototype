import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setOverlayAlwaysOnTop, setOverlayCompact, startOverlayDragging, tauriLcuAdapter } from './tauriHost'
import { createTauriRiotApiHost } from './tauriRiotHost'

const tauriMocks = vi.hoisted(() => ({
  getCurrentWindow: vi.fn(),
  invoke: vi.fn(),
  isTauri: vi.fn(),
  startDragging: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: tauriMocks.invoke,
  isTauri: tauriMocks.isTauri,
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: tauriMocks.getCurrentWindow,
}))

describe('tauri host bridge', () => {
  beforeEach(() => {
    tauriMocks.getCurrentWindow.mockReset()
    tauriMocks.invoke.mockReset()
    tauriMocks.isTauri.mockReset()
    tauriMocks.startDragging.mockReset()
    tauriMocks.getCurrentWindow.mockReturnValue({
      startDragging: tauriMocks.startDragging,
    })
  })

  it('returns null outside the Tauri shell', async () => {
    tauriMocks.isTauri.mockReturnValue(false)

    await expect(tauriLcuAdapter.isAvailable()).resolves.toBe(false)
    await expect(tauriLcuAdapter.readSession()).resolves.toBeNull()
    expect(tauriMocks.invoke).not.toHaveBeenCalled()
  })

  it('normalizes a Tauri LCU payload into an adapter snapshot', async () => {
    tauriMocks.isTauri.mockReturnValue(true)
    tauriMocks.invoke.mockResolvedValue({
      phase: 'ChampSelect',
      mode: 'ranked',
      queueId: 420,
      localSummonerName: 'DemoSummoner',
      playerSource: 'champ-select',
      players: [
        {
          id: 'ally-3',
          team: 'ally',
          role: '下路',
          summonerName: 'Live ADC',
          riotAccount: {
            gameName: 'Live ADC',
            puuid: 'ally-puuid',
            tagLine: 'KR1',
          },
        },
      ],
      source: 'lcu',
    })

    await expect(tauriLcuAdapter.isAvailable()).resolves.toBe(true)
    await expect(tauriLcuAdapter.readSession()).resolves.toEqual({
      phase: 'ChampSelect',
      mode: 'ranked',
      queueId: 420,
      localSummonerName: 'DemoSummoner',
      playerSource: 'champ-select',
      players: [
        {
          id: 'ally-3',
          team: 'ally',
          role: '下路',
          summonerName: 'Live ADC',
          riotAccount: {
            gameName: 'Live ADC',
            puuid: 'ally-puuid',
            tagLine: 'KR1',
          },
        },
      ],
    })
    expect(tauriMocks.invoke).toHaveBeenCalledWith('read_lcu_session')
  })

  it('rejects unknown phases from the host boundary', async () => {
    tauriMocks.isTauri.mockReturnValue(true)
    tauriMocks.invoke.mockResolvedValue({
      phase: 'UnexpectedPhase',
      mode: 'ranked',
      source: 'lcu',
    })

    await expect(tauriLcuAdapter.readSession()).resolves.toBeNull()
  })

  it('keeps a running League client connected while LCU is still unavailable', async () => {
    tauriMocks.isTauri.mockReturnValue(true)
    tauriMocks.invoke.mockResolvedValue({
      phase: 'ClientRunning',
      mode: null,
      source: 'lcu',
    })

    await expect(tauriLcuAdapter.readSession()).resolves.toEqual({
      phase: 'ClientRunning',
      mode: null,
      queueId: undefined,
      players: [],
      playerSource: undefined,
    })
  })

  it('proxies overlay window commands when running in Tauri', async () => {
    tauriMocks.isTauri.mockReturnValue(true)
    tauriMocks.invoke.mockResolvedValue(null)

    await expect(setOverlayAlwaysOnTop(true)).resolves.toBe(true)
    await expect(setOverlayCompact(true)).resolves.toBe(true)
    expect(tauriMocks.invoke).toHaveBeenCalledWith('set_overlay_always_on_top', { enabled: true })
    expect(tauriMocks.invoke).toHaveBeenCalledWith('set_overlay_compact', { enabled: true })
  })

  it('starts native window dragging when running in Tauri', async () => {
    tauriMocks.isTauri.mockReturnValue(true)
    tauriMocks.startDragging.mockResolvedValue(undefined)

    await expect(startOverlayDragging()).resolves.toBe(true)
    expect(tauriMocks.startDragging).toHaveBeenCalledOnce()
  })

  it('proxies Riot API reads through the Tauri backend', async () => {
    tauriMocks.isTauri.mockReturnValue(true)
    tauriMocks.invoke.mockResolvedValue({ ok: true })

    const host = createTauriRiotApiHost()
    await expect(host?.fetchJson('https://asia.api.riotgames.com/lol/match/v5/matches/KR_1')).resolves.toEqual({
      ok: true,
    })
    expect(tauriMocks.invoke).toHaveBeenCalledWith('riot_api_get', {
      url: 'https://asia.api.riotgames.com/lol/match/v5/matches/KR_1',
    })
  })
})
