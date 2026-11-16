-- F955 (2026-11-16): a tutor start that never joined gives its day back.
-- A start whose grant was never claimed (abandon, join-deadline expiry, retirement
-- at the next reserve, account fence) adds its reserved seconds, and one session,
-- to new released_* counters on both UTC day ledgers, inside tutor_finish_v1. The
-- issued_* counters never fall (the lifecycle and paid-admission rollbacks read
-- them as "ever issued"); admission reads issued minus released. Claimed sessions
-- never give back. The paid ledgers are untouched.
-- Bodies are the latest ones (tutor_finish_v1 and reconcile_tutor_sessions_v1 from
-- 20261003231627, reserve_tutor_session_v1 from 20261020140000) with only:
--   tutor_finish_v1: the guarded, all-or-nothing give-back when claimed_at is null;
--   reserve_tutor_session_v1: the three cap comparisons net of released, and the
--     grant's created_at set to v_now so its day is the counted day;
--   reconcile_tutor_sessions_v1: candidates ordered by UTC creation day first, so
--     day rows lock in the same order as a reserve that retires an older start.
-- Additive columns, create or replace only, no back-fill, safe to run twice.
-- The ACL lines repeat the originals so a fresh replay ends the same.
-- Apply as a single file (migration 42 stays held); never `supabase db push`.
begin;
set local lock_timeout='5s';
alter table public.tutor_session_budget_days
  add column if not exists released_seconds bigint not null default 0 check(released_seconds between 0 and issued_seconds);
alter table luvani_private.tutor_account_budget_days
  add column if not exists released_sessions integer not null default 0 check(released_sessions between 0 and issued_sessions),
  add column if not exists released_seconds bigint not null default 0 check(released_seconds between 0 and issued_seconds);
