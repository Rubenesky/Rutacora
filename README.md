# Rutácora

Rutas de senderismo en un mapa interactivo de España: un único editor con sesión, y mapa de solo lectura abierto a cualquier visitante.

[![CI](https://github.com/Rubenesky/Rutacora/actions/workflows/ci.yml/badge.svg)](https://github.com/Rubenesky/Rutacora/actions/workflows/ci.yml)

**Demo:** <!-- TODO: URL de Netlify tras el despliegue -->

## Qué es y por qué

Después de una ruta de senderismo, lo normal es querer apuntar dónde ha sido, cuánto ha durado y cómo de dura era, muchas veces con el móvil sin cobertura y la batería baja. Rutácora es ese cuaderno: un mapa donde cada ruta queda marcada con sus datos y una foto, pensado para usarse en el momento, en el campo, con o sin conexión. El mapa en sí es público (cualquiera puede verlo y consultar las rutas), pero solo quien tiene sesión puede añadir, editar o borrar — sus propias rutas, nunca las de otra persona.

## Funcionalidades

- Mapa interactivo (Leaflet) con capas OpenStreetMap, OpenTopoMap, IGN (Mapa Topográfico Nacional) y PNOA (ortofoto satélite), con agrupación de marcadores (clustering).
- Lectura pública sin necesidad de cuenta: nombre, ubicación, distancia, desnivel, duración, tipo, fecha, dificultad, notas y foto de cada ruta.
- Sesión (un único editor) para añadir, editar y borrar rutas: formulario con ubicación por mapa, arrastre del marcador o geolocalización del dispositivo.
- Foto de portada por ruta: EXIF leído solo para auto-rellenar la ubicación (nunca se sube), orientación corregida, redimensionada y recomprimida en el propio navegador antes de subirla.
- Lista de rutas ordenable (nombre, fecha, distancia), con panel lateral en escritorio y hoja inferior en móvil.
- Cola de guardado offline: añadir, editar y borrar funcionan sin conexión y se sincronizan solos al recuperarla.
- PWA instalable, con el shell disponible sin conexión y aviso de actualización que nunca recarga la página sin permiso.
- Exportar datos: con sesión, descarga un JSON con todas las rutas propias (sin fotos, sin URLs firmadas, sin pendientes de la cola).
- Keep-alive programado (Netlify Scheduled Function) contra `public.keepalive`, para que el plan gratuito de Supabase no pause el proyecto por inactividad.

## Capturas

_(Carpeta `docs/img/`, con datos de ejemplo — ver la lista de capturas pendientes en la respuesta donde se entregó este README.)_

| | |
|---|---|
| ![Mapa público](docs/img/mapa-publico.png) Mapa público, sin sesión | ![Popup con sesión](docs/img/popup-con-sesion.png) Popup de una ruta propia, con sesión |
| ![Formulario](docs/img/formulario-anadir-ruta.png) Formulario "Añadir ruta" | ![Panel de rutas](docs/img/panel-rutas-movil.png) Panel "Rutas" en móvil |

## Stack y decisiones

| Decisión | Motivo |
|---|---|
| Vue 3 (Composition API, `<script setup>`) + Vite + TypeScript estricto | Stack moderno, tipado de extremo a extremo, arranque de desarrollo rápido. |
| Leaflet + leaflet.markercluster directo, sin wrapper (`vue-leaflet` u otro) | El mapa necesita control fino sobre popups con contenido dinámico (acciones según sesión, foto cargada tarde) y recolocación manual; un wrapper añadía una capa de indirección sin aportar nada aquí. |
| Supabase (Postgres + Auth + Storage) | Backend completo sin mantener servidor propio; RLS a nivel de fila y de columna resuelve el modelo "público de lectura, privado de escritura" sin lógica de autorización en el cliente. |
| Cola offline en IndexedDB (`idb`), no una librería de sincronización genérica | El caso de uso es simple y acotado (guardar/editar/borrar una ruta) y necesita reglas propias (qué pasa si caduca la sesión, qué pasa si la foto falla a mitad); una librería genérica no encajaba mejor que escribirlo directamente. |
| Compresión de foto propia sobre `canvas`, no `browser-image-compression` | Se necesitaba control exacto sobre la corrección de orientación EXIF y un resultado determinista para poder testearlo; la librería de terceros no ofrecía ese control fino (ver `src/lib/procesarFoto.ts`). |
| PWA con `vite-plugin-pwa` | Integración directa con Vite, service worker generado (Workbox) sin mantenerlo a mano. |
| Netlify | Despliegue estático con funciones programadas incluidas (para el keep-alive, ver "Hoja de ruta": todavía no implementada) y variables de entorno gestionadas. |

## Arquitectura

```mermaid
flowchart LR
  subgraph Cliente["Cliente (PWA)"]
    UI["Vue 3 + Leaflet"]
    Cola["Cola offline (IndexedDB)"]
    SW["Service worker (precache del shell)"]
  end

  subgraph Supabase
    Auth["Auth"]
    DB[("Postgres: rutas, keepalive")]
    Storage["Storage: fotos-rutas"]
  end

  Netlify["Netlify (hosting + CI)"]
  KeepAlive["netlify/functions/keepalive.ts\n(cron cada 12h)"]

  UI --> Cola
  Cola --> Auth
  Cola --> DB
  Cola --> Storage
  UI -- "lectura pública" --> DB
  UI -- "fotos vía URL firmada" --> Storage
  Netlify --> UI
  KeepAlive -- "ping" --> DB
```

## Modelo de datos y seguridad

Tabla `public.rutas` (RLS activado): `id` (uuid, lo genera el cliente para que los reintentos de la cola sean idempotentes), `user_id`, `nombre`, `lat`/`lon`, `distancia_km`, `desnivel_m`, `duracion_min`, `tipo`, `fecha`, `dificultad`, `notas`, `foto_path`, `created_at`.

- **anon** (sin sesión): `GRANT SELECT` solo sobre las columnas públicas (sin `user_id` ni `created_at`, mediante "Column Level Privileges" de Postgres/Supabase) y una política RLS de solo lectura. No tiene `INSERT`/`UPDATE`/`DELETE`.
- **authenticated** (con sesión): lee la tabla completa, y cuatro políticas separadas — una por operación — limitan `INSERT`/`UPDATE`/`DELETE` a las filas donde `user_id = auth.uid()`.
- El bucket de Storage `fotos-rutas` es **privado** (`public = false`): nunca listable ni descargable por URL directa. Una política permite a `anon` leer un objeto conocido (vía URL firmada, caducan en 1 hora) sin poder listar el bucket; `authenticated` puede subir/editar/borrar solo dentro de su propia carpeta `{user_id}/`.
- La `anon key` es pública por diseño (viaja en el bundle del cliente): la seguridad real no depende de ocultarla, sino de las políticas RLS y los GRANT de arriba. En el cliente nunca se usa `service_role`.
- `index.html` lleva `<meta name="robots" content="noindex, nofollow">` y `public/robots.txt` deniega todo: no es un buscador de rutas públicas pensado para indexarse, solo accesible por enlace directo.
- Las fotos se recomprimen en el navegador antes de subir (`src/lib/procesarFoto.ts`), lo que también elimina el EXIF/GPS original del archivo final.

### Qué es público

Sin sesión se ve: nombre, coordenadas, distancia, desnivel, duración, tipo, fecha, dificultad, notas y foto de cada ruta. No se ve `user_id` ni `created_at`.

> **Aviso:** no registres rutas que empiecen en un domicilio — las coordenadas del punto de inicio son públicas.

## Offline

`src/composables/useOfflineQueue.ts` es el único punto de entrada para guardar/editar/borrar: todo pasa primero por IndexedDB.

- **Idempotencia:** el `id` de cada ruta lo genera el cliente (`crypto.randomUUID()`), así que un reintento tras un fallo a mitad repite el mismo `upsert`/`delete`, nunca duplica.
- **Estados de cada elemento de la cola:** `pendiente` (esperando sincronizar), `pendiente_login` (sin sesión usable en el momento de sincronizar), `pendiente_login_otra_cuenta` (hay sesión, pero de una cuenta distinta a la que lo encoló), `error` (falló y se reintentará solo, salvo que sea un error de permisos, que requiere reintento manual).
- **Sesión caducada sin red:** `supabase-js` conserva la sesión guardada si falla el refresco del token por un error de red, y solo la invalida ante un rechazo explícito del servidor (ver `src/composables/useAuth.ts`). Si de verdad no hay sesión usable al sincronizar, el elemento queda `pendiente_login` en vez de perderse.
- **Limitaciones:** una sola foto por ruta; sin capa de mapa offline (ver "Limitaciones" más abajo); sin GPX; la exportación de datos (JSON, con sesión) tampoco incluye fotos.

## Puesta en marcha

Requisitos: Node 22, una cuenta de Supabase.

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En el **SQL Editor**, ejecuta el contenido completo de `supabase/schema.sql`.
3. En **Authentication → Users**, crea el único usuario editor a mano, con **Auto Confirm User** activado (no hay registro público: el formulario de alta está deshabilitado a propósito).
4. Copia `.env.example` a `.env.local` y rellena:

   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```

   `VITE_SUPABASE_URL` es solo el origen del proyecto (`https://TU-PROYECTO.supabase.co`), **sin** `/rest/v1` ni barra final — `src/lib/supabaseUrl.ts` lo valida al arrancar y avisa si se cuela alguna de esas dos cosas.

5. Instala y arranca:

   ```bash
   npm install
   npm run dev          # servidor de desarrollo
   npm run lint         # ESLint
   npm run typecheck    # vue-tsc
   npm test             # Vitest
   npm run build        # build de producción (vue-tsc -b + vite build)
   npm run generate-pwa-assets  # regenera los iconos de la PWA desde public/favicon.svg
   ```

## Tests y CI

`npm test` (Vitest + jsdom + `@vue/test-utils`) cubre, entre otras cosas: la regla de propiedad de rutas (Editar/Borrar solo del dueño, incluida la regresión de la carrera de sesión al arrancar), el interruptor y la mutua exclusión de los paneles superpuestos (Rutas/login/formulario), el historial del gesto "atrás", el contraste de color de la barra, la cola offline (guardar/editar/borrar, reintentos, estados), el procesado de fotos, las reglas de caché del service worker (nunca Supabase, siempre el shell), la lógica de "no recargar sola" del aviso de actualización, la función de keep-alive (éxito, 401, error de red, timeout, variables ausentes, normalización de la URL — con `fetch` simulado), la exportación de datos (contenido, solo rutas propias, sin URLs firmadas, botón oculto sin sesión) y que `netlify/functions/` solo contenga funciones desplegables (sin tests, mocks ni `.d.ts`, con nombres de archivo válidos para Netlify — ver `tests/netlify/functionsDirectory.test.ts`; Netlify despliega cada archivo de esa carpeta como una función independiente, así que un archivo de test ahí dentro rompe el despliegue real). `.github/workflows/ci.yml` ejecuta lint, `vue-tsc` y los tests en cada push y pull request a `main`.

## Despliegue en Netlify

1. Conecta el repositorio en Netlify (build command `npm run build`, publish directory `dist`, ya configurado en `netlify.toml`).
2. Variables de entorno, en **Site configuration → Environment variables**:
   - `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (cliente, con prefijo `VITE_` para que Vite las incluya en el build).
   - `SUPABASE_URL` y `SUPABASE_ANON_KEY` (sin prefijo: las lee `netlify/functions/keepalive.ts` vía `process.env`, no el build del cliente). Mismos valores que las anteriores, sin `/rest/v1` ni barra final — la función normaliza la URL igualmente, pero no hace falta forzarlo.
3. Las funciones programadas de Netlify solo se ejecutan en **deploys publicados** (no en deploy previews ni en local): no hay forma de probarlas antes de desplegar de verdad.
4. **Verificación del keep-alive tras desplegar:** la función (`netlify/functions/keepalive.ts`) está escrita, probada con `fetch` simulado y pasa el build, pero **no se ha verificado todavía en producción** (no tengo acceso a tu proyecto de Netlify/Supabase). Para comprobarla:
   - En el panel de Netlify, **Functions → keepalive**, pulsa **Run now** para forzar una ejecución sin esperar a la programación.
   - Mira sus logs: debe terminar con `keepalive: ok` (200). Si falta alguna variable de entorno o la petición falla, el log lo dice (status HTTP o "timeout"/"error de red"), sin mostrar nunca la clave ni la URL completa.
   - La función hace un `SELECT` (no modifica `pinged_at`, que sigue siendo el de cuando se ejecutó `schema.sql`). No he podido confirmar de forma oficial que una consulta de lectura cuente como "actividad" a ojos de Supabase para evitar la pausa del plan gratuito; si tras desplegar ves que el proyecto se pausa igualmente, avisa para revisarlo (podría necesitarse un `UPDATE` en vez de un `SELECT`).

## Verificación de seguridad tras desplegar

Consultas para ejecutar en el **SQL Editor** de Supabase (no las he podido ejecutar yo: no tengo acceso a tu proyecto). `set local role anon` dentro de una transacción simula una petición sin sesión sin tocar permisos reales.

```sql
begin;
set local role anon;

-- Debe funcionar (columnas públicas):
select id, nombre, lat, lon, distancia_km, desnivel_m, duracion_min,
       tipo, dificultad, fecha, notas, foto_path
from public.rutas
limit 5;

-- Debe fallar (select "*" incluye columnas no concedidas a anon, como user_id):
select * from public.rutas limit 1;

-- Debe fallar (anon no tiene INSERT/UPDATE/DELETE):
delete from public.rutas where id = '00000000-0000-0000-0000-000000000000';

rollback;
```

```sql
-- Debe devolver false:
select public from storage.buckets where id = 'fotos-rutas';
```

Que `anon` no puede **listar** el bucket (solo leer un archivo conocido por su ruta) se comprueba a nivel de API de Storage, no con SQL directo: una petición a `POST {VITE_SUPABASE_URL}/storage/v1/object/list/fotos-rutas` con la `anon key` como `apikey`/`Authorization` debe devolver un error, mientras que descargar una URL firmada generada por la app sí debe funcionar.

## Limitaciones y decisiones

- El plan gratuito de Supabase pausa el proyecto tras 7 días sin actividad suficiente. Mitigación: `netlify/functions/keepalive.ts`, una función programada (cron cada 12 h) que consulta `public.keepalive` con la clave anon — implementada y probada, pero **sin verificar todavía en producción** (ver "Despliegue en Netlify").
- Sin caché de teselas de mapa offline: las capas (OSM, OpenTopoMap, IGN, PNOA) son de terceros y bajo licencias distintas; cachear sus teselas sin más consideración excede el alcance actual.
- Una foto de portada por ruta (sin galería).
- Sin campo de provincia/región.
- Sin exportación/importación GPX.

## Hoja de ruta

Ideas consideradas y aplazadas explícitamente durante el desarrollo:

- Multiusuario / registro público (el diseño actual es deliberadamente de un único editor con sesión).
- Caché offline de teselas de mapa.
- Varias fotos por ruta, importación GPX (la exportación ya existe, en JSON; ver "Funcionalidades"), campo de provincia.
- Fotos incluidas en la exportación de datos (hoy se excluyen a propósito).

## Licencia

Sin decidir todavía — no se declara ninguna licencia en este repositorio por ahora.

## Licencias y atribuciones de terceros

- **IGN (Instituto Geográfico Nacional de España)** — capas "Mapa Topográfico Nacional" y PNOA (ortofoto): `© Instituto Geográfico Nacional de España (IGN)`, PNOA además `· PNOA · CC BY 4.0 scne.es`. Licencia: CC BY 4.0, confirmada en el `AccessConstraints` del `GetCapabilities` oficial de cada servicio y en las [condiciones de licencia de uso del IGN](https://www.ign.es/resources/licencia/Condiciones_licenciaUso_IGN.pdf).
- **OpenStreetMap** — datos de mapa: `© colaboradores de OpenStreetMap`, [openstreetmap.org/copyright](https://www.openstreetmap.org/copyright).
- **OpenTopoMap** — estilo de mapa topográfico: datos de OpenStreetMap y [SRTM](https://viewfinderpanoramas.org), estilo `© OpenTopoMap`, licencia [CC-BY-SA](https://creativecommons.org/licenses/by-sa/3.0/).
- **Leaflet** y **Leaflet.markercluster** — librería de mapa y agrupación de marcadores (licencia BSD-2-Clause).
- **Supabase**, **Vue 3**, **Vite**, **vite-plugin-pwa**, **idb**, **exifr** — librerías principales del stack (ver `package.json` para versiones exactas).

## Estructura del proyecto

```
├── public/                  # Estáticos servidos tal cual (iconos PWA, favicon, robots.txt)
├── src/
│   ├── components/          # Componentes Vue (mapa, barra, formulario, paneles, avisos)
│   ├── composables/         # Estado compartido tipo singleton (sesión, rutas, cola offline,
│   │                        # paneles superpuestos, actualización de la PWA, prompt de instalar)
│   ├── lib/                 # Funciones puras y utilidades (procesado de foto, validación,
│   │                        # cliente de Supabase, caché de URLs firmadas, orden de rutas)
│   ├── types/                # Tipos generados/escritos a mano del esquema de Supabase
│   └── test/                 # Configuración y polyfills compartidos de Vitest
├── supabase/
│   ├── schema.sql             # Esquema completo, estado final (ejecutar en un proyecto nuevo)
│   └── migrations/            # Diffs incrementales (para un proyecto que ya tenía un estado anterior)
├── netlify/functions/keepalive.ts  # Ping programado (cron) contra public.keepalive — SOLO
│                                   # la función: Netlify despliega cada archivo de esta
│                                   # carpeta como una función independiente, así que sus
│                                   # tests viven aparte, en tests/netlify/
├── tests/netlify/                  # Tests de las funciones de Netlify (fuera de netlify/functions/
│                                   # a propósito) y el test que vigila que esa carpeta
│                                   # siga conteniendo solo funciones desplegables
├── pwa-options.ts / pwa-assets.config.ts  # Configuración de la PWA y generación de iconos
├── netlify.toml              # Redirect SPA, cabeceras de caché y seguridad
└── .github/workflows/ci.yml  # Lint + typecheck + tests en cada push/PR a main
```
