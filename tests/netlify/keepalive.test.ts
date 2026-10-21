import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const URL_ORIGEN = 'https://abcdefgh.supabase.co'
const CLAVE_JWT = 'eyJhbGciOiJIUzI1NiJ9.ejemplo.firma'
const CLAVE_PUBLISHABLE = 'sb_publishable_ejemplo123'

function mockRespuestaOk(filas: unknown[]): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(filas),
  } as Response
}

function mockRespuestaError(status: number): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve(null),
  } as Response
}

type FetchMock = (url: string, opciones: RequestInit) => Promise<Response>

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', URL_ORIGEN)
  vi.stubEnv('SUPABASE_ANON_KEY', CLAVE_JWT)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('keepalive: variables de entorno ausentes', () => {
  it('sin SUPABASE_URL ni SUPABASE_ANON_KEY, responde 500 y no llama a fetch', async () => {
    vi.unstubAllEnvs()
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    const { default: handler } = await import('../../netlify/functions/keepalive.ts')
    const respuesta = await handler()

    expect(respuesta.status).toBe(500)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('keepalive: éxito', () => {
  it('con una fila en la respuesta, hace GET con apikey y Bearer (clave JWT) y responde 200', async () => {
    const mockFetch = vi.fn<FetchMock>(() => Promise.resolve(mockRespuestaOk([{ id: 1 }])))
    vi.stubGlobal('fetch', mockFetch)

    const { default: handler } = await import('../../netlify/functions/keepalive.ts')
    const respuesta = await handler()

    expect(respuesta.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opciones] = mockFetch.mock.calls[0]!
    expect(url).toBe(`${URL_ORIGEN}/rest/v1/keepalive?select=id&limit=1`)
    const headers = opciones.headers as Record<string, string>
    expect(headers.apikey).toBe(CLAVE_JWT)
    expect(headers.Authorization).toBe(`Bearer ${CLAVE_JWT}`)
  })

  it('con una clave "sb_publishable_" (no JWT), NO añade Authorization: Bearer', async () => {
    vi.stubEnv('SUPABASE_ANON_KEY', CLAVE_PUBLISHABLE)
    const mockFetch = vi.fn<FetchMock>(() => Promise.resolve(mockRespuestaOk([{ id: 1 }])))
    vi.stubGlobal('fetch', mockFetch)

    const { default: handler } = await import('../../netlify/functions/keepalive.ts')
    const respuesta = await handler()

    expect(respuesta.status).toBe(200)
    const [, opciones] = mockFetch.mock.calls[0]!
    const headers = opciones.headers as Record<string, string>
    expect(headers.apikey).toBe(CLAVE_PUBLISHABLE)
    expect(headers.Authorization).toBeUndefined()
  })

  it('normaliza SUPABASE_URL con /rest/v1 y barra final al origen limpio', async () => {
    vi.stubEnv('SUPABASE_URL', `${URL_ORIGEN}/rest/v1/`)
    const mockFetch = vi.fn<FetchMock>(() => Promise.resolve(mockRespuestaOk([{ id: 1 }])))
    vi.stubGlobal('fetch', mockFetch)

    const { default: handler } = await import('../../netlify/functions/keepalive.ts')
    await handler()

    const [url] = mockFetch.mock.calls[0]!
    expect(url).toBe(`${URL_ORIGEN}/rest/v1/keepalive?select=id&limit=1`)
  })
})

describe('keepalive: respuesta sin filas o con error HTTP', () => {
  it('con un array vacío, responde con error (no es "éxito" aunque el status sea 200)', async () => {
    const mockFetch = vi.fn(() => Promise.resolve(mockRespuestaOk([])))
    vi.stubGlobal('fetch', mockFetch)

    const { default: handler } = await import('../../netlify/functions/keepalive.ts')
    const respuesta = await handler()

    expect(respuesta.status).not.toBe(200)
  })

  it('con un 401 de Supabase, registra el status y responde con error', async () => {
    const spyError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const mockFetch = vi.fn(() => Promise.resolve(mockRespuestaError(401)))
    vi.stubGlobal('fetch', mockFetch)

    const { default: handler } = await import('../../netlify/functions/keepalive.ts')
    const respuesta = await handler()
    const texto = await respuesta.text()

    expect(respuesta.status).not.toBe(200)
    expect(texto).toContain('401')
    // Nunca se registra la clave ni la URL completa.
    const todoLoRegistrado = spyError.mock.calls.flat().join(' ')
    expect(todoLoRegistrado).not.toContain(CLAVE_JWT)
    expect(todoLoRegistrado).not.toContain(URL_ORIGEN)
  })
})

describe('keepalive: error de red y timeout', () => {
  it('si fetch rechaza por un error de red, responde con error (no deja la excepción sin capturar)', async () => {
    const mockFetch = vi.fn(() => Promise.reject(new Error('fetch failed')))
    vi.stubGlobal('fetch', mockFetch)

    const { default: handler } = await import('../../netlify/functions/keepalive.ts')
    const respuesta = await handler()

    expect(respuesta.status).not.toBe(200)
    expect(await respuesta.text()).toContain('red')
  })

  it('si no responde en 10s, el AbortController cancela la petición y responde con error de timeout', async () => {
    vi.useFakeTimers()
    const mockFetch = vi.fn(
      (_url: string, opciones: { signal: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          opciones.signal.addEventListener('abort', () => {
            const error = new Error('aborted')
            error.name = 'AbortError'
            reject(error)
          })
        }),
    )
    vi.stubGlobal('fetch', mockFetch)

    const { default: handler } = await import('../../netlify/functions/keepalive.ts')
    const promesaRespuesta = handler()

    await vi.advanceTimersByTimeAsync(10_000)
    const respuesta = await promesaRespuesta

    expect(respuesta.status).not.toBe(200)
    expect(await respuesta.text()).toContain('Timeout')
  })
})
