import { describe, expect, it } from 'vitest'
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

  it('emite los eventos correctos al pulsar cada botón', async () => {
    const wrapper = mount(AppHeader, { props: { session: null } })

    await wrapper.findAll('button').find((b) => b.text().includes('Rutas'))?.trigger('click')
    expect(wrapper.emitted('abrir-rutas')).toHaveLength(1)

    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Iniciar sesión'))
      ?.trigger('click')
    expect(wrapper.emitted('abrir-login')).toHaveLength(1)
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
