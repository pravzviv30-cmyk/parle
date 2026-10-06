# Supabase runbook

This is the ordered schema, backup, rollback and verification runbook. SQL can be
applied through the Supabase migration connector, CLI, or SQL Editor. PostgREST
cannot apply DDL. Track applied migrations; do not blindly replay the whole folder.

On 20 September 2026 the owner authorised restoring Parle for testing. Its missing
Conversation Packs prerequisite and the three practice-recovery migrations below
were applied there. Queue RLS and service-only RPC privileges were checked remotely.
This does not attest that every older/social migration is applied, or that Parle is
a separate production-safe staging environment. Recovery SQL was also exercised in
disposable PostgreSQL/WASM, including deletion by a restricted auth role.

The connector assigned remote versions independently of local filenames:
`conversation_packs` = `20260920195419`, `conversation_practice_jobs` =
`20260920195426`, `practice_receipt_finalization` = `20260920200556`, and
`practice_account_deletion` = `20260920200932`. Older existing tables have no
corresponding entries in this project's reported migration history. Reconcile
history against the actual schema before any future CLI `db push`; do not blindly
reapply local files or mark unverified migrations as applied.

**What must never be in these tables:** raw audio, and full transcripts. Nothing in the
schema stores either today. `product_events` is content-free by database trigger,
`trial_installations` holds two deployment-salted HMACs and no advertising id, email,
Supabase uid or raw install id, and `billing_events` holds a vendor event id, an owner, a
vendor event name and a timestamp — no amount, no card, no receipt. Adding a column that
carries speech is a policy decision, not a schema decision — see
`docs/PRIVACY_AND_SAFETY.md`.

## Apply

Paste these into the SQL Editor **in this order**, one file per run, and read the result
of each before starting the next. Some files create named tables, policies and
triggers without `if not exists`; apply each migration once through tracked,
transactional migration tooling. Inspect the schema before recovering a partial run.

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

