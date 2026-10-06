-- learner_state accepts `game`, the account-synced facts behind the streak, the daily
-- goal, daily quests and badges (Come alive, F729).
--
-- The app merges `game` under apps/mobile/src/sync/policy.ts. Without this migration
-- every push of it is refused at the door with a 400 that sync/engine.ts files as
-- `http-error` and retries under backoff, exactly as F411 described for bookmarks:
-- nothing corrupts, and the learner's streak covers, quest claims and badges stay on
-- the phone they were made on. Apply it before any build that writes `game` ships.
--
-- What the namespace may hold is decided by the client's strict reader
-- (apps/mobile/src/game/model.ts), exact about keys: finished sittings that earned no
-- XP (a moment, a source and an optional measured duration), streak covers (a day, a
-- kind of freeze, repair or travel, and a moment), the days the daily goal was met, the
-- three quest ids a day was dealt, quest claims and fixed "for practising" XP (ids,
-- days and numbers), monthly XP rollups, badge ids and celebration keys. No phrase, no
-- reply, no audio and no free text. Every list is aged or bounded, so a full blob stays
-- inside the 512 KiB envelope (game/model.test.ts measures the worst case).
--
-- `gameLocal` is device-only by design (SYNC_EXCLUSIONS) and is never pushed, so it is
-- not named here.
--
-- The account budget 20261003230215 asks every namespace addition to review: the
-- whitelist now allows seventeen rows per account, at most 8.5 MiB of compact JSON at
-- the 512 KiB row ceiling, still inside the 32 MiB account export snapshot.
--
-- Same shape as 202609250001: the named constraint is dropped if present and added again
-- as a superset of the previous list, so validation of existing rows cannot fail and the
-- script is safe to re-run. Existing rows are untouched.
--
-- Account deletion needs nothing new here: learner_state.user_id already references
-- auth.users with on delete cascade.
--
-- NOT APPLIED to any project. Like every migration here it takes effect only once an
-- operator applies it. Rollback: supabase/rollback/20261006120000_down.sql (DESTRUCTIVE).

alter table public.learner_state
  drop constraint if exists learner_state_namespace_check;

alter table public.learner_state
  add constraint learner_state_namespace_check check (namespace in (
    'profile', 'history', 'review', 'drills', 'tutorIntro', 'activity',
    'friends', 'topics', 'journal', 'missions', 'coachMarks', 'soundChecks',
    'bookmarks', 'scenarioProgress', 'practiceHistory', 'goalSteps', 'game'
  ));
