# Risk register

Updated 2026-08-25, at the end of Phase 1. Every row now says whether its control was
**measured**, is **blocked** on a named external thing, or is **accepted** with the
reasoning written down. Those are the same three states the Phase 1 matrix uses, and
`docs/IMPLEMENTATION_EVIDENCE.md` carries the numbers behind each one.

Read every "measured" in the database rows with one qualifier attached: the run was against
a **disposable** project, created for the proofs and thrown away. There is no production
project yet, so nothing here has been applied to one.

Three rows changed character in this phase. One theoretical risk turned out to be live
(trial farming, F73). One control this register claimed was in place was refuted by
measurement and then rebuilt (failed-room billing, F76). One risk it carried was refuted
outright and cost less than it said (abandoned rooms, F78). All three are under the table.

| Risk | Severity | Owner | Control now | Evidence state | Remaining action |
|---|---|---|---|---|---|
| Local migration is mistaken for deployed RLS | P0 | data-sync, qa | The schema was applied to a disposable project and the twelve proofs were run against it | measured: 12 of 12 proofs passed, exit 0, after a first run that failed 6 | Apply all six migrations to whatever project ships, then re-run `npm run verify:supabase` against it |
| **`claim_trial` grants the trial it should refuse** | P0 | revenue, security, data-sync | Forward migration `202608240001` makes the guard null-safe; the contract test evaluates it in real three-valued logic | measured: a second account on one device refused, one account signal refused across devices, and 1 of 6 racing claims granted | Apply `202608240001` with the others. Applying only `202608230001` leaves the defect live |
| **`consume_entitlement` bills a replayed session id every time** | P0 | revenue, data-sync | Forward migration `202608250001`, the same null-safe guard in the other money function | measured: found live at 120s, 240s, 540s for one session id; after the fix, 120s billed once across two identical reports | F79: the join path still does not consult `session_usage`, so the replay refusal is worker-local |
| **A failed room charges the learner** | P0 | voice, revenue | `learnerTurns` counts only real learner input, in both `tutor.ts` and `convo.ts`, and billing keys off it rather than off the turn index the silence rescue advances | measured: found at 60s billed for a room with no learner turn, and 0s after the fix, re-run live | Induce a failure that is not silence — a recogniser outage mid-scene — and measure that too |
| Voice usage exceeds or double-spends allowance | P0 | voice, revenue, security | Lease, hard stop, signed session id, unique ledger | measured: hard stop fired at 60.0s, a replayed `/session/end` changed nothing, one grant and one 409, and Postgres billed a replayed id exactly once after `202608250001` | Production concurrency against a real deployment, rather than two local processes |
| A captured join credential re-opens a session | P0 | voice, security | Partial. The tutor refuses to serve a session id it has already reported, so a replay opens no scene and costs no model call | measured: the same credential re-created the closed room with 279s of TTL left, and LiveKit accepted credentials 3s and 30s past expiry and refused them 90s and 900s past, so the leeway sits between 30 and 90 seconds; the exact bound was not bisected | The room half cannot be closed from `tokens.ts`. Shorten the join TTL, and close F79 so the refusal is durable rather than worker-local |
| Vendor keys sit in local git history | P0 | security, deploy | Scanner finds them without printing them; `.gitignore` covers `**/.env.bak*`; the commit is on no remote | measured: 5 critical findings in `576bc53` naming 4 live keys, local `codex/*` branches only | blocked: `vendor-key-rotation`. Rotate Groq, Deepgram, ElevenLabs and the LiveKit secret. Do not push either branch first |
| Unsafe tutor response | P0 | tutor behaviour, privacy-safety | Deterministic pre-model boundary, 153 patterns over 8 categories, plus prompt rules | measured: 149 adversarial lines caught, 51 ordinary-French lines untouched | blocked: `external-safety-reviewer`, plus an in-app report workflow |
| Stolen old session deletes account | P0 | auth, privacy-safety | Server checks last real sign-in within five minutes | blocked: `ios-and-android-builds` | Live password and Google journeys on a device |
| Trial farming creates unbounded vendor spend | P0 | revenue, security | Pseudonymous one-install/one-user claim, now with a null-safe guard proven against a database | was theoretical, now measured as realised and then closed — see below | Auth-side controls: CAPTCHA, email verification, reset analysis and alerts |
| Dependency advisory is exploitable | P0 unknown to P2 | security, qa | Four roots traced; one fixed, three accepted with reachability arguments recorded in `parle.dependencyAudit`; `npm run audit:ci` refuses an undecided high root | accepted-with-evidence: 18 advisories, 0 critical, 7 high, 11 moderate | Take the `adm-zip` bump deliberately when the lockfile is next regenerated |
| Antifraud identifier retention is undisclosed | P0 before users | privacy-safety | Pseudonymous HMAC only, and retention, purpose and control are now stated in `PRIVACY_AND_SAFETY.md` | measured: policy pinned against shipped copy by 4 tests, and `deletion-cascade` proved the hash survives an account deletion while four learner tables empty | Surface the disclosure in the product, not only in a document |
| Paid status can be forged or lost | P0 before payments | revenue | No purchase UI is presented as working | accepted-with-evidence: nothing sells yet | Receipts, webhooks, replay safety, restore and lifecycle |
| Analytics is silently dead in a deployed schema | P1 | data-sync, privacy-safety | Forward migration `202608250002` counts event properties with `jsonb_object_keys`, which exists | measured: every write raised 42883 before the fix; `product-event-trigger` passed on all 3 arms after it | Apply `202608250002` wherever `202608230001` went. A schema with the second and not the fifth loses every event |
| A finished session holds a worker slot | P1 | voice, revenue | `departureTimeout=20` in the production `RoomConfiguration`, recorded with its cost in `ROOM_LIFECYCLE` | measured: the room left `listRooms` 20.6s after the learner, and an abandoned room holds no tutor at all | Decide whether 20s of worker turnover per finished session is the right concurrency ceiling |
| A client evades per-IP limits by rotating a header | P1 | security | `clientIp` takes the last forwarded entry under one trusted proxy, and the socket peer otherwise | measured: a forged multi-entry header no longer moves the bucket | Prove the hop count against a real topology. `PARLE_TRUST_PROXY=1` with no proxy is still a misconfiguration |
| Learner loses local-only progress | P1 | data-sync | Crash-safe local stores and journal | accepted-with-evidence: no sync exists yet, and the loss is bounded to one device | Versioned cross-device sync and backup |
| Direct analytics write stores content | P1 | privacy-safety, security | Exact PostgreSQL validation trigger, fixed by `202608250002` | measured: `product-event-trigger` refused unsupported and malformed events by name | A bypass attempt from a real client, rather than from the harness |
| CSP/CORS differs from final domains | P1 | security, deploy | Exact allowlists in code | blocked: final domain not chosen | Replace placeholder domains and capture live headers |
| Duplicate legacy flows create contradictory UX | P1 | onboarding, practice, design | Deletion candidates mapped | accepted-with-evidence: mapped and scheduled, not yet cut | Switch callers, migrate, delete, dead-code scan |
| Auth forms are not programmatically labelled | P1 | design, onboarding, qa | Visible labels and 44px targets exist | measured: browser QA at 320, 390 and 1,280px found no labels and no heading roles | Bind labels and headings, then keyboard and screen-reader QA on a device |
| CI never runs on a machine without hooks | P1 | deploy | `.github/workflows/ci.yml` runs the gate, the audit and the secret scan | blocked: `github-actions-run` | Push once and let the workflow execute on a Linux runner |
| The web bundle ships a secret | P1 | security, deploy | Tracked-file scan is clean; `--bundles` mode exists | blocked: no build output on disk | `npm run build:web`, then `npm run scan:secrets:bundles` |
| A replayed credential is refused by only one worker | P2 | security, voice, data-sync | The tutor's refusal ledger is in worker memory, which is the whole fleet today | accepted-with-evidence: F79, open and reasoned | Consult `session_usage` from `server.ts` on the join path |

