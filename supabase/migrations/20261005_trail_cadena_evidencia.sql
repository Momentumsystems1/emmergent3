-- MY CLUSTER · Capa de medición: location_trail como evidencia append-only
-- con cadena de hashes SHA-256 por usuario (diseño "caja negra" para CO2 evitado verificable)

create extension if not exists pgcrypto;

alter table location_trail add column if not exists prev_hash text;
alter table location_trail add column if not exists record_hash text;

create index if not exists idx_trail_user_at on location_trail(user_id, at desc, id desc);

-- Función canónica de hash: MISMO orden de campos para trigger y backfill
create or replace function trail_compute_hash(
  p_prev text, p_user uuid, p_group uuid,
  p_lat double precision, p_lng double precision,
  p_speed double precision, p_mode text, p_at timestamptz
) returns text language sql immutable as $$
  select encode(digest(
    coalesce(p_prev, '') || '|' ||
    p_user::text || '|' || p_group::text || '|' ||
    p_lat::text || '|' || p_lng::text || '|' ||
    coalesce(p_speed::text, '') || '|' || coalesce(p_mode, '') || '|' ||
    p_at::text
  , 'sha256'), 'hex');
$$;

-- Trigger de inserción: encadena con el último registro del usuario.
-- El advisory lock por usuario serializa inserciones concurrentes (mismo usuario,
-- varios dispositivos) para que la cadena no se bifurque.
create or replace function trail_chain_hash() returns trigger
language plpgsql as $$
declare
  prev text;
begin
  perform pg_advisory_xact_lock(hashtext(NEW.user_id::text));

  select record_hash into prev
  from location_trail
  where user_id = NEW.user_id
  order by at desc, id desc
  limit 1;

  NEW.prev_hash := prev;
  NEW.record_hash := trail_compute_hash(
    prev, NEW.user_id, NEW.group_id, NEW.lat, NEW.lng,
    NEW.speed_kmh, NEW.mode, NEW.at
  );
  return NEW;
end;
$$;

drop trigger if exists trg_trail_chain on location_trail;
create trigger trg_trail_chain
  before insert on location_trail
  for each row execute function trail_chain_hash();

-- Guardia de inmutabilidad: la evidencia no se edita ni se borra desde roles de
-- aplicación. Solo roles de servicio (postgres/service_role) pueden borrar,
-- p. ej. baja de cuenta por derecho de supresión RGPD.
create or replace function trail_guard_mutation() returns trigger
language plpgsql as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin', 'supabase_auth_admin') then
    raise exception 'location_trail es append-only: evidencia certificable, prohibida su edicion o borrado';
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

drop trigger if exists trg_trail_guard on location_trail;
create trigger trg_trail_guard
  before update or delete on location_trail
  for each row execute function trail_guard_mutation();

-- Backfill de la cadena para registros existentes (orden cronológico por usuario)
do $$
declare
  r record;
  prev text;
begin
  for r in
    select id, user_id, group_id, lat, lng, speed_kmh, mode, at
    from location_trail
    where record_hash is null
    order by user_id, at, id
  loop
    select t.record_hash into prev
    from location_trail t
    where t.user_id = r.user_id and t.record_hash is not null
      and (t.at < r.at or (t.at = r.at and t.id < r.id))
    order by t.at desc, t.id desc
    limit 1;

    update location_trail u
    set prev_hash = prev,
        record_hash = trail_compute_hash(prev, r.user_id, r.group_id, r.lat, r.lng, r.speed_kmh, r.mode, r.at)
    where u.id = r.id;
  end loop;
end;
$$;