create or replace function luvani_private.tutor_finish_v1(p_user_id uuid,p_session_id uuid,p_state text,p_source text,p_payload jsonb,p_digest text,p_charge boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.entitlements; g public.session_grants; u public.session_usage; v_now timestamptz;
  v_seconds integer; v_turns integer; v_failure text; v_pack jsonb; v_charge integer:=0; v_baseline text:='none'; v_receipt jsonb; v_day date;
begin
  select * into e from public.entitlements where user_id=p_user_id for update;
  if not found then return pg_catalog.jsonb_build_object('kind','gone'); end if;
  select * into g from public.session_grants where session_id=p_session_id and user_id=p_user_id for update;
  if not found then return pg_catalog.jsonb_build_object('kind','gone'); end if;
  if g.completion_receipt is not null then return pg_catalog.jsonb_build_object('kind','completed','sessionId',g.session_id,'receipt',g.completion_receipt); end if;
  if g.lifecycle_version<>1 then raise exception using errcode='PT409',message='legacy session requires legacy reconciliation'; end if;
  v_now:=pg_catalog.clock_timestamp();
  v_seconds:=(p_payload->>'seconds')::integer; v_turns:=(p_payload->>'learnerTurns')::integer;
  v_failure:=p_payload->>'serviceFailure'; v_pack:=p_payload->'baseline';
  if v_pack='null'::jsonb then v_pack:=null; end if;
  if v_seconds>g.reserved_seconds then raise exception using errcode='PT400',message='usage exceeds reservation'; end if;
  perform luvani_private.tutor_pack_v1(v_pack,p_user_id,p_session_id);
  select * into u from public.session_usage where session_id=p_session_id for update;
  if found then raise exception using errcode='PT409',message='existing usage proof cannot be overwritten'; end if;
  if p_charge and v_failure is null and v_turns>0 and e.usage_epoch=g.usage_epoch and e.plan=g.grant_plan
    and not exists(select 1 from luvani_private.tutor_account_fences where user_id=p_user_id) then
    v_charge:=v_seconds;
    if e.seconds_used+v_charge>luvani_private.tutor_cap_v1(e.plan) then
      raise exception using errcode='PT409',message='reservation funding requires reconciliation';
    end if;
    update public.entitlements set seconds_used=seconds_used+v_charge,updated_at=v_now where user_id=p_user_id returning * into e;
  end if;
  insert into public.session_usage(session_id,user_id,seconds,charged_seconds,usage_epoch,refund_reason,refunded_at,refunded_seconds)
    values(p_session_id,p_user_id,v_seconds,v_charge,g.usage_epoch,v_failure,case when v_failure is not null then v_now else null end,
      case when v_failure is not null then 0 else null end);
  if exists(select 1 from public.conversation_practice_tombstones where pack_id=p_session_id) then v_baseline:='deleted';
  elsif v_pack is not null then
    perform public.receive_conversation_practice(v_pack,false);
    if not exists(select 1 from public.conversation_packs where id=p_session_id and user_id=p_user_id) then
      raise exception using errcode='PT409',message='baseline receipt not confirmed';
    end if;
    v_baseline:='saved';
  end if;
  v_receipt:=pg_catalog.jsonb_build_object('version',1,'sessionId',p_session_id,'state',p_state,
    'settlement',pg_catalog.jsonb_build_object('kind',case when v_charge>0 then 'charged' else 'not-charged' end,'refundedSeconds',0,
      'secondsRemaining',greatest(0,luvani_private.tutor_cap_v1(e.plan)-e.seconds_used),'plan',e.plan),
    'chargedSeconds',v_charge,'releasedReservedSeconds',g.reserved_seconds-v_charge,
    'checkpointRevision',(p_payload->>'revision')::integer,'baselineStatus',v_baseline,'completedAt',v_now);
  update public.session_grants set state=p_state,checkpoint_revision=(p_payload->>'revision')::integer,
    checkpoint_seconds=v_seconds,checkpoint_learner_turns=v_turns,checkpoint_failure=v_failure,checkpoint_baseline=null,
    completion_digest=p_digest,completion_content_hash=luvani_private.tutor_hash_v1(p_payload),completion_source=p_source,
    completion_receipt=v_receipt,updated_at=v_now where session_id=p_session_id;
  if g.claimed_at is not null then
    insert into public.tutor_room_stops(session_id,room_name) values(p_session_id,g.room_name) on conflict(session_id) do nothing;
  else
    -- F955: a start no tutor claimed gives its day back. Once, because a settled grant returns early above.
    -- Both day ledgers move or neither does; issued_* never fall. Lock order as reserve: budget day, account day.
    v_day:=(g.created_at at time zone 'UTC')::date;
    perform 1 from public.tutor_session_budget_days where day=v_day and issued_seconds-released_seconds>=g.reserved_seconds for update;
    if found then
      update luvani_private.tutor_account_budget_days set released_seconds=released_seconds+g.reserved_seconds,released_sessions=released_sessions+1
        where user_id=p_user_id and day=v_day and issued_seconds-released_seconds>=g.reserved_seconds and issued_sessions-released_sessions>=1;
      if found then
        update public.tutor_session_budget_days set released_seconds=released_seconds+g.reserved_seconds where day=v_day;
      end if;
    end if;
  end if;
  return pg_catalog.jsonb_build_object('kind','completed','sessionId',p_session_id,'receipt',v_receipt);
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
    when v_available=0 and e.lapsed_from_paid then 'subscription-lapsed' when v_available=0 then 'exhausted' else 'insufficient-for-session' end); end if;
  v_amount:=least(cfg.max_session_seconds,v_available);
  v_now:=pg_catalog.clock_timestamp(); -- UTC counter bucket after preceding lock waits.
  v_day:=(v_now at time zone 'UTC')::date;
  insert into public.tutor_session_budget_days(day) values(v_day) on conflict(day) do nothing;
  select issued_seconds-released_seconds into v_issued from public.tutor_session_budget_days where day=v_day for update; -- F955: net of give-backs
  if v_issued+v_amount>cfg.max_daily_issued_seconds then return pg_catalog.jsonb_build_object('kind','refused','reason','daily-budget'); end if;
  select * into v_owner_day from luvani_private.tutor_account_budget_days where user_id=p_user_id and day=v_day for update;
  if coalesce(v_owner_day.issued_sessions,0)-coalesce(v_owner_day.released_sessions,0)+1>cfg.max_account_daily_sessions
    or coalesce(v_owner_day.issued_seconds,0)-coalesce(v_owner_day.released_seconds,0)+v_amount>cfg.max_account_daily_seconds then
    return pg_catalog.jsonb_build_object('kind','refused','reason','account-daily-budget'); end if;
  insert into public.session_grants(session_id,user_id,usage_epoch,lifecycle_version,state,auth_session_id,room_name,mode,request_digest,grant_plan,reserved_seconds,join_deadline,stop_grace_seconds,created_at)
    values(p_session_id,p_user_id,e.usage_epoch,1,'reserved',p_auth_session_id,p_room_name,p_mode,p_request_digest,e.plan,v_amount,
      v_now+pg_catalog.make_interval(secs=>cfg.join_ttl_seconds),cfg.stop_grace_seconds,v_now) returning * into g;
  update public.tutor_session_budget_days set issued_seconds=issued_seconds+v_amount where day=v_day;
  insert into luvani_private.tutor_account_budget_days(user_id,day,issued_sessions,issued_seconds) values(p_user_id,v_day,1,v_amount)
    on conflict(user_id,day) do update set issued_sessions=luvani_private.tutor_account_budget_days.issued_sessions+1,
      issued_seconds=luvani_private.tutor_account_budget_days.issued_seconds+v_amount;
  return pg_catalog.jsonb_build_object('kind','reserved','version',1,'userId',p_user_id,'sessionId',p_session_id,'roomName',g.room_name,'mode',g.mode,
    'plan',e.plan,'usageEpoch',e.usage_epoch,'reservedSeconds',v_amount,'secondsRemaining',v_available,'joinDeadline',g.join_deadline,'serverNow',v_now);