| 15 | `migrations/20260919120650_home_friends_daily.sql` | Private, opt-in Friends; accepted connections, weekly capped learning activity, challenges, reactions and reports. Test locally before applying. Deploy this migration before the updated account-export service. No production application has been performed for this review branch. |
| 16 | `migrations/20260920194653_conversation_practice_jobs.sql` | Atomic pack receipt and durable drill recovery, leased claims, five-attempt retries, stale-result fencing and content-free deletion tombstones. Requires 11. |
| 17 | `migrations/20260920200454_practice_receipt_finalization.sql` | Explicit pack grants; preserves recovered exercises against a late failed analyst and keeps exhausted jobs failed. Requires 16. |
| 18 | `migrations/20260920200807_practice_account_deletion.sql` | Narrow, search-path-hardened trigger elevation so Supabase Auth account deletion can tombstone a pack without granting Auth access to queue contents. Requires 16. |
| 19 | `migrations/202609230001_learner_state_practice_history.sql` | Widens `learner_state`'s namespace whitelist to accept `practiceHistory`, the account-synced record of completed conversation practice (ids, times, source links and per-target outcomes only). Recreates one named check constraint, touches no rows. Prepared, not applied to any project. |
| 20 | `migrations/202609250001_learner_state_goal_steps.sql` | Widens `learner_state`'s namespace whitelist to accept `goalSteps`, the account-synced record that a conversation was opened from a goal card (session id, normalised goal key, task id) and the learner's own "used outside" self-report (ids only). Recreates one named check constraint, touches no rows. Prepared, not applied to any project. Requires 12. |
| 21 | `migrations/20261002154637_atomic_billing_projection.sql` | F263/F264: completed-event marker and DB-issued ordering fences; allowance projection and event completion share one transaction/row lock. Provisioning through billing starts exhausted; no free trial is granted. Prepared and tested in disposable PostgreSQL/WASM, not applied to a live project. Requires 8–10. |
| 22 | `migrations/20261002171317_opt_in_conversation_text.sql` | Explicit post-recap text saving, separate from practice. Service-only owned-completion proof, deletion retry fence and a bounded single-statement account-export snapshot. Prepared and tested in disposable PostgreSQL/WASM; not applied live. Requires 2 and 11. |
| 23 | `migrations/20261002192210_consented_product_funnel.sql` | Report 45: thirteen closed device events, two service-only facts, and a service-only first-trial RPC with isolated optional evidence. No persistent server consent or money-policy change. Disposable SQL proof only; requires 2 and 11. |
| 24 | `migrations/20261002212536_kept_phrase_audio_budget.sql` | Disabled, zero-cap dynamic saved-phrase audio; verified rate revisions, atomic source/account/global reservations and final source/period dispatch gate. Extends bounded account export to fifteen owned tables. No hosted application, approved cap assumptions or seeded vendor rates. Requires 2, 10, 11 and 22. |
| 25 | `migrations/20261002233520_failed_session_refunds.sql` | Founder-approved confirmed service-failure refunds of actual charged seconds, allowance-epoch grants and entitlement-first locking. Extends bounded export to sixteen owned tables. Drain all old grant/debit writers before migration; no hosted application. Requires 2, 10, 13, 21, 22 and 24. |
| 26 | `migrations/20261003001510_approved_phrase_audio_caps.sql` | Founder-approved hard ceilings: $0.02 lifetime trial, $0.20 paid per thirty days, $10 global per thirty days. Forces disabled; retains spent counters and anchors, seeds no rates. Not applied live; requires 24. |
| 27 | `migrations/20261003230215_bounded_direct_data.sql` | Direct learner/event payload, per-account and write quotas; immutable server receipt timestamps and auth-first client write locking. Requires 1–26. Prepared and exercised in disposable SQL; not applied live. |
| 28 | `migrations/20261003230224_bounded_data_retention.sql` | Bounded service-only analytics/antifraud/social retention. Marks old usage for detail-policy review and preserves every charge/refund proof. Requires 27; scheduling and hosted execution remain outstanding. |
| 29 | `migrations/20261003230232_bounded_social_inbox.sql` | Twenty pending incoming requests, expiry and missing foreign-key indexes, preserving the existing Friends RPC contract. Requires 15 and 28; independent hosted races remain outstanding. |
| 30 | `migrations/20261003231627_authoritative_tutor_sessions.sql` | Versioned database admission, allowance reservation, worker fencing, checkpoints, atomic completion and room-stop recovery. Admission defaults disabled with zero capacity. Drain legacy workers before enabling; implementation is in progress and hosted acceptance is outstanding. |

