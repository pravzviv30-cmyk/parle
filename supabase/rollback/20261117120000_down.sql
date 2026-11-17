-- Rollback for supabase/migrations/20261117120000_claim_promotes_unclaimed_row.sql
--
-- REOPENS-F933. Restores claim_trial and claim_trial_with_evidence exactly as
-- 20261020140000 left them: a device claim on an account whose purchase came
-- first returns early again, so that learner never gets a free conversation.
-- No data change: a row 47 already promoted stays a weekly taste. Safe to run
-- twice. It refuses unless the operator sets the interlock in the same session:
--
--     set luvani.reopen_f933 = 'yes';
begin;
do $$ begin
  if current_setting('luvani.reopen_f933', true) is distinct from 'yes' then
    raise exception 'refusing to restore the claim that leaves a purchase-first trial spent (F933) without explicit interlock';
  end if;
end $$;

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

  insert into public.entitlements (user_id, plan, seconds_used, weekly_taste)
  values (p_user_id, 'trial', 0, true);
  return true;
end;
$$;

create or replace function public.claim_trial_with_evidence(
  p_user_id uuid,
  p_installation_hash text,
  p_user_hash text,
  p_analytics_allowed boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean := false;
begin
  -- Serialize this service's same-account starts; unique markers still guard installations.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
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

  insert into public.entitlements (user_id, plan, seconds_used, weekly_taste)
  values (p_user_id, 'trial', 0, true);
  if p_analytics_allowed is true then
    -- The savepoint encloses evidence alone. A broken sink never undoes the trial.
    begin
      insert into public.product_events(user_id, name, properties)
      values (p_user_id, 'trial_started', '{}'::jsonb);
    exception when others then null;
    end;
  end if;
  return true;
end;
$$;

revoke all on function public.claim_trial(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_trial(uuid, text, text) to service_role;
revoke all on function public.claim_trial_with_evidence(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.claim_trial_with_evidence(uuid, text, text, boolean) to service_role;

commit;
notify pgrst, 'reload schema';
