-- Only before any new paid or owner-tutor exposure. Default refusal is atomic.
begin;
do $$ begin
 if current_setting('luvani.paid_rollback_maintenance',true) is distinct from 'approved' then
  raise exception 'paid admission rollback requires maintenance interlock';end if;
 if exists(select 1 from luvani_private.paid_admission_config where enabled or ever_issued)
  or exists(select 1 from public.tutor_session_admission_config where enabled)
  or exists(select 1 from luvani_private.tutor_account_budget_days where issued_sessions>0)
  or exists(select 1 from public.tutor_session_budget_days where issued_seconds>0)
  or exists(select 1 from luvani_private.paid_global_days where operations>0) then
  raise exception 'paid or tutor exposure issued: disable admission, drain and forward-fix; rollback refused';end if;
end $$;
create or replace function public.reserve_tutor_session_v1(p_user_id uuid,p_session_id uuid,p_room_name text,p_mode text,p_request_digest text,p_auth_session_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.entitlements; g public.session_grants; cfg public.tutor_session_admission_config; v_now timestamptz;
  v_available integer; v_amount integer; v_day date; v_issued bigint;
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
  if not cfg.enabled or cfg.max_active_sessions=0 or cfg.max_daily_issued_seconds=0 then
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
  v_day:=(v_now at time zone 'UTC')::date;
  insert into public.tutor_session_budget_days(day) values(v_day) on conflict(day) do nothing;
  select issued_seconds into v_issued from public.tutor_session_budget_days where day=v_day for update;
  if v_issued+v_amount>cfg.max_daily_issued_seconds then return pg_catalog.jsonb_build_object('kind','refused','reason','daily-budget'); end if;
  insert into public.session_grants(session_id,user_id,usage_epoch,lifecycle_version,state,auth_session_id,room_name,mode,request_digest,grant_plan,reserved_seconds,join_deadline,stop_grace_seconds)
    values(p_session_id,p_user_id,e.usage_epoch,1,'reserved',p_auth_session_id,p_room_name,p_mode,p_request_digest,e.plan,v_amount,
      v_now+pg_catalog.make_interval(secs=>cfg.join_ttl_seconds),cfg.stop_grace_seconds) returning * into g;
  update public.tutor_session_budget_days set issued_seconds=issued_seconds+v_amount where day=v_day;
  return pg_catalog.jsonb_build_object('kind','reserved','version',1,'userId',p_user_id,'sessionId',p_session_id,'roomName',g.room_name,'mode',g.mode,
    'plan',e.plan,'usageEpoch',e.usage_epoch,'reservedSeconds',v_amount,'secondsRemaining',v_available,'joinDeadline',g.join_deadline,'serverNow',v_now);
end $$;

drop function if exists public.paid_admission_schema_v1();
drop function if exists public.resume_paid_tutor_v1(uuid,uuid,uuid);
drop function if exists public.claim_paid_effect_v1(uuid,uuid,uuid,text,text,jsonb,integer,jsonb);
drop function if exists public.reserve_paid_operation_v1(uuid,uuid,uuid,text,jsonb,text);
drop trigger if exists paid_quote_review_v1 on luvani_private.paid_quotes;
drop trigger if exists paid_quote_insert_lock_v1 on luvani_private.paid_quotes;
drop trigger if exists paid_config_review_v1 on luvani_private.paid_admission_config;
drop function if exists luvani_private.paid_context_active_v1(uuid,jsonb,boolean,text,jsonb);
drop function if exists luvani_private.paid_context_shape_v1(jsonb,boolean,uuid);
drop function if exists luvani_private.paid_quote_review_v1();
drop function if exists luvani_private.paid_quote_insert_lock_v1();
drop function if exists luvani_private.paid_quote_valid_v1(jsonb);
drop function if exists luvani_private.paid_config_review_v1();
drop function if exists luvani_private.paid_review_v1(text,text,text,timestamptz);
drop index if exists luvani_private.paid_effect_component_v1;
drop table if exists luvani_private.paid_effects;
drop table if exists luvani_private.paid_component_days;
drop table if exists luvani_private.paid_execution_account_days;
drop table if exists luvani_private.paid_execution_vendor_days;
drop table if exists luvani_private.paid_execution_global_days;
drop table if exists luvani_private.paid_operations;
drop table if exists luvani_private.paid_account_days;
drop table if exists luvani_private.paid_vendor_days;
drop table if exists luvani_private.paid_global_days;
drop table if exists luvani_private.paid_quotes;
drop table if exists luvani_private.paid_admission_vendors;
drop table if exists luvani_private.paid_admission_config;
drop table if exists luvani_private.tutor_account_budget_days;
alter table public.tutor_session_admission_config drop column if exists max_account_daily_sessions,drop column if exists max_account_daily_seconds;
commit;
