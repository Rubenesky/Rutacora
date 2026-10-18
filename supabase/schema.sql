-- =====================================================================
-- Rutácora — esquema de base de datos (estado final)
-- =====================================================================
-- Ejecuta este archivo COMPLETO en el SQL Editor de Supabase.
-- Está envuelto en una transacción: si algo falla, no se aplica nada
-- a medias.
--
-- Modelo de acceso: el mapa es PÚBLICO de solo lectura (rol "anon") y
-- la sesión (rol "authenticated") desbloquea añadir/editar/borrar, cada
-- uno solo sobre sus propias rutas. anon nunca ve "user_id" ni
-- "created_at", ni tiene insert/update/delete.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Tabla: rutas
-- ---------------------------------------------------------------------
-- id lo genera el CLIENTE (crypto.randomUUID()) para que los reintentos
-- de la cola offline sean idempotentes (mismo id = mismo insert/upsert).
create table if not exists public.rutas (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  nombre text not null,
  lat double precision not null,
  lon double precision not null,
  distancia_km double precision not null,
  desnivel_m integer,
  duracion_min integer,
  tipo text,
  fecha date not null,
  dificultad text not null,
  notas text,
  foto_path text,
  created_at timestamptz not null default now(),

  constraint rutas_lat_valida check (lat >= -90 and lat <= 90),
  constraint rutas_lon_valida check (lon >= -180 and lon <= 180),
  constraint rutas_distancia_positiva check (distancia_km > 0),
  constraint rutas_tipo_valido check (tipo is null or tipo in ('circular', 'lineal')),
  constraint rutas_dificultad_valida check (dificultad in ('fácil', 'media', 'difícil'))
);

comment on table public.rutas is 'Rutas de senderismo. Lectura pública; escritura solo del propietario (user_id).';

-- Índices: user_id (filtro de las políticas de escritura) y fecha (orden del listado).
create index if not exists rutas_user_id_idx on public.rutas (user_id);
create index if not exists rutas_fecha_idx on public.rutas (fecha desc);

alter table public.rutas enable row level security;

-- --- Lectura pública (anon): solo las columnas no sensibles ---------
-- GRANT por columnas ("Column Level Privileges"), función oficial de
-- Supabase: https://supabase.com/docs/guides/database/postgres/column-level-security
-- Un rol restringido por columna NO puede usar select "*" (falla para
-- cualquier columna no concedida): el cliente debe pedir las columnas
-- por nombre. Ver src/lib/constantes.ts (COLUMNAS_PUBLICAS/COLUMNAS_SESION).
-- No confirmado en la documentación oficial: el código de error exacto
-- que devuelve PostgREST si de todos modos se pide una columna no
-- concedida (es coherente con el comportamiento estándar de Postgres,
-- pero no hay una cita oficial explícita para ese caso concreto).
revoke all on table public.rutas from anon;
grant select (
  id, nombre, lat, lon, distancia_km, desnivel_m, duracion_min,
  tipo, dificultad, fecha, notas, foto_path
) on table public.rutas to anon;

drop policy if exists "rutas: lectura pública" on public.rutas;
create policy "rutas: lectura pública"
  on public.rutas
  for select
  to anon
  using (true);

-- --- Sesión (authenticated): lee todo, escribe solo lo propio -------
-- GRANTs (verificado en la documentación oficial de Supabase, octubre
-- 2026): Supabase retira los grants automáticos sobre tablas nuevas de
-- "public"; sin este GRANT explícito, PostgREST devuelve 42501
-- ("permission denied") antes de evaluar la política RLS.
-- Fuentes oficiales:
--   https://supabase.com/docs/guides/database/postgres/row-level-security
--   https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
revoke all on table public.rutas from authenticated;
grant select, insert, update, delete on table public.rutas to authenticated;

drop policy if exists "rutas: el propietario gestiona sus rutas" on public.rutas;

drop policy if exists "rutas: lectura con sesión" on public.rutas;
create policy "rutas: lectura con sesión"
  on public.rutas
  for select
  to authenticated
  using (true);

drop policy if exists "rutas: insertar las propias" on public.rutas;
create policy "rutas: insertar las propias"
  on public.rutas
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "rutas: editar las propias" on public.rutas;
create policy "rutas: editar las propias"
  on public.rutas
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "rutas: borrar las propias" on public.rutas;
create policy "rutas: borrar las propias"
  on public.rutas
  for delete
  to authenticated
  using (user_id = auth.uid());

