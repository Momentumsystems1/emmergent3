-- Quedada completa (spec Juan 2026-10-03): cuándo y duración de la quedada.
alter table public.meetings add column if not exists scheduled_at timestamptz;
alter table public.meetings add column if not exists duration_min integer not null default 60;

comment on column public.meetings.scheduled_at is 'Fecha y hora de la quedada (inicio).';
comment on column public.meetings.duration_min is 'Duración en minutos; fin = scheduled_at + duration_min.';
