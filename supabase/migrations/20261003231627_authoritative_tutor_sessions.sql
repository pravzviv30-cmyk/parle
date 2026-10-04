-- Admission OFF until compatible servers/workers, drain and staged acceptance.
-- Postgres owns reservations and fencing. Daily issued time is an exposure
-- budget, not dollar accounting: runtime also bounds provider calls/commands.
-- Drain pre-migration SQL transactions and old SDK jobs before activation.
create schema if not exists luvani_private;

alter table public.session_grants
  add column lifecycle_version smallint not null default 0 check(lifecycle_version in (0,1)),
  add column state text not null default 'legacy' check(state in ('legacy','reserved','active','cancel_requested','settled','cancelled','expired','interrupted')),
  add column auth_session_id uuid,
  add column room_name text,
  add column mode text check(mode in ('lesson','lesson-text','convo','convo-text')),
  add column request_digest text,
  add column grant_plan text check(grant_plan in ('trial','starter','regular')),
  add column reserved_seconds integer not null default 0 check(reserved_seconds between 0 and 900),
  add column join_deadline timestamptz,
  add column claimed_at timestamptz,
  add column hard_deadline timestamptz,
  add column claim_nonce uuid,
  add column lease_until timestamptz,
  add column stop_grace_seconds integer not null default 5 check(stop_grace_seconds between 1 and 30),
  add column checkpoint_revision integer not null default 0 check(checkpoint_revision between 0 and 10000),
  add column checkpoint_digest text,
  add column checkpoint_content_hash text,
  add column checkpoint_seconds integer not null default 0 check(checkpoint_seconds between 0 and 900),
  add column checkpoint_learner_turns integer not null default 0 check(checkpoint_learner_turns between 0 and 1000),
  add column checkpoint_failure text check(checkpoint_failure in ('stt_error','tts_error','llm_error','realtime_model_error','interruption_detection_error')),
  add column checkpoint_baseline jsonb,
  add column completion_digest text,
  add column completion_content_hash text,
  add column completion_source text,
  add column completion_receipt jsonb,
  add column terminal_reason text,
  add column updated_at timestamptz not null default now(),
  add constraint session_grants_v1_shape check(lifecycle_version=0 or
    (state<>'legacy' and auth_session_id is not null and room_name is not null and mode is not null
    and request_digest ~ '^[a-f0-9]{64}$' and grant_plan is not null and reserved_seconds>=120 and join_deadline is not null));
create unique index tutor_session_one_live_owner on public.session_grants(user_id)
  where lifecycle_version=1 and state in ('reserved','active','cancel_requested');
create index tutor_session_reconciliation on public.session_grants(state,lease_until,join_deadline)
  where lifecycle_version=1 and state in ('reserved','active','cancel_requested');

create table public.tutor_session_admission_config(
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  max_active_sessions integer not null default 0 check(max_active_sessions between 0 and 1000),
  max_daily_issued_seconds bigint not null default 0 check(max_daily_issued_seconds between 0 and 86400000),
  max_session_seconds integer not null default 900 check(max_session_seconds between 120 and 900),
  join_ttl_seconds integer not null default 120 check(join_ttl_seconds between 30 and 300),
  worker_lease_seconds integer not null default 30 check(worker_lease_seconds between 10 and 120),
  stop_grace_seconds integer not null default 5 check(stop_grace_seconds between 1 and 30)
);
insert into public.tutor_session_admission_config(singleton) values(true);
create table public.tutor_session_budget_days(
  day date primary key,
  issued_seconds bigint not null default 0 check(issued_seconds>=0)
);
-- No FK: room shutdown must survive auth/session/pack deletion. No learner text.
create table public.tutor_room_stops(
  session_id uuid primary key,
  room_name text not null check(length(room_name) between 1 and 128),
  created_at timestamptz not null default now()
);
create table luvani_private.tutor_account_fences(
  user_id uuid primary key references auth.users(id) on delete cascade,
  deleting_at timestamptz not null default now()
);
alter table public.tutor_session_admission_config enable row level security;
alter table public.tutor_session_budget_days enable row level security;
alter table public.tutor_room_stops enable row level security;
alter table luvani_private.tutor_account_fences enable row level security;
revoke all on public.tutor_session_admission_config,public.tutor_session_budget_days,public.tutor_room_stops from public,anon,authenticated,service_role;
grant select,update on public.tutor_session_admission_config to service_role;
grant select on public.tutor_session_budget_days,public.tutor_room_stops to service_role;
revoke all on luvani_private.tutor_account_fences from public,anon,authenticated,service_role;
revoke all on public.session_grants from public,anon,authenticated,service_role;
grant select on public.session_grants to service_role;

create function luvani_private.tutor_cap_v1(p_plan text) returns integer
language sql immutable set search_path='' as $$
  select case p_plan when 'trial' then 1800 when 'starter' then 10800 when 'regular' then 18000 else 0 end
