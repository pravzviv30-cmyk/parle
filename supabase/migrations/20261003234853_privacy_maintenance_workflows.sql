-- Durable erasure survives the auth cascade and remains retryable after fencing.
begin;
create table public.account_erasure_jobs (
  user_id uuid primary key,
  processor_required boolean not null,
  processor_accepted boolean not null default false,
  identity_deleted boolean not null default false,
  lease_token uuid,
  lease_until timestamptz,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default pg_catalog.clock_timestamp(),
  requested_at timestamptz not null default pg_catalog.clock_timestamp(),
  completed_at timestamptz,
  last_failure text check(last_failure in ('processor','identity','storage'))
);
create index account_erasure_due on public.account_erasure_jobs(next_attempt_at,user_id) where completed_at is null;
alter table public.account_erasure_jobs enable row level security;
revoke all on public.account_erasure_jobs from public,anon,authenticated,service_role;
grant select on public.account_erasure_jobs to service_role;
-- A project that has used the processor cannot later skip it by removing a key.
create table public.privacy_processor_history(singleton boolean primary key default true check(singleton),ever_enabled boolean not null default false);
insert into public.privacy_processor_history(singleton) values(true);
alter table public.privacy_processor_history enable row level security;
revoke all on public.privacy_processor_history from public,anon,authenticated,service_role;
grant select on public.privacy_processor_history to service_role;
create function public.configure_privacy_processor_v1(p_configured boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_ever boolean;
begin
  if p_configured is null then raise exception using errcode='PT400',message='configuration required'; end if;
  update public.privacy_processor_history set ever_enabled=ever_enabled or p_configured where singleton returning ever_enabled into v_ever;
  return pg_catalog.jsonb_build_object('version',1,'processorEverEnabled',v_ever);
end $$;
create function public.begin_account_erasure_v1(p_user_id uuid,p_processor_configured boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_required boolean; v_job public.account_erasure_jobs;
begin
  if p_user_id is null or p_processor_configured is null then raise exception using errcode='PT400',message='invalid erasure'; end if;
  perform 1 from auth.users where id=p_user_id for update;
  if not found then
    select * into v_job from public.account_erasure_jobs where user_id=p_user_id;
    return pg_catalog.jsonb_build_object('kind',case
      when v_job.user_id is not null and v_job.completed_at is null then 'pending'
      when v_job.user_id is not null then 'completed' else 'gone' end);
  end if;
  perform public.configure_privacy_processor_v1(p_processor_configured);
  select ever_enabled into v_required from public.privacy_processor_history where singleton;
  v_required:=v_required or exists(select 1 from public.billing_events where user_id=p_user_id)
    or exists(select 1 from public.entitlements where user_id=p_user_id and (plan<>'trial' or lapsed_from_paid));
  -- Same transaction: durable work before the identity/session fence is committed.
  insert into public.account_erasure_jobs(user_id,processor_required) values(p_user_id,v_required)
    on conflict(user_id) do update set
      processor_required=public.account_erasure_jobs.processor_required or excluded.processor_required,
      -- A restored/reintroduced Auth identity cannot be certified deleted by an
      -- old completion. Reopen its work; preserve attempts/request provenance.
      processor_accepted=case when public.account_erasure_jobs.completed_at is not null then false else public.account_erasure_jobs.processor_accepted end,
      identity_deleted=false,completed_at=null,
      lease_token=case when public.account_erasure_jobs.completed_at is not null then null else public.account_erasure_jobs.lease_token end,
      lease_until=case when public.account_erasure_jobs.completed_at is not null then null else public.account_erasure_jobs.lease_until end,
      next_attempt_at=case when public.account_erasure_jobs.completed_at is not null then pg_catalog.clock_timestamp() else public.account_erasure_jobs.next_attempt_at end;
  perform public.fence_tutor_account_v1(p_user_id);
  select * into v_job from public.account_erasure_jobs where user_id=p_user_id;
  return pg_catalog.jsonb_build_object('kind',case when v_job.completed_at is null then 'pending' else 'completed' end);
end $$;
create function public.claim_account_erasure_v1() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_job public.account_erasure_jobs; v_now timestamptz:=pg_catalog.clock_timestamp();
begin
  select * into v_job from public.account_erasure_jobs where completed_at is null and next_attempt_at<=v_now
    and (lease_until is null or lease_until<=v_now) order by next_attempt_at,user_id limit 1 for update skip locked;
  if not found then return pg_catalog.jsonb_build_object('kind','idle'); end if;
  update public.account_erasure_jobs set lease_token=gen_random_uuid(),lease_until=v_now+interval '60 seconds',attempts=attempts+1
    where user_id=v_job.user_id returning * into v_job;
  return pg_catalog.jsonb_build_object('kind','claimed','userId',v_job.user_id,'lease',v_job.lease_token,
    'processorRequired',v_job.processor_required,'processorAccepted',v_job.processor_accepted,'identityDeleted',v_job.identity_deleted);
end $$;
create function public.advance_account_erasure_v1(p_user_id uuid,p_lease uuid,p_stage text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_job public.account_erasure_jobs; v_now timestamptz:=pg_catalog.clock_timestamp();
begin
  if p_user_id is null or p_lease is null or p_stage is null or p_stage not in ('processor-accepted','identity-deleted','processor-failed','identity-failed','storage-failed') then
    raise exception using errcode='PT400',message='invalid erasure result'; end if;
  select * into v_job from public.account_erasure_jobs where user_id=p_user_id for update;
  if not found or v_job.lease_token is distinct from p_lease or v_job.lease_until<=v_now or v_job.completed_at is not null then
    return pg_catalog.jsonb_build_object('kind','superseded'); end if;
  if p_stage='identity-deleted' and v_job.processor_required and not v_job.processor_accepted then
    raise exception using errcode='PT409',message='processor erasure pending'; end if;
  if p_stage='processor-accepted' then
    update public.account_erasure_jobs set processor_accepted=true where user_id=p_user_id;
  elsif p_stage='identity-deleted' then
    if exists(select 1 from auth.users where id=p_user_id) then raise exception using errcode='PT409',message='identity still exists'; end if;
    update public.account_erasure_jobs set identity_deleted=true,completed_at=v_now,lease_until=null,lease_token=null,last_failure=null where user_id=p_user_id;
  else
    update public.account_erasure_jobs set lease_until=null,lease_token=null,last_failure=split_part(p_stage,'-',1),
      next_attempt_at=v_now+pg_catalog.make_interval(secs=>least(3600,30*greatest(1,attempts))) where user_id=p_user_id;
  end if;
  return pg_catalog.jsonb_build_object('kind','recorded');
end $$;
revoke execute on function public.configure_privacy_processor_v1(boolean),public.begin_account_erasure_v1(uuid,boolean),public.claim_account_erasure_v1(),public.advance_account_erasure_v1(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.configure_privacy_processor_v1(boolean),public.begin_account_erasure_v1(uuid,boolean),public.claim_account_erasure_v1(),public.advance_account_erasure_v1(uuid,uuid,text) to service_role;
create table public.backend_worker_heartbeats (
  role text not null check(role in ('tutor','practice','maintenance')),
  worker_id uuid not null,
  ready boolean not null,
  received_at timestamptz not null,
  primary key(role,worker_id)
);
create index backend_worker_heartbeat_expiry on public.backend_worker_heartbeats(received_at);
alter table public.backend_worker_heartbeats enable row level security;
revoke all on public.backend_worker_heartbeats from public,anon,authenticated,service_role;
create function public.publish_backend_heartbeat_v1(p_role text,p_worker_id uuid,p_ready boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare stamp timestamptz:=pg_catalog.clock_timestamp();
begin
  if p_role is null or p_role not in ('tutor','practice','maintenance') or p_worker_id is null or p_ready is null then
    raise exception using errcode='PT400',message='invalid worker heartbeat'; end if;
  -- Serialize bounded fleet metadata, independently of money/admission locks.
  perform pg_catalog.pg_advisory_xact_lock(947201);
  delete from public.backend_worker_heartbeats where received_at<stamp-interval '2 minutes';
  if not exists(select 1 from public.backend_worker_heartbeats where role=p_role and worker_id=p_worker_id)
    and (select count(*) from public.backend_worker_heartbeats)>=300 then raise exception using errcode='PT429',message='worker heartbeat capacity'; end if;
  insert into public.backend_worker_heartbeats(role,worker_id,ready,received_at) values(p_role,p_worker_id,p_ready,stamp)
    on conflict(role,worker_id) do update set ready=excluded.ready,received_at=excluded.received_at;
  return pg_catalog.jsonb_build_object('kind','recorded','receivedAt',stamp);
end $$;
create function public.backend_status_v1() returns jsonb
language sql stable security definer set search_path='' as $$
  select pg_catalog.jsonb_build_object('version',1,
    'tutor',exists(select 1 from public.backend_worker_heartbeats where role='tutor' and ready and received_at>pg_catalog.statement_timestamp()-interval '60 seconds'),
    'practice',exists(select 1 from public.backend_worker_heartbeats where role='practice' and ready and received_at>pg_catalog.statement_timestamp()-interval '60 seconds'),
    'maintenance',exists(select 1 from public.backend_worker_heartbeats where role='maintenance' and ready and received_at>pg_catalog.statement_timestamp()-interval '60 seconds'),
    'erasurePending',(select count(*)::integer from public.account_erasure_jobs where completed_at is null),
    'erasureOldestSeconds',coalesce((select greatest(0,extract(epoch from pg_catalog.statement_timestamp()-requested_at))::integer from public.account_erasure_jobs where completed_at is null order by requested_at limit 1),0))
$$;
create index account_erasure_oldest_pending on public.account_erasure_jobs(requested_at) where completed_at is null;
revoke execute on function public.publish_backend_heartbeat_v1(text,uuid,boolean),public.backend_status_v1() from public,anon,authenticated;
grant execute on function public.publish_backend_heartbeat_v1(text,uuid,boolean),public.backend_status_v1() to service_role;
create function public.backend_catalog_v1() returns jsonb
language sql stable security definer set search_path='' as $$
  select pg_catalog.jsonb_build_object('version',1,
    'tables',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('schema',n.nspname,'name',c.relname,'rls',c.relrowsecurity,
      'anonSelect',pg_catalog.has_table_privilege('anon',c.oid,'SELECT'),'authenticatedSelect',pg_catalog.has_table_privilege('authenticated',c.oid,'SELECT')) order by n.nspname,c.relname),'[]')
      from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('public','luvani_private')),
    'policies',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p) order by p.schemaname,p.tablename,p.policyname),'[]') from pg_catalog.pg_policies p where p.schemaname in ('public','luvani_private')),
    'routines',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('schema',n.nspname,'name',p.proname,
      'arguments',pg_catalog.pg_get_function_identity_arguments(p.oid),'securityDefiner',p.prosecdef,'configuration',p.proconfig,
      'definitionMd5',pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)),
      'anonExecute',pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE'),'authenticatedExecute',pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')) order by n.nspname,p.proname,p.oid),'[]')
      from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','luvani_private')))
