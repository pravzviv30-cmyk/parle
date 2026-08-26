# Implementation evidence

Snapshot date: 2026-08-25, written at the end of Phase 1. This document separates what was
measured on a machine from what is merely implemented. A passing local test is not proof
that a migration, a header, a credential, a provider or a store is live.

The Phase 1 matrix below is the honest part. Every area carries exactly one of three
states, and `services/token-server/src/verify/evidenceContract.test.ts` fails the gate if
one of them ever goes missing or turns into a claim nobody measured.

| State | What it means |
|---|---|
| `measured` | A run happened on a real machine and this document carries its numbers. |
| `blocked-on:<thing>` | Named external thing is missing. Nothing is claimed about it. |
| `accepted-with-evidence` | Known and not fixed, with the reasoning written down. |

A green gate is not evidence for anything on the `blocked-on` list. That is the whole point
of the list.

## Baseline

- The working tree was clean when Phase 1 started. The previous session's work is
  committed at `7d99fb6`. There is no inherited dirty worktree.
- The verified pre-phase gate passed **1,495 tests**: core 500, brain 306, tutor agent 302,
  token server 79, playground 13, mobile 295.
- After Phase 1 the gate passes **1,576 tests, 0 failing**: core 500, brain 306, tutor
  agent 338, token server 120, playground 13, mobile 299. Typecheck is clean in every
  workspace. No floor in `scripts/gate.floors.json` was lowered.
- Phase 1 was planned as F59 to F73. Running the harnesses found seven more defects, F74 to
  F80, five of which were fixed inside the phase. They are recorded in their own table
  below rather than folded into the plan, because a plan that rewrites itself to match
  what happened is not a record of anything.

## Credential state, measured 2026-08-25

| Credential | State | How that was established |
|---|---|---|
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | configured and reachable | `npm run verify:upstash` exited 0 with 5 of 5 proofs passed against the live database |
| `PARLE_RATE_LIMIT_SALT` | configured | 48 characters, present in `services/token-server/.env`; the live SCAN found 5 hashed `parle:*` keys and no raw identifier |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | configured, schema applied to a **disposable** project | every migration through `202608250002` was pasted into a throwaway project from `supabase/README.md`, and `npm run verify:supabase` then exited 0 with 12 of 12 proofs passed. `202608260001_learner_state_revision.sql` was pasted from this repo into the same disposable project on 2026-08-26 and verified behaviourally, not just structurally: `revision` is present as `bigint default 0`; a compare-and-swap filtered on the current revision updated exactly 1 row and the BEFORE UPDATE trigger overrode the client's deliberately bogus `revision: 999` with `old.revision + 1`; the same write replayed against the now-stale revision updated 0 rows; and `updated_at` moved, which it never did before this migration. The probe user was created through the admin API and deleted in a `finally` |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` | configured | the voice harness ran a full live lifecycle, though on its own spawned server with its own key pair |
| Deepgram, ElevenLabs, OpenAI, Groq | configured | the tutor worker booted and completed its vendor reachability probes during the live voice run |

Two sentences hold this whole document together, and they point in opposite directions.

Supabase authenticating is not Supabase verified. That was the warning that mattered in the
first half of the phase, when the project answered and held nothing.

A disposable project proven is not a production project proven. That is the warning that
matters now. The twelve proofs ran against a throwaway project created for them and
deleted afterwards. No production Supabase project exists yet, so nothing here has been
applied to one, and the day one exists it starts with an empty schema and the same runbook.

## Phase 1 matrix

