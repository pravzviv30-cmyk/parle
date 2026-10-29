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
| 6. Retention | progress-retention, learning science, design system | Passport, delayed test, less-help replay, honest reminders/story | Slice 6a is built on `phase-6-retention` and merged into `main` as `eee755c`: the passport, the delayed test and the less-help replay each have code and a named test, and F216 to F225 are closed. Slice 6b, the honest reminders and the weekly story, is built on the same branch and landed in the same merge, and F226 to F240 are closed with one P2 left open on purpose. Nothing in this phase has been seen on a device or a deployed database, no reminder has been seen firing on a phone, and the six external checks stay unclaimed |
| 7. Revenue | revenue, security, privacy-safety | One paid tier, verified receipts/webhooks, restore/lifecycle, fair-use economics | Built and tested locally, and dark unless every RevenueCat setting exists. Subscriber projection, authenticated replay-safe webhooks, bounded refresh, native purchase/restore, honest lapse copy and store-fee margin floors are held; store credentials and iOS/Android sandbox lifecycle evidence remain external |
| 8. Privacy/release | privacy-safety, qa-release, deploy | Reviewed policies, export/deletion, full device/live/build gate and rollback | Account deletion and a complete server-plus-device JSON export are built and tested locally. Release remains blocked on professional policy/terms review, vendor-retention verification, store/device lifecycle runs, deployed-schema and rollback evidence, production domains and CI evidence |
| Review fixes (2026-10-28 product review) | orchestrator with territory specialists | Every LR finding fixed or deferred in writing; five workstream branches (A session loop, B paywall and billing, C first run, D progress and practice, E visual and accessibility) each verified by tests, fix-verifier rounds and a live replay | Stream A (F903 to F906, F923, F928) landed on main (`2baf8fcf`, 2026-10-29). Stream B (F907 to F914, F931 wall parts, F932) landed on main (`706232bf`, 2026-10-29); F933 (a spent trial row that never refills) filed open for its own change. Stream C (F915, F916, F917, F925, F926, F930) landed on main (`005ae4d2`, 2026-10-29). Stream D (F918, F919, F922, F924, F934 to F937, with F858 and F651) landed on main (`c1840f26`, 2026-10-29). Stream E (F920, F921, F927, F929, F938, F940 to F945, with F856 and F857; F939 deferred) built and verified on `claude/review-e-visual` |

No later phase may be called complete against an unstable security or data contract.
Cross-territory files are changed sequentially, with a single owner at a time.

Before publishing the Home/Friends revision, review [DAILY_AUDIO_ROLLOUT.md](DAILY_AUDIO_ROLLOUT.md):
the user requested a first 200-word/200-phrase six-tutor audio batch within current
credits, then another 200 NEW words/phrases after the next credit reset. Preserve
that follow-up and the publication hold. The user authorised pushing this session
to main on 19 September; that is not automatic deployment or store-release authority.

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
corrected `docs/PEDAGOGY.md`, and `2eac2f2` regenerated the code graph. `2eac2f2` is where
Phase 4 left `main`, and later landings have moved it on since. The gate that closed Phase
4 is the one in step 5 below, 1,865 tests with none failing, and the floors were blessed to
match. The branch has since been deleted, so it is a hash and not a branch name that finds
this work now.

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

## Phase 6: what the exit criterion means, and where it stands

The criterion is four nouns — Passport, delayed test, less-help replay, honest
reminders/story — and all four stay in the row. All four now have code. The fourth stayed in
the sentence through the whole of slice 6a, when it had none at all, because dropping a noun
nobody has built is the cheapest way there is to pass an exit criterion.

This is the Phase 5 precedent above, applied again rather than reinvented. A noun every
reader expands differently is a criterion nobody can close against, so each noun is defined
against the symbols that implement it, and
`services/token-server/src/verify/deliveryRoadmap.test.ts` reads those symbols out of the
source files this section names. Delete `firstReturn` and the test says this document went
stale, which makes it a document to fix rather than a test to edit. The definitions below are
what may be argued with. The source is not.

Both slices are held locally and neither has landed. Slice 6a is the passport, the delayed
test and the less-help replay; slice 6b is the honest reminder and the weekly story. Every
entry the phase filed, F216 to F240, is closed against a named test that passes, except F237:
a P2 about two source files that carry raw NUL bytes and are therefore invisible to grep.
Those bytes predate this phase, the repair belongs to the sync policy and the core merge
rather than to retention, and it is left open on purpose instead of being folded into a slice
it does not belong to. The gate on `phase-6-retention` read 2,125 tests with none failing.
`docs/IMPLEMENTATION_EVIDENCE.md` is where that run is written down, and the floors were
blessed to it in the same act, because a floor that lags a landing is a floor that would let a
whole suite stop loading without anybody noticing.

### What each noun means

- **Passport.** Built in 6a. One stamp per situation the learner has finished without help,
  three states, and no numbers anywhere. In code: `stampsFrom`, `Stamp`, `STAMP_STATES`,
  `isStamped`, `hasStamps` and `stampLabel` in `apps/mobile/src/progress/passport.ts`, drawn
  by `MyFrenchTab` in `apps/mobile/src/tabs/MyFrenchTab.tsx`. It is a projection over
  `independenceFrom` taken at best ever, so there is no stored passport, no new sync domain,
  and nothing a tired replay can take away. `hasStamps` is true only when at least one stamp
  reads `on-your-own`, so a learner with nothing yet is shown nothing rather than a row of
  empty slots.

