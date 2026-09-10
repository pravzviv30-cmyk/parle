-- Max is 300 minutes a month, not 450.
--
-- The second paid tier was priced at 450 minutes for $39. It is now 300 minutes
-- for $29. The allowance lives in two places that must agree: PLANS.regular in
-- packages/core/src/metering/meter.ts, and the allowance table inside this
-- function. databaseContract.test.ts holds every copy in supabase/ equal to
-- PLANS, so the migrations and rollbacks that define the debit were rewritten in
-- the same change. Rewriting a file does not touch a database that has already
-- run it, which is what this migration is for.
--
-- Why the minutes moved with the price: at $29 the old 450 minutes had a NEGATIVE
-- worst-case margin. Serving 450 minutes costs about $26.01 and $29 nets $24.65
-- after the small business store fee, so the heaviest Max subscriber was a loss.
-- 300 minutes costs about $17.34 and leaves 29.7%. The floor is asserted in
-- meter.test.ts and it is a strict inequality, so it breaks at 341 minutes.
--
-- Who this moves: nobody, today. `paidPlan` in
-- services/token-server/src/billing/revenuecat.ts is the only thing that writes a
-- paid plan onto an entitlement, and it is reachable only through
-- revenueCatConfiguration(), which is all-or-nothing over five environment
-- variables that are unset. No store product exists and no receipt has ever been
-- verified, so no row in public.entitlements has plan = 'regular'.
--
-- What it would do to a real subscriber, if that ever stops being true: least()
-- clamps on the next debit, so a learner already past 18000 seconds would land
-- exactly on their new cap and be out of minutes immediately. Repricing a tier
-- that has live subscribers is a migration with a grandfather clause in it. This
-- is not that migration.
--
-- Idempotent. It replaces one function body, creates nothing and writes no rows.

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

  -- The lapse condition is written out in all three assignments rather than computed
  -- once above, so the whole decision stays inside the single atomic UPDATE that makes
  -- concurrent debits safe. Every assignment reads the row as it was before the
  -- statement, which is why the allowance arm can still say `case plan` while the plan
  -- arm is turning that plan into a trial.
  update public.entitlements
  set
    plan = case
      when plan <> 'trial' and period_end is not null and period_end < now() - interval '24 hours' then 'trial'
      else plan
    end,
    seconds_used = case
      when plan <> 'trial' and period_end is not null and period_end < now() - interval '24 hours' then 1800
      else least(
        case plan when 'trial' then 1800 when 'starter' then 10800 when 'regular' then 18000 else 0 end,
        seconds_used + p_seconds
      )
    end,
    period_end = case
      when plan = 'trial' then null
      when period_end is not null and period_end < now() - interval '24 hours' then null
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
