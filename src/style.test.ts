import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// jsdom no aplica una hoja de estilos importada por main.ts a
// getComputedStyle en los tests (no hay un navegador real renderizando),
// así que esto comprueba la regla fuente directamente — igual que el test
// del área táctil del botón "Rutácora" en AppHeader.test.ts.
describe('.leaflet-popup-content: alto máximo con scroll interno', () => {
  it('no deja que una foto más alta que la pantalla haga desaparecer parte del popup (ver reposicionarPopup en useLeafletMap.ts)', () => {
    const fuente = readFileSync(join(process.cwd(), 'src/style.css'), 'utf-8')
    const regla = /\.leaflet-popup-content\s*{[^}]*}/.exec(fuente)?.[0] ?? ''

    expect(regla).not.toBe('')
    expect(/max-height:\s*\d+d?vh/.test(regla)).toBe(true)
    expect(/overflow-y:\s*auto/.test(regla)).toBe(true)
  })
})

// Mismo enfoque (leer la regla fuente) para las áreas táctiles mínimas de
// 44px de los controles de Leaflet que por defecto quedan por debajo.
const leerFuente = () => readFileSync(join(process.cwd(), 'src/style.css'), 'utf-8')

describe('áreas táctiles mínimas (44px) en controles de Leaflet', () => {
  it('botón de cerrar del popup: 44x44, con selector más específico que el de leaflet.css (que se carga después)', () => {
    const regla =
      /\.leaflet-container\s+\.leaflet-popup\s+a\.leaflet-popup-close-button\s*{[^}]*}/.exec(leerFuente())?.[0] ?? ''

    expect(regla).not.toBe('')
    expect(/(^|[\s{;])width:\s*44px/.test(regla)).toBe(true)
    expect(/(^|[\s{;])height:\s*44px/.test(regla)).toBe(true)
    expect(/font:\s*\d+px\/44px/.test(regla)).toBe(true)
  })

  it('el título del popup reserva hueco para que la x de 44px no lo tape', () => {
    const regla = /\.ruta-popup h3\s*{[^}]*}/.exec(leerFuente())?.[0] ?? ''

    expect(regla).not.toBe('')
    expect(/padding-right:\s*28px/.test(regla)).toBe(true)
  })

  it('opciones del selector de capas: alto mínimo de 44px, con selector que gana al "display: block" de leaflet.css', () => {
    const regla =
      /\.leaflet-control-layers\s+\.leaflet-control-layers-list\s+label\s*{[^}]*}/.exec(leerFuente())?.[0] ?? ''

    expect(regla).not.toBe('')
    expect(/min-height:\s*44px/.test(regla)).toBe(true)
    expect(/display:\s*flex/.test(regla)).toBe(true)
    expect(/align-items:\s*center/.test(regla)).toBe(true)
  })

  it('clusters: 44x44 con !important (Leaflet fija width/height/margin en línea a 40px/-20px) y centrados con margen -22px', () => {
    const regla =
      [
        ...leerFuente().matchAll(
          /\.marker-cluster-small,\s*\.marker-cluster-medium,\s*\.marker-cluster-large\s*{[^}]*}/g,
        ),
      ]
        .map((m) => m[0])
        .find((r) => /width:/.test(r)) ?? ''

    expect(regla).not.toBe('')
    expect(/(^|[\s{;])width:\s*44px\s*!important/.test(regla)).toBe(true)
    expect(/(^|[\s{;])height:\s*44px\s*!important/.test(regla)).toBe(true)
    expect(/margin-left:\s*-22px\s*!important/.test(regla)).toBe(true)
    expect(/margin-top:\s*-22px\s*!important/.test(regla)).toBe(true)
    expect(/border-radius:\s*22px\s*!important/.test(regla)).toBe(true)
  })

  it('clusters: el círculo interior y el número crecen a 34px para seguir centrados dentro de los 44px', () => {
    const fuente = leerFuente()
    const div =
      [
        ...fuente.matchAll(
          /\.marker-cluster-small div,\s*\.marker-cluster-medium div,\s*\.marker-cluster-large div\s*{[^}]*}/g,
        ),
      ]
        .map((m) => m[0])
        .find((r) => /width:/.test(r)) ?? ''
    const span =
      /\.marker-cluster-small span,\s*\.marker-cluster-medium span,\s*\.marker-cluster-large span\s*{[^}]*}/.exec(
        fuente,
      )?.[0] ?? ''

    expect(div).not.toBe('')
    expect(/(^|[\s{;])width:\s*34px\s*!important/.test(div)).toBe(true)
    expect(/(^|[\s{;])height:\s*34px\s*!important/.test(div)).toBe(true)
    expect(/line-height:\s*34px\s*!important/.test(span)).toBe(true)
  })
})
