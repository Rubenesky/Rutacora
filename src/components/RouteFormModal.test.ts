import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import RouteFormModal from './RouteFormModal.vue'

// RouteFormModal.vue importa obtenerUrlFoto, que a su vez importa
// src/lib/supabaseClient.ts (lanza si faltan VITE_SUPABASE_URL/ANON_KEY,
// como en CI). Se mockean ambos para no depender de un .env.local real.
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))
vi.mock('@/lib/obtenerUrlFoto', () => ({
  obtenerUrlFoto: vi.fn(() => Promise.resolve(null)),
}))

function montar(props: { lat?: number | null; lon?: number | null } = {}) {
  return mount(RouteFormModal, {
    props: {
      inicial: null,
      lat: props.lat ?? null,
      lon: props.lon ?? null,
      ubicacionYaElegida: false,
    },
    attachTo: document.body,
  })
}

async function pulsarGuardar(wrapper: ReturnType<typeof montar>): Promise<void> {
  await wrapper.find('.boton-primario').trigger('click')
  await flushPromises()
  await nextTick()
}

describe('RouteFormModal: accesibilidad', () => {
  it('el foco entra en el diálogo al montarse', async () => {
    const wrapper = montar()
    await nextTick()

    const dialogo = wrapper.find('[role="dialog"]').element
    expect(dialogo.contains(document.activeElement)).toBe(true)
    wrapper.unmount()
  })

  it('el selector de foto tiene un label accesible', () => {
    const wrapper = montar()
    const input = wrapper.find('input[type="file"]')
    const label = wrapper.find(`label[for="${input.attributes('id')}"]`)
    expect(label.exists()).toBe(true)
    expect(label.text()).not.toBe('')
    wrapper.unmount()
  })

  it('"Procesando foto…" vive dentro de una región role="status" siempre presente', () => {
    const wrapper = montar()
    expect(wrapper.find('.campo-foto [role="status"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('guardar sin nombre: muestra role="alert" enlazado al campo y le mueve el foco', async () => {
    const wrapper = montar()
    await nextTick()

    const nombre = wrapper.find('#campo-nombre')
    expect(nombre.attributes('aria-invalid')).toBe('false')
    expect(nombre.attributes('aria-describedby')).toBeUndefined()

    await pulsarGuardar(wrapper)

    const alerta = wrapper.find('#error-nombre')
    expect(alerta.exists()).toBe(true)
    expect(alerta.attributes('role')).toBe('alert')
    expect(alerta.text()).toBe('El nombre es obligatorio.')
    expect(nombre.attributes('aria-invalid')).toBe('true')
    expect(nombre.attributes('aria-describedby')).toBe('error-nombre')
    expect(document.activeElement).toBe(nombre.element)
    expect(wrapper.emitted('guardar')).toBeUndefined()

    wrapper.unmount()
  })

  it('el foco va al PRIMER campo con error en orden visual (distancia vacía, resto válido)', async () => {
    const wrapper = montar({ lat: 40, lon: -3 })
    await nextTick()

    await wrapper.find('#campo-nombre').setValue('Ruta de prueba')
    await wrapper.find('#campo-dificultad-0').setValue(true)
    await pulsarGuardar(wrapper)

    expect(wrapper.find('#error-nombre').exists()).toBe(false)
    const distancia = wrapper.find('#campo-distancia')
    expect(wrapper.find('#error-distancia').attributes('role')).toBe('alert')
    expect(distancia.attributes('aria-invalid')).toBe('true')
    expect(distancia.attributes('aria-describedby')).toBe('error-distancia')
    expect(document.activeElement).toBe(distancia.element)

    wrapper.unmount()
  })
})