| Area | Ledger | State | Evidence: the run and its numbers | Not proven by that run |
|---|---|---|---|---|
| Trusted-proxy client address | F59 | `measured` | `npm test -w @parle/token-server`, 120 tests, 0 failing. A forged multi-entry forwarded header resolves to the last entry under `PARLE_TRUST_PROXY=1` and to the socket peer without it, so header rotation no longer moves the rate-limit bucket. | One trusted hop is assumed. A CDN-plus-load-balancer topology needs a hop count, and there is no deployment to measure one against. |
| Redis fail-closed and key hygiene | F60 | `measured` | Unit: a limiter failure refuses rather than grants. Live: the Upstash SCAN read 5 `parle:*` keys, every segment a known literal or a 43-character base64url HMAC, 3 of them written by that run. | Behaviour under a real Upstash outage, as opposed to an injected failure, was not induced. |
| Upstash cross-instance limits and leases | F61 | `measured` | `npm run verify:upstash`, exit 0, 5 of 5 proofs. Two token servers on ports 53320 and 53324 sharing one Redis: requests split across both then both refused the next, a live session on A made B answer 409, only the matching id freed the lease, an abandoned lease lapsed on its TTL, and the key scan read 5 keys, all hashed. | Upstash under production concurrency and region latency. Two local processes are not a fleet. |
| Secret scanning of files, history and bundles | F62 | `measured` | `npm run scan:secrets` clean across the working tree. `npm run scan:secrets:history` found **5 critical findings in one commit**, `576bc53`, an `.env.bak-before-cli-all` carrying 4 distinct live vendor credentials. That commit is on two local `codex/*` branches and is **not** reachable from any remote ref. No value was printed at any point. | `--bundles` reported BLOCKED because no web build output exists. Run `npm run build:web` first. Rotation is a human action on four vendor consoles: see F80. |
| Supabase RLS, RPC privilege, debit concurrency, trial race, deletion cascade | F63 | `measured` | `npm run verify:supabase` against a disposable project. First run: **6 of 12 failed**, which is how F74 and F75 were found. After the three fix migrations, exit 0 and **12 of 12 proofs passed**, one row each in the run record below. | The production project, which does not exist yet. Two accounts are not a population, and no proof here was run under production concurrency, data volume or region latency. |
| Migration rollbacks and the apply runbook | F64 | `measured` | `databaseContract.test.ts` over 7 migrations and 7 down-scripts: each down-script names every object its migration created, `202608230001_down.sql` also restores the 2-argument `consume_entitlement` its migration dropped, the three function-body rollbacks each refuse to run without an interlock set in the same session, and `supabase/README.md` applies all 7 in order and pairs each with its rollback. | No rollback has ever been executed against a database. The scripts are read, not run, and the rollback-evidence procedure in the runbook has not been performed. |
| Voice lifecycle: expiry, caps, leases, hard stop, billing | F65 | `measured` | `npm run verify:voice`, 13 checks, 108.5s wall clock: **11 assertions held, 2 measurements recorded**, exit 0. Grants live 300s and a credential 90s past expiry is refused; `maxParticipants=2` held against a forged third identity; one grant and one 409 from the lease, released by the debit; the agent secret guarded the debit; a replayed `/session/end` changed nothing in the store file; a never-joined room debited 0s; a room with no learner turn debited 0s; the hard stop fired at **60.0s** against a seeded 60s allowance and the room was gone **20.1s** later. | Cloud LiveKit was not used; transport was a self-hosted server on 127.0.0.1. The 15-minute production hard stop was pinned by test, not run for 15 real minutes. |
| Safety net breadth | F66 | `measured` | `npm test -w @parle/tutor-agent`, 338 tests, 0 failing. 153 patterns, up from 33. 149 adversarial lines across 8 categories and 4 buckets each are caught, and a 51-line ordinary-French corpus still returns null. Normalisation sees through zero-width, homoglyph, spacing and leet forms. | A wider net is still a net. Nothing here bounds what a determined adult phrases around, which is exactly what F70 exists for. |
| Privacy and safety policy | F67 | `measured` | `docs/PRIVACY_AND_SAFETY.md` plus 4 tests in `safetyPolicy.test.ts`. Falsified by mutation: flipping one category action, replacing the disclaimer with an emergency-service claim, and blanking one retention cell each turned the suite red, and the doc was restored with a matching checksum. | A document is a promise, not an enforcement. Retention is asserted against copy, not against a database that holds rows. |
| CI on every push | F68 | `blocked-on:github-actions-run` | `.github/workflows/ci.yml` exists and `ciContract.test.ts` holds its three steps to real npm scripts pointing at files that exist. | The workflow has never executed. There is no Actions run, no runner log, and `npm ci` on a Linux runner is untested. |
| Dependency advisories | F69 | `accepted-with-evidence` | `npm audit` reaches the registry. **18 advisories: 0 critical, 7 high, 11 moderate**, reducing to four roots. `@expo/metro` 56.0.0 to 56.0.2 **fixed** the reachable one, which drops `image-size` from the bundler that `npm run web` actually runs. The other three roots, `image-size` on the React Native CLI chain, `adm-zip` under `onnxruntime-node`, and `uuid` under `xcode`, are accepted with reachability arguments recorded in `package.json` under `parle.dependencyAudit`, and `npm run audit:ci` refuses any high root that is not on that list, and equally refuses an acceptance whose advisory has gone away. | Reachability is an argument from reading, not from instrumentation. Nothing proved at runtime that `adm-zip` is never loaded outside `postinstall`. |
| Professional review of the safety policy | F70 | `blocked-on:external-safety-reviewer` | The policy carries a review package naming scope, corpus and the known limits of the net, so the request can go out the day someone is engaged. | Whether the policy is adequate. That judgement is not ours to record. |
| Device auth, storage and deletion journeys | F71 | `blocked-on:ios-and-android-builds` | `npm test -w @parle/mobile`, 299 tests, 0 failing. A source walk over all 16 auth files proves no bearer token reaches a log or plain storage and that a token leaves only in an authorization header. Refuted against a mirrored copy with 14 mutations, all of which went red, and 2 controls that stayed green. | Keychain and Keystore persistence, the plaintext migration, forced safe sign-in, reauth-before-deletion and bundle inspection. No representative build runs on this machine. |
| The evidence matrix itself | F72 | `measured` | This document and `evidenceContract.test.ts`, 12 tests. Every Phase 1 ledger entry appears once, every state parses to exactly one of three, every `measured` row carries a number, every blocker is repeated in the outstanding list below, and a database claim is refused unless the run record backs it proof by proof. | A contract test cannot check that a number is true, only that it is present, internally consistent and supported by a recorded run. |
| `claim_trial` grants the trial it should refuse | F73 | `measured` | Proven both ways. In SQL three-valued logic by `databaseContract.test.ts`, which evaluates the guard for `claimed` in true, false and null and reproduces the fall-through for the old `not claimed` form. Live, by `trial-refused-second-installation`: with `202608240001` applied, a second account on one device was refused, and one account signal was refused across devices. `trial-race` then granted exactly 1 of 6 simultaneous claims. | The production project. The migration has been applied to a disposable project and to nothing else, and applying `202608230001` without `202608240001` still makes the P0 live. |