- **Delayed test.** Built in 6a. The sitting asks for yesterday's first successes again, and
  says so once. In code: `firstReturn` in `packages/core/src/review/scheduler.ts`, with
  `sittingView`, `SittingView` and `SITTING_OPENER` in `apps/mobile/src/review/cardView.ts`,
  rendered by `ReviewScreen` in `apps/mobile/src/ReviewScreen.tsx`. It is a stable partition
  of the cards the sitting had already chosen: membership never changes, only order, so the
  cap and the overdue-first rule cannot be starved from here.

  What this noun may not claim is the reason it needed a definition. `firstReturn` names a
  card the scheduler **sent** back a day after its first success. It is not evidence that the
  memory held. The evidence of survival is the grade that follows, which `applyGrade` in
  `packages/core/src/review/scheduler.ts` records as a retrieval only when the review screen
  passed an attempt with it. A criterion that read `firstReturn` alone as "a phrase survived a
  night" would be counting cards shown, which is the engagement proxy the product brief rules
  out. So the noun is the question being asked, and the answer lives in the grade.

- **Less-help replay.** Built in 6a. Going back into a scene already finished opens it one
  rung higher, and the learner is told once. In code: `replayRung` in
  `packages/core/src/missions/missions.ts`; `createConversation` in
  `packages/brain/src/engine/conversation.ts`, whose config now takes a clamped `startRung`;
  `openMission` in `services/tutor-agent/src/convo.ts`, the only place that consumes it;
  `missionReplay`, `replayNote` and `LESS_HELP` in
  `apps/mobile/src/missions/chooserView.ts`, delivered by `RootNavigator` in
  `apps/mobile/src/nav/RootNavigator.tsx` and `ConvoScreen` in
  `apps/mobile/src/ConvoScreen.tsx`. `replayNote` writes the line only when the rung actually
  rises, so a learner already at the top is told nothing false.

- **Honest reminders / story.** Built in 6b. One sentence at a fixed time the learner picked (since Come alive Phase 4, founder decision D2: one planned reminder a day, skipped on a day already practised, in `apps/mobile/src/reminders/plan.ts`),
  and a weekly story they have to come and read, on Profile since F561 (`profile/FrenchLifeCard.tsx`
  is `progress/story.ts`'s one importer). In code: `reminderMessage`, `reminderTime`,
  `reminderRow`, `REMINDER_TIMES` and `REMINDER_COPY` in
  `apps/mobile/src/reminders/reminder.ts`; `reminderPermission`, `askReminderPermission`,
  `schedulePlan`, `cancelReminder` and `REMINDERS_AVAILABLE` in
  `apps/mobile/src/reminders/schedule.ts`, the web half of a platform pair whose native half is
  the only file in the repository that imports the notification SDK; `loadReminder` and
  `saveReminder` in `apps/mobile/src/reminders/store.ts`, offered by `ProfileTab` in
  `apps/mobile/src/tabs/ProfileTab.tsx`; and `storyFrom`, `hasStory`, `WeekStory`,
  `MAX_STORY_SENTENCES` and `DAYS_IN_THE_STORY` in `apps/mobile/src/progress/story.ts`, drawn
  by `MyFrenchTab` in `apps/mobile/src/tabs/MyFrenchTab.tsx`. The web half is what this
  definition points at, because it declares the same symbols as the native one and no test may
  load the native half, which is the property that keeps the dependency separable from the
  code.

  The no-guilt rule is structural rather than a promise somebody has to keep. Nothing under
  `reminders/` may import the progress, missions, review or history modules, and a source scan
  fails the build if anything ever does, so the reminder cannot know whether the learner
  practised and cannot be quietly cancelled because they did. The story is held from the same
  two sides: `reminders/` may not reach `progress/`, and exactly one file that is not a test
  imports the story module, so the week's sentences can only be read where the learner goes
  looking for them. Neither of those tests is the promise on its own; the pair is.

  What this noun may not claim is longer than for the other three, and it is why the noun
  needed a definition most. The tests prove that exactly one file imports the notification
  SDK; that the trigger is a daily repeat with no hardcoded hour; that the module reads no
  clock and sets no timer, so the operating system repeats the reminder and the app never
  re-arms it; that the content builder takes no arguments and therefore cannot vary with how
  the week went; and that the channel is created asking for no badge. They prove nothing about
  a notification arriving. Permission dialogs, delivery, what a lock screen renders, whether
  the repeat survives a reboot or a change of timezone, and whether a launcher honours the
  badge flag are all device evidence, and nobody has any of it. The badge has a second edge
  worth writing down: creating the channel is deliberately allowed to fail without costing the
  reminder, and the fallback channel a refused creation leaves behind is one this code did not
  configure.

  The build configuration is the same shape of claim. `apps/mobile/app.json` registers the
  notification plugin, asks for the Android post-notifications permission, and sets neither the
  background-remote-notifications flag nor a default channel. That is all a green tick there
  means, because nothing in this repository runs prebuild and the generated `ios/` and
  `android/` trees are gitignored, so the manifest this configuration produces does not exist
  here to be read. The build is configured to have a chance. Even a manual look needs a
  development build, because local scheduled notifications have not worked in Expo Go on
  Android since SDK 53.

### What Phase 6 did not verify

Everything above was measured on this machine, by tests, against source. No stamp has been
seen on a phone, no delayed test has been sat by a person, no replay has been spoken to, no
reminder has been seen firing, and no launcher icon has been confirmed free of a badge. There
is no development build, so there is not yet a way to look.

The six external checks the Phase 4 and Phase 5 sections leave standing are unchanged and
still unclaimed: migration 7's deployment and its live verification, a Supabase-authenticated
first run, the device and five-viewport accessibility matrix with VoiceOver and TalkBack, the
F57 stopwatch, vendor credential rotation, and F79.