## Trial farming: theoretical no longer

This register carried "Trial farming creates unbounded vendor spend" as a P0 since before
Phase 1, with "Pseudonymous one-install/one-user claim" as the control. Phase 1 found that
the control did not exist in practice.

`public.claim_trial` used `insert ... on conflict do nothing returning true into claimed`.
When the insert affects zero rows, `RETURNING ... INTO` assigns NULL, overwriting the
`:= false` initialiser. `not NULL` is NULL, an `IF` on NULL takes neither branch, control
falls through, and the function provisions a fresh trial and returns true. Both arms of the
boundary were dead: `installation_hash` is the primary key and `first_user_hash` is
`not null unique`, so a second account on one device and one account across devices both
conflicted, and both were granted.

At the measured rate of about $0.052 per tutor-attended minute, one farmed trial is roughly
$2.20 of vendor spend, repeatable without limit.

Nothing caught it because the only test asserted the buggy line verbatim
(`databaseContract.test.ts:52` matched `/on conflict do nothing\s+returning true into
claimed/i`). The test pinned the defect in place. That is the strongest argument in this
repo for why a text assertion is not a behavioural proof, and the replacement test now
evaluates the guard in SQL three-valued logic and fails if the null-unsafe form returns.

Fixed forward by `supabase/migrations/202608240001_claim_trial_null_fix.sql`, and then
proven: with the migration applied, `trial-refused-second-installation` refused a second
account on one device and refused one account signal across devices, and `trial-race`
granted exactly one of six simultaneous claims.