## Supabase run record

`npm run verify:supabase` against a disposable project, 2026-08-25, final run: exit 0,
**12 of 12 proofs passed**. The proof ids come from `SUPABASE_PROOFS` in
`services/token-server/src/verify/supabaseLive.ts`, so a thirteenth proof makes this table
stale rather than making the document lucky.

| Proof | Outcome | What the run showed |
|---|---|---|
| `rls-two-user-isolation` | passed | neither signed-in learner could read the other account's rows |
| `forged-user-id-refused` | passed | a genuine token could not insert, update or delete under another user id |
| `anon-key-refused` | passed | the publishable anon key alone read nothing and wrote nothing |
| `rpc-privilege` | passed | anon and authenticated could not execute `claim_trial` or `consume_entitlement`; the service role could |
| `period-roll` | passed | an expired paid period rolled the allowance on the next authoritative read |
| `debit-concurrency` | passed | concurrent debits all landed, with no lost update |
| `session-replay` | passed | 120s billed once across two identical reports (600 -> 720), one ledger row |
| `cross-user-session-refused` | passed | a session id owned by another account was refused rather than merged |
| `trial-refused-second-installation` | passed | second account on one device refused, and one account signal refused across devices |
| `trial-race` | passed | exactly one of six simultaneous claims was granted |
| `product-event-trigger` | passed | valid events land, unsupported and malformed events are refused by name |
| `deletion-cascade` | passed | four learner tables cascaded to empty, the antifraud hash survived |

The first run of the same command was **6 of 12 failed**. That run is the reason this
document is worth anything: it found F74 and F75, two money and analytics defects that
every static test in the repo had read past.

## Found and fixed during Phase 1

Seven defects that were not in the plan. Five are closed, two are open at P2 and say so.
Same three states, same rules, checked by the same contract test.

