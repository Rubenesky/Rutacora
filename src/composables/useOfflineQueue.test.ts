import { beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import { getColaItems } from '@/lib/offlineDb'
import type { Dificultad } from '@/types/database.types'

const { mockGetSession, mockUpload, mockUpsert, mockDeleteEq, mockRemove, mockOnAuthStateChange } =
  vi.hoisted(() => ({
    mockGetSession: vi.fn(),
    mockUpload: vi.fn(),
    mockUpsert: vi.fn(),
    mockDeleteEq: vi.fn(),
    mockRemove: vi.fn(),
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
    from: () => ({ upsert: mockUpsert, delete: () => ({ eq: mockDeleteEq }) }),
  },
}))

const { useOfflineQueue, _resetParaTests, _erroresParaTests } = await import('./useOfflineQueue')

const MANTENER = { tipo: 'mantener' } as const
const QUITAR = { tipo: 'quitar' } as const
function reemplazar(blob: Blob) {
  return { tipo: 'reemplazar' as const, blob }
}

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
  mockDeleteEq.mockReset()
  mockRemove.mockReset()
  mockGetSession.mockResolvedValue(SESION_VALIDA)
  mockUpload.mockResolvedValue({ data: { path: 'x' }, error: null })
  mockUpsert.mockResolvedValue({ data: null, error: null })
  mockDeleteEq.mockResolvedValue({ data: null, error: null })
  mockRemove.mockResolvedValue({ data: null, error: null })
})

