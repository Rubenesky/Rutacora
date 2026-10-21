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
