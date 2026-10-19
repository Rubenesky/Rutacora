import { ref, toRaw } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { DIFICULTADES } from '@/lib/dificultad'
import { FOTOS_BUCKET } from '@/lib/constantes'
import { invalidarUrlCacheada } from '@/lib/signedUrlCache'
import {
  clearCola as clearColaDb,
  deleteColaItem,
  getColaItems,
  putColaItem,
  type AccionFotoCola,
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

export type AccionFoto =
  | { tipo: 'mantener' }
  | { tipo: 'reemplazar'; blob: Blob }
  | { tipo: 'quitar' }

/** Error de sincronización que conserva el error original de Supabase para
 * poder distinguir fallos de red (reintentables) de fallos de permisos. */
class ErrorSincronizacion extends Error {
  readonly original?: unknown

  constructor(message: string, original?: unknown) {
    super(message)
    this.original = original
  }
}

function esErrorDePermisos(original: unknown): boolean {
  if (!original || typeof original !== 'object') return false
  const err = original as { status?: number; code?: string; message?: string }
  if (err.status === 401 || err.status === 403) return true
  if (err.code === '42501') return true
  return /permission denied|row-level security|not authorized|unauthorized/i.test(err.message ?? '')
}

function esErrorDeCuota(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'QuotaExceededError'
}

const pendientes = ref<ColaItem[]>([])
const sincronizando = new Set<string>()
// Reactivo (a diferencia de "sincronizando", un Set plano): permite que
// otras partes de la app (el aviso de actualización de la PWA) sepan si hay
// una sincronización en curso ahora mismo, para posponer una actualización
// del service worker hasta que termine.
const haySincronizacionEnCurso = ref(false)
let inicializado = false

function esDificultadValida(valor: string): valor is Dificultad {
  return (DIFICULTADES as readonly string[]).includes(valor)
}

async function refrescarPendientes(): Promise<void> {
  pendientes.value = await getColaItems()
}

async function guardarEnCola(item: ColaItem): Promise<void> {
  try {
    await putColaItem(item)
  } catch (err) {
    if (esErrorDeCuota(err)) {
      throw new Error(
        'No hay espacio suficiente en el dispositivo para guardar esto sin conexión. ' +
          'Libera espacio o inténtalo de nuevo con conexión a internet.',
      )
    }
    throw err
  }
  await refrescarPendientes()
}

async function actualizarEstado(
  id: string,
  estado: EstadoCola,
  errorMensaje: string | null,
  incrementarIntentos: boolean,
  bloqueado = false,
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
    bloqueado,
    intentos: incrementarIntentos ? actual.intentos + 1 : actual.intentos,
  })
  await refrescarPendientes()
}

async function obtenerUserIdActual(): Promise<string | undefined> {
  // getSession() no debería lanzar, pero si falla el refresco del token sin
  // red, lo tratamos igual que "sin sesión" en vez de romper la sincronización.
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    return sessionData.session?.user.id
  } catch {
    return undefined
  }
}

/** Calcula foto_path a partir de accionFoto, subiendo o borrando la foto en
 * Storage según corresponda, y devuelve el valor final para la fila. */
async function resolverFotoAlGuardar(item: ColaItem, userId: string): Promise<string | null> {
  if (item.accionFoto === 'mantener') {
    return item.fotoPathExistente
  }

  if (item.accionFoto === 'quitar') {
    if (item.fotoPathExistente) {
      const { error } = await supabase.storage.from(FOTOS_BUCKET).remove([item.fotoPathExistente])
      if (error) throw new ErrorSincronizacion('No se pudo borrar la foto anterior.', error)
      invalidarUrlCacheada(item.fotoPathExistente)
    }
    return null
  }

  // 'reemplazar'
  if (!item.foto) return item.fotoPathExistente
  const fotoPath = `${userId}/${item.id}.jpg`
  const { error } = await supabase.storage
    .from(FOTOS_BUCKET)
    .upload(fotoPath, item.foto, { upsert: true, contentType: 'image/jpeg' })
  if (error) throw new ErrorSincronizacion('No se pudo subir la foto.', error)
  invalidarUrlCacheada(fotoPath)
  return fotoPath
}

