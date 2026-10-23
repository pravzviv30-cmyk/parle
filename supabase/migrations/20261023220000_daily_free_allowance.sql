-- REV-001 (founder decision, 2026-10-23; DECISIONS.md): the free allowance
-- grows and refills sooner, and both paid allowances grow.
--
-- Mirrors packages/core/src/metering/meter.ts exactly: PLANS is trial 600,
-- starter 18000, regular 36000, and TASTE_REFILL_HOURS is 44.
--
-- What moves:
-- * tutor_cap_v1: trial 300 -> 600 seconds (ten free minutes), starter (shown
--   as "Core") 10800 -> 18000 (300 minutes), regular (shown as "Max")
--   18000 -> 36000 (600 minutes). Every cap reader (reserve, finish, consume,
--   refund, apply_billing_projection_v2's grant ceiling) follows it.
-- * taste_window_v1: the first debit of a free window sets the refill to
--   now() plus 44 hours (was seven days). Same trigger, same epoch rule.
-- * begin_billing_refresh: the unclaimed row it creates is spent at the cap,
--   luvani_private.tutor_cap_v1('trial'), instead of the literal 300, which
--   against a 600 cap would hand an unclaimed row 300 real seconds.
-- * apply_billing_projection (six arguments): its same-period clamp reads
--   tutor_cap_v1(p_plan) instead of the inline 10800/18000. Otherwise verbatim
--   from 20261020140000.
--
-- Why: REV-001. Ten free minutes about every two days lets a learner build a
-- habit before paying; the paid tiers grow so they stay a clear step up.
--
-- No paid row exists in any hosted project (pre-launch), so there is no
-- grandfather clause: a paid row simply reads the new cap.
--
-- Backfill (pre-launch):
-- * an unclaimed spent row (trial, not weekly_taste) is raised to the new cap,
--   so it stays spent;
-- * a running free window longer than 44 hours is cut to now() plus 44 hours.
--   advance_usage_epoch would mint a new usage epoch for this period_end
--   change and honours no session setting for trial rows. A new epoch would
--   stop a session granted in the window from being refunded into it, so the
--   backfill runs with entitlement_usage_epoch disabled inside this
--   transaction and every row keeps its epoch and its seconds_used. The
--   disable takes SHARE ROW EXCLUSIVE and blocks writers until commit (see
--   "Write block" below).
--
-- Idempotent: create or replace throughout, and both updates are no-ops on a
-- second run. Requires 40 (20261020140000) and 41 (20261022120000); it does
-- not depend on 42 (20261022200000, held).
--
-- Rollout order (a D24 token server refuses 600/18000 answers from SQL, and
-- 40's apply_billing_projection_v2 refuses a REV-001 server's grants, so the
-- two halves must never run mixed while admission is open):
--   1. Check admission is off: `select enabled from public.tutor_session_admission_config`
--      returns false. Keep it false throughout.
--   2. Apply 40, 41 and 43 in one sitting (never 42).
--   3. Deploy the REV-001 token server, then the app.
--   4. Acceptance: one reserve on a fresh free row returns reservedSeconds 600,
--      and /billing/status for that row shows an allowance of 600.
--   5. Only then enable admission.
-- Write block: disabling entitlement_usage_epoch takes SHARE ROW EXCLUSIVE on
-- public.entitlements and blocks every writer until commit. Before applying, run
--   select count(*) from public.entitlements where plan='trial' and weekly_taste
--     and period_end > now()+interval '44 hours';
-- If it is non-zero, 40 has been live: announce a brief write block first.
-- Prepared and proved in disposable SQL (scripts/verifyTutorSessions.mjs);
-- not applied live.
begin;

create or replace function luvani_private.tutor_cap_v1(p_plan text) returns integer
language sql immutable set search_path='' as $$
  select case p_plan when 'trial' then 600 when 'starter' then 18000 when 'regular' then 36000 else 0 end
$$;
revoke all on function luvani_private.tutor_cap_v1(text) from public,anon,authenticated,service_role;

create or replace function luvani_private.taste_window_v1() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.plan='trial' and old.plan='trial' and new.weekly_taste and old.weekly_taste
    and new.period_end is null and old.period_end is null and new.seconds_used>old.seconds_used then
    new.period_end:=pg_catalog.clock_timestamp()+interval '44 hours';
  end if;
  return new;
end $$;
revoke all on function luvani_private.taste_window_v1() from public,anon,authenticated,service_role;
drop trigger if exists entitlement_taste_window on public.entitlements;
create trigger entitlement_taste_window before update on public.entitlements
  for each row execute function luvani_private.taste_window_v1();

create or replace function public.begin_billing_refresh(p_user_id uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare ticket bigint;
begin
  if p_user_id is null then raise exception 'a billing refresh needs an account'; end if;
  -- Purchase may precede the first room. Never manufacture a free taste here:
  -- no device claim stands behind this row, so it is a spent taste that never
  -- refills (weekly_taste false). Only a verified subscription, or a lapse
  -- from one, turns it into time.
  insert into public.entitlements(user_id, plan, seconds_used, weekly_taste)
    values(p_user_id, 'trial', luvani_private.tutor_cap_v1('trial'), false) on conflict(user_id) do nothing;
  update public.entitlements set billing_sequence = billing_sequence + 1
    where user_id = p_user_id returning billing_sequence into ticket;
  return ticket;
end;
$$;

create or replace function public.apply_billing_projection(
  p_user_id uuid, p_ticket bigint, p_kind text, p_plan text,
  p_period_end timestamptz, p_event_id text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_row public.entitlements;
  event_done timestamptz;
  projection_kind text := 'unchanged';
  projection_reason text;
  normalized_end timestamptz;
begin
  if p_user_id is null or p_ticket is null or p_ticket < 1 then raise exception 'invalid billing ticket'; end if;
  if p_kind is null or p_kind not in ('active', 'inactive', 'unknown-product') then raise exception 'invalid billing state'; end if;
  if p_kind = 'active' and (p_plan is null or p_plan not in ('starter', 'regular') or p_period_end is null or not isfinite(p_period_end)) then
    raise exception 'invalid active billing state';
  end if;
  if p_event_id is not null then
    if p_event_id !~ '^[a-zA-Z0-9:._-]{1,128}$' then raise exception 'invalid billing event id'; end if;
    insert into public.billing_events(event_id, user_id) values(p_event_id, p_user_id)
      on conflict(event_id) do nothing;
    select processed_at into event_done from public.billing_events where event_id = p_event_id for update;
    if not found then raise exception 'billing event not visible'; end if;
  end if;
  select * into current_row from public.entitlements where user_id = p_user_id for update;
  if not found or p_ticket > current_row.billing_sequence then raise exception 'unissued billing ticket'; end if;
  if event_done is not null or p_ticket <= current_row.billing_applied_sequence then
    projection_reason := 'superseded';
  elsif p_kind = 'unknown-product' then
    projection_reason := 'unknown-product';
  elsif p_kind = 'active' and p_period_end > now() then
    normalized_end := date_trunc('second', p_period_end);
    if current_row.plan in ('starter', 'regular') and normalized_end < date_trunc('second', current_row.period_end) then
      projection_reason := 'superseded';
    else
    update public.entitlements set
      plan = p_plan,
      seconds_used = case
        when period_end is null or normalized_end > date_trunc('second', period_end) then 0
        else least(seconds_used, luvani_private.tutor_cap_v1(p_plan))
      end,
      period_end = normalized_end, lapsed_from_paid = false, updated_at = now()
      where user_id = p_user_id returning * into current_row;
    projection_kind := 'active';
    end if;
  elsif current_row.plan in ('starter', 'regular') then
    update public.entitlements set plan = 'trial', seconds_used = 0,
      period_end = null, weekly_taste = true, lapsed_from_paid = true, updated_at = now()
      where user_id = p_user_id returning * into current_row;
    projection_kind := 'lapsed';
  else
    projection_reason := 'not-paid';
  end if;
  if event_done is null then
    update public.entitlements set billing_applied_sequence = greatest(billing_applied_sequence, p_ticket)
      where user_id = p_user_id returning * into current_row;
  end if;
  if p_event_id is not null then
    update public.billing_events set processed_at = coalesce(processed_at, now()) where event_id = p_event_id;
  end if;
  return jsonb_build_object('kind', projection_kind, 'reason', projection_reason, 'entitlement', to_jsonb(current_row));
end;
$$;

-- Pre-launch backfill (see the header).
update public.entitlements set seconds_used=luvani_private.tutor_cap_v1('trial')
  where plan='trial' and not weekly_taste and seconds_used<luvani_private.tutor_cap_v1('trial');
alter table public.entitlements disable trigger entitlement_usage_epoch;
update public.entitlements set period_end=pg_catalog.clock_timestamp()+interval '44 hours'
  where plan='trial' and weekly_taste and period_end>pg_catalog.clock_timestamp()+interval '44 hours';
alter table public.entitlements enable trigger entitlement_usage_epoch;

revoke all on function public.begin_billing_refresh(uuid),
  public.apply_billing_projection(uuid, bigint, text, text, timestamptz, text)
  from public,anon,authenticated;
grant execute on function public.begin_billing_refresh(uuid),
  public.apply_billing_projection(uuid, bigint, text, text, timestamptz, text)
  to service_role;

commit;
notify pgrst, 'reload schema';
