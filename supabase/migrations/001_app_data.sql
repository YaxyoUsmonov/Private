create extension if not exists pgcrypto;

create table if not exists public.app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  habits jsonb not null default '[]'::jsonb,
  tasks jsonb not null default '[]'::jsonb,
  streaks jsonb not null default '{}'::jsonb,
  journal jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  language text not null default 'Ozbekcha',
  profile_data jsonb not null default '{}'::jsonb,
  finance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_data enable row level security;

drop policy if exists "Users can read own app data" on public.app_data;
create policy "Users can read own app data"
  on public.app_data
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own app data" on public.app_data;
create policy "Users can insert own app data"
  on public.app_data
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own app data" on public.app_data;
create policy "Users can update own app data"
  on public.app_data
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_data_set_updated_at on public.app_data;
create trigger app_data_set_updated_at
  before update on public.app_data
  for each row
  execute function public.set_updated_at();