end $$;
create or replace function public.reconcile_tutor_sessions_v1(p_limit integer default 50,p_closed_session_ids uuid[] default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare candidate record; e public.entitlements; g public.session_grants; v_now timestamptz; v_results jsonb:='[]'; v_stops jsonb; v_result jsonb;
begin
  if p_limit is null or p_limit<1 or p_limit>100 or p_closed_session_ids is null or pg_catalog.cardinality(p_closed_session_ids)>100
    or pg_catalog.array_position(p_closed_session_ids,null) is not null then raise exception using errcode='PT400',message='invalid reconciliation batch'; end if;
  delete from public.tutor_room_stops where session_id=any(p_closed_session_ids);
  -- Read IDs without grant locks, then canonical owner -> entitlement -> grant.
  -- Sorted owners also avoid inversions between multiple batches in one txn.
  for candidate in select user_id,session_id from public.session_grants where lifecycle_version=1 and state in ('reserved','active','cancel_requested')
    and ((claimed_at is null and (join_deadline<=pg_catalog.clock_timestamp() or state='cancel_requested'))
      or (claimed_at is not null and least(lease_until,hard_deadline)+pg_catalog.make_interval(secs=>stop_grace_seconds)<=pg_catalog.clock_timestamp()))
    order by (created_at at time zone 'UTC')::date,user_id,session_id limit p_limit loop
    perform 1 from auth.users where id=candidate.user_id for key share skip locked;
    if not found then continue; end if;
    select * into e from public.entitlements where user_id=candidate.user_id for update skip locked;
    if not found then continue; end if;
    e:=luvani_private.tutor_entitlement_v1(candidate.user_id);
    select * into g from public.session_grants where session_id=candidate.session_id and user_id=candidate.user_id for update;
    if not found or g.state not in ('reserved','active','cancel_requested') then continue; end if;
    v_now:=pg_catalog.clock_timestamp();
    if g.claimed_at is null and (g.join_deadline<=v_now or g.state='cancel_requested' or g.usage_epoch<>e.usage_epoch or g.grant_plan<>e.plan
      or not public.active_tutor_identity_v1(g.user_id,g.auth_session_id)) then
      v_result:=luvani_private.tutor_finish_v1(g.user_id,g.session_id,'expired','reconciler',luvani_private.tutor_payload_v1(g.checkpoint_revision,0,0,null,null),null,false);
    elsif g.claimed_at is not null and least(g.lease_until,g.hard_deadline)+pg_catalog.make_interval(secs=>g.stop_grace_seconds)<=v_now then
      v_result:=luvani_private.tutor_finish_v1(g.user_id,g.session_id,'interrupted','reconciler',
        luvani_private.tutor_payload_v1(g.checkpoint_revision,g.checkpoint_seconds,g.checkpoint_learner_turns,g.checkpoint_failure,g.checkpoint_baseline),null,false);
    else continue; end if;
    v_results:=v_results||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('sessionId',g.session_id,'receipt',v_result->'receipt'));
  end loop;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('sessionId',s.session_id,'roomName',s.room_name)),'[]') into v_stops
    from(select session_id,room_name from public.tutor_room_stops order by created_at,session_id limit p_limit)s;
  return pg_catalog.jsonb_build_object('kind','reconciled','results',v_results,'roomStops',v_stops,'pendingCount',(select count(*) from public.tutor_room_stops));
end $$;
revoke all on function luvani_private.tutor_finish_v1(uuid,uuid,text,text,jsonb,text,boolean) from public,anon,authenticated,service_role;
revoke all on function public.reserve_tutor_session_v1(uuid,uuid,text,text,text,uuid),public.reconcile_tutor_sessions_v1(integer,uuid[]) from public,anon,authenticated;
grant execute on function public.reserve_tutor_session_v1(uuid,uuid,text,text,text,uuid),public.reconcile_tutor_sessions_v1(integer,uuid[]) to service_role;
commit;
notify pgrst, 'reload schema';
