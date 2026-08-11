import { describe, expect, it } from 'vitest'
import type { LiveClientReading } from '../services/liveClientData'
import {
  deriveLiveSessionState,
  hasUsableLiveSnapshot,
  resolveAuthoritativeMode,
} from './liveSessionAuthority'

const freshKiwi: LiveClientReading = {
  state: 'fresh',
  snapshot: {
    gameTime: 300,
    gameMode: 'KIWI',
    championName: 'Ezreal',
    currentItemIds: [],
    source: 'live-client-data',
  },
  ageSeconds: 0,
  failureKind: null,
}

describe('live session authority', () => {
  it('lets fresh KIWI data override a healthy ranked LCU session', () => {
    expect(resolveAuthoritativeMode({ live: freshKiwi, lcuMode: 'ranked', fallbackMode: 'ranked' })).toBe('arena')
    expect(deriveLiveSessionState(freshKiwi)).toBe('live')
    expect(hasUsableLiveSnapshot(freshKiwi)).toBe(true)
  })

  it('retains a valid reconnecting real snapshot', () => {
    const reconnecting: LiveClientReading = {
      ...freshKiwi,
      state: 'reconnecting',
      ageSeconds: 6,
      failureKind: 'timeout',
    }

    expect(deriveLiveSessionState(reconnecting)).toBe('reconnecting')
    expect(resolveAuthoritativeMode({ live: reconnecting, lcuMode: 'ranked', fallbackMode: 'ranked' })).toBe('arena')
  })

  it('does not let a later ranked LCU poll overwrite reconnecting Arena evidence', () => {
    const reconnecting: LiveClientReading = {
      ...freshKiwi,
      state: 'reconnecting',
      ageSeconds: 8,
      failureKind: 'timeout',
    }

    expect(resolveAuthoritativeMode({
      live: reconnecting,
      lcuMode: 'ranked',
      fallbackMode: 'arena',
    })).toBe('arena')
  })

  it('returns to waiting after the real snapshot is unavailable', () => {
    const unavailable: LiveClientReading = {
      state: 'unavailable',
      snapshot: null,
      ageSeconds: null,
      failureKind: 'connection',
    }

    expect(deriveLiveSessionState(unavailable)).toBe('waiting')
    expect(hasUsableLiveSnapshot(unavailable)).toBe(false)
  })
})
