-- DESTRUCTIVE rollback for 202609230001_learner_state_practice_history.sql.
--
-- Narrowing the whitelist cannot succeed while a row uses the name being removed, so this
-- deletes every server copy of a learner's completed conversation-practice history before
-- it restores the fourteen-name constraint. The device copies survive, because the store is
-- on-device first; a learner who changes phone loses that history. Take the backup named in
-- supabase/README.md first. Refuses to run until luvani.remove_practice_history is set to
-- 'yes' in the same session.

do $$begin
  if current_setting('luvani.remove_practice_history', true) is distinct from 'yes' then
    raise exception 'Refusing to delete practiceHistory rows. Take the backup, then set luvani.remove_practice_history=yes explicitly.';
  end if;
end$$;

delete from public.learner_state
  where namespace = 'practiceHistory';

alter table public.learner_state
  drop constraint if exists learner_state_namespace_check;

alter table public.learner_state
  add constraint learner_state_namespace_check check (namespace in (
    'profile', 'history', 'review', 'drills', 'tutorIntro', 'activity',
    'friends', 'topics', 'journal', 'missions', 'coachMarks', 'soundChecks',
    'bookmarks', 'scenarioProgress'
  ));
