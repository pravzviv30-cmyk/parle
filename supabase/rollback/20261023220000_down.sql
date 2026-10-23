-- Rollback for 20261023220000_daily_free_allowance.sql (REOPENS REV-001).
-- Restores the D24 bodies from 20261020140000: tutor_cap_v1 trial 300, starter
-- 10800, regular 18000; the free window refills seven days after its first
-- debit; begin_billing_refresh's unclaimed row is spent at the literal 300; the
-- six-argument apply_billing_projection clamps with its inline 10800/18000.
-- Roll back the app and the token server that read the REV-001 figures first.
-- Rows: a free row's seconds_used is clamped to 300 so no row reads above its
-- cap; a running 44-hour window keeps its refill time (it only ends sooner
-- than seven days). A paid row that already used more than the restored cap
-- reads as spent until its next period; accepted pre-launch, revisit before
-- running this with real subscribers. Safe to run twice.
-- Refused while any paid row carries withheld_seconds > 0: a REV-001 store
-- trial or yearly window withholds against the 18000/36000 caps, so under the
-- restored caps its remaining sum would exceed the allowance and the next
-- same-window projection would recompute from the smaller cap and drop spent
-- minutes. Refusing is safer than a silent recompute; wait for those windows to
-- end (or project them afresh) and run this again.
do $$ begin
  if current_setting('luvani.reopen_weekly_taste', true) is distinct from 'yes' then
    raise exception 'explicit daily allowance rollback interlock required';
  end if;
  if exists(select 1 from public.entitlements where plan in ('starter','regular') and withheld_seconds>0) then
    raise exception 'daily allowance rollback refused: a paid row has withheld_seconds > 0 from a REV-001 store trial or window; wait for it to end';
  end if;
end $$;
begin;

create or replace function luvani_private.tutor_cap_v1(p_plan text) returns integer
language sql immutable set search_path='' as $$
  select case p_plan when 'trial' then 300 when 'starter' then 10800 when 'regular' then 18000 else 0 end
$$;
revoke all on function luvani_private.tutor_cap_v1(text) from public,anon,authenticated,service_role;

create or replace function luvani_private.taste_window_v1() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.plan='trial' and old.plan='trial' and new.weekly_taste and old.weekly_taste
    and new.period_end is null and old.period_end is null and new.seconds_used>old.seconds_used then
    new.period_end:=pg_catalog.clock_timestamp()+interval '7 days';
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
    values(p_user_id, 'trial', 300, false) on conflict(user_id) do nothing;
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
        else least(seconds_used, case p_plan when 'starter' then 10800 when 'regular' then 18000 end)
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

update public.entitlements set seconds_used=luvani_private.tutor_cap_v1('trial')
  where plan='trial' and seconds_used>luvani_private.tutor_cap_v1('trial');

revoke all on function public.begin_billing_refresh(uuid),
  public.apply_billing_projection(uuid, bigint, text, text, timestamptz, text)
  from public,anon,authenticated;
grant execute on function public.begin_billing_refresh(uuid),
  public.apply_billing_projection(uuid, bigint, text, text, timestamptz, text)
  to service_role;

commit;
notify pgrst, 'reload schema';
