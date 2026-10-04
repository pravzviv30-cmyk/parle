-- Bounded, server-owned library reads. History is never deleted/truncated here.
begin;
create index conversation_packs_user_created_id_idx
  on public.conversation_packs(user_id,created_at desc,id desc);
-- The baseline validator already bounds128KiB. Expanded practice needs a
-- cumulative bound too. NOT VALID preserves exceptional historical rows while
-- requiring every future INSERT/UPDATE to remain independently readable.
alter table public.conversation_packs add constraint conversation_packs_bounded_payload
  check(pg_catalog.octet_length(payload::text)<=524288) not valid;

create function public.conversation_pack_page_v1(p_user_id uuid,p_after_created_at timestamptz default null,p_after_id uuid default null,p_pack_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare p record; rows_out jsonb:='[]'::jsonb; row_out jsonb; payload_bytes integer; rows_count integer:=0;
  next_cursor jsonb:=null; last_cursor jsonb; result_kind text:=case when p_pack_id is null then 'page' else 'pack' end;
begin
  if p_user_id is null or ((p_after_created_at is null) <> (p_after_id is null))
    or (p_pack_id is not null and p_after_id is not null) then
    raise exception using errcode='PT400',message='invalid conversation cursor';
  end if;
  -- Parent first: identity deletion/fencing cannot interleave this tenant read.
  perform 1 from auth.users u where u.id=p_user_id
    and (pg_catalog.to_jsonb(u)->>'deleted_at') is null
    and ((pg_catalog.to_jsonb(u)->>'banned_until') is null or (pg_catalog.to_jsonb(u)->>'banned_until')::timestamptz<=pg_catalog.clock_timestamp())
    for key share;
  if not found or exists(select 1 from luvani_private.tutor_account_fences f where f.user_id=p_user_id) then
    return pg_catalog.jsonb_build_object('version',1,'kind','inactive');
  end if;
  -- Each branch has a directly indexed tenant/keyset predicate. Materialize at
  -- most21 candidates, then select a nonempty prefix fitting the byte budget.
  for p in
    select chosen.* from (
      (select id,created_at,payload from public.conversation_packs where p_pack_id is not null and user_id=p_user_id and id=p_pack_id limit 1)
      union all
      (select id,created_at,payload from public.conversation_packs where p_pack_id is null and p_after_id is null and user_id=p_user_id order by created_at desc,id desc limit 21)
      union all
      (select id,created_at,payload from public.conversation_packs where p_pack_id is null and p_after_id is not null and user_id=p_user_id and (created_at,id)<(p_after_created_at,p_after_id) order by created_at desc,id desc limit 21)
    ) chosen order by chosen.created_at desc,chosen.id desc
  loop
    payload_bytes:=pg_catalog.octet_length(p.payload::text);
    row_out:=pg_catalog.jsonb_build_object('id',p.id,'createdAt',pg_catalog.to_char(p.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
    if (p_pack_id is null and payload_bytes>524288)
      or (p_pack_id is not null and pg_catalog.octet_length((row_out||pg_catalog.jsonb_build_object('payload',p.payload))::text)>1047552) then
      -- An exceptional historic entry stays visible and advances the cursor.
      -- Its full bytes remain in storage/export; no partial pack is invented.
      row_out:=row_out||pg_catalog.jsonb_build_object('payload',null,'unavailable','oversize','payloadBytes',payload_bytes);
    else row_out:=row_out||pg_catalog.jsonb_build_object('payload',p.payload); end if;
    if rows_count>=20 or pg_catalog.octet_length((rows_out||pg_catalog.jsonb_build_array(row_out))::text)>1047552 then
      next_cursor:=last_cursor; exit;
    end if;
    rows_out:=rows_out||pg_catalog.jsonb_build_array(row_out); rows_count:=rows_count+1;
    last_cursor:=pg_catalog.jsonb_build_object('createdAt',row_out->>'createdAt','packId',p.id);
  end loop;
  return pg_catalog.jsonb_build_object('version',1,'kind',result_kind,'rows',rows_out,'nextCursor',next_cursor);
end $$;
revoke execute on function public.conversation_pack_page_v1(uuid,timestamptz,uuid,uuid) from public,anon,authenticated;
grant execute on function public.conversation_pack_page_v1(uuid,timestamptz,uuid,uuid) to service_role;
commit;
