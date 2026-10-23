# Implementation evidence

Snapshot date: 2026-09-18, refreshed after the revamp A interaction-polish pass went green on
`claude/luvani-ui-revamp-d75581`. This document separates
what was measured on a machine from what is merely implemented. A passing local test is not
proof that a migration, a header, a credential, a provider or a store is live. The Phase 1
matrix and run record below remain historical evidence; later snapshots do not rewrite what
those runs established.

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

## Current landing snapshot

- 22 October 2026 main after landing Your French (`claude/your-french`, `claude/your-french-evidence`)
  on top of Steps 1–3, VOICE-005, the beta controls and the mission spine, at cb8c7a7e:
  **6,124 tests, 0 failing**; core 935, brain 498, tutor agent 661, token server 458,
  playground 26, mobile 3546. The floors were blessed on `claude/your-french`; this records
  the run they defend.
- 22 October 2026 mission spine A2 with F864 (goal words per mission) and F865 (postcards)
  merged in, on branch `claude/mission-spine-a2` at the merge cb3c2895 (held, not on main):
  **6,020 tests, 0 failing**; core 927, brain 488, tutor agent 659, token server 457,
  playground 26, mobile 3463. Floors raised only through `gate:bless`.
- 22 October 2026 mission spine A2 (twelve new missions, Everyday stage, twelve place
  drawings), on branch `claude/mission-spine-a2` at ba573bfd (held, not on main). The floors
  were blessed to this run in that commit, which did not record it here (added 22 October
  on `claude/goal-words-per-mission`):
  **6,017 tests, 0 failing**; core 927, brain 488, tutor agent 659, token server 457,
  playground 26, mobile 3460. Floors raised only through `gate:bless`.
- 22 October 2026 F865 postcards (a postcard of its own for each of the twelve new scenes), on
  branch `claude/mission-postcards`, on top of `claude/mission-spine-a2` (neither on main):
  **6,018 tests, 0 failing**; core 927, brain 488, tutor agent 659, token server 457,
  playground 26, mobile 3461. Floors raised only through `gate:bless`.
- 21 October 2026 direction B, ready to land (founder approved the side-by-sides; F846 and
  F847 closed with the back-disc test), on branch `claude/direction-b`:
  **5,859 tests, 0 failing**; core 825, brain 481, tutor agent 626, token server 456,
  playground 26, mobile 3445. Floors raised only through `gate:bless`.
- 21 October 2026 direction B review decisions (UI-009: the live mic is green, Review's
  "I said it" has no microphone glyph; the other five answers keep the code as it is), on
  branch `claude/direction-b` (held, not on main):
  **5,858 tests, 0 failing**; core 825, brain 481, tutor agent 626, token server 456,
  playground 26, mobile 3444. Floors raised only through `gate:bless`.
- 21 October 2026 direction B fidelity rebuild, simulator fixes (Drill card top border and end
  card figures, onboarding welcome drawing bleed, plan scene rows from one scene each), on
  branch `claude/direction-b` (held, not on main):
  **5,856 tests, 0 failing**; core 825, brain 481, tutor agent 626, token server 456,
  playground 26, mobile 3442. Floors raised only through `gate:bless`.
- 21 October 2026 direction B fidelity rebuild, step 12b (every signed-in route except the
  first scene follows the device theme; live flow, settings sub-routes and library screens
  converted), on branch `claude/direction-b` (held, not on main):
  **5,850 tests, 0 failing**; core 825, brain 481, tutor agent 626, token server 456,
  playground 26, mobile 3436. Floors raised only through `gate:bless`.
- 21 October 2026 direction B fidelity rebuild, steps 11 and 12 (onboarding to the B-OB
  artboards, pinned light; the paywall's dark variant with its design unchanged; the Streak
  calendar fixed to seven columns), on branch `claude/direction-b` (held, not on main):
  **5,845 tests, 0 failing**; core 825, brain 481, tutor agent 626, token server 456,
  playground 26, mobile 3431. Floors raised only through `gate:bless`.
- 21 October 2026 direction B fidelity rebuild, steps 8 to 10 (live room and help, After a
  session, Celebration, Recap, Review, Drill, empty states, Streak, Profile, Settings with
  Appearance), on branch `claude/direction-b` (held, not on main):
  **5,833 tests, 0 failing**; core 825, brain 481, tutor agent 626, token server 456,
  playground 26, mobile 3419. A Settings dark-mode fix after that run adds one test (3,420). Floors raised only through `gate:bless`. Review keeps no count
  and no intervals; the live pill is the scene's own length; the learner's lines are heard in
  the tutor's voice; Settings' long pages open as full light pages from dark mode.
- 21 October 2026 direction B fidelity rebuild, steps 6 and 7 (Practice, its empty state, Your
  fixes, Journey, Then and now, in light and dark), on branch `claude/direction-b` (held, not
  on main):
  **5,797 tests, 0 failing**; core 825, brain 481, tutor agent 626, token server 456,
  playground 26, mobile 3383. Floors raised only through `gate:bless`. Comes up often is
  shown from authored error patterns; Speak's remembered-topic chips need French and a
  short label; Scene preview names stages, never "Starting out".
- 21 October 2026 direction B fidelity rebuild, steps 4 and 5 (Explore, Scene preview and
  Speak to their artboards in light and dark), on branch `claude/direction-b` (held, not on
  main):
  **5,781 tests, 0 failing**; core 825, brain 481, tutor agent 626, token server 456,
  playground 26, mobile 3367. Floors raised only through `gate:bless`. Ledger ticks for
  F313, F325, F573 and F600 now name the rewritten tab bar and tutor row tests.
