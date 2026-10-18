import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { guardarUrlCacheada, invalidarUrlCacheada, obtenerUrlCacheada } from './signedUrlCache'

describe('signedUrlCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('devuelve null si no hay nada cacheado', () => {
    expect(obtenerUrlCacheada('user-1/a.jpg')).toBeNull()
  })

  it('guarda y devuelve la URL mientras no caduque', () => {
    guardarUrlCacheada('user-1/a.jpg', 'https://signed.example/a', 3600)
    expect(obtenerUrlCacheada('user-1/a.jpg')).toBe('https://signed.example/a')
  })

  it('caduca pasado el TTL (con margen de seguridad)', () => {
    guardarUrlCacheada('user-1/a.jpg', 'https://signed.example/a', 3600)
    vi.advanceTimersByTime(3600 * 1000)
    expect(obtenerUrlCacheada('user-1/a.jpg')).toBeNull()
  })

  it('invalidarUrlCacheada() borra la entrada aunque no haya caducado', () => {
    guardarUrlCacheada('user-1/a.jpg', 'https://signed.example/a', 3600)
    invalidarUrlCacheada('user-1/a.jpg')
    expect(obtenerUrlCacheada('user-1/a.jpg')).toBeNull()
  })

  it('cada ruta de foto tiene su propia entrada', () => {
    guardarUrlCacheada('user-1/a.jpg', 'https://signed.example/a', 3600)
    guardarUrlCacheada('user-1/b.jpg', 'https://signed.example/b', 3600)
    expect(obtenerUrlCacheada('user-1/a.jpg')).toBe('https://signed.example/a')
    expect(obtenerUrlCacheada('user-1/b.jpg')).toBe('https://signed.example/b')
  })
})
