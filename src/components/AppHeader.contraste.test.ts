import { describe, expect, it } from 'vitest'

// Contraste WCAG 2.x, calculado aquí mismo (no copiado de una herramienta
// externa): https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
function luminanciaRelativa(hex: string): number {
  const limpio = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(limpio.slice(i, i + 2), 16) / 255)
  const linealizar = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [rl, gl, bl] = [r, g, b].map(linealizar)
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl
}

function ratioContraste(hexA: string, hexB: string): number {
  const la = luminanciaRelativa(hexA)
  const lb = luminanciaRelativa(hexB)
  const [claro, oscuro] = la >= lb ? [la, lb] : [lb, la]
  return (claro + 0.05) / (oscuro + 0.05)
}

// Mismos valores que src/style.css (--color-barra, --color-primary) y
// AppHeader.vue (texto blanco sobre ambos fondos). Si alguno cambia aquí sin
// cambiar en el CSS, este test deja de representar la realidad: es el
// recordatorio para mantenerlos sincronizados.
const BLANCO = '#ffffff'
const COLOR_BARRA = '#1b5e20'
const COLOR_CHIP_ACTIVO = '#2e7d32' // --color-primary

const AA_TEXTO_NORMAL = 4.5

describe('Contraste AA de los pares de color de la barra superior', () => {
  it('texto/icono blanco sobre el fondo de la barra (--color-barra) cumple AA (4.5:1)', () => {
    const ratio = ratioContraste(BLANCO, COLOR_BARRA)
    expect(ratio).toBeGreaterThanOrEqual(AA_TEXTO_NORMAL)
  })

  it('texto blanco sobre el chip "activo" (--color-primary) cumple AA (4.5:1)', () => {
    const ratio = ratioContraste(BLANCO, COLOR_CHIP_ACTIVO)
    expect(ratio).toBeGreaterThanOrEqual(AA_TEXTO_NORMAL)
  })

  it('el fondo de la barra es más oscuro que el chip activo y que el botón flotante (mismo verde), para no confundirse', () => {
    expect(luminanciaRelativa(COLOR_BARRA)).toBeLessThan(luminanciaRelativa(COLOR_CHIP_ACTIVO))
  })
})
