-- F84 — learner_state gains the ordering primitive that conflict detection needs.
--
-- 202608220001 gave the table (user_id, namespace, payload, updated_at). That is enough
-- to store a learner's state and not enough to reconcile two devices holding different
-- versions of it: there is no value a client can compare against, so every write is a
-- blind overwrite and the phone that saves last wins whatever the other phone did.
--
-- One column fixes that. `revision` starts at 0 for every row, existing or new, and the
-- client's update is a compare-and-swap:
--
--     PATCH /rest/v1/learner_state
--        ?user_id=eq.<uid>&namespace=eq.<ns>&revision=eq.<n>
--     Prefer: return=representation
--     { "payload": <envelope>, "revision": <n+1> }
--
-- A current `n` matches exactly one row and comes back with revision n+1. A stale `n`
-- matches nothing, PostgREST returns an empty representation, and the client knows —
-- without a lock, a transaction or a round trip it would not otherwise make — that
-- somebody else wrote first. It then pulls, merges and retries.
--
-- The increment is the database's, not the client's. `revision` is the one ordering
-- truth in this system, so a client that forgets to advance it, advances it twice, or
-- sends it backwards must not be able to make the column lie. The BEFORE UPDATE trigger
-- below overwrites whatever arrived with old.revision + 1, which makes the column
-- monotonic by construction rather than by client convention. The filter is still the
-- concurrency control; the trigger only guarantees what the filter is comparing against.
--
-- It also stamps updated_at, which until now defaulted on insert and then never moved
-- again, because PostgREST sends only the columns a client names. Every existing row's
-- updated_at was the moment it was created.
--
-- Row level security is deliberately untouched. The four own-row policies from
-- 202608220001 are the enforcement, they are proved live against two real accounts by
-- services/token-server/src/verify/supabaseLive.ts, and a migration that rewrote them
-- while adding a column would put the one measured security property in this schema back
-- in question for no reason. The trigger is SECURITY INVOKER (the default) so it runs as
-- the learner and cannot be used to reach a row RLS would not have let them reach.
--
-- Forward-compatible: a client that has never heard of `revision` keeps working, because
-- the column has a default and the trigger fills it in. Bounded: one column with a
-- constant default, which PostgreSQL 11 and later add without rewriting the table, plus
-- one function and one trigger. Retryable and idempotent: `add column if not exists`,
-- `create or replace function`, and `create or replace trigger`, which replaces in place
-- rather than dropping and recreating — there is no instant at which the table has the
-- column and not the trigger that maintains it.
--
-- One thing an operator should expect, and one earlier note now withdrawn. A read-only
-- probe of the disposable project named in services/token-server/.env on 2026-08-26 found
-- `learner_state.revision` already there as bigint default 0, and this comment used to
-- read that as drift. It was not drift: this file had been
-- pasted into that project from this repo on 2026-08-26, an hour or so before the probe
-- ran. The history is intact. That same run then held the trigger to its behaviour rather
-- than its shape — a compare-and-swap on the current revision updated exactly 1 row, with
-- the trigger overriding a deliberately bogus client `revision: 999`; the same write
-- replayed at the now-stale revision updated 0 rows; and `updated_at` moved, which it
-- never did before this migration. docs/IMPLEMENTATION_EVIDENCE.md carries that record.
-- So finding the column already there is the expected result of running this twice, not a
-- reason to distrust the history: `add column if not exists` makes the column a no-op and
-- `create or replace` reinstalls the function and the trigger, which is the half that can
-- go missing. Paste it anyway; there is nothing here to lose.
--
-- Rollback: supabase/rollback/202608260001_down.sql.

alter table public.learner_state
  add column if not exists revision bigint not null default 0;

create or replace function public.learner_state_bump_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Whatever the client sent, the next revision is the stored one plus one. The
  -- WHERE filter the client used is what decided it was allowed to get here.
  new.revision := old.revision + 1;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

-- No client ever calls this by name; it exists only for the trigger to fire.
revoke all on function public.learner_state_bump_revision() from public, anon, authenticated;

create or replace trigger learner_state_revision_bump
before update on public.learner_state
for each row
execute function public.learner_state_bump_revision();
