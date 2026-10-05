-- F733, founder decision D16 (2026-10-05): a store free trial grants a week of
-- the plan's allowance, and a yearly product refills the monthly allowance
-- window by window inside its paid year.
--
-- The token server reads the vendor, computes the grant with core's metering
-- (storeTrialSeconds, allowanceWindowEnd) and passes it here. This projection
-- records the part of the allowance a window does not grant as already spent,
-- so every debit, reservation, refund and lapse function that reads
-- tutor_cap_v1(plan) - seconds_used enforces the trial cap unchanged, and no
-- second allowance column exists to disagree with the first.
--
-- period_end stays what it has always been: the end of the paid period the
-- store holds. For a yearly product that is the whole paid year, so every lazy
-- lapse (tutor_entitlement_v1, consume_entitlement, refund_failed_session) and
-- the paid phrase-audio bucket keep reading it unchanged. The 30-day window
-- inside the year lives beside it in allowance_window_end, which only says when
-- the next refill is owed. A window that ends before the renewal sweep refills
-- it leaves the learner short of minutes for a while and never lapses the year
-- (F733 review: writing the window as period_end lapsed a paying yearly learner
-- a day after any window the sweep missed, and kept them lapsed).
--
-- A monthly product grants its whole allowance (p_grant_seconds equal to the
-- cap) and no window, which is exactly what apply_billing_projection did. That
-- six-argument function stays in place so a server not yet redeployed keeps
-- working. billing_projection_version() moves to 2: a redeployed server reports
-- purchases ready only against a database that has this function, and a server
-- not yet redeployed reports them not ready until it is.
--
-- Deploy order: this migration, then the token server API and maintenance
-- worker, and only then an introductory offer or a yearly product in App Store
-- Connect. An intro offer configured first is granted the full month by the
-- old projection.

alter table public.entitlements add column allowance_window_end timestamptz;
alter table public.entitlements add constraint entitlements_allowance_window_inside_period check (
  allowance_window_end is null
  or (plan in ('starter', 'regular') and period_end is not null and allowance_window_end < period_end)
);

-- A window belongs to the paid period it was granted in. Every path that ends
-- a paid period (the projection, and the lazy lapse inside the debit, refund
-- and reservation functions) sets the plan to trial or clears period_end, and
-- this clears the window with it, so none of those functions is rewritten. A
-- new window is a new usage period, exactly as a new period_end is in
-- advance_usage_epoch: a session granted in the last window is neither charged
-- to nor refunded into the next one. Named to fire after entitlement_usage_epoch
-- (triggers fire in name order), so its epoch stands.
create function luvani_private.allowance_window_epoch_v1() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.plan = 'trial' or new.period_end is null then new.allowance_window_end := null; end if;
  if new.allowance_window_end is distinct from old.allowance_window_end then
    new.usage_epoch := pg_catalog.gen_random_uuid();
  end if;
  return new;
end $$;
revoke all on function luvani_private.allowance_window_epoch_v1() from public, anon, authenticated;
create trigger entitlements_window_epoch before update on public.entitlements
  for each row execute function luvani_private.allowance_window_epoch_v1();

create or replace function public.billing_projection_version()
returns integer language sql security definer set search_path = '' as $$ select 2 $$;

