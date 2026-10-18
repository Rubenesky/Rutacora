-- =====================================================================
-- Rutácora — migración 002: mapa público de solo lectura
-- =====================================================================
-- Cambia el modelo de acceso: el mapa pasa a ser público de solo
-- lectura (rol "anon") y la sesión (rol "authenticated") desbloquea
-- añadir/editar/borrar, cada uno solo sobre sus propias rutas.
-- Ejecuta este archivo COMPLETO en el SQL Editor de Supabase
-- (transacción: si algo falla, no se aplica nada a medias).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- public.rutas: lectura pública por columnas (sin user_id ni created_at)
-- ---------------------------------------------------------------------
-- GRANT por columnas ("Column Level Privileges"), función oficial de
-- Supabase: https://supabase.com/docs/guides/database/postgres/column-level-security
-- Un rol restringido por columna NO puede usar select "*": el cliente
-- debe pedir las columnas por nombre (ya lo hace: COLUMNAS_PUBLICAS en
-- src/lib/constantes.ts). No confirmado en la documentación oficial: el
-- código de error exacto que devolvería PostgREST si de todos modos se
-- pidiera una columna no concedida.
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

-- La política "for all" anterior se sustituye por cuatro políticas: con
-- sesión se puede LEER todas las rutas (igual que sin sesión), pero solo
-- se puede insertar/editar/borrar lo propio.
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

-- Los GRANTs de authenticated ya existentes (select, insert, update,
-- delete sobre toda la tabla) se mantienen sin cambios; las políticas de
-- arriba son las que ahora limitan cada operación por fila.

-- ---------------------------------------------------------------------
-- Storage "fotos-rutas": lectura pública de fotos (vía URL firmada)
-- ---------------------------------------------------------------------
-- El bucket sigue PRIVADO (public = false): no se hace listable ni
-- descargable por URL directa, solo se habilita generar URLs firmadas.
update storage.buckets set public = false where id = 'fotos-rutas';

-- Patrón oficial de Supabase para dar lectura pública a un bucket
-- privado SIN permitir listar su contenido (storage.allow_any_operation
-- limita la política a "obtener" un objeto conocido, no a listar la
-- carpeta) — ejemplo oficial del bucket "avatars".
-- Fuente: https://supabase.com/docs/guides/storage/security/access-control
drop policy if exists "fotos-rutas: lectura pública" on storage.objects;
create policy "fotos-rutas: lectura pública"
  on storage.objects
  for select
  to anon
  using (
    bucket_id = 'fotos-rutas'
    and storage.allow_any_operation(array['object.get_authenticated_info', 'object.get_authenticated'])
  );

-- La lectura de authenticated pasa de "solo su carpeta" a nivel de
-- bucket completo: con sesión se ven las fotos de todas las rutas.
drop policy if exists "fotos-rutas: el propietario lee su carpeta" on storage.objects;
drop policy if exists "fotos-rutas: lectura con sesión" on storage.objects;
create policy "fotos-rutas: lectura con sesión"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'fotos-rutas');

-- INSERT, UPDATE y DELETE de authenticated siguen limitadas a su propia
-- carpeta {user_id}/ (sin cambios respecto a la migración anterior).

commit;
