import { openDB, type IDBPDatabase } from 'idb'
import type { RutaInsert } from '@/types/database.types'

export type EstadoCola = 'pendiente' | 'pendiente_login' | 'error'
export type TipoOperacion = 'guardar' | 'borrar'

export interface ColaItem {
  id: string
  tipo: TipoOperacion
  /** Datos de la ruta a guardar. null cuando tipo === 'borrar'. */
  ruta: RutaInsert | null
  /** Foto de portada a subir. Solo se usa cuando tipo === 'guardar'. */
  foto: Blob | null
  /** Ruta del Storage a borrar junto con la fila. Solo cuando tipo === 'borrar'. */
  fotoPathABorrar: string | null
  estado: EstadoCola
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
