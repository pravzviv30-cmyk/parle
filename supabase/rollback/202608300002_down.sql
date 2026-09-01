-- Rollback for supabase/migrations/202608300002_paid_period_lapse.sql
--
-- REOPENS-F245. Read this before pasting.
--
-- 202608300002 changed exactly one object: the body of public.consume_entitlement(uuid,
-- integer, uuid). Rolling it back means restoring 202608250001's body, and that body
-- grants the free month. On a paid plan whose period has ended it clears the counter and
-- writes `now() + interval '30 days'` into period_end, on every debit and — because
-- store.get() is a zero-second debit — on every read. A learner who cancels keeps a full
-- allowance that renews itself forever, and our own entitlements row says starter with a
-- period ending next month because we put it there. The vendor says the subscription
-- ended; the database says it did not; the database is the one the paywall asks.
--
-- The cost is not a retry or a farmed trial. It is every cancelled subscriber, from the
-- moment they cancel, for as long as the row exists, at the full serving cost of a paid
-- plan against zero revenue.
--
-- There is almost never a reason to run this. 202608300002 adds no column, no table and
-- no row; it only stops the database granting paid time the billing system never sold.
-- If something looks broken after applying it, the fault is far more likely to be the
-- projection that should have written a real period_end, and the supported move is to
-- fix forward with a new migration.
--
-- Because the only honest rollback here is a dangerous one, the script refuses to run
-- until the operator says so in the same paste. That is the interlock, not a formality:
--
--     set local luvani.reopen_f245 = 'yes-i-accept-renewing-cancelled-subscriptions';
--
-- Idempotent and retryable. It replaces one function body and touches no rows.

do $$
begin
  if coalesce(current_setting('luvani.reopen_f245', true), '') <> 'yes-i-accept-renewing-cancelled-subscriptions' then
    raise exception
      'refusing to restore the self-renewing paid period (F245): set luvani.reopen_f245 in this session first';
  end if;
end;
$$;

-- The 202608250001 definition, restored verbatim. The defect is the pair of arms that
-- clear seconds_used and add thirty days once period_end has passed, kept exactly as they
-- were so that this file is a true rollback and not a third variant of the function.
create or replace function public.consume_entitlement(
  p_user_id uuid,
  p_seconds integer,
  p_session_id uuid
)
returns public.entitlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.entitlements;
  recorded boolean := false;
  recorded_user uuid;
begin
  if p_seconds is null or p_seconds < 0 or p_seconds > 900 then
    raise exception 'seconds must be between 0 and 900';
  end if;

  select * into result
  from public.entitlements
  where user_id = p_user_id;
  if not found then raise exception 'entitlement has not been provisioned'; end if;

  if p_session_id is not null then
    insert into public.session_usage (session_id, user_id, seconds)
    values (p_session_id, p_user_id, p_seconds)
    on conflict (session_id) do nothing
    returning true into recorded;

    -- NULL-safe. A conflicting insert affects zero rows and leaves `recorded` NULL;
    -- `is not true` takes this branch on NULL exactly as it takes it on false.
    if recorded is not true then
      select user_id into recorded_user
      from public.session_usage
      where session_id = p_session_id;

      -- No row, yet the insert was skipped: a concurrent transaction holds this
      -- session id and has not committed. We cannot tell whose it is, so refuse
      -- rather than bill. The caller retries and reads the committed row.
      if not found then
        raise exception 'session id is being reported concurrently';
      end if;

      if recorded_user is distinct from p_user_id then
        raise exception 'session id already belongs to another account';
      end if;

      select * into result
      from public.entitlements
      where user_id = p_user_id;
      return result;
    end if;
  end if;

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

revoke all on function public.consume_entitlement(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.consume_entitlement(uuid, integer, uuid) to service_role;
