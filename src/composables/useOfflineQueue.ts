import { ref, toRaw } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { DIFICULTADES } from '@/lib/dificultad'
import {
  clearCola as clearColaDb,
  deleteColaItem,
  getColaItems,
  putColaItem,
  type ColaItem,
  type EstadoCola,
} from '@/lib/offlineDb'
import type { Dificultad, RutaInsert, TipoRuta } from '@/types/database.types'

export interface GuardarRutaInput {
  /** Si se omite, es una ruta nueva (se genera id). Si se indica, es una edición. */
  id?: string
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
}

const FOTOS_BUCKET = 'fotos-rutas'

const pendientes = ref<ColaItem[]>([])
const sincronizando = new Set<string>()
let inicializado = false

function esDificultadValida(valor: string): valor is Dificultad {
  return (DIFICULTADES as readonly string[]).includes(valor)
}

async function refrescarPendientes(): Promise<void> {
  pendientes.value = await getColaItems()
}

async function actualizarEstado(
  id: string,
  estado: EstadoCola,
  errorMensaje: string | null,
  incrementarIntentos: boolean,
): Promise<void> {
  const encontrado = pendientes.value.find((item) => item.id === id)
  if (!encontrado) return
  // toRaw(): el item viene de un ref() reactivo (Proxy de Vue), y el
  // structured clone de IndexedDB no puede clonar Proxies.
  const actual = toRaw(encontrado)

  await putColaItem({
    ...actual,
    estado,
    errorMensaje,
    intentos: incrementarIntentos ? actual.intentos + 1 : actual.intentos,
  })
  await refrescarPendientes()
}

async function syncOne(item: ColaItem): Promise<void> {
  if (sincronizando.has(item.id)) return
  sincronizando.add(item.id)

  try {
    // getSession() no debería lanzar, pero si falla el refresco del token
    // sin red, lo tratamos igual que "sin sesión" en vez de romper el resto
    // de la sincronización.
    let userId: string | undefined
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      userId = sessionData.session?.user.id
    } catch {
      userId = undefined
    }

    // Sin sesión usable (sin login, o caducada sin red para poder
    // refrescarla): no se borra nada ni se marca como error definitivo.
    // Se queda "pendiente de login" y se reintentará al volver a entrar.
    if (!userId) {
      await actualizarEstado(item.id, 'pendiente_login', null, false)
      return
    }

    const fotoPath = item.foto ? `${userId}/${item.id}.jpg` : null

    // Orden de sincronización: primero la foto (con upsert, idempotente),
    // después la fila. Si falla a mitad (foto subida, fila no), el
    // reintento vuelve a subir la misma foto (no duplica) y reintenta
    // la fila con el mismo id (upsert, tampoco duplica).
    //
    // No se envía "user_id": se deja al valor por defecto de la columna
    // (auth.uid()), que la propia base de datos rellena a partir del
    // usuario autenticado de la petición. Así nunca depende de un cálculo
    // hecho en el cliente.
    try {
      if (item.foto && fotoPath) {
        const { error: errorSubida } = await supabase.storage
          .from(FOTOS_BUCKET)
          .upload(fotoPath, item.foto, { upsert: true, contentType: 'image/jpeg' })

        if (errorSubida) throw new Error('No se pudo subir la foto.')
      }

      const { error: errorFila } = await supabase
        .from('rutas')
        .upsert({ ...item.ruta, id: item.id, foto_path: fotoPath }, { onConflict: 'id' })

      if (errorFila) throw new Error('No se pudo guardar la ruta.')

      await deleteColaItem(item.id)
      await refrescarPendientes()
    } catch (err) {
      // Cubre tanto los errores que Supabase devuelve como { error } como
      // los que lanza como excepción (p. ej. "Failed to fetch" sin red).
      const mensaje = err instanceof Error ? err.message : 'Error de red al sincronizar.'
      await actualizarEstado(item.id, 'error', `${mensaje} Se reintentará.`, true)
    }
  } finally {
    sincronizando.delete(item.id)
  }
}

async function syncAll(): Promise<void> {
  const items = await getColaItems()
  for (const item of items) {
    await syncOne(item)
  }
}

/**
 * Único punto de entrada para guardar una ruta (nueva o editada). Escribe
 * PRIMERO en la cola de IndexedDB (con la foto ya comprimida) y después
 * intenta sincronizar. Nunca se llama a Supabase directamente desde la UI.
 */
async function saveRoute(input: GuardarRutaInput, foto: Blob | null): Promise<string> {
  if (!esDificultadValida(input.dificultad)) {
    throw new Error(
      `Dificultad no válida: "${input.dificultad}". Debe ser exactamente una de: ${DIFICULTADES.join(', ')}.`,
    )
  }

  const id = input.id ?? crypto.randomUUID()

  const ruta: RutaInsert = {
    id,
    nombre: input.nombre,
    lat: input.lat,
    lon: input.lon,
    distancia_km: input.distancia_km,
    desnivel_m: input.desnivel_m,
    duracion_min: input.duracion_min,
    tipo: input.tipo,
    fecha: input.fecha,
    dificultad: input.dificultad,
    notas: input.notas,
    foto_path: null,
  }

  const item: ColaItem = {
    id,
    ruta,
    foto,
    estado: 'pendiente',
    intentos: 0,
    errorMensaje: null,
    creadoEn: new Date().toISOString(),
  }

  await putColaItem(item)
  await refrescarPendientes()
  await syncAll()

  return id
}

async function retry(id: string): Promise<void> {
  const item = pendientes.value.find((pendiente) => pendiente.id === id)
  if (item) await syncOne(item)
}

function init(): void {
  if (inicializado) return
  inicializado = true

  // Sincroniza al abrir la app.
  void refrescarPendientes().then(() => void syncAll())

  // Sincroniza al recuperar la conexión.
  window.addEventListener('online', () => {
    void syncAll()
  })

  // Sincroniza las rutas "pendientes de login" al volver a iniciar sesión.
  supabase.auth.onAuthStateChange((event, newSession) => {
    if (newSession && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
      void syncAll()
    }
  })
}

init()

export function useOfflineQueue() {
  return { pendientes, saveRoute, retry, syncAll }
}

/** Solo para tests. */
export async function _resetParaTests(): Promise<void> {
  await clearColaDb()
  sincronizando.clear()
  await refrescarPendientes()
}
