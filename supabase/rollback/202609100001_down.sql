-- Rollback for supabase/migrations/202609100001_max_allowance_three_hundred.sql
--
-- Restores 202608300002_paid_period_lapse.sql's definition of
-- public.consume_entitlement(uuid, integer, uuid). That is the only shape of rollback a
-- `create or replace` can have: drop the function, or put the previous body back. Dropping
-- it would take the debit offline and every session would stop being billed, so it is the
-- previous body.
--
-- READ THIS BEFORE EXPECTING IT TO CHANGE ANYTHING.
--
-- 202609100001 changed one number: Max went from 450 minutes to 300. It did not change the
-- function's shape, so the body below is byte-identical to the one that migration installs,
-- and pasting this today is a no-op. That is not a mistake in the file. It is what a
-- rollback of this migration honestly is.
--
-- The reason is that the number is not owned by SQL. PLANS.regular.secondsPerPeriod in
-- packages/core/src/metering/meter.ts owns it, and every allowance table under supabase/ is
-- a copy that databaseContract.test.ts holds equal to core. This file is one of those
-- copies. So it does not carry 27000 and must never be hand-edited to: a database serving
-- 450 minutes while the app and the token server both believe 300 would keep starting
-- sessions after the balance the server reports has run out, and the refusal that raises the
-- subscription wall would never fire.
--
-- What that means in practice is better than it sounds. Revert the allowance the proper way
-- and this file reverts with it:
--
--   1. Put PLANS.regular.secondsPerPeriod and priceUsd back in meter.ts, with the pins in
--      meter.test.ts. Note 450 minutes at $29 does not clear the twenty percent worst-case
--      margin floor, so reverting the minutes means reverting the price too.
--   2. Rewrite every allowance table under supabase/migrations and supabase/rollback,
--      including the one below. `npm test --workspace=@luvani/token-server` names each file
--      still holding the old number, one at a time, until none are left.
--   3. Ship a NEW forward migration replacing consume_entitlement, the way 202609100001 did.
--      A database that already ran 202609100001 is not changed by editing files.
--
-- After step 2 this file carries the restored cap and pasting it does exactly what its name
-- says. Before step 2 it is deliberately inert.
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
