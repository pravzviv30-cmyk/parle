-- learner_state accepts `practiceHistory`, the account-synced record of completed
-- conversation practice.
--
-- The app merges `practiceHistory` under apps/mobile/src/sync/policy.ts. Without this
-- migration every push of it is refused at the door with a 400 that sync/engine.ts files as
-- `http-error` and retries under backoff, exactly as F411 described for bookmarks: nothing
-- corrupts, and the history stays on the phone it was made on.
--
-- What the namespace may hold is decided by the client's strict validator
-- (apps/mobile/src/practice/history.ts): ids, times, source links and at most six
-- per-target outcomes per sitting, capped at 150 events. No answer text, transcript or
-- audio has a field. The envelope ceiling (512 KiB) is enforced by the client as for every
-- other namespace.
--
-- `practiceSession` is deliberately NOT added: it is device-local and excluded from sync
-- with a written reason in SYNC_EXCLUSIONS.
--
-- Same shape as 202609050001: the named constraint is dropped if present and added again
-- as a superset of the previous list, so validation of existing rows cannot fail and the
-- script is safe to re-run. Existing rows are untouched.
--
-- Account deletion needs nothing new here: learner_state.user_id already references
-- auth.users with on delete cascade.
--
-- NOT APPLIED to any project. Like every migration here it takes effect only once an
-- operator applies it. Rollback: supabase/rollback/202609230001_down.sql (DESTRUCTIVE).

alter table public.learner_state
  drop constraint if exists learner_state_namespace_check;

alter table public.learner_state
  add constraint learner_state_namespace_check check (namespace in (
    'profile', 'history', 'review', 'drills', 'tutorIntro', 'activity',
    'friends', 'topics', 'journal', 'missions', 'coachMarks', 'soundChecks',
    'bookmarks', 'scenarioProgress', 'practiceHistory'
  ));
