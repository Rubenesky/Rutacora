import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  mockGetSession: vi.fn(),
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
})

describe('useVisibleRoutes', () => {
  it('incluye las rutas del servidor marcadas como no pendientes', async () => {
    const { rutasVisibles, fetchRutas } = useVisibleRoutes()
    await fetchRutas()

    expect(rutasVisibles.value).toHaveLength(1)
    expect(rutasVisibles.value[0]).toMatchObject({ id: 'ruta-servidor-1', pendienteSync: false })
  })

  it('una ruta nueva encolada sin sincronizar aparece marcada como pendiente', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null }) // evita que sincronice sola

    const { rutasVisibles, fetchRutas } = useVisibleRoutes()
    await fetchRutas()

    const { saveRoute } = useOfflineQueue()
    await saveRoute({ ...inputBase, id: 'ruta-nueva-1' }, { tipo: 'mantener' })

    const pendiente = rutasVisibles.value.find((r) => r.id === 'ruta-nueva-1')
    expect(pendiente).toBeTruthy()
    expect(pendiente?.pendienteSync).toBe(true)
    expect(rutasVisibles.value).toHaveLength(2)
  })

  it('una ruta con un borrado pendiente desaparece de la lista visible', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

    const { rutasVisibles, fetchRutas } = useVisibleRoutes()
    await fetchRutas()
    expect(rutasVisibles.value).toHaveLength(1)

    const { deleteRoute } = useOfflineQueue()
    await deleteRoute('ruta-servidor-1', null)

    expect(rutasVisibles.value).toHaveLength(0)
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
