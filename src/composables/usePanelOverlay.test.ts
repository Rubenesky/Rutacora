import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePanelOverlay } from './usePanelOverlay'

const { panelActivo, abrirPanel, cerrarPanel, registrarConfirmacionCierre } = usePanelOverlay()

function dispararEscape(): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
}

function dispararPopstate(): void {
  window.dispatchEvent(new PopStateEvent('popstate'))
}

beforeEach(() => {
  // Vuelve a un estado neutro por si un test anterior quedó con un panel
  // abierto (cada test cierra el suyo al final, pero esto es defensivo).
  if (panelActivo.value) cerrarPanel(panelActivo.value)
  vi.restoreAllMocks()
})

describe('usePanelOverlay: abrir/cerrar y un solo panel a la vez', () => {
  it('abrirPanel añade UNA entrada de historial; abrir el mismo panel otra vez no añade otra', () => {
    const spyPush = vi.spyOn(history, 'pushState')

    abrirPanel('rutas')
    expect(panelActivo.value).toBe('rutas')
    expect(spyPush).toHaveBeenCalledTimes(1)

    abrirPanel('rutas')
    expect(spyPush).toHaveBeenCalledTimes(1)

    cerrarPanel('rutas')
  })

  it('cerrarPanel retira la entrada de historial (history.back) sin ensuciarlo', () => {
    const spyBack = vi.spyOn(history, 'back')

    abrirPanel('rutas')
    cerrarPanel('rutas')

    expect(panelActivo.value).toBeNull()
    expect(spyBack).toHaveBeenCalledTimes(1)
  })

  it('abrir login con "rutas" abierto cierra "rutas" (nunca dos paneles a la vez) y reutiliza la misma entrada', () => {
    const spyPush = vi.spyOn(history, 'pushState')

    abrirPanel('rutas')
    expect(panelActivo.value).toBe('rutas')

    abrirPanel('login')
    expect(panelActivo.value).toBe('login')
    // Una sola entrada de historial para las dos aperturas (no se duplica
    // al cambiar de panel sin pasar por "cerrado").
    expect(spyPush).toHaveBeenCalledTimes(1)

    cerrarPanel('login')
  })
})

describe('usePanelOverlay: Escape cierra el panel activo', () => {
  it('Escape cierra el panel activo y retira su entrada de historial', () => {
    const spyBack = vi.spyOn(history, 'back')
    abrirPanel('rutas')

    dispararEscape()

    expect(panelActivo.value).toBeNull()
    expect(spyBack).toHaveBeenCalledTimes(1)
  })

  it('Escape sin ningún panel abierto no hace nada (no llama a history.back)', () => {
    const spyBack = vi.spyOn(history, 'back')
    expect(panelActivo.value).toBeNull()

    dispararEscape()

    expect(spyBack).not.toHaveBeenCalled()
  })
})

describe('usePanelOverlay: confirmación antes de descartar cambios', () => {
  it('si el confirmador devuelve false, no se cierra por Escape', () => {
    abrirPanel('formulario')
    registrarConfirmacionCierre('formulario', () => false)

    dispararEscape()

    expect(panelActivo.value).toBe('formulario')

    registrarConfirmacionCierre('formulario', null)
    cerrarPanel('formulario')
  })

  it('si el confirmador devuelve false, no se puede abrir otro panel por encima (no se pierde el cambio sin guardar)', () => {
    abrirPanel('formulario')
    registrarConfirmacionCierre('formulario', () => false)

    const abierto = abrirPanel('rutas')

    expect(abierto).toBe(false)
    expect(panelActivo.value).toBe('formulario')

    registrarConfirmacionCierre('formulario', null)
    cerrarPanel('formulario')
  })

  it('si el confirmador devuelve true, sí se cierra/cambia de panel', () => {
    abrirPanel('formulario')
    registrarConfirmacionCierre('formulario', () => true)

    const abierto = abrirPanel('rutas')

    expect(abierto).toBe(true)
    expect(panelActivo.value).toBe('rutas')

    cerrarPanel('rutas')
  })
})

describe('usePanelOverlay: gesto "atrás" (popstate)', () => {
  it('popstate cierra el panel activo SIN volver a tocar el historial (la entrada ya la quitó el navegador)', () => {
    const spyBack = vi.spyOn(history, 'back')
    const spyPush = vi.spyOn(history, 'pushState')
    abrirPanel('rutas')
    spyPush.mockClear()

    dispararPopstate()

    expect(panelActivo.value).toBeNull()
    expect(spyBack).not.toHaveBeenCalled()
    expect(spyPush).not.toHaveBeenCalled()
  })

  it('si el confirmador cancela el popstate, deshace el "atrás" (vuelve a dejar la entrada) y no navega fuera', () => {
    const spyPush = vi.spyOn(history, 'pushState')
    abrirPanel('formulario')
    registrarConfirmacionCierre('formulario', () => false)
    spyPush.mockClear()

    dispararPopstate()

    expect(panelActivo.value).toBe('formulario')
    expect(spyPush).toHaveBeenCalledTimes(1) // restaura la entrada cancelada

    registrarConfirmacionCierre('formulario', null)
    cerrarPanel('formulario')
  })
})
