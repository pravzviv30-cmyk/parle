-- Reopens account-deletion failures under Supabase Auth's restricted role.
-- Prefer fixing forward. Stop account deletion before an explicitly approved rollback.
begin;
do $$ begin
  if current_setting('luvani.reopen_practice_delete',true) is distinct from 'yes' then
    raise exception 'Refusing to restore the account-deletion permission failure';
  end if;
end $$;
create or replace function public.tombstone_conversation_practice() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  insert into public.conversation_practice_tombstones(pack_id) values(old.id) on conflict do nothing;
  return old;
end $$;
commit;
