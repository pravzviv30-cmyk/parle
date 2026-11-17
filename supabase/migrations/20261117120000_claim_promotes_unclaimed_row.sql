-- F933 (founder Q1, 2026-11-17): a purchase made before the first conversation
-- no longer costs the learner their free conversation.
--
-- begin_billing_refresh creates an unclaimed row (plan 'trial', weekly_taste
-- false, spent at tutor_cap_v1('trial')) when a purchase precedes the first
-- room. That row is deliberate (D24): no device claim stands behind it, so it
-- never refills. The defect was that a later device claim returned early on any
-- existing row and never looked at the device, so the row stayed spent forever.
--
-- claim_trial and claim_trial_with_evidence change together. Each body is the
-- 20261020140000 body with only:
--   * the early return reads the row under lock into `unclaimed` (null: no row;
--     false: any other row, which returns true as before; true: unclaimed row);
--   * an unclaimed row on a device that already had a free conversation stays
--     spent and still returns true, so no learner sees a new refusal;
--   * an unclaimed row on a newly recorded device becomes a fresh weekly taste:
--     weekly_taste true, seconds_used 0, period_end null. Otherwise the original
--     insert runs.
--
-- No live reservation can exist on an unclaimed row, so resetting seconds_used
-- cannot hand a running session free seconds: the row is created spent at the
-- cap with a fresh usage epoch; reserve_tutor_session_v1, the only writer of a
-- live grant, refuses under 120 seconds available; consume_entitlement clamps
-- at the cap, so nothing is ever charged and no refund can lower seconds_used;
-- refill_taste_v1 needs weekly_taste; and every lapse arm sets weekly_taste.
-- The promotion leaves period_end null and the plan trial, so the usage-epoch
-- trigger keeps the epoch, and taste_window_v1 does not fire (old weekly_taste
-- is false).
--
-- Create-or-replace only, no data change, idempotent. Requires 20261020140000.
-- Applying or reapplying 40 (20261020140000) afterwards restores the early
-- return with no error: re-apply 47 after it. Apply as a single file, never
-- `supabase db push` while 42 is held. Prepared and proved in disposable SQL
-- (services/token-server/src/databaseContract.test.ts); not applied live.
begin;

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
  unclaimed boolean;
begin
  if p_installation_hash is null or p_installation_hash !~ '^[a-zA-Z0-9_-]{43}$'
    or p_user_hash is null or p_user_hash !~ '^[a-zA-Z0-9_-]{43}$' then
    raise exception 'invalid trial claim';
  end if;

  select plan = 'trial' and not weekly_taste into unclaimed
    from public.entitlements where user_id = p_user_id for update;
  if unclaimed is false then
    return true;
  end if;

  insert into public.trial_installations (installation_hash, first_user_hash)
  values (p_installation_hash, p_user_hash)
  on conflict do nothing
  returning true into claimed;

  -- NULL-safe. A conflicting insert affects zero rows and leaves `claimed` NULL;
  -- `is not true` refuses on NULL exactly as it refuses on false. Never write this
  -- guard with a bare `not claimed`, which is the defect it exists to close.
  if claimed is not true and unclaimed then return true; end if;
  if claimed is not true then return false; end if;

  if unclaimed then
    update public.entitlements set weekly_taste = true, seconds_used = 0, period_end = null,
      updated_at = pg_catalog.clock_timestamp() where user_id = p_user_id;
  else
    insert into public.entitlements (user_id, plan, seconds_used, weekly_taste)
    values (p_user_id, 'trial', 0, true);
  end if;
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
  unclaimed boolean;
begin
  -- Serialize this service's same-account starts; unique markers still guard installations.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  if p_installation_hash is null or p_installation_hash !~ '^[a-zA-Z0-9_-]{43}$'
    or p_user_hash is null or p_user_hash !~ '^[a-zA-Z0-9_-]{43}$' then
    raise exception 'invalid trial claim';
  end if;

  select plan = 'trial' and not weekly_taste into unclaimed
    from public.entitlements where user_id = p_user_id for update;
  if unclaimed is false then
    return true;
  end if;

  insert into public.trial_installations (installation_hash, first_user_hash)
  values (p_installation_hash, p_user_hash)
  on conflict do nothing
  returning true into claimed;

  -- NULL-safe. A conflicting insert affects zero rows and leaves `claimed` NULL;
  -- `is not true` refuses on NULL exactly as it refuses on false. Never write this
  -- guard with a bare `not claimed`, which is the defect it exists to close.
  if claimed is not true and unclaimed then return true; end if;
  if claimed is not true then return false; end if;

  if unclaimed then
    update public.entitlements set weekly_taste = true, seconds_used = 0, period_end = null,
      updated_at = pg_catalog.clock_timestamp() where user_id = p_user_id;
  else
    insert into public.entitlements (user_id, plan, seconds_used, weekly_taste)
    values (p_user_id, 'trial', 0, true);
  end if;
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
