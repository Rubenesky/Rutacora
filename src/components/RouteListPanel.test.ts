import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Session } from '@supabase/supabase-js'
import type { Ruta } from '@/types/database.types'
import type { RutaConEstado } from '@/composables/useVisibleRoutes'

const { mockGetSession, mockOnAuthStateChange, mockDescargarExportacion } = vi.hoisted(() => ({
  mockGetSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
  mockOnAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  mockDescargarExportacion: vi.fn(),
}))

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: { getSession: mockGetSession, onAuthStateChange: mockOnAuthStateChange },
    from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
  },
}))

vi.mock('@/lib/exportarRutas', () => ({
  descargarExportacion: mockDescargarExportacion,
}))

const RouteListPanel = (await import('./RouteListPanel.vue')).default
const { useAuth } = await import('@/composables/useAuth')
const { useRoutes } = await import('@/composables/useRoutes')

const USER_ID = 'user-1'
const OTRO_USER_ID = 'user-2'

function crearRuta(overrides: Partial<Ruta> = {}): Ruta {
  return {
    id: 'ruta-1',
    user_id: USER_ID,
    nombre: 'Ruta de prueba',
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
    ...overrides,
  }
}

function crearRutaConEstado(overrides: Partial<RutaConEstado> = {}): RutaConEstado {
  return { ...crearRuta(), pendienteSync: false, ...overrides }
}

describe('RouteListPanel: botón "Exportar datos"', () => {
  it('sin sesión, no existe el botón "Exportar datos"', () => {
    const { session } = useAuth()
    session.value = null

    const wrapper = mount(RouteListPanel, { props: { abierto: true, rutas: [] } })

    expect(wrapper.find('.panel-exportar-boton').exists()).toBe(false)

    wrapper.unmount()
  })

  it('con sesión, existe el botón y exporta solo las rutas propias (sin las de otro usuario ni las pendientes)', async () => {
    const { session } = useAuth()
    session.value = { user: { id: USER_ID } } as unknown as Session

    const { rutas } = useRoutes()
    rutas.value = [
      crearRuta({ id: 'propia-1', user_id: USER_ID }),
      crearRuta({ id: 'ajena-1', user_id: OTRO_USER_ID }),
    ]

    // La lista VISIBLE (prop "rutas") puede incluir una pendiente de la cola
    // que todavía no es una fila real; no debe exportarse.
    const rutasVisibles: RutaConEstado[] = [
      crearRutaConEstado({ id: 'propia-1', user_id: USER_ID }),
      crearRutaConEstado({ id: 'ajena-1', user_id: OTRO_USER_ID }),
      crearRutaConEstado({ id: 'pendiente-1', user_id: USER_ID, pendienteSync: true }),
    ]

    const wrapper = mount(RouteListPanel, { props: { abierto: true, rutas: rutasVisibles } })
    const boton = wrapper.find('.panel-exportar-boton')
    expect(boton.exists()).toBe(true)

    await boton.trigger('click')

    expect(mockDescargarExportacion).toHaveBeenCalledTimes(1)
    const exportadas = mockDescargarExportacion.mock.calls[0]?.[0] as Ruta[]
    expect(exportadas).toHaveLength(1)
    expect(exportadas[0]?.id).toBe('propia-1')

    rutas.value = []
    wrapper.unmount()
  })
})

describe('RouteListPanel: atrapado de foco (role="dialog")', () => {
  it('al abrir, el foco entra en el panel; al cerrar, vuelve al elemento que lo tenía antes', async () => {
    const { session } = useAuth()
    session.value = null

    // Simula #boton-rutas de AppHeader.vue: es quien tiene el foco al abrir.
    const botonRutas = document.createElement('button')
    botonRutas.id = 'boton-rutas'
    document.body.appendChild(botonRutas)
    botonRutas.focus()
    expect(document.activeElement).toBe(botonRutas)

    // Montado cerrado: el componente permanece montado y alterna su v-if
    // interno, así que el foco se mueve en la TRANSICIÓN de "abierto".
    const wrapper = mount(RouteListPanel, {
      props: { abierto: false, rutas: [crearRutaConEstado()] },
      attachTo: document.body,
    })
    expect(document.activeElement).toBe(botonRutas)

    await wrapper.setProps({ abierto: true })
    const panel = wrapper.find('#panel-rutas').element
    expect(panel.contains(document.activeElement)).toBe(true)
    // El primer focalizable es el botón "Cerrar" de la cabecera.
    expect(document.activeElement).toBe(wrapper.find('.panel-cerrar').element)

    await wrapper.setProps({ abierto: false })
    expect(wrapper.find('#panel-rutas').exists()).toBe(false)
    expect(document.activeElement).toBe(botonRutas)

    wrapper.unmount()
    botonRutas.remove()
  })

  it('Tab desde el último elemento vuelve al primero (no se escapa al mapa)', async () => {
    const { session } = useAuth()
    session.value = null

    const wrapper = mount(RouteListPanel, {
      props: { abierto: false, rutas: [crearRutaConEstado()] },
      attachTo: document.body,
    })
    await wrapper.setProps({ abierto: true })

    const ultimo = wrapper.find('.fila-ruta')
    ;(ultimo.element as HTMLElement).focus()
    await ultimo.trigger('keydown', { key: 'Tab' })

    expect(document.activeElement).toBe(wrapper.find('.panel-cerrar').element)

    wrapper.unmount()
  })
})
