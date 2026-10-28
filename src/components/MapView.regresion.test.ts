import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { Session } from '@supabase/supabase-js'

// Regresión: con sesión iniciada, Editar/Borrar dejaron de aparecer en rutas
// existentes. Causa raíz (ver useRoutes.ts): fetchRutas() decidía qué
// columnas pedir mirando session.value de forma síncrona en el momento de
// llamarse, pero solo se llamaba UNA vez al montar. getSession() es
// asíncrono (lee IndexedDB/localStorage); si todavía no había resuelto en
// ese instante, la petición salía con COLUMNAS_PUBLICAS (sin user_id) pese a
// haber sesión, y como nada volvía a pedir esas columnas, las rutas se
// quedaban sin user_id el resto de la sesión. Estos tests NO llaman
// directamente a la función de comprobación de propiedad: montan MapView de
// verdad, con una sesión simulada, y verifican los botones tal y como los ve
// la interfaz.

const USER_ID = 'user-1'
const OTRO_USER_ID = 'user-2'

const RUTA_PROPIA_BASE = {
  id: 'ruta-propia',
  nombre: 'Propia',
  lat: 40,
  lon: -3,
  distancia_km: 5,
  desnivel_m: null,
  duracion_min: null,
  tipo: null,
  dificultad: 'facil',
  fecha: '2026-01-01',
  notas: null,
  foto_path: null,
}

const RUTA_AJENA_BASE = {
  id: 'ruta-ajena',
  nombre: 'Ajena',
  lat: -30,
  lon: 140,
  distancia_km: 8,
  desnivel_m: null,
  duracion_min: null,
  tipo: null,
  dificultad: 'media',
  fecha: '2026-01-02',
  notas: null,
  foto_path: null,
}

function filasConSesion() {
  return [
    { ...RUTA_PROPIA_BASE, user_id: USER_ID, created_at: '2026-01-01T00:00:00Z' },
    { ...RUTA_AJENA_BASE, user_id: OTRO_USER_ID, created_at: '2026-01-02T00:00:00Z' },
  ]
}

// Igual que devolvería Supabase para "anon" (o si el código pidiera estas
// columnas por error habiendo sesión): sin user_id ni created_at.
function filasPublicas() {
  return [RUTA_PROPIA_BASE, RUTA_AJENA_BASE]
}

const { mockGetSession, mockOnAuthStateChange, mockOrder, mockCreateSignedUrl } = vi.hoisted(() => ({
  mockGetSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
  mockOnAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  mockOrder: vi.fn<(columnas: string) => Promise<{ data: unknown[]; error: null }>>(() =>
    Promise.resolve({ data: [], error: null }),
  ),
  mockCreateSignedUrl: vi.fn(() => Promise.resolve({ data: null, error: new Error('sin foto en test') })),
}))

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    storage: { from: () => ({ createSignedUrl: mockCreateSignedUrl }) },
    from: () => ({
      select: (columnas: string) => ({
        order: () => mockOrder(columnas),
      }),
    }),
  },
}))

const MapView = (await import('./MapView.vue')).default
const { useAuth } = await import('@/composables/useAuth')
const { abrirPanel } = (await import('@/composables/usePanelOverlay')).usePanelOverlay()

function flushPromises(vueltas = 3): Promise<void> {
  return (async () => {
    for (let i = 0; i < vueltas; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  })()
}

function mockMatchMediaEscritorioSinAnimacion(): void {
  // true sirve a la vez para "min-width: 768px" (escritorio: el panel de
  // rutas no se cierra solo al seleccionar una fila) y para
  // "prefers-reduced-motion" (flyToRoute usa setView en vez de flyTo
  // animado, determinista en test).
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  )
}

beforeEach(() => {
  mockOrder.mockImplementation((columnas: string) => {
    const conSesion = columnas.includes('user_id')
    return Promise.resolve({ data: conSesion ? filasConSesion() : filasPublicas(), error: null })
  })
  mockMatchMediaEscritorioSinAnimacion()

  // jsdom no calcula layout real: sin esto el contenedor del mapa mide 0x0 y
  // leaflet.markercluster nunca trata ningún marcador como "visible" (igual
  // que en useLeafletMap.test.ts), así que flyToRoute tomaría siempre la
  // rama de cluster.
  Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, value: 800 })
  Object.defineProperty(Element.prototype, 'clientHeight', { configurable: true, value: 600 })
  Element.prototype.getBoundingClientRect = () =>
    ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => '' }) as DOMRect
})

