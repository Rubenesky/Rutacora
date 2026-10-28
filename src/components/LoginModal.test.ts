import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import LoginModal from './LoginModal.vue'

// LoginModal.vue importa useAuth, que a su vez importa el cliente de
// Supabase (src/lib/supabaseClient.ts lanza si faltan las variables de
// entorno, p. ej. en CI). Mismo patrón que PendingSyncBadge.test.ts.
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn(() => Promise.resolve({ error: null })),
    },
  },
}))

function dispatchTab(opciones: { shiftKey?: boolean } = {}): void {
  document.activeElement?.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true, ...opciones }),
  )
}

describe('LoginModal — atrapado de foco', () => {
  it('al montar, el foco entra dentro del diálogo (botón Cerrar)', async () => {
    const wrapper = mount(LoginModal, { attachTo: document.body })
    await nextTick()

    const dialogo = wrapper.get('[role="dialog"]').element
    expect(dialogo.contains(document.activeElement)).toBe(true)
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Cerrar')
    wrapper.unmount()
  })

  it('Tab en el último elemento focalizable vuelve al primero sin salir del diálogo', async () => {
    const wrapper = mount(LoginModal, { attachTo: document.body })
    await nextTick()

    const dialogo = wrapper.get('[role="dialog"]').element
    const enviar = wrapper.get('button[type="submit"]').element as HTMLButtonElement
    enviar.focus()
    expect(document.activeElement).toBe(enviar)

    dispatchTab()

    expect(dialogo.contains(document.activeElement)).toBe(true)
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Cerrar')
    wrapper.unmount()
  })

  it('Shift+Tab en el primer elemento va al último sin salir del diálogo', async () => {
    const wrapper = mount(LoginModal, { attachTo: document.body })
    await nextTick()

    dispatchTab({ shiftKey: true })

    expect(document.activeElement).toBe(wrapper.get('button[type="submit"]').element)
    wrapper.unmount()
  })

  it('al desmontarse (cerrar), devuelve el foco al botón que lo abrió', async () => {
    const botonAbrir = document.createElement('button')
    botonAbrir.textContent = 'Entrar'
    document.body.appendChild(botonAbrir)
    botonAbrir.focus()

    const wrapper = mount(LoginModal, { attachTo: document.body })
    await nextTick()
    expect(document.activeElement).not.toBe(botonAbrir)

    wrapper.unmount()
    expect(document.activeElement).toBe(botonAbrir)
    botonAbrir.remove()
  })
})
