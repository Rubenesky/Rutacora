import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { useFocusTrap } from './useFocusTrap'

function montarConTrampaDeFoco(activoInicial = true) {
  const activo = ref(activoInicial)
  const contenedor = ref<HTMLElement | null>(null)

  const Componente = defineComponent({
    setup() {
      useFocusTrap(contenedor, activo)
      return () =>
        h('div', [
          h('button', { type: 'button', ref: 'fuera' }, 'Fuera'),
          h('div', { ref: contenedor, role: 'dialog' }, [
            h('button', { type: 'button' }, 'Primero'),
            h('button', { type: 'button' }, 'Segundo'),
            h('button', { type: 'button' }, 'Último'),
          ]),
        ])
    },
  })

  const wrapper = mount(Componente, { attachTo: document.body })
  return { wrapper, activo }
}

function dispatchTab(opciones: { shiftKey?: boolean } = {}): void {
  document.activeElement?.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true, ...opciones }),
  )
}

describe('useFocusTrap', () => {
  it('al activarse, mueve el foco al primer elemento focalizable del contenedor', async () => {
    const { wrapper } = montarConTrampaDeFoco()
    await nextTick()

    expect(document.activeElement?.textContent).toBe('Primero')
    wrapper.unmount()
  })

  it('Tab en el último elemento vuelve al primero (sin salir del contenedor)', async () => {
    const { wrapper } = montarConTrampaDeFoco()
    await nextTick()

    const botones = wrapper.findAll('[role="dialog"] button')
    ;(botones[2]?.element as HTMLElement).focus()
    dispatchTab()

    expect(document.activeElement?.textContent).toBe('Primero')
    wrapper.unmount()
  })

  it('Shift+Tab en el primer elemento va al último (sin salir del contenedor)', async () => {
    const { wrapper } = montarConTrampaDeFoco()
    await nextTick()

    expect(document.activeElement?.textContent).toBe('Primero')
    dispatchTab({ shiftKey: true })

    expect(document.activeElement?.textContent).toBe('Último')
    wrapper.unmount()
  })

  it('al desactivarse, devuelve el foco al elemento que lo tenía antes de activarse', async () => {
    const botonExterno = document.createElement('button')
    botonExterno.textContent = 'Externo'
    document.body.appendChild(botonExterno)
    botonExterno.focus()

    const { wrapper, activo } = montarConTrampaDeFoco(false)
    await nextTick()

    activo.value = true
    await nextTick()
    expect(document.activeElement?.textContent).toBe('Primero')

    activo.value = false
    await nextTick()
    expect(document.activeElement).toBe(botonExterno)

    wrapper.unmount()
    botonExterno.remove()
  })
})
