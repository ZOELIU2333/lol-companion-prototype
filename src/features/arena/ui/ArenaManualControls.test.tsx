// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ArenaManualControls, type ArenaManualControlsProps } from './ArenaManualControls'
import { fixtureModel } from './testFixtures'

afterEach(cleanup)

function props(overrides: Partial<ArenaManualControlsProps> = {}): ArenaManualControlsProps {
  return {
    catalog: fixtureModel.catalog,
    selectedIds: [],
    candidateSlots: [null, null, null],
    onAddSelected: vi.fn(),
    onRemoveSelected: vi.fn(),
    onSetCandidateSlot: vi.fn(),
    onClearCandidateSlot: vi.fn(),
    onConfirmCandidate: vi.fn(),
    onResetMatch: vi.fn(),
    ...overrides,
  }
}

describe('Arena primary manual controls', () => {
  it('searches and adds an already selected augment', async () => {
    const user = userEvent.setup()
    const onAddSelected = vi.fn()
    render(<ArenaManualControls {...props({ onAddSelected })} />)

    await user.click(screen.getByRole('button', { name: '添加已选海克斯' }))
    await user.type(screen.getByRole('searchbox', { name: '搜索海克斯' }), 'Earthwake')
    await user.click(screen.getByRole('button', { name: /大地苏醒/ }))

    expect(onAddSelected).toHaveBeenCalledWith(27)
    expect(screen.getByRole('button', { name: '添加已选海克斯' })).toHaveFocus()
  })

  it('fills three fixed slots and confirms the chosen candidate', async () => {
    const user = userEvent.setup()
    const onConfirmCandidate = vi.fn()
    render(<ArenaManualControls {...props({
      candidateSlots: [27, 65, 135],
      onConfirmCandidate,
    })} />)

    expect(screen.getAllByTestId('arena-candidate-slot')).toHaveLength(3)
    await user.click(screen.getByRole('button', { name: '选择超凡邪恶' }))
    expect(onConfirmCandidate).toHaveBeenCalledWith(65)
  })

  it('disables selected and duplicate candidate results', async () => {
    const user = userEvent.setup()
    render(<ArenaManualControls {...props({ selectedIds: [27], candidateSlots: [65, null, null] })} />)

    await user.click(screen.getByRole('button', { name: '设置候选 2' }))
    await user.type(screen.getByRole('searchbox', { name: '搜索海克斯' }), 'Earthwake')
    expect(screen.getByRole('button', { name: /^大地苏醒：/ })).toBeDisabled()
    expect(screen.getByText('已在已选海克斯中')).toBeVisible()
  })

  it('supports selected undo, candidate clearing, and explicit reset confirmation', async () => {
    const user = userEvent.setup()
    const onRemoveSelected = vi.fn()
    const onClearCandidateSlot = vi.fn()
    const onResetMatch = vi.fn()
    render(<ArenaManualControls {...props({
      selectedIds: [27],
      candidateSlots: [65, null, null],
      onRemoveSelected,
      onClearCandidateSlot,
      onResetMatch,
    })} />)

    await user.click(screen.getByRole('button', { name: '撤销大地苏醒' }))
    await user.click(screen.getByRole('button', { name: '清除候选 1' }))
    await user.click(screen.getByRole('button', { name: '重置本局' }))
    expect(onResetMatch).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '确认重置本局' }))

    expect(onRemoveSelected).toHaveBeenCalledWith(27)
    expect(onClearCandidateSlot).toHaveBeenCalledWith(0)
    expect(onResetMatch).toHaveBeenCalledTimes(1)
  })
})
