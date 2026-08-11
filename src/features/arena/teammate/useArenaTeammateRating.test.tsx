// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LcuPlayerSnapshot } from '../../../services/lcuAdapter'
import { useArenaTeammateRating, type UseArenaTeammateRatingInput } from './useArenaTeammateRating'

afterEach(cleanup)

const players: LcuPlayerSnapshot[] = [
  {
    id: 'ally-0',
    isLocalPlayer: true,
    team: 'ally',
    summonerName: '我',
    riotAccount: { gameName: '我', tagLine: 'KR1' },
  },
  {
    id: 'ally-1',
    isLocalPlayer: false,
    team: 'ally',
    championId: 103,
    summonerName: '真实队友',
    riotAccount: { gameName: '真实队友', tagLine: 'KR1' },
  },
]

const match = (score: number) => ({
  champion: '阿狸', cs: '6.0', id: String(score), kda: '5/2/7', kp: 60,
  mode: '斗魂竞技场', result: '胜' as const, score, time: '刚刚',
})

function input(overrides: Partial<UseArenaTeammateRatingInput> = {}): UseArenaTeammateRatingInput {
  return {
    mode: 'arena',
    lcuPhase: 'ChampSelect',
    players,
    localSummonerName: '我',
    opggHost: {} as UseArenaTeammateRatingInput['opggHost'],
    riotHost: null,
    loaders: {
      loadOpgg: vi.fn().mockResolvedValue({ matches: [80, 79, 78, 77, 76, 75].map(match), profileWinRate: 56 }),
      loadRiot: vi.fn().mockResolvedValue({ matches: [] }),
    },
    ...overrides,
  }
}

describe('useArenaTeammateRating', () => {
  it('loads the real non-local ally during Arena champion select', async () => {
    const props = input()
    const { result } = renderHook(() => useArenaTeammateRating(props))

    await waitFor(() => expect(result.current.status).toBe('rated'))
    expect(result.current).toMatchObject({
      status: 'rated', teammateName: '真实队友', championId: 103,
      rating: { label: '上等马', source: 'opgg' },
    })
    expect(props.loaders?.loadOpgg).toHaveBeenCalledOnce()
  })

  it('stays hidden outside Arena champion select', () => {
    const props = input({ lcuPhase: 'Lobby' })
    const { result } = renderHook(() => useArenaTeammateRating(props))

    expect(result.current).toEqual({ status: 'hidden' })
    expect(props.loaders?.loadOpgg).not.toHaveBeenCalled()
  })

  it('falls back to Riot and keeps insufficient evidence honest', async () => {
    const loaders = {
      loadOpgg: vi.fn().mockResolvedValue({ matches: [match(55)] }),
      loadRiot: vi.fn().mockResolvedValue({ matches: [match(55), match(54)] }),
    }
    const props = input({ loaders })
    const { result } = renderHook(() => useArenaTeammateRating(props))

    await waitFor(() => expect(result.current.status).toBe('insufficient'))
    expect(result.current).toMatchObject({ status: 'insufficient', rating: { label: '情报不足', sampleSize: 2 } })
    expect(loaders.loadRiot).toHaveBeenCalledOnce()
  })
})
