alter table public.app_data
  add column if not exists monthly_goals jsonb not null default '[]'::jsonb,
  add column if not exists trackers jsonb not null default '[]'::jsonb;
