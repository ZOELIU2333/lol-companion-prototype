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
      players: [],
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
      players: [],
      source: 'live-client-data',
    })
    expect(tauriMocks.invoke).toHaveBeenCalledWith('read_live_client_snapshot')
  })

  it('normalizes both teams from the live client player list', async () => {
    tauriMocks.isTauri.mockReturnValue(true)
    // CN client: summonerName blank, identity via riotId; local player on CHAOS.
    tauriMocks.invoke.mockResolvedValue({
      gameTime: 300,
      currentItemIds: [3004],
      players: [
        {
          summonerName: '',
          riotId: '我本人#CN1',
          championName: 'Ezreal',
          team: 'CHAOS',
          position: 'BOTTOM',
          level: 6,
          isLocal: true,
          isBot: false,
          isDead: false,
          itemIds: [3004, 0],
          kills: 2,
          deaths: 1,
          assists: 3,
          creepScore: 80,
        },
        {
          summonerName: '',
          riotId: '敌方中单#CN1',
          championName: 'Ahri',
          team: 'ORDER',
          position: 'MIDDLE',
          level: 7,
          isLocal: false,
          isBot: false,
          isDead: true,
          itemIds: [6655],
          kills: 1,
          deaths: 2,
          assists: 0,
          creepScore: 95,
        },
      ],
      source: 'live-client-data',
    })

    const snapshot = await createTauriLiveClientDataHost()?.readSnapshot()
    const match = applyLiveClientSnapshotToMatch(mockMatches[0], snapshot ?? null)

    expect(match.liveState.players).toHaveLength(2)
    const [local, enemy] = match.liveState.players
    expect(local.isLocal).toBe(true)
    expect(local.team).toBe('ally')
    expect(local.championName).toBe('Ezreal')
    expect(local.position).toBe('下路')
    expect(local.itemIds).toEqual([3004])
    expect(enemy.team).toBe('enemy')
    expect(enemy.championName).toBe('Ahri')
    expect(enemy.isDead).toBe(true)
  })

  it('carries mayhem augment ids and names through the bridge', async () => {
    tauriMocks.isTauri.mockReturnValue(true)
    tauriMocks.invoke.mockResolvedValue({
      gameTime: 914,
      currentItemIds: [3004],
      selectedAugmentIds: [11, 12],
      selectedAugmentNames: ['法术苏醒', '现象级邪恶'],
      candidateAugmentIds: [21, 22, 23],
      players: [],
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
      players: [],
      source: 'live-client-data',
    })

    expect(live.liveState.selectedAugments).toEqual(['法术苏醒', '现象级邪恶'])
    expect(live.liveState.selectedAugmentIds).toEqual([11, 12])
    expect(live.liveState.candidateAugmentIds).toEqual([21, 22, 23])
    expect(live.liveState.isLiveDataAuthoritative).toBe(true)
  })

  it('clears demo augments when a real live snapshot exposes no augment data', () => {
    const live = applyLiveClientSnapshotToMatch(mockMatches[0], {
      gameTime: 600,
      currentItemIds: [3004],
      selectedAugmentIds: [],
      selectedAugmentNames: [],
      candidateAugmentIds: [],
      players: [],
      source: 'live-client-data',
    })

    expect(live.liveState.selectedAugments).toEqual([])
    expect(live.liveState.selectedAugmentIds).toEqual([])
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
      players: [],
      source: 'live-client-data',
    })

    expect(match.timer).toBe('02:06')
    expect(match.liveState.minute).toBe(2)
    expect(match.liveState.goldOnHand).toBe(820)
    expect(match.liveState.currentItems).toEqual(['item:1055', 'item:2003'])
    expect(match.liveState.currentSituation).toContain('Ezreal')
  })

  it('shows unknown instead of zero when gametime and gold are missing (playerlist only)', () => {
    // gamestats / activeplayer endpoints down: only the player list survived.
    const match = applyLiveClientSnapshotToMatch(mockMatches[0], {
      gameTime: null,
      currentGold: null,
      currentItemIds: [],
      players: [
        {
          summonerName: '我方上单',
          riotId: null,
          championName: 'Garen',
          team: 'ORDER',
          position: 'TOP',
          level: 4,
          isLocal: false,
          isBot: false,
          isDead: false,
          itemIds: [1054],
          kills: null,
          deaths: null,
          assists: null,
          creepScore: null,
        },
      ],
      source: 'live-client-data',
    })

    expect(match.liveState.minute).toBeNull()
    expect(match.liveState.goldOnHand).toBeNull()
    expect(match.timer).toBe(mockMatches[0].timer)
    expect(match.liveState.currentSituation).toContain('金币未同步')
    // The player list still projects through even without gametime/gold.
    expect(match.liveState.players).toHaveLength(1)
  })

  it('does not attribute another player to the local user when the active player is unmatched', async () => {
    // Rust returns isLocal=false for everyone when it cannot positively identify
    // the local player (no fallback to the first player). The bridge must preserve that.
    tauriMocks.isTauri.mockReturnValue(true)
    tauriMocks.invoke.mockResolvedValue({
      gameTime: 200,
      currentItemIds: [],
      championName: null,
      players: [
        {
          summonerName: '路人甲',
          riotId: null,
          championName: 'Lux',
          team: 'ORDER',
          position: 'MIDDLE',
          level: 5,
          isLocal: false,
          isBot: false,
          isDead: false,
          itemIds: [6655],
          kills: 0,
          deaths: 0,
          assists: 0,
          creepScore: 30,
        },
      ],
      source: 'live-client-data',
    })

    const snapshot = await createTauriLiveClientDataHost()?.readSnapshot()
    const match = applyLiveClientSnapshotToMatch(mockMatches[0], snapshot ?? null)

    expect(match.liveState.players.every((player) => !player.isLocal)).toBe(true)
    // With no local player, team side can't be anchored — stays null, never guessed.
    expect(match.liveState.players[0].team).toBeNull()
  })
})
