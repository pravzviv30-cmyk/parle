# Supabase runbook

Everything Parle keeps about a learner lives in five tables and three functions here. This
file is how they get applied, backed up, rolled back and proved, by hand, from the SQL
Editor.

By hand is not a preference. There is no Supabase CLI, no Docker and no `psql` on the
machine this repo is developed on, and DDL does not travel over PostgREST — the service
role can read and write rows all day and still cannot create a table. So the apply path
is a paste, and the discipline has to come from the order and the checks below rather
than from a tool.

**What must never be in these tables:** raw audio, and full transcripts. Nothing in the
schema stores either today. `product_events` is content-free by database trigger, and
`trial_installations` holds two deployment-salted HMACs and no advertising id, email,
Supabase uid or raw install id. Adding a column that carries speech is a policy decision,
not a schema decision — see `docs/PRIVACY_AND_SAFETY.md`.

## Apply

Paste these into the SQL Editor **in this order**, one file per run, and read the result
of each before starting the next. Each file is idempotent: every create is
`if not exists` or `create or replace`, so a partial run is safe to repeat.

| # | File | What it adds |
|---|---|---|
| 1 | `migrations/202608220001_parle_learning.sql` | `learner_state`, `product_events`, `entitlements`, their RLS policies, and the first `consume_entitlement(uuid, integer)` |
| 2 | `migrations/202608230001_session_usage_idempotency.sql` | `session_usage`, `trial_installations`, `claim_trial`, the session-aware `consume_entitlement(uuid, integer, uuid)`, and the `product_events` validation trigger. Drops the two-argument debit |
| 3 | `migrations/202608240001_claim_trial_null_fix.sql` | F73: the NULL-safe refusal guard in `claim_trial`. Replaces one function body, touches no rows |
| 4 | `migrations/202608250001_consume_entitlement_null_fix.sql` | F74: the same NULL-safe guard in `consume_entitlement`, so a retried session bills once and a foreign session id is refused. Replaces one function body, touches no rows |
| 5 | `migrations/202608250002_product_event_key_count_fix.sql` | F75: counts event properties with `jsonb_object_keys` instead of `jsonb_object_length`, which does not exist. Replaces one function body, leaves the trigger in place, touches no rows |
| 6 | `migrations/202608260001_learner_state_revision.sql` | F84: `learner_state.revision`, the ordering primitive the device sync engine compares against, plus the trigger that advances it and stamps `updated_at`. Adds one column with a constant default, changes no policy, touches no payload |

Order is load-bearing in one direction only: everything after 1 names tables and
functions that 1 creates, so 1 first. Files 3, 4 and 5 are each a single `create or
replace function`, so running any of them twice, or running them immediately after 2,
is fine, and they do not depend on one another.

Files 3, 4 and 5 all close the same mistake in three different functions: `insert ...
on conflict do nothing returning true into <flag>` leaves the flag NULL rather than
false, and `not NULL` is NULL, so a plpgsql `if` on it takes neither branch. If you are
adding another migration that writes a guard like this, write `<flag> is not true`.

After the last paste, reload the API schema cache (Settings → API → Reload, or wait a few
seconds) or PostgREST will keep answering `PGRST205 could not find the table` for tables
that now exist.

Then prove it, rather than assuming it:

```
node --experimental-strip-types services/token-server/src/verify/supabaseLive.ts
```

The anon client it builds is never signed in — the whole point of `anon-key-refused` is
that a bare publishable key reads and writes nothing, and a client that has signed in
once keeps its session and travels as `authenticated` from then on.

It needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
in `services/token-server/.env`, prints `BLOCKED:` naming anything missing, names any
table or function the schema is still short of, and runs twelve proofs — RLS isolation
between two real accounts, anon and forged-id refusal, RPC privilege, the period roll,
debit concurrency, session replay, cross-user session rejection, both trial-refusal arms,
the trial race, the product-event trigger and the deletion cascade. It creates its own
throwaway accounts and deletes them again. Point it at a disposable project, never at one
holding real learners.

## Backup

Take one before anything in `## Rollback` and before any migration that is not simply
`create or replace function`. Two ways, in order of preference:

1. **Dashboard → Database → Backups → Download**. On a paid project this is a real
   point-in-time restore; on free it is a daily snapshot, which is not the same promise.
   Note the timestamp you are trusting.
2. **Table export.** Dashboard → Table Editor → each of `learner_state`,
   `product_events`, `entitlements`, `session_usage`, `trial_installations` → Export CSV.
   Slow and manual, but it is the only copy that exists on a free project between
   snapshots, and it is enough to reconstruct every row Parle owns.

Record what you took and when, in the incident note or the PR. A backup nobody can date
is a backup nobody can restore from.

`auth.users` is not yours to export casually: it holds email addresses. Back it up only
when a restore genuinely needs it, and never into this repo.

## Restore

1. Stop the token server, or the debit path will keep writing into a database you are
   about to overwrite.
