-- Rollback for supabase/migrations/202608230001_session_usage_idempotency.sql
--
-- DESTRUCTIVE in two specific ways, both worth reading before pasting:
--
--   1. session_usage is the exactly-once billing ledger. Dropping it means a retried
--      /session/end after the rollback debits a second time, because nothing remembers
--      the first report. Back it up (supabase/README.md § Backup) even if you intend to
--      throw the schema away.
--   2. trial_installations is pseudonymous antifraud evidence that deliberately outlives
--      accounts. Dropping it hands every device a fresh trial. At the repo's own cost
--      model that is roughly $2.20 of vendor spend per farmed trial, so treat it as a
--      spend decision and not a schema decision.
--
-- Run 202608240001_down.sql first if that migration has been applied.
--
-- Idempotent and retryable: every drop is `if exists`, and the restore at the end is a
-- `create or replace`.
--
-- Order is the reverse of creation, and each object 202608230001 created is named.

-- the product-event validation trigger and its function
drop trigger if exists product_events_validate on public.product_events;
drop function if exists public.validate_product_event();

-- the session-aware debit created by this migration
drop function if exists public.consume_entitlement(uuid, integer, uuid);

-- the trial boundary: function, then its table
drop function if exists public.claim_trial(uuid, text, text);
drop table if exists public.trial_installations;

-- the billing ledger: index, then table
drop index if exists public.session_usage_user_time_idx;
drop table if exists public.session_usage;

-- Restore what this migration dropped. 202608230001 removed the two-argument debit at
-- its line 19, so rolling it back has to put that version back or the server loses its
-- only debit path. This body is 202608220001's verbatim, minus the session ledger the
-- rollback has just removed.
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
      case plan when 'trial' then 1800 when 'starter' then 10800 when 'regular' then 18000 else 0 end,
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
