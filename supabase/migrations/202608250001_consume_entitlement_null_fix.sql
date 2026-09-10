-- F74 — consume_entitlement billed a retried session a second time.
--
-- Same defect as F73, same shape, a different function. 202608230001 wrote the
-- idempotency guard like this (its lines 96-101):
--
--     declare recorded boolean := false;
--     insert into public.session_usage (session_id, user_id, seconds)
--     values (p_session_id, p_user_id, p_seconds)
--     on conflict (session_id) do nothing
--     returning true into recorded;
--     if not recorded then          <- the defect
--
-- `insert ... returning ... into` assigns NULL when the statement affects zero rows,
-- overwriting the `:= false` initialiser. In three-valued logic `not NULL` is NULL, a
-- plpgsql IF on NULL takes neither branch, and there is no else — so control fell
-- straight past `end if` to the debit UPDATE. Both arms of the boundary were dead:
--
--   * a replayed session id (the agent retries /session/end on a timeout or a 5xx)
--     was billed again, every time, while session_usage still held exactly one row;
--   * a session id owned by another account was merged into the caller's balance
--     instead of raising, because the ownership check was never reached.
--
-- Measured live before this fix, one session id reported three times: 0 -> 120 -> 240
-- -> 540 seconds used, with one row in session_usage. The ledger and the balance
-- disagreed and nothing reconciled them.
--
-- The fix is the guard, not the insert. `recorded is not true` refuses on NULL and on
-- false alike, and still lets a genuine first report through on true. Never write this
-- guard with a bare negation, which is the defect it exists to close.
--
-- One further honesty fix travels with it. Under READ COMMITTED, `on conflict do
-- nothing` skips a row that a concurrent transaction has inserted but not committed,
-- without blocking — so the follow-up select can find nothing at all. The old text
-- would have called that "session id already belongs to another account", which is a
-- security-shaped sentence for what is really the same learner's own concurrent retry.
-- It now raises its own message. Both paths fail closed: nothing is billed either way,
-- and the caller's next retry reads the committed row and no-ops correctly.
--
-- Forward-only. Migration history is never rewritten, so 202608230001 keeps its defect
-- on the record and this file is the correction. It replaces one function body, reads
-- and writes no rows, holds no long lock, and is safe to run repeatedly: `create or
-- replace function` is idempotent, bounded to one catalogue entry, and retryable after
-- any failure. The name, argument names, argument types and return type are identical
-- to 202608230001's, so the OID and the ACL are preserved and PostgREST keeps resolving
-- the same three-argument overload.
--
-- Rolling this back reopens F74. See supabase/rollback/202608250001_down.sql.

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

revoke all on function public.consume_entitlement(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.consume_entitlement(uuid, integer, uuid) to service_role;
