// Única fuente de verdad para los valores de "dificultad": deben coincidir
// EXACTAMENTE (con tilde) con el CHECK de supabase/schema.sql:
//   check (dificultad in ('fácil', 'media', 'difícil'))
export const DIFICULTADES = ['fácil', 'media', 'difícil'] as const
