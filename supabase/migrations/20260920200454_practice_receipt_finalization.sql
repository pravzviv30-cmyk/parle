-- Explicit grants make a fresh database match the restored testing project.
grant select on public.conversation_packs to authenticated;
grant select,insert,update,delete on public.conversation_packs to service_role;

-- A late failed analyst must not erase successfully recovered exercises or
-- reset an exhausted job to a pending state that can never be claimed.
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