| Finding | Ledger | State | Evidence: the run and its numbers | Not proven by that run |
|---|---|---|---|---|
| `consume_entitlement` bills a replayed session id every time | F74 | `measured` | Found live: one session id reported three times debited 120s, then 240s, then 540s, with exactly 1 row in `session_usage`. The same NULL-from-`RETURNING INTO` trap as F73. Fixed forward by `202608250001`, after which `session-replay` passed: 120s billed once across two identical reports, 600 -> 720. | The production project. `databaseContract.test.ts:260` had asserted the buggy line verbatim, so no static test will catch the next one of these either. |
| The product-event trigger calls a function PostgreSQL does not have | F75 | `measured` | Found live: a valid `my_french_opened` event was refused with 42883, because `jsonb_object_length` does not exist. Every analytics write in any deployment of this schema failed, silently, including the token server's own. Fixed forward by `202608250002`, after which `product-event-trigger` passed on all 3 arms. | The production project. Nothing measured how many events a deployed client would have lost, because no client has ever written to a deployed schema. |
| A learner who never speaks is billed for the whole session | F76 | `measured` | Found by the voice harness, not by reading: a room the harness never spoke in debited 60s. The `turnsCompleted === 0` guard read `state.turnIndex`, which the silence rescue advances. Fixed in both `tutor.ts` and `convo.ts` by billing off a `learnerTurns` counter that only a real learner input increments, and re-measured: `unusable-room-is-not-charged` now debits 0s. | Nothing bounds the other direction: a learner who says one word and hears nothing back is still billed for the session, and no run measured how often that happens. |
| A join credential re-opens a session that has already ended (**partial closure**) | F77 | `measured` | Measured: a captured 5-minute join credential re-created the closed room with 279s of TTL left, and LiveKit accepts credentials about 90s past `exp`. **Partially closed.** The room half could not be closed from `tokens.ts` at all: LiveKit re-creates a room from any valid credential and the token server is not in that path. What closed is the money and compute half, in the worker: the tutor now refuses to serve a session id it has already reported, so a replayed credential opens no scene and costs no model call. | The room itself. A replayed credential still creates an empty LiveKit room, and the refusal is worker-local, which is F79. |
| An abandoned room holds a tutor worker for half a minute | F78 | `measured` | The premise was wrong and the measurement refused it. Dispatch follows a participant, so no tutor is dispatched into a room nobody joined: measured, a room at `emptyTimeout=20` was held 20.1s with none dispatched, and a grant nobody joins leaves no room at all. Worker occupancy for an abandoned room is 0s. The timeout that actually holds a worker is `departureTimeout`, 20s shipped, measured at 20.6s. `ROOM_LIFECYCLE` in `tokens.ts` carries both numbers and their derived costs. | Cloud LiveKit dispatch, which may differ from the self-hosted server this ran against. |
| The replayed-credential refusal is worker-local | F79 | `accepted-with-evidence` | Open at P2, with the reasoning written down. The F77 refusal lives in one worker's memory, so it holds against the worker that served the original session — which is the whole fleet today, and is why this is not P1. A second worker, or the same worker after a restart, would not know. The durable fix already has a home: `session_usage` records every reported session id, so `server.ts` can consult it on the join path. That is a token-server change and was filed rather than reached for. | Nothing measured a two-worker fleet, because there is not one. Also unmeasured: `agent.ts` keeps a refused replay's job alive on its hard-stop timer, holding a worker slot at no vendor cost. |
| Four live vendor credentials sit in git history | F80 | `blocked-on:vendor-key-rotation` | Found by the F62 scanner on its first history run, which is the argument for having built it. Commit `576bc53` carries `services/tutor-agent/.env.bak-before-cli-all` with four keys. Verified by sha256 comparison, without either value being read, that all four are byte-identical to the keys in use today: they are live, not historical. The commit is **not** an ancestor of `main` and is on **no** remote branch, so nothing reached GitHub; it is held alive by two local `codex/*` refs. Every repo-side control is already in place: the scanner, `.gitignore:16` covering `**/.env.bak*`, and the CI step. | Whether anyone else has read them. Rotation is the only real remedy — a key written into a git object cannot be un-leaked — and it happens on four vendor consoles, not in this repo. Do not rewrite history to "fix" this: nothing was pushed, so there is nothing to rewrite. |

## Failed-room billing: the P0 the phase found, then closed

The live voice run refuted a claim this document previously made. `unusable-room-is-not-charged`
failed on the first run: a room the harness never took a learner turn in was debited 60
seconds. A learner with a dead microphone, a failed recogniser, or a room they could not
hear paid for the full session.

