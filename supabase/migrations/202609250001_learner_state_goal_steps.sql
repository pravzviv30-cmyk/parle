-- learner_state accepts `goalSteps`, the account-synced record that a conversation was
-- opened from one of the learner's goals (Stage 4).
--
-- The app merges `goalSteps` under apps/mobile/src/sync/policy.ts. Without this migration
-- every push of it is refused at the door with a 400 that sync/engine.ts files as
-- `http-error` and retries under backoff, exactly as F411 described for bookmarks: nothing
-- corrupts, and the goal steps stay on the phone they were made on.
--
-- What the namespace may hold is decided by the client's strict validator
-- (apps/mobile/src/goals/model.ts), exact about keys: a `step-started` row is the live
-- session id (which is also the conversation pack id), the goal's normalised key and a
-- task id such as `mission:cafe`; a `used-outside` row is the learner's own report that
-- they used that step outside the app, as `u.<step id>` and the goal key. No phrase, no
-- outcome, no count and no free text beyond the normalised goal key, which the profile
-- envelope already carries. Capped at sixty rows, far inside the 512 KiB envelope.
--
-- Same shape as 202609230001: the named constraint is dropped if present and added again
-- as a superset of the previous list, so validation of existing rows cannot fail and the
-- script is safe to re-run. Existing rows are untouched.
--
-- Account deletion needs nothing new here: learner_state.user_id already references
-- auth.users with on delete cascade.
--
-- NOT APPLIED to any project. Like every migration here it takes effect only once an
-- operator applies it. Rollback: supabase/rollback/202609250001_down.sql (DESTRUCTIVE).

alter table public.learner_state
  drop constraint if exists learner_state_namespace_check;

alter table public.learner_state
  add constraint learner_state_namespace_check check (namespace in (
    'profile', 'history', 'review', 'drills', 'tutorIntro', 'activity',
    'friends', 'topics', 'journal', 'missions', 'coachMarks', 'soundChecks',
    'bookmarks', 'scenarioProgress', 'practiceHistory', 'goalSteps'
  ));
