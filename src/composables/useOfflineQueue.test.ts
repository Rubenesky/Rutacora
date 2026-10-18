import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getColaItems } from '@/lib/offlineDb'
import type { Dificultad } from '@/types/database.types'

const { mockGetSession, mockUpload, mockUpsert, mockOnAuthStateChange } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockUpload: vi.fn(),
  mockUpsert: vi.fn(),
  mockOnAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
}))

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
    storage: {
      from: () => ({ upload: mockUpload }),
    },
    from: () => ({ upsert: mockUpsert }),
  },
}))

const { useOfflineQueue, _resetParaTests } = await import('./useOfflineQueue')

const inputBase = {
  nombre: 'Ruta de prueba',
  lat: 40.0,
  lon: -3.7,
  distancia_km: 10,
  desnivel_m: 300,
  duracion_min: 120,
  tipo: 'circular' as const,
  fecha: '2026-10-18',
  dificultad: 'media' as const,
  notas: null,
}

const SESION_VALIDA = { data: { session: { user: { id: 'user-1' } } }, error: null }
const SIN_SESION = { data: { session: null }, error: null }

beforeEach(async () => {
  await _resetParaTests()
  mockGetSession.mockReset()
  mockUpload.mockReset()
  mockUpsert.mockReset()
  mockGetSession.mockResolvedValue(SESION_VALIDA)
  mockUpload.mockResolvedValue({ data: { path: 'x' }, error: null })
  mockUpsert.mockResolvedValue({ data: null, error: null })
})

describe('useOfflineQueue', () => {
  it('guarda primero en la cola y sincroniza usando el id generado en cliente', async () => {
    const { saveRoute } = useOfflineQueue()
    const id = await saveRoute({ ...inputBase }, null)

    expect(mockUpsert).toHaveBeenCalledTimes(1)
    expect(mockUpsert.mock.calls[0]?.[0]).toMatchObject({ id })
    expect(await getColaItems()).toHaveLength(0)
  })

  it('no envía user_id en el payload: lo deja al valor por defecto de la columna (auth.uid())', async () => {
    const { saveRoute } = useOfflineQueue()
    await saveRoute({ ...inputBase }, null)

    expect(mockUpsert.mock.calls[0]?.[0]).not.toHaveProperty('user_id')
  })

  it('usa onConflict: "id" para que el upsert sea idempotente por id', async () => {
    const { saveRoute } = useOfflineQueue()
    await saveRoute({ ...inputBase }, null)

    expect(mockUpsert.mock.calls[0]?.[1]).toMatchObject({ onConflict: 'id' })
  })

  it('sube la foto antes de insertar la fila (orden de sincronización)', async () => {
    const orden: string[] = []
    mockUpload.mockImplementation(async () => {
      orden.push('foto')
      return { data: { path: 'x' }, error: null }
    })
    mockUpsert.mockImplementation(async () => {
      orden.push('fila')
      return { data: null, error: null }
    })

    const { saveRoute } = useOfflineQueue()
    await saveRoute({ ...inputBase }, new Blob(['foto'], { type: 'image/jpeg' }))

    expect(orden).toEqual(['foto', 'fila'])
  })

  it('un reintento manual usa siempre el mismo id (idempotente, sin duplicar)', async () => {
    mockUpsert
      .mockResolvedValueOnce({ data: null, error: { message: 'fallo temporal' } })
      .mockResolvedValueOnce({ data: null, error: null })

    const { saveRoute, retry } = useOfflineQueue()
    const id = await saveRoute({ ...inputBase }, null)

    let items = await getColaItems()
    expect(items).toHaveLength(1)
    expect(items[0]?.estado).toBe('error')

    await retry(id)

    expect(mockUpsert).toHaveBeenCalledTimes(2)
    expect(mockUpsert.mock.calls[0]?.[0]).toMatchObject({ id })
    expect(mockUpsert.mock.calls[1]?.[0]).toMatchObject({ id })

    items = await getColaItems()
    expect(items).toHaveLength(0)
  })

  it('si la foto se sube pero la fila falla, el reintento no duplica la subida ni la fila', async () => {
    mockUpsert
      .mockResolvedValueOnce({ data: null, error: { message: 'fallo temporal' } })
      .mockResolvedValueOnce({ data: null, error: null })

    const { saveRoute, retry } = useOfflineQueue()
    const id = await saveRoute({ ...inputBase }, new Blob(['foto'], { type: 'image/jpeg' }))

    expect((await getColaItems())[0]?.estado).toBe('error')

    await retry(id)

    // La foto se vuelve a subir en el reintento, pero con upsert:true es
    // idempotente (sobrescribe el mismo path, no crea un duplicado).
    expect(mockUpload).toHaveBeenCalledTimes(2)
    expect(mockUpsert).toHaveBeenCalledTimes(2)
    expect(await getColaItems()).toHaveLength(0)
  })

  it('si Supabase lanza una excepción de red (no solo {error}), el item se marca "error" sin romper la sincronización', async () => {
    mockUpsert.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const { saveRoute } = useOfflineQueue()
    const id = await saveRoute({ ...inputBase }, null)

    const items = await getColaItems()
    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe(id)
    expect(items[0]?.estado).toBe('error')
  })

  it('sin sesión (caducada sin red), la ruta queda "pendiente de login" sin borrarse ni marcar error', async () => {
    mockGetSession.mockResolvedValue(SIN_SESION)

    const { saveRoute } = useOfflineQueue()
    const id = await saveRoute({ ...inputBase }, null)

    const items = await getColaItems()
    expect(items).toHaveLength(1)
    expect(items[0]?.estado).toBe('pendiente_login')
    expect(items[0]?.errorMensaje).toBeNull()
    expect(mockUpsert).not.toHaveBeenCalled()

    // Vuelve a iniciar sesión: la próxima sincronización debe completarse.
    mockGetSession.mockResolvedValue(SESION_VALIDA)

    const { syncAll } = useOfflineQueue()
    await syncAll()

    expect(await getColaItems()).toHaveLength(0)
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    expect(id).toBeTruthy()
  })

  it('rechaza una dificultad sin tilde antes de escribir nada en la cola', async () => {
    const { saveRoute } = useOfflineQueue()

    await expect(
      saveRoute({ ...inputBase, dificultad: 'facil' as unknown as Dificultad }, null),
    ).rejects.toThrow(/Dificultad no válida/)

    expect(await getColaItems()).toHaveLength(0)
    expect(mockUpsert).not.toHaveBeenCalled()
  })
})
