-- Detail TTL is separate from permanent financial/replay proof. OFF until the
-- reviewed policy and reader canary activate it. Unknown legacy amounts remain.
begin;
alter table public.session_usage alter column seconds drop not null;
alter table public.session_usage add column details_expired_at timestamptz;
alter table public.session_grants alter column checkpoint_seconds drop not null;
alter table public.session_grants alter column checkpoint_learner_turns drop not null;
alter table public.session_grants add column details_expired_at timestamptz;
create index session_usage_details_due on public.session_usage(reported_at,user_id,session_id)
  where details_expired_at is null and charged_seconds is not null and usage_epoch is not null;
create index session_usage_unknown_detail_due on public.session_usage(reported_at,session_id)
  where details_expired_at is null and (charged_seconds is null or usage_epoch is null);
create table luvani_private.session_detail_retention_config (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  ever_expired boolean not null default false
);
insert into luvani_private.session_detail_retention_config(singleton) values(true);
alter table luvani_private.session_detail_retention_config enable row level security;
revoke all on luvani_private.session_detail_retention_config from public,anon,authenticated,service_role;
create function public.configure_session_detail_retention_v2(p_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if p_enabled is null then raise exception using errcode='PT400',message='retention configuration required'; end if;
  update luvani_private.session_detail_retention_config set enabled=p_enabled where singleton;
  return pg_catalog.jsonb_build_object('version',2,'enabled',p_enabled,'months',24);
end $$;
create function public.expire_session_details_v2(p_batch_size integer default 100) returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare candidate record; e public.entitlements; g public.session_grants; u public.session_usage;
  stamp timestamptz; expired integer:=0; unknown_due bigint; ready boolean;
begin
  if p_batch_size is null or p_batch_size not between 1 and 1000 then
    raise exception using errcode='PT400',message='invalid detail retention batch'; end if;
  select enabled into ready from luvani_private.session_detail_retention_config where singleton;
  if not coalesce(ready,false) then return pg_catalog.jsonb_build_object('version',2,'kind','disabled','detailsExpired',0); end if;
  stamp:=pg_catalog.clock_timestamp();
  -- Unknown legacy proof is an explicit exception, never ahead of known rows in
  -- LIMIT. No child is locked before auth parent -> entitlement -> grant -> usage.
  for candidate in select usage.user_id,usage.session_id from public.session_usage usage
    join public.session_grants grant_row on grant_row.session_id=usage.session_id and grant_row.user_id=usage.user_id
    where usage.details_expired_at is null and usage.reported_at<stamp-interval '24 months'
      and usage.charged_seconds is not null and usage.usage_epoch is not null
      and (grant_row.lifecycle_version=0 or (grant_row.completion_receipt is not null and grant_row.state in ('settled','interrupted','cancelled','expired')))
    order by usage.user_id,usage.session_id limit p_batch_size loop
    perform 1 from auth.users where id=candidate.user_id for key share skip locked;
    if not found then continue; end if;
    select * into e from public.entitlements where user_id=candidate.user_id for update skip locked;
    if not found then continue; end if;
    select * into g from public.session_grants where session_id=candidate.session_id and user_id=candidate.user_id for update skip locked;
    if not found or (g.lifecycle_version=1 and (g.completion_receipt is null or g.state not in ('settled','interrupted','cancelled','expired'))) then continue; end if;
    -- Non-key expiry does not block the KEY SHARE existence check used by saved
    -- text/audio readers before those readers ask for entitlement/pack locks.
    select * into u from public.session_usage where session_id=candidate.session_id and user_id=candidate.user_id for no key update skip locked;
    if not found or u.details_expired_at is not null or u.reported_at>=stamp-interval '24 months'
      or u.charged_seconds is null or u.usage_epoch is null then continue; end if;
    update public.session_usage set seconds=null,details_expired_at=stamp where session_id=u.session_id;
    if g.lifecycle_version=1 then
      update public.session_grants set checkpoint_seconds=null,checkpoint_learner_turns=null,checkpoint_baseline=null,details_expired_at=stamp where session_id=g.session_id;
    end if;
    expired:=expired+1;
  end loop;
  -- The financial charge/epoch/refund, completion identity/digests/receipt and
  -- grant/deadline timestamps stay byte-for-byte intact. Hashes can still be
  -- account-linked; this is not semantic erasure of every duration inference.
  if expired>0 then update luvani_private.session_detail_retention_config set ever_expired=true where singleton; end if;
  select count(*) into unknown_due from(select session_id from public.session_usage where details_expired_at is null and reported_at<stamp-interval '24 months'
    and (charged_seconds is null or usage_epoch is null) order by reported_at,session_id limit 1001) sample;
  return pg_catalog.jsonb_build_object('version',2,'kind','expired','detailsExpired',expired,'unknownLegacyDue',least(1000,unknown_due),'unknownLegacyDueCapped',unknown_due>1000,
    'perBatchLimit',p_batch_size,'ranAt',stamp);
end $$;

-- Recheck before provider dispatch and while work is running. Only the trusted
-- worker can call this; an opaque lease is never an app credential.
create function public.practice_job_active_v1(p_pack_id uuid,p_lease uuid) returns boolean
language sql volatile security definer set search_path='' as $$
  select p_pack_id is not null and p_lease is not null and exists(
    select 1 from public.conversation_practice_jobs j join public.conversation_packs p on p.id=j.pack_id
      join auth.users u on u.id=p.user_id
    where j.pack_id=p_pack_id and j.status='running' and j.lease_token=p_lease and j.lease_until>pg_catalog.clock_timestamp()
      and p.state='ready' and not exists(select 1 from luvani_private.tutor_account_fences f where f.user_id=p.user_id)
      and not exists(select 1 from public.conversation_practice_tombstones t where t.pack_id=p.id))
$$;
create function public.reconcile_practice_jobs_v1(p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path='' as $$
declare candidate record; job public.conversation_practice_jobs; ended integer:=0;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception using errcode='PT400',message='invalid practice maintenance batch'; end if;
  for candidate in select p.user_id,j.pack_id from public.conversation_practice_jobs j join public.conversation_packs p on p.id=j.pack_id
    where j.status='running' and j.attempts>=5 and j.lease_until<=pg_catalog.clock_timestamp()
    order by p.user_id,j.pack_id limit p_limit loop
    perform 1 from auth.users where id=candidate.user_id for key share skip locked;
    if not found then continue; end if;
    perform 1 from public.conversation_packs where id=candidate.pack_id for update skip locked;
    if not found then continue; end if;
    select * into job from public.conversation_practice_jobs where pack_id=candidate.pack_id for update skip locked;
    if not found or job.status<>'running' or job.attempts<5 or job.lease_until>pg_catalog.clock_timestamp() then continue; end if;
    update public.conversation_practice_jobs set status='failed',lease_token=null,lease_until=null,updated_at=pg_catalog.clock_timestamp() where pack_id=job.pack_id;
    ended:=ended+1;
  end loop;
  return pg_catalog.jsonb_build_object('kind','reconciled','exhaustedJobsEnded',ended,'limit',p_limit);
end $$;
create or replace function public.claim_conversation_practice()
returns table(pack_id uuid,lease_token uuid,payload jsonb)
language plpgsql security definer set search_path='' as $$
declare candidate record; job public.conversation_practice_jobs;
begin
  -- Claim never performs the former unbounded UPDATE of every exhausted job.
  -- Active/exhausted/fenced owners are excluded before the bounded candidate list.
  for candidate in select p.user_id,j.pack_id from public.conversation_practice_jobs j join public.conversation_packs p on p.id=j.pack_id
    where p.state='ready' and j.attempts<5 and ((j.status='pending' and j.available_at<=pg_catalog.clock_timestamp())
      or (j.status='running' and j.lease_until<=pg_catalog.clock_timestamp()))
      and exists(select 1 from auth.users u where u.id=p.user_id)
      and not exists(select 1 from luvani_private.tutor_account_fences f where f.user_id=p.user_id)
      and not exists(select 1 from public.conversation_practice_tombstones t where t.pack_id=p.id)
    order by j.available_at,j.pack_id limit 100 loop
    perform 1 from auth.users where id=candidate.user_id for key share skip locked;
    if not found then continue; end if;
    perform 1 from public.conversation_packs p where p.id=candidate.pack_id and p.state='ready' for update skip locked;
    if not found or exists(select 1 from luvani_private.tutor_account_fences f where f.user_id=candidate.user_id) then continue; end if;
    select * into job from public.conversation_practice_jobs j where j.pack_id=candidate.pack_id for update skip locked;
    if not found or job.attempts>=5 or not ((job.status='pending' and job.available_at<=pg_catalog.clock_timestamp())
      or (job.status='running' and job.lease_until<=pg_catalog.clock_timestamp())) then continue; end if;
    update public.conversation_practice_jobs j set status='running',attempts=j.attempts+1,
      lease_token=gen_random_uuid(),lease_until=pg_catalog.clock_timestamp()+interval '180 seconds',updated_at=pg_catalog.clock_timestamp()
      where j.pack_id=job.pack_id returning j.* into job;
    return query select p.id,job.lease_token,p.payload from public.conversation_packs p where p.id=job.pack_id;
    return;
  end loop;
end $$;
create or replace function public.receive_conversation_practice(p_pack jsonb, p_final boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := (p_pack->>'id')::uuid;
  v_owner uuid := (p_pack->>'learnerId')::uuid;
  v_existing public.conversation_packs;
  v_payload jsonb := p_pack;
  v_complete boolean := jsonb_array_length(coalesce(p_pack->'exercises','[]'::jsonb)) > 0;
begin
  if v_id is null or v_owner is null or p_final is null or
    (p_pack->>'sessionId')::uuid is distinct from v_id or p_pack->>'state' is distinct from 'ready' then
    raise exception 'invalid practice receipt';
  end if;
  perform 1 from auth.users where id=v_owner for key share;
  if not found or exists(select 1 from luvani_private.tutor_account_fences where user_id=v_owner) then
    raise exception using errcode='PT409',message='inactive practice owner'; end if;
  -- Serialise receipts, including simultaneous first receipts with absent rows.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_id::text, 0));
  select * into v_existing from public.conversation_packs where id = v_id for update;
  if found and v_existing.user_id <> v_owner then raise exception 'pack owner mismatch'; end if;
  -- Deletion uses the row lock; check the tombstone after acquiring that lock.
  if exists(select 1 from public.conversation_practice_tombstones where pack_id=v_id) then return; end if;
  if v_existing.id is not null and not p_final then return; end if;
  if not v_complete and jsonb_array_length(coalesce(v_existing.payload->'exercises','[]'::jsonb)) > 0 then
    v_payload := jsonb_set(v_payload,'{exercises}',v_existing.payload->'exercises');
    v_complete := true;
  end if;
  insert into public.conversation_packs(id,session_id,user_id,state,payload,created_at)
    values(v_id,v_id,v_owner,'ready',v_payload,(p_pack->>'createdAt')::timestamptz)
    on conflict(id) do update set payload=excluded.payload, state='ready', updated_at=now();
  insert into public.conversation_practice_jobs(pack_id,status,available_at)
    values(v_id,case when p_final and v_complete then 'complete' else 'pending' end,now() + interval '2 minutes')
    on conflict(pack_id) do update set status=case
      when v_complete then 'complete'
      when public.conversation_practice_jobs.attempts >= 5 then 'failed'
      else 'pending' end,
      available_at=excluded.available_at, lease_token=null, lease_until=null, updated_at=now();
end $$;
create or replace function public.finish_conversation_practice(p_id uuid,p_lease uuid,p_exercises jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_job public.conversation_practice_jobs; v_owner uuid;
begin
  select user_id into v_owner from public.conversation_packs where id=p_id;
  if not found then return false; end if;
  perform 1 from auth.users where id=v_owner for key share skip locked;
  if not found or exists(select 1 from luvani_private.tutor_account_fences where user_id=v_owner) then return false; end if;
  -- Parent -> pack -> job, matching receipt and claim without child-first waits.
  perform 1 from public.conversation_packs where id=p_id and user_id=v_owner and state='ready' for update skip locked;
  if not found or exists(select 1 from public.conversation_practice_tombstones where pack_id=p_id) then return false; end if;
  select * into v_job from public.conversation_practice_jobs where pack_id=p_id for update skip locked;
  if not found or v_job.status <> 'running' or v_job.lease_token is distinct from p_lease or v_job.lease_until <= pg_catalog.clock_timestamp() then return false; end if;
  if p_exercises is not null then
    if jsonb_typeof(p_exercises) <> 'array' or jsonb_array_length(p_exercises) > 24 then raise exception 'invalid exercises'; end if;
    update public.conversation_packs set payload=jsonb_set(payload,'{exercises}',p_exercises),updated_at=pg_catalog.clock_timestamp() where id=p_id;
    update public.conversation_practice_jobs set status='complete',lease_token=null,lease_until=null,updated_at=pg_catalog.clock_timestamp() where pack_id=p_id;
  else
    update public.conversation_practice_jobs set status=case when attempts>=5 then 'failed' else 'pending' end,
      available_at=pg_catalog.clock_timestamp()+make_interval(secs=>least(3600,30*(2^attempts)::integer)),
      lease_token=null,lease_until=null,updated_at=pg_catalog.clock_timestamp() where pack_id=p_id;
  end if;
  return true;
end $$;
revoke all on function public.configure_session_detail_retention_v2(boolean),public.expire_session_details_v2(integer),
  public.practice_job_active_v1(uuid,uuid),public.reconcile_practice_jobs_v1(integer),public.claim_conversation_practice(),
  public.receive_conversation_practice(jsonb,boolean),public.finish_conversation_practice(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.configure_session_detail_retention_v2(boolean),public.expire_session_details_v2(integer),
  public.practice_job_active_v1(uuid,uuid),public.reconcile_practice_jobs_v1(integer),public.claim_conversation_practice(),
  public.receive_conversation_practice(jsonb,boolean),public.finish_conversation_practice(uuid,uuid,jsonb) to service_role;
commit;
