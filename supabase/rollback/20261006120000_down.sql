-- DESTRUCTIVE rollback for 20261006120000_learner_state_game.sql.
--
-- Narrowing the whitelist cannot succeed while a row uses the name being removed, so this
-- deletes every server copy of a learner's game facts (streak covers, quest claims, fixed
-- XP, monthly rollups, badges and the celebrations already played) before it restores the
-- sixteen-name constraint. The device copies survive, because the store is on-device
-- first; a learner who changes phone loses their covers and badges. Roll back the builds
-- that write `game` first, or every push of it is refused again. Take the backup named in
-- supabase/README.md first.
-- Refuses to run until luvani.remove_game is set to 'yes' in the same session.
--
-- Owns its transaction, so a refused interlock aborts the delete and the constraint change
-- too, even under a client that keeps going after an error (psql without ON_ERROR_STOP).
-- Without it, the refusal would raise and the next statement would delete the rows anyway.
-- scripts/verifyDataBoundaries.mjs proves the refusal, the delete scoped to `game` and a
-- clean re-apply in disposable SQL.

begin;

do $$begin
  if current_setting('luvani.remove_game', true) is distinct from 'yes' then
    raise exception 'Refusing to delete game rows. Take the backup, then set luvani.remove_game=yes explicitly.';
  end if;
end$$;

delete from public.learner_state
  where namespace = 'game';

alter table public.learner_state
  drop constraint if exists learner_state_namespace_check;

alter table public.learner_state
  add constraint learner_state_namespace_check check (namespace in (
    'profile', 'history', 'review', 'drills', 'tutorIntro', 'activity',
    'friends', 'topics', 'journal', 'missions', 'coachMarks', 'soundChecks',
    'bookmarks', 'scenarioProgress', 'practiceHistory', 'goalSteps'
  ));

commit;
