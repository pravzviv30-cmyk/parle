-- Rollback for 20261026090000_practice_completion_signal.sql.
-- Restores receive_conversation_practice and finish_conversation_practice exactly
-- as 20261004003511 left them (a final pack counting only built-in translate
-- exercises completes its job again, and finish replaces the whole exercise list),
-- then drops the merge helper. Stored packs and jobs are untouched. Safe to run twice.
begin;
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
revoke all on function public.receive_conversation_practice(jsonb,boolean),
  public.finish_conversation_practice(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.receive_conversation_practice(jsonb,boolean),
  public.finish_conversation_practice(uuid,uuid,jsonb) to service_role;
drop function if exists luvani_private.practice_exercises_v1(jsonb,jsonb);
commit;
