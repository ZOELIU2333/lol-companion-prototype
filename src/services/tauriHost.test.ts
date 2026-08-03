import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  chooseLeagueInstallation,
  createTauriArenaLcuPort,
  discardRuntimeCache,
  exportDesktopDiagnostics,
  readDesktopHealth,
  setOverlayAlwaysOnTop,
  setOverlayCompact,
  tauriLcuAdapter,
} from './tauriHost'
import { createTauriRiotApiHost } from './tauriRiotHost'

const tauriMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  isTauri: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: tauriMocks.invoke,
  isTauri: tauriMocks.isTauri,
}))

describe('tauri host bridge', () => {
  beforeEach(() => {
    tauriMocks.invoke.mockReset()
    tauriMocks.isTauri.mockReset()
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
      localSummonerName: 'DemoSummoner',
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
      localSummonerName: 'DemoSummoner',
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

  it('reads capability-probed Arena fields through the Tauri port', async () => {
    tauriMocks.isTauri.mockReturnValue(true)
    tauriMocks.invoke.mockResolvedValue({
      mode: 'arena',
      championKey: 103,
      round: 2,
      selectedAugmentIds: [27],
      candidateAugmentIds: [],
      candidateCapability: 'unsupported',
      source: 'lcu',
    })
    const port = createTauriArenaLcuPort(() => 200)

    await expect(port?.read(new AbortController().signal)).resolves.toMatchObject({
      mode: { value: 'arena' },
      championKey: { value: 103 },
      round: { value: 2 },
      selectedAugments: { value: [27] },
      candidates: { value: [], state: 'unsupported' },
      capabilities: { candidates: 'unsupported' },
    })
    expect(tauriMocks.invoke).toHaveBeenCalledWith('read_arena_lcu_session')
  })

  it('proxies overlay window commands when running in Tauri', async () => {
    tauriMocks.isTauri.mockReturnValue(true)
    tauriMocks.invoke.mockResolvedValue(null)

    await expect(setOverlayAlwaysOnTop(true)).resolves.toBe(true)
    await expect(setOverlayCompact(true)).resolves.toBe(true)
    expect(tauriMocks.invoke).toHaveBeenCalledWith('set_overlay_always_on_top', { enabled: true })
    expect(tauriMocks.invoke).toHaveBeenCalledWith('set_overlay_compact', { enabled: true })
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

  it('reads typed desktop health and returns null outside Tauri', async () => {
    tauriMocks.isTauri.mockReturnValue(false)
    await expect(readDesktopHealth()).resolves.toBeNull()

    tauriMocks.isTauri.mockReturnValue(true)
    tauriMocks.invoke.mockResolvedValue({
      generatedAtMs: 123,
      shell: { code: 'shell', status: 'ready', detail: 'Tauri ready' },
      webview2: { code: 'webview2', status: 'ready', detail: 'WebView2 ready' },
    })
    await expect(readDesktopHealth()).resolves.toMatchObject({ generatedAtMs: 123 })
    expect(tauriMocks.invoke).toHaveBeenCalledWith('get_desktop_health')
  })

  it('exports diagnostics and discards a corrupt runtime cache through typed commands', async () => {
    tauriMocks.isTauri.mockReturnValue(true)
    tauriMocks.invoke
      .mockResolvedValueOnce('C:\\Logs\\LOL-Companion-diagnostics.zip')
      .mockResolvedValueOnce(true)

    await expect(exportDesktopDiagnostics()).resolves.toContain('diagnostics.zip')
    await expect(discardRuntimeCache()).resolves.toBe(true)
    expect(tauriMocks.invoke).toHaveBeenNthCalledWith(1, 'export_diagnostics')
    expect(tauriMocks.invoke).toHaveBeenNthCalledWith(2, 'discard_runtime_cache')
  })

  it('surfaces diagnostic export failure to the recovery UI', async () => {
    tauriMocks.isTauri.mockReturnValue(true)
    tauriMocks.invoke.mockRejectedValue(new Error('zip unavailable'))

    await expect(exportDesktopDiagnostics()).rejects.toThrow('zip unavailable')
  })

  it('opens the native League directory picker in Tauri', async () => {
    tauriMocks.isTauri.mockReturnValue(true)
    tauriMocks.invoke.mockResolvedValue('D:\\Riot Games\\League of Legends')

    await expect(chooseLeagueInstallation('directory')).resolves.toContain('League of Legends')
    expect(tauriMocks.invoke).toHaveBeenCalledWith('choose_league_installation', { kind: 'directory' })
  })

  it('does not open a League picker outside Tauri', async () => {
    tauriMocks.isTauri.mockReturnValue(false)

    await expect(chooseLeagueInstallation('lockfile')).resolves.toBeNull()
    expect(tauriMocks.invoke).not.toHaveBeenCalled()
  })
})
