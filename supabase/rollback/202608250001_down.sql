-- Rollback for supabase/migrations/202608250001_consume_entitlement_null_fix.sql
--
-- REOPENS-F74. Read this before pasting.
--
-- 202608250001 changed exactly one object: the body of public.consume_entitlement(uuid,
-- integer, uuid). Rolling it back means restoring 202608230001's body, and that body is
-- the P0: the NULL-unsafe `if not recorded` guard falls through on a conflicting insert,
-- so a retried /session/end debits the learner a second time and a session id owned by
-- another account is merged into the caller's balance instead of being refused.
--
-- The cost lands on the learner, not on the vendor. The tutor agent retries its end
-- report up to three times on a timeout or a 5xx, so a single 900-second trial session
-- can consume the whole 1800-second trial allowance and strand a learner behind the
-- paywall after one conversation. session_usage keeps one row while the balance moves
-- twice, so nothing in the stack reconciles the disagreement afterwards.
--
-- There is almost never a reason to run this. 202608250001 adds no column, no table and
-- no row; it only stops the function billing twice for one session. If something looks
-- broken after applying it, the fault is far more likely to be a caller than the guard,
-- and the supported move is to fix forward with a new migration.
--
-- Because the only honest rollback here is a dangerous one, the script refuses to run
-- until the operator says so in the same paste. That is the interlock, not a formality:
--
--     set local parle.reopen_f74 = 'yes-i-accept-double-billing-on-retry';
--
-- Idempotent and retryable. It replaces one function body and touches no rows.

do $$
begin
  if coalesce(current_setting('parle.reopen_f74', true), '') <> 'yes-i-accept-double-billing-on-retry' then
    raise exception
      'refusing to restore the NULL-unsafe consume_entitlement guard (F74): set parle.reopen_f74 in this session first';
  end if;
end;
$$;

-- The 202608230001 definition, restored verbatim. The defect is the `if not recorded`
-- line, kept exactly as it was so that this file is a true rollback and not a third
-- variant of the function.
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

    if not recorded then
      select user_id into recorded_user
      from public.session_usage
      where session_id = p_session_id;

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
