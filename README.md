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

## Pendiente de documentar (bloques siguientes)

- Ejecución de `supabase/schema.sql` en el SQL Editor de Supabase.
- Regeneración de `src/types/database.types.ts` si cambia el esquema.
- Configuración de variables en Netlify y despliegue.
- Verificación del keep-alive (Netlify Scheduled Function).
