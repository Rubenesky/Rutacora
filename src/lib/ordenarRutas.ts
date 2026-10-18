export type CriterioOrden = 'nombre' | 'fecha' | 'distancia'
export type DireccionOrden = 'asc' | 'desc'

export interface OrdenRutas {
  criterio: CriterioOrden
  direccion: DireccionOrden
}

export const ORDEN_POR_DEFECTO: OrdenRutas = { criterio: 'fecha', direccion: 'desc' }

// Tildes y ñ correctas (ñ entre n y o; á/é/í/ó/ú no se van al final del
// alfabeto), sin distinguir mayúsculas/minúsculas, y números dentro del
// nombre comparados como número ("Ruta 2" antes que "Ruta 10").
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })

export interface RutaOrdenable {
  nombre: string
  fecha: string
  distancia_km: number
}

function compararPorCriterio(a: RutaOrdenable, b: RutaOrdenable, criterio: CriterioOrden): number {
  if (criterio === 'nombre') return collator.compare(a.nombre, b.nombre)
  if (criterio === 'distancia') return a.distancia_km - b.distancia_km
  return a.fecha.localeCompare(b.fecha) // fechas ISO (aaaa-mm-dd): orden lexicográfico = orden cronológico
}

/**
 * Ordena por el criterio y dirección indicados. Desempate fijo (igual sea
 * cual sea el criterio elegido): fecha descendente y después nombre.
 */
export function ordenarRutas<T extends RutaOrdenable>(
  rutas: readonly T[],
  criterio: CriterioOrden,
  direccion: DireccionOrden,
): T[] {
  const signo = direccion === 'asc' ? 1 : -1

  return [...rutas].sort((a, b) => {
    const principal = compararPorCriterio(a, b, criterio) * signo
    if (principal !== 0) return principal

    const porFechaDesc = b.fecha.localeCompare(a.fecha)
    if (porFechaDesc !== 0) return porFechaDesc

    return collator.compare(a.nombre, b.nombre)
  })
}