$$;
revoke execute on function public.backend_catalog_v1() from public,anon,authenticated;
grant execute on function public.backend_catalog_v1() to service_role;

-- Deletion and direct writers serialize on the auth parent. begin() takes UPDATE
-- before fencing; ordinary direct writes take KEY SHARE before their child rows.
-- The no-argument predicate exposes only the current caller's active status.
create function public.own_account_active_v1() returns boolean
language sql volatile security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from auth.users where id=auth.uid())
    and not exists(select 1 from luvani_private.tutor_account_fences where user_id=auth.uid())
$$;
revoke execute on function public.own_account_active_v1() from public,anon;
grant execute on function public.own_account_active_v1() to authenticated;
create or replace function luvani_private.admit_data_write_v1(p_user_id uuid, p_kind text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  stamp timestamptz := date_trunc('minute', clock_timestamp());
  today date := (clock_timestamp() at time zone 'UTC')::date;
  q luvani_private.data_write_quotas;
begin
  if p_kind is null or p_kind not in ('learner', 'event') or p_user_id is null then
    raise exception using errcode='22023', message='invalid data admission';
  end if;
  perform 1 from auth.users where id=p_user_id for key share;
  if not found then raise exception using errcode='42501', message='account is not active'; end if;
  if exists(select 1 from luvani_private.tutor_account_fences where user_id=p_user_id) then
    raise exception using errcode='42501',message='account is not active'; end if;
  insert into luvani_private.data_write_quotas(user_id, minute_started_at, day_started_at)
    values(p_user_id, stamp, today) on conflict(user_id) do nothing;
  select * into strict q from luvani_private.data_write_quotas where user_id=p_user_id for update;
  -- Compute the bucket after waiting, so a request queued across a minute/day
  -- boundary cannot reset a newer committed bucket back to its admission time.
  stamp := date_trunc('minute', clock_timestamp());
  today := (clock_timestamp() at time zone 'UTC')::date;
  if q.minute_started_at is distinct from stamp then
    q.minute_started_at := stamp; q.learner_minute := 0; q.events_minute := 0;
  end if;
  if q.day_started_at is distinct from today then
    q.day_started_at := today; q.learner_day := 0; q.events_day := 0;
  end if;
  if p_kind='learner' then
    if q.learner_minute >= 240 or q.learner_day >= 20000 then
      raise exception using errcode='PT429', message='learner write quota reached';
    end if;
    q.learner_minute := q.learner_minute+1; q.learner_day := q.learner_day+1;
  else
    if q.events_minute >= 60 or q.events_day >= 1000 then
      raise exception using errcode='PT429', message='product event quota reached';
    end if;
    q.events_minute := q.events_minute+1; q.events_day := q.events_day+1;
  end if;
  update luvani_private.data_write_quotas set minute_started_at=q.minute_started_at,
    day_started_at=q.day_started_at, learner_minute=q.learner_minute,
    learner_day=q.learner_day, events_minute=q.events_minute, events_day=q.events_day
    where user_id=p_user_id;
end; $$;
create or replace function luvani_private.lock_client_data_owner_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('role',true) in ('anon','authenticated') then
    if auth.uid() is null then raise exception using errcode='42501', message='account is not active'; end if;
    perform 1 from auth.users where id=auth.uid() for key share;
    if not found or exists(select 1 from luvani_private.tutor_account_fences where user_id=auth.uid()) then
      raise exception using errcode='42501',message='account is not active'; end if;
  end if;
  return null;
end; $$;
alter policy "learners read their own state" on public.learner_state using(auth.uid()=user_id and public.own_account_active_v1());
alter policy "learners insert their own state" on public.learner_state with check(auth.uid()=user_id and public.own_account_active_v1());
alter policy "learners update their own state" on public.learner_state using(auth.uid()=user_id and public.own_account_active_v1()) with check(auth.uid()=user_id and public.own_account_active_v1());
alter policy "learners delete their own state" on public.learner_state using(auth.uid()=user_id and public.own_account_active_v1());
alter policy "learners append their own events" on public.product_events with check(auth.uid()=user_id and public.own_account_active_v1());
alter policy "learners read their own entitlement" on public.entitlements using(auth.uid()=user_id and public.own_account_active_v1());
alter policy "learners read their own conversation packs" on public.conversation_packs using(auth.uid()=user_id and public.own_account_active_v1());
-- Public entry is the only client social path. Lock before dispatch's child DML;
-- revoke private dispatch to prevent direct invocation through another schema.
create or replace function public.luvani_social(action text,args jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception using errcode='42501',message='account is not active'; end if;
  perform 1 from auth.users where id=auth.uid() for key share;
  if not found or not public.own_account_active_v1() then raise exception using errcode='42501',message='account is not active'; end if;
  return luvani_private.social_dispatch(action,args);
end $$;
revoke execute on function luvani_private.social_dispatch(text,jsonb) from authenticated;

commit;
