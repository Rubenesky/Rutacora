import type { Config } from '@netlify/functions'

// Ping de mantenimiento programado: evita que Supabase pause el proyecto
// del plan gratuito por inactividad (ver supabase/schema.sql,
// public.keepalive). Documentación oficial consultada antes de escribir
// esto: https://docs.netlify.com/build/functions/scheduled-functions/ (cron
// estándar en UTC, límite de 30s, solo corre en deploys publicados,
// disponible en el plan gratuito) y
// https://docs.netlify.com/build/functions/environment-variables/
// (process.env, variable disponible en runtime solo si su alcance incluye
// "Functions" o "todos").

const TIMEOUT_MS = 10_000

function normalizarOrigen(url: string): string {
  return new URL(url).origin
}

export default async (): Promise<Response> => {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

  // Nunca se registra el valor de la clave ni la URL completa (ni siquiera
  // el origen): solo que faltan, o el status/motivo del fallo.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('keepalive: faltan SUPABASE_URL o SUPABASE_ANON_KEY en el entorno')
    return new Response('Faltan variables de entorno', { status: 500 })
  }

  let origen: string
  try {
    // new URL(...).origin descarta cualquier /rest/v1 o barra final que
    // pudiera llevar la variable (igual que src/lib/supabaseUrl.ts en el
    // cliente).
    origen = normalizarOrigen(supabaseUrl)
  } catch {
    console.error('keepalive: SUPABASE_URL no es una URL válida')
    return new Response('SUPABASE_URL no es una URL válida', { status: 500 })
  }

  const headers: Record<string, string> = { apikey: supabaseAnonKey }
  // Formato JWT antiguo (empieza por "eyJ"): además de apikey, PostgREST
  // también acepta/espera Authorization: Bearer. Las claves nuevas
  // "sb_publishable_..." no son JWT y no se envían como Bearer.
  if (supabaseAnonKey.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${supabaseAnonKey}`
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const respuesta = await fetch(`${origen}/rest/v1/keepalive?select=id&limit=1`, {
      headers,
      signal: controller.signal,
    })

    if (!respuesta.ok) {
      console.error(`keepalive: respuesta no satisfactoria (status ${respuesta.status})`)
      return new Response(`keepalive falló con status ${respuesta.status}`, { status: 502 })
    }

    const filas: unknown = await respuesta.json()
    if (!Array.isArray(filas) || filas.length === 0) {
      console.error('keepalive: la respuesta no trajo ninguna fila')
      return new Response('keepalive: respuesta sin filas', { status: 502 })
    }

    console.log('keepalive: ok')
    return new Response('ok', { status: 200 })
  } catch (error) {
    const esTimeout = error instanceof Error && error.name === 'AbortError'
    console.error(esTimeout ? 'keepalive: timeout (10s)' : 'keepalive: error de red')
    return new Response(esTimeout ? 'Timeout' : 'Error de red', { status: 504 })
  } finally {
    clearTimeout(timeoutId)
  }
}

export const config: Config = {
  schedule: '0 */12 * * *',
}
