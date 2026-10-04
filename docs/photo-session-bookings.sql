create table if not exists public.photo_session_bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  contact text not null,
  date text not null,
  package_name text,
  package_price text,
  time_window text,
  status text not null default 'logged',
  email_sent boolean not null default false,
  email_error text,
  payload jsonb not null default '{}'::jsonb,
  user_agent text
);

create index if not exists photo_session_bookings_created_at_idx
  on public.photo_session_bookings (created_at desc);

alter table public.photo_session_bookings enable row level security;

drop policy if exists "photo_session_bookings_service_role_all" on public.photo_session_bookings;
create policy "photo_session_bookings_service_role_all"
  on public.photo_session_bookings
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
