# Rutácora

PWA personal para registrar y ver en un mapa de España las rutas de senderismo realizadas. Pensada para usarse desde el móvil (Android), a menudo sin cobertura, justo al terminar cada ruta.

> Estado: en construcción por bloques. Este README se completará en el bloque final con los pasos exactos de despliegue.

## Stack

- Vite + Vue 3 (Composition API, `<script setup>`) + TypeScript estricto
- Leaflet + leaflet.markercluster (en un composable propio, sin vue-leaflet)
- Supabase (Postgres + Storage + Auth)
- vite-plugin-pwa + idb (cola offline)
- exifr + browser-image-compression
- Despliegue en Netlify

## Desarrollo

```bash
npm install
npm run dev        # servidor de desarrollo
npm run lint        # ESLint
npm run typecheck   # vue-tsc
npm test            # Vitest
npm run build        # build de producción
```

## Variables de entorno

Copia `.env.example` a `.env.local` y rellena con los valores de tu proyecto Supabase:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Base de datos (Supabase)

1. Abre el **SQL Editor** de tu proyecto Supabase.
2. Ejecuta el contenido completo de `supabase/schema.sql` (va en una transacción: si algo falla, no queda nada a medias).
3. Comprueba que se crearon las tablas `public.rutas` y `public.keepalive`, y el bucket privado `fotos-rutas` con sus políticas.

### Regenerar `src/types/database.types.ts`

Este archivo está escrito a mano (coherente con `supabase/schema.sql`) porque aquí no hay acceso al proyecto Supabase real. Si cambias el esquema, puedes regenerarlo automáticamente con la CLI de Supabase:

```bash
npx supabase login
npx supabase gen types typescript --project-id TU_PROJECT_ID > src/types/database.types.ts
```

## Mapa: capa del IGN (pendiente de verificación visual)

La capa "IGN (Mapa Topográfico Nacional)" usa una URL de teselas WMTS construida a partir de parámetros oficiales confirmados en el `GetCapabilities` del IGN (capa `MTN`, `tilematrixset=GoogleMapsCompatible`, formato `image/jpeg`), pero el IGN no publica una plantilla "lista para usar" en Leaflet. Al probar la app en local, comprueba visualmente que esa capa carga teselas correctamente; si no es así, dímelo.

## Pendiente de documentar (bloques siguientes)

- Cola offline (IndexedDB) y función `saveRoute()`.
- Configuración de variables en Netlify y despliegue.
- Verificación del keep-alive (Netlify Scheduled Function contra `public.keepalive`).