$$;
create function luvani_private.tutor_hash_v1(p_payload jsonb) returns text
language sql immutable strict set search_path='' as $$
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_payload::text,'UTF8')),'hex')
$$;

-- This checks revocation/deletion and explicit not_after, not unverified hosted
-- timebox/inactivity/single-session configuration (Auth checks those at refresh).
-- p_auth_session_id is the JWT session_id, not a tutor grant UUID.
create function public.active_tutor_identity_v1(p_user_id uuid,p_auth_session_id uuid)
returns boolean language sql volatile security definer set search_path='' as $$
  select p_user_id is not null and p_auth_session_id is not null and exists(
    select 1 from auth.users u join auth.sessions s on s.user_id=u.id
    where u.id=p_user_id and s.id=p_auth_session_id
      and (s.not_after is null or s.not_after>pg_catalog.clock_timestamp())
      and (pg_catalog.to_jsonb(u)->>'deleted_at') is null
      and ((pg_catalog.to_jsonb(u)->>'banned_until') is null or
        (pg_catalog.to_jsonb(u)->>'banned_until')::timestamptz<=pg_catalog.clock_timestamp())
      and not exists(select 1 from luvani_private.tutor_account_fences f where f.user_id=p_user_id))
$$;

-- Auth parent lock first prevents DELETE(parent)->cascade(child) inversion.
-- Remaining lock order: entitlement -> grant -> usage -> pack advisory -> pack -> job.
create function luvani_private.tutor_entitlement_v1(p_user_id uuid)
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

create function luvani_private.tutor_pack_v1(p_pack jsonb,p_user_id uuid,p_session_id uuid)
returns void language plpgsql set search_path='' as $$
declare k text; v jsonb;
begin
  if p_pack is null then return; end if;
  if pg_catalog.jsonb_typeof(p_pack) is distinct from 'object' or pg_catalog.octet_length(p_pack::text)>131072
    or p_pack->>'id' is distinct from p_session_id::text or p_pack->>'sessionId' is distinct from p_session_id::text
    or p_pack->>'learnerId' is distinct from p_user_id::text or p_pack->>'state' is distinct from 'ready'
    or p_pack->'version' is distinct from '1'::jsonb
    or pg_catalog.jsonb_typeof(p_pack->'title') is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_pack->'title'->'fr') is distinct from 'string'
    or pg_catalog.jsonb_typeof(p_pack->'title'->'en') is distinct from 'string'
    or pg_catalog.jsonb_typeof(p_pack->'summary') is distinct from 'string'
    or pg_catalog.jsonb_typeof(p_pack->'continuationSeed') is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_pack->'continuationSeed'->'titleFr') is distinct from 'string'
    or pg_catalog.jsonb_typeof(p_pack->'continuationSeed'->'titleEn') is distinct from 'string'
    or pg_catalog.jsonb_typeof(p_pack->'createdAt') is distinct from 'string' then
    raise exception using errcode='PT400',message='invalid tutor baseline';
  end if;
  perform (p_pack->>'createdAt')::timestamptz;
  for k in select pg_catalog.jsonb_object_keys(p_pack) loop
    if k not in ('version','id','sessionId','learnerId','createdAt','lastPractisedAt','state','title','summary','learnerGoal','tutorGoal','cefr','durationSec','topics','keyPhrases','wins','corrections','pronunciationFocus','exercises','continuationSeed','revisedFromPackId') then
      raise exception using errcode='PT400',message='unknown tutor baseline field';
    end if;
  end loop;
  for k,v in select * from pg_catalog.jsonb_each(p_pack) loop
    if k in ('keyPhrases','wins','corrections','exercises') and pg_catalog.jsonb_typeof(v) is distinct from 'array' then
      raise exception using errcode='PT400',message='invalid baseline array';
    end if;
  end loop;
  if pg_catalog.jsonb_typeof(p_pack->'keyPhrases') is distinct from 'array' or pg_catalog.jsonb_array_length(p_pack->'keyPhrases')>100
    or pg_catalog.jsonb_typeof(p_pack->'wins') is distinct from 'array' or pg_catalog.jsonb_array_length(p_pack->'wins')>100
    or pg_catalog.jsonb_typeof(p_pack->'corrections') is distinct from 'array' or pg_catalog.jsonb_array_length(p_pack->'corrections')>24
    or pg_catalog.jsonb_typeof(p_pack->'exercises') is distinct from 'array' or pg_catalog.jsonb_array_length(p_pack->'exercises')>24 then
    raise exception using errcode='PT400',message='baseline arrays exceed bound';
  end if;
  -- Recursive forbidden-key walk: curated pack only, no audio/transcript/history.
  if exists(with recursive nodes(v) as(
    select p_pack union all
    select child.v from nodes n cross join lateral(
      select e.value as v from pg_catalog.jsonb_each(case when pg_catalog.jsonb_typeof(n.v)='object' then n.v else '{}'::jsonb end)e
      union all select a.value from pg_catalog.jsonb_array_elements(case when pg_catalog.jsonb_typeof(n.v)='array' then n.v else '[]'::jsonb end)a
    )child
  ) select 1 from nodes n cross join lateral pg_catalog.jsonb_object_keys(case when pg_catalog.jsonb_typeof(n.v)='object' then n.v else '{}'::jsonb end)key
    where pg_catalog.lower(key) in ('audio','rawaudio','recording','recordings','transcript','history','profile','memory')) then
    raise exception using errcode='PT400',message='private raw data is not a tutor baseline';
  end if;