| 31 | `migrations/20261003234853_privacy_maintenance_workflows.sql` | Durable erasure before account fencing, sticky processor history, bounded worker heartbeats and service-only readiness/catalog inspection. Jobs survive auth deletion; backup deletion-journal acceptance remains required. Requires 30; prepared and tested locally, not applied live. |
| 32 | `migrations/20261004002534_bounded_account_exports.sql` | Bounded coherent export jobs and UTF8 fragments with SHA chain; default OFF; original usage receipts preserved. Export, global capacity and 128MiB exceptional-request handling require reviewed activation. Prepared and proved in disposable SQL; not applied live. |
| 33 | `migrations/20261004003511_bounded_session_detail_retention.sql` | Nullable older known session details, expiry OFF by default, independent financial idempotency preserved; bounded practice claim/reconcile and active lease checks. Prepared and proved in disposable SQL; not applied live. |
| 34 | `migrations/20261004004023_friends_launch_guard.sql` | Friends default OFF, immutable reviewed moderation evidence with expiry and irreversible enabled-history rollback guard. No moderation service is fabricated. Prepared and proved in disposable SQL; not applied live. |
| 35 | `migrations/20261004010327_whole_product_paid_admission.sql` | Whole-product owner-reviewed immutable quotes, nonrecycling global/account/vendor reservation and execution-day envelopes, current tutor resume and per-account session caps. OFF/zero by default; no vendor prices or capacity seeded. Prepared and proved in disposable SQL; not applied live. |
| 36 | `migrations/20261004015000_indexed_conversation_library.sql` | Owned indexed twenty-row keyset history and independent pack-ID lookup with microsecond cursor; no REST row-limit truncation. Prepared and proved in disposable SQL; not applied live. |
| 37 | `migrations/20261005231742_store_trial_yearly_allowance.sql` | F733 (D16): `apply_billing_projection_v2`, which grants a store trial a week of the plan's allowance and a yearly product its monthly allowance one 30-day window at a time, by recording the ungranted part as spent; `entitlements.allowance_window_end` (the yearly window, beside a `period_end` that stays the paid year, so no lazy lapse is rewritten) with its check and a trigger that clears it with the period and starts a new usage epoch per window; `entitlements.period_start` (store answers are ordered by when their period started, so an immediate upgrade from a yearly plan to a monthly one is granted at once) and `entitlements.withheld_seconds` (the part of `seconds_used` a window withholds, so a fuller answer for the same window gives it back), cleared with the window by the same trigger and by any other writer that moves the period without them; `billing_renewals_due_v1` and a partial index for the maintenance worker's renewal sweep; `billing_projection_version()` answers 2. The six-argument projection stays for servers not yet redeployed. Safe to apply twice. Apply before the token server and maintenance worker that call it, and before any intro offer or yearly product exists in App Store Connect. Prepared and proved in disposable SQL, including over pre-existing paid rows; not applied live. |
| 38 | `migrations/20261006120000_learner_state_game.sql` | Widens `learner_state`'s namespace whitelist to accept `game`, the account-synced facts behind the streak, daily goal, quests and badges (zero-XP sittings, streak covers, goal days, quest days and claims, fixed XP, monthly rollups, badge ids and celebration keys; no free text). Recreates one named check constraint, touches no rows. **Apply before any build that writes `game` ships**, or every push of it is refused and retried (F411). Prepared, not applied to any project. Requires 20. |

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
| `20261005231742_store_trial_yearly_allowance.sql` | `rollback/20261005231742_down.sql` | REOPENS-F733, behind the `luvani.reopen_trial_allowance` interlock. Remove every intro offer and yearly product from App Store Connect and redeploy servers that call the six-argument projection first; afterwards a store trial is granted the whole month. Drops `allowance_window_end`, `period_start` and `withheld_seconds`: a yearly row keeps its paid year and current minutes, and gets no further window, and answers are ordered by end alone again. Safe to run twice. Touches no allowance. |
| `20261006120000_learner_state_game.sql` | `rollback/20261006120000_down.sql` | **DESTRUCTIVE.** Deletes every server copy of a learner's game facts (streak covers, quest claims, fixed XP, monthly rollups, badges and celebrations played) before narrowing the whitelist. Roll back the builds that write `game` first. Device copies survive; a learner who changes phone loses them. Refuses to run until you set `luvani.remove_game` in the same session |
| `20261004015000_indexed_conversation_library.sql` | `rollback/20261004015000_down.sql` | Disable admission, drain writers and satisfy the script’s explicit never-used/maintenance interlocks. Preserve all retained history; used irreversible workflows require forward repair. |
| `20261004010327_whole_product_paid_admission.sql` | `rollback/20261004010327_down.sql` | Disable admission, drain writers and satisfy the script’s explicit never-used/maintenance interlocks. Preserve all retained history; used irreversible workflows require forward repair. |
| `20261004004023_friends_launch_guard.sql` | `rollback/20261004004023_down.sql` | Disable admission, drain writers and satisfy the script’s explicit never-used/maintenance interlocks. Preserve all retained history; used irreversible workflows require forward repair. |
| `20261004003511_bounded_session_detail_retention.sql` | `rollback/20261004003511_down.sql` | Disable admission, drain writers and satisfy the script’s explicit never-used/maintenance interlocks. Preserve all retained history; used irreversible workflows require forward repair. |
| `20261004002534_bounded_account_exports.sql` | `rollback/20261004002534_down.sql` | Disable admission, drain writers and satisfy the script’s explicit never-used/maintenance interlocks. Preserve all retained history; used irreversible workflows require forward repair. |
| `20261002212536_kept_phrase_audio_budget.sql` | `rollback/20261002212536_down.sql` | Disable worker first and back up budgets. Removes spend history and restores the previous fourteen-table archive. Reapply stays dark; do not enable with reset spend counters. |
| `20261002233520_failed_session_refunds.sql` | `rollback/20261002233520_down.sql` | Drain new grant/debit/refund writers first; back up proof. Removes refund history and grants, restores the old debit body and fifteen-table export. Never run alongside new workers. |
| `20261003001510_approved_phrase_audio_caps.sql` | `rollback/20261003001510_down.sql` | Disable runtime switches and drain synthesis first; sets disabled/zero caps and removes ceilings, preserving all spends and anchors. Reapply stays dark. |
| `20261003230215_bounded_direct_data.sql` | `rollback/20261003230215_down.sql` | Maintenance-only, explicitly interlocked: removing admission limits reopens abuse risk. Preserve receipt provenance and back up operational state first. |
| `20261003230224_bounded_data_retention.sql` | `rollback/20261003230224_down.sql` | Stop scheduled maintenance before removing the retention RPC; already-deleted expired records cannot be reconstructed. Usage proofs remain intact. |
| `20261003230232_bounded_social_inbox.sql` | `rollback/20261003230232_down.sql` | Maintenance-only, explicitly interlocked: restore the previous dispatcher only after clients and workers drain. Removed expired requests are not recovered by rollback. |
| `20261003234853_privacy_maintenance_workflows.sql` | `rollback/20261003234853_down.sql` | Interlocked; refuses any erasure record or enabled processor history. Fix forward once used. |
| `20261003231627_authoritative_tutor_sessions.sql` | `rollback/20261003231627_down.sql` | Schema removal is allowed only before any version-one grant has ever been issued. After issuance, disable admission, drain and fix forward; retain settlement and replay proofs. |
| `202609250001_learner_state_goal_steps.sql` | `rollback/202609250001_down.sql` | **DESTRUCTIVE.** Deletes every server copy of a learner's goal steps (which conversations were opened from a goal, and their "used outside" reports) before narrowing the whitelist. Device copies survive; a learner who changes phone loses them. Refuses to run until you set `luvani.remove_goal_steps` in the same session |
| `202609230001_learner_state_practice_history.sql` | `rollback/202609230001_down.sql` | **DESTRUCTIVE.** Deletes every server copy of completed conversation-practice history before narrowing the whitelist. Device copies survive; a learner who changes phone loses it. Refuses to run until you set `luvani.remove_practice_history` in the same session |
| `20260920200807_practice_account_deletion.sql` | `rollback/20260920200807_down.sql` | Reopens restricted-role account deletion failure. Guarded by `luvani.reopen_practice_delete`; prefer fixing forward. |
| `20260920200454_practice_receipt_finalization.sql` | `rollback/20260920200454_down.sql` | Reopens late-result overwrite. Guarded by `luvani.reopen_practice_receipt`; retains required reader/service grants. |
| `20260920194653_conversation_practice_jobs.sql` | `rollback/20260920194653_down.sql` | DESTRUCTIVE. Stop API/worker and back up jobs and tombstones first. Guarded by `luvani.remove_practice_queue`; saved packs survive, but removing tombstones removes protection against late resurrection. |
| `20260919120650_home_friends_daily.sql` | `rollback/20260919120650_down.sql` | DESTRUCTIVE. Export social data and roll back the client/account-export service first. Requires `set luvani.remove_friends = 'yes'`; personal learning data is retained. |
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

