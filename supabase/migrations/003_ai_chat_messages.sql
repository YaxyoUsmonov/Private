create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_chat_messages enable row level security;

drop policy if exists "Users manage own AI chat messages" on public.ai_chat_messages;
create policy "Users manage own AI chat messages" on public.ai_chat_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists ai_chat_messages_user_created_idx
  on public.ai_chat_messages(user_id, created_at desc);
