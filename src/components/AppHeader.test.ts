import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Session } from '@supabase/supabase-js'
import AppHeader from './AppHeader.vue'

describe('AppHeader', () => {
  it('sin sesión: muestra el nombre, "Rutas" e "Iniciar sesión"; no existe "Añadir ruta"', () => {
    const wrapper = mount(AppHeader, { props: { session: null } })

    expect(wrapper.find('h1').text()).toBe('Rutácora')
    expect(wrapper.text()).toContain('Rutas')
    expect(wrapper.text()).toContain('Iniciar sesión')
    expect(wrapper.text()).not.toContain('Añadir ruta')
    expect(wrapper.text()).not.toContain('Salir')
  })

  it('con sesión: aparece "Añadir ruta" (en la barra) y "Salir"', () => {
    const sesion = { user: { id: 'user-1' } } as unknown as Session
    const wrapper = mount(AppHeader, { props: { session: sesion } })

    expect(wrapper.text()).toContain('Añadir ruta')
    expect(wrapper.text()).toContain('Salir')
    expect(wrapper.text()).not.toContain('Iniciar sesión')
  })

  it('el nombre de la app siempre está presente, con o sin sesión', () => {
    const sinSesion = mount(AppHeader, { props: { session: null } })
    expect(sinSesion.find('h1').text()).toBe('Rutácora')

    const conSesion = mount(AppHeader, {
      props: { session: { user: { id: 'user-1' } } as unknown as Session },
    })
    expect(conSesion.find('h1').text()).toBe('Rutácora')
  })

  it('el botón "Rutas" alterna aria-expanded y la clase activa al pulsarlo (no emite eventos: usa usePanelOverlay)', async () => {
    const wrapper = mount(AppHeader, { props: { session: null } })
    const boton = wrapper.findAll('button').find((b) => b.text().includes('Rutas'))
    expect(boton?.attributes('aria-expanded')).toBe('false')
    expect(boton?.attributes('aria-controls')).toBe('panel-rutas')

    await boton?.trigger('click')
    expect(boton?.attributes('aria-expanded')).toBe('true')
    expect(boton?.classes()).toContain('boton-secundario--activo')

    await boton?.trigger('click')
    expect(boton?.attributes('aria-expanded')).toBe('false')
    expect(boton?.classes()).not.toContain('boton-secundario--activo')

    wrapper.unmount()
  })

  it('Escape cierra "Rutas" (aria-expanded vuelve a false)', async () => {
    const wrapper = mount(AppHeader, { props: { session: null } })
    const boton = wrapper.findAll('button').find((b) => b.text().includes('Rutas'))

    await boton?.trigger('click')
    expect(boton?.attributes('aria-expanded')).toBe('true')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(boton?.attributes('aria-expanded')).toBe('false')

    wrapper.unmount()
  })

  it('el gesto "atrás" (popstate real, history.back()) cierra "Rutas" sin navegar fuera de la página', async () => {
    const wrapper = mount(AppHeader, { props: { session: null } })
    const boton = wrapper.findAll('button').find((b) => b.text().includes('Rutas'))
    const urlAntes = location.href

    await boton?.trigger('click')
    expect(boton?.attributes('aria-expanded')).toBe('true')

    // history.back() real (no un PopStateEvent simulado a mano): así se
    // consume de verdad la entrada añadida al abrir, igual que el gesto
    // "atrás" de Android, y no deja el historial del test sucio.
    history.back()
    await vi.waitFor(() => {
      expect(boton?.attributes('aria-expanded')).toBe('false')
    })
    expect(location.href).toBe(urlAntes)

    wrapper.unmount()
  })

  it('con sesión, "Salir" emite cerrar-sesion y "Añadir ruta" emite anadir-ruta', async () => {
    const sesion = { user: { id: 'user-1' } } as unknown as Session
    const wrapper = mount(AppHeader, { props: { session: sesion } })

    await wrapper.findAll('button').find((b) => b.text().includes('Salir'))?.trigger('click')
    expect(wrapper.emitted('cerrar-sesion')).toHaveLength(1)

    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Añadir ruta'))
      ?.trigger('click')
    expect(wrapper.emitted('anadir-ruta')).toHaveLength(1)
  })
})