create or replace function public.apply_billing_projection_v2(
  p_user_id uuid, p_ticket bigint, p_kind text, p_plan text,
  p_period_end timestamptz, p_event_id text, p_grant_seconds integer, p_window_end timestamptz
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_row public.entitlements;
  event_done timestamptz;
  projection_kind text := 'unchanged';
  projection_reason text;
  normalized_end timestamptz;
  normalized_window timestamptz;
  recorded_end timestamptz;
  recorded_window timestamptz;
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
    -- A window is an instant inside the paid period it belongs to.
    if p_window_end is not null and (not isfinite(p_window_end) or p_window_end > p_period_end) then
      raise exception 'invalid active billing allowance window';
    end if;
    withheld := allowance - p_grant_seconds;
  elsif p_grant_seconds is not null or p_window_end is not null then
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
  normalized_end := date_trunc('second', p_period_end);
  normalized_window := least(date_trunc('second', coalesce(p_window_end, p_period_end)), normalized_end);
  recorded_end := date_trunc('second', current_row.period_end);
  recorded_window := date_trunc('second', coalesce(current_row.allowance_window_end, current_row.period_end));
  if event_done is not null or p_ticket <= current_row.billing_applied_sequence then
    projection_reason := 'superseded';
  elsif p_kind = 'unknown-product' then
    projection_reason := 'unknown-product';
  elsif p_kind = 'active' then
    if normalized_window <= now() then
      -- The vendor was read on a clock behind this one, at a window or period
      -- boundary. What it said has already ended here, so it grants nothing
      -- and takes nothing: the row stands for the next read, and only the lazy
      -- lapse, a day after the paid period, ever ends a plan without the vendor
      -- saying it holds nothing.
      projection_reason := 'superseded';
    elsif current_row.plan in ('starter', 'regular') and recorded_end is not null
      and (normalized_end < recorded_end or (normalized_end = recorded_end and normalized_window < recorded_window)) then
      projection_reason := 'superseded';
    else
    -- A new period or window starts from what it grants. The same window keeps
    -- what was spent in it, never less than it withheld and never more than the cap.
    update public.entitlements set
      plan = p_plan,
      seconds_used = case
        when recorded_end is null or normalized_end > recorded_end or normalized_window > recorded_window then withheld
        else least(greatest(seconds_used, withheld), allowance)
      end,
      period_end = normalized_end,
      allowance_window_end = case when normalized_window < normalized_end then normalized_window end,
      lapsed_from_paid = false, updated_at = now()
      where user_id = p_user_id returning * into current_row;
    projection_kind := 'active';
    end if;
  elsif current_row.plan in ('starter', 'regular') then
    -- Only the vendor saying the learner holds nothing ends a plan here.
    update public.entitlements set plan = 'trial', seconds_used = 1800,
      period_end = null, allowance_window_end = null, lapsed_from_paid = true, updated_at = now()
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

-- The paid rows whose period or allowance window on record has ended, most
-- recently ended first, for the maintenance worker's renewal sweep. A yearly
-- product's window ends inside its paid year, so this is how the next window
-- is granted on time: the worker re-reads the vendor and projects whatever it
-- verifies. Newest first, so a window that ended a minute ago is never queued
-- behind a row that has been waiting on the store for a day. Nothing here
-- changes a row.
create index if not exists entitlements_allowance_due on public.entitlements((coalesce(allowance_window_end, period_end)))
  where plan in ('starter', 'regular');

create or replace function public.billing_renewals_due_v1(p_limit integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('renewals', coalesce(jsonb_agg(jsonb_build_object('userId', due.user_id, 'periodEnd', due.ended_at)
    order by due.ended_at desc, due.user_id), '[]'::jsonb))
  from (
    select e.user_id, coalesce(e.allowance_window_end, e.period_end) as ended_at from public.entitlements e
    where e.plan in ('starter', 'regular') and coalesce(e.allowance_window_end, e.period_end) <= now()
    order by coalesce(e.allowance_window_end, e.period_end) desc, e.user_id
    limit greatest(0, least(coalesce(p_limit, 0), 100))
  ) due
$$;

revoke all on function public.billing_projection_version() from public, anon, authenticated;
revoke all on function public.apply_billing_projection_v2(uuid, bigint, text, text, timestamptz, text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.billing_renewals_due_v1(integer) from public, anon, authenticated;
grant execute on function public.billing_projection_version() to service_role;
grant execute on function public.apply_billing_projection_v2(uuid, bigint, text, text, timestamptz, text, integer, timestamptz) to service_role;
grant execute on function public.billing_renewals_due_v1(integer) to service_role;
notify pgrst, 'reload schema';
