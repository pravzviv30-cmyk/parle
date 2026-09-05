-- F411 — learner_state accepts the two namespaces the daily Home added.
--
-- 202608220001 wrote the namespace whitelist inline, as an unnamed check constraint
-- listing twelve names. That was right: a text column a client picks the value of is a
-- column a bug can fill with anything, and the whitelist is what keeps one learner's
-- state from becoming an open key-value store. It has one cost, which this migration
-- pays for the first time: every namespace the app adds has to be added here too, or
-- the app can merge it locally and never send it anywhere.
--
-- That is exactly what happened. `bookmarks` holds the situations a learner saved to
-- come back to; `scenarioProgress` holds how far into a guided scene they got, which is
-- what the tutor's resume card reads its minutes from. Both were given merge policies
-- in apps/mobile/src/sync/policy.ts and both converge correctly, and both were rejected
-- at the door with a 400 that sync/engine.ts files as `http-error` and retries under
-- backoff forever. Nothing corrupted and nothing on screen changed. The bookmarks just
-- stayed on one phone.
--
-- The constraint is recreated by name rather than altered, because there is no
-- `alter constraint` for a check and the original was never named. Postgres will have
-- called it `learner_state_namespace_check`; dropping `if exists` first means this runs
-- clean on a project that has it, on one that does not, and on one where it has already
-- run. Naming it explicitly means the next migration that needs a namespace can drop it
-- by a name that is in this repository rather than one Postgres chose.
--
-- Bounded and non-blocking in the way that matters: `not valid` is deliberately NOT used,
-- because the table holds at most a handful of rows per learner and a full validation
-- scan of a widened whitelist cannot fail — every value that satisfied the old list
-- satisfies the new one, which is a superset. Forward-compatible: a client that has never
-- heard of either namespace is unaffected, since nothing requires a row to exist.
--
-- Rollback: supabase/rollback/202609050001_down.sql. It is DESTRUCTIVE, and for a reason
-- that is worth reading before you run it: narrowing the list back cannot succeed while a
-- row uses one of the two names, so the down-script deletes those rows first. What that
-- costs is every learner's saved situations and every half-finished scene, server side.

alter table public.learner_state
  drop constraint if exists learner_state_namespace_check;

alter table public.learner_state
  add constraint learner_state_namespace_check check (namespace in (
    'profile', 'history', 'review', 'drills', 'tutorIntro', 'activity',
    'friends', 'topics', 'journal', 'missions', 'coachMarks', 'soundChecks',
    'bookmarks', 'scenarioProgress'
  ));
