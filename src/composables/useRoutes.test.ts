import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { COLUMNAS_PUBLICAS, COLUMNAS_SESION } from '@/lib/constantes'
import { clearRutasCache } from '@/lib/offlineDb'

const { mockGetSession, mockOnAuthStateChange, mockSelect, mockOrder } = vi.hoisted(() => ({
  mockGetSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
  mockOnAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  mockSelect: vi.fn(),
  mockOrder: vi.fn(),
}))

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: { getSession: mockGetSession, onAuthStateChange: mockOnAuthStateChange },
    from: () => ({ select: mockSelect }),
  },
}))

const { useRoutes } = await import('./useRoutes')
const { useAuth } = await import('./useAuth')

// Deja correr todos los microtasks (y los jobs del scheduler de Vue, que se
// vacían en un microtask) antes de seguir. Usar un macrotask (setTimeout)
// garantiza que cualquier cadena de promesas pendiente -- p. ej. un watcher
// que a su vez dispara otro fetchRutas() -- haya terminado de asentarse.
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

beforeEach(async () => {
  mockSelect.mockReset()
  mockOrder.mockReset()
  mockSelect.mockReturnValue({ order: mockOrder })
  mockOrder.mockResolvedValue({ data: [], error: null })
  await clearRutasCache()
})

describe('useRoutes: columnas según sesión (nunca select "*")', () => {
  it('sin sesión pide exactamente COLUMNAS_PUBLICAS, sin user_id ni created_at', async () => {
    const { session } = useAuth()
    session.value = null

    const { fetchRutas } = useRoutes()
    await fetchRutas()

    expect(mockSelect).toHaveBeenCalledWith(COLUMNAS_PUBLICAS.join(','))
    const columnasPedidas = mockSelect.mock.calls[0]?.[0] as string
    expect(columnasPedidas).not.toContain('user_id')
    expect(columnasPedidas).not.toContain('created_at')
    expect(columnasPedidas).not.toBe('*')
  })

  it('con sesión pide COLUMNAS_SESION (incluye user_id y created_at)', async () => {
    const { session } = useAuth()
    session.value = { user: { id: 'user-1' } } as unknown as Session

    const { fetchRutas } = useRoutes()
    await fetchRutas()

    expect(mockSelect).toHaveBeenCalledWith(COLUMNAS_SESION.join(','))
    const columnasPedidas = mockSelect.mock.calls[0]?.[0] as string
    expect(columnasPedidas).toContain('user_id')
    expect(columnasPedidas).toContain('created_at')
    expect(columnasPedidas).not.toBe('*')
  })
})

describe('useRoutes: espera a que la sesión resuelva antes de decidir columnas', () => {
  it('si isReady aún no ha resuelto, fetchRutas espera (no pide nada todavía) y solo entonces pide con la sesión ya resuelta', async () => {
    // Asienta cualquier refetch pendiente de un test anterior (p. ej. el
    // watcher de cambios de sesión disparándose de forma asíncrona) antes de
    // partir de un historial de mocks limpio.
    await flush()
    mockSelect.mockClear()
    mockOrder.mockClear()

    const { session, isReady } = useAuth()
    session.value = { user: { id: 'user-esperar-1' } } as unknown as Session
    isReady.value = false

    const { fetchRutas } = useRoutes()
    const promesa = fetchRutas()

    // Mientras isReady no ha resuelto, fetchRutas no debe haber decidido
    // nada aún: si mirara session.value demasiado pronto podría pedir
    // COLUMNAS_PUBLICAS pese a haber sesión (el bug real que esto cubre).
    expect(mockSelect).not.toHaveBeenCalled()

    isReady.value = true
    await promesa
    await flush()

    // Al resolver isReady, pide las columnas correctas para la sesión ya
    // activa en ese momento (COLUMNAS_SESION, nunca las públicas).
    expect(mockSelect).toHaveBeenCalledWith(COLUMNAS_SESION.join(','))
  })
})