The cause was a guard that measured the wrong thing. Billing asked whether
`summary.turnsCompleted === 0`, and `turnsCompleted` was `state.turnIndex`, which the
silence rescue advances by applying a `silence` input. The guard was defeated by the
learner saying nothing, which is the exact case it existed for.

Both surfaces are fixed. `tutor.ts` and `convo.ts` each keep a `learnerTurns` counter that
only a real learner input increments, and each bills `learnerTurns > 0 ? wallClockSec : 0`.
A silence rescue no longer looks like a turn to the money path. The unit proof is
`a session with no learner turn bills nothing even after a silence rescue`; the live proof
is the re-run, where `unusable-room-is-not-charged` debited 0s.

## Vendor cost record

From the live run of `npm run verify:voice` on 2026-08-25, printed by the harness:

```
tutor-attended room seconds: 63.3s (modelled ceiling $0.0547)
transport:                   self-hosted ($0.0000)
worker vendor probes:        5 ($0.0020)
estimated vendor spend:      $0.0567 (upper bound: prices every attended second as a full spoken minute)
live budget:                 63.3s of 90s tutor-attended
wall clock:                  108.5s
```

Read it as a ceiling, not a bill. It prices every tutor-attended second at the full
cascaded rate from `DEFAULT_COST_MODEL` — recogniser $0.0043/min, brain $0.025/min, voice
$0.045/min at a 0.5 speaking share — which is what a session with a learner actually
talking costs. This run published no audio and ran the tutor voiceless, so the true spend
was lower. Transport was $0 because the harness runs its own `livekit-server`; on LiveKit
Cloud the same run would add about $0.0011 of connection minutes.

The number that matters for a budget is the rate, not the total: **about $0.052 per
tutor-attended minute**, which is roughly $0.78 for a fifteen-minute session at the hard
stop, and roughly $2.20 for a full trial allowance. That last figure is what one farmed
trial costs, which is why F73 is a P0.

## Measurements that are not assertions

The voice harness records LiveKit's actual behaviour where it differs from what we would
wish, rather than asserting a wish. Three results are worth carrying forward:

- **A join credential is a five-minute bearer token.** The same credential re-created the
  closed room with 279s of TTL left. Session end closes a room; it does not invalidate the
  credential that opened it. Filed and partially closed as F77.
- **LiveKit validates `exp` with between 30 and 90 seconds of leeway.** Credentials 3s and 30s
  past expiry were accepted; 90s and 900s past were refused. The five-minute TTL in
  `tokens.ts` is a floor on the replay window, not a ceiling.
- **An abandoned room does not hold a tutor, and F78 was filed believing it did.** Dispatch
  follows a participant, so a room nobody joins gets no tutor: held 20.1s at
  `emptyTimeout=20` with none dispatched, and a grant nobody joins leaves no room behind at
  all. Worker occupancy per abandoned room is 0s, not 30s. The timeout that does hold a
  worker is `departureTimeout=20`, measured at 20.6s after the learner left, which is the
  real concurrency ceiling: one session per slot per 20 seconds of turnover, whatever the
  sessions themselves cost.

## Feature matrix

Broader than Phase 1, and older. Rows that Phase 1 measured now say what was measured.

