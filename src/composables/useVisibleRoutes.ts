import { computed } from 'vue'
import { useOfflineQueue } from './useOfflineQueue'
import { useRoutes } from './useRoutes'
import type { Ruta } from '@/types/database.types'

export interface RutaConEstado extends Ruta {
  /** true si esta ruta (o esta edición) todavía está en la cola offline,
   * pendiente de sincronizar con Supabase. */
  pendienteSync: boolean
}

/**
 * Lista de rutas "visible" para la UI (mapa y panel de lista): la última
 * descargada (o cacheada sin red) fusionada con lo que haya pendiente en la
 * cola offline, para que una ruta añadida/editada/borrada sin conexión se
 * refleje al instante sin esperar a que sincronice.
 */
export function useVisibleRoutes() {
  const { rutas, isLoading, errorMessage, mostrandoCache, fetchRutas } = useRoutes()
  const { pendientes } = useOfflineQueue()

  const rutasVisibles = computed<RutaConEstado[]>(() => {
    const idsABorrar = new Set(
      pendientes.value.filter((item) => item.tipo === 'borrar').map((item) => item.id),
    )
    const pendientesGuardar = new Map(
      pendientes.value
        .filter((item) => item.tipo === 'guardar' && item.ruta)
        .map((item) => [item.id, item]),
    )

    const resultado: RutaConEstado[] = []

    for (const ruta of rutas.value) {
      if (idsABorrar.has(ruta.id)) continue

      const pendiente = pendientesGuardar.get(ruta.id)
      if (pendiente?.ruta) {
        const fotoPath =
          pendiente.accionFoto === 'quitar'
            ? null
            : pendiente.accionFoto === 'reemplazar'
              ? ruta.foto_path // la subida real aún no ha pasado; se confirma al sincronizar
              : ruta.foto_path
        resultado.push({ ...ruta, ...pendiente.ruta, foto_path: fotoPath, pendienteSync: true })
        pendientesGuardar.delete(ruta.id)
      } else {
        resultado.push({ ...ruta, pendienteSync: false })
      }
    }

    // Rutas nuevas que aún no están en la lista descargada/cacheada.
    for (const pendiente of pendientesGuardar.values()) {
      const r = pendiente.ruta
      if (!r) continue
      resultado.push({
        id: r.id,
        user_id: '',
        nombre: r.nombre,
        lat: r.lat,
        lon: r.lon,
        distancia_km: r.distancia_km,
        desnivel_m: r.desnivel_m ?? null,
        duracion_min: r.duracion_min ?? null,
        tipo: r.tipo ?? null,
        fecha: r.fecha,
        dificultad: r.dificultad,
        notas: r.notas ?? null,
        foto_path: null,
        created_at: pendiente.creadoEn,
        pendienteSync: true,
      })
    }

    return resultado
  })

  return { rutasVisibles, isLoading, errorMessage, mostrandoCache, fetchRutas }
}
