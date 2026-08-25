-- F73 — claim_trial granted the trial it was meant to refuse.
--
-- 202608230001 wrote the refusal like this:
--
--     declare claimed boolean := false;
--     insert into public.trial_installations (installation_hash, first_user_hash)
--     values (p_installation_hash, p_user_hash)
--     on conflict do nothing
--     returning true into claimed;
--     if not claimed then return false; end if;
--
-- `insert ... returning ... into` assigns NULL when the statement affects zero rows,
-- overwriting the `:= false` initialiser. In SQL's three-valued logic `not NULL` is
-- NULL, an `if` on NULL takes neither branch, so control fell straight through to the
-- entitlement insert and returned true. Both arms of the boundary were dead:
-- installation_hash is the primary key, first_user_hash is not-null unique, so a second
-- account on one device and one account across devices were both granted a fresh trial.
--
-- The fix is the guard, not the insert. `claimed is not true` refuses on NULL and on
-- false alike, and still lets a genuine first claim through on true.
--
-- Forward-only. Migration history is never rewritten, so 202608230001 keeps its defect
-- on the record and this file is the correction. It replaces one function body, reads
-- and writes no rows, and is safe to run repeatedly: `create or replace function` is
-- idempotent, bounded (one catalogue entry) and retryable after any failure. Applying
-- it to a database that never had 202608230001 is a no-op error rather than damage,
-- because the dependencies it names — trial_installations and entitlements — are only
-- resolved when the function runs.
--
-- Rolling this back reopens F73. See supabase/rollback/202608240001_down.sql.

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

  -- NULL-safe. A conflicting insert affects zero rows and leaves `claimed` NULL;
  -- `is not true` refuses on NULL exactly as it refuses on false. Never write this
  -- guard with a bare `not claimed`, which is the defect it exists to close.
  if claimed is not true then return false; end if;

  insert into public.entitlements (user_id, plan, seconds_used)
  values (p_user_id, 'trial', 0);
  return true;
end;
$$;

revoke all on function public.claim_trial(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_trial(uuid, text, text) to service_role;
