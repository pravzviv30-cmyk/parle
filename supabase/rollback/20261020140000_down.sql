-- REOPENS-D24. Restores the one-off thirty-minute trial and the exhausted lapse.
-- Cost: every weekly_taste row loses its refill. A lapsed row this migration
-- reset to seconds_used 0 keeps 0 against the restored 1800 cap, so a former
-- subscriber who lapsed while it was applied gets the thirty minutes.
-- A free row's seconds_used counts only its current week (at most 300), and the
-- weekly refills spent before this rollback leave no record, so after it a free
-- learner may get up to 1500 more seconds against the restored cap. Accepted
-- pre-launch (2026-10-20); clamp seconds_used here first if it ever runs with
-- real learners. Roll back
-- the token server and app that read the weekly taste first.
do $$ begin
  if current_setting('luvani.reopen_one_off_trial', true) is distinct from 'yes' then
    raise exception 'explicit weekly taste rollback interlock required';
  end if;
end $$;
begin;

create or replace function public.advance_usage_epoch() returns trigger
language plpgsql set search_path = '' as $$
begin
  if pg_catalog.current_setting('luvani.allowance_projection', true) = 'v2'
    and new.plan = old.plan and new.plan in ('starter','regular')
    and new.lapsed_from_paid = old.lapsed_from_paid and not new.lapsed_from_paid
    and new.period_start is not null and new.period_start = old.period_start
    and new.allowance_window_end is not null and new.allowance_window_end = old.allowance_window_end
    and new.withheld_seconds = old.withheld_seconds
    and new.period_end > old.period_end then
    new.usage_epoch := old.usage_epoch;
  elsif new.period_end is distinct from old.period_end
    or (new.plan='trial') is distinct from (old.plan='trial')
    or new.lapsed_from_paid is distinct from old.lapsed_from_paid then
    new.usage_epoch := pg_catalog.gen_random_uuid();
  else new.usage_epoch := old.usage_epoch;
  end if;
  return new;
end; $$;
revoke all on function public.advance_usage_epoch() from public,anon,authenticated;

create or replace function public.mark_paid_lapse()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.plan in ('starter', 'regular') and new.plan = 'trial' then
    new.lapsed_from_paid := true;
  elsif new.plan in ('starter', 'regular') then
    new.lapsed_from_paid := false;
  end if;
  return new;
end;
$$;

create or replace function luvani_private.tutor_cap_v1(p_plan text) returns integer
language sql immutable set search_path='' as $$
  select case p_plan when 'trial' then 1800 when 'starter' then 10800 when 'regular' then 18000 else 0 end
$$;

create or replace function luvani_private.tutor_entitlement_v1(p_user_id uuid)
returns public.entitlements language plpgsql security definer set search_path='' as $$
declare e public.entitlements;
begin
  perform 1 from auth.users where id=p_user_id for key share;
  if not found then return null; end if;
  select * into e from public.entitlements where user_id=p_user_id for update;
  if not found then return null; end if;
  if e.plan<>'trial' and e.period_end is not null and e.period_end<pg_catalog.clock_timestamp()-interval '24 hours' then
    update public.entitlements set plan='trial',seconds_used=1800,period_end=null,lapsed_from_paid=true,updated_at=pg_catalog.clock_timestamp()
      where user_id=p_user_id returning * into e;
  end if;
  return e;
end $$;