### Atomic billing rollback

`rollback/20261002154637_down.sql` requires
`luvani.reopen_billing_projection = 'yes'`. Disable native purchase access first:
it reopens F263/F264 and removes processed-event metadata and ordering fences.
Run it before the older rollback scripts. Neither forward nor rollback file has
been applied to any remote project in this continuation.

The executable disposable proof is `scripts/verifyBillingProjection.mjs`; point
`PGLITE_MODULE` at an isolated `@electric-sql/pglite` runtime. It covers legacy
failed-event recovery, rollback/retry, timestamp precision, session-debit
preservation, crossgrades, completed replays, delayed fetches, unissued tickets,
RPC permissions and account cascade. Real multi-connection concurrency and vendor
sandbox purchases remain separate release evidence.

The saved-text rollback is `rollback/20261002171317_down.sql`. It permanently removes saved conversation text; export and back up before running it, and run it before the older schema rollbacks. This continuation has not applied it to a remote project.
| `20261002192210_consented_product_funnel.sql` | `rollback/20261002192210_down.sql` | Revert the worker first. Restores the prior event validator and removes the observed-claim RPC; retained evidence is not deleted |

## Rollback evidence

The current release has all 38 migrations. A twelve-proof legacy harness is
historical evidence; it is not full-catalog security, rollback or restore acceptance.
Do not execute an old destructive rollback sequence against the current schema.

