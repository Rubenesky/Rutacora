import { afterEach, describe, expect, it, vi } from 'vitest'
import { construirJsonExportacion, descargarExportacion, nombreArchivoExportacion } from './exportarRutas'
import type { Ruta } from '@/types/database.types'

function crearRuta(overrides: Partial<Ruta> = {}): Ruta {
  return {
    id: 'ruta-1',
    user_id: 'user-1',
    nombre: 'Ruta de prueba',
    lat: 40,
    lon: -3.7,
    distancia_km: 10,
    desnivel_m: null,
    duracion_min: null,
    tipo: null,
    fecha: '2026-01-01',
    dificultad: 'media',
    notas: null,
    foto_path: 'user-1/ruta-1.jpg',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('nombreArchivoExportacion', () => {
  it('formatea como rutacora-AAAA-MM-DD.json', () => {
    expect(nombreArchivoExportacion(new Date(2026, 4, 7))).toBe('rutacora-2026-05-07.json')
  })
})

describe('construirJsonExportacion', () => {
  it('serializa todas las columnas de cada ruta, sin URLs firmadas (foto_path es solo una ruta de archivo)', () => {
    const ruta = crearRuta()
    const json = construirJsonExportacion([ruta])
    const parseado = JSON.parse(json) as Ruta[]

    expect(parseado).toEqual([ruta])
    expect(json).not.toContain('https://')
    expect(json).not.toContain('token=')
  })

  it('con varias rutas, conserva el orden y el contenido exacto', () => {
    const rutaA = crearRuta({ id: 'a', nombre: 'Primera' })
    const rutaB = crearRuta({ id: 'b', nombre: 'Segunda', foto_path: null })
    const parseado = JSON.parse(construirJsonExportacion([rutaA, rutaB])) as Ruta[]

    expect(parseado).toEqual([rutaA, rutaB])
  })
})

describe('descargarExportacion', () => {
  it('crea un Blob y dispara la descarga vía un enlace <a> temporal (click + revokeObjectURL)', () => {
    const createObjectURL = vi.fn<(obj: Blob) => string>(() => 'blob:fake-url')
    const revokeObjectURL = vi.fn()
    // jsdom no implementa URL.createObjectURL/revokeObjectURL de verdad.
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))

    const clickSpy = vi.fn()
    const removeSpy = vi.fn()
    const crearElementoOriginal = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = crearElementoOriginal(tag)
      if (tag === 'a') {
        el.click = clickSpy
        el.remove = removeSpy
      }
      return el
    })

    descargarExportacion([crearRuta()], new Date(2026, 4, 7))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blobCreado = createObjectURL.mock.calls[0]![0]
    expect(blobCreado.type).toBe('application/json')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(removeSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')
  })
})