create or replace function public.consume_entitlement(p_user_id uuid,p_seconds integer,p_session_id uuid)
returns public.entitlements language plpgsql security definer set search_path='' as $$
declare e public.entitlements; prior public.entitlements; g public.session_grants; u public.session_usage; delta integer:=0;
begin
  if p_seconds is null or p_seconds<0 or p_seconds>900 then raise exception 'seconds must be between 0 and 900'; end if;
  if p_session_id is null and p_seconds<>0 then raise exception 'unbound debits are refused'; end if;
  perform 1 from auth.users where id=p_user_id for key share;
  if not found then raise exception 'account is missing'; end if;
  select * into e from public.entitlements where user_id=p_user_id for update;
  if not found then raise exception 'entitlement has not been provisioned'; end if;
  if p_session_id is not null then
    select * into g from public.session_grants where session_id=p_session_id for update;
    if found and g.lifecycle_version=1 then raise exception using errcode='PT409',message='version1 usage requires lifecycle RPC'; end if;
    select * into u from public.session_usage where session_id=p_session_id for update;
    if found then
      if u.user_id is distinct from p_user_id then raise exception 'session id already belongs to another account'; end if;
      return e;
    end if;
    if g.session_id is null or g.user_id is distinct from p_user_id then raise exception 'session grant owner is missing or invalid'; end if;
    if p_seconds>0 and exists(select 1 from public.session_grants where user_id=p_user_id and lifecycle_version=1 and state in ('reserved','active','cancel_requested')) then
      raise exception using errcode='PT409',message='legacy debit cannot consume reserved allowance'; end if;
  end if;
  prior:=e;
  if e.plan<>'trial' and e.period_end is not null and e.period_end<pg_catalog.clock_timestamp()-interval '24 hours' then
    update public.entitlements set plan='trial',seconds_used=1800,period_end=null,lapsed_from_paid=true,updated_at=pg_catalog.clock_timestamp()
      where user_id=p_user_id returning * into e;
  elsif p_session_id is not null and g.usage_epoch=e.usage_epoch then
    update public.entitlements set seconds_used=least(luvani_private.tutor_cap_v1(plan),seconds_used+p_seconds),updated_at=pg_catalog.clock_timestamp()
      where user_id=p_user_id returning * into e;
    delta:=greatest(0,e.seconds_used-prior.seconds_used);
  end if;
  if p_session_id is not null then insert into public.session_usage(session_id,user_id,seconds,charged_seconds,usage_epoch)
    values(p_session_id,p_user_id,p_seconds,delta,g.usage_epoch); end if;
  return e;
end $$;

