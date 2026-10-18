import { useOfflineQueue } from '@/composables/useOfflineQueue'

declare global {
  interface Window {
    __rutacora?: ReturnType<typeof useOfflineQueue>
  }
}

/**
 * Expone saveRoute() y el estado de la cola en window.__rutacora, SOLO en
 * desarrollo (import.meta.env.DEV). Es temporal: sirve para probar la cola
 * offline desde la consola antes de que exista el formulario (bloque 4) y
 * se retira al cerrar ese bloque. Vite elimina esta llamada (y por tanto
 * este módulo) del build de producción porque import.meta.env.DEV se
 * sustituye por "false" en tiempo de compilación.
 */
export function exponerHerramientasDesarrollo(): void {
  window.__rutacora = useOfflineQueue()
  console.info(
    '[Rutácora] window.__rutacora disponible (solo en desarrollo). ' +
      'Ejemplo: await window.__rutacora.saveRoute({ ... }, null)',
  )
}
