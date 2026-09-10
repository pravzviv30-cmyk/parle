# Supabase runbook

Everything Luvani keeps about a learner lives in seven tables and four functions here. This
file is how they get applied, backed up, rolled back and proved, by hand, from the SQL
Editor.

By hand is not a preference. There is no Supabase CLI, no Docker and no `psql` on the
machine this repo is developed on, and DDL does not travel over PostgREST — the service
role can read and write rows all day and still cannot create a table. So the apply path
is a paste, and the discipline has to come from the order and the checks below rather
than from a tool.

**What must never be in these tables:** raw audio, and full transcripts. Nothing in the
schema stores either today. `product_events` is content-free by database trigger,
`trial_installations` holds two deployment-salted HMACs and no advertising id, email,
Supabase uid or raw install id, and `billing_events` holds a vendor event id, an owner, a
vendor event name and a timestamp — no amount, no card, no receipt. Adding a column that
carries speech is a policy decision, not a schema decision — see
`docs/PRIVACY_AND_SAFETY.md`.

## Apply

Paste these into the SQL Editor **in this order**, one file per run, and read the result
of each before starting the next. Each file is idempotent: every create is
`if not exists` or `create or replace`, so a partial run is safe to repeat.

| # | File | What it adds |
|---|---|---|
| 1 | `migrations/202608220001_luvani_learning.sql` | `learner_state`, `product_events`, `entitlements`, their RLS policies, and the first `consume_entitlement(uuid, integer)` |
| 2 | `migrations/202608230001_session_usage_idempotency.sql` | `session_usage`, `trial_installations`, `claim_trial`, the session-aware `consume_entitlement(uuid, integer, uuid)`, and the `product_events` validation trigger. Drops the two-argument debit |
| 3 | `migrations/202608240001_claim_trial_null_fix.sql` | F73: the NULL-safe refusal guard in `claim_trial`. Replaces one function body, touches no rows |
| 4 | `migrations/202608250001_consume_entitlement_null_fix.sql` | F74: the same NULL-safe guard in `consume_entitlement`, so a retried session bills once and a foreign session id is refused. Replaces one function body, touches no rows |
| 5 | `migrations/202608250002_product_event_key_count_fix.sql` | F75: counts event properties with `jsonb_object_keys` instead of `jsonb_object_length`, which does not exist. Replaces one function body, leaves the trigger in place, touches no rows |
| 6 | `migrations/202608260001_learner_state_revision.sql` | F84: `learner_state.revision`, the ordering primitive the device sync engine compares against, plus the trigger that advances it and stamps `updated_at`. Adds one column with a constant default, changes no policy, touches no payload |
| 7 | `migrations/202608270001_onboarding_event_property_fix.sql` | F116: `onboarding_completed` now requires `personalisedGreeting` alone, because the why page left the first run and the client stopped sending `motivationAnswered`. Replaces one function body, leaves the trigger in place, touches no rows |
| 8 | `migrations/202608300001_billing_events.sql` | F244: `billing_events`, its index and `record_billing_event`, so a webhook a payment vendor delivers twice is acted on once. RLS on with no policies, service role only. Adds one table, touches no existing object |
| 9 | `migrations/202608300002_paid_period_lapse.sql` | F245: a paid period that ended more than 24 hours ago lapses to an exhausted trial instead of granting itself another thirty days. Replaces one function body, touches no rows |
| 10 | `migrations/202608300003_paid_lapse_marker.sql` | F257: marks the paid-to-trial transition so a former subscriber is never told their free trial ended. Adds one boolean column and one trigger |
| 11 | `migrations/202609040001_conversation_packs.sql` | Durable, idempotent Conversation Packs keyed by completed session. Curated phrases and exercises only: raw audio and readable transcripts have no column or payload contract. |
| 12 | `migrations/202609050001_learner_state_daily_namespaces.sql` | F411: widens `learner_state`'s namespace whitelist to accept `bookmarks` and `scenarioProgress`, so the situations a learner saved and the scene they left half finished reach the account instead of being refused at the door. Recreates one named check constraint, touches no rows |
| 13 | `migrations/202609100001_max_allowance_three_hundred.sql` | Reprices Max from 450 minutes to 300 to match `PLANS.regular` in core, which moved to $29. Replaces one function body, creates nothing, touches no rows. At $29 the old 450 minutes had a negative worst-case margin; 300 leaves 29.7%. No entitlement row carries `regular` today, so this moves nobody |
| 14 | `migrations/202609100002_wall_product_events.sql` | Adds the subscription wall's five product events to the `validate_product_event` allowlist: `wall_shown`, `wall_page_seen`, `plan_selected`, `purchase_started`, `purchase_settled`. Replaces one function body, leaves the trigger in place, touches no rows. Without it those five raise `unsupported product event` and the wall's funnel is dark with no visible error |

