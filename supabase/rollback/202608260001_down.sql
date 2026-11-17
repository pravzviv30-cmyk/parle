-- Rollback for supabase/migrations/202608260001_learner_state_revision.sql
--
-- Removes the ordering primitive the device sync engine compares against. Read the two
-- paragraphs below before pasting; the cost is unusual in that it is an outage rather
-- than a corruption.
--
-- What breaks: every synced device stops being able to write. The client's push is a
-- compare-and-swap, `PATCH ...&revision=eq.<n>`, and PostgREST answers a filter on a
-- column that no longer exists with 42703 rather than with rows. So the failure is
-- loud, immediate and fails **closed** — nothing is silently overwritten, nothing is
-- merged wrongly, and no learner's state is lost. Devices queue their changes and retry
-- with backoff until the column is back. It still stops every synced write and drops a
-- column re-applying cannot refill, so since F1081 it runs in one transaction and refuses
-- unless `luvani.remove_state_revision` is set to `yes` in the same session.
--
-- What is lost: the revision counters themselves. They are derived bookkeeping — how
-- many times each row has been written — and hold no learner content, so dropping them
-- destroys no learning. Re-applying the migration starts every row again at 0, which is
-- correct: no device can hold a revision from before the column existed either, and the
-- first push after a re-apply is a fresh compare-and-swap against 0.
--
-- What is not restored: `updated_at`. Before 202608260001 nothing advanced it on update,
-- so it recorded when a row was created and not when it last changed. Dropping the
-- trigger reinstates that, and the timestamps written while the trigger was live stay as
-- they are. Nothing reads `updated_at` for a decision; `revision` orders and `savedAt`
-- inside the payload envelope breaks ties.
--
-- Take the backup in supabase/README.md § Backup first, because `alter table ... drop
-- column` cannot be undone by re-running the migration — it can only be re-added empty.
--
-- Idempotent and retryable: every statement is `if exists`, so a half-finished paste can
-- be pasted again. The order is the reverse of creation — trigger, then the function it
-- calls, then the column both maintain — so nothing is left calling something that has
-- already gone.

begin;
do $$ begin
  if current_setting('luvani.remove_state_revision', true) is distinct from 'yes' then
    raise exception 'refusing to remove the learner state revision without explicit interlock';
  end if;
end $$;
drop trigger if exists learner_state_revision_bump on public.learner_state;

drop function if exists public.learner_state_bump_revision();

alter table public.learner_state
  drop column if exists revision;
commit;
