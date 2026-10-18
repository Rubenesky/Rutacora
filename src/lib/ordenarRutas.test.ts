import { describe, expect, it } from 'vitest'
import { ordenarRutas, type RutaOrdenable } from './ordenarRutas'

function ruta(nombre: string, fecha: string, distancia_km: number): RutaOrdenable {
  return { nombre, fecha, distancia_km }
}

describe('ordenarRutas', () => {
  it('ordena nombres con tildes y ñ correctamente (es), ignorando mayúsculas', () => {
    const rutas = [ruta('Ñora', '2026-01-01', 5), ruta('niebla', '2026-01-01', 5), ruta('OVIEDO', '2026-01-01', 5)]
    const resultado = ordenarRutas(rutas, 'nombre', 'asc').map((r) => r.nombre)
    // "ñ" va entre "n" y "o" en la colación española.
    expect(resultado).toEqual(['niebla', 'Ñora', 'OVIEDO'])
  })

  it('una tilde no manda el nombre al final del alfabeto', () => {
    const rutas = [ruta('Azuqueca', '2026-01-01', 5), ruta('Ávila', '2026-01-01', 5)]
    const resultado = ordenarRutas(rutas, 'nombre', 'asc').map((r) => r.nombre)
    expect(resultado).toEqual(['Ávila', 'Azuqueca'])
  })

  it('compara números dentro del nombre como número, no como texto', () => {
    const rutas = [ruta('Ruta 10', '2026-01-01', 5), ruta('Ruta 2', '2026-01-01', 5)]
    const resultado = ordenarRutas(rutas, 'nombre', 'asc').map((r) => r.nombre)
    expect(resultado).toEqual(['Ruta 2', 'Ruta 10'])
  })

  it('ordena por fecha ascendente y descendente', () => {
    const rutas = [ruta('A', '2026-03-01', 5), ruta('B', '2026-01-01', 5), ruta('C', '2026-02-01', 5)]
    expect(ordenarRutas(rutas, 'fecha', 'asc').map((r) => r.nombre)).toEqual(['B', 'C', 'A'])
    expect(ordenarRutas(rutas, 'fecha', 'desc').map((r) => r.nombre)).toEqual(['A', 'C', 'B'])
  })

  it('ordena por kilómetros ascendente y descendente', () => {
    const rutas = [ruta('A', '2026-01-01', 12.5), ruta('B', '2026-01-01', 3), ruta('C', '2026-01-01', 8)]
    expect(ordenarRutas(rutas, 'distancia', 'asc').map((r) => r.nombre)).toEqual(['B', 'C', 'A'])
    expect(ordenarRutas(rutas, 'distancia', 'desc').map((r) => r.nombre)).toEqual(['A', 'C', 'B'])
  })

  it('desempata por fecha descendente cuando el nombre es idéntico', () => {
    const rutas = [ruta('Igual', '2026-01-01', 5), ruta('Igual', '2026-03-01', 5), ruta('Igual', '2026-02-01', 5)]
    const resultado = ordenarRutas(rutas, 'nombre', 'asc').map((r) => r.fecha)
    expect(resultado).toEqual(['2026-03-01', '2026-02-01', '2026-01-01'])
  })

  it('desempata por nombre cuando la distancia es idéntica y la fecha también', () => {
    const rutas = [ruta('Zeta', '2026-01-01', 10), ruta('Alfa', '2026-01-01', 10), ruta('Beta', '2026-01-01', 10)]
    const resultado = ordenarRutas(rutas, 'distancia', 'asc').map((r) => r.nombre)
    expect(resultado).toEqual(['Alfa', 'Beta', 'Zeta'])
  })
})
