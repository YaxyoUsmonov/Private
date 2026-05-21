create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric not null default 0,
  category text not null default '',
  note text not null default '',
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  time text not null default '',
  done boolean not null default false,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  category text not null default '',
  note text not null default '',
  severity text not null default 'medium',
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.conclusions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  content text not null default '',
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  summary text not null default '',
  advice text not null default '',
  score integer not null default 0,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;
alter table public.plans enable row level security;
alter table public.mistakes enable row level security;
alter table public.conclusions enable row level security;
alter table public.daily_summaries enable row level security;

drop policy if exists "Users manage own transactions" on public.transactions;
create policy "Users manage own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own plans" on public.plans;
create policy "Users manage own plans" on public.plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own mistakes" on public.mistakes;
create policy "Users manage own mistakes" on public.mistakes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own conclusions" on public.conclusions;
create policy "Users manage own conclusions" on public.conclusions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own daily summaries" on public.daily_summaries;
create policy "Users manage own daily summaries" on public.daily_summaries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists transactions_user_date_idx on public.transactions(user_id, date);
create index if not exists plans_user_date_idx on public.plans(user_id, date);
create index if not exists mistakes_user_date_idx on public.mistakes(user_id, date);
create index if not exists conclusions_user_date_idx on public.conclusions(user_id, date);
create index if not exists daily_summaries_user_date_idx on public.daily_summaries(user_id, date);
