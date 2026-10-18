export function normalizeSupabaseUrl(rawUrl: string): string {
  let url: URL

  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error(`VITE_SUPABASE_URL no es una URL válida: "${rawUrl}"`)
  }

  const origin = url.origin

  if (rawUrl !== origin) {
    console.warn(
      `[Rutácora] VITE_SUPABASE_URL debería ser solo el origen (p. ej. "${origin}"), ` +
        `sin ruta ni barra final. Se ha normalizado automáticamente desde "${rawUrl}".`,
    )
  }

  return origin
}
