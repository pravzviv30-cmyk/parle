-- DESTRUCTIVE: removes recovery jobs and deletion tombstones, not saved packs.
-- Stop the recovery worker and token API first; back up both queue tables.
-- Removing tombstones can allow a delayed receipt to recreate deleted learning data.
begin;
do $$ begin
  if current_setting('luvani.remove_practice_queue',true) is distinct from 'yes' then
    raise exception 'Refusing to remove the practice queue and privacy tombstones';
  end if;
end $$;
drop trigger if exists conversation_practice_deleted on public.conversation_packs;
drop function if exists public.tombstone_conversation_practice();
drop function if exists public.receive_conversation_practice(jsonb, boolean);
drop function if exists public.claim_conversation_practice();
drop function if exists public.finish_conversation_practice(uuid, uuid, jsonb);
drop index if exists public.conversation_practice_jobs_available_idx;
drop table if exists public.conversation_practice_jobs;
drop table if exists public.conversation_practice_tombstones;
commit;
