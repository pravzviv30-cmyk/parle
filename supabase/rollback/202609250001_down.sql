-- DESTRUCTIVE rollback for 202609250001_learner_state_goal_steps.sql.
--
-- Narrowing the whitelist cannot succeed while a row uses the name being removed, so this
-- deletes every server copy of a learner's goal steps (which conversations were opened
-- from a goal, and their own "used outside" reports) before it restores the fifteen-name
-- constraint. The device copies survive, because the store is on-device first; a learner
-- who changes phone loses that record. Take the backup named in supabase/README.md first.
-- Refuses to run until luvani.remove_goal_steps is set to 'yes' in the same session.

do $$begin
  if current_setting('luvani.remove_goal_steps', true) is distinct from 'yes' then
    raise exception 'Refusing to delete goalSteps rows. Take the backup, then set luvani.remove_goal_steps=yes explicitly.';
  end if;
end$$;

delete from public.learner_state
  where namespace = 'goalSteps';

alter table public.learner_state
  drop constraint if exists learner_state_namespace_check;

alter table public.learner_state
  add constraint learner_state_namespace_check check (namespace in (
    'profile', 'history', 'review', 'drills', 'tutorIntro', 'activity',
    'friends', 'topics', 'journal', 'missions', 'coachMarks', 'soundChecks',
    'bookmarks', 'scenarioProgress', 'practiceHistory'
  ));
