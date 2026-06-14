import { describe, expect, it } from 'vitest'
import { shouldStartWindowDrag } from './windowDrag'

function createTarget(interactiveSelector?: string) {
  return {
    closest(selectors: string) {
      return interactiveSelector && selectors.includes(interactiveSelector) ? this : null
    },
  } as unknown as EventTarget
}

describe('window drag guard', () => {
  it('allows primary-button dragging from ordinary content', () => {
    const target = createTarget()

    expect(shouldStartWindowDrag(target, 0)).toBe(true)
  })

  it.each([
    'button',
    'a',
    'input',
    '[role="button"]',
    '[role="dialog"]',
    '[data-no-window-drag]',
    '[data-tauri-drag-region="false"]',
  ])('does not drag from interactive selector: %s', (selector) => {
    expect(shouldStartWindowDrag(createTarget(selector), 0)).toBe(false)
  })

  it('ignores non-primary mouse buttons', () => {
    const target = createTarget()

    expect(shouldStartWindowDrag(target, 2)).toBe(false)
  })
})