- 21 October 2026 direction B fidelity rebuild, steps 2 and 3 (Codex tab bar, Today to
  B-Today in light and dark), on branch `claude/direction-b` (held, not on main):
  **5,762 tests, 0 failing**; core 825, brain 481, tutor agent 626, token server 456,
  playground 26, mobile 3348. Floors raised only through `gate:bless`. A learning-science review asked
  for Coming up to need a stored "when" noted within 14 days; that fix and the
  attempt-first `momentShown` helper passed 186 focused tests. Side-by-side sheets are on
  the fidelity review page (https://claude.ai/artifact/LBjptRAoaNZRy9ESMb229a).
- 20 October 2026 direction B fidelity rebuild, step 1 (B tokens, theme hook, dark mode
  behind DARK_READY, canvas art, dev canvas learner), on branch `claude/direction-b` (held,
  not on main): **5,752 tests, 0 failing**; core 825, brain 481, tutor agent 626, token
  server 456, playground 26, mobile 3338. All six typechecks, 94 shared release/provider
  checks and eight database proofs pass. Floors raised only through `gate:bless`.
  Simulator A8293A24 in dark mode shows every route still light (DARK_READY empty).
- 20 October 2026 direction B, step B5 (Today), on branch `claude/direction-b` (held,
  not on main): **5,722 tests, 0 failing**; core 825, brain 481, tutor agent 626,
  token server 456, playground 26, mobile 3308. All six typechecks, eight database
  proofs and 94 shared release/provider checks pass. Floors raised only through
  `gate:bless`.
- 20 October 2026 direction B with main 48007621 merged in and the lock seam wired, on
  branch `claude/direction-b` (held, not on main): **5,709 tests, 0 failing**; core 825,
  brain 481, tutor agent 626, token server 456, playground 26, mobile 3295. All six
  typechecks, eight database proofs and 94 shared release/provider checks pass. Floors
  raised only through `gate:bless`.
- 20 October 2026 direction B, step B4 (Journey and Then and now), on branch
  `claude/direction-b` (held, not on main): **5,611 tests, 0 failing**; core 804,
  brain 481, tutor agent 622, token server 445, playground 26, mobile 3233. All six
  typechecks, eight database proofs and 94 shared release/provider checks pass. Floors
  raised only through `gate:bless`.
- 20 October 2026 direction B, step B3 (Practice, Your fixes and the Codex library
  port), on branch `claude/direction-b` (held, not on main): **5,576 tests, 0 failing**;
  core 804, brain 481, tutor agent 622, token server 445, playground 26, mobile 3198.
  All six typechecks, eight database proofs and 94 shared release/provider checks pass.
  Floors raised only through `gate:bless`.
- 20 October 2026 direction B, step B2 (Speak), on branch `claude/direction-b` (held,
  not on main): **5,540 tests, 0 failing**; core 804, brain 481, tutor agent 622,
  token server 445, playground 26, mobile 3162. All six typechecks, eight database
  proofs and 94 shared release/provider checks pass. Floors raised only through
  `gate:bless`.
- 20 October 2026 direction B, step B1 (Explore and Scene preview) with its
  learning-science fixes, on branch `claude/direction-b` (held, not on main):
  **5,509 tests, 0 failing**; core 804, brain 481, tutor agent 622, token server 445,
  playground 26, mobile 3131. All six typechecks, eight database proofs and 94 shared
  release/provider checks pass. Floors raised only through `gate:bless`.
- 20 October 2026 direction B, step B1 before its learning-science fixes, on branch
  `claude/direction-b` (held, not on main): **5,506 tests, 0 failing**; core 804, brain 481,
  tutor agent 622, token server 445, playground 26, mobile 3128. Floors raised only
  through `gate:bless`.
- 20 October 2026 direction B, step B0, on branch `claude/direction-b` (held, not on
  main): **5,474 tests, 0 failing**; core 804, brain 481, tutor agent 622, token server 445,
  playground 26, mobile 3096. All six typechecks, eight database proofs and 94 shared
  release/provider checks pass. Floors raised only through `gate:bless`.
- 7 October 2026 main integration: compared remote `7d399b79` with Come Alive
  `8f639d3f` from common base `47fbc2ea`. Retained all 13 main-only commits:
  Hum artwork/launch and loading holds, Expo 57.0.27 alignment, web render fixes,
  released-player cleanup and abandoned guest/drill take deletion. The recording
  fixes now coexist with metering, microphone focus and shared audio-session ownership.
  The only deleted source files are `recap/OnceConfetti.tsx` and `recap/OnceCount.tsx`,
  replaced by shared celebrations and `motion/CountUp.tsx`; no callers remain.
  Hum's legacy animation remains bounded and now pauses in the background.
- Combined verification: **4,920 tests, 0 failing**; core 794, brain 468, tutor agent 609,
  token server 425, playground 26, mobile 2598;
  all six typechecks, eight database proofs replaying every migration then on disk (39), and 77 shared
  release/provider checks pass. Floors raised only through `gate:bless`. A clean
  locked install, production web export and the existing dependency-audit policy pass.
  Local-development browser smoke verified launch-to-welcome, plan selection,
  missing-choice feedback and keyboard progression with no captured console errors.
  A production build without Auth configuration correctly refuses to run; the smoke
  used explicit development mode, not a deployed environment.
- Rollback: revert the integration merge with parent 1 to restore the previous main
  source. This does not undo the earlier staging migrations, stored learner data or
  native runtime changes; use the guarded migration procedures separately if needed.
  Main's existing open F794–F796 and the device/provider/store acceptance requirements
  remain visible. This integration does not certify production, an Android build or
  signed-device behavior. The other session's uncommitted TypeSafe/Jev work in the
  canonical checkout is excluded and untouched.

- 7 October 2026 Come Alive completion: **4,892 tests, 0 failing**; core 794,
  brain 468, tutor agent 609, token server 425, playground 26, mobile 2570.
  All six workspaces typecheck. The final local source snapshot ran every migration then on disk (39)
  through eight disposable SQL proof programs. All 77 shared release/provider checks pass, including the two decoder lease
  proofs. The complete gate is green with the raised workspace floors.
  This is branch evidence, not production deployment. Six Phase 4 branches and the
  recovered reminder repairs are integrated; F747–F750, F753, F778–F783 have local fixes. Follow-up F566 preserves refused conversation context after a confirmed purchase; F650 removes duplicate row separators; F302 requires individual passing test events for ledger proof.
- Staging Parle was explicitly identified by the owner and reconciled on 7 October:
  27 missing migrations applied, 39 source versions recorded, and the full catalog
  (47 tables, 85 routines, including managed default grants) matches the local replay.
  Existing account/state/pack/entitlement counts are unchanged. Source and capture
  hashes are recorded in `supabase/staging-verification.json`; runtime/provider/store
  acceptance remains separate. See `supabase/README.md` for the migration-history
  baseline and remaining Auth setting.
- Web Continue now exposes its disabled state while explaining missing choices.
  Browser verification exercised an unanswered pointer activation and confirmed
  keyboard Enter advances after choosing an answer; the native control is retained.
- F784 patches four newly reported dependency advisories with exact overrides:
  compression 1.8.2, shell-quote 1.11.0, source-map-js 1.2.2 and Sharp 0.35.5.
  Clean npm ci and targeted hostile-input/image compatibility tests pass.
  `audit:ci` passes with zero critical advisories; pre-existing time-limited
  braces/node-forge exceptions and the moderate uuid decision remain explicit.
  This is not a claim that the dependency tree has zero advisories.
- The production web export and unsigned iOS Simulator Xcode build succeed.
  Simulator Home and Progress and browser onboarding at phone/tablet widths were
  inspected. Device/store/provider acceptance remains pending as recorded in
  `DEVICE_VERIFICATION.md` and `RELEASE_GATE.md`. Cloud-offloaded parent metadata
  stalled verification on this Mac; the full suites also ran in an identical local
  source snapshot with disposable Git metadata retaining the original objects/index.

- The revamp A branch gate (`claude/luvani-ui-revamp-d75581`, on top of the app upgrade
  commit `17f4fb3`) passes **3,055 tests, 0 failing**; core 623, brain 395, tutor agent 446,
  token server 200, playground 26, mobile 1365. Typecheck is clean in all six workspaces. The
  interaction-polish pass embeds the ready action inside the watercolour orb, adds the selected-tab
  wash, tactile press states and native haptics, settles each onboarding page through the shared
  reduced-motion seam, and closes F593 and F594. It is a branch
  gate, not a release gate, and it was run from the worktree, which has its own
  `node_modules` (brain reports its full 395 there). What it covers: the design system of
  revamp A (tokens, the tinted row and the white cards, eighteen raster scenes through one
  decorative registry, the glyph set, the gradient orb; F569, F570, F583, F588, F589); the
  five tabs, the Progress, Phrasebook and Conversations screens, every pushed screen, the
  first run and the plans wall composed from it (F571 to F576, F584 to F587); the calendar
  week in the identity violet (F577); own words as a drill kind judged by the brain behind
  `POST /drill/judge` and typed in the app (F578 to F581); replay through the tutor's voice
  (F582); and the closing of F146, F383, F461, F462 and F522 by the same work. What it
  does not cover is on the `blocked-on` list and in Pass 8 of the device runbook: every one
  of its fifteen rows is `not run`, because the five tabs, the conversation, the wall and
  the first run were walked on the web build at 430 points only, never on a device, and
  nothing here proves the largest reading size, reduce motion, a screen reader, or Android
  graphics memory.
- The app upgrade branch gate (`claude/luvani-app-upgrade-63829f`, on top of the wall
  commit `ded101e`) passes **2,888 tests, 0 failing**; core 608, brain 385, tutor agent 445,
  token server 187, playground 26, mobile 1237. Typecheck is clean in all six workspaces and
  the floors were blessed to those counts as one act with writing this record. It is a branch
  gate, not a release gate, and it was run from the worktree, which has its own
  `node_modules` (brain reports its full 385 there). What it covers: `POST /billing/status`
  and the plan card (F540 to F542, closing F377); Home opening on one mission with a time
  line and "You can now" (F543 to F546); the Tutor tab's six doors, the continuity card, a
  real moment to rehearse and the moments store (F547 to F549, F565); the closure card,
  pack exercises, practised marks, the one continuable thread, Practice made from the
  learner's conversations with a starter set, and the replay moment (F550 to F558); My
  French leading with stamped situations (F559); the week story on Profile reading packs
  and completions, and the shared week rail (F560, F561); the tutor's memory as something
  the learner can see, forget and add a goal to, with the stored profile at version 8 and
  the tombstones unioned by the brain's merge (F562, F563). Not covered: F564 (the plans
  page's inclusions) and F566 to F568 wait for the other session's uncommitted wall work,
  which lives in the main checkout and was never staged here. Nothing in this branch has
  been seen on a device; the driven check was the web build in the in-app browser at 375 by
  667 and 460 wide, against the token server in local development mode with mock auth, and
  RevenueCat stayed dark throughout.

- Phase 6 is on `main`, both slices: 6a as the passport, the delayed test and the
  less-help replay, 6b as the honest reminder and the weekly story. The first device-build
  pass landed beside it, carrying the microphone defect F242 — the WebRTC shim ran after the
  check that asked whether a microphone existed, so every spoken mode on a phone refused a
  working one while web and every test passed. Nothing in either has been seen on a device.

- Phases 1, 2, 3, 4 and 5 are on `main`. Phase 2 includes the client sync engine, per-domain
  conflict policy, restart-safe dirty registry, fresh-device adoption and the revision
  migration. Phase 3 was merged as `2a86092`, Phase 4 as `f943bbe`, and Phase 5 as
  `1b37b81`. `phase-4-practice` was branched from the Phase 3 merge commit, and every one of
  those three branches has since been deleted, so the hashes are what find the work now.
- The Phase 6 retention gate, slices 6a and 6b, passes **2,125 tests, 0 failing**: core 549,
  brain 377, tutor agent 378, token server 136, playground 26, mobile 659. Typecheck is clean
  in all six workspaces. Floors were blessed to those counts as one act with writing this
  record, which is what `the newest recorded gate is the floor the gate defends` requires.
  This is a branch gate on `phase-6-retention` and not a release gate. It covers both slices:
  the passport, the delayed test and the less-help replay from 6a, and the daily reminder and
  the weekly story from 6b. F216 to F240 are closed apart from F237, a P2. No part of Phase 6
  has been seen on a device or a deployed database, no notification has been watched arriving
  on a phone, and every check under "What is still outstanding" is unclaimed.
- The Phase 6a retention gate passes **2,090 tests, 0 failing**: core 549, brain 377, tutor
  agent 378, token server 136, playground 26, mobile 624. Typecheck is clean in all six
  workspaces. Floors were blessed to those counts as one act with writing this record, which
  is what `the newest recorded gate is the floor the gate defends` requires. This is a branch
  gate on `phase-6-retention` and not a release gate. Slice 6a is what it covers: the
  passport, the delayed test and the less-help replay. Slice 6b was not built when it
  ran. No part of
  Phase 6 has been seen on a device or a deployed database, and every check under "What is
  still outstanding" is unclaimed.
- The `main` gate after the Phase 5 landing passes **2,053 tests, 0 failing**: core 543,
  brain 373, tutor agent 377, token server 132, playground 26, mobile 602. Typecheck is clean
  in all six workspaces. Floors were blessed to those counts, so the gate defends them now,
  and the test `the newest recorded gate is the floor the gate defends` holds this record and
  `scripts/gate.floors.json` equal from here on: recording a landing gate and blessing the
  floors are one act. It is still not a release gate. No part of any phase has been seen on a
  device or a deployed database, and every check under "What is still outstanding" is
  unclaimed.
- Phase 3 landed from `phase-3-onboarding`: one welcome, three onboarding pages,
  age-first gating, AI/vendor/microphone disclosure, labelled fields and headings, removal of
  the splash/why/duplicate welcome, attempt-audio cleanup, analytics contract repair, and the
  first-run mission-chooser reset. Its source contract is green and a driven local mock-auth
  web journey proved the `/` → onboarding → `/missions` path and one-shot reset; F58 is closed.
- The Phase 3 landing gate passes **1,791 tests, 0 failing**: core 507, brain 348, tutor agent
  350, token server 124, playground 13, mobile 449. Typecheck is clean in all six workspaces.
- Phase 4 landed as `f943bbe`: one phrase-evidence record in core with every
  other verdict projected from it, field-wise evidence merge that leaves scheduling alone,
  durable practice batches behind a `durable` or `failed` acknowledgement, retrieval before
  reveal on a due card, and transfer drills feeding the same record. F118 to F131 are closed.
- The Phase 5 tutor gate passes **2,003 tests, 0 failing**: core 543, brain 373, tutor agent
  377, token server 128, playground 26, mobile 556. Typecheck is clean in all six workspaces.
  Floors were blessed to those counts afterwards, so the gate defends them now. This is the
  whole of Phase 5, slices 1 and 2: every P0 and P1 the phase filed is closed against a named
  test. Six P2s stay open by choice. It is a branch gate and not a release gate, and no part
  of Phase 5 has been seen on a device or a deployed database.
- The Phase 5 slice 1 gate passed **1,906 tests, 0 failing**: core 533, brain 351, tutor agent
  360, token server 125, playground 13, mobile 524. Typecheck is clean in all six workspaces.
  Floors were blessed to those counts afterwards, so the gate defends them now. This covers
  slice 1 of Phase 5 only, the six P0s. It is a branch gate and not a release gate: 34 of the
  40 surveyed tutor gaps are still open, and no part of it has been seen on a device or a
  deployed database.
- The Phase 4 practice gate passes **1,865 tests, 0 failing**: core 524, brain 349, tutor agent
  350, token server 124, playground 13, mobile 505. Typecheck is clean in all six workspaces.
  Floors were blessed to those counts afterwards, so the gate defends them now. This is a
  branch gate and not a release gate: everything in "What is still outstanding" is still
  outstanding, and no part of Phase 4 has been seen on a device or a deployed database.
- `npm run build:web` succeeds. `npm run scan:secrets:bundles` is clean across **23 bundle
  files**, and the current reachable repository history scan is clean. The four vendor keys
  previously found in a local-only object still require rotation; pruning an object does not
  revoke a credential.
- The public web welcome and sign-up surfaces render with headings and labelled inputs and no
  desktop horizontal overflow. A local mock-auth account completed all three onboarding steps,
  landed at `/missions`, returned to `/home`, and stayed there across reload. A Supabase-auth
  run, five-viewport pass, native screen-reader pass and human stopwatch have not been run.
- At the previous checkpoint, all 26 schema files and 24 rollback scripts passed their static contract. Migration 7,
  `202608270001_onboarding_event_property_fix.sql`, has never been applied to any project.
  No schema is production evidence until all twelve are applied in order and the live verifier
  passes there.

## Historical Phase 1 baseline

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
| `LUVANI_RATE_LIMIT_SALT` | configured | 48 characters, present in `services/token-server/.env`; the live SCAN found 5 hashed `luvani:*` keys and no raw identifier |
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
| Trusted-proxy client address | F59 | `measured` | `npm test -w @luvani/token-server`, 120 tests, 0 failing. A forged multi-entry forwarded header resolves to the last entry under `LUVANI_TRUST_PROXY=1` and to the socket peer without it, so header rotation no longer moves the rate-limit bucket. | One trusted hop is assumed. A CDN-plus-load-balancer topology needs a hop count, and there is no deployment to measure one against. |
| Redis fail-closed and key hygiene | F60 | `measured` | Unit: a limiter failure refuses rather than grants. Live: the Upstash SCAN read 5 `luvani:*` keys, every segment a known literal or a 43-character base64url HMAC, 3 of them written by that run. | Behaviour under a real Upstash outage, as opposed to an injected failure, was not induced. |
| Upstash cross-instance limits and leases | F61 | `measured` | `npm run verify:upstash`, exit 0, 5 of 5 proofs. Two token servers on ports 53320 and 53324 sharing one Redis: requests split across both then both refused the next, a live session on A made B answer 409, only the matching id freed the lease, an abandoned lease lapsed on its TTL, and the key scan read 5 keys, all hashed. | Upstash under production concurrency and region latency. Two local processes are not a fleet. |
| Secret scanning of files, history and bundles | F62 | `measured` | `npm run scan:secrets` clean across the working tree. `npm run scan:secrets:history` found **5 critical findings in one commit**, `576bc53`, an `.env.bak-before-cli-all` carrying 4 distinct live vendor credentials. That commit is on two local `codex/*` branches and is **not** reachable from any remote ref. No value was printed at any point. | `--bundles` reported BLOCKED because no web build output exists. Run `npm run build:web` first. Rotation is a human action on four vendor consoles: see F80. |
| Supabase RLS, RPC privilege, debit concurrency, trial race, deletion cascade | F63 | `measured` | `npm run verify:supabase` against a disposable project. First run: **6 of 12 failed**, which is how F74 and F75 were found. After the three fix migrations, exit 0 and **12 of 12 proofs passed**, one row each in the run record below. | The production project, which does not exist yet. Two accounts are not a population, and no proof here was run under production concurrency, data volume or region latency. |
| Migration rollbacks and the apply runbook | F64 | `measured` | `databaseContract.test.ts` at the previous checkpoint over 26 schema files and 26 down-scripts: each down-script names every object its migration created, `202608230001_down.sql` also restores the 2-argument `consume_entitlement` its migration dropped, hazardous function-body rollbacks refuse to run without their interlocks, and `supabase/README.md` applies all 26 in order and pairs each with its rollback. The added atomic-billing migration has disposable PostgreSQL/WASM transaction evidence, not live deployment proof. | No rollback has been executed against the hosted database. The rollback-evidence procedure in the runbook has not been performed. |
| Voice lifecycle: expiry, caps, leases, hard stop, billing | F65 | `measured` | `npm run verify:voice`, 13 checks, 108.5s wall clock: **11 assertions held, 2 measurements recorded**, exit 0. Grants live 300s and a credential 90s past expiry is refused; `maxParticipants=2` held against a forged third identity; one grant and one 409 from the lease, released by the debit; the agent secret guarded the debit; a replayed `/session/end` changed nothing in the store file; a never-joined room debited 0s; a room with no learner turn debited 0s; the hard stop fired at **60.0s** against a seeded 60s allowance and the room was gone **20.1s** later. | Cloud LiveKit was not used; transport was a self-hosted server on 127.0.0.1. The 15-minute production hard stop was pinned by test, not run for 15 real minutes. |
| Safety net breadth | F66 | `measured` | `npm test -w @luvani/tutor-agent`, 338 tests, 0 failing. 153 patterns, up from 33. 149 adversarial lines across 8 categories and 4 buckets each are caught, and a 51-line ordinary-French corpus still returns null. Normalisation sees through zero-width, homoglyph, spacing and leet forms. | A wider net is still a net. Nothing here bounds what a determined adult phrases around, which is exactly what F70 exists for. |
| Privacy and safety policy | F67 | `measured` | `docs/PRIVACY_AND_SAFETY.md` plus 4 tests in `safetyPolicy.test.ts`. Falsified by mutation: flipping one category action, replacing the disclaimer with an emergency-service claim, and blanking one retention cell each turned the suite red, and the doc was restored with a matching checksum. | A document is a promise, not an enforcement. Retention is asserted against copy, not against a database that holds rows. |
| CI on every push | F68 | `blocked-on:github-actions-run` | `.github/workflows/ci.yml` exists and `ciContract.test.ts` holds its three steps to real npm scripts pointing at files that exist. | The workflow has never executed. There is no Actions run, no runner log, and `npm ci` on a Linux runner is untested. |
| Dependency advisories | F69 | `accepted-with-evidence` | `npm audit` reaches the registry. **18 advisories: 0 critical, 7 high, 11 moderate**, reducing to four roots. `@expo/metro` 56.0.0 to 56.0.2 **fixed** the reachable one, which drops `image-size` from the bundler that `npm run web` actually runs. The other three roots, `image-size` on the React Native CLI chain, `adm-zip` under `onnxruntime-node`, and `uuid` under `xcode`, are accepted with reachability arguments recorded in `package.json` under `luvani.dependencyAudit`, and `npm run audit:ci` refuses any high root that is not on that list, and equally refuses an acceptance whose advisory has gone away. | Reachability is an argument from reading, not from instrumentation. Nothing proved at runtime that `adm-zip` is never loaded outside `postinstall`. |
| Professional review of the safety policy | F70 | `blocked-on:external-safety-reviewer` | The policy carries a review package naming scope, corpus and the known limits of the net, so the request can go out the day someone is engaged. | Whether the policy is adequate. That judgement is not ours to record. |
| Device auth, storage and deletion journeys | F71 | `blocked-on:ios-and-android-builds` | `npm test -w @luvani/mobile`, 299 tests, 0 failing. A source walk over all 16 auth files proves no bearer token reaches a log or plain storage and that a token leaves only in an authorization header. Refuted against a mirrored copy with 14 mutations, all of which went red, and 2 controls that stayed green. | Keychain and Keystore persistence, the plaintext migration, forced safe sign-in, reauth-before-deletion and bundle inspection. No representative build runs on this machine. |
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
| Secret handling | Working tree, reachable history and built bundles scanned; rotation still outstanding | Current scans are clean, including 23 web bundle files. Phase 1 found 5 critical findings in local-only commit `576bc53`, naming 4 live keys; the object is now pruned and was on no remote | Rotation of all four keys. Repository cleanup does not revoke a credential |
| Dependency security | Traced, one fixed and three accepted | 18 advisories, 0 critical, 7 high, 11 moderate, four roots. `@expo/metro` bumped to 56.0.2; `image-size`, `adm-zip` and `uuid` accepted with reachability arguments in `luvani.dependencyAudit` | Runtime instrumentation rather than reading, and a deliberate `adm-zip` bump when the lockfile is next regenerated |
| Cross-device learner sync | Implemented and tested locally | State envelopes, compare-and-swap revisions, per-domain merge policy, restart-safe dirty registry, fresh-device adoption and two-device simulation tests | Run `npm run verify:sync` against a live project and walk convergence on two real app devices |
| Purchase lifecycle | Implemented and tested locally, dark by configuration | RevenueCat subscriber projection is the server authority; webhook replay is deduped before vendor refresh; learner refresh is authenticated and bounded; the native adapter owns purchase/restore; the paywall renders only a real store offering and localized price; paid lapse is distinct from an exhausted trial | Store products and credentials, then sandbox purchase, renewal, cancel, refund/revoke and restore on iOS and Android |
| Tutor safety policy | Widened and documented | 153 deterministic patterns over 8 categories, 149 adversarial lines caught, 51 ordinary-French lines left alone, and a written policy with matching shipped copy | Professional review, live report workflow, in-app escalation UI |
| Onboarding redesign | Implemented and tested locally on Phase 3 | One welcome, age-first three-page flow, AI/vendor/mic disclosure, chooser landing, labelled fields/headings, returning-device adoption and audio cleanup | Native and five-viewport visual/accessibility QA, human time-to-first-French measurement, migration 7 deployment |
| Practice redesign | Partially implemented | Review/drill/topic flows and curation exist | Retrieval-before-reveal across surfaces, durable batch/outbox, transfer flow |
| Retention system | Implemented and tested locally, landed on `main` as `eee755c` | My French, daily goal/activity and mission evidence exist. Slice 6a added the passport, the delayed test and the less-help replay; slice 6b added the daily reminder and the weekly story. Each has code and a named test, and F216 to F240 are closed apart from one P2 | Every one of those five surfaces on a device, which nobody has run, and a reminder actually arriving on a phone, which needs a development build no one has made |
| Social systems | Superseded and scheduled for deletion | Fake/stale leaderboard/friend code identified | Removal after reference and persisted-data audit; no launch social backend |
| Privacy/legal surfaces | First-run disclosure, authenticated deletion and complete JSON export implemented and tested locally | `PRIVACY_AND_SAFETY.md`, shared first-run disclosure copy, Profile's Download my data action, authenticated `/account/export` and matching ownership tests | Professionally reviewed privacy/terms, vendor-retention verification, device export/deletion journeys and deployed-schema evidence |

## Current focused verification

- Two tiers and the plans page gate: **2,855 tests, 0 failing**; core 608, brain 383,
  tutor agent 445, token server 183, playground 26, mobile 1210. Floors blessed to those counts.
  F519, F520 and F521 closed; F522 filed open; F516's evidence moved with a renamed test.
  The second tier is buyable. It was mapped on the server, configured for, and priced, and had no
  purchase path at all because `StoreProduct.plan` was a string literal. Page four compares the two
  with every number off the wire, selects rather than buys so the one primary pill stays in the
  frame, and carries the subscription length, the renewal and both legal documents, which meant
  promoting two screens that were sheets inside Settings into routes.
  Two founder videos landed mid-build and both were folded in. The problem-first argument applies
  only once the welcome path is walked, because before then there is no gap to name and opening on
  four things a learner cannot do is the failure mode two rejected designs already had. The
  soft-wall argument turned out to describe something the wall already was and never said: the line
  that says it was written and rendered nowhere. A decoy tier was refused, and the refusal is held
  by a test asserting the dearer tier is genuinely the better rate, so a future price change that
  inverted that fails rather than quietly misleading.
  Three things were found by driving it rather than by reading it. The `outOfMinutes` and
  `startOwnership` suites lift the hook's own branches and `eval` them, so a new dependency has to
  be handed to their injected worlds; the 402 test now asserts the wall is given the same catalogue
  the screen is. The plans page had no minutes in preview, because the catalogue is deliberately
  server-only, so the preview build seeds it from core behind the same three-condition gate and a
  test names that as the one compiled allowance in the repo. And the plan cards announced no
  selected state at all on the web, which is F522: React Native Web reads `aria-selected` and not
  `accessibilityState.selected`, so `OptionCard` and `TabBar` have the same gap and native is fine.

- Wall value pages gate: **2,836 tests, 0 failing**; core 608, brain 383, tutor agent 445,
  token server 183, playground 26, mobile 1191. Floors blessed to those counts. F518 closed.
  The wall has a face. Three pages, a route above the tabs the way Settings is, and a web address
  of its own, all of it drawn and driven in a browser rather than asserted: the empty state showing
  four white cards naming four capabilities, then the same page with the cafe on its sand tint and
  the hotel on its sky one, each reading its authored win and each carrying a line of French the
  learner said, then the growth page with a real count and the learner's own chips, then the page
  that promises what stays.
  Page four is absent rather than stubbed, and the page count follows: three dots, and the last
  action says keep practising instead of offering a plan that cannot be bought. That is the same
  path a web learner takes and the same path every build takes until the RevenueCat keys exist, so
  what was reviewed is what a keyless build actually does.
  Getting there found one real thing. The wall reached for `missionStates` with the store's own
  `MissionCompletion`, whose `id` is a plain string because a disk read cannot promise the id names
  a mission this build has. Every other screen goes through `missionCompletionsFrom` first, and the
  typechecker refused the shortcut before a screen could quietly draw a row for a mission that no
  longer exists.
  The preview switch is gated on three conditions at once, the way the token server's development
  entitlement store is, and the one that matters has its own test: a production build refuses it
  however loudly the flags are set.

- Wall decisions gate: **2,832 tests, 0 failing**; core 608, brain 383, tutor agent 445,
  token server 183, playground 26, mobile 1187. Floors blessed to those counts. F517 closed.
  Everything the wall decides now lives in plain modules that can be called, because apps/mobile
  has no renderer and a decision inside a `.tsx` is a decision nothing can ask a question about.
  The copy deck is thirty seven lines, every one checked against the real guilt list rather than
  reviewed by eye, with no digit and no currency symbol anywhere: every number the wall shows comes
  off the wire, a price from the store's own localised string and an allowance from the catalogue
  the server sends. A scan also refuses any line that counts the situations or the plans, and it
  caught one on the way in. "Two plans" was true when it was written and would have gone stale
  silently, because prose does not typecheck.
  The page list is computed, for three reasons that each bite. Page four cannot exist without a
  store, so a hardcoded four would draw a dot onto a page that is never coming, and three pages
  standing alone is what lets all of this be reviewed before the first RevenueCat key exists.
  Somebody arriving from the Settings row goes straight to the price, because walking a decided
  customer through their own progress is a pitch delivered to somebody who already said yes. And
  `ProgressDots` takes a total, so a total that lies tells a learner the wall is longer than it is
  at the moment they are deciding whether to continue.
  `WallPage` and `WallEntry` are also two analytics events' property values, and the compiler
  cannot see that both sides are string unions that happen to agree. A test reads it out of the two
  files instead: adding a fifth page fails by name, because a funnel split by a different set of
  doors than the code has is a funnel nobody can read.

- Wall first page gate: **2,814 tests, 0 failing**; core 608, brain 383, tutor agent 445,
  token server 183, playground 26, mobile 1169. Floors blessed to those counts. F516 closed.
  The free tier has a shape now, and it needed no new content. `MISSIONS` was already six authored
  situations each ending in a checkable fact rather than praise, so the welcome path is four of
  those six drawn rather than anything written. Four and not six because thirty minutes across six
  scenes leaves no slack once `MIN_VIABLE_SESSION_SEC` makes the last two unusable, and because
  holding two back gives the wall two authored capabilities to name instead of selling in the
  abstract.
  The property this page exists for is that it cannot be near-empty: four rows whether the learner
  walked none or all four, a walked room reading its own `winEn` and an unwalked one its own
  `goalEn`. Mutation tested from the failure mode the two rejected designs both had. Filtering the
  unwalked rows out fails the four-rows test by name.
  A row lights off `timesFinished > 0`, never `state` and never `isStamped`. `state` moves when the
  review scheduler moves, so a row would go dark on a calendar; `isStamped` is true only at
  `on-your-own`, so a learner who finished all four at a low rung would have read a completion line
  over four empty marks. Nothing a row carries is about payment, held by a scan, so the picture
  would be identical if the app were free.
  The join under each lit row is new work rather than a new mechanism. `mission.phraseKeys` and the
  review deck already share one identity scheme, so core has brought them together since F-whenever
  in `stateFor` -- but only to ask whether a mission is due. Nobody had asked which line the learner
  actually said in that room. Borrowing a phrase from another room fails a test by name.

- Wall analytics gate: **2,796 tests, 0 failing**; core 608, brain 383, tutor agent 445,
  token server 183, playground 26, mobile 1151. Floors blessed to those counts. F515 closed.
  The subscription wall's five events land across the three layers that have to agree: the
  `ProductEvent` union, `parseProductEvent`, and the `validate_product_event` trigger, the last
  as migration 14. Applying fewer than all three does not produce an error anybody sees. The
  server turns a rejected write into a 500 and the client swallows it by design, so the funnel
  would simply be dark, which is exactly how F116 survived a release.
  Nothing in these five can carry learner content. `plan` is our own tier id and never a price,
  `entry`, `page` and `outcome` are closed sets, and `pages` and `index` are bounded integers.
  A monetisation funnel is precisely where somebody reaches for a free string to make a report
  richer, so a test now reads the union and refuses `string` on any wall property. Reverting one
  to `string` fails it by name.
  The privacy notice moved with the count. It says how many events exist, read off the union
  rather than trusted, so the day an eleventh lands the notice fails instead of quietly becoming
  untrue. It went from five to ten, the example sentence now mentions a subscription page as well
  as a finished situation, and the hosted privacy page was regenerated from the module.

- Billing honesty gate: **2,794 tests, 0 failing**; core 608, brain 383, tutor agent 445,
  token server 183, playground 26, mobile 1149. Floors blessed to those counts. F265 raised to P1
  and closed, F513 and F514 closed.
  F265 was the load-bearing one. `/billing/refresh` answered `{ refreshed: true }` whatever the
  projection said, and the client returned `response.ok`, so a learner who owned nothing produced
  the same value as a learner whose subscription had just been verified. The paywall read that as
  success, said their speaking time was ready, and hid the buy and restore buttons behind the
  sentence. Every candidate design for the subscription wall cleared its gate on that same value,
  which is why it was fixed before any of them was built rather than after.
  F513 was found while widening the adapter for a second buyable tier and is money rather than
  copy: the allowance reset compared the plan as well as the period, so any crossgrade cleared the
  meter, and on a store whose proration keeps the expiry date that was a fresh allowance per
  switch. Both fixes were mutation tested. Reverting either one fails the test that names it, which
  is recorded here because the counterfactual is the only evidence a guard is a guard.

- Max allowance gate: **2,789 tests, 0 failing**; core 608, brain 383, tutor agent 445,
  token server 178, playground 26, mobile 1149. Floors blessed to those counts. F512 closed.
  The second paid tier moved from 450 minutes at $39 to 300 at $29, and the price is what forced
  the minutes: 450 minutes cost about $26.01 to serve against $24.65 net at $29, a worst-case
  margin of minus 5.5%, so the old allowance at the new price was a loss on the heaviest
  subscriber. The floor is a strict inequality and breaks at 341 minutes.
  The change was larger than one constant and that is the part worth recording. Seven SQL files
  under `supabase/` carry their own copy of the allowance table and `databaseContract.test.ts`
  holds every one of them equal to `PLANS`, so the constant moved eight files with it, plus a
  thirteenth migration to replace the function body on a database that had already run the old
  one. Nothing pinned `secondsPerPeriod` before this, so the size of the job was discovered by
  running the suite rather than known by reading it; there is now a pin beside the price pin.
  No learner moved. `paidPlan` is reachable only through a billing configuration that is
  all-or-nothing over five unset environment variables, so no entitlement row carries `regular`.

- Spoken-English normalizer gate: **2,788 tests, 0 failing**; core 607, brain 383, tutor agent 445,
  token server 178, playground 26, mobile 1149. Floors blessed to those counts. F511 closed and
  F509 re-scoped. F509 was filed believing the live session's English sounded American because it
  reaches the vendor with no French around it; that premise was wrong, because the accent follows
  the recording and F502 already fixed it for both paths. Enumerating every English line the tutor
  actually speaks found the real exposure instead: `language_code: 'fr'` puts a French text
  normalizer on English, and two of the eight safety messages spoke a bare digit through it. Those
  lines are uninterruptible, never warm-cached, and on a stop one of them is the last thing a
  learner hears, so a threshold read as "treize" is a refusal that does not land. Both are words
  now and the privacy doc moved with them. The same sweep found the conversation-line digit rule
  was reading two of three fields, exempting `bridge.spoken` — the hybrid said into every scene and
  the most-spoken string in the product. Both guards were mutation-tested: reintroducing a digit
  fails each one. What stays open on F509 is the generated half, which no schema can gate because
  `contract/schemas.ts:13-17` records that no regex survives to the API, and the vendor's actual
  normalizer behaviour, which needs an ear.

- Voice roster and sample gate, merged with the Profile and Settings split: **2,787 tests, 0
  failing**; core 607, brain 383, tutor agent 444, token server 178, playground 26, mobile 1149.
  Typecheck clean in all six workspaces and floors blessed to those counts. F502 to F508 closed,
  F509 filed open, F510 found by the merge itself. The tutor said its English half in an American
  accent, and three explanations were tried in order: the request shape (one sentence carrying both
  languages) did nothing, because the accent follows the recording and not the request; the vendor's
  own `en-french` label narrowed the field but turned out to vary per recording; only an ear
  separates the voices that honour it. All sixteen candidates were synthesised saying one identical
  English sentence through the real pipeline and the founder picked six. What is verified by machine
  is the provenance: every clip records its text, both requests, the voice key, the rate, its sha256
  and what the vendor had verified about that recording, and the suite compares all of it against
  the committed bytes offline. What cannot be is the accent, so each clip carries a dated line from
  the person who played it and the gate refuses while any is blank. F510 is the defect the merge
  exposed and nothing else could have: retiring five voice keys made the pre-account draft loader
  discard any draft naming one, taking the age confirmation and the usage-data answer with it. Rate
  is capped at 22050 by the ElevenLabs tier (`pcm_44100` returns 403); within that the clips are 64
  kbps at maximum codec quality, levelled to -1 dBFS, and `encoding` is pinned like every other knob.

- My French colour-and-panels gate: **2,703 tests, 0 failing**; core 605, brain 383, tutor agent 434,
  token server 178, playground 26, mobile 1077. Typecheck is clean in all six workspaces and floors
  were blessed to those counts. F467 to F470, the second pass over the same mockup. F467 widened the
  tint rule deliberately: a tint is a surface, so it is the disc under a drawing OR the ground under
  a row about that place, and every situation row now carries its place's colour. All five records of
  the old sentence were rewritten and the enforcing test got stricter, because its ban read
  `borderColor` case-sensitively and missed `backgroundColor` by accident rather than by permission.
  F468 persisted the phoneme a sound check names, which the assessor had always known and always
  discarded; the key is nullable at `version: 1` because this store has no upgrade function and a
  bump would have deleted every learner's checks. That unlocked the acoustic panel, which is
  authored `phonemes/` content that had never been drawn on this tab. F469 surfaced ten connectors
  already in `DAILY_WORDS`, marked when the learner has produced them unprompted. F470 holds every
  component here that can start a voice to stopping it, which is F304 on a new surface.
  Three things the mockup asked for were refused rather than approximated: the per-situation
  percentages (no denominator exists and `passport.ts` omits the fields so none can be computed),
  the per-word "Mastered" badge (no per-word pronunciation history exists), and "Record variation"
  (`PRIVACY_AND_SAFETY.md` makes keeping learner audio a consent and disclosure change, not a branch).
  What this does NOT prove: none of it has been seen on a device, and the largest-text-size walk that
  found F383, F461 and F462 on this same tab has still not been repeated against the new layout.
- My French evidence-ledger gate: **2,668 tests, 0 failing**; core 601, brain 383, tutor agent 434,
  token server 178, playground 26, mobile 1046. Typecheck is clean in all six workspaces and floors
  were blessed to those counts. F463 to F466: My French was rebuilt around `review/evidence.ts`'s
  ladder rather than around recency, so the tab's unit is the phrase where Practice's is the session.
  It opens on one card from the deck with the French withheld until an attempt lands, chosen by
  `myfrench/oneLine.ts`'s four tiers and graded through the existing `gradeCard`, so a visit raises
  real retrieval evidence rather than a view count; under it a Spoken Map and Memory Deck switch,
  absent whenever one half would be empty. Six new logic modules carry every judgement the screen
  used to make. The mockup's per-situation percentages were not implemented in any form and no
  replacement was invented: `progress/passport.ts` omits the fields so the fraction cannot be drawn.
  F466 was a live defect on the shipped Review screen found while building the card, not new work.
  What this does NOT prove: none of it has been seen on a device, and the largest-text-size walk that
  found F383, F461 and F462 on this same tab has not been repeated against the new layout.
- Pass 4 mockup-review gate: **2,416 tests, 0 failing**; core 565, brain 382, tutor agent 430,
  token server 172, playground 26, mobile 841. Typecheck is clean in all six workspaces and floors
  were blessed to those counts. F362 to F381: fifteen Stitch mockups were reviewed and the ideas
  that fit were folded into the existing structure, with tinted discs under mission art, one shared
  next-situation card on Home and My French, the Tutor tab's doors as cards, Practice's next step as
  the tab's pill, My French's evidence row, Profile's goal and corrections chosen in place, stored
  preferences for typing and for a slower tutor, the replay ear and the tutor's name in the
  transcript, Show/Hide on password fields, and sign in with Apple where the platform offers it.
  Three ticked earlier entries (F339, F346, F347) named tests this pass renamed; each now names its
  successor. Every tab and both auth screens were walked by eye on the web build with the mock
  account. The Apple sheet, the lit ear, the slow first line and the typed-by-default opening are
  device rows P4-1 to P4-6 in DEVICE_VERIFICATION.md, all not run.
- Learner tutor-voice picker gate: **2,301 tests, 0 failing**; core 565, brain 380, tutor agent 429,
  token server 172, playground 26, mobile 729. Typecheck is clean in all six workspaces and floors
  were blessed to those counts. F299 is the entry worth reading: the app statically `require()`s
  all eight voice clips, the clips had never been generated, and so `expo export` failed to resolve
  them and no screen loaded on any platform — while 2,298 tests and a clean typecheck said green.
  The gate does not bundle, and nothing in it could see this. F295 had been ticked against a test
  that returned early when zero clips were present, which is exactly the state the app cannot be
  built in; that tick was withdrawn and re-earned once the check became unconditional and was
  mutation-verified. F282 to F297: the learner chooses their tutor's voice from eight
  ElevenLabs library voices, each verified for French and English and each present in the account.
  The catalogue lives in core keyed by app-level names rather than vendor ids, so a re-clone or a
  vendor move is a one-table edit; vendor ids stay in the agent, where a `Record<TutorVoiceKey,
  string>` makes a missing one a compile error. The choice rides `/session/start` beside `missionId`,
  shape-checked at the token server and authoritatively resolved in the agent — the only process
  holding the vendor key and the last hop before a billed URL — so nothing the app sends can become
  a vendor id. The profile stores it at version 6 and syncs it as an answered question. The persona
  follows the voice through both prompts and all twelve app call sites, because two of the eight
  voices are women and Luc is a written character; with F281's home town already gone, F292 removes
  the age for the same reason. First run introduces the voices, plays a sample of each, and can be
  skipped, leaving the default chosen.
- Luc's biography and the Luvani rename gate: **2,245 tests, 0 failing**; core 563, brain 378,
  tutor agent 401, token server 170, playground 26, mobile 707. Typecheck is clean in all six
  workspaces and floors were blessed to those counts. F281: both prompts and the first-run copy
  stop giving Luc a home town, because the founder chose a Québécois voice for him and a persona
  may assert only what every voice in the catalogue could plausibly claim. The bar, the twenty
  years, the age and the not-a-teacher all stay — no accent contradicts any of them. The existing
  "he is from somewhere" assertion was re-pointed at `ran a bar` rather than deleted, so the
  guarantee it held is unchanged. This gate also covers the repository-wide Parle to Luvani
  rename, which is complete and coherent: zero `@parle/` and zero `Parle` remain in tracked
  source, and the suite counts are identical either side of it.
- fish.audio voice-vendor seam gate: **2,243 tests, 0 failing**; core 563, brain 377,
  tutor agent 401, token server 170, playground 26, mobile 706. Typecheck is clean in all six
  workspaces and floors were blessed to those counts. F275 to F280: `buildTTS()` now selects a
  TTS vendor from `LUVANI_TTS_VENDOR`, defaulting to ElevenLabs with a byte-identical voiceKey so
  the warmed cache keeps hitting; fish.audio is the second implementation, pinned to the only
  model its free tier serves. Fish never reliably marks a stream final — its HTTP path hardcodes
  `final: false` and its websocket path marks it only on a non-empty flush remainder — so a
  hold-last-packet adapter supplies the marker on clean completion and withholds it on error or
  abort, leaving `ttsCache.ts` and its truncated-line guarantee untouched. Preflight, the dev
  supervisor, the warm run and the secret scanner all became vendor-aware. Verified against the
  live vendors: ElevenLabs' free tier refuses every native French voice (402 `paid_plan_required`)
  while fish's free tier serves them, which is the reason this seam exists.
- Local dev loop and auth repair gate: **2,221 tests, 0 failing**; core 563, brain 377,
  tutor agent 381, token server 168, playground 26, mobile 706. Typecheck is clean in all
  six workspaces and floors were blessed to those counts. F258 to F262: the development
  CORS origins are now derived from `APP_PORT`, so `npm run dev` no longer serves the app
  on a port its own token server answers 403 to; the auth adapter is wrapped so a provider
  that throws becomes a sentence rather than a button stuck on "Signing in…"; Google
  sign-in asks whether the provider is enabled before it navigates the tab away; and the
  README's by-hand block no longer names a script that exits on a laptop. Found by
  reproducing a founder report against the running local stack rather than from the suite.
- Full Phase 8 local privacy gate: **2,185 tests, 0 failing**; core 563, brain 377,
  tutor agent 378, token server 165, playground 26, mobile 676. Typecheck is clean in all
  six workspaces and floors were blessed to those counts. The authenticated export proves
  that every server table is filtered to the bearer-resolved learner and that every
  per-user device key joins the JSON file. This is local code evidence, not a completed
  release gate; `docs/RELEASE_GATE.md` records the external evidence still required.
- Full Phase 7 revenue gate: **2,179 tests, 0 failing**; core 563, brain 377,
  tutor agent 378, token server 162, playground 26, mobile 673. Typecheck is clean in all
  six workspaces and floors were blessed to those counts. The Expo 57 web export succeeds,
  and Expo's local bundled-native-module map reports the dependencies up to date while the
  version service is unreachable in the sandbox. RevenueCat remains dark without all five
  server settings and a native public API key. No purchase, renewal, cancellation,
  refund/revoke or restore has been run against a store sandbox, and migrations 8 to 10
  have not been applied to a Supabase project.
- Gate after F243, the landing-claim rule: **2,132 tests, 0 failing**; core 549, brain 377,
  tutor agent 378, token server 137, playground 26, mobile 665. Typecheck clean in all six
  workspaces. Run on `phase-7-revenue` from inside that worktree, which has its own
  `node_modules`, and floors were blessed to these counts in the same act as writing this
  record. One test moved the count: `a roadmap row cannot call a branch unlanded once its work
  is on main`. The ledger check was red at the time and stayed red on purpose — ten Phase 7
  entries, F244 to F253, were filed into `docs/KNOWN_ISSUES.md` by a parallel session before
  that work was built, which is what an in-progress branch looks like. Nothing here has been
  seen on a device.
- Full Phase 6 retention gate, slices 6a and 6b: **2,125 tests, 0 failing**; core 549, brain
  377, tutor agent 378, token server 136, playground 26, mobile 659. Typecheck clean in all six
  workspaces. Run from the `phase-6-retention` worktree, which has its own `node_modules`,
  after which the floors were blessed to match.
- Full `main` gate with Phase 6 and the device build together: **2,131 tests, 0 failing**;
  core 549, brain 377, tutor agent 378, token server 136, playground 26, mobile 665. Typecheck
  clean in all six workspaces. Run from the repo root after `npm install` on the merged
  manifests, which carry Expo 57.0.18 and `expo-notifications` 57.0.15 together;
  `npx expo install --check` reports the pair up to date. Floors were blessed to these counts
  afterwards, in the same act as this record.
- Full Phase 6a retention gate: **2,090 tests, 0 failing**; core 549, brain 377, tutor agent
  378, token server 136, playground 26, mobile 624. Typecheck clean in all six workspaces.
  Run from the `phase-6-retention` worktree, which has its own `node_modules`, after which
  the floors were blessed to match.
- Full `main` gate after the Phase 5 landing: **2,053 tests, 0 failing**; core 543, brain 373,
  tutor agent 377, token server 132, playground 26, mobile 602. Typecheck clean in all six
  workspaces. Run from a worktree at `main`'s tip, `97f2c48`, with its own `node_modules`,
  after which the floors were blessed to match.
- Device-build preparation gate: **2,055 tests, 0 failing**; core 543, brain 373, tutor agent
  377, token server 128, playground 26, mobile 608. Typecheck clean in all six workspaces.
  Run on `claude/app-tech-stack-check-442698` from inside that worktree after `npm install`
  there, not from the repo root — two other worktrees were live in the shared checkout at the
  time. Floors were blessed to match afterwards. Covers F242 and the device build contract; it
  is a branch gate, and still nothing here has been seen on a device.
- Full Phase 5 tutor gate, slices 1 and 2: **2,003 tests, 0 failing**; core 543, brain 373, tutor agent
  377, token server 128, playground 26, mobile 556. Typecheck clean in all six workspaces.
  Run from the repo root on `phase-5-tutor`, after which the floors were blessed to match.
- Full Phase 5 tutor gate, slice 1: **1,906 tests, 0 failing**; core 533, brain 351, tutor agent
  360, token server 125, playground 13, mobile 524. Typecheck clean in all six workspaces.
  Run from the repo root on `phase-5-tutor`, after which the floors were blessed to match.
- Full Phase 4 practice gate: **1,865 tests, 0 failing**; core 524, brain 349, tutor agent
  350, token server 124, playground 13, mobile 505. Typecheck clean in all six workspaces.
  Run from the repo root on `phase-4-practice`, after which the floors were blessed to match.
- Full Phase 3 landing gate: **1,791 tests, 0 failing**; core 507, brain 348, tutor agent
  350, token server 124, playground 13, mobile 449. Typecheck clean in all six workspaces.
  Kept because a gate record with no history to compare against records nothing.
- `npm run verify:upstash`: 5 of 5 proofs, exit 0.
- `npm run verify:supabase`: 12 of 12 proofs passed, exit 0, against a disposable project.
- `npm run verify:voice`: 13 checks, 11 assertions held, 2 measurements recorded, exit 0,
  108.5s.
- `npm run build:web`: passed. `npm run scan:secrets:bundles`: clean across 23 files.
  Working-tree and reachable-history scans are clean; external vendor-key rotation remains.
- `npm run audit:ci`: 0 critical, 7 high, 11 moderate, every high root recorded.
- Current browser smoke evidence covers the public welcome and sign-up surfaces at desktop
  width: headings and programmatic input labels are exposed and there is no horizontal
  overflow. The earlier 320/390/1,280 observations do not substitute for Phase 3's required
  five-viewport and native screen-reader run. Authenticated onboarding was not completed.

## What is still outstanding

Each line names a blocker used in a table above.

- **`github-actions-run`** — push a branch and let `.github/workflows/ci.yml` execute once,
  so the workflow is proven on a Linux runner rather than only read.
- **`external-safety-reviewer`** — a qualified reviewer for the tutor-safety policy. The
  review package is written and waiting.
- **`ios-and-android-builds`** — representative device builds for Keychain and Keystore
  persistence, OAuth, microphone, deletion journeys and bundle inspection.
- **`vendor-key-rotation`** — rotate the Groq, Deepgram, ElevenLabs and LiveKit credentials
  found in commit `576bc53`. Treat all four as live until their vendor consoles confirm
  rotation, even though the object is no longer reachable and was never pushed.
- **`phase-3-schema-apply`** — apply all 42 migrations, including the onboarding event
  property fix, after reconciling current hosted history/catalog with the release
  manifest. Run the current hosted verifier and role/runtime proofs below; the
  legacy twelve-proof harness is insufficient for the current schema.
- **`phase-3-device-and-human-pass`** — complete the first-run matrix on iOS, Android,
  narrow/wide web and screen readers, and time a real beginner at their own pace. The static
  six-screen/six-tap count is not a two-minute measurement.

### Applying the schema to whatever project ships

Not a Phase 1 blocker, because the proofs have run. It is the single most dangerous
instruction in this document, because an operator who applies part of it deploys the two
money defects this phase found.

There are **42 migrations** for a fresh full schema, applied once in order from
`supabase/README.md`:

1. `202608220001_luvani_learning.sql` — the tables, the RLS policies, the first debit.
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
8. `202608300001_billing_events.sql` — F244. The replay boundary a purchase webhook needs.
   Without it there is no primary key to dedupe a redelivered billing event against, so every
   retry RevenueCat sends would re-fetch the subscriber and re-write the entitlement.
9. `202608300002_paid_period_lapse.sql` — F245. Without it, an expired **paid** period renews
   itself on every read or debit: thirty fresh days and a cleared counter, free, forever. That
   is inert while nothing sells and becomes a perpetual free plan for every cancelled
   subscriber the day something does.
10. `202608300003_paid_lapse_marker.sql` — F257. Without it, a former subscriber is
    indistinguishable from an exhausted free trial and receives the wrong explanation.
11. `202609040001_conversation_packs.sql` — durable, idempotent Tutor Conversation
    Packs. Without it, an app that closes after recap has no server-owned recovery
    record for the curated phrases and exercises it earned.
12. `202609050001_learner_state_daily_namespaces.sql` — F411. Without it, `bookmarks`
    and `scenarioProgress` are refused by the namespace whitelist with a 400 the sync
    engine retries forever, so a learner's saved situations and half finished scenes
    never leave the phone they were made on.
13. `202609100001_max_allowance_three_hundred.sql` — reprices Max from 450 minutes to
    300, to match `PLANS.regular` in core. Without it, a database keeps serving the old
    450 while the app and the token server both believe 300, so sessions go on starting
    after the balance the server reports has run out and the refusal that raises the
    subscription wall never fires.
14. `202609100002_wall_product_events.sql` — the subscription wall's five product events.
    Without it `wall_shown`, `wall_page_seen`, `plan_selected`, `purchase_started` and
    `purchase_settled` raise `unsupported product event`, the client swallows the failure
    by design, and the wall's funnel is dark with nobody seeing an error.
15. `20260919120650_home_friends_daily.sql` — private Friends, capped weekly activity and cooperative challenges. Review branch only; PostgreSQL/WASM integration verified with `scripts/verify-social-db.mjs`. Deploy before the expanded account export service.
16. `20260920194653_conversation_practice_jobs.sql` — atomic pack receipt and leased, bounded drill recovery. Applied to owner-restored Parle for testing; not evidence of a hosted recovery worker.
17. `20260920200454_practice_receipt_finalization.sql` — preserve successful recovery against late failed analyst receipts; explicit pack grants. Applied to Parle and verified in disposable PostgreSQL/WASM.
18. `20260920200807_practice_account_deletion.sql` — tombstone trigger works under a restricted Auth deletion role without giving that role queue access. Applied to Parle; restricted-role deletion verified in disposable PostgreSQL/WASM. No real learner accounts were deleted.
19. `202609230001_learner_state_practice_history.sql` — widens the `learner_state` namespace whitelist to accept `practiceHistory`, the account-synced record of completed conversation practice. Without it every push of that namespace is refused with a 400 the sync engine retries, and the history stays on the phone it was made on. Prepared and verified only by the repository's contract tests; **not applied to any project**, not even Parle. Its rollback is destructive and guarded by `luvani.remove_practice_history`.
20. `202609250001_learner_state_goal_steps.sql` — widens the `learner_state` namespace whitelist to accept `goalSteps`, the account-synced record that a conversation was opened from a goal (session id, normalised goal key, mission id) and the learner's own "used outside" self-report (ids only). Without it every push of that namespace is refused with a 400 the sync engine retries, and the record stays on the phone it was made on. Prepared and verified only by the repository's contract tests; **not applied to any project**. Its rollback is destructive and guarded by `luvani.remove_goal_steps`.
21. `20261002154637_atomic_billing_projection.sql` — atomic billing projection/event completion, DB-issued refresh ordering, and service-only readiness version. Disposable PostgreSQL/WASM transactions and focused application tests passed on 2 October; **not applied to any live project**. Real simultaneous transactions, RevenueCat delivery and native store operations still need deployment verification. Keep native purchases unavailable until this version is present and client/server identifiers agree.

22. `20261002171317_opt_in_conversation_text.sql` — explicit saved conversation text with owned completed-session proof, service-only access, a word-free deletion fence and a bounded single-statement export of all fourteen owned tables. Prepared for disposable checks; **not applied to any live project**. Its rollback permanently removes this saved text.
23. `20261002192210_consented_product_funnel.sql` (closed consented funnel evidence and service-only first-claim RPC; not applied live)
24. `20261002212536_kept_phrase_audio_budget.sql` — disabled/zero-budget saved-phrase audio policy, unexpired verified per-voice rate revisions, atomic source plus account/global reservation and a fresh dispatch gate, account budget export/cascade. Actual disposable sequential SQL checks only; **not applied live**. No verified rates or approved caps are seeded. Worker and phone switches stay off pending billing/cap/native verification. Its rollback removes budget history and restores the prior fourteen-table export.

25. `20261002233520_failed_session_refunds.sql` — actual capped-charge refunds for confirmed terminal Luvani failures, service-owned issued epochs, entitlement-first locking, typed reconciliation and sixteen-table export. Sequential disposable SQL and isolated PostgreSQL independent-connection race checks passed; **not applied live**. Drain all old writers before paired deployment. Native failure delivery and worker-crash reconciliation remain unverified.

26. `20261003001510_approved_phrase_audio_caps.sql` — founder-approved hard $0.02 lifetime trial/$0.20 paid thirty-day/$10 global thirty-day ceilings. Forces disabled; preserves counters and anchors, seeds no rates. Independent Sol and disposable sequential checks accepted; **not applied live**, vendor billing and native playback remain unverified.

27. `20261003230215_bounded_direct_data.sql` — backend audit implementation: bounded direct learner/event writes, per-account quotas, server receipt timestamps and auth-first direct write locking. Disposable SQL proof and independent review only; **not applied live**. Hosted role/concurrency and existing oversized-data remediation remain outstanding.

28. `20261003230224_bounded_data_retention.sql` — bounded service-only analytics, antifraud and pending-social retention. Every usage/debit/refund field is preserved and marked for policy review. **Not applied live or scheduled**; migration33 adds separately disabled speaking-detail expiry while preserving financial replay proof.

29. `20261003230232_bounded_social_inbox.sql` — bounded pending incoming requests, expiry and foreign-key indexes without truncating the current Friends protocol. **Not applied live**; local expiry/retry proofs and independent review exist, but hosted concurrency/scheduling acceptance remain outstanding.

30. `20261003231627_authoritative_tutor_sessions.sql` — backend lifecycle repository implementation: admission defaults disabled, allowance reservation and worker fences, durable checkpoint/completion/receipt and room-stop outbox. **Not applied live**; paired API/agent/reconciliation integration and synthetic crash/rejoin/ACK/cutoff proofs exist. Actual multi-process/vendor/device/hosted races and recovery acceptance remain outstanding. Do not enable admission from the existence of this file alone.

31. `20261003234853_privacy_maintenance_workflows.sql` — durable erasure before fencing, sticky processor history, bounded worker heartbeats and private readiness/catalog inspection. **Not applied live**; encrypted off-backup journal/replay are implemented and locally exercised. Actual independent storage durability, key recovery and deployed maintenance remain required.

32. `20261004002534_bounded_account_exports.sql` — Bounded coherent export jobs and UTF8 fragments with SHA chain; default OFF; original usage receipts preserved. Export, global capacity and 128MiB exceptional-request handling require reviewed activation. **Not applied live**; release manifest and hosted evidence must match the complete schema.

33. `20261004003511_bounded_session_detail_retention.sql` — Nullable older known session details, expiry OFF by default, independent financial idempotency preserved; bounded practice claim/reconcile and active lease checks. **Not applied live**; release manifest and hosted evidence must match the complete schema.

34. `20261004004023_friends_launch_guard.sql` — Friends default OFF, immutable reviewed moderation evidence with expiry and irreversible enabled-history rollback guard. No moderation service is fabricated. **Not applied live**; release manifest and hosted evidence must match the complete schema.

35. `20261004010327_whole_product_paid_admission.sql` — Whole-product owner-reviewed immutable quotes, nonrecycling global/account/vendor reservation and execution-day envelopes, current tutor resume and per-account session caps. OFF/zero by default; no vendor prices or capacity seeded. **Not applied live**; release manifest and hosted evidence must match the complete schema.

36. `20261004015000_indexed_conversation_library.sql` — Owned indexed twenty-row keyset history and independent pack-ID lookup with microsecond cursor; no REST row-limit truncation. **Not applied live**; release manifest and hosted evidence must match the complete schema.

37. `20261005231742_store_trial_yearly_allowance.sql`, F733 (D16): the projection that grants a store free trial a week of the plan's allowance and a yearly product one 30-day window at a time (the window in `allowance_window_end`, the paid year staying in `period_end`, so a missed refill never lapses the year), store answers ordered by when their period started (`period_start`, so an immediate upgrade from a yearly plan to a monthly one is granted at once), the withheld part of a window kept in `withheld_seconds`, the service-only renewal list for the maintenance worker, and projection version 2. Safe to apply twice; proved over pre-existing paid rows in disposable SQL. **Not applied live**; apply before the token server and maintenance worker that call it and before any intro offer or yearly product exists in App Store Connect.
38. `20261006120000_learner_state_game.sql`, F729: widens the `learner_state` namespace whitelist to accept `game`, the account-synced facts behind the streak, daily goal, quests and badges (zero-XP sittings, streak covers, goal days, quest days and claims, fixed XP, monthly rollups, badge ids and celebration keys; no free text). Without it every push of `game` is refused with a 400 the sync engine retries (F411). **Not applied live**; apply before any build that writes `game` ships. Its rollback is destructive and guarded by `luvani.remove_game`.
39. `20261007121856_preserve_store_trial_budget_and_year_extension.sql`, F747/F748: trial phrase audio retains the $0.02 lifetime allowance; extending the same paid year preserves charging for an in-flight session. SQL projection proofs pass, including rollback and reapply. Prepared, not applied live. Roll back this migration before the store trial/year migration, using its guarded rollback.
40. `20261020140000_weekly_free_taste.sql`, D24: the one-off thirty free minutes become a weekly free taste of five minutes. `entitlements.weekly_taste` marks a claimed (or lapsed) free row, the only kind that refills; the first debit sets the refill time a week out in the same usage epoch, a passed window refills lazily (new epoch, deferred while a session is live), every lapse lands on a fresh taste still marked `lapsed_from_paid`, and the trial cap is 300 seconds. Adds the `launch` and `locked` wall doors. Disposable SQL proofs pass in `scripts/verifyTutorSessions.mjs`, including interlocked rollback and reapply. Prepared, not applied live. Roll it back first, using its guarded rollback.
41. `20261022120000_live_session_finished_event.sql`, beta instrumentation: `validate_product_event` accepts `live_session_finished` (closed `kind`, boolean `voice`, counts `turns`, `rescues`, `unassistedPct`, nullable `replyLatencyMs`), matching the client union and `parseProductEvent`; every other branch is carried over from 40. Disposable SQL proofs replay it with the other migrations. Prepared, not applied live. Roll it back first, before 40.
42. `20261022200000_speech_dataset_clips.sql`, inert speech-dataset groundwork: the service-only `speech_dataset_clips` table, metadata only (no audio, no transcript, no free text), RLS on with every client role revoked, a path that must sit under the row's own user id, an expiry at most 24 months after capture, and an account-deletion cascade. Disposable SQL proofs in `scripts/verifyDataBoundaries.mjs` refuse client reads and writes and every out-of-range row. Prepared, not applied live, and nothing writes to it until the legal review in docs/changes/speech-dataset.md. Roll it back first, before 41, using its guarded destructive rollback.


Current hosted acceptance uses the complete inventory above. For an existing target,
compare captured migration history/Auth/platform/catalog and apply only missing
reviewed forward changes with admission disabled and old writers drained. Use
`scripts/verifyCurrentHostedSchema.mjs`, the current full-schema role/runtime proofs,
and the exact-artifact release gates in `docs/BACKEND_RELEASE_RUNBOOK.md`. Keep
`npm run verify:supabase` only for its matching historical disposable baseline;
it cannot certify the current backend.

**4 October implementation checkpoint:** See `docs/BACKEND_IMPLEMENTATION.md` for
A01–A30, all local measurements and unresolved external acceptance. Portable Docker
was chosen first; hosting remains undecided. New migrations/configuration have not
been applied live. Linux CI/builds, physical iOS/Android journeys, actual processor
contracts, concurrency/load, alert delivery and a timed isolated restore remain
release blockers. Older credentials were founder-reported retired on3October;
retain that evidence without inventing a direct old-key refusal test. Every current
local pass remains separate from public deployment approval.
