const CLAVE = 'rutacora:capa-mapa'

/** Lee la última capa base elegida. Si localStorage no está disponible
 * (modo privado, cuota agotada, etc.) devuelve null sin romper nada. */
export function leerCapaGuardada(): string | null {
  try {
    return window.localStorage.getItem(CLAVE)
  } catch {
    return null
  }
}

/** Guarda la capa base elegida. Si localStorage falla, no hace nada: no es
 * un dato crítico, simplemente no se recuerda entre sesiones. */
export function guardarCapaElegida(nombre: string): void {
  try {
    window.localStorage.setItem(CLAVE, nombre)
  } catch {
    // almacenamiento no disponible: comportamiento normal, se ignora
  }
}
