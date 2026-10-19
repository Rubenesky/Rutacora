import { ref } from 'vue'

/**
 * Coordina los paneles superpuestos de la app (Rutas, login, formulario) para
 * que nunca haya dos a la vez y para que el gesto "atrás" de Android los
 * cierre en vez de salir de la página (en lugar de duplicar esta lógica en
 * cada componente). Como useAuth/useRoutes, es un singleton a nivel de
 * módulo: cualquier componente que lo importe comparte el mismo estado.
 */
export type PanelId = 'rutas' | 'login' | 'formulario'

const panelActivo = ref<PanelId | null>(null)

// true mientras exista una entrada de historial añadida por abrirPanel() sin
// retirar todavía (por cerrarPanel() o por un popstate real).
let entradaHistorialPendiente = false

// Una función de confirmación por panel (típicamente el formulario, para
// "¿descartar cambios?"), registrada por el propio componente mientras está
// abierto. Se consulta también en el gesto "atrás" (popstate), no solo en el
// botón de cerrar.
const confirmadores = new Map<PanelId, () => boolean>()

function registrarConfirmacionCierre(id: PanelId, confirmar: (() => boolean) | null): void {
  if (confirmar) confirmadores.set(id, confirmar)
  else confirmadores.delete(id)
}

/** Abre el panel `id`. Si había otro panel activo con cambios sin guardar
 * (p. ej. el formulario), pide confirmación antes de abandonarlo; si el
 * usuario cancela, no cambia nada y devuelve false. Así "abrir Rutas/login
 * cierra lo que hubiera abierto" no puede saltarse la confirmación. */
function abrirPanel(id: PanelId): boolean {
  if (panelActivo.value === id) return true

  const actual = panelActivo.value
  if (actual) {
    const confirmar = confirmadores.get(actual)
    if (confirmar && !confirmar()) return false
    confirmadores.delete(actual)
  }

  panelActivo.value = id
  if (!entradaHistorialPendiente) {
    history.pushState({ rutacoraPanel: true }, '')
    entradaHistorialPendiente = true
  }
  // Si ya había una entrada pendiente (se cambia de un panel a otro sin
  // pasar por "cerrado", p. ej. abrir login teniendo Rutas abierto), se
  // reutiliza la misma entrada: no se añade otra ni se duplica el historial.
  return true
}

/** Cierra el panel `id` si es el activo. No toca el historial si el cierre
 * viene de un popstate real (la entrada ya la quitó el navegador). */
function cerrarPanel(id: PanelId, opciones: { porPopstate?: boolean } = {}): void {
  if (panelActivo.value !== id) return
  panelActivo.value = null
  confirmadores.delete(id)
  if (entradaHistorialPendiente) {
    entradaHistorialPendiente = false
    if (!opciones.porPopstate) {
      history.back()
    }
  }
}

let inicializado = false
function init(): void {
  if (inicializado) return
  inicializado = true

  window.addEventListener('popstate', () => {
    const activo = panelActivo.value
    if (!activo) return
    const confirmar = confirmadores.get(activo)
    if (confirmar && !confirmar()) {
      // El usuario canceló el cierre (datos sin guardar): deshace el
      // "atrás" volviendo a dejar la entrada en el historial.
      history.pushState({ rutacoraPanel: true }, '')
      return
    }
    cerrarPanel(activo, { porPopstate: true })
  })

  // Escape cierra el panel activo (el que sea), con la misma confirmación
  // que el botón de cerrar si hay cambios sin guardar.
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    const activo = panelActivo.value
    if (!activo) return
    const confirmar = confirmadores.get(activo)
    if (confirmar && !confirmar()) return
    cerrarPanel(activo)
  })
}
init()

export function usePanelOverlay() {
  return { panelActivo, abrirPanel, cerrarPanel, registrarConfirmacionCierre }
}
