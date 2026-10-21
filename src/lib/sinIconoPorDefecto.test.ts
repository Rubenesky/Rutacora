import { readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Guarda contra que vuelva a colarse L.Icon.Default o una imagen de
// marcador: esa es justo la causa raíz del icono roto en producción (ver
// src/lib/iconosRuta.ts). Escanea el código fuente de verdad, no solo
// useLeafletMap.ts, por si se añadiera un marcador en otro sitio.
const DIR_SRC = join(process.cwd(), 'src')
const PATRONES_PROHIBIDOS = [/Icon\.Default/, /marker-icon/i, /marker-shadow/i]
const EXTENSIONES = new Set(['.ts', '.vue'])
// Este propio archivo y la fábrica de iconos mencionan esos patrones en
// comentarios (explicando precisamente qué se está evitando y por qué).
const EXCLUIDOS = new Set(['sinIconoPorDefecto.test.ts', 'iconosRuta.ts', 'iconosRuta.test.ts'])

function listarArchivosFuente(dir: string): string[] {
  const resultado: string[] = []
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada)
    const info = statSync(ruta)
    if (info.isDirectory()) {
      resultado.push(...listarArchivosFuente(ruta))
    } else if (EXTENSIONES.has(entrada.slice(entrada.lastIndexOf('.')))) {
      resultado.push(ruta)
    }
  }
  return resultado
}

describe('Sin L.Icon.Default ni imágenes de marcador en el código fuente', () => {
  const archivos = listarArchivosFuente(DIR_SRC).filter((ruta) => !EXCLUIDOS.has(basename(ruta)))

  it('hay archivos que comprobar (el escaneo no está vacío por error)', () => {
    expect(archivos.length).toBeGreaterThan(0)
  })

  it.each(archivos)('"%s" no referencia L.Icon.Default ni marker-icon*/marker-shadow*', (ruta) => {
    const contenido = readFileSync(ruta, 'utf-8')
    for (const patron of PATRONES_PROHIBIDOS) {
      expect(
        patron.test(contenido),
        `${ruta} contiene "${patron}": esos iconos por defecto de Leaflet no sobreviven al build de ` +
          'Vite (ver src/lib/iconosRuta.ts). Usa crearIconoRuta() en su lugar.',
      ).toBe(false)
    }
  })
})
