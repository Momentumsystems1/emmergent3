-- FMS Integration sandbox — capa de eventos normalizados para clientes privados
-- Tablas server-only: RLS activada sin policies (deniega anon/authenticated;
-- el edge function entra con service key, que bypassa RLS). Nunca exponer al cliente.

create table if not exists public.fms_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  api_key_hash text not null unique,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now()
);

create table if not exists public.fms_devices (
  id uuid primary key default gen_random_uuid(),
  device_key_hash text not null unique,
  label text not null,
  imei text,
  client_id uuid references public.fms_clients(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.fms_events (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.fms_devices(id) on delete cascade,
  event_type text not null check (event_type in ('v16_activated','v16_deactivated','v16_test','sos','generic')),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  payload jsonb not null default '{}'::jsonb
);
create index if not exists fms_events_received_idx on public.fms_events (received_at desc);
create index if not exists fms_events_device_idx on public.fms_events (device_id, received_at desc);

create table if not exists public.fms_webhooks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.fms_clients(id) on delete cascade,
  url text not null check (url ~ '^https://'),
  secret text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.fms_deliveries (
  id bigint generated always as identity primary key,
  webhook_id uuid not null references public.fms_webhooks(id) on delete cascade,
  event_id bigint not null references public.fms_events(id) on delete cascade,
  status_code integer,
  ok boolean not null default false,
  error text,
  attempted_at timestamptz not null default now()
);
create index if not exists fms_deliveries_webhook_idx on public.fms_deliveries (webhook_id, attempted_at desc);

alter table public.fms_clients enable row level security;
alter table public.fms_devices enable row level security;
alter table public.fms_events enable row level security;
alter table public.fms_webhooks enable row level security;
alter table public.fms_deliveries enable row level security;
