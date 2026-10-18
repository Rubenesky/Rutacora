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

## Cola offline: `saveRoute()` y `deleteRoute()`

`src/composables/useOfflineQueue.ts` es el único punto de entrada para escribir en Supabase desde la UI:

- `saveRoute()`: guarda una ruta nueva o editada. Escribe primero en IndexedDB y después intenta sincronizar (foto antes que la fila, upsert idempotente por id).
- `deleteRoute()`: borra una ruta. Pasa por la misma cola: si no hay red, queda pendiente y se reintenta igual que un guardado (borra primero la fila, después la foto del Storage).

El formulario (`RouteFormModal.vue`) y el mapa (`MapView.vue`) llaman siempre a estas funciones; nunca a Supabase directamente.

> El `window.__rutacora` que existió temporalmente para probar la cola antes de tener el formulario ya se ha retirado (era solo para desarrollo, bloque 3).

## Formulario de ruta

Botón "+ Añadir ruta" bajo el mapa, y "Editar"/"Borrar" en el popup de cada ruta. Tres formas de fijar la ubicación (todas rellenan el mismo lat/lon): tocar el mapa, arrastrar el marcador, o el botón "Usar mi ubicación" (si el permiso de geolocalización se deniega, se muestra un aviso y se puede seguir con el mapa o las coordenadas a mano). Validación en cliente (nombre, rango de lat/lon, distancia > 0, fecha obligatoria, dificultad de la lista canónica).

## Pendiente de documentar (bloques siguientes)

- Fotos (EXIF + compresión) en el formulario.
- Configuración de variables en Netlify y despliegue.
- Verificación del keep-alive (Netlify Scheduled Function contra `public.keepalive`).
