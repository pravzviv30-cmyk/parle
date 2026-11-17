-- DESTRUCTIVE rollback for 202609040001_conversation_packs.sql.
-- Removes durable learning packs. Take the backup named in supabase/README.md first.

do $$ begin
  if current_setting('luvani.remove_conversation_packs', true) is distinct from 'yes' then
    raise exception 'refusing to drop every conversation pack without explicit interlock';
  end if;
end $$;
drop policy if exists "learners read their own conversation packs" on public.conversation_packs;
drop index if exists public.conversation_packs_user_created_idx;
drop table if exists public.conversation_packs;