| Capability | Status | Repository evidence | Missing release evidence |
|---|---|---|---|
| Supabase identity | Implemented and tested locally | HS256 local compatibility, asymmetric JWKS preference, forged/expired/malformed-token tests | Live project JWKS, two-user HTTP tests |
| Production fail-closed mode | Implemented and tested locally, one path measured live | The live voice run confirmed a production boot on a `ws://` LiveKit URL is refused by name and the same boot on `wss://` is not | Actual store/web production build and deployment env |
| Native auth storage | Implemented and statically proven | Chunked A/B SecureStore adapter, encrypted readback migration, orphan cleanup, plaintext failure refusal, and a 16-file source walk refuted by 14 mutations | iOS Keychain and Android Keystore device tests, bundle inspection |
| Learner-state RLS | Measured against a disposable project | `rls-two-user-isolation`, `forged-user-id-refused` and `anon-key-refused` all passed against a real project with the schema applied | The production project, which does not exist. Population-scale behaviour and region latency |
| Atomic entitlements | Measured against a disposable project | `rpc-privilege`, `period-roll` and `debit-concurrency` passed: concurrent debits all landed with no lost update | Production concurrency, and a paid period that really elapsed rather than one seeded to look expired |
| Idempotent usage debit | Measured live twice, and fixed in between | Against the file store: a replayed `/session/end` changed nothing. Against Postgres: the first run billed a replayed id three times, `202608250001` fixed it, and `session-replay` then billed 120s once across two reports | The production project. F79: the worker-local half of the replay refusal is still not durable |
| One active session | Measured live | Two token servers on one Upstash: one grant and one 409, released only by the matching id, and an abandoned lease lapsed on its TTL | Behaviour across regions and a real deployment topology |
| Hard voice duration | Measured live | The hard stop fired at 60.0s against a seeded 60s allowance and the room left `listRooms` 20.1s later | The 15-minute production constant was pinned by test, not run for 15 real minutes |
| Failed-session billing | Refuted by measurement, then fixed and re-measured | A room with no learner turn was debited 60s. `learnerTurns` now gates billing in both `tutor.ts` and `convo.ts`, and the re-run debited 0s | A session that fails in some other way than silence: a recogniser outage mid-scene has never been induced live |
| Trial abuse boundary | Measured against a disposable project | `claim_trial` fell through on a null and granted every trial it should have refused. With `202608240001` applied, a second installation was refused and 1 of 6 racing claims was granted | Auth-side controls: CAPTCHA, email verification, reset analysis and alerting. And the production project |
| CORS and security headers | Implemented and tested locally | Exact-origin API policy, CSP/HSTS/no-store headers, web `_headers` | Final domains, hosting proof, live preflight/header capture |
| Distributed rate limits | Measured live | Requests split across two instances then both refused the next; every key segment hashed with the deployment salt; a forged forwarded header can no longer choose its bucket | Reverse-proxy hop count against a real topology |
| LiveKit least privilege | Measured live | Per-room token, microphone-only publish source, `maxParticipants=2` held against a forged third identity, expiry refused 90s out | Production WSS project. A five-minute join credential is still a replayable bearer token |
| Account deletion | Measured against a disposable project | `deletion-cascade` passed: four learner tables cascaded to empty and only the pseudonymous antifraud hash survived | Device journeys need builds, and reauth-before-deletion is still F71 |
| Analytics privacy | Measured against a disposable project, and fixed in between | The trigger rejected every write, including valid ones, until `202608250002`. `product-event-trigger` then passed on all 3 arms, and consent, opt-out and retention are stated in `PRIVACY_AND_SAFETY.md` | A direct-REST bypass attempt from a real client, and the disclosure surfaced in the product rather than in a document |
| Secret handling | Scanned; one historical leak found and not yet rotated | Working tree clean. History carries 5 critical findings in `576bc53` naming 4 live keys, on local `codex/*` branches only and on no remote | Rotation of all four keys, then a bundle scan after `npm run build:web` |
| Dependency security | Traced, one fixed and three accepted | 18 advisories, 0 critical, 7 high, 11 moderate, four roots. `@expo/metro` bumped to 56.0.2; `image-size`, `adm-zip` and `uuid` accepted with reachability arguments in `parle.dependencyAudit` | Runtime instrumentation rather than reading, and a deliberate `adm-zip` bump when the lockfile is next regenerated |
| Cross-device learner sync | Missing | `learner_state` table is only a server contract | Client transport, envelopes, revisions, conflict policy, offline queue |
| Purchase lifecycle | Missing | Plan economics and entitlement enforcement only | Store products, receipts, webhooks, restore, renew, cancel, refund/revoke |
| Tutor safety policy | Widened and documented | 153 deterministic patterns over 8 categories, 149 adversarial lines caught, 51 ordinary-French lines left alone, and a written policy with matching shipped copy | Professional review, live report workflow, in-app escalation UI |
| Onboarding redesign | Partially implemented | Missions, coach marks, sound check and onboarding tests exist | Duplicate welcome removal, age/readiness/AI disclosure, full visual QA |
| Practice redesign | Partially implemented | Review/drill/topic flows and curation exist | Retrieval-before-reveal across surfaces, durable batch/outbox, transfer flow |
| Retention system | Partially implemented | My French, daily goal/activity and mission evidence exist | Passport, Tomorrow Test, reduced-help replay, weekly story, notifications |
| Social systems | Superseded and scheduled for deletion | Fake/stale leaderboard/friend code identified | Removal after reference and persisted-data audit; no launch social backend |
| Privacy/legal surfaces | Policy written, product surfaces missing | `PRIVACY_AND_SAFETY.md` states retention, consent, escalation and the honest limits | Reviewed privacy/terms in the app, vendor/AI disclosure screens, export and memory controls |

