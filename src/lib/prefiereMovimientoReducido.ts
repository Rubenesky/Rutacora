/** true si el usuario ha pedido reducir animaciones (prefers-reduced-motion).
 * Antes esta misma comprobación estaba duplicada en reiniciarVista() y
 * flyToRoute() de useLeafletMap.ts. */
export function prefiereMovimientoReducido(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
