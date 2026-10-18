import { openDB, type IDBPDatabase } from 'idb'
import type { RutaInsert } from '@/types/database.types'

export type EstadoCola = 'pendiente' | 'pendiente_login' | 'error'

export interface ColaItem {
  id: string
  ruta: RutaInsert
  foto: Blob | null
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