## Current focused verification

- Full repository gate: **1,576 tests, 0 failing**; core 500, brain 306, tutor agent 338,
  token server 120, playground 13, mobile 299. Typecheck clean in all six workspaces.
- `npm run verify:upstash`: 5 of 5 proofs, exit 0.
- `npm run verify:supabase`: 12 of 12 proofs passed, exit 0, against a disposable project.
- `npm run verify:voice`: 13 checks, 11 assertions held, 2 measurements recorded, exit 0,
  108.5s.
- `npm run scan:secrets`: working tree clean. `--history`: 5 critical findings in one
  commit. `--bundles`: blocked on build output.
- `npm run audit:ci`: 0 critical, 7 high, 11 moderate, every high root recorded.
- Browser QA from the previous phase still stands: first-run and auth at 320, 390 and 1,280
  pixel widths, no horizontal overflow, compact-screen actions at least 44px, and the
  release export failing closed without Supabase configuration. Auth fields still have no
  programmatic labels and auth screens expose no heading roles; that remains a P1
  accessibility release blocker. Authenticated screens were not traversed.

## What is still outstanding

Each line names a blocker used in a table above.

- **`github-actions-run`** — push a branch and let `.github/workflows/ci.yml` execute once,
  so the workflow is proven on a Linux runner rather than only read.
- **`external-safety-reviewer`** — a qualified reviewer for the tutor-safety policy. The
  review package is written and waiting.
- **`ios-and-android-builds`** — representative device builds for Keychain and Keystore
  persistence, OAuth, microphone, deletion journeys and bundle inspection.
- **`vendor-key-rotation`** — rotate the Groq, Deepgram, ElevenLabs and LiveKit credentials
  found in commit `576bc53`. All four are still live. The commit is local-only today, and
  pushing either `codex/*` branch would publish them, so rotate before deciding what to do
  with those branches.

### Applying the schema to whatever project ships

Not a Phase 1 blocker, because the proofs have run. It is the single most dangerous
instruction in this document, because an operator who applies part of it deploys the two
money defects this phase found.

There are **seven migrations**, and all seven must be pasted, in this order, from
`supabase/README.md`:

1. `202608220001_parle_learning.sql` — the tables, the RLS policies, the first debit.
2. `202608230001_session_usage_idempotency.sql` — the usage ledger, the trial table,
   `claim_trial`, the session-aware debit, the product-event trigger.
3. `202608240001_claim_trial_null_fix.sql` — F73. Without it, every device that asks twice
   gets a fresh trial, at roughly $2.20 of vendor spend each.
4. `202608250001_consume_entitlement_null_fix.sql` — F74. Without it, every replayed
   session id bills the learner again.
5. `202608250002_product_event_key_count_fix.sql` — F75. Without it, every analytics write
   raises 42883 and every product event is lost, silently.
6. `202608260001_learner_state_revision.sql` — F84. Without it, `learner_state` has no
   ordering primitive, the device sync engine's compare-and-swap filters on a column that
   is not there, and no device can save its learner's state to the account at all.
7. `202608270001_onboarding_event_property_fix.sql` — F116. Without it, the trigger still
   demands the `motivationAnswered` property the client stopped sending when Phase 3 deleted
   the why page, so every `onboarding_completed` is refused and the onboarding funnel goes
   dark while every suite stays green.

Then reload the API schema cache and run `npm run verify:supabase` against that project.
Stopping after any of the first four leaves a known defect live, which is why the runbook
lists them as one operation and not as a menu.

Also required, though not a blocker for anything in the tables above:

- Final web domain and hosting configuration for CSP, HSTS, TLS and CORS.
- Store sandbox credentials and product decisions for purchases.
- The rollback-evidence procedure in `supabase/README.md` has never been executed. It needs
  a disposable project and about an hour.
- `SUPABASE_JWT_SECRET` is in the original credential request but is not read by the
  harness; only URL, service-role key and anon key are required.