1. On a disposable target, capture the complete expected schema manifest using
   `scripts/releaseSchemaManifest.mjs` and replay the full inventory. `npm run gate`
   runs eight current disposable SQL suites: direct-data bounds, authoritative
   tutor sessions, privacy jobs, coherent exports, detail retention, Friends launch,
   whole-product paid admission and indexed conversation history. Keep each actual
   migration/proof-group count. Add legacy allowance/queue/refund/phrase proofs where
   relevant; sequential WASM evidence does not prove independent PostgreSQL races.
2. Before hosted work, disable admission/generation/expiry and drain incompatible
   writers. Compare actual hosted migration history, Auth/platform/configuration,
   roles/RLS/ACLs, full effective catalog and explicit release manifest through
   `scripts/verifyCurrentHostedSchema.mjs`. Review differences; apply only missing
   reviewed forward migrations in order. No hosted migration was applied here.
3. Review each migration's paired down script and interlocks in the table above.
   Several rollbacks intentionally refuse after issued exposure or enabled history,
   and retain quota/financial/idempotency proof. After issued exposure, drain and
   forward-fix; removing surviving proof is not a supported rollback. Test only the
   permitted current rollback/reapply path on a disposable fixture with nonempty
   rows, exact values and ACLs, including injected transactional failures.
4. Capture a complete backup/restore inventory, beyond the original seven public
   tables: current public/private schema/data, Auth identities/configuration,
   grants/default privileges/extensions, migration history, storage bodies where
   used, external receipts and separately recoverable keys/secrets. Keep the
   encrypted deletion journal outside the database backup and freeze its high
   water mark. Row counts alone cannot prove restore correctness.
5. Restore into a distinct isolated target with admission disabled, replay the
   off-backup erasure journal, recheck processor acknowledgements and exact current
   catalog/roles, and validate representative learning, entitlement, refund,
   idempotency and privacy invariants. Measure RPO/RTO and preserve evidence bound
   to the release/target. Follow `docs/BACKEND_RELEASE_RUNBOOK.md`; do not call the
   local fixtures a hosted timed recovery drill.

The original trial-function rollback/reapply test used
`rollback/202608240001_down.sql` and
`migrations/202608240001_claim_trial_null_fix.sql` with the twelve-proof
`services/token-server/src/verify/supabaseLive.ts` harness. That dated test remains
useful on its matching disposable historical schema, not as instructions to revert
one old function beneath newer dependants. Record only checks actually run in
`docs/IMPLEMENTATION_EVIDENCE.md`.

## When something goes wrong

- **`PGRST205 could not find the table`** after a successful paste: the schema cache is
  stale. Reload it.
- **`42P01 relation does not exist`** during a paste: a migration ran out of order.
  Inspect migration history and apply the missing prerequisite; do not blindly replay non-idempotent files.
- **`permission denied for function`** from the token server: the `grant execute ... to
  service_role` or its current reviewed replacement is absent. Compare the full
  catalog and review the missing grant; do not re-paste an entire non-idempotent migration.
- **The harness reports a proof this runbook says should pass**: that is a finding, not a
  flake. File it in `docs/KNOWN_ISSUES.md` before changing anything.

