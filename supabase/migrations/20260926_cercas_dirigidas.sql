-- NG-CERCAS: cercas dirigidas por el administrador.
-- 1) zones.watch_user_ids: para quién es la cerca (quién la activa al entrar/salir).
--    '{}' = todo el grupo (compatibilidad con cercas existentes; las nuevas se configuran explícitas).
-- 2) zone_subscriptions: quién recibe el aviso de cada cerca. NUNCA notificación implícita a todo el grupo.
-- 3) zone_events SELECT: solo admins o suscriptores de esa cerca ven sus eventos.

alter table public.zones
  add column if not exists watch_user_ids uuid[] not null default '{}';

create table if not exists public.zone_subscriptions (
  zone_id uuid not null references public.zones(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (zone_id, user_id)
);

alter table public.zone_subscriptions enable row level security;

drop policy if exists zone_subs_select on public.zone_subscriptions;
create policy zone_subs_select on public.zone_subscriptions
  for select using (
    exists (select 1 from zones z where z.id = zone_id and is_member(z.group_id))
  );

drop policy if exists zone_subs_admin_write on public.zone_subscriptions;
create policy zone_subs_admin_write on public.zone_subscriptions
  for all
  using (exists (select 1 from zones z where z.id = zone_id and is_group_admin(z.group_id)))
  with check (exists (select 1 from zones z where z.id = zone_id and is_group_admin(z.group_id)));

-- Los eventos de una cerca solo los ve quien recibe el aviso (suscriptor) o un administrador.
drop policy if exists zone_events_select_members on public.zone_events;
create policy zone_events_select_members on public.zone_events
  for select using (
    is_group_admin(group_id)
    or exists (
      select 1 from zone_subscriptions s
      where s.zone_id = zone_events.zone_id and s.user_id = auth.uid()
    )
  );
