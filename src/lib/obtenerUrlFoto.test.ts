import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { guardarUrlCacheada } from './signedUrlCache'

const { mockCreateSignedUrl } = vi.hoisted(() => ({
  mockCreateSignedUrl: vi.fn(
    (): Promise<{ data: { signedUrl: string } | null; error: Error | null }> =>
      Promise.resolve({ data: null, error: new Error('sin configurar en este test') }),
  ),
}))

vi.mock('./supabaseClient', () => ({
  supabase: {
    storage: { from: () => ({ createSignedUrl: mockCreateSignedUrl }) },
  },
}))

const { obtenerUrlFoto } = await import('./obtenerUrlFoto')

beforeEach(() => {
  mockCreateSignedUrl.mockClear()
  vi.stubGlobal('navigator', { onLine: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('obtenerUrlFoto: único camino para pedir/cachear una URL firmada', () => {
  it('con un hit de caché, devuelve esa URL sin llamar a createSignedUrl', async () => {
    guardarUrlCacheada('user-1/cache-hit.jpg', 'https://signed.example/cacheada', 3600)

    const url = await obtenerUrlFoto('user-1/cache-hit.jpg')

    expect(url).toBe('https://signed.example/cacheada')
    expect(mockCreateSignedUrl).not.toHaveBeenCalled()
  })

  it('sin caché y con red, pide una URL firmada, la cachea y la devuelve', async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example/nueva' },
      error: null,
    })

    const url = await obtenerUrlFoto('user-1/sin-cache.jpg')

    expect(url).toBe('https://signed.example/nueva')
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1)

    // Segunda llamada: ya cacheada, no debe volver a pedir la firma.
    const segundaUrl = await obtenerUrlFoto('user-1/sin-cache.jpg')
    expect(segundaUrl).toBe('https://signed.example/nueva')
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1)
  })

  it('sin caché y sin conexión, devuelve null sin llamar a createSignedUrl', async () => {
    vi.stubGlobal('navigator', { onLine: false })

    const url = await obtenerUrlFoto('user-1/sin-red.jpg')

    expect(url).toBeNull()
    expect(mockCreateSignedUrl).not.toHaveBeenCalled()
  })

  it('si Storage devuelve error, devuelve null y no cachea nada', async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: new Error('fallo de Storage') })

    const url = await obtenerUrlFoto('user-1/con-error.jpg')

    expect(url).toBeNull()
  })
})
