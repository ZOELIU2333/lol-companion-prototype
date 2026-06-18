import { describe, expect, it } from 'vitest'
import type { LiveClientSnapshot } from './liveClientData'
import { hasMeaningfulLiveData, isSessionActive, mapLiveGameModeToMode, resolveActiveMode } from './sessionVisibility'

function snapshot(overrides: Partial<LiveClientSnapshot>): LiveClientSnapshot {
  return {
    gameTime: null,
    gameMode: null,
    activePlayerName: null,
    championName: null,
    level: null,
    currentGold: null,
    currentItemIds: [],
    selectedAugmentIds: [],
    selectedAugmentNames: [],
    candidateAugmentIds: [],
    players: [],
    source: 'live-client-data',
    ...overrides,
  }
}

describe('session visibility', () => {
  it('treats a null snapshot as no live data', () => {
    expect(hasMeaningfulLiveData(null)).toBe(false)
  })

  it('treats an empty snapshot (no gametime, players, gold, items) as no live data', () => {
    expect(hasMeaningfulLiveData(snapshot({}))).toBe(false)
  })

  it('recognises live data from game time alone', () => {
    expect(hasMeaningfulLiveData(snapshot({ gameTime: 0 }))).toBe(true)
  })

  it('recognises live data from a populated player list alone', () => {
    expect(
      hasMeaningfulLiveData(
        snapshot({
          players: [
            {
              summonerName: '我本人',
              riotId: null,
              championName: 'Ezreal',
              team: 'ORDER',
              position: 'BOTTOM',
              level: 5,
              isLocal: true,
              isBot: false,
              isDead: false,
              itemIds: [3004],
              kills: 0,
              deaths: 0,
              assists: 0,
              creepScore: 20,
            },
          ],
        }),
      ),
    ).toBe(true)
  })

  it('recognises live data from gold or items alone', () => {
    expect(hasMeaningfulLiveData(snapshot({ currentGold: 500 }))).toBe(true)
    expect(hasMeaningfulLiveData(snapshot({ currentItemIds: [3004] }))).toBe(true)
  })

  it('shows an active session from live data even when LCU is disconnected', () => {
    // P1#1: lockfile/LCU failed (status "disconnected") but 2999 returned real data.
    expect(isSessionActive('disconnected', true)).toBe(true)
    expect(isSessionActive('client', true)).toBe(true)
  })

  it('shows an active session when the LCU phase reached match, regardless of live data', () => {
    expect(isSessionActive('match', false)).toBe(true)
  })

  it('stays inactive when neither LCU match nor live data is present', () => {
    expect(isSessionActive('disconnected', false)).toBe(false)
    expect(isSessionActive('syncing', false)).toBe(false)
  })

  it('maps reliable live game modes but never guesses ambiguous ones', () => {
    // Reliable: Arena (CHERRY) uses augments; Summoner's Rift (CLASSIC) is ranked.
    expect(mapLiveGameModeToMode('CHERRY')).toBe('augment')
    expect(mapLiveGameModeToMode('cherry')).toBe('augment')
    expect(mapLiveGameModeToMode('CLASSIC')).toBe('ranked')
    // ARAM is ambiguous (plain ARAM vs Mayhem share it) — must NOT be guessed.
    expect(mapLiveGameModeToMode('ARAM')).toBeNull()
    // Unknown / missing modes never produce a guessed mode.
    expect(mapLiveGameModeToMode('ULTBOOK')).toBeNull()
    expect(mapLiveGameModeToMode(null)).toBeNull()
    expect(mapLiveGameModeToMode(undefined)).toBeNull()
  })

  it('does not carry augment mode into a plain ARAM session', () => {
    // Queue 450 gives no augment mode, and the 2999 feed only says ARAM.
    // Resolve from current signals, not the previous session's UI state.
    expect(resolveActiveMode(null, 'ARAM')).toBe('ranked')
  })

  it('prefers an explicit LCU Mayhem queue over the ambiguous ARAM live label', () => {
    expect(resolveActiveMode('augment', 'ARAM')).toBe('augment')
  })

  it('uses reliable live modes when LCU is unavailable', () => {
    expect(resolveActiveMode(null, 'CHERRY')).toBe('augment')
    expect(resolveActiveMode(null, 'CLASSIC')).toBe('ranked')
  })
})
