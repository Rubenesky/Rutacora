import { openDB, type IDBPDatabase } from 'idb'
import type { RutaInsert } from '@/types/database.types'

export type EstadoCola = 'pendiente' | 'pendiente_login' | 'error'
export type TipoOperacion = 'guardar' | 'borrar'
export type AccionFotoCola = 'mantener' | 'reemplazar' | 'quitar'

export interface ColaItem {
  id: string
  tipo: TipoOperacion
  /** Datos de la ruta a guardar. null cuando tipo === 'borrar'. */
  ruta: RutaInsert | null
  /** Qué hacer con la foto al guardar. Solo se usa cuando tipo === 'guardar'. */
  accionFoto: AccionFotoCola
  /** Foto de portada a subir. Solo cuando accionFoto === 'reemplazar'. */
  foto: Blob | null
  /** foto_path ya existente antes de esta edición (para conservarlo si se
   * "mantiene", o para saber qué borrar si se "quita"). null en rutas nuevas. */
  fotoPathExistente: string | null
  /** Ruta del Storage a borrar junto con la fila. Solo cuando tipo === 'borrar'. */
  fotoPathABorrar: string | null
  estado: EstadoCola
  /** true si el último fallo fue de política/permisos (no transitorio): no
   * se reintenta automáticamente, solo con un reintento manual explícito. */
  bloqueado: boolean
  intentos: number
  errorMensaje: string | null
  creadoEn: string
}

const DB_NAME = 'rutacora-offline'
const DB_VERSION = 1
const STORE = 'cola'

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

export async function putColaItem(item: ColaItem): Promise<void> {
  const db = await getDb()
  await db.put(STORE, item)
}

export async function getColaItems(): Promise<ColaItem[]> {
  const db = await getDb()
  return db.getAll(STORE)
}

export async function deleteColaItem(id: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE, id)
}

/** Solo para tests: vacía la cola por completo. */
export async function clearCola(): Promise<void> {
  const db = await getDb()
  await db.clear(STORE)
}
