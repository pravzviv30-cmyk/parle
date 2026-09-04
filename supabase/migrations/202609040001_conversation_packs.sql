-- Durable, server-owned learning artefacts from completed Tutor sessions.
-- The payload contract intentionally excludes raw audio and readable transcripts.

create table if not exists public.conversation_packs (
  id uuid primary key,
  session_id uuid not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  state text not null check (state in ('generating', 'ready', 'failed', 'archived')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversation_packs_user_created_idx
on public.conversation_packs (user_id, created_at desc);

alter table public.conversation_packs enable row level security;

create policy "learners read their own conversation packs"
on public.conversation_packs for select
using (auth.uid() = user_id);

-- Learners do not create or mutate packs from a device. The authenticated
-- server and Tutor agent do that after validated session completion.
