-- F733, founder decision D16 (2026-10-05): a store free trial grants a week of
-- the plan's allowance, and a yearly product refills the monthly allowance
-- window by window inside its paid year.
--
-- The token server reads the vendor, computes the grant with core's metering
-- (storeTrialSeconds, allowanceWindowEnd) and passes it here, with the end of
-- the window being granted as the period end. This projection records the part
-- of the allowance a window does not grant as already spent, so every debit,
-- reservation, refund and lapse function that reads
-- tutor_cap_v1(plan) - seconds_used enforces the trial cap unchanged, and no
-- second allowance column exists to disagree with the first.
--
-- A monthly product grants its whole allowance (p_grant_seconds equal to the
-- cap), which is exactly what apply_billing_projection did. That six-argument
-- function stays in place so a server not yet redeployed keeps working.
-- billing_projection_version() moves to 2: a redeployed server reports
-- purchases ready only against a database that has this function, and a
-- server not yet redeployed reports them not ready until it is.
--
-- Deploy order: this migration, then the token server API and maintenance
-- worker, and only then an introductory offer or a yearly product in App Store
-- Connect. An intro offer configured first is granted the full month by the
-- old projection.

create or replace function public.billing_projection_version()
returns integer language sql security definer set search_path = '' as $$ select 2 $$;

create or replace function public.apply_billing_projection_v2(
  p_user_id uuid, p_ticket bigint, p_kind text, p_plan text,
  p_period_end timestamptz, p_event_id text, p_grant_seconds integer
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_row public.entitlements;
  event_done timestamptz;
  projection_kind text := 'unchanged';
  projection_reason text;
  normalized_end timestamptz;
  allowance integer;
  withheld integer;
begin
  if p_user_id is null or p_ticket is null or p_ticket < 1 then raise exception 'invalid billing ticket'; end if;
  if p_kind is null or p_kind not in ('active', 'inactive', 'unknown-product') then raise exception 'invalid billing state'; end if;
  if p_kind = 'active' and (p_plan is null or p_plan not in ('starter', 'regular') or p_period_end is null or not isfinite(p_period_end)) then
    raise exception 'invalid active billing state';
  end if;
  if p_kind = 'active' then
    allowance := luvani_private.tutor_cap_v1(p_plan);
    -- A grant is whole seconds inside the plan's allowance. Anything else is a
    -- caller fault, refused rather than rounded into minutes nobody paid for.
    if p_grant_seconds is null or p_grant_seconds < 1 or p_grant_seconds > allowance then
      raise exception 'invalid active billing allowance';
    end if;
    withheld := allowance - p_grant_seconds;
  elsif p_grant_seconds is not null then
    raise exception 'only an active billing state grants an allowance';
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
    -- A new period or window starts from what it grants. The same window keeps
    -- what was spent in it, never less than it withheld and never more than the cap.
    update public.entitlements set
      plan = p_plan,
      seconds_used = case
        when period_end is null or normalized_end > date_trunc('second', period_end) then withheld
        else least(greatest(seconds_used, withheld), allowance)
      end,
      period_end = normalized_end, lapsed_from_paid = false, updated_at = now()
      where user_id = p_user_id returning * into current_row;
    projection_kind := 'active';
    end if;
  elsif current_row.plan in ('starter', 'regular') then
    update public.entitlements set plan = 'trial', seconds_used = 1800,
      period_end = null, lapsed_from_paid = true, updated_at = now()
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

-- The paid rows whose period on record has ended, most recently ended first,
-- for the maintenance worker's renewal sweep. A yearly product's period on
-- record is its current 30-day window, so this is how the next window is
-- granted on time: the worker re-reads the vendor and projects whatever it
-- verifies. Newest first, so a window that ended a minute ago is never queued
-- behind a row that has been waiting on the store for a day. Nothing here
-- changes a row.
create index if not exists entitlements_paid_period_end on public.entitlements(period_end)
  where plan in ('starter', 'regular');

create or replace function public.billing_renewals_due_v1(p_limit integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('renewals', coalesce(jsonb_agg(jsonb_build_object('userId', due.user_id, 'periodEnd', due.period_end)
    order by due.period_end desc, due.user_id), '[]'::jsonb))
  from (
    select e.user_id, e.period_end from public.entitlements e
    where e.plan in ('starter', 'regular') and e.period_end is not null and e.period_end <= now()
    order by e.period_end desc, e.user_id
    limit greatest(0, least(coalesce(p_limit, 0), 100))
  ) due
$$;

revoke all on function public.billing_projection_version() from public, anon, authenticated;
revoke all on function public.apply_billing_projection_v2(uuid, bigint, text, text, timestamptz, text, integer) from public, anon, authenticated;
revoke all on function public.billing_renewals_due_v1(integer) from public, anon, authenticated;
grant execute on function public.billing_projection_version() to service_role;
grant execute on function public.apply_billing_projection_v2(uuid, bigint, text, text, timestamptz, text, integer) to service_role;
grant execute on function public.billing_renewals_due_v1(integer) to service_role;
notify pgrst, 'reload schema';