end $$;

create function luvani_private.tutor_payload_v1(p_revision integer,p_seconds integer,p_turns integer,p_failure text,p_pack jsonb)
returns jsonb language plpgsql set search_path='' as $$
begin
  if p_revision is null or p_revision<0 or p_revision>10000 or p_seconds is null or p_seconds<0 or p_seconds>900
    or p_turns is null or p_turns<0 or p_turns>1000 or (p_failure is not null and p_failure not in
    ('stt_error','tts_error','llm_error','realtime_model_error','interruption_detection_error')) then
    raise exception using errcode='PT400',message='invalid tutor checkpoint';
  end if;
  return pg_catalog.jsonb_build_object('revision',p_revision,'seconds',p_seconds,'learnerTurns',p_turns,'serviceFailure',p_failure,'baseline',p_pack);
end $$;

-- Private terminal projection; callers must already hold the owner entitlement.
-- Canonical payload hash keeps replay proof without retaining personal pack twice.
create function luvani_private.tutor_finish_v1(p_user_id uuid,p_session_id uuid,p_state text,p_source text,p_payload jsonb,p_digest text,p_charge boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.entitlements; g public.session_grants; u public.session_usage; v_now timestamptz;
  v_seconds integer; v_turns integer; v_failure text; v_pack jsonb; v_charge integer:=0; v_baseline text:='none'; v_receipt jsonb;
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
  end if;
  return pg_catalog.jsonb_build_object('kind','completed','sessionId',p_session_id,'receipt',v_receipt);
end $$;

create function public.reserve_tutor_session_v1(p_user_id uuid,p_session_id uuid,p_room_name text,p_mode text,p_request_digest text,p_auth_session_id uuid)
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

create function public.claim_tutor_session_v1(p_user_id uuid,p_session_id uuid,p_room_name text,p_mode text,p_claim_nonce uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.entitlements; g public.session_grants; v_now timestamptz; v_lease integer; v_enabled boolean;
begin
  if p_user_id is null or p_session_id is null or p_claim_nonce is null or p_room_name is null or p_mode is null then
    raise exception using errcode='PT400',message='invalid tutor claim'; end if;
  e:=luvani_private.tutor_entitlement_v1(p_user_id);
  if e.user_id is null then return pg_catalog.jsonb_build_object('kind','refused','reason','gone'); end if;
  select * into g from public.session_grants where session_id=p_session_id and user_id=p_user_id for update;
  if not found or g.lifecycle_version<>1 then return pg_catalog.jsonb_build_object('kind','refused','reason','not-admitted'); end if;
  v_now:=pg_catalog.clock_timestamp();
  if g.room_name<>p_room_name or g.mode<>p_mode or g.usage_epoch<>e.usage_epoch or g.grant_plan<>e.plan
    or not public.active_tutor_identity_v1(p_user_id,g.auth_session_id) then
    return pg_catalog.jsonb_build_object('kind','refused','reason','identity-or-allowance-revoked'); end if;
  if g.state='active' then
    if g.claim_nonce<>p_claim_nonce or g.lease_until<=v_now or g.hard_deadline<=v_now then
      return pg_catalog.jsonb_build_object('kind','refused','reason','already-claimed-or-expired'); end if;
  elsif g.state='reserved' and g.join_deadline>v_now then
    select worker_lease_seconds,enabled into v_lease,v_enabled from public.tutor_session_admission_config where singleton;
    if v_lease is null or not v_enabled then return pg_catalog.jsonb_build_object('kind','refused','reason','admission-disabled'); end if;
    update public.session_grants set state='active',claim_nonce=p_claim_nonce,claimed_at=v_now,
      hard_deadline=v_now+pg_catalog.make_interval(secs=>reserved_seconds),
      lease_until=v_now+pg_catalog.make_interval(secs=>least(v_lease,reserved_seconds)),updated_at=v_now
      where session_id=p_session_id returning * into g;
  else return pg_catalog.jsonb_build_object('kind','refused','reason','session-ended-or-expired'); end if;
  return pg_catalog.jsonb_build_object('kind','claimed','version',1,'sessionId',p_session_id,'fence',g.claim_nonce,
    'startedAt',g.claimed_at,'leaseUntil',g.lease_until,'hardDeadline',g.hard_deadline,'maxSeconds',g.reserved_seconds,
    'checkpointRevision',g.checkpoint_revision,'serverNow',v_now,'stopGraceSeconds',g.stop_grace_seconds);
end $$;

create function public.checkpoint_tutor_session_v1(p_user_id uuid,p_session_id uuid,p_fence uuid,p_revision integer,p_digest text,p_seconds integer,p_learner_turns integer,p_service_failure text,p_baseline jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.entitlements; g public.session_grants; v_now timestamptz; v_payload jsonb; v_hash text; v_lease integer; v_deleted boolean;
begin
  if p_user_id is null or p_session_id is null or p_fence is null or p_digest is null or p_digest !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='PT400',message='invalid checkpoint identity'; end if;
  if p_baseline='null'::jsonb then p_baseline:=null; end if;
  v_payload:=luvani_private.tutor_payload_v1(p_revision,p_seconds,p_learner_turns,p_service_failure,p_baseline);
  v_hash:=luvani_private.tutor_hash_v1(v_payload);
  e:=luvani_private.tutor_entitlement_v1(p_user_id);
  if e.user_id is null then return pg_catalog.jsonb_build_object('kind','refused','reason','gone'); end if;
  select * into g from public.session_grants where session_id=p_session_id and user_id=p_user_id for update;
  if not found or g.lifecycle_version<>1 or g.claim_nonce is distinct from p_fence then
    return pg_catalog.jsonb_build_object('kind','refused','reason','not-admitted'); end if;
  v_now:=pg_catalog.clock_timestamp();
  if g.state<>'active' or g.lease_until<=v_now or g.hard_deadline<=v_now or g.usage_epoch<>e.usage_epoch or g.grant_plan<>e.plan
    or not public.active_tutor_identity_v1(p_user_id,g.auth_session_id) then
    return pg_catalog.jsonb_build_object('kind','refused','reason','session-revoked-or-expired'); end if;
  perform luvani_private.tutor_pack_v1(p_baseline,p_user_id,p_session_id);
  v_deleted:=exists(select 1 from public.conversation_practice_tombstones where pack_id=p_session_id);
  if p_revision=g.checkpoint_revision and g.checkpoint_content_hash is not null then
    if p_digest<>g.checkpoint_digest or v_hash<>g.checkpoint_content_hash then raise exception using errcode='PT409',message='checkpoint conflicts'; end if;
  elsif p_revision=g.checkpoint_revision and p_revision=0 and g.checkpoint_content_hash is null then
    if p_seconds<>0 or p_learner_turns<>0 or p_service_failure is not null or p_baseline is not null then
      raise exception using errcode='PT409',message='revision zero must be an empty heartbeat'; end if;
  elsif p_revision<>g.checkpoint_revision+1 then raise exception using errcode='PT409',message='checkpoint revision is not consecutive';
  end if;
  if p_seconds>g.reserved_seconds or p_seconds<g.checkpoint_seconds or p_learner_turns<g.checkpoint_learner_turns
    or (g.checkpoint_failure is not null and p_service_failure is distinct from g.checkpoint_failure) then
    raise exception using errcode='PT409',message='checkpoint regresses or exceeds allowance'; end if;
  if p_seconds>greatest(0,pg_catalog.ceil(extract(epoch from v_now-g.claimed_at))::integer) then
    raise exception using errcode='PT409',message='usage exceeds authoritative elapsed time'; end if;
  if not v_deleted and ((g.checkpoint_baseline is not null and p_baseline is null)
    or (g.mode in ('convo','convo-text') and p_learner_turns>0 and p_baseline is null)) then
    raise exception using errcode='PT409',message='earned conversation baseline is required'; end if;
  select worker_lease_seconds into v_lease from public.tutor_session_admission_config where singleton;
  if v_lease is null then return pg_catalog.jsonb_build_object('kind','refused','reason','admission-disabled'); end if;
  -- Validation/hashing may consume time. Never resurrect a lease that expired
  -- during that work; deadlines use a fresh clock after all waits/validation.
  v_now:=pg_catalog.clock_timestamp();
  if g.lease_until<=v_now or g.hard_deadline<=v_now then
    return pg_catalog.jsonb_build_object('kind','refused','reason','session-revoked-or-expired'); end if;
  update public.session_grants set checkpoint_revision=p_revision,checkpoint_digest=p_digest,checkpoint_content_hash=v_hash,
    checkpoint_seconds=p_seconds,checkpoint_learner_turns=p_learner_turns,checkpoint_failure=p_service_failure,
    checkpoint_baseline=case when v_deleted then null else p_baseline end,
    lease_until=least(g.hard_deadline,v_now+pg_catalog.make_interval(secs=>v_lease)),updated_at=v_now
    where session_id=p_session_id returning * into g;
  return pg_catalog.jsonb_build_object('kind','checkpointed','sessionId',p_session_id,'revision',p_revision,
    'leaseUntil',g.lease_until,'hardDeadline',g.hard_deadline,'serverNow',v_now,'baselineStatus',case when v_deleted then 'deleted' when p_baseline is not null then 'checkpointed' else 'none' end);
end $$;

create function public.complete_tutor_session_v1(p_user_id uuid,p_session_id uuid,p_fence uuid,p_revision integer,p_digest text,p_seconds integer,p_learner_turns integer,p_service_failure text,p_baseline jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.entitlements; g public.session_grants; v_payload jsonb; v_now timestamptz; v_charge boolean; v_deleted boolean;
begin
  if p_user_id is null or p_session_id is null or p_fence is null or p_digest is null or p_digest !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='PT400',message='invalid completion identity'; end if;
  if p_baseline='null'::jsonb then p_baseline:=null; end if;
  v_payload:=luvani_private.tutor_payload_v1(p_revision,p_seconds,p_learner_turns,p_service_failure,p_baseline);
  e:=luvani_private.tutor_entitlement_v1(p_user_id);
  if e.user_id is null then return pg_catalog.jsonb_build_object('kind','gone'); end if;
  select * into g from public.session_grants where session_id=p_session_id and user_id=p_user_id for update;
  if not found then return pg_catalog.jsonb_build_object('kind','gone'); end if;
  if g.lifecycle_version<>1 or g.claim_nonce is distinct from p_fence then return pg_catalog.jsonb_build_object('kind','refused','reason','not-admitted'); end if;
  if g.completion_receipt is not null then
    if g.completion_source='agent' and (g.completion_digest<>p_digest or g.completion_content_hash<>luvani_private.tutor_hash_v1(v_payload)) then
      raise exception using errcode='PT409',message='completion conflicts'; end if;
    return pg_catalog.jsonb_build_object('kind','completed','sessionId',p_session_id,'receipt',g.completion_receipt);
  end if;
  if g.state not in ('active','cancel_requested') then return pg_catalog.jsonb_build_object('kind','refused','reason','not-active'); end if;
  perform luvani_private.tutor_pack_v1(p_baseline,p_user_id,p_session_id);
  v_deleted:=exists(select 1 from public.conversation_practice_tombstones where pack_id=p_session_id);
  if p_revision<g.checkpoint_revision or p_revision>g.checkpoint_revision+1 or p_seconds<g.checkpoint_seconds or p_seconds>g.reserved_seconds
    or p_learner_turns<g.checkpoint_learner_turns or (g.checkpoint_failure is not null and p_service_failure is distinct from g.checkpoint_failure) then
    raise exception using errcode='PT409',message='completion regresses or exceeds checkpoint'; end if;
  if p_revision=g.checkpoint_revision then
    if g.checkpoint_content_hash is not null and (p_digest<>g.checkpoint_digest or luvani_private.tutor_hash_v1(v_payload)<>g.checkpoint_content_hash) then
      raise exception using errcode='PT409',message='completion conflicts with immutable checkpoint revision';
    elsif g.checkpoint_content_hash is null and (p_revision<>0 or p_seconds<>0 or p_learner_turns<>0 or p_service_failure is not null or p_baseline is not null) then
      raise exception using errcode='PT409',message='completion must advance the checkpoint revision';
    end if;
  end if;
  if not v_deleted and ((g.checkpoint_baseline is not null and p_baseline is null)
    or (g.mode in ('convo','convo-text') and p_learner_turns>0 and p_baseline is null)) then
    raise exception using errcode='PT409',message='earned conversation baseline is required'; end if;
  v_now:=pg_catalog.clock_timestamp();
  if p_seconds>greatest(0,pg_catalog.ceil(extract(epoch from v_now-g.claimed_at))::integer) then
    raise exception using errcode='PT409',message='usage exceeds authoritative elapsed time'; end if;
  -- Finalization may land inside the stop grace, but cannot renew/spend there.
  v_charge:=g.state='active' and g.lease_until+pg_catalog.make_interval(secs=>g.stop_grace_seconds)>v_now
    and g.hard_deadline+pg_catalog.make_interval(secs=>g.stop_grace_seconds)>v_now
    and public.active_tutor_identity_v1(p_user_id,g.auth_session_id) and g.usage_epoch=e.usage_epoch and g.grant_plan=e.plan;
  return luvani_private.tutor_finish_v1(p_user_id,p_session_id,case when v_charge and p_service_failure is null then 'settled' else 'interrupted' end,
    'agent',v_payload,p_digest,v_charge);
end $$;

create function public.abandon_tutor_session_v1(p_user_id uuid,p_session_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.entitlements; g public.session_grants; v_result jsonb;
begin
  if p_user_id is null or p_session_id is null then raise exception using errcode='PT400',message='invalid abandon identity'; end if;
  e:=luvani_private.tutor_entitlement_v1(p_user_id);
  if e.user_id is null then return pg_catalog.jsonb_build_object('kind','gone'); end if;
  select * into g from public.session_grants where session_id=p_session_id and user_id=p_user_id for update;
  if not found then return pg_catalog.jsonb_build_object('kind','gone'); end if;
  if g.lifecycle_version<>1 then return pg_catalog.jsonb_build_object('kind','refused','reason','legacy-session'); end if;
  if g.completion_receipt is not null then return pg_catalog.jsonb_build_object('kind','cancelled','sessionId',p_session_id,'receipt',g.completion_receipt); end if;
  if g.claimed_at is null then
    v_result:=luvani_private.tutor_finish_v1(p_user_id,p_session_id,'cancelled','client',luvani_private.tutor_payload_v1(g.checkpoint_revision,0,0,null,null),null,false);
    return pg_catalog.jsonb_build_object('kind','cancelled','sessionId',p_session_id,'receipt',v_result->'receipt');
  end if;
  update public.session_grants set state='cancel_requested',terminal_reason='client-abandon',updated_at=pg_catalog.clock_timestamp() where session_id=p_session_id;
  insert into public.tutor_room_stops(session_id,room_name) values(p_session_id,g.room_name) on conflict(session_id) do nothing;
  return pg_catalog.jsonb_build_object('kind','cancel-pending','sessionId',p_session_id,'stopAfter',
    least(g.lease_until,g.hard_deadline)+pg_catalog.make_interval(secs=>g.stop_grace_seconds));
end $$;

create function public.receipt_tutor_session_v1(p_user_id uuid,p_session_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.session_grants;
begin
  if p_user_id is null or p_session_id is null then raise exception using errcode='PT400',message='invalid receipt identity'; end if;
  select * into g from public.session_grants where user_id=p_user_id and session_id=p_session_id and lifecycle_version=1;
  if not found then return pg_catalog.jsonb_build_object('kind','gone'); end if;
  if g.completion_receipt is not null then return pg_catalog.jsonb_build_object('kind','completed','sessionId',p_session_id,'receipt',g.completion_receipt); end if;
  return pg_catalog.jsonb_build_object('kind','pending','sessionId',p_session_id,'state',g.state,'revision',g.checkpoint_revision);
end $$;

create function public.reconcile_tutor_sessions_v1(p_limit integer default 50,p_closed_session_ids uuid[] default '{}')
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
    order by user_id,session_id limit p_limit loop
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

create function public.fence_tutor_account_v1(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.entitlements; g public.session_grants;
begin
  if p_user_id is null then raise exception using errcode='PT400',message='invalid account fence'; end if;
  perform 1 from auth.users where id=p_user_id for key share;
  if not found then return pg_catalog.jsonb_build_object('kind','gone'); end if;
  -- An authenticated account may not have received a trial/entitlement yet.
  -- Its deletion fence still has to exist before processor/auth erasure.
  insert into luvani_private.tutor_account_fences(user_id) values(p_user_id) on conflict(user_id) do nothing;
  e:=luvani_private.tutor_entitlement_v1(p_user_id);
  if e.user_id is null then return pg_catalog.jsonb_build_object('kind','fenced'); end if;
  for g in select * from public.session_grants where user_id=p_user_id and lifecycle_version=1 and state in ('reserved','active','cancel_requested') for update loop
    if g.claimed_at is null then
      perform luvani_private.tutor_finish_v1(p_user_id,g.session_id,'cancelled','account',luvani_private.tutor_payload_v1(g.checkpoint_revision,0,0,null,null),null,false);
    else
      update public.session_grants set state='cancel_requested',terminal_reason='account-deleting',updated_at=pg_catalog.clock_timestamp() where session_id=g.session_id;
      insert into public.tutor_room_stops(session_id,room_name) values(g.session_id,g.room_name) on conflict(session_id) do nothing;
    end if;
  end loop;
  return pg_catalog.jsonb_build_object('kind','fenced');
end $$;

create function luvani_private.tutor_delete_stop_v1() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.lifecycle_version=1 and old.claimed_at is not null and old.state in ('active','cancel_requested') then
    insert into public.tutor_room_stops(session_id,room_name) values(old.session_id,old.room_name) on conflict(session_id) do nothing;
  end if;
  return old;
end $$;
create trigger tutor_session_delete_stop before delete on public.session_grants for each row execute function luvani_private.tutor_delete_stop_v1();

create function luvani_private.tutor_allowance_fence_v1() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.plan is distinct from old.plan or new.usage_epoch is distinct from old.usage_epoch or new.lapsed_from_paid is distinct from old.lapsed_from_paid then
    update public.session_grants set state='cancel_requested',terminal_reason='allowance-changed',updated_at=pg_catalog.clock_timestamp()
      where user_id=new.user_id and lifecycle_version=1 and state in ('reserved','active');
    insert into public.tutor_room_stops(session_id,room_name)
      select session_id,room_name from public.session_grants where user_id=new.user_id and lifecycle_version=1 and state='cancel_requested' and claimed_at is not null
      on conflict(session_id) do nothing;
  end if;
  return new;
end $$;
create trigger tutor_allowance_change after update on public.entitlements for each row execute function luvani_private.tutor_allowance_fence_v1();

-- Replace public legacy bodies IN PLACE. Keep their OIDs, exact historical
-- charged/refund/epoch evidence and unknown-legacy reconciliation behavior.
create or replace function public.record_session_grant(p_user_id uuid,p_session_id uuid,p_plan text,p_seconds_used integer,p_period_end timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
declare e public.entitlements; g public.session_grants;
begin
  if p_session_id is null then raise exception 'session id required'; end if;
  perform 1 from auth.users where id=p_user_id for key share;
  if not found then raise exception 'account is missing'; end if;
  select * into e from public.entitlements where user_id=p_user_id for update;
  if not found then raise exception 'entitlement has not been provisioned'; end if;
  select * into g from public.session_grants where session_id=p_session_id for update;
  if found and g.lifecycle_version=1 then raise exception using errcode='PT409',message='version1 grant requires lifecycle RPC'; end if;
  if exists(select 1 from public.tutor_session_admission_config where singleton and enabled) then
    raise exception using errcode='PT409',message='legacy admission is disabled'; end if;
  if e.plan is distinct from p_plan or e.seconds_used is distinct from p_seconds_used or e.period_end is distinct from p_period_end then return false; end if;
  insert into public.session_grants(session_id,user_id,usage_epoch) values(p_session_id,p_user_id,e.usage_epoch) on conflict(session_id) do nothing;
  select * into g from public.session_grants where session_id=p_session_id;
  if g.user_id is distinct from p_user_id then raise exception 'session id already belongs to another account'; end if;
  return g.usage_epoch=e.usage_epoch;
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

create function public.tutor_session_schema_v1() returns jsonb
language sql security definer set search_path='' as $$
  select pg_catalog.jsonb_build_object('version',1,'enabled',coalesce((select enabled from public.tutor_session_admission_config where singleton),false))
$$;

-- Explicit owner export projection: control credentials/checkpoints are private.
create or replace function public.export_account_data(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  -- Count and measure rows before building the archive. CASE evaluates the
  -- aggregations only when these bounded-preparation checks pass, in the same
  -- statement snapshot; no oversized whole-account JSON is built first.
  with sizes as (
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.learner_state as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.product_events as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.entitlements as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.session_usage as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.session_grants as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.billing_events as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.conversation_packs as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.saved_conversation_text as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.phrase_audio_budgets as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.social_profiles as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.social_blocks as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.social_reports as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.social_notices as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.social_reactions as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.social_edges as row where row.sender = p_user_id or row.recipient = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.social_challenges as row where row.sender = p_user_id or row.recipient = p_user_id
  )
  select case when (select coalesce(sum(bytes), 0) <= 33554432 and coalesce(max(rows), 0) <= 10000 from sizes)
  then jsonb_build_object(
    'learner_state', coalesce((select jsonb_agg(to_jsonb(row)) from public.learner_state as row where row.user_id = p_user_id), '[]'::jsonb),
    'product_events', coalesce((select jsonb_agg(to_jsonb(row)) from public.product_events as row where row.user_id = p_user_id), '[]'::jsonb),
    'entitlements', coalesce((select jsonb_agg(to_jsonb(row)) from public.entitlements as row where row.user_id = p_user_id), '[]'::jsonb),
    'session_usage', coalesce((select jsonb_agg(to_jsonb(row)) from public.session_usage as row where row.user_id = p_user_id), '[]'::jsonb),
    'session_grants', coalesce((select jsonb_agg(jsonb_build_object(
      'session_id',row.session_id,'user_id',row.user_id,'usage_epoch',row.usage_epoch,'created_at',row.created_at,
      'lifecycle_version',row.lifecycle_version,'state',row.state,'mode',row.mode,'grant_plan',row.grant_plan,
      'reserved_seconds',row.reserved_seconds,'join_deadline',row.join_deadline,'claimed_at',row.claimed_at,
      'hard_deadline',row.hard_deadline,'completion_receipt',row.completion_receipt,'terminal_reason',row.terminal_reason,
      'updated_at',row.updated_at)) from public.session_grants as row where row.user_id = p_user_id), '[]'::jsonb),
    'billing_events', coalesce((select jsonb_agg(to_jsonb(row)) from public.billing_events as row where row.user_id = p_user_id), '[]'::jsonb),
    'conversation_packs', coalesce((select jsonb_agg(to_jsonb(row)) from public.conversation_packs as row where row.user_id = p_user_id), '[]'::jsonb),
    'saved_conversation_text', coalesce((select jsonb_agg(to_jsonb(row)) from public.saved_conversation_text as row where row.user_id = p_user_id), '[]'::jsonb),
    'phrase_audio_budgets', coalesce((select jsonb_agg(to_jsonb(row)) from public.phrase_audio_budgets as row where row.user_id = p_user_id), '[]'::jsonb),
    'social_profiles', coalesce((select jsonb_agg(to_jsonb(row)) from public.social_profiles as row where row.user_id = p_user_id), '[]'::jsonb),
    'social_blocks', coalesce((select jsonb_agg(to_jsonb(row)) from public.social_blocks as row where row.user_id = p_user_id), '[]'::jsonb),
    'social_reports', coalesce((select jsonb_agg(to_jsonb(row)) from public.social_reports as row where row.user_id = p_user_id), '[]'::jsonb),
    'social_notices', coalesce((select jsonb_agg(to_jsonb(row)) from public.social_notices as row where row.user_id = p_user_id), '[]'::jsonb),
    'social_reactions', coalesce((select jsonb_agg(to_jsonb(row)) from public.social_reactions as row where row.user_id = p_user_id), '[]'::jsonb),
    'social_edges', coalesce((select jsonb_agg(to_jsonb(row)) from public.social_edges as row where row.sender = p_user_id or row.recipient = p_user_id), '[]'::jsonb),
    'social_challenges', coalesce((select jsonb_agg(to_jsonb(row)) from public.social_challenges as row where row.sender = p_user_id or row.recipient = p_user_id), '[]'::jsonb)
  ) else null end into v_result;
  if v_result is null or octet_length(v_result::text) > 33554432 or exists (
    select 1 from jsonb_each(v_result) as part where jsonb_array_length(part.value) > 10000
  ) then raise exception 'account export exceeds preparation limit'; end if;
  return v_result;
end;
$$;
revoke all on function public.export_account_data(uuid) from public, anon, authenticated;
grant execute on function public.export_account_data(uuid) to service_role;

-- Explicit ACLs, including helpers and existing RPCs after CREATE OR REPLACE.
revoke all on function luvani_private.tutor_cap_v1(text),luvani_private.tutor_hash_v1(jsonb),luvani_private.tutor_entitlement_v1(uuid),
  luvani_private.tutor_pack_v1(jsonb,uuid,uuid),luvani_private.tutor_payload_v1(integer,integer,integer,text,jsonb),
  luvani_private.tutor_finish_v1(uuid,uuid,text,text,jsonb,text,boolean),luvani_private.tutor_delete_stop_v1(),luvani_private.tutor_allowance_fence_v1()
  from public,anon,authenticated,service_role;
revoke all on function public.active_tutor_identity_v1(uuid,uuid),public.reserve_tutor_session_v1(uuid,uuid,text,text,text,uuid),
  public.claim_tutor_session_v1(uuid,uuid,text,text,uuid),public.checkpoint_tutor_session_v1(uuid,uuid,uuid,integer,text,integer,integer,text,jsonb),
  public.complete_tutor_session_v1(uuid,uuid,uuid,integer,text,integer,integer,text,jsonb),public.abandon_tutor_session_v1(uuid,uuid),
  public.receipt_tutor_session_v1(uuid,uuid),public.reconcile_tutor_sessions_v1(integer,uuid[]),public.fence_tutor_account_v1(uuid),public.tutor_session_schema_v1(),
  public.record_session_grant(uuid,uuid,text,integer,timestamptz),public.consume_entitlement(uuid,integer,uuid),public.refund_failed_session(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.active_tutor_identity_v1(uuid,uuid),public.reserve_tutor_session_v1(uuid,uuid,text,text,text,uuid),
  public.claim_tutor_session_v1(uuid,uuid,text,text,uuid),public.checkpoint_tutor_session_v1(uuid,uuid,uuid,integer,text,integer,integer,text,jsonb),
  public.complete_tutor_session_v1(uuid,uuid,uuid,integer,text,integer,integer,text,jsonb),public.abandon_tutor_session_v1(uuid,uuid),
  public.receipt_tutor_session_v1(uuid,uuid),public.reconcile_tutor_sessions_v1(integer,uuid[]),public.fence_tutor_account_v1(uuid),public.tutor_session_schema_v1(),
  public.record_session_grant(uuid,uuid,text,integer,timestamptz),public.consume_entitlement(uuid,integer,uuid),public.refund_failed_session(uuid,uuid,text)
  to service_role;
