import { ref } from 'vue'
import { supabase } from '@/lib/supabaseClient'
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

  const { data, error } = await supabase
    .from('rutas')
    .select('*')
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

  rutas.value = data
  isLoading.value = false
  // No bloquea la UI; si falla al guardar la caché no es crítico.
  void guardarRutasCache(data)
}

export function useRoutes() {
  return { rutas, isLoading, errorMessage, mostrandoCache, fetchRutas }
}