describe('useRoutes: vuelve a pedir las rutas cuando la sesión cambia en caliente', () => {
  it('al iniciar sesión sin recargar (login en caliente), el watcher vuelve a pedir con COLUMNAS_SESION', async () => {
    await flush()
    mockSelect.mockClear()
    mockOrder.mockClear()

    const { session, isReady } = useAuth()
    isReady.value = true

    // Estado base conocido: sin sesión. Este fetchRutas() explícito solo
    // sirve para asegurar que el watcher de cambios de sesión está activo y
    // sincronizado con este estado (si ya lo estaba de un test anterior con
    // la sesión ya en null, esto no cambia nada).
    session.value = null
    const { fetchRutas } = useRoutes()
    await fetchRutas()
    await flush()

    mockSelect.mockClear()
    mockOrder.mockClear()

    // Login en caliente: cambia la sesión SIN llamar a fetchRutas() a mano.
    session.value = { user: { id: 'watcher-login-1' } } as unknown as Session

    await vi.waitFor(() => {
      expect(mockSelect).toHaveBeenCalledWith(COLUMNAS_SESION.join(','))
    })
  })

  it('al cerrar sesión sin recargar (logout en caliente), el watcher vuelve a pedir con COLUMNAS_PUBLICAS', async () => {
    await flush()
    mockSelect.mockClear()
    mockOrder.mockClear()

    const { session, isReady } = useAuth()
    isReady.value = true

    session.value = { user: { id: 'watcher-logout-1' } } as unknown as Session
    const { fetchRutas } = useRoutes()
    await fetchRutas()
    await flush()

    mockSelect.mockClear()
    mockOrder.mockClear()

    // Logout en caliente.
    session.value = null

    await vi.waitFor(() => {
      expect(mockSelect).toHaveBeenCalledWith(COLUMNAS_PUBLICAS.join(','))
    })
    const columnasPedidas = mockSelect.mock.calls.at(-1)?.[0] as string
    expect(columnasPedidas).not.toContain('user_id')
    expect(columnasPedidas).not.toContain('created_at')
  })
})

describe('useRoutes: fallback a la caché cuando falla la petición a Supabase', () => {
  it('si la petición falla pero hay caché previa, conserva el dato mostrado y marca mostrandoCache', async () => {
    await flush()
    mockSelect.mockClear()
    mockOrder.mockClear()

    const { session, isReady } = useAuth()
    isReady.value = true
    session.value = null

    // Primera descarga con éxito: puebla rutas.value y guarda en la caché
    // de IndexedDB (guardarRutasCache, disparado internamente por fetchRutas).
    mockOrder.mockResolvedValueOnce({
      data: [{ id: 'ruta-cache-1', nombre: 'Ruta cacheada' }],
      error: null,
    })
    const { rutas, mostrandoCache, errorMessage, fetchRutas } = useRoutes()
    await fetchRutas()
    await flush()

    expect(rutas.value).toHaveLength(1)
    expect(mostrandoCache.value).toBe(false)

    // Segunda descarga: falla (p. ej. sin red). No debe perderse el dato ya
    // mostrado, y debe quedar reflejado que se está mostrando la caché.
    mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } })
    await fetchRutas()

    expect(mostrandoCache.value).toBe(true)
    expect(errorMessage.value).toBe('Mostrando datos guardados, sin conexión.')
    expect(rutas.value).toHaveLength(1)
    expect(rutas.value[0]?.id).toBe('ruta-cache-1')
  })

  it('si la petición falla y no hay caché previa, muestra el error genérico y no activa mostrandoCache', async () => {
    await flush()
    mockSelect.mockClear()
    mockOrder.mockClear()
    await clearRutasCache()

    const { session, isReady } = useAuth()
    isReady.value = true
    session.value = null

    const { rutas, mostrandoCache, errorMessage, fetchRutas } = useRoutes()
    // Estado conocido: nada cargado todavía (rutas es un ref compartido que
    // podría traer datos de un test anterior).
    rutas.value = []

    mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } })
    await fetchRutas()

    expect(mostrandoCache.value).toBe(false)
    expect(errorMessage.value).toBe('No se pudieron cargar las rutas. Comprueba tu conexión.')
    expect(rutas.value).toHaveLength(0)
  })
})