async function abrirPopupDeFila(
  wrapper: VueWrapper<InstanceType<typeof MapView>>,
  nombre: string,
): Promise<void> {
  abrirPanel('rutas')
  await wrapper.vm.$nextTick()
  const filas = wrapper.findAll('.fila-ruta')
  const fila = filas.find((f) => f.text().includes(nombre))
  if (!fila) throw new Error(`No se encontró la fila "${nombre}"`)
  await fila.trigger('click')
}

describe('Regresión: Editar/Borrar según sesión y propiedad (MapView montado de verdad)', () => {
  it('con sesión y ruta propia, al abrir su popup aparecen Editar y Borrar', async () => {
    const { session, isReady } = useAuth()
    isReady.value = true
    session.value = { user: { id: USER_ID } } as unknown as Session

    const wrapper = mount(MapView)
    await flushPromises()

    await abrirPopupDeFila(wrapper, 'Propia')

    await vi.waitFor(() => {
      const popup = wrapper.element.querySelector('.ruta-popup[data-ruta-id="ruta-propia"]')
      expect(popup?.querySelector('.ruta-popup-acciones')).not.toBeNull()
    })

    wrapper.unmount()
  })

  it('con sesión, ante una ruta de OTRO usuario, su popup NO incluye Editar/Borrar', async () => {
    const { session, isReady } = useAuth()
    isReady.value = true
    session.value = { user: { id: USER_ID } } as unknown as Session

    const wrapper = mount(MapView)
    await flushPromises()

    await abrirPopupDeFila(wrapper, 'Ajena')

    await vi.waitFor(() => {
      const popup = wrapper.element.querySelector('.ruta-popup[data-ruta-id="ruta-ajena"]')
      expect(popup).not.toBeNull()
      expect(popup?.querySelector('.ruta-popup-acciones')).toBeNull()
    })

    wrapper.unmount()
  })

  it('si la sesión se resuelve DESPUÉS de montar (markers ya pintados sin ella), el popup refleja la sesión una vez resuelta', async () => {
    // Reproduce la carrera original: isReady empieza en false (como al
    // arrancar la app de verdad, getSession() todavía no ha resuelto).
    const { session, isReady } = useAuth()
    isReady.value = false
    session.value = null

    const wrapper = mount(MapView)
    await flushPromises()

    // Mientras no se resuelve, fetchRutas() debe seguir esperando: nunca
    // debió haber pedido ya las rutas con las columnas equivocadas.
    expect(mockOrder).not.toHaveBeenCalled()

    // Ahora se resuelve la sesión, como el getSession().then() real, pero
    // ya con el componente montado y a la escucha.
    session.value = { user: { id: USER_ID } } as unknown as Session
    isReady.value = true
    await flushPromises()

    await abrirPopupDeFila(wrapper, 'Propia')

    await vi.waitFor(() => {
      const popup = wrapper.element.querySelector('.ruta-popup[data-ruta-id="ruta-propia"]')
      expect(popup?.querySelector('.ruta-popup-acciones')).not.toBeNull()
    })

    wrapper.unmount()
  })

  it('cerrar sesión retira Editar/Borrar sin recargar la página', async () => {
    const { session, isReady } = useAuth()
    isReady.value = true
    session.value = { user: { id: USER_ID } } as unknown as Session

    const wrapper = mount(MapView)
    await flushPromises()

    await abrirPopupDeFila(wrapper, 'Propia')
    await vi.waitFor(() => {
      expect(
        wrapper.element.querySelector('.ruta-popup[data-ruta-id="ruta-propia"] .ruta-popup-acciones'),
      ).not.toBeNull()
    })

    // Cerrar sesión (como el onAuthStateChange real al hacer signOut), sin
    // recargar la página ni volver a montar el componente.
    session.value = null
    await flushPromises()

    await abrirPopupDeFila(wrapper, 'Propia')

    await vi.waitFor(() => {
      expect(
        wrapper.element.querySelector('.ruta-popup[data-ruta-id="ruta-propia"] .ruta-popup-acciones'),
      ).toBeNull()
    })

    wrapper.unmount()
  })
})
