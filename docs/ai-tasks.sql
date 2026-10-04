create extension if not exists pgcrypto;

create table if not exists public.ai_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  title text not null,
  type text not null default 'ai' check (type in ('ai', 'work', 'job', 'paper', 'project')),
  status text not null default 'inbox' check (status in ('inbox', 'next', 'waiting', 'done', 'snoozed')),
  due_at timestamptz,
  url text,
  note text,
  source_block_id text,
  source_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_tasks_owner_status_updated_idx
  on public.ai_tasks (owner_email, status, updated_at desc);

alter table public.ai_tasks enable row level security;

drop policy if exists "ai tasks owner read" on public.ai_tasks;
create policy "ai tasks owner read"
  on public.ai_tasks
  for select
  using (lower(owner_email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "ai tasks owner insert" on public.ai_tasks;
create policy "ai tasks owner insert"
  on public.ai_tasks
  for insert
  with check (lower(owner_email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "ai tasks owner update" on public.ai_tasks;
create policy "ai tasks owner update"
  on public.ai_tasks
  for update
  using (lower(owner_email) = lower(auth.jwt() ->> 'email'))
  with check (lower(owner_email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "ai tasks owner delete" on public.ai_tasks;
create policy "ai tasks owner delete"
  on public.ai_tasks
  for delete
  using (lower(owner_email) = lower(auth.jwt() ->> 'email'));
