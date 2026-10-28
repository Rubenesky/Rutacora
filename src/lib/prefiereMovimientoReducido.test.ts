import { afterEach, describe, expect, it, vi } from 'vitest'
import { prefiereMovimientoReducido } from './prefiereMovimientoReducido'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('prefiereMovimientoReducido', () => {
  it('true si matchMedia("(prefers-reduced-motion: reduce)") coincide', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    )
    expect(prefiereMovimientoReducido()).toBe(true)
  })

  it('false si no coincide', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    )
    expect(prefiereMovimientoReducido()).toBe(false)
  })
})
