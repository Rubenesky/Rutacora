import { describe, expect, it } from 'vitest'
import { pwaOptions } from './pwa-options.ts'

type RuntimeCachingRule = NonNullable<NonNullable<typeof pwaOptions.workbox>['runtimeCaching']>[number]
type ManifestIcon = NonNullable<Exclude<NonNullable<typeof pwaOptions.manifest>, false>['icons']>[number]

// pwaOptions.manifest está tipado como `false | Partial<ManifestOptions>`
// (permite desactivarlo); aquí siempre está configurado, así que esto solo
// estrecha el tipo para los tests de abajo.
function manifestConfigurado(): NonNullable<Exclude<typeof pwaOptions.manifest, false>> {
  const manifest = pwaOptions.manifest
  if (!manifest) throw new Error('pwaOptions.manifest no está configurado')
  return manifest
}

describe('PWA: reglas de caché (workbox) y de actualización', () => {
  it('nunca cachea Supabase (auth/rest/storage): NetworkOnly explícito', () => {
    const reglas = pwaOptions.workbox?.runtimeCaching ?? []
    const regla = reglas.find((r: RuntimeCachingRule) => String(r.urlPattern).includes('supabase'))

    expect(regla).toBeDefined()
    expect(regla?.handler).toBe('NetworkOnly')

    const patron = regla!.urlPattern as RegExp
    expect(patron.test('https://abcdefgh.supabase.co/auth/v1/token')).toBe(true)
    expect(patron.test('https://abcdefgh.supabase.co/rest/v1/rutas')).toBe(true)
    expect(patron.test('https://abcdefgh.supabase.co/storage/v1/object/sign/fotos-rutas/x.jpg')).toBe(true)
    // Un dominio que simplemente contenga "supabase.co" en otra posición no
    // debe colar (evita un patrón demasiado laxo).
    expect(patron.test('https://evil.example.com/supabase.co/auth/v1/token')).toBe(false)
  })

  it('no hay ninguna regla de runtimeCaching para las teselas del mapa (OSM/OpenTopoMap/IGN)', () => {
    const reglas = pwaOptions.workbox?.runtimeCaching ?? []
    const dominiosTeselas = ['tile.openstreetmap.org', 'tile.opentopomap.org', 'ign.es']
    for (const dominio of dominiosTeselas) {
      const coincide = reglas.some((r: RuntimeCachingRule) => String(r.urlPattern).includes(dominio))
      expect(coincide).toBe(false)
    }
  })

  it('precachea solo extensiones del shell (sin datos ni teselas, que no son locales de todos modos)', () => {
    const patrones = pwaOptions.workbox?.globPatterns ?? []
    expect(patrones.some((p: string) => /\{.*js.*css.*html/.test(p))).toBe(true)
  })

  it('navegación SPA: navigateFallback a index.html, con /.netlify/ excluido', () => {
    expect(pwaOptions.workbox?.navigateFallback).toBe('index.html')
    const denylist = pwaOptions.workbox?.navigateFallbackDenylist ?? []
    expect(denylist.some((r: RegExp) => r.test('/.netlify/functions/algo'))).toBe(true)
    expect(denylist.some((r: RegExp) => r.test('/rutas-de-prueba'))).toBe(false)
  })

  it('registerType es "prompt" (nunca recarga sola): el usuario decide cuándo actualizar', () => {
    expect(pwaOptions.registerType).toBe('prompt')
  })

  it('manifest: id, scope y start_url en la raíz, y sin "orientation" (no bloquea el giro)', () => {
    const manifest = manifestConfigurado()
    expect(manifest.id).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.start_url).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(manifest).not.toHaveProperty('orientation')
  })

  it('manifest: icono maskable 512 presente, con purpose "maskable"', () => {
    const iconos = manifestConfigurado().icons ?? []
    const maskable = iconos.find((i: ManifestIcon) => i.purpose === 'maskable')
    expect(maskable?.sizes).toBe('512x512')
  })
})
