import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

describe('AppHeader: el nombre "Rutácora" como botón de inicio', () => {
  function botonMarca(wrapper: ReturnType<typeof mount>) {
    return wrapper.find('.app-header-marca')
  }

  it('mantiene el <h1> dentro, y además tiene un aria-label propio con el texto exacto', () => {
    const wrapper = mount(AppHeader, { props: { session: null } })
    const boton = botonMarca(wrapper)

    expect(boton.element.tagName).toBe('BUTTON')
    expect(boton.find('h1').text()).toBe('Rutácora')
    expect(boton.attributes('aria-label')).toBe('Rutácora, volver a la vista inicial')
  })

  it('es un <button type="button"> real: los navegadores lo activan con Enter y con Espacio sin código adicional (jsdom no simula esa activación nativa, por eso no se puede probar disparando el keydown)', () => {
    const wrapper = mount(AppHeader, { props: { session: null } })
    const boton = botonMarca(wrapper)

    expect(boton.element.tagName).toBe('BUTTON')
    expect(boton.attributes('type')).toBe('button')
  })

  it('al pulsarlo (click, equivalente a como responde un <button> real a Enter/Espacio) emite reiniciar-mapa', async () => {
    const wrapper = mount(AppHeader, { props: { session: null } })

    await botonMarca(wrapper).trigger('click')

    expect(wrapper.emitted('reiniciar-mapa')).toHaveLength(1)
  })

  it('tiene un área táctil de al menos 44px de alto (jsdom no aplica el CSS con scope de la SFC a getComputedStyle, así que se comprueba la regla fuente directamente)', () => {
    const fuente = readFileSync(join(process.cwd(), 'src/components/AppHeader.vue'), 'utf-8')
    const reglaMarca = /\.app-header-marca\s*{[^}]*}/.exec(fuente)?.[0] ?? ''
    const minHeight = /min-height:\s*(\d+)px/.exec(reglaMarca)?.[1]
    expect(minHeight).toBeDefined()
    expect(Number(minHeight)).toBeGreaterThanOrEqual(44)
  })

  it('con "Rutas" abierto, pulsarlo lo cierra (sin dejarlo abierto) y retira la entrada de historial', async () => {
    const wrapper = mount(AppHeader, { props: { session: null } })
    const botonRutas = wrapper.findAll('button').find((b) => b.text().includes('Rutas'))
    const urlAntes = location.href

    await botonRutas?.trigger('click')
    expect(botonRutas?.attributes('aria-expanded')).toBe('true')

    await botonMarca(wrapper).trigger('click')

    expect(botonRutas?.attributes('aria-expanded')).toBe('false')
    expect(wrapper.emitted('reiniciar-mapa')).toHaveLength(1)
    // history.back() es asíncrono (el gesto real de "atrás" también lo
    // es): hay que esperar a que la URL vuelva a la de antes de abrir.
    await vi.waitFor(() => {
      expect(location.href).toBe(urlAntes)
    })
  })
})
