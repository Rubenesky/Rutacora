import { describe, expect, it } from 'vitest'
import { hayErrores, validarRuta, type DatosFormularioRuta } from './validacionRuta'

const base: DatosFormularioRuta = {
  nombre: 'Ruta de prueba',
  lat: 37.17,
  lon: -3.6,
  distancia_km: 10,
  desnivel_m: 300,
  duracion_min: 120,
  fecha: '2026-10-18',
  dificultad: 'media',
}

describe('validarRuta', () => {
  it('no da errores con datos válidos', () => {
    expect(hayErrores(validarRuta(base))).toBe(false)
  })

  it('exige nombre', () => {
    const errores = validarRuta({ ...base, nombre: '   ' })
    expect(errores.nombre).toMatch(/obligatorio/)
  })

  it('exige distancia mayor que 0', () => {
    expect(validarRuta({ ...base, distancia_km: 0 }).distancia_km).toMatch(/mayor que 0/)
    expect(validarRuta({ ...base, distancia_km: -5 }).distancia_km).toMatch(/mayor que 0/)
    expect(validarRuta({ ...base, distancia_km: null }).distancia_km).toMatch(/mayor que 0/)
  })

  it('exige latitud y longitud dentro de rango', () => {
    expect(validarRuta({ ...base, lat: 91 }).ubicacion).toMatch(/latitud/)
    expect(validarRuta({ ...base, lat: -91 }).ubicacion).toMatch(/latitud/)
    expect(validarRuta({ ...base, lon: 181 }).ubicacion).toMatch(/longitud/)
    expect(validarRuta({ ...base, lon: -181 }).ubicacion).toMatch(/longitud/)
    expect(validarRuta({ ...base, lat: null, lon: null }).ubicacion).toMatch(/Elige una ubicación/)
  })

  it('exige fecha', () => {
    expect(validarRuta({ ...base, fecha: '' }).fecha).toMatch(/obligatoria/)
  })

  it('exige dificultad de la lista canónica (con tilde)', () => {
    expect(validarRuta({ ...base, dificultad: 'facil' }).dificultad).toMatch(/lista/)
    expect(validarRuta({ ...base, dificultad: 'media' }).dificultad).toBeUndefined()
  })

  it('no admite desnivel o duración negativos', () => {
    expect(validarRuta({ ...base, desnivel_m: -1 }).desnivel_m).toMatch(/negativo/)
    expect(validarRuta({ ...base, duracion_min: -1 }).duracion_min).toMatch(/negativa/)
  })
})
