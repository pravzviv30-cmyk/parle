-- F245 — an expired paid period lapsed into a free month instead of lapsing.
--
-- 202608250001 wrote the lazy period roll like this (its lines 106-117):
--
--     seconds_used = least(
--       case plan when 'trial' then 1800 ... end,
--       case
--         when period_end is not null and period_end <= now() then p_seconds
--         else seconds_used + p_seconds
--       end
--     ),
--     period_end = case
--       when plan = 'trial' then null
--       when period_end is null or period_end <= now() then now() + interval '30 days'
--       else period_end
--     end,
--
-- Read those two arms together on a paid plan whose period has ended: the counter is
-- cleared and thirty fresh days are granted. Every debit. And since store.get() is a
-- zero-second debit, every read as well. A learner who cancels keeps a full paid
-- allowance that renews itself forever, and the entitlements row says starter with a
-- period ending next month, because our own database wrote it there. That is not a
-- billing bug we would find in a vendor dashboard — it is paid status forged by us,
-- against our own record.
--
-- It is harmless today and only today. Nothing sells, so no period has ever ended on a
-- paid plan. It becomes real with the first cancellation after the first sale, which is
-- why it is being fixed in the same phase that builds the paywall rather than after it.
--
-- The rule this file writes instead: the database never grants paid time. Only the
-- billing system does, through the webhook that lands on save(). A paid period that
-- ended more than 24 hours ago has lapsed, and the row collapses to the state a finished
-- learner is already in — plan trial, the trial allowance spent, no period:
--
--     period_end < now() - interval '24 hours'
--
-- Twenty-four hours of slack, and not zero, because the fix has to survive the ordinary
-- lateness of the real world: a webhook retried through an outage, a queue drained late,
-- a clock a few minutes out between our database and a vendor's. Inside that window the
-- row is left exactly as it is — not renewed, not lapsed, still counting against the
-- allowance it already had. A grace period sold by the store needs no separate handling
-- here: RevenueCat's reported expiration already includes it, so grace rides through
-- period_end and arrives as a later date.
--
-- Nothing is invented for a paid row with no period_end either. The old body opened a
-- thirty day period for one, which is the same forgery in a different shape. There is no
-- evidence of a paid period on such a row, so there is no lapse to apply and no period
-- to grant: it keeps counting until the billing system writes a real one. Revoking a
-- paying learner because we cannot read our own row would be the worse error of the two.
--
-- Two things this file deliberately does not change. F74's idempotency guard and its
-- ownership refusal are copied through unchanged, because replacing a function body
-- replaces all of it and a fix that quietly dropped `recorded is not true` would reopen
-- double billing on a retry. And the allowance table stays a literal `case plan when`,
-- the fourth copy of it in this schema; databaseContract.test.ts reads every copy in
-- every migration and rollback against PLANS in @luvani/core, so a fourth cannot drift.
--
-- Forward-only. 202608250001 keeps its defect on the record and this file is the
-- correction. It replaces one function body, reads and writes no rows, holds no long
-- lock, and is safe to run repeatedly. The name, argument names, argument types and
-- return type are identical, so the OID and the ACL are preserved and PostgREST keeps
-- resolving the same three-argument overload.
--
-- Rolling this back reopens F245. See supabase/rollback/202608300002_down.sql.

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
        case plan when 'trial' then 1800 when 'starter' then 10800 when 'regular' then 27000 else 0 end,
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
