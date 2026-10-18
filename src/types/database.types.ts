// Escrito a mano (no hay acceso al proyecto Supabase real desde aquí).
// Para regenerarlo automáticamente cuando el esquema cambie:
//   npx supabase login
//   npx supabase gen types typescript --project-id TU_PROJECT_ID > src/types/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Dificultad = 'fácil' | 'media' | 'difícil'
export type TipoRuta = 'circular' | 'lineal'

export interface Database {
  public: {
    Tables: {
      rutas: {
        Row: {
          id: string
          user_id: string
          nombre: string
          lat: number
          lon: number
          distancia_km: number
          desnivel_m: number | null
          duracion_min: number | null
          tipo: TipoRuta | null
          fecha: string
          dificultad: Dificultad
          notas: string | null
          foto_path: string | null
          created_at: string
        }
        Insert: {
          id: string
          user_id?: string
          nombre: string
          lat: number
          lon: number
          distancia_km: number
          desnivel_m?: number | null
          duracion_min?: number | null
          tipo?: TipoRuta | null
          fecha: string
          dificultad: Dificultad
          notas?: string | null
          foto_path?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          nombre?: string
          lat?: number
          lon?: number
          distancia_km?: number
          desnivel_m?: number | null
          duracion_min?: number | null
          tipo?: TipoRuta | null
          fecha?: string
          dificultad?: Dificultad
          notas?: string | null
          foto_path?: string | null
          created_at?: string
        }
        Relationships: []
      }
      keepalive: {
        Row: {
          id: number
          pinged_at: string
        }
        Insert: {
          id?: number
          pinged_at?: string
        }
        Update: {
          id?: number
          pinged_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Ruta = Database['public']['Tables']['rutas']['Row']
export type RutaInsert = Database['public']['Tables']['rutas']['Insert']
export type RutaUpdate = Database['public']['Tables']['rutas']['Update']
