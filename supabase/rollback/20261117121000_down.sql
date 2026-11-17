-- Rollback for 20261117121000_client_table_grants.sql. REOPENS-F1080.
-- Restores the hosted Supabase default grants this migration removed: anon and
-- authenticated get ALL again on the four client tables, TRUNCATE included, guarded
-- by RLS alone. service_role and every policy are untouched. No data change, safe to
-- run twice. Refuses unless `set luvani.rollback_client_grants = 'yes'` ran first.
begin;
do $$ begin
  if current_setting('luvani.rollback_client_grants', true) is distinct from 'yes' then
    raise exception 'refusing to give the client roles every table privilege again without explicit interlock';
  end if;
end $$;
set local lock_timeout='5s';
grant all on public.conversation_packs, public.entitlements, public.learner_state, public.product_events to anon, authenticated;
commit;
