-- Auth's restricted deletion role cannot insert into public service-only tables.
-- This tiny trigger elevates only the tombstone insert, never accepts caller input,
-- and uses an empty search path. App roles cannot call it directly.
create or replace function public.tombstone_conversation_practice() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.conversation_practice_tombstones(pack_id) values(old.id) on conflict do nothing;
  return old;
end $$;
revoke all on function public.tombstone_conversation_practice() from public,anon,authenticated;
grant execute on function public.tombstone_conversation_practice() to service_role;