Order is load-bearing in one direction only: everything after 1 names tables and
functions that 1 creates, so 1 first. Files 3, 4, 5, 7 and 9 are each a single `create or
replace function`, so running any of them twice, or running them immediately after 2,
is fine. Two pairs depend on each other, and only in order: 5 and 7 both replace
`validate_product_event`, so 7 has to be the last of the two you paste, and 4 and 9 both
replace `consume_entitlement`, so 9 has to be the last of those two. The numbering
already gives you both.

Files 3, 4 and 5 all close the same mistake in three different functions: `insert ...
on conflict do nothing returning true into <flag>` leaves the flag NULL rather than
false, and `not NULL` is NULL, so a plpgsql `if` on it takes neither branch. If you are
adding another migration that writes a guard like this, write `<flag> is not true`.
File 8 is the first money function in this schema that was written that way from the
start, and `databaseContract.test.ts` evaluates all three guards in three-valued logic
rather than matching their text.

**File 7 has never been pasted anywhere.** It exists on disk and in the tests, and that is
all: no project, disposable or otherwise, has been given it, because there is no CLI, no
Docker and no `psql` here and DDL does not travel over PostgREST. Until somebody pastes it,
every deployed copy of this schema still runs the 202608250002 trigger, which demands
`motivationAnswered` and therefore refuses every `onboarding_completed` the current app
sends. The parser half of F116 ships with the token server and needs no paste; this half
does.

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
between two real accounts, anon and forged-id refusal, RPC privilege, the paid-period
lapse, debit concurrency, session replay, cross-user session rejection, both
trial-refusal arms, the trial race, the product-event trigger and the deletion cascade.
It creates its own throwaway accounts and deletes them again. Point it at a disposable project, never at one
holding real learners.

## Backup

Take one before anything in `## Rollback` and before any migration that is not simply
`create or replace function`. Two ways, in order of preference:

1. **Dashboard → Database → Backups → Download**. On a paid project this is a real
   point-in-time restore; on free it is a daily snapshot, which is not the same promise.
   Note the timestamp you are trusting.
2. **Table export.** Dashboard → Table Editor → each of `learner_state`,
   `product_events`, `entitlements`, `session_usage`, `trial_installations`,
   `billing_events`, `conversation_packs` → Export CSV.
   Slow and manual, but it is the only copy that exists on a free project between
   snapshots, and it is enough to reconstruct every row Luvani owns.

Record what you took and when, in the incident note or the PR. A backup nobody can date
is a backup nobody can restore from.

`auth.users` is not yours to export casually: it holds email addresses. Back it up only
when a restore genuinely needs it, and never into this repo.

## Restore

1. Stop the token server, or the debit path will keep writing into a database you are
   about to overwrite.
2. Restore the snapshot from Dashboard → Database → Backups, or re-import the CSVs in
   dependency order: `entitlements`, `learner_state`, `product_events`, `billing_events`, `conversation_packs`
   (they reference `auth.users`), then `session_usage`, then `trial_installations`.
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
| `202609100002_wall_product_events.sql` | `rollback/202609100002_down.sql` | Narrows the allowlist back below the wall, so all five wall events start failing silently and the funnel goes dark. Evidence loss, not a privacy hole. Refuses to run until you set `luvani.blind_the_wall` in the same session |
| `202609100001_max_allowance_three_hundred.sql` | `rollback/202609100001_down.sql` | Restores 202608300002's function body. Inert today on purpose: the migration changed only a number that `PLANS.regular` owns, so this file carries the current allowance rather than the old one. Reverting the cap is a core change first, then every allowance table under `supabase/`, then a new forward migration. The file's own header spells out the order |
| `202609050001_learner_state_daily_namespaces.sql` | `rollback/202609050001_down.sql` | **DESTRUCTIVE.** Narrowing the whitelist cannot succeed while a row uses one of the two names, so the script deletes every server copy of a learner's saved situations and half finished scenes first. The device copies survive; a learner who changes phone loses both. Take the named backup first. |
| `202609040001_conversation_packs.sql` | `rollback/202609040001_down.sql` | **DESTRUCTIVE.** Deletes server-owned Conversation Packs. Take the named backup first. |
| `202608300003_paid_lapse_marker.sql` | `rollback/202608300003_down.sql` | Reopens F257. Former subscribers become indistinguishable from exhausted trials and receive the wrong explanation |
| `202608300002_paid_period_lapse.sql` | `rollback/202608300002_down.sql` | Reopens F245. Every cancelled subscriber's row renews itself for thirty more days, free, on every read. Refuses to run until you set `luvani.reopen_f245` in the same session |
| `202608300001_billing_events.sql` | `rollback/202608300001_down.sql` | Destroys the webhook replay ledger. Take the webhook endpoint out of service first: without the table every redelivered billing event is acted on again |
| `202608270001_onboarding_event_property_fix.sql` | `rollback/202608270001_down.sql` | Reopens F116. Every `onboarding_completed` is refused again and the funnel goes dark, silently. Refuses to run until you set `luvani.reopen_f116` in the same session |
| `202608260001_learner_state_revision.sql` | `rollback/202608260001_down.sql` | Every synced device stops being able to write: the compare-and-swap filters on a column that no longer exists, so PostgREST answers 42703 and the push queues instead of landing. Fails closed, loses no learner content, and cannot be undone by re-applying — the counters come back at 0 |
| `202608250002_product_event_key_count_fix.sql` | `rollback/202608250002_down.sql` | Reopens F75. Every product event write fails again, silently. Refuses to run until you set `luvani.reopen_f75` in the same session |
| `202608250001_consume_entitlement_null_fix.sql` | `rollback/202608250001_down.sql` | Reopens F74. A retried `/session/end` bills a learner twice and a foreign session id merges. Refuses to run until you set `luvani.reopen_f74` in the same session |
| `202608240001_claim_trial_null_fix.sql` | `rollback/202608240001_down.sql` | Reopens F73. Refuses to run until you set `luvani.reopen_f73` in the same session |
| `202608230001_session_usage_idempotency.sql` | `rollback/202608230001_down.sql` | Destroys the exactly-once billing ledger and the antifraud evidence. Restores the two-argument debit |
| `202608220001_luvani_learning.sql` | `rollback/202608220001_down.sql` | Destroys every learner row Luvani owns |

