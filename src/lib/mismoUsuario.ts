// Compara dos uuid de usuario como texto, sin distinguir mayúsculas/
// minúsculas: ambos vienen de Postgres (minúsculas siempre en la
// práctica), pero la comprobación de propiedad es justo el tipo de sitio
// donde una diferencia de formato pasa desapercibida en pruebas manuales y
// falla en producción. Única implementación: antes había una copia local
// en useLeafletMap.ts y comparaciones `===`/`!==` sueltas (sin normalizar
// mayúsculas) en otros 4 sitios.
export function mismoUsuario(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return a.toLowerCase() === b.toLowerCase()
}