-- NOTA sobre "GRANT USAGE ON SCHEMA public":
-- No he encontrado confirmación oficial de que sea necesario para este caso.
-- La documentación de Supabase solo lo menciona para esquemas personalizados
-- (no para "public"), y Postgres concede USAGE sobre el esquema "public" a
-- PUBLIC por defecto al crear la base de datos. No lo añado para no ejecutar
-- algo no verificado. Si al probar la Data API obtienes
-- "permission denied for schema public", avísame y añadimos:
--   grant usage on schema public to authenticated;

-- ---------------------------------------------------------------------
-- Tabla: keepalive
-- ---------------------------------------------------------------------
-- Una sola fila, sin datos sensibles. La Netlify Scheduled Function la
-- consulta con la clave anon cada 12h para que cuente como actividad y
-- Supabase no pause el proyecto por inactividad.
create table if not exists public.keepalive (
  id smallint primary key default 1,
  pinged_at timestamptz not null default now(),
  constraint keepalive_fila_unica check (id = 1)
);

comment on table public.keepalive is 'Fila única para el ping de mantenimiento (keep-alive). Sin datos sensibles.';

insert into public.keepalive (id, pinged_at)
values (1, now())
on conflict (id) do nothing;

alter table public.keepalive enable row level security;

drop policy if exists "keepalive: lectura pública" on public.keepalive;
create policy "keepalive: lectura pública"
  on public.keepalive
  for select
  to anon
  using (true);

-- Mismo patrón que el ejemplo oficial de tabla de lectura pública en la
-- guía de RLS de Supabase: solo SELECT, solo para "anon".
revoke all on table public.keepalive from anon, authenticated;
grant select on table public.keepalive to anon;

-- ---------------------------------------------------------------------
-- Storage: bucket "fotos-rutas" (privado, con lectura pública controlada)
-- ---------------------------------------------------------------------
-- El bucket sigue PRIVADO (public = false): no es listable ni descargable
-- por URL directa. Solo se puede leer generando una URL firmada, y solo
-- si una política SELECT lo autoriza (abajo). No se requiere ningún GRANT
-- de Postgres adicional para Storage (confirmado: el cambio de grants por
-- defecto de Supabase no afecta a storage.objects).
-- Fuente: https://supabase.com/docs/guides/storage/security/access-control
insert into storage.buckets (id, name, public)
values ('fotos-rutas', 'fotos-rutas', false)
on conflict (id) do update set public = false;

-- Lectura pública (anon): patrón oficial de Supabase para dar lectura a
-- un bucket privado SIN permitir listar su contenido (storage.allow_any_
-- operation limita la política a "obtener" un objeto conocido, no a
-- listar la carpeta) — ejemplo oficial del bucket "avatars" en la misma
-- página de la fuente de arriba. Así se pueden generar URLs firmadas de
-- las fotos de rutas públicas sin exponer el listado completo del bucket.
drop policy if exists "fotos-rutas: lectura pública" on storage.objects;
create policy "fotos-rutas: lectura pública"
  on storage.objects
  for select
  to anon
  using (
    bucket_id = 'fotos-rutas'
    and storage.allow_any_operation(array['object.get_authenticated_info', 'object.get_authenticated'])
  );

-- Lectura con sesión: a nivel de bucket (no solo la propia carpeta), para
-- que con sesión se vean las fotos de todas las rutas, igual que sin ella.
drop policy if exists "fotos-rutas: el propietario lee su carpeta" on storage.objects;
drop policy if exists "fotos-rutas: lectura con sesión" on storage.objects;
create policy "fotos-rutas: lectura con sesión"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'fotos-rutas');

-- Ruta de archivo: {user_id}/{ruta_id}.jpg -> storage.foldername(name)
-- devuelve el array de carpetas del path, así que el primer elemento es
-- el user_id. Escribir (insert/update/delete) sigue limitado a la propia
-- carpeta.
drop policy if exists "fotos-rutas: el propietario sube a su carpeta" on storage.objects;
create policy "fotos-rutas: el propietario sube a su carpeta"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'fotos-rutas'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "fotos-rutas: el propietario actualiza su carpeta" on storage.objects;
create policy "fotos-rutas: el propietario actualiza su carpeta"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'fotos-rutas'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'fotos-rutas'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "fotos-rutas: el propietario borra su carpeta" on storage.objects;
create policy "fotos-rutas: el propietario borra su carpeta"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'fotos-rutas'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
