-- Restore is allowed only before any detail erasure. Expired detail cannot be
-- invented or recovered by a rollback. Drain practice workers before this can
-- restore the prior less strict claim/finish/receipt bodies; prefer forward repair.
begin;
do $$ begin
  if pg_catalog.current_setting('luvani.rollback_session_details',true) is distinct from 'on' then
    raise exception 'detail retention rollback requires drained workers and explicit interlock'; end if;
  if exists(select 1 from luvani_private.session_detail_retention_config where enabled or ever_expired)
    or exists(select 1 from public.session_usage where seconds is null or details_expired_at is not null)
    or exists(select 1 from public.session_grants where checkpoint_seconds is null or checkpoint_learner_turns is null or details_expired_at is not null) then
    raise exception 'detail policy active or expiry evidence exists; use forward repair'; end if;
end $$;
create or replace function public.claim_conversation_practice()
returns table(pack_id uuid, lease_token uuid, payload jsonb)
language plpgsql security invoker set search_path = '' as $$
declare v_job public.conversation_practice_jobs;
begin
  update public.conversation_practice_jobs j set status='failed',lease_token=null,lease_until=null,updated_at=now()
    where j.status='running' and j.lease_until < now() and j.attempts >= 5;
  select j.* into v_job from public.conversation_practice_jobs j
    where j.attempts < 5 and
      ((j.status='pending' and j.available_at <= now()) or (j.status='running' and j.lease_until < now()))
    order by j.available_at for update skip locked limit 1;
  if not found then return; end if;
  update public.conversation_practice_jobs j set status='running',attempts=j.attempts+1,
    lease_token=gen_random_uuid(),lease_until=now()+interval '3 minutes',updated_at=now()
    where j.pack_id=v_job.pack_id returning j.* into v_job;
  return query select p.id,v_job.lease_token,p.payload from public.conversation_packs p where p.id=v_job.pack_id;
end $$;
create or replace function public.finish_conversation_practice(p_id uuid,p_lease uuid,p_exercises jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_job public.conversation_practice_jobs;
begin
  -- Consistent lock order with receipt: pack, then job.
  perform 1 from public.conversation_packs where id=p_id for update;
  if not found then return false; end if;
  select * into v_job from public.conversation_practice_jobs where pack_id=p_id for update;
  if not found or v_job.status <> 'running' or v_job.lease_token is distinct from p_lease or v_job.lease_until <= now() then return false; end if;
  if p_exercises is not null then
    if jsonb_typeof(p_exercises) <> 'array' or jsonb_array_length(p_exercises) > 24 then raise exception 'invalid exercises'; end if;
    update public.conversation_packs set payload=jsonb_set(payload,'{exercises}',p_exercises),updated_at=now() where id=p_id;
    update public.conversation_practice_jobs set status='complete',lease_token=null,lease_until=null,updated_at=now() where pack_id=p_id;
  else
    update public.conversation_practice_jobs set status=case when attempts>=5 then 'failed' else 'pending' end,
      available_at=now()+make_interval(secs=>least(3600,30*(2^attempts)::integer)),
      lease_token=null,lease_until=null,updated_at=now() where pack_id=p_id;
  end if;
  return true;
end $$;
create or replace function public.receive_conversation_practice(p_pack jsonb, p_final boolean)
returns void language plpgsql security invoker set search_path = '' as $$
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
revoke all on function public.receive_conversation_practice(jsonb,boolean),public.claim_conversation_practice(),public.finish_conversation_practice(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.receive_conversation_practice(jsonb,boolean),public.claim_conversation_practice(),public.finish_conversation_practice(uuid,uuid,jsonb) to service_role;
drop function if exists public.practice_job_active_v1(uuid,uuid);
drop function if exists public.reconcile_practice_jobs_v1(integer);
drop function if exists public.expire_session_details_v2(integer);
drop function if exists public.configure_session_detail_retention_v2(boolean);
drop index if exists public.session_usage_unknown_detail_due;
drop index if exists public.session_usage_details_due;
drop table if exists luvani_private.session_detail_retention_config;
alter table public.session_usage alter column seconds set not null;
alter table public.session_usage drop column details_expired_at;
alter table public.session_grants alter column checkpoint_seconds set not null;
alter table public.session_grants alter column checkpoint_learner_turns set not null;
alter table public.session_grants drop column details_expired_at;
commit;
