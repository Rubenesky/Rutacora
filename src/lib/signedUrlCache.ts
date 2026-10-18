interface EntradaCache {
  url: string
  expiraEn: number
}

const cache = new Map<string, EntradaCache>()

/** Devuelve la URL firmada en caché para esa ruta de Storage, o null si no
 * hay ninguna (o si ya caducó). */
export function obtenerUrlCacheada(fotoPath: string): string | null {
  const entrada = cache.get(fotoPath)
  if (!entrada) return null
  if (Date.now() >= entrada.expiraEn) {
    cache.delete(fotoPath)
    return null
  }
  return entrada.url
}

/** Guarda una URL firmada en caché durante ttlSegundos (menos un margen de
 * seguridad para no servirla justo cuando está a punto de caducar). */
export function guardarUrlCacheada(fotoPath: string, url: string, ttlSegundos: number): void {
  const MARGEN_SEGURIDAD_SEGUNDOS = 30
  const ttlEfectivo = Math.max(0, ttlSegundos - MARGEN_SEGURIDAD_SEGUNDOS)
  cache.set(fotoPath, { url, expiraEn: Date.now() + ttlEfectivo * 1000 })
}

/** Invalida la URL en caché de esa ruta de Storage (p. ej. al reemplazar o
 * quitar la foto), para que el siguiente popup pida una firma nueva. */
export function invalidarUrlCacheada(fotoPath: string): void {
  cache.delete(fotoPath)
}
