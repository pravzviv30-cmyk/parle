-- DESTRUCTIVE: removes all social connections, reports, settings and challenges.
-- Export first. This never removes learner_state or personal learning progress.
do $$begin
 if current_setting('luvani.remove_friends',true) is distinct from 'yes' then
  raise exception 'Refusing to remove Friends data. Export it, then set luvani.remove_friends=yes explicitly.';
 end if;
end$$;
drop function if exists public.luvani_social(text,jsonb);
drop function if exists luvani_private.social_dispatch(text,jsonb);
drop function if exists luvani_private.social_stats(uuid,timestamptz,timestamptz);
drop index if exists public.social_edge_pair;
drop index if exists public.social_edges_recipient;
drop index if exists public.social_edges_sender;
drop index if exists public.social_challenges_sender;
drop index if exists public.social_challenges_recipient;
drop index if exists public.social_notices_actor;
drop table if exists public.social_reactions;
drop table if exists public.social_notices;
drop table if exists public.social_challenges;
drop table if exists public.social_reports;
drop table if exists public.social_blocks;
drop table if exists public.social_edges;
drop table if exists public.social_profiles;
drop schema if exists luvani_private;
