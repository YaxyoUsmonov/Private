create table if not exists public.telegram_ai_usage (
  telegram_user_id bigint primary key,
  daily_count integer not null default 0,
  last_reset date not null default current_date,
  updated_at timestamptz not null default now()
);

alter table public.telegram_ai_usage enable row level security;

create index if not exists telegram_ai_usage_last_reset_idx
  on public.telegram_ai_usage(last_reset);

create or replace function public.increment_telegram_ai_usage(
  p_telegram_user_id bigint,
  p_today date,
  p_limit integer
)
returns table (
  daily_count integer,
  last_reset date,
  allowed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  current_reset date;
begin
  insert into public.telegram_ai_usage (telegram_user_id, daily_count, last_reset)
  values (p_telegram_user_id, 0, p_today)
  on conflict (telegram_user_id) do nothing;

  select u.daily_count, u.last_reset
    into current_count, current_reset
  from public.telegram_ai_usage u
  where u.telegram_user_id = p_telegram_user_id
  for update;

  if current_reset <> p_today then
    update public.telegram_ai_usage u
      set daily_count = 1,
          last_reset = p_today,
          updated_at = now()
      where u.telegram_user_id = p_telegram_user_id
      returning u.daily_count, u.last_reset, true
      into daily_count, last_reset, allowed;
    return next;
    return;
  end if;

  if current_count >= p_limit then
    daily_count := current_count;
    last_reset := current_reset;
    allowed := false;
    return next;
    return;
  end if;

  update public.telegram_ai_usage u
    set daily_count = u.daily_count + 1,
        updated_at = now()
    where u.telegram_user_id = p_telegram_user_id
    returning u.daily_count, u.last_reset, true
    into daily_count, last_reset, allowed;
  return next;
end;
$$;
