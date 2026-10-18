import { ref } from 'vue'
import { useAuth } from './useAuth'
import { supabase } from '@/lib/supabaseClient'
import { COLUMNAS_PUBLICAS, COLUMNAS_SESION } from '@/lib/constantes'
import { guardarRutasCache, leerRutasCache } from '@/lib/offlineDb'
import type { Ruta } from '@/types/database.types'

const rutas = ref<Ruta[]>([])
const isLoading = ref(false)
const errorMessage = ref('')
const mostrandoCache = ref(false)

async function fetchRutas() {
  isLoading.value = true
  errorMessage.value = ''
  mostrandoCache.value = false

  // Nunca select('*'): "anon" solo tiene GRANT sobre las columnas
  // públicas, y select('*') fallaría para ese rol. Con sesión se piden
  // también user_id/created_at (necesarios para saber qué rutas son
  // propias y poder editarlas/borrarlas).
  const { session } = useAuth()
  const columnas = session.value ? COLUMNAS_SESION : COLUMNAS_PUBLICAS

  // select() con una cadena construida en tiempo de ejecución (no un
  // literal) impide que supabase-js infiera el tipo de fila exacto; el
  // resultado real coincide con Ruta (completo con sesión, parcial sin
  // ella, ver COLUMNAS_PUBLICAS), así que se afirma el tipo explícitamente.
  const { data, error } = await supabase
    .from('rutas')
    .select(columnas.join(','))
    .order('fecha', { ascending: false })

  if (error) {
    const cache = await leerRutasCache()
    if (cache) {
      rutas.value = cache
      mostrandoCache.value = true
      errorMessage.value = 'Mostrando datos guardados, sin conexión.'
    } else {
      errorMessage.value = 'No se pudieron cargar las rutas. Comprueba tu conexión.'
    }
    isLoading.value = false
    return
  }

  const filas = data as unknown as Ruta[]
  rutas.value = filas
  isLoading.value = false
  // No bloquea la UI; si falla al guardar la caché no es crítico.
  void guardarRutasCache(filas)
}

export function useRoutes() {
  return { rutas, isLoading, errorMessage, mostrandoCache, fetchRutas }
}
