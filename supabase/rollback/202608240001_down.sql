-- Rollback for supabase/migrations/202608240001_claim_trial_null_fix.sql
--
-- REOPENS-F73. Read this before pasting.
--
-- 202608240001 changed exactly one object: the body of public.claim_trial(uuid, text,
-- text). Rolling it back means restoring 202608230001's body, and that body is the P0:
-- the NULL-unsafe `if not claimed` guard falls through on a conflicting insert and
-- grants a fresh trial to a device or an account that has already used one. Unbounded
-- vendor spend on the money path, roughly $2.20 per farmed trial at the repo's own cost
-- model.
--
-- There is almost never a reason to run this. 202608240001 adds no column, no table and
-- no row; it only stops the function saying yes when it means no. If something looks
-- broken after applying it, the fault is far more likely to be a caller than the guard,
-- and the supported move is to fix forward with a new migration.
--
-- Because the only honest rollback here is a dangerous one, the script refuses to run
-- until the operator says so in the same paste. That is the interlock, not a formality:
--
--     set local parle.reopen_f73 = 'yes-i-accept-unbounded-trial-farming';
--
-- Idempotent and retryable. It replaces one function body and touches no rows.

do $$
begin
  if coalesce(current_setting('parle.reopen_f73', true), '') <> 'yes-i-accept-unbounded-trial-farming' then
    raise exception
      'refusing to restore the NULL-unsafe claim_trial guard (F73): set parle.reopen_f73 in this session first';
  end if;
end;
$$;

-- The 202608230001 definition, restored verbatim. The defect is the `if not claimed`
-- line, kept exactly as it was so that this file is a true rollback and not a third
-- variant of the function.
create or replace function public.claim_trial(
  p_user_id uuid,
  p_installation_hash text,
  p_user_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean := false;
begin
  if p_installation_hash is null or p_installation_hash !~ '^[a-zA-Z0-9_-]{43}$'
    or p_user_hash is null or p_user_hash !~ '^[a-zA-Z0-9_-]{43}$' then
    raise exception 'invalid trial claim';
  end if;

  if exists (select 1 from public.entitlements where user_id = p_user_id) then
    return true;
  end if;

  insert into public.trial_installations (installation_hash, first_user_hash)
  values (p_installation_hash, p_user_hash)
  on conflict do nothing
  returning true into claimed;

  if not claimed then return false; end if;

  insert into public.entitlements (user_id, plan, seconds_used)
  values (p_user_id, 'trial', 0);
  return true;
end;
$$;

revoke all on function public.claim_trial(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_trial(uuid, text, text) to service_role;
