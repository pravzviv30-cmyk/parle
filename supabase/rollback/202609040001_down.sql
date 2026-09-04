-- DESTRUCTIVE rollback for 202609040001_conversation_packs.sql.
-- Removes durable learning packs. Take the backup named in supabase/README.md first.

drop policy if exists "learners read their own conversation packs" on public.conversation_packs;
drop index if exists public.conversation_packs_user_created_idx;
drop table if exists public.conversation_packs;
