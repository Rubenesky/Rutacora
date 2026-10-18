export const FOTOS_BUCKET = 'fotos-rutas'
export const SIGNED_URL_TTL_SEGUNDOS = 60 * 60

// Debe coincidir exactamente con el GRANT SELECT por columnas de
// supabase/schema.sql para el rol "anon" (sin user_id ni created_at).
export const COLUMNAS_PUBLICAS = [
  'id',
  'nombre',
  'lat',
  'lon',
  'distancia_km',
  'desnivel_m',
  'duracion_min',
  'tipo',
  'dificultad',
  'fecha',
  'notas',
  'foto_path',
] as const

export const COLUMNAS_SESION = [...COLUMNAS_PUBLICAS, 'user_id', 'created_at'] as const

// Debe coincidir con el ancho del panel lateral en RouteListPanel.vue
// (@media (min-width: 768px) { .panel-rutas { width: ... } }), para que
// flyToRoute pueda compensar el desplazamiento en escritorio.
export const ANCHO_PANEL_RUTAS_PX = 360
export const ANCHO_BREAKPOINT_ESCRITORIO_PX = 768
