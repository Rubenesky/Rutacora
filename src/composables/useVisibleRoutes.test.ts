import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { clearRutasCache } from '@/lib/offlineDb'

const {
  mockGetSession,
  mockUpload,
  mockUpsert,
  mockDeleteEq,
  mockRemove,
  mockOrder,
  mockOnAuthStateChange,
} = vi.hoisted(() => ({
  // Con valor por defecto: useAuth.ts llama a getSession() al cargar el
  // módulo (antes de que beforeEach pueda configurar el mock).
  mockGetSession: vi.fn(
    (): Promise<{ data: { session: { user: { id: string } } | null }; error: null }> =>
      Promise.resolve({ data: { session: null }, error: null }),
  ),
  mockUpload: vi.fn(),
  mockUpsert: vi.fn(),
  mockDeleteEq: vi.fn(),
  mockRemove: vi.fn(),
  mockOrder: vi.fn(),
  mockOnAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
}))

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
    storage: {
      from: () => ({ upload: mockUpload, remove: mockRemove }),
    },
    from: () => ({
      upsert: mockUpsert,
      delete: () => ({ eq: mockDeleteEq }),
      select: () => ({ order: mockOrder }),
    }),
  },
}))

const { useVisibleRoutes } = await import('./useVisibleRoutes')
const { useOfflineQueue, _resetParaTests } = await import('./useOfflineQueue')
const { useAuth } = await import('./useAuth')

const SESION_VALIDA = { data: { session: { user: { id: 'user-1' } } }, error: null }

const rutaServidor = {
  id: 'ruta-servidor-1',
  user_id: 'user-1',
  nombre: 'Ruta del servidor',
  lat: 40,
  lon: -3.7,
  distancia_km: 10,
  desnivel_m: null,
  duracion_min: null,
  tipo: null,
  fecha: '2026-01-01',
  dificultad: 'media',
  notas: null,
  foto_path: null,
  created_at: '2026-01-01T00:00:00.000Z',
}

const inputBase = {
  nombre: 'Ruta pendiente',
  lat: 41,
  lon: -4,
  distancia_km: 5,
  desnivel_m: null,
  duracion_min: null,
  tipo: 'circular' as const,
  fecha: '2026-02-02',
  dificultad: 'fácil' as const,
  notas: null,
}

beforeEach(async () => {
  await _resetParaTests()
  await clearRutasCache()
  mockGetSession.mockReset()
  mockUpload.mockReset()
  mockUpsert.mockReset()
  mockDeleteEq.mockReset()
  mockRemove.mockReset()
  mockOrder.mockReset()
  mockGetSession.mockResolvedValue(SESION_VALIDA)
  mockUpload.mockResolvedValue({ data: { path: 'x' }, error: null })
  mockUpsert.mockResolvedValue({ data: null, error: null })
  mockDeleteEq.mockResolvedValue({ data: null, error: null })
  mockRemove.mockResolvedValue({ data: null, error: null })
  mockOrder.mockResolvedValue({ data: [rutaServidor], error: null })

  // useAuth.init() solo llama a getSession() una vez, al cargar el módulo
  // (con el valor por defecto de entonces); reconfigurar el mock después
  // no lo vuelve a disparar. Para que session.value refleje lo que cada
  // test necesita, se fija directamente aquí.
  const { session } = useAuth()
  session.value = SESION_VALIDA.data.session as unknown as Session
})

describe('useVisibleRoutes', () => {
  it('incluye las rutas del servidor marcadas como no pendientes', async () => {
    const { rutasVisibles, fetchRutas } = useVisibleRoutes()
    await fetchRutas()

    expect(rutasVisibles.value).toHaveLength(1)
    expect(rutasVisibles.value[0]).toMatchObject({ id: 'ruta-servidor-1', pendienteSync: false })
  })

  it('una ruta nueva encolada sin sincronizar (propia, con sesión) aparece marcada como pendiente', async () => {
    // Fuerza que la sincronización falle (p. ej. sin red) para que el item
    // se quede en la cola y se pueda comprobar que aparece como pendiente.
    // La sesión sigue siendo la válida (user-1): un pendiente solo se
    // muestra si es de la cuenta con sesión activa.
    mockUpsert.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const { rutasVisibles, fetchRutas } = useVisibleRoutes()
    await fetchRutas()

    const { saveRoute } = useOfflineQueue()
    await saveRoute({ ...inputBase, id: 'ruta-nueva-1' }, { tipo: 'mantener' })

    const pendiente = rutasVisibles.value.find((r) => r.id === 'ruta-nueva-1')
    expect(pendiente).toBeTruthy()
    expect(pendiente?.pendienteSync).toBe(true)
    expect(rutasVisibles.value).toHaveLength(2)
  })

  it('una ruta con un borrado pendiente (propio, con sesión) desaparece de la lista visible', async () => {
    const { rutasVisibles, fetchRutas } = useVisibleRoutes()
    await fetchRutas()
    expect(rutasVisibles.value).toHaveLength(1)

    // Igual que arriba: se fuerza el fallo de red para que el borrado se
    // quede pendiente en la cola (propio) en vez de completarse al momento.
    mockDeleteEq.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const { deleteRoute } = useOfflineQueue()
    await deleteRoute('ruta-servidor-1', null)

    expect(rutasVisibles.value).toHaveLength(0)
  })

  it('sin sesión, un pendiente propio NO se muestra en la lista visible', async () => {
    mockUpsert.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const { rutasVisibles, fetchRutas } = useVisibleRoutes()
    await fetchRutas()

    const { saveRoute } = useOfflineQueue()
    await saveRoute({ ...inputBase, id: 'ruta-nueva-1' }, { tipo: 'mantener' })
    expect(rutasVisibles.value).toHaveLength(2)

    // Se cierra la sesión: el pendiente sigue en la cola, pero deja de
    // verse en el mapa/la lista hasta que vuelva a entrar.
    const { session } = useAuth()
    session.value = null

    expect(rutasVisibles.value).toHaveLength(1)
    expect(rutasVisibles.value.find((r) => r.id === 'ruta-nueva-1')).toBeUndefined()
  })

  it('usa la caché de IndexedDB cuando la descarga falla por falta de red', async () => {
    const { fetchRutas: fetchInicial } = useVisibleRoutes()
    await fetchInicial() // descarga con éxito, se cachea

    mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } })

    const { rutasVisibles, errorMessage, mostrandoCache, fetchRutas } = useVisibleRoutes()
    await fetchRutas()

    expect(mostrandoCache.value).toBe(true)
    expect(errorMessage.value).toBe('Mostrando datos guardados, sin conexión.')
    expect(rutasVisibles.value).toHaveLength(1)
    expect(rutasVisibles.value[0]?.id).toBe('ruta-servidor-1')
  })
})