The same null trap was found twice more in the same run, in `consume_entitlement` (F74) and
beside it in the product-event trigger (F75). Three function bodies, one mistake, three
forward migrations. `supabase/README.md` now tells the next person writing a guard like
this to write `<flag> is not true`.

## Failed-room billing: a control this register claimed, lost, and rebuilt

The row previously read "Zero-second unusable report and idempotent release" as the control
in place. The live voice run refuted it: `unusable-room-is-not-charged` failed, and a room
the harness never took a learner turn in was debited 60 seconds.

`tutor.ts` read `summary.turnsCompleted > 0 ? wallClockSec : 0`, and `turnsCompleted` was
`state.turnIndex`. The silence rescue applies a `silence` input that advances the turn, so a
learner who said nothing produced `turnsCompleted > 0` and was billed for the whole session.
The guard was defeated by exactly the case it was written for.

Both surfaces now bill off a `learnerTurns` counter that only a real learner input
increments — `tutor.ts` and `convo.ts` each keep their own — and the re-run debited 0s. The
idempotent half of the old claim always did hold: a replayed `/session/end` changed nothing
in the store file, a never-joined room debited zero, and Postgres bills a replayed session
id once now that `202608250001` is applied.

What is still unmeasured is the other way a session fails. A recogniser outage mid-scene,
or a tutor that stops answering, still bills the wall clock, because the learner did speak.

## Abandoned rooms: a risk this register overstated

The row used to read "An abandoned room bills a waiting tutor", with `emptyTimeout=30` as
the thing to argue about. The measurement refused the premise. LiveKit dispatch follows a
*participant*, so a room nobody joins gets no tutor: 20.1s held at `emptyTimeout=20` with
none dispatched, and a grant nobody joins leaves no room behind at all. Worker occupancy
per abandoned room is 0s.

The timeout that does hold a worker is `departureTimeout`, 20s shipped and measured at
20.6s after the learner left. That is the real concurrency ceiling, and it is now the row
in the table above. `ROOM_LIFECYCLE` in `services/token-server/src/tokens.ts` carries the
shipped numbers, the measured ones and the derived costs, so the next person to argue about
a timeout argues with a measurement.