async function sincronizarGuardado(item: ColaItem, userId: string): Promise<void> {
  if (!item.ruta) return

  // Orden: primero la foto (subida o borrado, según corresponda; subida con
  // upsert, idempotente), después la fila. Si falla a mitad (foto resuelta,
  // fila no), el reintento repite la misma operación de Storage (idempotente
  // en los dos casos) y reintenta la fila con el mismo id (upsert, tampoco
  // duplica).
  //
  // No se envía "user_id": se deja al valor por defecto de la columna
  // (auth.uid()), que la propia base de datos rellena a partir del usuario
  // autenticado de la petición, en vez de un cálculo hecho en el cliente.
  const fotoPath = await resolverFotoAlGuardar(item, userId)

  const { error: errorFila } = await supabase
    .from('rutas')
    .upsert({ ...item.ruta, id: item.id, foto_path: fotoPath }, { onConflict: 'id' })

  if (errorFila) throw new ErrorSincronizacion('No se pudo guardar la ruta.', errorFila)
}

async function sincronizarBorrado(item: ColaItem): Promise<void> {
  // Orden: primero la fila, después la foto. Así una ruta nunca queda
  // visible en el mapa con una foto rota si falla a mitad; en el peor caso
  // (falla el borrado de la foto) queda un archivo huérfano en Storage, sin
  // impacto visible, y el reintento lo limpia.
  const { error: errorFila } = await supabase.from('rutas').delete().eq('id', item.id)
  if (errorFila) throw new ErrorSincronizacion('No se pudo borrar la ruta.', errorFila)

  if (item.fotoPathABorrar) {
    const { error: errorFoto } = await supabase.storage
      .from(FOTOS_BUCKET)
      .remove([item.fotoPathABorrar])

    if (errorFoto) throw new ErrorSincronizacion('No se pudo borrar la foto.', errorFoto)
    invalidarUrlCacheada(item.fotoPathABorrar)
  }
}

async function syncOne(item: ColaItem): Promise<void> {
  if (sincronizando.has(item.id)) return
  sincronizando.add(item.id)
  haySincronizacionEnCurso.value = true

  try {
    const userId = await obtenerUserIdActual()

    // Sin sesión usable (sin login, o caducada sin red para poder
    // refrescarla): no se borra nada ni se marca como error definitivo.
    // Se queda "pendiente de login" y se reintentará al volver a entrar.
    if (!userId) {
      await actualizarEstado(item.id, 'pendiente_login', null, false)
      return
    }

    // La sesión activa es de OTRA cuenta distinta de la que encoló este
    // item: no se toca ni se borra, se reintentará solo si/cuando vuelva
    // a entrar la cuenta propietaria.
    if (item.propietarioUserId && item.propietarioUserId !== userId) {
      await actualizarEstado(item.id, 'pendiente_login_otra_cuenta', null, false)
      return
    }

    try {
      if (item.tipo === 'borrar') {
        await sincronizarBorrado(item)
      } else {
        await sincronizarGuardado(item, userId)
      }

      await deleteColaItem(item.id)
      await refrescarPendientes()
    } catch (err) {
      // Cubre tanto los errores que Supabase devuelve como { error } como
      // los que lanza como excepción (p. ej. "Failed to fetch" sin red).
      const mensaje = err instanceof Error ? err.message : 'Error de red al sincronizar.'
      const original = err instanceof ErrorSincronizacion ? err.original : undefined

      if (esErrorDePermisos(original)) {
        // Error de política/permisos: no es transitorio, no se reintenta en
        // bucle automáticamente. Queda visible con el mensaje real; solo un
        // reintento manual (tras arreglar el permiso) lo vuelve a intentar.
        await actualizarEstado(item.id, 'error', mensaje, true, true)
      } else {
        await actualizarEstado(item.id, 'error', `${mensaje} Se reintentará.`, true, false)
      }
    }
  } finally {
    sincronizando.delete(item.id)
    haySincronizacionEnCurso.value = sincronizando.size > 0
  }
}

