-- F263/F264: an event and its allowance projection commit together. Fetches
-- carry DB-issued ordering tickets; delayed older responses cannot undo newer
-- projections. Session debits and projection both lock the same entitlement.
alter table public.billing_events add column if not exists processed_at timestamptz;
alter table public.entitlements add column if not exists billing_sequence bigint not null default 0;
alter table public.entitlements add column if not exists billing_applied_sequence bigint not null default 0;

create or replace function public.billing_projection_version()
returns integer language sql security definer set search_path = '' as $$ select 1 $$;

create or replace function public.begin_billing_refresh(p_user_id uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare ticket bigint;
begin
  if p_user_id is null then raise exception 'a billing refresh needs an account'; end if;
  -- Purchase may precede the first room. Never manufacture a free trial here:
  -- only a verified active subscription can turn this exhausted row into time.
  insert into public.entitlements(user_id, plan, seconds_used)
    values(p_user_id, 'trial', 1800) on conflict(user_id) do nothing;
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

revoke all on function public.billing_projection_version() from public, anon, authenticated;
revoke all on function public.begin_billing_refresh(uuid) from public, anon, authenticated;
revoke all on function public.apply_billing_projection(uuid, bigint, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.billing_projection_version() to service_role;
grant execute on function public.begin_billing_refresh(uuid) to service_role;
grant execute on function public.apply_billing_projection(uuid, bigint, text, text, timestamptz, text) to service_role;
notify pgrst, 'reload schema';
