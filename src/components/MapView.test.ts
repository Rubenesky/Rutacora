import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Session } from '@supabase/supabase-js'

const { mockGetSession, mockOnAuthStateChange, mockOrder, mockCreateSignedUrl } = vi.hoisted(() => ({
  mockGetSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
  mockOnAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  mockOrder: vi.fn(() => Promise.resolve({ data: [], error: null })),
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
    from: () => ({ select: () => ({ order: mockOrder }) }),
  },
}))

const MapView = (await import('./MapView.vue')).default
const { useAuth } = await import('@/composables/useAuth')

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  mockOrder.mockResolvedValue({ data: [], error: null })
})

describe('MapView: botón flotante "Añadir ruta" según sesión', () => {
  it('sin sesión no muestra el botón flotante "Añadir ruta"', async () => {
    const { session } = useAuth()
    session.value = null

    const wrapper = mount(MapView)
    await flushPromises()

    expect(wrapper.find('[aria-label="Añadir ruta"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('con sesión muestra el botón flotante "Añadir ruta"', async () => {
    const { session } = useAuth()
    session.value = { user: { id: 'user-1' } } as unknown as Session

    const wrapper = mount(MapView)
    await flushPromises()

    expect(wrapper.find('[aria-label="Añadir ruta"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('expone abrirPanelRutas() y abrirFormularioNuevo() para la barra superior', async () => {
    const { session } = useAuth()
    session.value = { user: { id: 'user-1' } } as unknown as Session

    const wrapper = mount(MapView)
    await flushPromises()

    expect(typeof wrapper.vm.abrirPanelRutas).toBe('function')
    expect(typeof wrapper.vm.abrirFormularioNuevo).toBe('function')

    wrapper.unmount()
  })
})
