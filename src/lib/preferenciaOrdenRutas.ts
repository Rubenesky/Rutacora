import { ORDEN_POR_DEFECTO, type CriterioOrden, type DireccionOrden, type OrdenRutas } from './ordenarRutas'

const CLAVE = 'rutacora:orden-rutas'
const CRITERIOS_VALIDOS: readonly CriterioOrden[] = ['nombre', 'fecha', 'distancia']
const DIRECCIONES_VALIDAS: readonly DireccionOrden[] = ['asc', 'desc']

function esOrdenValido(valor: unknown): valor is OrdenRutas {
  if (!valor || typeof valor !== 'object') return false
  const v = valor as Record<string, unknown>
  return (
    CRITERIOS_VALIDOS.includes(v.criterio as CriterioOrden) &&
    DIRECCIONES_VALIDAS.includes(v.direccion as DireccionOrden)
  )
}

/** Lee el último orden elegido. Si no hay nada guardado, o localStorage no
 * está disponible, o el contenido es inválido, devuelve el orden por
 * defecto (fecha descendente) sin romper nada. */
export function leerOrdenGuardado(): OrdenRutas {
  try {
    const bruto = window.localStorage.getItem(CLAVE)
    if (!bruto) return ORDEN_POR_DEFECTO
    const valor = JSON.parse(bruto)
    return esOrdenValido(valor) ? valor : ORDEN_POR_DEFECTO
  } catch {
    return ORDEN_POR_DEFECTO
  }
}

export function guardarOrdenElegido(orden: OrdenRutas): void {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(orden))
  } catch {
    // almacenamiento no disponible: comportamiento normal, se ignora
  }
}