2. Restore the snapshot from Dashboard → Database → Backups, or re-import the CSVs in
   dependency order: `entitlements`, `learner_state`, `product_events` (they reference
   `auth.users`), then `session_usage`, then `trial_installations`.
3. Reload the API schema cache.
4. Run the harness above. A restore that has not been verified is a hope.

`trial_installations` is the row set most likely to be quietly wrong after a restore: it
deliberately outlives accounts, so an older snapshot silently hands devices a second
trial. Check its row count against what you expect before reopening signups.

## Rollback

Down-scripts live in `rollback/`, one per migration, each naming every object its
migration created. Apply them in **reverse** order — newest first — because each one
depends on what the earlier ones built.

| Rolling back | Script | Cost |
|---|---|---|
| `202608260001_learner_state_revision.sql` | `rollback/202608260001_down.sql` | Every synced device stops being able to write: the compare-and-swap filters on a column that no longer exists, so PostgREST answers 42703 and the push queues instead of landing. Fails closed, loses no learner content, and cannot be undone by re-applying — the counters come back at 0 |
| `202608250002_product_event_key_count_fix.sql` | `rollback/202608250002_down.sql` | Reopens F75. Every product event write fails again, silently. Refuses to run until you set `parle.reopen_f75` in the same session |
| `202608250001_consume_entitlement_null_fix.sql` | `rollback/202608250001_down.sql` | Reopens F74. A retried `/session/end` bills a learner twice and a foreign session id merges. Refuses to run until you set `parle.reopen_f74` in the same session |
| `202608240001_claim_trial_null_fix.sql` | `rollback/202608240001_down.sql` | Reopens F73. Refuses to run until you set `parle.reopen_f73` in the same session |
| `202608230001_session_usage_idempotency.sql` | `rollback/202608230001_down.sql` | Destroys the exactly-once billing ledger and the antifraud evidence. Restores the two-argument debit |
| `202608220001_parle_learning.sql` | `rollback/202608220001_down.sql` | Destroys every learner row Parle owns |

The three interlocked rows are the ones to argue with. Each adds no table, no column and
no row; each only stops one function doing the wrong thing. If something looks broken after
applying one of them, fix forward with a new migration. Rolling one back restores a known
defect, which is why each script makes you say so out loud in the same paste:

```sql
set local parle.reopen_f75 = 'yes-i-accept-losing-every-product-event';
set local parle.reopen_f74 = 'yes-i-accept-double-billing-on-retry';
set local parle.reopen_f73 = 'yes-i-accept-unbounded-trial-farming';
```

`202608240001_down.sql` is the most expensive of the three: it restores a function that
grants a fresh trial to every device that asks twice, at roughly $2.20 of vendor spend
each. `202608250001_down.sql` spends a learner's own metered minutes instead of the
company's, which is worse in kind if not in dollars.

The last two rows destroy data. Take the backup first, and escalate rather than paste if
the project has real accounts on it.

## Rollback evidence

"We can roll back" is a claim, and this is how it becomes evidence. Do it on a disposable
project, and keep the output:

1. Apply all six migrations. Run the harness. Record: twelve proofs, all passed.
2. Note the row counts of all five tables (`select count(*) from public.<table>;`).
3. Take the backup from `## Backup`, and record its timestamp.
4. Apply `rollback/202608240001_down.sql` with the interlock set. Re-run the harness and
   record that `trial-refused-second-installation` now **fails** — that failure is the
   evidence the rollback did something, and the evidence F73 was real.
5. Re-apply `migrations/202608240001_claim_trial_null_fix.sql`. Re-run the harness and
   record twelve passes again.
6. Apply `rollback/202608260001_down.sql`, then `rollback/202608250002_down.sql` and
   `rollback/202608250001_down.sql` with their interlocks set, then
   `rollback/202608230001_down.sql`, then `rollback/202608220001_down.sql`. Record that the harness now reports the schema as
   not applied, naming each missing object.
7. Re-apply all six migrations, restore from step 3, and record the row counts from
   step 2 matching.

Steps 4 and 5 are the cheap half and can be run on their own: they touch one function
body and no rows. Steps 6 and 7 are the honest half, and are the only ones that prove a
restore. Paste the recorded output into `docs/IMPLEMENTATION_EVIDENCE.md` under the
Supabase row; a step that was not run stays marked as not run.

## When something goes wrong

- **`PGRST205 could not find the table`** after a successful paste: the schema cache is
  stale. Reload it.
- **`42P01 relation does not exist`** during a paste: a migration ran out of order.
  Start again from file 1; they are idempotent.
- **`permission denied for function`** from the token server: the `grant execute ... to
  service_role` at the end of the migration did not run. Re-paste that file.
- **The harness reports a proof this runbook says should pass**: that is a finding, not a
  flake. File it in `docs/KNOWN_ISSUES.md` before changing anything.