create or replace function public.refund_failed_session(p_user_id uuid,p_session_id uuid,p_failure text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.entitlements; g public.session_grants; u public.session_usage; kind text; cap integer;
begin
  if p_session_id is null or p_failure is null or p_failure not in ('stt_error','tts_error','llm_error','realtime_model_error','interruption_detection_error') then
    raise exception 'recognized service failure and session required'; end if;
  perform 1 from auth.users where id=p_user_id for key share;
  if not found then raise exception 'account is missing'; end if;
  select * into e from public.entitlements where user_id=p_user_id for update;
  if not found then raise exception 'entitlement has not been provisioned'; end if;
  select * into g from public.session_grants where session_id=p_session_id for update;
  if not found then raise exception using errcode='PT409',message='session grant proof requires reconciliation'; end if;
  if g.user_id is distinct from p_user_id then raise exception 'session grant owner is invalid'; end if;
  if g.lifecycle_version=1 then raise exception using errcode='PT409',message='version1 refund requires lifecycle RPC'; end if;
  select * into u from public.session_usage where session_id=p_session_id for update;
  if found then
    if u.user_id is distinct from p_user_id then raise exception 'session id already belongs to another account'; end if;
    if u.charged_seconds is null or u.usage_epoch is null then raise exception using errcode='PT409',message='legacy charge requires reconciliation'; end if;
  else insert into public.session_usage(session_id,user_id,seconds,charged_seconds,usage_epoch)
    values(p_session_id,p_user_id,0,0,g.usage_epoch) returning * into u; end if;
  if e.plan<>'trial' and e.period_end is not null and e.period_end<pg_catalog.clock_timestamp()-interval '24 hours' then
    update public.entitlements set plan='trial',seconds_used=1800,period_end=null,lapsed_from_paid=true,updated_at=pg_catalog.clock_timestamp()
      where user_id=p_user_id returning * into e;
  end if;
  if u.refunded_at is null then
    if u.usage_epoch=e.usage_epoch then update public.entitlements set seconds_used=greatest(0,seconds_used-u.charged_seconds),updated_at=pg_catalog.clock_timestamp()
      where user_id=p_user_id returning * into e; end if;
    update public.session_usage set refund_reason=p_failure,refunded_at=pg_catalog.clock_timestamp(),refunded_seconds=u.charged_seconds
      where session_id=p_session_id returning * into u;
  end if;
  kind:=case when u.charged_seconds=0 then 'not-charged' when u.usage_epoch=e.usage_epoch then 'restored-current-period' else 'historical-reversal' end;
  cap:=luvani_private.tutor_cap_v1(e.plan);
  return pg_catalog.jsonb_build_object('kind',kind,'refundedSeconds',u.refunded_seconds,'secondsRemaining',greatest(0,cap-e.seconds_used),'plan',e.plan);
end $$;

create or replace function public.reserve_tutor_session_v1(p_user_id uuid,p_session_id uuid,p_room_name text,p_mode text,p_request_digest text,p_auth_session_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.entitlements; g public.session_grants; cfg public.tutor_session_admission_config; v_now timestamptz;
  v_available integer; v_amount integer; v_day date; v_issued bigint; v_owner_day luvani_private.tutor_account_budget_days;
begin
  if p_user_id is null or p_session_id is null or p_auth_session_id is null or p_room_name is null or p_room_name !~ '^[a-zA-Z0-9_-]{1,128}$'
    or p_mode is null or p_mode not in ('lesson','lesson-text','convo','convo-text') or p_request_digest is null or p_request_digest !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='PT400',message='invalid tutor reservation';
  end if;
  perform 1 from auth.users where id=p_user_id for key share;
  if not found then return pg_catalog.jsonb_build_object('kind','refused','reason','gone'); end if;
  -- All global admission serializes here; completion never takes this lock.
  select * into cfg from public.tutor_session_admission_config where singleton for update;
  if not found then return pg_catalog.jsonb_build_object('kind','refused','reason','admission-disabled'); end if;
  e:=luvani_private.tutor_entitlement_v1(p_user_id);
  if e.user_id is null then return pg_catalog.jsonb_build_object('kind','refused','reason','gone'); end if;
  if not public.active_tutor_identity_v1(p_user_id,p_auth_session_id) then return pg_catalog.jsonb_build_object('kind','refused','reason','inactive-identity'); end if;
  v_now:=pg_catalog.clock_timestamp();
  select * into g from public.session_grants where session_id=p_session_id for update;
  if found then
    if g.user_id<>p_user_id or g.lifecycle_version<>1 or g.room_name<>p_room_name or g.mode<>p_mode
      or g.request_digest<>p_request_digest or g.auth_session_id<>p_auth_session_id then
      raise exception using errcode='PT409',message='reservation identity conflicts';
    end if;
    if g.state<>'reserved' or g.join_deadline<=v_now or g.usage_epoch<>e.usage_epoch or g.grant_plan<>e.plan then
      return pg_catalog.jsonb_build_object('kind','refused','reason','session-not-reservable');
    end if;
    return pg_catalog.jsonb_build_object('kind','reserved','version',1,'userId',p_user_id,'sessionId',p_session_id,'roomName',g.room_name,'mode',g.mode,
      'plan',g.grant_plan,'usageEpoch',g.usage_epoch,'reservedSeconds',g.reserved_seconds,
      'secondsRemaining',greatest(0,luvani_private.tutor_cap_v1(e.plan)-e.seconds_used),'joinDeadline',g.join_deadline,'serverNow',v_now);
  end if;
  if exists(select 1 from public.session_usage where session_id=p_session_id) then
    raise exception using errcode='PT409',message='session completion proof already exists';
  end if;
  -- Safely retire only unclaimed, expired/stale reservations, never a worker.
  for g in select * from public.session_grants where user_id=p_user_id and lifecycle_version=1
    and state in ('reserved','cancel_requested') and claimed_at is null for update loop
    if g.join_deadline<=v_now or g.state='cancel_requested' or g.usage_epoch<>e.usage_epoch or g.grant_plan<>e.plan then
      perform luvani_private.tutor_finish_v1(p_user_id,g.session_id,'expired','reconciler',
        luvani_private.tutor_payload_v1(g.checkpoint_revision,0,0,null,null),null,false);
    end if;
  end loop;
  if exists(select 1 from public.session_grants where user_id=p_user_id and lifecycle_version=1 and state in ('reserved','active','cancel_requested')) then
    return pg_catalog.jsonb_build_object('kind','refused','reason','session-active');
  end if;
  if not cfg.enabled or cfg.max_active_sessions=0 or cfg.max_daily_issued_seconds=0
    or cfg.max_account_daily_sessions=0 or cfg.max_account_daily_seconds=0 then
    return pg_catalog.jsonb_build_object('kind','refused','reason','admission-disabled');
  end if;
  if (select count(*) from public.session_grants where lifecycle_version=1 and state in ('reserved','active','cancel_requested'))>=cfg.max_active_sessions then
    return pg_catalog.jsonb_build_object('kind','refused','reason','capacity');
  end if;
  v_available:=greatest(0,luvani_private.tutor_cap_v1(e.plan)-e.seconds_used-coalesce((select sum(reserved_seconds) from public.session_grants
    where user_id=p_user_id and usage_epoch=e.usage_epoch and lifecycle_version=1 and state in ('reserved','active','cancel_requested')),0)::integer);
  if v_available<120 then return pg_catalog.jsonb_build_object('kind','refused','reason',case
    when e.lapsed_from_paid then 'subscription-lapsed' when v_available=0 then 'exhausted' else 'insufficient-for-session' end); end if;
  v_amount:=least(cfg.max_session_seconds,v_available);
  v_now:=pg_catalog.clock_timestamp(); -- UTC counter bucket after preceding lock waits.
  v_day:=(v_now at time zone 'UTC')::date;
  insert into public.tutor_session_budget_days(day) values(v_day) on conflict(day) do nothing;
  select issued_seconds into v_issued from public.tutor_session_budget_days where day=v_day for update;
  if v_issued+v_amount>cfg.max_daily_issued_seconds then return pg_catalog.jsonb_build_object('kind','refused','reason','daily-budget'); end if;
  select * into v_owner_day from luvani_private.tutor_account_budget_days where user_id=p_user_id and day=v_day for update;
  if coalesce(v_owner_day.issued_sessions,0)+1>cfg.max_account_daily_sessions
    or coalesce(v_owner_day.issued_seconds,0)+v_amount>cfg.max_account_daily_seconds then
    return pg_catalog.jsonb_build_object('kind','refused','reason','account-daily-budget'); end if;
  insert into public.session_grants(session_id,user_id,usage_epoch,lifecycle_version,state,auth_session_id,room_name,mode,request_digest,grant_plan,reserved_seconds,join_deadline,stop_grace_seconds)
    values(p_session_id,p_user_id,e.usage_epoch,1,'reserved',p_auth_session_id,p_room_name,p_mode,p_request_digest,e.plan,v_amount,
      v_now+pg_catalog.make_interval(secs=>cfg.join_ttl_seconds),cfg.stop_grace_seconds) returning * into g;
  update public.tutor_session_budget_days set issued_seconds=issued_seconds+v_amount where day=v_day;
  insert into luvani_private.tutor_account_budget_days(user_id,day,issued_sessions,issued_seconds) values(p_user_id,v_day,1,v_amount)
    on conflict(user_id,day) do update set issued_sessions=luvani_private.tutor_account_budget_days.issued_sessions+1,
      issued_seconds=luvani_private.tutor_account_budget_days.issued_seconds+v_amount;
  return pg_catalog.jsonb_build_object('kind','reserved','version',1,'userId',p_user_id,'sessionId',p_session_id,'roomName',g.room_name,'mode',g.mode,
    'plan',e.plan,'usageEpoch',e.usage_epoch,'reservedSeconds',v_amount,'secondsRemaining',v_available,'joinDeadline',g.join_deadline,'serverNow',v_now);
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

  insert into public.entitlements (user_id, plan, seconds_used)
  values (p_user_id, 'trial', 0);
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

  insert into public.entitlements (user_id, plan, seconds_used)
  values (p_user_id, 'trial', 0);
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

create or replace function public.apply_billing_projection_v2(
  p_user_id uuid, p_ticket bigint, p_kind text, p_plan text,
  p_period_end timestamptz, p_event_id text, p_grant_seconds integer, p_window_end timestamptz,
  p_period_start timestamptz
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_row public.entitlements;
  event_done timestamptz;
  projection_kind text := 'unchanged';
  projection_reason text;
  normalized_start timestamptz;
  normalized_end timestamptz;
  normalized_window timestamptz;
  recorded_start timestamptz;
  recorded_end timestamptz;
  recorded_window timestamptz;
  allowance integer;
  withheld integer;
  ordering integer;
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
    -- A period starts before it ends. Unknown is allowed, and orders by end.
    if p_period_start is not null and (not isfinite(p_period_start) or p_period_start >= p_period_end) then
      raise exception 'invalid active billing period start';
    end if;
    withheld := allowance - p_grant_seconds;
  elsif p_grant_seconds is not null or p_window_end is not null or p_period_start is not null then
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
  normalized_start := date_trunc('second', p_period_start);
  normalized_end := date_trunc('second', p_period_end);
  normalized_window := least(date_trunc('second', coalesce(p_window_end, p_period_end)), normalized_end);
  recorded_start := date_trunc('second', current_row.period_start);
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
    else
      -- Which answer is newer: 1 a new period or window, 0 the same window,
      -- -1 an older answer read late. A later start is a new period whatever
      -- its end (an upgrade); an earlier start is older whatever its end (the
      -- year an upgrade refunded). With the same start, a later window is the
      -- next window, and a later end with the same window is the same period
      -- lengthened. With either start unknown, the end decides, as it always has.
      if current_row.plan not in ('starter', 'regular') or recorded_end is null then
        ordering := 1;
      elsif normalized_start is not null and recorded_start is not null then
        ordering := case
          when normalized_start > recorded_start then 1
          when normalized_start < recorded_start then -1
          when normalized_window > recorded_window then 1
          when normalized_window < recorded_window or normalized_end < recorded_end then -1
          else 0 end;
      else
        ordering := case
          when normalized_end < recorded_end or (normalized_end = recorded_end and normalized_window < recorded_window) then -1
          when normalized_end > recorded_end or normalized_window > recorded_window then 1
          else 0 end;
      end if;
      if ordering < 0 then
        projection_reason := 'superseded';
      else
        -- A new period or window starts from what it grants. The same window
        -- keeps what was spent in it: what it withheld before is swapped for
        -- what it withholds now, never below that and never past the cap.
        perform pg_catalog.set_config('luvani.allowance_projection', 'v2', true);
        update public.entitlements set
          plan = p_plan,
          seconds_used = case
            when ordering > 0 then withheld
            else least(greatest(seconds_used - withheld_seconds + withheld, withheld), allowance)
          end,
          withheld_seconds = withheld,
          period_start = coalesce(normalized_start, case when ordering = 0 then recorded_start end),
          period_end = normalized_end,
          allowance_window_end = case when normalized_window < normalized_end then normalized_window end,
          lapsed_from_paid = false, updated_at = now()
          where user_id = p_user_id returning * into current_row;
        perform pg_catalog.set_config('luvani.allowance_projection', '', true);
        projection_kind := 'active';
      end if;
    end if;
  elsif current_row.plan in ('starter', 'regular') then
    -- Only the vendor saying the learner holds nothing ends a plan here.
    update public.entitlements set plan = 'trial', seconds_used = 1800,
      period_end = null, allowance_window_end = null, period_start = null, withheld_seconds = 0,
      lapsed_from_paid = true, updated_at = now()
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

create or replace function public.validate_product_event()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  property_count integer;
begin
  if new.properties is null or pg_catalog.jsonb_typeof(new.properties) <> 'object' then
    raise exception 'unsupported product event';
  end if;

  select count(*) into property_count
  from pg_catalog.jsonb_object_keys(new.properties);

  if new.name in ('trial_started', 'minutes_refused') and current_user not in ('postgres', 'service_role') then
    raise exception 'server-only product event';
  end if;

  if new.name = 'onboarding_completed' then
    -- One property, and `?&` on a single-element array rather than a bare `?` so this
    -- branch reads like the four below and so no tool that treats `?` as a bind
    -- placeholder can mangle it on the way to the SQL editor.
    if property_count <> 1
      or not (new.properties ?& array['personalisedGreeting'])
      or jsonb_typeof(new.properties->'personalisedGreeting') <> 'boolean' then
      raise exception 'invalid onboarding_completed event';
    end if;
  elsif new.name = 'mission_started' then
    if property_count <> 2
      or not (new.properties ?& array['missionId', 'entry'])
      or jsonb_typeof(new.properties->'missionId') <> 'string'
      or not ((new.properties->>'missionId') ~ '^[a-zA-Z0-9:._-]{1,64}$')
      or new.properties->'entry' not in (to_jsonb('chooser'::text), to_jsonb('home'::text), to_jsonb('my-french'::text)) then
      raise exception 'invalid mission_started event';
    end if;
  elsif new.name = 'mission_completed' then
    if property_count <> 2
      or not (new.properties ?& array['missionId', 'rung'])
      or jsonb_typeof(new.properties->'missionId') <> 'string'
      or not ((new.properties->>'missionId') ~ '^[a-zA-Z0-9:._-]{1,64}$')
      or new.properties->'rung' not in ('1'::jsonb, '2'::jsonb, '3'::jsonb, '4'::jsonb) then
      raise exception 'invalid mission_completed event';
    end if;
  elsif new.name = 'sound_check_completed' then
    if property_count <> 2
      or not (new.properties ?& array['missionId', 'kind'])
      or jsonb_typeof(new.properties->'missionId') <> 'string'
      or not ((new.properties->>'missionId') ~ '^[a-zA-Z0-9:._-]{1,64}$')
      or new.properties->'kind' not in (
        to_jsonb('assessed-clear'::text),
        to_jsonb('assessed-focus'::text),
        to_jsonb('self-guided'::text),
        to_jsonb('unavailable'::text)
      ) then
      raise exception 'invalid sound_check_completed event';
    end if;
  elsif new.name = 'my_french_opened' then
    if property_count <> 2
      or not (new.properties ?& array['situationsDone', 'linesKept'])
      or jsonb_typeof(new.properties->'situationsDone') <> 'number'
      or jsonb_typeof(new.properties->'linesKept') <> 'number'
      or (new.properties->>'situationsDone')::numeric not between 0 and 100000
      or (new.properties->>'linesKept')::numeric not between 0 and 100000
      or mod((new.properties->>'situationsDone')::numeric, 1) <> 0
      or mod((new.properties->>'linesKept')::numeric, 1) <> 0 then
      raise exception 'invalid my_french_opened event';
    end if;
  elsif new.name = 'wall_shown' then
    if property_count <> 2
      or not (new.properties ?& array['entry', 'pages'])
      or new.properties->'entry' not in (
        to_jsonb('path-complete'::text),
        to_jsonb('refused'::text),
        to_jsonb('settings'::text),
        to_jsonb('recap'::text)
      )
      or jsonb_typeof(new.properties->'pages') <> 'number'
      or (new.properties->>'pages')::numeric not between 0 and 100000
      or mod((new.properties->>'pages')::numeric, 1) <> 0 then
      raise exception 'invalid wall_shown event';
    end if;
  elsif new.name = 'wall_page_seen' then
    if property_count <> 2
      or not (new.properties ?& array['page', 'index'])
      or new.properties->'page' not in (
        to_jsonb('map'::text),
        to_jsonb('french'::text),
        to_jsonb('yours'::text),
        to_jsonb('plans'::text)
      )
      or jsonb_typeof(new.properties->'index') <> 'number'
      or (new.properties->>'index')::numeric not between 0 and 100000
      or mod((new.properties->>'index')::numeric, 1) <> 0 then
      raise exception 'invalid wall_page_seen event';
    end if;
  elsif new.name = 'plan_selected' then
    if property_count <> 1
      or not (new.properties ?& array['plan'])
      or new.properties->'plan' not in (to_jsonb('starter'::text), to_jsonb('regular'::text)) then
      raise exception 'invalid plan_selected event';
    end if;
  elsif new.name = 'purchase_started' then
    if property_count <> 1
      or not (new.properties ?& array['plan'])
      or new.properties->'plan' not in (to_jsonb('starter'::text), to_jsonb('regular'::text)) then
      raise exception 'invalid purchase_started event';
    end if;
  elsif new.name = 'purchase_settled' then
    if property_count <> 2
      or not (new.properties ?& array['plan', 'outcome'])
      or new.properties->'plan' not in (to_jsonb('starter'::text), to_jsonb('regular'::text))
      or new.properties->'outcome' not in (
        to_jsonb('done'::text),
        to_jsonb('nothing-granted'::text),
        to_jsonb('cancelled'::text),
        to_jsonb('store-trouble'::text),
        to_jsonb('refresh-trouble'::text)
      ) then
      raise exception 'invalid purchase_settled event';
    end if;
  elsif new.name = 'restore_started' or new.name = 'restore_settled' then
    if not (new.properties ?& array['entry'])
      or new.properties->'entry' not in (to_jsonb('settings'::text), to_jsonb('wall'::text), to_jsonb('inline'::text)) then
      raise exception 'invalid restore event';
    end if;
    if new.name = 'restore_started' and property_count <> 1 then
      raise exception 'invalid restore_started event';
    end if;
    if new.name = 'restore_settled' and (property_count <> 2
      or not (new.properties ?& array['outcome'])
      or new.properties->'outcome' not in (to_jsonb('done'::text), to_jsonb('nothing-granted'::text), to_jsonb('cancelled'::text), to_jsonb('store-trouble'::text), to_jsonb('refresh-trouble'::text))) then
      raise exception 'invalid restore_settled event';
    end if;
  elsif new.name = 'wall_left' then
    if property_count <> 3 or not (new.properties ?& array['entry', 'outcome', 'destination'])
      or new.properties->'entry' not in (to_jsonb('path-complete'::text), to_jsonb('refused'::text), to_jsonb('settings'::text), to_jsonb('recap'::text))
      or new.properties->'outcome' not in (to_jsonb('granted'::text), to_jsonb('unchanged'::text))
      or new.properties->'destination' not in (to_jsonb('back'::text), to_jsonb('speak'::text)) then
      raise exception 'invalid wall_left event';
    end if;
  elsif new.name = 'trial_started' then
    if property_count <> 0 then raise exception 'invalid trial_started event'; end if;
  elsif new.name = 'minutes_refused' then
    if property_count <> 2 or not (new.properties ?& array['plan', 'reason'])
      or new.properties->'plan' not in (to_jsonb('trial'::text), to_jsonb('starter'::text), to_jsonb('regular'::text))
      or new.properties->'reason' not in (to_jsonb('exhausted'::text), to_jsonb('insufficient-for-session'::text)) then
      raise exception 'invalid minutes_refused event';
    end if;
  else
    raise exception 'unsupported product event';
  end if;

  return new;
end;
$$;

drop trigger if exists entitlement_taste_window on public.entitlements;
drop function if exists luvani_private.taste_window_v1();
drop function if exists luvani_private.refill_taste_v1(public.entitlements);
-- A trial row's period_end meant "refills at"; the restored functions read none.
update public.entitlements set period_end=null where plan='trial';
alter table public.entitlements drop column if exists weekly_taste;

revoke all on function luvani_private.tutor_cap_v1(text),luvani_private.tutor_entitlement_v1(uuid) from public,anon,authenticated,service_role;
revoke all on function public.consume_entitlement(uuid,integer,uuid),public.refund_failed_session(uuid,uuid,text),
  public.reserve_tutor_session_v1(uuid,uuid,text,text,text,uuid),public.claim_trial(uuid, text, text),
  public.claim_trial_with_evidence(uuid, text, text, boolean),public.begin_billing_refresh(uuid),
  public.apply_billing_projection(uuid, bigint, text, text, timestamptz, text),
  public.apply_billing_projection_v2(uuid, bigint, text, text, timestamptz, text, integer, timestamptz, timestamptz)
  from public,anon,authenticated;
grant execute on function public.consume_entitlement(uuid,integer,uuid),public.refund_failed_session(uuid,uuid,text),
  public.reserve_tutor_session_v1(uuid,uuid,text,text,text,uuid),public.claim_trial(uuid, text, text),
  public.claim_trial_with_evidence(uuid, text, text, boolean),public.begin_billing_refresh(uuid),
  public.apply_billing_projection(uuid, bigint, text, text, timestamptz, text),
  public.apply_billing_projection_v2(uuid, bigint, text, text, timestamptz, text, integer, timestamptz, timestamptz)
  to service_role;

commit;
notify pgrst, 'reload schema';
