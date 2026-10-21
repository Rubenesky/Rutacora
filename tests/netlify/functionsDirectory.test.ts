import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Netlify despliega CADA archivo de netlify/functions/ como una función
// independiente (confirmado en su documentación oficial: "prepares and
// deploys each supported code file as a function"), sin ningún mecanismo
// de exclusión documentado (ni ignore pattern, ni "included_files": ese
// ajuste solo AÑADE archivos extra al paquete de una función, no excluye
// nada). Por eso un test.ts o un .d.ts dentro de esa carpeta rompe el
// despliegue real: Netlify lo trata como una función llamada, p. ej.,
// "keepalive.test", nombre inválido (los puntos no están permitidos).
// Este test falla en CI si alguien vuelve a meter algo que no sea una
// función desplegable en netlify/functions/.
const DIR_FUNCIONES = join(process.cwd(), 'netlify', 'functions')
const NOMBRE_VALIDO_NETLIFY = /^[A-Za-z0-9_-]+\.(ts|js|mjs)$/

describe('netlify/functions/: solo debe contener funciones desplegables', () => {
  const entradas = readdirSync(DIR_FUNCIONES)

  it('no hay subcarpetas (la documentación oficial no confirma con claridad cómo empaqueta Netlify los archivos no-entrypoint dentro de una subcarpeta de función, así que se evita directamente)', () => {
    const subcarpetas = entradas.filter((nombre) => statSync(join(DIR_FUNCIONES, nombre)).isDirectory())
    expect(subcarpetas).toEqual([])
  })

  const archivos = entradas.filter((nombre) => statSync(join(DIR_FUNCIONES, nombre)).isFile())

  it('hay al menos un archivo de función (la carpeta no está vacía por error)', () => {
    expect(archivos.length).toBeGreaterThan(0)
  })

  it.each(archivos)('"%s" no es un test, mock ni .d.ts', (archivo) => {
    const esTestMockODeclaracion = /\.(test|spec|mock)\./.test(archivo) || archivo.endsWith('.d.ts')
    expect(
      esTestMockODeclaracion,
      `"${archivo}" vive en netlify/functions/, pero Netlify despliega cada archivo de ahí como una función independiente. ` +
        'Los tests, mocks y declaraciones de tipos van en tests/netlify/ (o donde corresponda), nunca en esta carpeta.',
    ).toBe(false)
  })

  it.each(archivos)('"%s" cumple el patrón de nombre que exige Netlify (/^[A-Za-z0-9_-]+\\.(ts|js|mjs)$/)', (archivo) => {
    expect(
      NOMBRE_VALIDO_NETLIFY.test(archivo),
      `"${archivo}" no cumple /^[A-Za-z0-9_-]+\\.(ts|js|mjs)$/. Netlify rechaza el despliegue de cualquier función cuyo ` +
        'nombre de archivo use caracteres fuera de alfanuméricos, guiones o guiones bajos (p. ej. un punto extra antes de la extensión).',
    ).toBe(true)
  })
})
