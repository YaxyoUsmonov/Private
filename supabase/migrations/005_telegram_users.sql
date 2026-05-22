create table if not exists public.telegram_users (
  telegram_user_id text primary key,
  username text null,
  first_name text null,
  last_name text null,
  language_code text null,
  is_bot boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_message_at timestamptz null,
  message_count integer not null default 0
);

alter table public.telegram_users enable row level security;

create index if not exists telegram_users_last_seen_idx
  on public.telegram_users(last_seen_at desc);

create or replace function public.upsert_telegram_user_profile(
  p_telegram_user_id text,
  p_username text,
  p_first_name text,
  p_last_name text,
  p_language_code text,
  p_is_bot boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.telegram_users (
    telegram_user_id,
    username,
    first_name,
    last_name,
    language_code,
    is_bot,
    last_seen_at,
    last_message_at,
    message_count
  )
  values (
    p_telegram_user_id,
    p_username,
    p_first_name,
    p_last_name,
    p_language_code,
    coalesce(p_is_bot, false),
    now(),
    now(),
    1
  )
  on conflict (telegram_user_id) do update
    set username = excluded.username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        language_code = excluded.language_code,
        is_bot = excluded.is_bot,
        last_seen_at = now(),
        last_message_at = now(),
        message_count = public.telegram_users.message_count + 1;
end;
$$;
