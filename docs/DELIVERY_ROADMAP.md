# Delivery roadmap

Statuses use: implemented and tested locally; integration implemented but live verification
pending; database migration created but not deployed; blocked; designed but intentionally
deferred.

| Phase | Owner | Exit criteria | Current status |
|---|---|---|---|
| 0. Audit | product-orchestrator, repository-archaeologist | Baseline, map, evidence, fleet, ownership, risks, deletion ledger | Implemented and tested locally |
| 1. Security P0 | security, privacy-safety, voice, revenue, qa | Live RLS, secure auth, safe config, limits, session lifecycle, reauth, safety foundation | Safety foundation and local integrations implemented; live/external verification pending |
| 2. Data/infrastructure | data-sync, observability, security | Versioned sync, conflicts, offline retry, privacy-safe analytics, cost alerts | Implemented and tested locally; revision migration measured on a disposable project; live two-device/release verification pending |
| 3. Onboarding | onboarding UX, design system, privacy-safety | One welcome, useful choices, readiness, contextual mic, returning-user migration | Built on `phase-3-onboarding` and merged into `main` as `2a86092`; local web route proof complete, native/five-viewport QA and migration deployment remain external |
| 4. Practice | practice UX, learning science, data-sync | Retrieval before reveal, one mastery source, durable batches, transfer | Built on `phase-4-practice` and merged into `main` as `f943bbe`; that branch is deleted now, so the hash is what finds it. Device, screen-reader and Supabase verification pending |
| 5. Tutor | tutor behaviour, voice, learning science, privacy-safety | Mode parity across the four session modes (`convo`, `convo-text`, `lesson`, `lesson-text`), correction policy, recovery, safety, durable curation | Built on `phase-5-tutor` and merged into `main` as `1b37b81`. All five properties held locally and tested; every P0 and P1 closed. Six P2s stay open by choice, and the six external checks are unclaimed by anyone, so this is not a release |
| 6. Retention | progress-retention, learning science, design system | Passport, delayed test, less-help replay, honest reminders/story | Designed but intentionally deferred until sync/evidence stabilise |
| 7. Revenue | revenue, security, privacy-safety | One paid tier, verified receipts/webhooks, restore/lifecycle, fair-use economics | Blocked by product/store credentials; implementation missing |
| 8. Privacy/release | privacy-safety, qa-release, deploy | Reviewed policies, export/deletion, full device/live/build gate and rollback | Blocked; policies, devices and deployment evidence missing |

No later phase may be called complete against an unstable security or data contract.
Cross-territory files are changed sequentially, with a single owner at a time.

## Phase boundary: Phase 3 landed, Phase 4 branched from it, then Phase 4 landed too

That is what happened, in that order. `phase-3-onboarding` was merged into `main` as
`2a86092`, a merge commit with two parents, so nothing pushed was rebased and all thirteen
commits are still in the history under their own hashes, `d5cd7a5`, `0bb507b` and `0100169`
among them. The merged tree passed `npm run gate` at 1,791 tests and 0 failing: core 507,
brain 348, tutor agent 350, token server 124, playground 13, mobile 449. Those six numbers
are the floor Phase 4 started from.

`phase-4-practice` was branched from that exact merge commit, so its merge base with `main`
is `2a86092`. No Phase 4 work had to reintroduce a deleted onboarding surface, and no Phase
4 merge spent its first hour reconciling Phase 3.

Phase 4 then landed the same way. `phase-4-practice` was merged into `main` as `f943bbe`,
whose two parents are `2a86092` and `fccb0fe`. Two commits followed on `main`: `d24913f`
corrected `docs/PEDAGOGY.md`, and `2eac2f2` regenerated the code graph. `main` points at
`2eac2f2`. The gate that closed Phase 4 is the one in step 5 below, 1,865 tests with none
failing, and the floors were blessed to match. The branch has since been deleted, so it is
a hash and not a branch name that finds this work now.

## Phase 4 execution order, and what was built against it

The five steps below were the plan. Each one now carries what shipped, where the code
lives, and the ledger entries that record it. Every entry named here is ticked, and a tick
only counts when the test its `verified-by` line names actually passed, so the gate is
what stands behind the word "built".

1. **Retrieval before reveal.** Built. `presentationOf` in
   `packages/core/src/review/evidence.ts` decides introduction or retrieval, and
   `apps/mobile/src/review/cardView.ts` turns that into the view the screen renders. A due
   vocab or turn card the learner has recalled before asks for a typed or said attempt
   first, and the French, its context, its IPA and Hear-it stay hidden until the attempt
   lands. Genuinely new cards and sound cards keep the scaffolded introduction they had.
   A good grade after an attempt raises `evidence.retrievals` through `applyGrade`. The
   review sitting holds no microphone and records nothing. F120, F126, F127.

2. **One phrase-evidence source.** Built. `packages/core/src/review/evidence.ts` holds one
   record per phrase: three counts that only go up, four states from `introduced` to
   `transferred`, and the only copies of `MASTERY_USES`, `SETTLED_REPS` and
   `SETTLED_DAYS`. Brain, the phrasebook, the path and the scheduler read that record
   instead of each deciding for itself. `mastered` stopped being a state and became a
   projection of `convoUses`. `packages/core/src/review/merge.ts` merges the counters
   field-wise by max while whole-card scheduling still rides with the winner, so two
   devices converge without either one losing a schedule it earned. No profile migration
   and no schema change were needed. F119, F121, F122, F131.

3. **Durable practice batches.** Built. `PersistAck` in
   `apps/mobile/src/storage/ack.ts` makes a store write answer `durable` or `failed`
   rather than swallow the failure. The journal envelope is version 3 and carries a
   `batchId` and `convoUses`. `bankPractice` clears the journal only once topics, phrases
   and drills have all answered `durable`, and `recoverJournal` uses the same gate on the
   next launch. F118, F123, F124, F125, F129.