describe('useOfflineQueue', () => {
  it('guarda primero en la cola y sincroniza usando el id generado en cliente', async () => {
    const { saveRoute } = useOfflineQueue()
    const id = await saveRoute({ ...inputBase }, MANTENER)

    expect(mockUpsert).toHaveBeenCalledTimes(1)
    expect(mockUpsert.mock.calls[0]?.[0]).toMatchObject({ id })
    expect(await getColaItems()).toHaveLength(0)
  })

  it('no envía user_id en el payload: lo deja al valor por defecto de la columna (auth.uid())', async () => {
    const { saveRoute } = useOfflineQueue()
    await saveRoute({ ...inputBase }, MANTENER)

    expect(mockUpsert.mock.calls[0]?.[0]).not.toHaveProperty('user_id')
  })

  it('usa onConflict: "id" para que el upsert sea idempotente por id', async () => {
    const { saveRoute } = useOfflineQueue()
    await saveRoute({ ...inputBase }, MANTENER)

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
    await saveRoute({ ...inputBase }, reemplazar(new Blob(['foto'], { type: 'image/jpeg' })))

    expect(orden).toEqual(['foto', 'fila'])
  })

  it('un reintento manual usa siempre el mismo id (idempotente, sin duplicar)', async () => {
    mockUpsert
      .mockResolvedValueOnce({ data: null, error: { message: 'fallo temporal' } })
      .mockResolvedValueOnce({ data: null, error: null })

    const { saveRoute, retry } = useOfflineQueue()
    const id = await saveRoute({ ...inputBase }, MANTENER)

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
    const id = await saveRoute({ ...inputBase }, reemplazar(new Blob(['foto'], { type: 'image/jpeg' })))

    expect((await getColaItems())[0]?.estado).toBe('error')

    await retry(id)

    // La foto se vuelve a subir en el reintento, pero con upsert:true es
    // idempotente (sobrescribe el mismo path, no crea un duplicado).
    expect(mockUpload).toHaveBeenCalledTimes(2)
    expect(mockUpsert).toHaveBeenCalledTimes(2)
    expect(await getColaItems()).toHaveLength(0)
  })

  it('si Supabase lanza una excepción de red (no solo {error}), el item se marca "error" y se puede reintentar en el siguiente syncAll()', async () => {
    mockUpsert.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const { saveRoute, syncAll } = useOfflineQueue()
    const id = await saveRoute({ ...inputBase }, MANTENER)

    let items = await getColaItems()
    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe(id)
    expect(items[0]?.estado).toBe('error')
    expect(items[0]?.bloqueado).toBe(false)

    mockUpsert.mockResolvedValueOnce({ data: null, error: null })
    await syncAll()

    items = await getColaItems()
    expect(items).toHaveLength(0)
  })

  it('un error de permisos/política se marca "error" visible pero NO se reintenta en bucle automático', async () => {
    mockUpsert.mockResolvedValueOnce({
      data: null,
      error: { message: 'permission denied for table rutas', code: '42501' },
    })

    const { saveRoute, syncAll } = useOfflineQueue()
    const id = await saveRoute({ ...inputBase }, MANTENER)

    let items = await getColaItems()
    expect(items).toHaveLength(1)
    expect(items[0]?.estado).toBe('error')
    expect(items[0]?.bloqueado).toBe(true)
    expect(items[0]?.errorMensaje).toMatch(/No se pudo guardar la ruta/)

    // Aunque se dispare syncAll() varias veces (p. ej. al volver a abrir la
    // app o recuperar la red), un item bloqueado no se reintenta solo.
    await syncAll()
    await syncAll()
    expect(mockUpsert).toHaveBeenCalledTimes(1)

    items = await getColaItems()
    expect(items).toHaveLength(1)

    // Solo un reintento MANUAL lo vuelve a intentar.
    const { retry } = useOfflineQueue()
    mockUpsert.mockResolvedValueOnce({ data: null, error: null })
    await retry(id)

    expect(mockUpsert).toHaveBeenCalledTimes(2)
    expect(await getColaItems()).toHaveLength(0)
  })

  it('sin sesión (caducada sin red), saveRoute queda "pendiente de login" sin borrarse ni marcar error', async () => {
    mockGetSession.mockResolvedValue(SIN_SESION)

    const { saveRoute, syncAll } = useOfflineQueue()
    const id = await saveRoute({ ...inputBase }, MANTENER)

    let items = await getColaItems()
    expect(items).toHaveLength(1)
    expect(items[0]?.estado).toBe('pendiente_login')
    expect(items[0]?.errorMensaje).toBeNull()
    expect(mockUpsert).not.toHaveBeenCalled()

    mockGetSession.mockResolvedValue(SESION_VALIDA)
    await syncAll()

    items = await getColaItems()
    expect(items).toHaveLength(0)
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    expect(id).toBeTruthy()
  })

  it('rechaza una dificultad sin tilde antes de escribir nada en la cola', async () => {
    const { saveRoute } = useOfflineQueue()

    await expect(
      saveRoute({ ...inputBase, dificultad: 'facil' as unknown as Dificultad }, MANTENER),
    ).rejects.toThrow(/Dificultad no válida/)

    expect(await getColaItems()).toHaveLength(0)
    expect(mockUpsert).not.toHaveBeenCalled()
  })
})

describe('clasificación de errores (permisos vs. cuota)', () => {
  it('reconoce errores de permisos/política por status, code o mensaje', () => {
    expect(_erroresParaTests.esErrorDePermisos({ status: 403 })).toBe(true)
    expect(_erroresParaTests.esErrorDePermisos({ status: 401 })).toBe(true)
    expect(_erroresParaTests.esErrorDePermisos({ code: '42501' })).toBe(true)
    expect(_erroresParaTests.esErrorDePermisos({ message: 'permission denied for table rutas' })).toBe(
      true,
    )
    expect(_erroresParaTests.esErrorDePermisos({ message: 'Failed to fetch' })).toBe(false)
    expect(_erroresParaTests.esErrorDePermisos(undefined)).toBe(false)
  })

  it('reconoce un DOMException QuotaExceededError como error de cuota de IndexedDB', () => {
    expect(_erroresParaTests.esErrorDeCuota(new DOMException('cuota agotada', 'QuotaExceededError'))).toBe(
      true,
    )
    expect(_erroresParaTests.esErrorDeCuota(new Error('otra cosa'))).toBe(false)
    expect(_erroresParaTests.esErrorDeCuota(new DOMException('otro', 'NotFoundError'))).toBe(false)
  })
})

