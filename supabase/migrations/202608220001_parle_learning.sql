-- Durable learner data, product evidence and voice entitlements.
-- Raw audio and full transcripts deliberately do not belong in these tables.

create table if not exists public.learner_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  namespace text not null check (namespace in (
    'profile', 'history', 'review', 'drills', 'tutorIntro', 'activity',
    'friends', 'topics', 'journal', 'missions', 'coachMarks', 'soundChecks'
  )),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) in ('object', 'array')),
  updated_at timestamptz not null default now(),
  primary key (user_id, namespace)
);

alter table public.learner_state enable row level security;

create policy "learners read their own state"
on public.learner_state for select
using (auth.uid() = user_id);

create policy "learners insert their own state"
on public.learner_state for insert
with check (auth.uid() = user_id);

create policy "learners update their own state"
on public.learner_state for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "learners delete their own state"
on public.learner_state for delete
using (auth.uid() = user_id);

create table if not exists public.product_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object'),
  occurred_at timestamptz not null default now()
);

create index if not exists product_events_user_time_idx
on public.product_events (user_id, occurred_at desc);

alter table public.product_events enable row level security;

create policy "learners append their own events"
on public.product_events for insert
with check (auth.uid() = user_id);

-- Product event history is operational data. The service role can analyse it;
-- a compromised client cannot download a learner's behavioural timeline.

create table if not exists public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'trial' check (plan in ('trial', 'starter', 'regular')),
  seconds_used integer not null default 0 check (seconds_used >= 0),
  period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

create policy "learners read their own entitlement"
on public.entitlements for select
using (auth.uid() = user_id);

-- Atomic debit. Only the server's service role may execute it; clients can
-- read their allowance but cannot grant a plan or put seconds back.
create or replace function public.consume_entitlement(p_user_id uuid, p_seconds integer)
returns public.entitlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.entitlements;
begin
  if p_seconds is null or p_seconds < 0 then
    raise exception 'seconds must be non-negative';
  end if;

  insert into public.entitlements (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.entitlements
  set
    seconds_used = least(
      case plan when 'trial' then 1800 when 'starter' then 10800 when 'regular' then 27000 else 0 end,
      case
        when period_end is not null and period_end <= now() then p_seconds
        else seconds_used + p_seconds
      end
    ),
    period_end = case
      when plan = 'trial' then null
      when period_end is null or period_end <= now() then now() + interval '30 days'
      else period_end
    end,
    updated_at = now()
  where user_id = p_user_id
  returning * into result;

  return result;
end;
$$;

revoke all on function public.consume_entitlement(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_entitlement(uuid, integer) to service_role;
