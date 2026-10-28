import { FOTOS_BUCKET, SIGNED_URL_TTL_SEGUNDOS } from './constantes'
import { guardarUrlCacheada, obtenerUrlCacheada } from './signedUrlCache'
import { supabase } from './supabaseClient'

/**
 * Única forma de obtener una URL utilizable para una foto de Storage: usa
 * la caché si hay una vigente, o pide una URL firmada nueva (y la cachea)
 * en caso contrario. Antes había dos caminos distintos para lo mismo —
 * useLeafletMap.ts sí pasaba por la caché, RouteFormModal.vue llamaba a
 * createSignedUrl directamente y se la saltaba— que podían divergir en
 * comportamiento offline y en cuántas peticiones de firma se hacían.
 *
 * null si no hay red y no había nada en caché, o si Storage devuelve
 * error; quien llame decide qué mensaje mostrar en cada caso (por ejemplo
 * mirando navigator.onLine).
 */
export async function obtenerUrlFoto(fotoPath: string): Promise<string | null> {
  const urlCacheada = obtenerUrlCacheada(fotoPath)
  if (urlCacheada) return urlCacheada

  if (!navigator.onLine) return null

  const { data, error } = await supabase.storage
    .from(FOTOS_BUCKET)
    .createSignedUrl(fotoPath, SIGNED_URL_TTL_SEGUNDOS)

  if (error || !data) return null

  guardarUrlCacheada(fotoPath, data.signedUrl, SIGNED_URL_TTL_SEGUNDOS)
  return data.signedUrl
}
