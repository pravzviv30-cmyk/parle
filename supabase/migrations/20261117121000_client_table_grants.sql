-- F1080 (2026-11-17): the client roles keep only the table verbs their RLS policies use.
-- Hosted Supabase default privileges gave anon and authenticated ALL (TRUNCATE,
-- REFERENCES and TRIGGER included, none of which RLS gates) on the four tables the
-- early migrations created without an explicit grant. This revokes all from both roles,
-- then grants authenticated exactly its policy verbs: select on entitlements and
-- conversation_packs, select, insert, update and delete on learner_state, insert on
-- product_events. anon gets nothing; service_role and every policy are untouched.
-- The app's own direct call is learner_state (sync, return=representation); the token
-- server writes product_events and conversation_packs with the service role.
-- No data change, idempotent. Apply as a single file (migration 42 stays held); never
-- `supabase db push`.
begin;
set local lock_timeout='5s';
revoke all on public.conversation_packs, public.entitlements, public.learner_state, public.product_events from anon, authenticated;
grant select on public.entitlements, public.conversation_packs to authenticated;
grant select, insert, update, delete on public.learner_state to authenticated;
grant insert on public.product_events to authenticated;
commit;