### Optional funnel evidence (Report 45)

Apply the complete reviewed schema before the compatible new workers. Missing-RPC PGRST202 permits the
old claim path during rollout, with no invented trial evidence; other failures
remain trial failures. Never edit historic allowance functions. Consent is read
on the requesting device for each start, and withdrawal affects future requests.
An already dispatched start can finish its event after Off. The trial event is
inside the claim transaction but its isolated failure cannot undo a trial.
Minutes refusals are best effort and exclude subscription lapse and antifraud.
Run `scripts/verifyProductEvents.mjs` with a disposable PGLite module; its role,
transaction and injected-writer checks are not simultaneous PostgreSQL connections.
Prove concurrency on a disposable multi-connection PostgreSQL instance before
release. No hosted migration has been applied by this continuation.

## Saved-phrase audio remains disabled

Migration 24 originally seeds disabled policy and zero caps. Migration 26 applies the founder-approved hard ceilings of $0.02 per lifetime trial, $0.20 per paid account per anchored thirty days and $10 global per anchored thirty days, while forcing enabled=false and retaining all spend counters/anchors. Neither migration seeds verified voice rates. Both worker and phone switches stay off. Caps are approved; before enabling, verify actual USD upper bounds for EACH selected voice/configuration fingerprint, including credit conversion, surcharges and minimum charges; public prices do not suffice. Rates expire within thirty days, and every update changes their revision. No key is copied into this branch or the phone.

The service-only transaction resolves an owned ready/completed French source and permanently reserves both budgets before ONE uncached synthesis request. Trial budget lasts for the account; paid and global budgets use anchored thirty-day periods, independent of subscription plan/period changes. Reservation and dispatch require thirty seconds of period headroom; the whole HTTP request is bounded to twenty seconds. There is no retry/refund RPC. Unknown provider outcomes stay charged. Final checks refuse changed rates, source, completion, entitlement, bucket, caps or period. A deletion or policy change after the last check cannot revoke an already dispatched provider call. Vendor billing timestamp/fee behavior and hosted simultaneous transactions still require verification. These limits apply only to this route, never all live-voice charges.

Run `scripts/verifyPhraseAudioBudget.mjs` with the existing disposable PGLite module. It checks default darkness, owners/sources/completion, rate revisions/expiry, budget periods/caps, roles, transaction rollback, complete owned export, account cascade and rollback/reapply. It is sequential evidence, not concurrent PostgreSQL or live provider proof.

## Confirmed service-failure refunds: rollout hold

The founder approved refunding only the affected session's actual charged seconds
for a recognized terminal Luvani pipeline failure. Recoverable errors, manual exits,
learner connection loss, time limits and safety stops do not request this refund.

Migration 25 changes every callable session debit to entitlement-first locking.
Stop new starts and drain **all** old grant/debit writers and in-flight transactions
before applying it and deploying the paired token server/worker. An already running
old function keeps its old lock order until its transaction ends. Legacy session
rows have no invented issued epoch or capped-charge proof; their confirmed failures
need explicit reconciliation, not a debit or refund against today's balance.

The session grant is persisted before its signed credential is returned. Refund and
debit share the entitlement lock; only the actual capped delta is returned, once.
Late prior-period settlement cannot consume the new allowance; old-period reversal
is labelled historical. Expired paid allowances lapse before classifying a refund.
The app waits for a typed acknowledgement and labels failed transport pending.

Local proof: `scripts/verifySessionRefunds.mjs` runs sequential disposable SQL,
including ownership/RLS, lapse, rollback, export and cascade.
`scripts/verifySessionRefundConcurrency.mjs` uses a separate isolated PostgreSQL
18.4 instance with independent connections and observed transaction blocking; it
checks both debit/refund orders, renewal races and duplicate refunds. These do not
prove hosted rollout, native delivery or recovery of a worker that crashes before
reporting its failure. The current worker retries three bounded calls in-process;
there is no durable refund reconciliation queue. Reconcile those missing reports
before release. No hosted migration has been applied.
