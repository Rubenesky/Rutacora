import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.hoisted() se adelanta incluso a los imports estáticos transformados
// (import { ref } from 'vue' todavía no estaría enlazado), así que "vue" se
// importa aquí dentro con import() dinámico, no estático.
const { mockUpdateServiceWorker, needRefresh, mockGetSession, mockOnAuthStateChange } = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return {
    mockUpdateServiceWorker: vi.fn(() => Promise.resolve()),
    needRefresh: ref(false),
    mockGetSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    mockOnAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  }
})

vi.mock('virtual:pwa-register/vue', () => ({
  useRegisterSW: () => ({
    needRefresh,
    offlineReady: { value: false },
    updateServiceWorker: mockUpdateServiceWorker,
  }),
}))

// useOfflineQueue (importado más abajo por useServiceWorkerUpdate) llama a
// supabase.auth.getSession()/onAuthStateChange() al inicializarse.
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}))

const { useServiceWorkerUpdate } = await import('./useServiceWorkerUpdate')
const { usePanelOverlay } = await import('./usePanelOverlay')
const { useOfflineQueue } = await import('./useOfflineQueue')

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('useServiceWorkerUpdate: nunca recarga sola, solo al pulsar "Actualizar" y pospuesta si no es seguro', () => {
  beforeEach(() => {
    needRefresh.value = false
    mockUpdateServiceWorker.mockClear()
    usePanelOverlay().panelActivo.value = null
    useOfflineQueue().haySincronizacionEnCurso.value = false
  })

  it('sin needRefresh, pulsar "Actualizar" no hace nada', () => {
    const { solicitarActualizacion } = useServiceWorkerUpdate()
    solicitarActualizacion()
    expect(mockUpdateServiceWorker).not.toHaveBeenCalled()
  })

  it('con needRefresh y nada que lo impida, pulsar "Actualizar" aplica la actualización', async () => {
    needRefresh.value = true
    const { solicitarActualizacion } = useServiceWorkerUpdate()

    solicitarActualizacion()
    await flushPromises()

    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('con un formulario abierto, pospone la actualización hasta que se cierra', async () => {
    needRefresh.value = true
    const { panelActivo } = usePanelOverlay()
    panelActivo.value = 'formulario'
    const { solicitarActualizacion } = useServiceWorkerUpdate()

    solicitarActualizacion()
    await flushPromises()
    expect(mockUpdateServiceWorker).not.toHaveBeenCalled()

    panelActivo.value = null
    await flushPromises()
    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('con una sincronización en curso, pospone la actualización hasta que termina', async () => {
    needRefresh.value = true
    const { haySincronizacionEnCurso } = useOfflineQueue()
    haySincronizacionEnCurso.value = true
    const { solicitarActualizacion } = useServiceWorkerUpdate()

    solicitarActualizacion()
    await flushPromises()
    expect(mockUpdateServiceWorker).not.toHaveBeenCalled()

    haySincronizacionEnCurso.value = false
    await flushPromises()
    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true)
  })
})
