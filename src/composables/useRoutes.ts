import { ref, watch } from 'vue'
import { useAuth } from './useAuth'
import { supabase } from '@/lib/supabaseClient'
import { COLUMNAS_PUBLICAS, COLUMNAS_SESION } from '@/lib/constantes'
import { guardarRutasCache, leerRutasCache } from '@/lib/offlineDb'
import type { Ruta } from '@/types/database.types'

const rutas = ref<Ruta[]>([])
const isLoading = ref(false)
const errorMessage = ref('')
const mostrandoCache = ref(false)

/** Espera a que useAuth.isReady sea true. getSession() es asíncrono (lee
 * IndexedDB/localStorage); si fetchRutas() mirara session.value antes de
 * que resuelva, pediría COLUMNAS_PUBLICAS (sin user_id) aunque hubiera
 * sesión, y como nada más vuelve a pedir esas columnas, las rutas se
 * quedarían sin user_id el resto de la sesión (Editar/Borrar nunca
 * aparecerían). Por eso toda petición espera primero a que isReady lo
 * confirme, sea cual sea el resultado. */
function esperarSesionResuelta(): Promise<void> {
  const { isReady } = useAuth()
  if (isReady.value) return Promise.resolve()
  return new Promise((resolve) => {
    const dejarDeObservar = watch(isReady, (listo) => {
      if (listo) {
        dejarDeObservar()
        resolve()
      }
    })
  })
}

// Símbolo "no se sabe todavía" para distinguir, en el watcher de abajo, la
// primera resolución de sesión (que no debe disparar un refetch: ya lo hace
// fetchRutas() al esperar isReady) de un cambio real posterior (login/logout
// en caliente, que sí debe disparar uno).
const SIN_RESOLVER = Symbol('sin-resolver')
let ultimoUserId: string | null | typeof SIN_RESOLVER = SIN_RESOLVER
let observandoSesion = false

/** Vuelve a pedir las rutas cuando la sesión cambia DESPUÉS del arranque
 * (login o logout mientras la app ya está abierta), para que las rutas ya
 * cargadas ganen o pierdan user_id sin esperar a recargar la página. */
function observarCambiosDeSesion(): void {
  if (observandoSesion) return
  observandoSesion = true
  const { session, isReady } = useAuth()
  watch(
    [isReady, () => session.value?.user.id ?? null],
    ([listo, userId]) => {
      if (!listo) return
      if (ultimoUserId === SIN_RESOLVER) {
        ultimoUserId = userId
        return
      }
      if (userId !== ultimoUserId) {
        ultimoUserId = userId
        void fetchRutas()
      }
    },
    { immediate: true },
  )
}

async function fetchRutas() {
  observarCambiosDeSesion()
  isLoading.value = true
  errorMessage.value = ''
  mostrandoCache.value = false

  await esperarSesionResuelta()

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
