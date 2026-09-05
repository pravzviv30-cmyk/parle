-- DESTRUCTIVE rollback for 202609050001_learner_state_daily_namespaces.sql.
--
-- Narrowing the whitelist cannot succeed while a row uses a name being removed, so this
-- deletes those rows before it restores the twelve-name constraint. What that deletes is
-- every learner's saved situations and every half-finished scene, server side. The device
-- copies survive, because both stores are on-device first and the server is the second
-- copy, so a learner who never changes phone loses nothing they can see. A learner who
-- does, loses both. Take the backup named in supabase/README.md first.

delete from public.learner_state
  where namespace in ('bookmarks', 'scenarioProgress');

alter table public.learner_state
  drop constraint if exists learner_state_namespace_check;

alter table public.learner_state
  add constraint learner_state_namespace_check check (namespace in (
    'profile', 'history', 'review', 'drills', 'tutorIntro', 'activity',
    'friends', 'topics', 'journal', 'missions', 'coachMarks', 'soundChecks'
  ));