4. **Transfer evidence.** Built. `transfer` is an optional mark on the drill exercise,
   emitted by the generator schema, carried through `applyDrillResults` and the drill
   screen, and a correct answer to a marked exercise raises `evidence.transfers` on the
   same record. There is no parallel score. F128.

5. **Exit evidence.** This section, `docs/RISK_REGISTER.md` and the banking section of
   `docs/STATE_AND_STORAGE.md` are it. The gate that closed Phase 4 read 1,865 tests and 0
   failing: core 524, brain 349, tutor agent 350, token server 124, playground 13, mobile
   505. That is 74 tests more than Phase 4 started with, and no floor moved to get there.
   Floors rise only through `npm run gate:bless` on a green gate, never by hand. F130.

## What Phase 4 did not verify

Everything above was measured on this machine, by tests, against source. None of it has
been seen on a phone and none of it has touched a deployed database. The checks below are
still owed. They are pending, not passing, and no row in this file may say otherwise
until somebody runs them and writes down what happened.

- **Supabase migration 7 is not deployed.**
  `supabase/migrations/202608270001_onboarding_event_property_fix.sql` exists in the repo
  and has never been applied to any project, disposable or otherwise. Blocked on
  `phase-3-schema-apply`.
- **No Supabase-authenticated first run has been completed.** The recorded proof covers
  the local web route. Signing in against a deployed schema and walking the first run from
  there has not been done. Blocked on `phase-3-schema-apply`.
- **The device and five-viewport accessibility matrix is not run.**
  `docs/DEVICE_VERIFICATION.md` still records every row of both matrices as not run,
  VoiceOver and TalkBack included. Blocked on `ios-and-android-builds` and
  `phase-3-device-and-human-pass`.
- **The two-minute promise has never been timed.** F57 wants a real beginner, going at
  their own pace, with a stopwatch running to their first useful French line. A static
  screen count is not a measurement of a minute. Blocked on
  `phase-3-device-and-human-pass`.
- **The vendor credentials are not rotated.** Treat the Groq, Deepgram, ElevenLabs and
  LiveKit keys as live until their vendor consoles say otherwise. Blocked on
  `vendor-key-rotation`.
- **The replayed-credential refusal is still worker-local.** F79 stays open until the join
  path consults the `session_usage` ledger, so the refusal holds for the worker that
  served the original session and no further.

Phase 4's review screen deserves the same honesty on its own terms. Its accessibility
evidence is source-level. The tests prove that the labels, the roles and the reveal
announcement are written down, and that the screen renders what the view told it and
decides nothing itself. They do not prove that VoiceOver reads the reveal aloud, that the
keyboard clears the attempt row, or that focus lands where a learner expects it. That is
device evidence, and nobody has it yet.

## Phase 5: what the exit criterion means, and where it stands

The first exit criterion used to read "three modes". No triad of modes exists in the code.
`apps/mobile/src/tutor/choosingView.ts` declares four session modes, `convo`, `convo-text`,
`lesson` and `lesson-text`, and four readings of "three" each produce a different scope, so
a ledger entry had no sentence to close against. The criterion now reads mode parity across
the four session modes. That is a property a test can hold rather than a count to argue
about. `MODE_CAPS` is a `Record<LiveMode, ModeCaps>` over all four, and the test
`every mode's microphone and audio behaviour matches the mode table` walks the whole
table, so a fifth mode will not compile until it declares what it may do.

Phase 5 is held locally. Every P0 and every P1 in the range this phase filed is closed
against a named test that passes, and the gate that landed Phase 5 read 2,003 tests with
none failing.

Slice 1 was the six P0s, merged to `main`. Slice 2 was the rest of the survey, and between
the two every one of the five properties has code and a test behind it: mode parity across
the four session modes, correction policy, recovery, safety, and durable curation.

Six things stay open on purpose, all P2, none of them load-bearing for the criterion. The
curation eval has no measurement yet, so half of durable curation is proven only by the
batch surviving and not by the batch being worth surviving. A rescue line in the copy module
is reachable only from its own test, and nobody has established whether it is dead or lost.
A stopped session still pays for post-session model work nobody receives, which is a founder
decision rather than an engineering one. The pipeline log prefixes have two homes and nothing
fails if they drift. `DESIGN.md` records five colours the app stopped shipping. And a typed
lesson still eats the first tap when the keyboard is up.

Slice 1 covered:

- the under-13 and minor-sexual false positives, repaired
- safety given its own protocol frame, with a surface that stays up
- no congratulation, no XP and no banking after a stop
- the judgement half of the two-layer safety design, written into both shipped prompts
- `lesson-text`, which no longer publishes a microphone
- the typed lesson, given the twelve-second text window instead of four

Slice 2 then finished the survey. All 40 gaps it found are closed or accepted: every P0 and
every P1 against a named test that passes, and six P2s left open by choice: F146, F147,
F193, F206, F208 and F209. Each of those six is written up in `docs/RISK_REGISTER.md` with
the reasoning that kept it open. Two things are worth naming here, because a table cell
cannot hold them:

- **Safety has no escalation or reporting route.** A session can be stopped and nobody is
  told. That is a fact about the phase and not about one slice: nothing in Phase 5 built
  one, and `docs/IMPLEMENTATION_EVIDENCE.md` still lists the in-app escalation UI among the
  things the tutor-safety row has not proven.
- **The six external checks are unchanged and unclaimed.** Migration 7 deployment and its
  live verification, a Supabase-authenticated first run, the device and five-viewport
  accessibility matrix with VoiceOver and TalkBack, the F57 stopwatch, vendor credential
  rotation, and F79 all stand where the section above leaves them.