The five interlocked rows are the ones to argue with. Each adds no table, no column and
no row; each only stops one function doing the wrong thing. If something looks broken after
applying one of them, fix forward with a new migration. Rolling one back restores a known
defect, which is why each script makes you say so out loud in the same paste:

```sql
set local luvani.reopen_f245 = 'yes-i-accept-renewing-cancelled-subscriptions';
set local luvani.reopen_f116 = 'yes-i-accept-losing-every-onboarding-event';
set local luvani.reopen_f75 = 'yes-i-accept-losing-every-product-event';
set local luvani.reopen_f74 = 'yes-i-accept-double-billing-on-retry';
set local luvani.reopen_f73 = 'yes-i-accept-unbounded-trial-farming';
```

`202608300001_down.sql` is the odd one: it reopens money-shaped behaviour like the five
interlocked scripts, but it drops a table with rows in it rather than swapping a function
body, so it belongs with the destructive pair at the bottom and carries their banner
instead of an interlock. A teardown that stopped halfway on a `set local` nobody had read
would be worse than one that says DESTRUCTIVE at the top. Stop the webhook endpoint
before you paste it.

Two pairs replace the same function as each other, so apply them newest first like
everything else here. `202608270001_down.sql` and `202608250002_down.sql` are one pair:
running the F75 one on its own, without the F116 one before it, is not a partial rollback
— it restores a body that predates both fixes and reopens F116 along the way.
`202608300002_down.sql` and `202608250001_down.sql` are the other, and that one is worse,
because `202608250001_down.sql` restores the 202608230001 body: run it on its own and you
have reopened F74 and F245 in a single paste, with only F74's interlock asked for.

`202608300002_down.sql` is the most expensive of the five. It costs a full paid allowance
per cancelled subscriber per month, for as long as the row exists, against no revenue at
all — roughly $10.40 a month of vendor spend for a starter who keeps using every granted
minute, on the same cost model. `202608240001_down.sql` is next: it restores a function that grants a fresh trial
to every device that asks twice, at roughly $1.73 of vendor spend each from the cost model
in `packages/core/src/metering/meter.ts`. `202608250001_down.sql` spends a learner's own
metered minutes instead of the company's, which is worse in kind if not in dollars.

The last two rows destroy data. Take the backup first, and escalate rather than paste if
the project has real accounts on it.

## Rollback evidence

"We can roll back" is a claim, and this is how it becomes evidence. Do it on a disposable
project, and keep the output:

1. Apply all fourteen migrations. Run the harness. Record: twelve proofs, all passed.
2. Note the row counts of all seven tables (`select count(*) from public.<table>;`).
3. Take the backup from `## Backup`, and record its timestamp.
4. Apply `rollback/202608240001_down.sql` with the interlock set. Re-run the harness and
   record that `trial-refused-second-installation` now **fails** — that failure is the
   evidence the rollback did something, and the evidence F73 was real.
5. Re-apply `migrations/202608240001_claim_trial_null_fix.sql`. Re-run the harness and
   record twelve passes again.
6. Apply `rollback/202609100002_down.sql` with its interlock set, then `rollback/202609100001_down.sql`, then `rollback/202609050001_down.sql`, then `rollback/202609040001_down.sql`, then `rollback/202608300003_down.sql`, then `rollback/202608300002_down.sql` with its interlock set, then
   `rollback/202608300001_down.sql`, then `rollback/202608270001_down.sql` with its
   interlock set, then `rollback/202608260001_down.sql`, then
   `rollback/202608250002_down.sql` and `rollback/202608250001_down.sql` with their
   interlocks set, then `rollback/202608230001_down.sql`, then
   `rollback/202608220001_down.sql`. Record that the harness now reports the schema as
   not applied, naming each missing object.
7. Re-apply all fourteen migrations, restore from step 3, and record the row counts from
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
