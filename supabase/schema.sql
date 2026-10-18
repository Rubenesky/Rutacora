-- =====================================================================
-- Rutácora — esquema de base de datos
-- =====================================================================
-- Ejecuta este archivo COMPLETO en el SQL Editor de Supabase.
-- Está envuelto en una transacción: si algo falla, no se aplica nada
-- a medias.
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

comment on table public.rutas is 'Rutas de senderismo registradas por el usuario único de Rutácora.';

-- Índices: user_id (filtro de toda consulta por RLS) y fecha (orden del listado).
create index if not exists rutas_user_id_idx on public.rutas (user_id);
create index if not exists rutas_fecha_idx on public.rutas (fecha desc);

-- RLS: cada fila solo es visible/editable por su propietario.
alter table public.rutas enable row level security;

drop policy if exists "rutas: el propietario gestiona sus rutas" on public.rutas;
create policy "rutas: el propietario gestiona sus rutas"
  on public.rutas
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- GRANTs explícitos sobre la tabla.
-- IMPORTANTE (verificado en la documentación oficial de Supabase, octubre 2026):
-- Supabase está retirando los grants automáticos que antes se daban a las
-- tablas nuevas de "public". Sin este GRANT explícito, PostgREST devuelve el
-- error 42501 ("permission denied") ANTES de llegar a evaluar la política
-- RLS, aunque la política sea correcta.
-- Fuentes oficiales:
--   https://supabase.com/docs/guides/database/postgres/row-level-security
--   https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
revoke all on table public.rutas from anon, authenticated;
grant select, insert, update, delete on table public.rutas to authenticated;
-- "anon" no recibe ningún permiso: esta app es de un único usuario autenticado.

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
-- Storage: bucket "fotos-rutas" (privado)
-- ---------------------------------------------------------------------
-- Verificado en la documentación oficial de Storage: las políticas sobre
-- storage.objects son suficientes; no se requiere ningún GRANT de Postgres
-- adicional para Storage.
-- Fuente: https://supabase.com/docs/guides/storage/security/access-control
insert into storage.buckets (id, name, public)
values ('fotos-rutas', 'fotos-rutas', false)
on conflict (id) do update set public = false;

-- Ruta de archivo: {user_id}/{ruta_id}.jpg -> storage.foldername(name) devuelve
-- el array de carpetas del path, así que el primer elemento es el user_id.
drop policy if exists "fotos-rutas: el propietario lee su carpeta" on storage.objects;
create policy "fotos-rutas: el propietario lee su carpeta"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'fotos-rutas'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

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