async function syncAll(): Promise<void> {
  const items = await getColaItems()
  for (const item of items) {
    if (item.bloqueado) continue // solo se reintenta manualmente, no en bucle
    await syncOne(item)
  }
}

/**
 * Único punto de entrada para guardar una ruta (nueva o editada). Escribe
 * PRIMERO en la cola de IndexedDB (con la foto ya comprimida, si procede) y
 * después intenta sincronizar. Nunca se llama a Supabase directamente desde
 * la UI.
 */
async function saveRoute(
  input: GuardarRutaInput,
  accionFoto: AccionFoto,
  fotoPathExistente: string | null = null,
): Promise<string> {
  if (!esDificultadValida(input.dificultad)) {
    throw new Error(
      `Dificultad no válida: "${input.dificultad}". Debe ser exactamente una de: ${DIFICULTADES.join(', ')}.`,
    )
  }

  const id = input.id ?? crypto.randomUUID()
  const propietarioUserId = (await obtenerUserIdActual()) ?? null

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

  const accionFotoCola: AccionFotoCola = accionFoto.tipo
  const item: ColaItem = {
    id,
    tipo: 'guardar',
    propietarioUserId,
    ruta,
    accionFoto: accionFotoCola,
    foto: accionFoto.tipo === 'reemplazar' ? accionFoto.blob : null,
    fotoPathExistente,
    fotoPathABorrar: null,
    estado: 'pendiente',
    bloqueado: false,
    intentos: 0,
    errorMensaje: null,
    creadoEn: new Date().toISOString(),
  }

  await guardarEnCola(item)
  await syncAll()

  return id
}

/**
 * Único punto de entrada para borrar una ruta. Igual que saveRoute(), pasa
 * siempre por la cola: si no hay red, queda pendiente y se reintenta.
 */
async function deleteRoute(id: string, fotoPath: string | null): Promise<void> {
  const propietarioUserId = (await obtenerUserIdActual()) ?? null

  const item: ColaItem = {
    id,
    tipo: 'borrar',
    propietarioUserId,
    ruta: null,
    accionFoto: 'mantener',
    foto: null,
    fotoPathExistente: null,
    fotoPathABorrar: fotoPath,
    estado: 'pendiente',
    bloqueado: false,
    intentos: 0,
    errorMensaje: null,
    creadoEn: new Date().toISOString(),
  }

  await guardarEnCola(item)
  await syncAll()
}

async function retry(id: string): Promise<void> {
  const item = pendientes.value.find((pendiente) => pendiente.id === id)
  if (item) await syncOne(toRaw(item))
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

  // Sincroniza las rutas "pendientes de login" al volver a iniciar sesión
  // (con la misma cuenta que las encoló; ver la comprobación en syncOne).
  supabase.auth.onAuthStateChange((event, newSession) => {
    if (newSession && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
      void syncAll()
    }
  })
}

init()

export function useOfflineQueue() {
  return { pendientes, saveRoute, deleteRoute, retry, syncAll, haySincronizacionEnCurso }
}

/** Solo para tests. */
export async function _resetParaTests(): Promise<void> {
  await clearColaDb()
  sincronizando.clear()
  haySincronizacionEnCurso.value = false
  await refrescarPendientes()
}

/** Solo para tests: permite comprobar la clasificación de errores sin
 * depender de forzar esas condiciones de verdad en IndexedDB/Supabase. */
export const _erroresParaTests = { esErrorDePermisos, esErrorDeCuota }
