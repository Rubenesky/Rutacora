import { ref, watch } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { usePanelOverlay } from './usePanelOverlay'
import { useOfflineQueue } from './useOfflineQueue'

const { needRefresh, updateServiceWorker } = useRegisterSW({ immediate: true })

// true tras pulsar "Actualizar": la actualización se aplica en cuanto sea
// seguro (ver el watch de abajo), no necesariamente al instante.
const actualizacionSolicitada = ref(false)

let inicializado = false
function init(): void {
  if (inicializado) return
  inicializado = true

  const { panelActivo } = usePanelOverlay()
  const { haySincronizacionEnCurso } = useOfflineQueue()

  // registerType: 'prompt' nunca recarga por su cuenta. Si el usuario pidió
  // actualizar pero hay un formulario abierto (podría tener cambios sin
  // guardar) o una sincronización en curso, se pospone: este watch vuelve a
  // comprobarlo cada vez que cualquiera de esas condiciones cambia, así que
  // se aplica sola en cuanto se puede, sin que el usuario tenga que volver
  // a pulsar el botón.
  watch(
    [actualizacionSolicitada, needRefresh, panelActivo, haySincronizacionEnCurso],
    ([solicitada, hayRefresh, panel, sincronizando]) => {
      if (!solicitada || !hayRefresh) return
      if (panel === 'formulario' || sincronizando) return
      actualizacionSolicitada.value = false
      void updateServiceWorker(true)
    },
    { immediate: true },
  )
}
init()

function solicitarActualizacion(): void {
  actualizacionSolicitada.value = true
}

export function useServiceWorkerUpdate() {
  return { needRefresh, solicitarActualizacion }
}
