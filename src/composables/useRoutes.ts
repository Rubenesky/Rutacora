import { ref } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import type { Ruta } from '@/types/database.types'

const rutas = ref<Ruta[]>([])
const isLoading = ref(false)
const errorMessage = ref('')

async function fetchRutas() {
  isLoading.value = true
  errorMessage.value = ''

  const { data, error } = await supabase
    .from('rutas')
    .select('*')
    .order('fecha', { ascending: false })

  if (error) {
    errorMessage.value = 'No se pudieron cargar las rutas. Comprueba tu conexión.'
    isLoading.value = false
    return
  }

  rutas.value = data
  isLoading.value = false
}

export function useRoutes() {
  return { rutas, isLoading, errorMessage, fetchRutas }
}
