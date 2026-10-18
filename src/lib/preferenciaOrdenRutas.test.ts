import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ORDEN_POR_DEFECTO } from './ordenarRutas'
import { guardarOrdenElegido, leerOrdenGuardado } from './preferenciaOrdenRutas'

describe('preferenciaOrdenRutas', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('devuelve el orden por defecto (fecha descendente) si no hay nada guardado', () => {
    expect(leerOrdenGuardado()).toEqual(ORDEN_POR_DEFECTO)
  })

  it('guarda y recupera el último orden elegido', () => {
    guardarOrdenElegido({ criterio: 'nombre', direccion: 'asc' })
    expect(leerOrdenGuardado()).toEqual({ criterio: 'nombre', direccion: 'asc' })
  })

  it('ignora un valor corrupto en localStorage y usa el valor por defecto', () => {
    window.localStorage.setItem('rutacora:orden-rutas', '{"criterio":"no-valido"}')
    expect(leerOrdenGuardado()).toEqual(ORDEN_POR_DEFECTO)
  })

  it('no lanza si localStorage.getItem falla', () => {
    const spy = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    expect(() => leerOrdenGuardado()).not.toThrow()
    expect(leerOrdenGuardado()).toEqual(ORDEN_POR_DEFECTO)
    spy.mockRestore()
  })

  it('no lanza si localStorage.setItem falla', () => {
    const spy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('cuota agotada')
    })
    expect(() => guardarOrdenElegido({ criterio: 'distancia', direccion: 'desc' })).not.toThrow()
    spy.mockRestore()
  })
})
