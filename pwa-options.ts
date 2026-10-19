import type { VitePWAOptions } from 'vite-plugin-pwa'

// Opciones de VitePWA en su propio archivo (sin el resto de vite.config.ts,
// que ejecuta fileURLToPath(import.meta.url) y falla si se importa fuera de
// un entorno Vite real) para poder testear las reglas de caché directamente
// sobre este objeto en vite.config.test.ts, sin depender de introspeccionar
// la instancia de plugin ya construida (frágil) ni de parsear el sw.js
// generado por el build (lento, y solo existe tras compilar).
export const pwaOptions: Partial<VitePWAOptions> = {
  // "prompt" (no "autoUpdate"): una nueva versión NUNCA recarga la página
  // por su cuenta. Se avisa al usuario (UpdateAvailableBanner, bajo la
  // barra) y solo se aplica al pulsar "Actualizar" — y pospuesta si hay un
  // formulario abierto o una sincronización en curso (ver
  // src/composables/useServiceWorkerUpdate.ts).
  registerType: 'prompt',
  includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
  manifest: {
    id: '/',
    name: 'Rutácora',
    short_name: 'Rutácora',
    description: 'Rutas de senderismo en un mapa interactivo de España, de acceso público.',
    lang: 'es',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // Sin "orientation": no se bloquea el giro del dispositivo.
    background_color: '#f4f1ea', // --color-bg (src/style.css)
    theme_color: '#1b5e20', // --color-barra (src/style.css)
    icons: [
      {
        src: 'pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: 'maskable-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  workbox: {
    // Precachea SOLO el shell de la app (HTML/JS/CSS del build + los
    // iconos locales). No hay fuentes locales (la tipografía es del
    // sistema, ver src/style.css). Ni las teselas del mapa (OSM,
    // OpenTopoMap, IGN/PNOA) ni las peticiones a Supabase entran en este
    // patrón: son de otro origen, así que el precache nunca las toca.
    globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
    // Navegación SPA: cualquier ruta de documento sirve el shell cacheado,
    // excepto las funciones de Netlify (no son parte de la SPA).
    navigateFallback: 'index.html',
    navigateFallbackDenylist: [/^\/\.netlify\//],
    // Nunca cachear nada de Supabase (auth/datos/fotos): ni autenticado ni
    // público, para que un cierre de sesión no pueda dejar algo autenticado
    // en caché y para que la lista pública nunca quede desfasada.
    // NetworkOnly explícito en vez de confiar en que "no está en
    // globPatterns": dejar esto documentado y verificado por un test (ver
    // vite.config.test.ts) para que un futuro runtimeCaching añadido sin
    // cuidado no lo rompa en silencio.
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/[^/]+\.supabase\.co\/(auth|rest|storage)\/v1\/.*/,
        handler: 'NetworkOnly',
      },
    ],
  },
}
