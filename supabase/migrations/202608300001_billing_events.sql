-- F244 — a billing event is recorded once, whatever the webhook does.
--
-- RevenueCat retries a webhook it did not get a 2xx for, and Apple redelivers a
-- notification for hours. Both are correct: at-least-once is the only delivery promise a
-- payment vendor can make over the internet. Exactly-once has to be built on our side,
-- and the place to build it is the primary key of a table, not a check in the handler.
--
-- So this is session_usage again, for money that arrives instead of money that is spent.
-- The event id is the primary key, the insert is `on conflict do nothing`, and the
-- function answers one question: is this the first time we have seen this event? A
-- second delivery answers false and F248 acknowledges it without fetching the subscriber
-- or reprojecting an entitlement it has already projected.
--
-- The guard is written `recorded is not true` and it is written that way on purpose.
-- F73 and F74 were one defect in the two other money functions: `insert ... on conflict
-- do nothing returning true into <flag>` assigns NULL when the statement affects zero
-- rows, `not NULL` is NULL, and a plpgsql IF on NULL takes neither branch — so control
-- fell past `end if` and the money moved. Both were found live. This is the third money
-- function in the schema and the first one that starts null-safe.
--
-- Two boundaries are deliberate:
--
--   * a duplicate that another transaction holds uncommitted is skipped by `on conflict
--     do nothing` without blocking, so the follow-up read can find nothing at all. That
--     is not a replay and it is not a first sighting; the function raises, the vendor
--     retries, and no event is lost. Answering "already seen" there would acknowledge an
--     event whose first delivery may still roll back.
--   * a replay naming a different account is still a replay. RevenueCat aliases and
--     transfers app_user_ids, so refusing on the ownership mismatch would turn a legal
--     transfer into a webhook that retries until the vendor gives up. The row we already
--     hold is the record of what we acted on; the answer is false either way.
--
-- RLS is on with no policies at all, and every client role is revoked, exactly as
-- session_usage does it. A learner has no business reading which payment events we have
-- processed, and PostgREST cannot reach the table without a policy even if one did.
--
-- The rows die with the account. RevenueCat and Apple hold the financial record of truth
-- and hold it for years; our copy is a replay ledger, not an accounting record, and a
-- deleted learner's event ids protect nobody once there is no learner to protect.
--
-- Forward-only, bounded, idempotent and retryable: one new table, one new index, one new
-- function, every create guarded, no existing object altered and no row touched.
--
-- Rolling this back destroys the ledger. See supabase/rollback/202608300001_down.sql.

create table if not exists public.billing_events (
  event_id text primary key check (event_id ~ '^[a-zA-Z0-9:._-]{1,128}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null default 'unknown' check (char_length(event_type) between 1 and 80),
  received_at timestamptz not null default now()
);

create index if not exists billing_events_user_time_idx
on public.billing_events (user_id, received_at desc);

alter table public.billing_events enable row level security;

-- There are deliberately no client policies. Only the service-role function below can
-- insert or inspect a billing event.
revoke all on table public.billing_events from public, anon, authenticated;

-- `event_type` is what the vendor called this delivery — RENEWAL, CANCELLATION,
-- EXPIRATION. The recorder does not carry it yet, because F246 calls this function with
-- the pair the dedupe actually needs and nothing else, so every row reads 'unknown'
-- until a later migration adds the three-argument overload. The column is here now
-- because adding it later is a table change on a table that will have rows in it, and
-- adding the overload later is not.
create or replace function public.record_billing_event(
  p_event_id text,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  recorded boolean := false;
begin
  if p_event_id is null or p_event_id !~ '^[a-zA-Z0-9:._-]{1,128}$' then
    raise exception 'invalid billing event id';
  end if;
  if p_user_id is null then
    raise exception 'a billing event must name an account';
  end if;

  insert into public.billing_events (event_id, user_id)
  values (p_event_id, p_user_id)
  on conflict (event_id) do nothing
  returning true into recorded;

  -- NULL-safe. A conflicting insert affects zero rows and leaves `recorded` NULL;
  -- `is not true` takes this branch on NULL exactly as it takes it on false. Never
  -- write this guard as `not recorded` — that is F73 and F74, and both moved money.
  if recorded is not true then
    -- No row, yet the insert was skipped: a concurrent transaction holds this event id
    -- and has not committed. Raise rather than answer, so the vendor redelivers and the
    -- event survives a rollback we cannot see from here.
    if not exists (select 1 from public.billing_events where event_id = p_event_id) then
      raise exception 'billing event is being recorded concurrently';
    end if;
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.record_billing_event(text, uuid) from public, anon, authenticated;
grant execute on function public.record_billing_event(text, uuid) to service_role;