describe('useOfflineQueue: foto al editar (mantener / reemplazar / quitar)', () => {
  it('"mantener" conserva el foto_path existente sin tocar Storage', async () => {
    const { saveRoute } = useOfflineQueue()
    await saveRoute({ ...inputBase, id: 'ruta-1' }, MANTENER, 'user-1/ruta-1.jpg')

    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockRemove).not.toHaveBeenCalled()
    expect(mockUpsert.mock.calls[0]?.[0]).toMatchObject({ foto_path: 'user-1/ruta-1.jpg' })
  })

  it('"reemplazar" sube la nueva foto al mismo path (sobrescribe) y la usa en la fila', async () => {
    const { saveRoute } = useOfflineQueue()
    await saveRoute(
      { ...inputBase, id: 'ruta-1' },
      reemplazar(new Blob(['nueva'], { type: 'image/jpeg' })),
      'user-1/ruta-1.jpg',
    )

    expect(mockUpload).toHaveBeenCalledTimes(1)
    expect(mockUpload.mock.calls[0]?.[0]).toBe('user-1/ruta-1.jpg')
    expect(mockRemove).not.toHaveBeenCalled()
    expect(mockUpsert.mock.calls[0]?.[0]).toMatchObject({ foto_path: 'user-1/ruta-1.jpg' })
  })

  it('"quitar" borra el archivo de Storage y deja foto_path en null', async () => {
    const { saveRoute } = useOfflineQueue()
    await saveRoute({ ...inputBase, id: 'ruta-1' }, QUITAR, 'user-1/ruta-1.jpg')

    expect(mockRemove).toHaveBeenCalledWith(['user-1/ruta-1.jpg'])
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockUpsert.mock.calls[0]?.[0]).toMatchObject({ foto_path: null })
  })
})

describe('useOfflineQueue: deleteRoute (borrado por la cola, igual que el guardado)', () => {
  it('borra primero la fila y después la foto (en ese orden)', async () => {
    const orden: string[] = []
    mockDeleteEq.mockImplementation(async () => {
      orden.push('fila')
      return { data: null, error: null }
    })
    mockRemove.mockImplementation(async () => {
      orden.push('foto')
      return { data: null, error: null }
    })

    const { deleteRoute } = useOfflineQueue()
    await deleteRoute('ruta-1', 'user-1/ruta-1.jpg')

    expect(orden).toEqual(['fila', 'foto'])
    expect(await getColaItems()).toHaveLength(0)
  })

  it('un borrado sin foto no intenta borrar nada en Storage', async () => {
    const { deleteRoute } = useOfflineQueue()
    await deleteRoute('ruta-1', null)

    expect(mockDeleteEq).toHaveBeenCalledTimes(1)
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('un reintento de borrado es idempotente: siempre usa el mismo id, sin duplicar nada', async () => {
    mockDeleteEq
      .mockResolvedValueOnce({ data: null, error: { message: 'fallo temporal' } })
      .mockResolvedValueOnce({ data: null, error: null })

    const { deleteRoute, retry } = useOfflineQueue()
    await deleteRoute('ruta-1', null)

    let items = await getColaItems()
    expect(items).toHaveLength(1)
    expect(items[0]?.estado).toBe('error')

    await retry('ruta-1')

    expect(mockDeleteEq).toHaveBeenCalledTimes(2)
    items = await getColaItems()
    expect(items).toHaveLength(0)
  })

  it('borrar sin sesión (caducada sin red) deja el borrado "pendiente de login", sin borrar nada aún', async () => {
    mockGetSession.mockResolvedValue(SIN_SESION)

    const { deleteRoute } = useOfflineQueue()
    await deleteRoute('ruta-1', 'user-1/ruta-1.jpg')

    const items = await getColaItems()
    expect(items).toHaveLength(1)
    expect(items[0]?.estado).toBe('pendiente_login')
    expect(mockDeleteEq).not.toHaveBeenCalled()
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('borrar una ruta con foto también borra la foto de Storage', async () => {
    const { deleteRoute } = useOfflineQueue()
    await deleteRoute('ruta-1', 'user-1/ruta-1.jpg')

    expect(mockRemove).toHaveBeenCalledWith(['user-1/ruta-1.jpg'])
  })
})
