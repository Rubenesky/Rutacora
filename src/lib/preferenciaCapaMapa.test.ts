import { beforeEach, describe, expect, it, vi } from 'vitest'
import { guardarCapaElegida, leerCapaGuardada } from './preferenciaCapaMapa'

describe('preferenciaCapaMapa', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('guarda y lee la capa elegida', () => {
    guardarCapaElegida('OpenTopoMap')
    expect(leerCapaGuardada()).toBe('OpenTopoMap')
  })

  it('devuelve null si no hay nada guardado', () => {
    expect(leerCapaGuardada()).toBeNull()
  })

  it('no lanza si localStorage.getItem falla (p. ej. modo privado)', () => {
    const spy = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })

    expect(() => leerCapaGuardada()).not.toThrow()
    expect(leerCapaGuardada()).toBeNull()

    spy.mockRestore()
  })

  it('no lanza si localStorage.setItem falla (p. ej. cuota agotada)', () => {
    const spy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('cuota agotada')
    })

    expect(() => guardarCapaElegida('IGN')).not.toThrow()

    spy.mockRestore()
  })
})
