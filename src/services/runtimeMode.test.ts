import { describe, expect, it } from 'vitest'
import { isDevelopmentDemoEnabled } from './runtimeMode'

describe('runtime mode', () => {
  it('enables demo data only through an explicit true flag', () => {
    expect(isDevelopmentDemoEnabled('true')).toBe(true)
    expect(isDevelopmentDemoEnabled('TRUE')).toBe(false)
    expect(isDevelopmentDemoEnabled('1')).toBe(false)
    expect(isDevelopmentDemoEnabled(undefined)).toBe(false)
  })
})
