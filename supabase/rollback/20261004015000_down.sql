-- Operator rollback after the paged API is drained; preserves every history row.
begin;
do $$begin
  if current_setting('luvani.rollback_conversation_library',true) is distinct from 'on' then
    raise exception 'Set luvani.rollback_conversation_library=on after draining the paged API';
  end if;
end $$;
drop function public.conversation_pack_page_v1(uuid,timestamptz,uuid,uuid);
drop index public.conversation_packs_user_created_id_idx;
alter table public.conversation_packs drop constraint conversation_packs_bounded_payload;
commit;
