import { describe, expect, it } from 'vitest'
import { mismoUsuario } from './mismoUsuario'

describe('mismoUsuario', () => {
  it('true para el mismo uuid, mismas mayúsculas', () => {
    expect(mismoUsuario('abc-123', 'abc-123')).toBe(true)
  })

  it('true para el mismo uuid con distintas mayúsculas/minúsculas', () => {
    expect(mismoUsuario('ABC-123', 'abc-123')).toBe(true)
  })

  it('false para uuid distintos', () => {
    expect(mismoUsuario('abc-123', 'def-456')).toBe(false)
  })

  it('false si alguno es undefined o null', () => {
    expect(mismoUsuario(undefined, 'abc-123')).toBe(false)
    expect(mismoUsuario('abc-123', undefined)).toBe(false)
    expect(mismoUsuario(undefined, undefined)).toBe(false)
    expect(mismoUsuario('abc-123', null)).toBe(false)
  })

  it('false si alguno es cadena vacía', () => {
    expect(mismoUsuario('', 'abc-123')).toBe(false)
  })
})
