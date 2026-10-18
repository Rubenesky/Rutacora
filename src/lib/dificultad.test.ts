import { describe, expect, it } from 'vitest'
import { DIFICULTADES } from './dificultad'

describe('DIFICULTADES', () => {
  it('coincide exactamente (con tilde) con el CHECK de supabase/schema.sql', () => {
    expect(DIFICULTADES).toEqual(['fácil', 'media', 'difícil'])
  })

  it('no admite variantes sin tilde', () => {
    expect(DIFICULTADES).not.toContain('facil')
    expect(DIFICULTADES).not.toContain('dificil')
  })
})
