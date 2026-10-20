# State and storage

Where the learner's data lives, what shape it is in, and the ways that shape has
gone wrong.

## On the device

The Home/Friends review branch upgrades `activity` to inner version 2, retaining
small unique local-day keys when detailed entries age out, so Days active no
longer falls just because the 400-day event window rolls forward. Version 1
history migrates on read; days already pruned by an older release cannot be
reconstructed. `bookmarks` inner version 2 retains up to 3,000 decisions, covering
the 2,000 daily items plus situations and un-save records. Older clients defer
these newer payloads rather than truncating them to the old limit. The sync
envelope ceiling is 512 KiB. Friends data is separate server-owned social tables;
only accepted relationships are exposed through the authenticated social RPC.

`apps/mobile/src/storage/scope.ts` keys **everything** to the signed-in account:
`luvani.u.{uid}.{suffix}`. `userKey()` throws if called with no active user, which
is deliberate — a store read before the auth gate is a bug, and a silent global
fallback would leak one learner's history into another's session.

Stores: `profile`, `history`, `review`, `drills`, `tutorIntro`, `activity`
(one dated row per sitting, carrying the XP it earned and, since F395, a
`durationMs` saying how long it took; that field is **optional and absent on
every entry written before it existed**, so a reader treats absence as "not
measured" and never as zero, and it is device wall clock rather than metered
minutes so it is never shown as the balance),
`bookmarks` (the situations a learner saved, one row per situation with the
state they chose and the moment they chose it, so an un-save is a decision the
store can hold rather than an id missing from a set),
`scenarioProgress` (where a learner left a scene part way through: one row per
mission with the moment they left, how long they had been in it and how many
beats were behind them, and never the beat total, which belongs to the mission
catalogue),
`topics` (the practice topics a learner's conversations produced — titles,
sitting dates, and the review-deck ids they drill; strength is never stored,
it is a projection of the deck), `friends` (the local friends adapter's
list and requests, currently dormant while social is outside primary navigation),
`missions` (a bounded history of mission finishes and their rungs, which is the
only mission fact stored rather than projected), `soundChecks` (known-reference
attempt evidence and a single learner-safe focus, never raw audio or a numeric score
— the recording it was measured from is a file in the cache, not a value in the
store, and "Attempt audio" below is what happens to it), `coachMarks` (which of the
in-conversation controls have been pointed out, one key for all of them), and
`journal`, and `conversationPacks` (a local cache of durable, server-owned Tutor Conversation Packs; it contains curated learning data and exercises only, never raw audio or a readable transcript),
`packMarks` (what this phone did with a pack, since F550: practised it, kept its
conversation going, keyed by the pack's id and folded into the pack at read because the
server's copy replaces the cache on every refresh), `moments` (the situations a learner brought to rehearse, since F549: a kind and
one line in their own words, newest first and capped, device-local because it is
the most personal text the app holds), `practiceHistory` (completed conversation
practice, account-synced: see "Conversation-practice history" below), `goalSteps`
(which conversations were opened from one of the learner's goals, and their own "used
outside" reports, account-synced, ids and the normalised goal key only: see "Goal steps"
below), `game` (the account-synced facts behind the streak, the daily goal, quests and
badges: see "The game layer" below), `gameLocal` (the game facts that belong to this
phone: the reminder log, the plan it last saw, the time zone of the last practice and
the celebrations still queued; device-local), `home-seen` (what this phone's Home last
drew: the streak, today's minutes, the goal ring in thousandths, the level, quests done
and lifetime days, so a number that rose since counts up once and never replays or
counts down; written only once a value is drawn where the learner can see it, never
while a sitting, a sheet or a takeover covers Home (`home/homeDraw.ts`); device-local,
since come alive Phase 4), `pendingPurchase` (the local checkout fence, since the 3 October UX recovery pass), `practiceSession`
(the one unfinished practice sitting on this phone and the frozen plan that finishes
it, device-local), and `analytics` (one boolean: whether the learner agreed to usage data being
sent. It is a store of its own rather than a field on `profile` because
`mergeStoredProfiles` picks scalar answers by evidence weight, so a consent on
the profile could let an older yes from a heavier device win against a
withdrawal made on a lighter one, and a consent that can resurrect itself is a
privacy defect. `null` from `loadConsent` means nobody has been asked, which is
deliberately a different fact from a stored `false`).

The existing `profile` also retains closed `practicePreferences` answers for
content pitch, speaking support and focus. These never award an earned level.
The level is editable after onboarding via `withStatedLevel`, clock-tracked as the
`statedLevel` preference field so the newer edit wins across devices.
`mergeStoredProfiles` merges `practicePreferences` per sub-answer (level, confidence and focus each by the answer rule), so one device's partial object never erases another's real answer.
New unnamed profiles carry optional `namePromptPending: true`; the durable name
preference writer clears it with the name's causal clock. Missing on legacy
accounts means no new name prompt. It survives verification/relaunch and sync
without becoming authentication or guest-adoption authority. Account-local
`appearance` stores system/light/dark selection; it is exported and reset with
the account and excluded from cross-device sync. While dark mode is off
(`DARK_MODE_ENABLED` in `main/appearanceModel.ts`, KNOWN_ISSUES F847) the stored
choice is kept but not offered in Settings, and the app always draws light.

Before an account exists, the app may also hold `@luvani/pre-account-onboarding/v1`.
The current version-1 draft carries age confirmation, the starting level and
reason, suggested routine (including no fixed target), reminder preset kept off,
catalogue Tutor voice, optional bounded first name and usage-data choice. It
holds no transcript or audio and sends no pre-account telemetry. Missing fields
from older drafts receive established defaults; missing consent stays off.
The draft is cleared after adoption or when the learner chooses a new plan.
An empty OAuth account does not prove who made this on-phone draft: the
signed-in learner must review and confirm the plan before it is applied.

`journal` is the only store that is meant to be empty. A conversation's recap is
written there the moment it arrives and deleted once every store that took part
in banking it says the write reached the disk, so anything found at launch
belongs to a session that was closed in between and is banked then. It exists
because the order things arrive in leaves a gap: the recap ships first, practice
follows, and the leave-early fallback that covers the difference only runs when
the learner taps Done. Reading the recap and swiping the app away used to lose
the session's phrases outright.

### The age stop, and exactly how strong it is

`profile` is at **version 9**. Version 9 adds no field: `dailyGoalMin` may now hold
20 (Intense) beside 5, 10 and 15, and the version moved because an older build reads
20 as no goal and would merge that loss to every device; with the version moved it goes
quiet on profile sync until it updates instead. `upgradeStored` keeps a 20 from any
envelope, and `practiceDaysPerWeek` is no longer asked for but is still read and
carried wherever a disk holds one. Version 8 added `forgottenFacts`, the normalised
keys of memory facts the learner asked the tutor to forget, kept as tombstones
because the extraction would otherwise write the fact back the next session that
mentions it, and `learnerGoals`, up to three lines the learner wrote about what
they want from French, appended after the remembered facts in the session
snapshot when personal memory is on, so the agent's last-five slice carries them
(`apps/mobile/src/profile/memory.ts` is the one writer of both). Version 6 added
`tutorVoice`, the catalogue key of
the voice the learner asked for, null until they choose. Version 7 added
`preferTyping`, a plain boolean saying a conversation opens with the reply box
showing and the microphone closed until the circle is tapped; false for everyone
until they say otherwise in Profile, and false on every upgraded branch, because
nothing that happened before the field existed is an answer to it. The field
version 5 added is `ageStopAt`: the
millisecond moment a session ended because the learner said, in a scene, that they
are under thirteen. Null until one lands, null again once they pass the age gate.
`upgradeStored` writes null on every branch below 5, because nothing that happened
before the field existed can be read as a stop after the fact, and junk in the slot
reads as null for the same reason every other field in that chain reads junk as an
unanswered question.

The optional `brain.memory.control` adds pause/resume without a version bump;
legacy profiles retain their existing behavior. Pausing keeps facts available
for management but excludes them and learner goals from the next tutor snapshot
and prevents new personal-memory extraction. The current control survives late
recaps. Memory-screen writes edit the latest serialized disk profile and update
the screen only after the write succeeds; failures remain retryable. Ordinary
profile saves preserve newer controls and union all exact-wording forget markers.
Loading and adoption remove matching raw facts. The account reset tracks writes
already dispatched to AsyncStorage, rejects new writes through its cleanup, and
invalidates delayed reads at completion. Local tests exercise each ordering;
native disk failures and live two-device convergence remain unverified.
Markers contain normalised wording, are exported, and have no count expiry.
Existing sync payload-size limits remain; markers are never silently pruned to
fit a limit, and markers previously pruned by an older build cannot be recovered.

Three named doors and nothing else touches it. `withAgeStop` writes it,
`withAgeGatePassed` clears it, `ageStopStanding` reads it, and `entryFor` in
`onboarding/answers.ts` turns it into one of three launch destinations —
`onboarding`, `age-gate`, `app`. What it buys is the thing the boundary did not
have before: a stop used to last exactly one session, so a child could tap start
and be in another scene seconds later.

**Its ceiling, said plainly, because it is smaller than it looks.** This is a fact
about a device, not about an account. `mergeStoredProfiles` drops it from every
merge (`PROFILE_DEVICE_FIELDS` in `@luvani/brain`) so the account copy never carries
it, and `adoptProfile` keeps this device's own across a sync fold so a cycle cannot
clear it. The consequences are the honest ones: **a reinstall clears it, and a second
phone never learns about it.** That is the same strength the age gate already had,
and it was accepted deliberately rather than waiting for the strong shape, which is a
server-side account flag needing durable server storage and an authenticated write
path from the agent — and Supabase deployment is still an unclaimed external check, so
that shape could not be verified end to end.

The merge drops the field rather than choosing a side, and the reason is worth keeping.
Riding with the evidence-heavier side would let a child's busier phone merge the door
back open. Treating it as an answered question, where a non-null beats a null, is worse:
clearing the stop is a write of null, so once one device had synced a stop no device
could ever clear it again and the only way back into the product would be a reinstall.
A stop that cannot be lifted is a ban, and this one is answered by one tap on the age
gate by design.

Two numbers move together with this. `StoredProfile.version` and the `writes:` field of
the `profile` row in `sync/policy.ts` are the same schema version; a build whose store
has moved past its own declaration calls its own merge output a newer schema and goes
pull-quiet on every profile cycle, silently. `profile/ageStop.test.ts` holds them equal.

### Banking a conversation, and when the journal is allowed to go

A store write answers in one word. `PersistAck` is `durable` or `failed`, and it
lives in `apps/mobile/src/storage/ack.ts` with the definition spelled out.
`saveDeck`, `saveTopics` and the drill store's `saveStore` return it, and
`addPhrases`, `mergeSessionTopics` and `mergeExercises` pass it out to whoever
asked.

**`durable` means one thing.** The store's own write chain computed the merged
value and `AsyncStorage.setItem` for that exact scoped key resolved without
throwing. That is the strongest honest signal a phone offers. It is not an
fsync. Nothing below AsyncStorage promises the bytes have reached flash, so a
device that loses power in the same instant can still lose that write, and no
word in this codebase claims otherwise. There is no read-back check either,
because the read would come out of the cache the write just filled and would
prove only that the cache is fine.

**`failed` changes nothing the learner sees.** Every store fills its in-memory
cache before it touches the disk and keeps serving from it, so a full phone
reviews and drills exactly as it did. Two things do change. Nobody downstream
may treat the write as saved, and `markDirty` is not raised, because a dirty
flag on a failed write pushes the previous value to the account as if it were
the new one. That is the registry's own rule at `sync/registry.ts:181`.

**One function decides when a conversation is safe.** `bankPractice` in
`live/journal.ts` writes the topics, then the phrases, then the drills, and
clears the journal only if all three said `durable`. Any `failed` leaves the
journal exactly where it is and answers `kept`. All three are tried even after
one has failed, because a quota bites one key at a time and two thirds of a
session banked is better than none.

**There is no retry inside the session.** A phone that is out of space this
second is out of space next second, and a loop would only spend battery proving
it. The retry is the next launch. `recoverJournal` runs once after the account
scope resolves, banks through the same `bankPractice`, and clears on the same
all-durable condition, so a launch that still cannot write leaves the batch for
the launch after it.

**Replaying is safe because identity is content, not a receipt.** A crash
between the acknowledgements and the clear leaves a banked batch on disk, and
the next launch banks it again. That costs nothing: `mergeTopics` folds on the
topic id, `mergeCards` on the phrase key, `mergeExerciseBank` on the exercise's
key and kind, and each keeps the row already there, so scheduling the learner
earned survives untouched. The journal's `batchId` is not what makes this work.
It has one job, which is to stop a clear from deleting a journal that a later
session wrote while the acknowledgements were coming back.

**The envelope is version 3.** It adds `batchId` and `convoUses`, which are the
lifetime counts of correct unprompted use read off the learner model that
arrives beside the recap. They are read through `repairProfile`, the one door
for a stored learner model, and a blob it cannot make sense of yields no counts
rather than a throw. The review store folds them into `evidence.convoUses` by
max, in the same acknowledged write as the phrases, so one acknowledgement
covers both and a replayed batch can never inflate what a learner is credited
with. Version 1 and version 2 journals already on phones are still read.

**Grading is deliberately not acknowledged.** An ordinary review sitting must
never wait on a disk. The screen moves on the beat the learner tapped, and a
card that failed to persist is one card asked again, not a session lost.
Acknowledgements are for the path that deletes the only copy of something.

What is still lost, said plainly. A batch on a phone that never gets its space
back stays in the journal, unbanked and unbankable, until it does. The proof is in `live/journal.test.ts` and
`storage/ack.test.ts`: storage-full on each store separately, a crash at each
boundary, a launch that still cannot write, a duplicate delivery, and an
account switch mid-recovery.

### Conversation-practice history, resume, and finishing a sitting at most once

**Status: implemented and tested locally. The server half (migration
`202609230001_learner_state_practice_history.sql`) is prepared and not applied to
any project, so until an operator applies it the history syncs nowhere: pushes are
refused at the door exactly as F411 described, and it stays on the phone.**

`practiceHistory` (`practice/history.ts`, `practice/historyStore.ts`) holds small
immutable facts: `session-completed` (stable sitting id, time, the conversation it
practised, and up to six targets, each with its phrase key, its own source, an outcome
of recalled, practised or unresolved, and attempts), `warmup-completed` (exposure,
never recall) and `revisit-started` (a tutor room opened, never a success). The
validator is strict: an unknown key rejects the event, so a typed answer, transcript
or recording has nowhere to ride. A phrase key is not opaque. It is the saved French
phrase itself, as the synced review deck already keys it. Old device-local `packMarks`
are shown through `legacyMarkItems` as reader-only labels, never stored here and never
promoted into recall or live use. Links to a deleted pack stay in the history; readers
filter by the pack cache they hold, and the history carries no pack content to resurrect.

The merge is a set union on the whole event, bounded to 150 events and 448 KiB of
serialised events, measured through real JSON escaping. The bound is carried as a
`floor`: the time at or below which events have aged out. The floor is the max of both
sides and only rises, so an older device cannot bring an aged-out event back. A
newest-suffix cut without a floor was tried and is **not** associative under a byte
budget; `history.test.ts` holds the counterexample loop.

`practiceSession` (`practice/sessionStore.ts`) is excluded from sync with a written
reason. It holds ids and settled facts only: exercise ids in queue order (silent twin
ids when the sitting went quiet), the answered records, miss counts and targets. Resume
works on the same device only. A missing exercise is reported and dropped, never counted
done, and a sitting with nothing left to play cannot resume.

**Finishing a sitting** (`practice/completion.ts`) cannot rely on the existing seams:
`gradeCards` swallows a failed write and `recordActivity` appends. So it freezes a plan
first, in the local `practiceSession` record: grades from core's `practiceGrades` (every
target unscheduled after the warm-up or where help was used), each card's schedule
fingerprint read off the **disk** deck, the XP, an activity instant no identical
`(drill, xp)` entry already holds, and the history event with a fixed time. Then it
applies them. Grades use `applyPracticeGrades`, a compare-and-set on the fingerprint:
a card already in its planned state is left alone, and a card moved for another reason
is **skipped and reported, never forced**. Activity uses `recordActivityOnce` at the
frozen instant. The event uses `recordPracticeEvent`, idempotent on the sitting id. The
plan is dropped only when all three said `durable`, and a small receipt of sitting ids
answers late duplicates. Any failure leaves the plan, which the next call or
`recoverPracticeCompletion` replays. Only a finished sitting with answered work
completes. Completions are serialised on the device, and a second call replays the
plan already frozen rather than its own.

Every practice write binds the account and a scope generation when it is asked for, and
refuses to write if either moved (`scopeGeneration` in `storage/scope.ts`, bumped on an
account switch and at the start of `clearActiveUserData`). A sign-out or an account
deletion mid-await therefore neither writes into the next account nor resurrects a
deleted namespace. A refused write raises no dirty flag. Ordinary `gradeCards` and
`recordActivity` are unchanged.

What is not guaranteed, said plainly. The plan is local, so uninstalling or clearing app
data between freeze and settle loses whatever had not landed yet; there is no
server-side receipt. `durable` is still AsyncStorage's resolve, not an fsync. A card
reviewed elsewhere between a failed grade write and its retry keeps the other grade,
and the practice grade is reported skipped. Cross-device resume is not implemented.
The proof is `practice/history.test.ts` and `practice/completion.test.ts`: each write
refused in turn, a crash before cleanup, a racing duplicate, an account switch before
and after the freeze, a deletion mid-write, old and newer schemas, byte-budget
associativity, and envelope size.

### Goal steps: a goal, one task, and what came of it

**Status: implemented and tested locally. The server half (migration
`202609250001_learner_state_goal_steps.sql`) is prepared and not applied to
any project, so until an operator applies it the goal steps sync nowhere: pushes are
refused at the door exactly as F411 described, and they stay on the phone.**

`goalSteps` (`goals/model.ts`, `goals/store.ts`) holds two kinds of row. A
`step-started` row says a conversation opened from a goal card became a real room: the
live session id (which is also the id of the pack that conversation is saved as), the
goal's normalised key (`factKey`, the same normalised text the profile envelope already
carries in `learnerGoals`), and a task id such as `mission:cafe`. It is recorded once
per session id, and only after the room has published a view, so a failed join records
nothing and a reconnect records nothing twice. A `used-outside` row is the learner's own
report that they used that step outside the app: `u.<step id>` and the goal key, and no
phrase, outcome or count. The validator is exact about keys and the task id has no space
in its alphabet, so no sentence can ride. Nothing is attributed by timestamp: a
conversation the learner did not open from the goal card is never linked to a goal.

The merge is a set union on the whole row, sorted by `(at, kind, id, rendering)`, newest
sixty. A union keyed on `(kind, id)` with a canonical pick is not associative here (the
rendering puts `at` first as text, so the older of two copies can win and then be cut),
so storage keeps whole rows and the reader view, `uniqueGoalSteps`, shows one per
`(kind, id)`.

What a reader shows, said plainly. `goals/evidence.ts` joins a step to its pack by id,
then to that pack's own practice outcomes through `packTargetsOf`, then to the used-outside
flag. It shows nothing for a step whose pack is no longer in the cache, nothing for a
`used-outside` whose step has aged out, and nothing for a goal key that is not the
`factKey` of one of the profile's current `learnerGoals`. A removed goal's normalised key
may therefore stay in `goalSteps` until it ages out of the newest sixty, on the
`forgottenFacts` precedent (`profile/memory.ts`): the rows are never dropped on goal
removal, because that would break the set union. They stay in the data export, and account
deletion sweeps the key with every other suffix. The self-report touches nothing else: no
review card, activity entry, drill, momentum, XP or practice time, and
`goals/store.test.ts` holds that byte for byte.

### The game layer: streak, goal, quests and badges

**Status: the stores, settlement, celebrations, and Home/My French quest and streak
surfaces are integrated. The database migration `20261006120000_learner_state_game.sql`
is still recorded as prepared, not verified live. Apply it before shipping a build
that writes `game`; otherwise sync refuses the namespace and facts remain local.**

`game` (`game/model.ts`, `game/store.ts`), inner version 2 (reads version 1), holds facts and never a
number derived from them. The streak, the level and quest progress are computed by
core from these facts and the activity log every time.

| field | what one row is | merge | bound |
|---|---|---|---|
| `sittings` | a finished sitting that earned no XP: moment, source, optional `activeMs` (whole milliseconds, at most a day) | union by `(at, source)`, the measured copy wins | latest 500 rows |
| `covers` | a streak cover: day, kind (`freeze`, `repair` or `travel`), moment | union by day, the earliest written, then travel, repair, freeze | 2,000 days, never aged |
| `goalDays` | a local day the daily goal was met | sorted set union | 2,000 days |
| `questDays` | the three quest ids a day was dealt, frozen the first time | union by day, the earliest | 60 days |
| `claims` | a quest claimed, with its XP (+10) | union by `(day, quest)`, the earliest | latest 62 distinct claim days |
| `questMonths` | quests claimed and quest XP per calendar month | each field the max | 600 months |
| `xpMonths` | capped activity XP per month | the max | 600 months |
| `bonus` | the fixed +5 "for practising" XP, keyed `<kind>:<day or epoch ms>` | union by key, the earliest | latest 400 keys |
| `bonusMonths` | fixed XP per month | the max | 600 months |
| `badges` | a badge id and the moment it was earned, or null when counted from older practice | union by id, a dated award beats null, then the earliest | never aged; 500 ids |
| `seen` | a celebration key already played, anywhere | union by key, the earliest | latest 800 keys, with durable milestone/level/badge/purchase keys ranked ahead of day-scoped keys |

Every rule is a set union or a maximum, every collision is settled by a total order and
every bound keeps the last rows of a sorted set ranked by identity, so the merge is
commutative, associative and idempotent; `policy.test.ts` and `game/model.test.ts`
property-test it over generated blobs that cross every age window and bound. The
monthly rollups are folded from the store's own claims and fixed XP on every local
write, before anything ages out, and never by the merge (a merge that derived them would
depend on which rows each grouping had already aged out). The named cost: two devices
that each claimed different quests in one month and did not sync for two months keep
the larger of their two counts, not the sum. A rollup can undercount; it never invents
a quest. Badges and celebration keys are opaque, so a badge a newer build awarded is
kept by an older one even when it cannot draw it. A new quest id, cover kind or sitting
source is a new value an older build refuses, so it must raise the version.

Which celebration keys age out is decided by the key's kind and nothing else
(`isDaySeenKey` in `game/model.ts`): only `streak:` belongs to a day. A
milestone key holds a date and must still never age out, whichever order its parts are
written in, or the milestone plays again. `celebrate/events.ts` (Phase 1) carries its
own copy of that rule and should import this one. A key is a lowercase kind and up to
four segments of letters, digits, dots, hyphens and underscores, so a store transaction
id fits and no sentence can.

Reads are strict. A blob from a newer build, a stray key, a wrong type or an unknown
cover kind is refused, never repaired: every write answers `failed` and leaves the
bytes, and the adopter declines. An empty list offered to a write is nothing to write
and answers `durable`, as `progress/activity.ts` does, because the settle pipeline will
offer lists that are empty on most sittings. The largest blob the reader accepts is
built in `game/capacityFixture.ts`, with every moment at the sixteen digits the reader
allows, and measured at about 436 KB sealed (441 KB before the chest claims went,
D22), inside the 512 KiB envelope;
`scripts/verifyDataBoundaries.mjs` writes it into a disposable database too, where the
server's own byte limit measures the jsonb as text. That is why `activeMs` has a
ceiling: an uncapped double such as 1e308 is 23 characters on the phone and 309 digits
in the server's rendering.

**Clock-safe retention (F753, 7 October 2026).** Version 2 keeps count-bounded
sets instead of measuring an age cutoff from the newest row. A far-ahead device
can occupy a slot, but cannot erase a whole recent history with one timestamp.
The merge remains clock-free, commutative, associative and idempotent. At a full
count bound, a newer identity still replaces an older one; this is a storage bound,
not a promise to identify an incorrect device clock. Version 1 is read and upgraded
without discarding its surviving facts. Earlier builds refuse version 2 instead of
applying their age cutoffs to it. Already discarded v1 rows cannot be recovered.

`gameLocal` (`game/gameLocal.ts`) is never synced and registers no adopter:
`lastPracticeOffsetMin`, `paidSince`, `protectedSince`, the last 30 days of `nudges`,
`nudgesPausedAt`, `introducedAt` and up to 32 `pending` celebrations, read as strictly as
`game`. `protectedSince` (D23, 2026-10-20) sits beside `paidSince`: the local day this phone
first saw a plan that holds a streak freeze, including the free plan's one included freeze;
a freeze never covers a day before it. It was added after version 1 shipped, so a stored
record without it reads as null rather than being refused. Queueing
celebrations answers `failed` and writes nothing when the ceiling would cut one of the
moments offered, so a crash-replay entry is never reported as kept when it was not.

A finished sitting is a practice day whatever it earned (founder decision D3, F731).
`recordActivity` now answers a `PersistAck`. A sitting that earned no XP never writes an
entry. When its caller marks it `finished`, it records its day through `recordActiveDay`:
no entry, no XP, no minutes and no new activity kind. When the caller does not, it
writes nothing, because not every caller reaches `recordActivity` only for a finished
sitting: the bank drill records on the way out, so a drill left from the header with
nothing answered arrives with 0 XP exactly as a finished set with nothing right does.

**The settle pipeline (Come alive Phase 1, F744, F745).** Every place a practice
finishes settles it once through `game/settle.ts`, and nothing else writes the game facts
for a sitting: the conversation inside its stop guard (`ConvoScreen.tsx`; a safety stop
settles nothing, F137), the lesson's summary callback (`nav/RootNavigator.tsx`), the bank
drill worked to its end (`DrillScreen.tsx`), the practice sitting wherever its durable
plan answers `completed` (`practice/completion.ts`: the screen's finish, its retry, or
the recovery Practice, the next-task card and the drill screen run at launch), the review
when its queue empties (`ReviewScreen.tsx`, banked once with the unmount path), today's
phrase once its day is durable (`daily/DailyPracticeScreen.tsx`) and a kept guest practice
(`game/guestHandoff.ts`, which writes each guest day's `streak:<day>` into `game.seen`
before recording the day). Each passes `finished: true` to its own write, so a zero-XP
finished sitting still records its day in the activity log's `activeDays`
(`recordActivityOnce` honours it too, for the practice plan); a sitting left early passes
nothing and records nothing. `beginSettle` snapshots the activity log, the practice days
and `game` before the write, and a caller whose account changed during that read never
starts the write. A practice plan keeps its first snapshot across a `kept` answer and
settles at the instant the plan froze, so a retry reports what the sitting earned and
never makes a second practice day after midnight. `finishSettle` then runs alone on one
chain. Its facts are for today, or for the day before when the sitting ended just before
midnight and is settled within two minutes; anything later settles against today, so no
quest is dealt or claimed for a day already over. It writes in order: a `game.sittings`
row for a zero-XP sitting; the +5 `bonus` for a win nothing grades (`phrase:<day>`,
`guest:<day>`, `review:<ms>` when nothing was recalled); `covers` (travel, freezes, then
a repair, only for a plan `capabilitiesFor(plan, lapsed).streakProtection` opens, with
`paidSince` and `lastPracticeOffsetMin` kept in `gameLocal`); `goalDays`; `questDays`
(dealt once and frozen, with no live-minute quest unless the server confirmed minutes
and no recording quest unless the microphone is granted; the guest hand-off deals none,
because it runs before either is known, and leaves the day to the first catch-up);
`claims`; `xpMonths` (the store folds `questMonths` and `bonusMonths` itself); and
`badges`. It reads all of it back into one `GameDelta` (`game/delta.ts`). Its XP is what
the capped total of the sitting's own day gained (`xpCreditedFor`), so a replay counts
nothing twice and entries aging out of the log in the same write take nothing off it. Its
milestone is one the sitting's own practice day crossed, measured against the run as the
covers now held bridge it, so a freeze or repair never replays an old milestone. It turns
the delta into moments (`game/events.ts`), drops any key already in `game.seen`, queues
the rest in `gameLocal.pending` and hands them to the host, which marks each seen once it
has played. A changed account makes it answer null and write nothing more. Until the
existing-learner seed has run on this phone (`gameLocal.introducedAt`) a settle awards
no badge and plays nothing. `GameProvider` runs that seed once per account per phone
(badges derivable from saved practice, dated from the data or `null`; `xpMonths`; no
cover; every current streak, milestone, level and badge key marked seen, with the
durable `intro` key) and shows the one intro sheet only to a learner with practice days
whose account was never introduced. On mount, foreground and a screen's `refresh` it
runs the quiet catch-up, which reconciles the same facts (freezes only), marks what is
true seen without playing it, and replays only a durable moment a crash cut short, once;
a sitting that begins while it runs stops it (`settleEpochNow`), so the sitting keeps its
own moments. Two devices can be dealt different quests for one day; after a merge the
earliest deal is shown, and a quest the other device credited stays earned (its claim
counts in the XP total, the monthly quest count and the day's count of quests done, which
reads every quest claimed that day up to three and so never falls after a merge).
The reminder planner hears every settled sitting through `onSettled` and plans the next days
again (see "The daily reminder, version 2" below).

There is no quest chest (founder decision D22, F773). A claim is a quest, +10, and
nothing else; finishing all three is one quiet line on the end card. The delta's
`doneBefore` is the day's count from the merged facts less the sitting's own claims, so
the line's `quest` sound plays only for the sitting whose own claims took the day to
three, never again after a merge or a sync that lands mid-sitting. The reader refuses
a `chest` claim and a `chest:<day>` seen key as rows no build writes
(`RETIRED_SEEN_KINDS`). Nothing that wrote them shipped, so no stored data was
migrated.

### The pre-recap window

**Owner: tutor-agent. Closed in code; deployment proof is still required.**

The journal covers everything after the recap arrives. It cannot cover a session
killed BEFORE it. The wire's `ConvoView` carries no phrase list, so until the
recap the app holds a transcript and nothing else, and turning a transcript into
review cards is curation, which the agent owns. A learner who talks for ten
minutes and force-quits during the goodbye used to keep the minutes they spent
and none of the phrases they earned.

**The agent persists the recovery artefact.** `finish()` in
`services/tutor-agent/src/convo.ts` shares one completion promise; its ordinary
completion pipeline ends with

```ts
await Promise.allSettled([this.extractMemory(state.turnCount), this.curateAndDrill(state, recap)]);
this.logSpendSummary();
```

and where that join sits is the whole of it. It is *after* `reportUsage`, so the
minutes debit never waits on analyst work, and *before* `logSpendSummary`, so the
biggest spend of the session is inside the summary instead of running after every
reader of it has moved on. The worker holds the room open for it: `agent.ts`
disconnects on `finish().finally(...)`, never ahead of it. Both calls were
`void`ed and unawaited until F101 closed that, and a document that still describes
the `void` sends the next engineer to fix a fixed thing and walk past the loss
that is actually there.

Safety stops return after closing the usage ledger and skip this enrichment and
all pack writes. Ordinary learner exits cancel live frame/turn requests and speech
but still finish saved practice, as the founder selected on 2 October 2026.

The agent writes an audio-free `generating` Conversation Pack to
`public.conversation_packs` immediately after the recap and upserts the same
session to `ready` after curation and drill authoring. The authenticated Practice
tab pulls that server-owned record and merges its exercises into the usual drill
bank. A force-quit therefore loses only the live-room delivery, not the curated
practice record; the app recovers it on the next authenticated refresh. The
session id is unique in the table, so retries cannot create a second pack.

The live `practice`, `drills` and enriched `recap` frames still publish into the
room. `lastRecap` remains the only in-room replay, and the
`participantDisconnected` path can still leave before those frames arrive; the
durable Conversation Pack is the cross-session recovery for the learning
artefact rather than a second transcript or an unbounded room replay.

This is not an outbox guarantee: the agent retries three times, but a token-server
or database outage lasting longer than that is logged and needs operations follow-up.
The migration and this recovery path still require an end-to-end deployed test
before they can be described as release-proven.

### Attempt audio, and the one thing on the phone that is not a key

The stores above are the whole of what a learner leaves in AsyncStorage. They are
not the whole of what a learner leaves on the phone.

Two screens record. The drill's spoken attempt (`DrillScreen`) and the sound check
(`soundcheck/SoundCheckScreen`) both go through `expo-audio`, which writes the take
to a **file in the app's own cache** and hands back its uri —
`<cache>/ExpoAudio/recording-<uuid>.m4a` on iOS and `<cache>/Audio/recording-<uuid>.m4a`
on Android, read off the SDK 57 sources rather than guessed. That uri is uploaded to
be scored, and until F115 that was the end of the story: nothing ever removed the
file. So "`soundChecks` holds evidence, never raw audio" was true of the store and
false of the disk, and a learner who deleted their account left their own voice
behind on the device.

Two things close it, and they are deliberately not the same thing.

**The attempt deletes its own recording.** `speech/discardRecording.ts` owns that.
`consumeRecording` lets the scorer finish reading the file and only then removes it,
on every exit: scored, unscored because assessment is off, refused, thrown, or a
take that arrived after its beat had passed. A discard that fails costs the learner
nothing and leaves `[luvani] RECORDING_NOT_DISCARDED` in the log, because swallowed
is not the same as hidden.

**The reset sweeps whatever is left.** `clearActiveUserData` empties the two cache
directories `expo-audio` records into (`storage/attemptAudio.native.ts`) **before**
it touches a single key, and its one door goes through it — account deletion. It
is the backstop for the three cases per-attempt deletion cannot
reach: the app killed between `stop()` and the delete, the builds that shipped before
that discard existed and whose recordings an upgrade does not remove, and whatever
path nobody thought of.

The **cache root is not swept**, on purpose. `progress/saveFile.native.ts` writes the
Anki export straight into `<cache>`, and a learner who exported a deck and has not
opened the share sheet yet would lose it. Only the two audio directories go, and both
are recreated by `expo-audio` on the next recording.

A sweep that cannot finish does not take the reset down with it. The keys still go,
the module caches still drop, and `[luvani] ATTEMPT_AUDIO_NOT_SWEPT` is what says so.
A failed **key** removal still throws exactly as it did, and `App.tsx` still tells the
learner plainly that this device could not finish erasing its local copy.

There is no file to sweep on web: `expo-audio` hands back a `blob:` URL there and
revoking it is the whole of the cleanup, which is why `storage/attemptAudio.ts` and
`speech/removeRecording.ts` are the web halves of a Metro platform split.

What is proven and what is not, said plainly. The policy is under test in
`speech/discardRecording.test.ts` and `storage/scope.test.ts` — the ordering, the
exit paths, the failure discipline, and that both reset doors call the real sweep
rather than a test double. The unlink itself is a platform call that no test on a
laptop can execute, so it is read as source instead. That half is a device check and
it has not been run on one yet.

### The daily reminder, version 2

`reminder` (`reminders/store.ts`, per account, device-local, excluded from sync) is
`{ version: 2, reminder, log }` since Come alive Phase 4 (founder decision D2, F771).
`reminder` is the learner's choice: `enabled`, `time` (one of the four presets or `smart`,
which follows their own first finish of the day), `days` when chosen, and two flags written
only when they differ from the default, `mentionStreak: false` and `paused: true`. `log` is
what the planner needs to know when to pause: the day keys a reminder arrived (`sent`), was
tapped (`answered`) or was followed by a visit to the app (`opened`), the last 14 of each;
the slots last handed to the OS (day, time, which line, whether it is the pause note) and
`plannedAt`, the instant they were handed over, which names that plan; and the last line
that went out, so the next day's differs. Day keys and line ids only: no
words, no counts, nothing the learner said. A version 1 envelope is read with its time kept
and an empty log, so an existing evening stays the evening; a version 2 envelope missing
either half reads as unreadable. The OS holds the schedule itself as dated one-off
notifications named `practice:{day}`; the planner cancels only those, by name, and signing
out cancels them all. `gameLocal`'s `nudges` and `nudgesPausedAt` fields predate the planner
and are not written by it.

The same envelope carries an optional `trial` field for the trial-ending reminder
(`reminders/trialReminder.ts`, 2026-10-19), device-local and per account like the rest of
`reminder`, never synced. It stores at most three things, each written only when it differs
from the default: `enabled: false` when the learner turned "Trial ending reminder" off
(default on); `endsAt`, the end instant of a store free trial this device saw confirmed; and
`confirmedAt`, the instant `scheduleTrialReminder` recorded that confirmation (kept only
beside `endsAt`). No product, price, store id or receipt. A learner with no daily choice gets
`reminder: null` beside it, which reads exactly as a missing key; that null is accepted only
next to `trial`, and an unreadable envelope is never overwritten by a trial write.

`confirmedAt` exists for one rule: for 15 minutes after it (`TRIAL_CONFIRM_GRACE_MS`), a
server answer of the free-minutes plan is read as the server not having caught up with the
purchase, and the reminder stays. After the window the same answer is a downgrade: the
reminder is cancelled and `endsAt` and `confirmedAt` are cleared. The grace covers only
that reading; a lapse, a store fact showing conversion, or auto-renew off cancels at once.
A record without `confirmedAt` gets no grace. Settings reads `trialReminderState()` /
`useTrialReminder()` `onRecord` (an `endsAt` still ahead) and `trialEndsAt` to decide whether
to show the switch, rather than inferring a trial from billing.

The OS holds that reminder as one dated one-off named `trial-end:{instant}`, at 6 pm local on
the day two days before the trial ends. The daily planner's cancels match only `practice:`
and the trial reminder's only `trial-end:`, so neither removes the other
(`weekdaySchedule.test.ts` runs both against the native code). It is scheduled only with
permission already granted, and cancelled when the trial converts, lapses, stops renewing, is
restored into a non-trial plan, ends, when the setting goes off, and when the signed-in
account has no trial on record (`trialReminderSync.ts`).

A guest who said yes on day one has no account to key a log under, so their choice rides in
the first run's draft and their log is one device key, `@luvani/guest-reminder/v1`: whether
the pause note has gone out, and the same day-key log. The planner clears it when the draft
carries no reminder (a refusal, a new plan) and when an account plans instead.

One more device key, `@luvani/reminder-held/v1`, is `{ version: 1, plan }`: the
`plannedAt` of the plan the OS was last handed, or null once a plan was taken back. It is
the device's rather than an account's because a sign-out has to write it after the account's
own keys are closed. A slot counts as arrived only while the OS held its plan: a log whose
`plannedAt` is not the held plan counts none of its slots (`plan.ts` `heldLog`), and every
place the planner takes a plan back (off, paused, no permission, a refused schedule) clears
the held plan first and closes the log, keeping what had arrived and dropping what was still
to come. So a reminder that was turned off, refused, or left behind at a sign-out can never
come back paused. An unreadable key reads as no plan, which can only delay a pause. One
number, no user id, no words and no days.

### Device-level keys, and the one that retired

Almost everything is per-account. Two keys are not, because they are read before
anyone is signed in and `userKey()` throws there: `luvani.legacyMigrated.v1`, the
marker that stops a second account inheriting the first one's pre-auth data, and
`luvani.seenSplash.v1`, which recorded that this install had seen the pre-auth
splash.

A device-level key is the one kind that survives everything a learner can do to
their own data: it outlives `clearActiveUserData`, it outlives signing out, and it
outlives deleting the account. So when the screen that reads one is deleted, the
key does not go with it — it sits on every phone that ever ran the old build,
readable by nobody.

The splash is gone, so `luvani.seenSplash.v1` now encodes "has seen a screen that
no longer exists". Nothing of value is lost by removing it, and that is the whole
migration. `RETIRED_DEVICE_KEYS` in `scope.ts` names it and `migrateLegacyStores`
sweeps it on sign-in, in the same batched read the legacy inheritance already
does — **before** the `luvani.legacyMigrated.v1` short-circuit, deliberately. Every
device still carrying the flag inherited its pre-auth data long ago and therefore
already has the marker set, so a sweep behind the marker would run only on the
devices that do not need one. It is idempotent because a key that is gone never
reads as present: after the launch that removes it, the sweep costs one entry in a
batch already being read and no write at all.

The audit that has to happen before a key joins that list is in
`docs/DELETION_LEDGER.md`, and `scope.test.ts` holds both halves — that the flag is
actually removed, and that nothing in the app still reads a key the sweep deletes.

### The sync contract

Since Phase 2, the account rather than the device is the durable home for most
stores; `sync/policy.ts` is the count of record (fifteen synced, seventeen excluded after
the device-local first-live arrival receipt and the appearance choice joined). `apps/mobile/src/sync/` holds a **state-based reconciler**:
the stores write to disk locally first, exactly as before, and afterwards a
background engine pushes the whole current blob to `learner_state` with a
compare-and-swap on the `revision` column. Losing the swap means another device
wrote first, so it pulls, merges under a per-domain policy, hands that answer
to the store's own adopter to **fold into whatever the store holds by then**, and
pushes again.

The fold is the part worth remembering. Everything the engine computes, it
computes from a blob it read before a network round trip, so an adopter handed a
finished value would write over a grade or a banked session that landed in
between. Instead the store gets a function, calls it inside its own write chain,
and writes what comes back — read, fold and write with nothing able to land
between them. It is safe because the merge policies are commutative and
idempotent, and all but `profile` associative as well.

Local first is not a slogan here. Nothing in `sync/` sits on the path of a
learner saving anything, and an engine that cannot reach the network is a learner
who can still study.

Four pieces, and each has one file:

| file | what it owns |
|---|---|
| `sync/envelope.ts` | the wire shape `{ v, deviceId, savedAt, data }`, the 128KB ceiling, and reading a payload back safely |
| `sync/registry.ts` | the seam: stores call `markDirty(ns)` after a write lands, and register the adopter the engine hands a fold to |
| `sync/backoff.ts` | full-jitter exponential retry, base 1s, cap 60s, injected clock |
| `sync/engine.ts` | when to reconcile, the compare-and-swap, quarantine, the size refusal |
| `sync/policy.ts` | **what the answer is** when two devices disagree |

`sync/policy.ts` is the one to read. Fifteen namespaces under three merge classes:

- **structured** — `profile`, delegated to `@luvani/brain`'s `mergeStoredProfiles`.
- **per-item** — `review` (delegated to core's `mergeDecks`), `drills`, `topics`,
  `bookmarks`, `scenarioProgress`.
- **set-union** — `history`, `activity`, `missions`, `soundChecks`, `coachMarks`,
  `tutorIntro`, `practiceHistory`, `goalSteps`, `game`.

Two of those per-item rules are worth stating, because the obvious smaller shape
is wrong in both cases. `bookmarks` unions by situation and keeps the **newer
decision**, not a union of saved ids: a union can only ever add, so an un-save
would come back the next time any other device folded its older copy in.
`scenarioProgress` unions by mission and keeps the **newer record**, and it
combines nothing — adding two devices' elapsed times, or taking the further
`beatsDone`, would invent a sitting that never happened and then put a pace
estimate under it. Both take the device clock as the ordering, which the rest of
this table refuses to do, and they do it because a bookmark tap and a walk-out
produce no count that goes up: there is no clock-free evidence to order two of
them by, and the order the clock gives is at least total.

`activity` keeps its `(at, kind, xp)` identity now that entries carry a
`durationMs`. Widening the identity would make one sitting two rows across the
upgrade and count its XP twice, so the identity stayed and the **pick** changed:
where two copies of the same sitting meet, the one carrying a duration wins, and
a device that synced before the field existed cannot erase a measurement a newer
one made.

Seventeen are excluded, each with a written reason in `SYNC_EXCLUSIONS`.
`appearance` is the light, dark or follow-device choice for this phone and its
account; syncing an explicit override would change another device's appearance.
While dark mode is off it is stored but never drawn.
`first-live-arrival` records whether this phone has displayed the first-session welcome
and streak. It is account-scoped and cleared by account-data reset. It carries no
learning credit; syncing it could suppress a pending presentation on another phone.
`onboarding-setup-draft` and `onboarding-repair-draft` hold the current route and
unconfirmed answers on the device that started setup. A merge must not reopen
another device's flow, replace a completed profile with an unfinished answer, or
carry a device-local consent answer across devices. Explicit confirmation writes
completed answers to the existing profile stores; the local drafts clear on
completion or account-data reset and are included in the account export.
`gameLocal` holds
the facts about this phone that the game layer needs: the OS schedule of streak
reminders, the time zone of the last practice and the plan this phone last observed.
Syncing them would nudge one learner twice and let one device's billing read decide
another's. `home-seen` is what this phone's Home last drew (`home/homeSeen.ts`): synced,
a tablet would skip a rise the learner never saw on it, and every real number it
mirrors already lives in the synced `game` and `activity` records. `pendingPurchase` is a device-local checkout fence written before a native store request, with the selected paid plan/product and the prior plan/period. The envelope is version 2: it also keeps `startedAt` (ISO, when the fence went up) and `deferred: true` once the store holds the checkout for approval (Ask to Buy), so the page still says "Waiting for approval" after a reopen. A version 1 record still reads, with `startedAt: null`, and still fences. It blocks another checkout after a restart until cancellation, fresh matching paid-period evidence, or `resolvePendingCheckout` (F848) resolves it: the store, asked read-only through `storeHolds` after the learner taps Start again (never on open), holds no purchase. An active store answer never clears it, because an existing same-tier subscription also reads as active. An unknown store answer never clears it, and an unchanged older subscription is insufficient. Unknown storage stays unknown. It is erased and exported with the account, and is never synced as billing authority. `practiceSession`
is the unfinished sitting and its completion plan: its meaning is local to this device's
bank and deck, and a copy on a second device could finish the same sitting again, so
completed sittings travel through `practiceHistory` instead. `packMarks`
annotates the pack cache and is excluded for the cache's own reason, at the cost of a
second phone re-offering a practised pack once. `moments`
is a kind and one line in the learner's own words about their own life, an
interview next week, a call to a doctor: the most personal text the app holds,
kept on the phone that typed it and nowhere else, at the cost of typing a line
again on another phone. `journal`
is a device-local crash buffer whose whole meaning is bank-then-delete, so
syncing it would re-bank a session another device already banked. `friends` is a
dormant surface running on labelled sample profiles, and syncing it would write
fixtures into the account where they would outlive the decision to ship the
feature. `reminder` is a property of one phone: the OS holds the schedule and
permission is asked for per install, so an account-level time would nudge one
learner twice for one evening on two devices, and would tell a device that was
never asked for permission that it already has a reminder. `conversationPacks`
is a device cache of a server-owned record: syncing it through `learner_state`
would create two authorities and let an old device re-push a stale pack over the
Tutor agent's completed-session upsert. `suggestions` is a seed and a
position in one learner's deal of the authored scenario pool rather than anything
they have learned: the position indexes an order the seed produced over a pool
that grows between releases, so the same pair names a different situation on two
builds. `analytics` is a consent, and every merge in the table resolves a
disagreement by picking a winner: the only winner a permission may have is the
most recent thing the learner actually said, so a fold that could carry an older
yes over a newer no would turn a withdrawal into a setting that comes back by
itself. The price is that a consent is per account per device, and someone who
says yes on a phone finds the switch off on a tablet.

Three rules hold the whole thing up:

1. **Every policy is commutative and idempotent by construction.** That is why
   there is no operation log and no vector clock: a duplicate push, a replayed
   retry and a reconnect are all no-ops. `policy.test.ts` property-tests it.
2. **Never push over a payload whose inner schema version is newer than this
   build writes.** That namespace goes pull-quiet instead. An older app that
   merged a newer app's blob would drop every field it did not recognise and push
   the loss to every device.
3. **Nothing is recomputed.** No mastery, no interval, no CEFR estimate. Merges
   carry what each side stored; the pedagogy judgements keep their owners.

`revision` lives only in the column, never in the envelope, so there is exactly
one ordering truth. `202608260001_learner_state_revision.sql` adds it with a
BEFORE UPDATE trigger that overwrites whatever the client sent with
`old.revision + 1`, which makes the column monotonic whatever a client believes.

What this does **not** do: it does not merge `cefr`, memory facts or `stats`
field-wise. Those ride whole with the evidence-heavier side, so two simultaneous
offline sessions lose the smaller one's deltas to those three fields. Phrases and
error patterns always survive, because they are unioned. That is the biggest
accepted loss in the design and field-wise merging is Phase 4. The outer
`forgottenFacts` markers are unioned as a sorted set (`PROFILE_UNION_FIELDS`),
without count expiry, and applied to the raw merged brain even when only one
side is readable. Forgetting clears the unsourced opener too. `learnerGoals`
rides whole, there being no clock to order two lists by. The optional
`memory.control` is a separate exception: the highest validated `changedAt`
selects pause/resume, with pause winning equal clocks. This prevents a busier
stale device from silently resuming memory, but does not solve device clock skew.

`npm run verify:sync` runs the whole engine twice as two devices on two real
accounts against a live project. It proves isolation, forged filters, offline
replay across a restart, duplicate convergence, two-device conflict convergence
and quarantine of a corrupt payload — and it says `BLOCKED` rather than passing
when the credentials are absent.

`apps/mobile/src/profile/store.ts` holds `StoredProfile`:

```ts
{ version: 9, name, dob, ageConfirmed, ageStopAt, tutorVoice, preferTyping, forgottenFacts, learnerGoals, motivation, dailyGoalMin, onboardedAt, username, brain: LearnerProfile }
```

`brain` is `@luvani/brain`'s learner model, stored verbatim — the app is its
storage, not its author.

`apps/mobile/src/profile/upgrade.ts` is the app-side forward migration.
`upgradeStored` takes whatever was on disk and returns a version-9 profile or
`null` if it cannot be read at all. Version 1 and version 2 records both gain
`username: null`; a version-3 record keeps the username it already has. Every
branch below 5 writes no `ageStopAt`, every branch below 6 no `tutorVoice`,
every branch below 7 `preferTyping: false`, and every branch below 8 empty
`forgottenFacts` and `learnerGoals`: a field's slot on an older disk is never
read as an answer the learner gave.

Version 4 stopped asking for a date of birth and asks whether the learner is
thirteen or over instead. `dob` stays on the type forever and nobody's is
deleted; new learners simply never have one written down. A stored dob that puts
the learner at or over the floor derives `ageConfirmed: true`, and everything
else derives `null` rather than `false`, because false is a statement nobody
made. `motivation` and `dailyGoalMin` widened to nullable in the same change,
which was free: neither had a consumer anywhere outside the profile store and
the onboarding flow. That is a
separate concern from the brain's own `repairProfile`, which repairs the nested
`brain` field — the outer envelope and the learner model version independently.

## The brain's learner model

`packages/brain/src/profile/profile.ts`, `version: 2`:

| field | what it holds |
|---|---|
| `cefr` | estimate, confidence, and a rolling window of evidence |
| `errorPatterns` | what they get wrong, with a count and an example |
| `phrases` | what they have been taught, and whether it is mastered |
| `memory` | facts worth remembering, and an opener |
| `preferences` | strictness, recent scenarios |
| `stats` | sessions, turns, rescues, `lastRung` |

Everything is capped — 12 memory facts, 200 phrases, 40 error patterns — and the
phrase cap has a hard reason: **the whole profile rides the session join
credential**, which has a fixed size ceiling.

## The round trip, and where it broke

```
device  ──POST /session/start { snapshot: profile.brain }──►  token-server
        signs it into the join token metadata, opaquely
        ──►  agent: parseStoredProfile(meta.snapshot)  ──►  the engine
        ◄──  { t: 'recap', profile }  ──►  updateBrain() writes it back
```

Validation is deliberately loose: a tampered profile moves pedagogy, never
minutes. But every field the engine dereferences at session open **must** exist,
or a malformed blob takes the worker down instead of degrading to a fresh profile.

`memory` is the field that proved this. It arrived after version 2 was already on
devices, and `migrateProfile` only fills it in for version 1 — so a version-2
profile without it passed straight through and the first read of
`profile.memory.facts` threw at session open.

**`repairProfile` (`packages/brain/src/profile/profile.ts`) is the one place that
knows how to bring a stored profile forward.** It keeps error patterns, phrases
and CEFR evidence and rebuilds only what is broken. Both doors use it: the agent
when it reads a snapshot, and the app when it loads from disk — because fixing
only the agent leaves the device still emitting bad snapshots.

If you add a required field to `LearnerProfile`, add it to `repairProfile` in the
same change.

## Server side

`services/token-server/src/store.ts` — `EntitlementStore` has four async operations:
one-time trial claim, read, plan save, and idempotent session consumption.

- `InMemoryEntitlementStore` — explicit local fallback. **A restart returns everyone's
  minutes**, so it is refused in production.
- `FileEntitlementStore` — optional local development JSON,
  written to a sibling and renamed over the target, because rename is atomic and
  a half-written balance file is worse than a stale one.
- `SupabaseEntitlementStore` — selected when `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY` are present. Reads and plan changes use PostgREST;
  consumption uses the atomic `consume_entitlement` database function.

The free plan (`trial`, D24, 2026-10-20) is a five-minute weekly taste. An entitlement
that passed the device claim, or lapsed from paid (`lapsedEntitlement()`), carries
`weeklyTaste: true` (`entitlements.weekly_taste` in
`supabase/migrations/20261020140000_weekly_free_taste.sql`). Its first debit above zero
sets `periodEnd` seven days out (`recordUsage`); a read at or after that instant refills it
(`refillTaste`: `secondsUsed` back to 0, `periodEnd` cleared), so the window rolls from first
use. A trial row without `weeklyTaste` never refills. The local stores apply
`refillTaste(rollPeriod(row, now), now)` on read; opening a taste's window keeps the usage
epoch (a refund in it restores), while a refill starts a new one, as the SQL does. They do
not copy the SQL rule that a refill waits while a claimed session is live. The file ledger
accepts `weeklyTaste` only as a boolean; an older file without it still loads.

`supabase/migrations/202608220001_luvani_learning.sql` creates the durable
entitlements, privacy-filtered product events and a row-level-secured
`learner_state` envelope for cross-device sync. `learner_state.namespace` carries
a check constraint naming the stores it will accept, so a namespace that is not on
that list cannot be written at all — which is also why `syncState`, the engine's own
dirty set, never leaves the device.

That list named twelve stores and did not name `bookmarks` or `scenarioProgress`,
which is F411: `sync/policy.ts` merged both and both converged correctly between
two copies, while every push was refused at the door with a 400 the engine filed
as `http-error` and retried under backoff forever. Nothing corrupted and nothing
a learner could see changed, because the stores are offline-first and write
locally first exactly as every other store does. What it cost was the second
copy: a learner's saved situations and half finished scenes stayed on the phone
they were made on. `202609050001_learner_state_daily_namespaces.sql` widens the
constraint to fourteen names and closes it, and
`apps/mobile/src/sync/policy.test.ts` now reads both halves so the two lists
cannot part company again silently.

That migration is written and paired with its rollback, and like every other
migration in this repository it takes effect only once an operator applies it to
the project that ships. `supabase/README.md` carries it as file 12 in the apply
order. Until it is applied to a given project, these two namespaces behave there
exactly as described above: device-local in practice, however the client table
reads.
`202608230001_session_usage_idempotency.sql` adds the unique session debit ledger,
atomic three-argument consume RPC, pseudonymous trial claims, and exact event validation.
`202608260001_learner_state_revision.sql` adds the `revision` column and its
trigger, which is what makes conflict detection possible at all.

The device stores are still the offline-first source of truth and always write
locally first. `learner_state` is now a real destination rather than an empty
table: the client is `apps/mobile/src/sync/`, described above, and it reconciles
under the learner's own JWT so the four own-row RLS policies are the enforcement
rather than an app-level check.

Production refuses to boot if identity is unverified, the tutor-agent debit
secret is missing, or entitlement storage is volatile. Client-asserted identity exists
only with the explicit local-development opt-in. Real asymmetric Supabase tokens
retain their signed UUID session claim in local staging too, and must pass the
live account/session check before durable tutor admission. They do not fall back
to the mock identity path when verification or the live check fails.

Billing periods roll lazily on read rather than on a cron, so a learner returning
after their month ends gets their allowance back on arrival.

## Sessions and progress

`recordSession` appends a `SessionSummary` to per-user history; `progress/`
aggregates it into the since-you-started block, and `review/` turns struggled
turns into cards. The end card renders immediately and the history write catches
up — a slow disk must never delay it.

`SessionSummary.nextStartRung` is what the next session opens on. It is derived
from `lastRung` through `openingRung`, and is deliberately **not** stored
separately: a second copy of a derived value is a second source of truth for the
one quantity two engines already disagreed about once.

## Explicit conversation text

`ConversationTextRecorder` holds confirmed room text in memory only until the recap
and an explicit Save choice. It is separate from the displayed forty-turn list,
ConversationPack, profile, sync, journal and learning evidence. Scope reset, leaving
and safety discard it. The authenticated server stores chosen text in
`saved_conversation_text`; there is no AsyncStorage cache. Per-text deletion clears
its words and keeps a retry fence until account deletion. Account export
includes these records. Read/delete is in Progress, Your conversations, Saved
conversation text. The local development adapter does not advertise remote saving.

## Optional kept-phrase tutor audio

Explicit Hear first verifies a server-owned ready/completed source. The phone
compares exact canonical French, selected catalogue voice and opaque configuration
fingerprint; it never posts edited deck words to a synthesis endpoint. Hash keys
include owner/source/French hash/voice/configuration. The native cache is app-private
under `Paths.cache/luvani-phrase-audio-v1`, limited to twenty WAVs and 8 MiB, with
word-free last-used timestamps. Temporary writes commit by File.move; next use
recovers interrupted files. The web preview keeps only bounded memory URLs.
Account reset cancels requests/player preparation immediately and queues cleanup;
deletion awaits pending scope writes plus cache removal and surfaces failures.
Cached or freshly written URI results also recheck the actual auth session before
returning, because storage binding can lag an auth change.

The server retains only `phrase_audio_budgets` account counters and paid accounting
period start, included in the bounded fifteen-table export and cascaded on account
deletion. Global spend has no account/source/text identity. Policy/rate metadata is
operator-owned. There are no server WAVs, phrase reservation rows or word events in
this route. Both switches default off, with a disabled zero-cap DB policy and no
verified rates. Native playback/cleanup and real billing remain release proof.


### Optional can-do evidence
A separate bounded, default-off selector can join the post-recap work. It receives
only the authored outcome and at most eight transient exact accepted-goal source
lines. The worker keeps the first complete independent finish separate from
lifetime earning. Its optional wire carries the issued session and source IDs;
the phone checks its own current win and exact learner line before displaying it.
No new durable record or achievement is written. Actual room exit, safety stop,
service failure and account reset revoke this optional evidence, while ordinary
saved recap/practice enrichment retains its existing finish-in-background rule.
The optional request has a 2.5-second deadline. Returned usage is metered under
can-do-evidence; provider failure, cancellation and timeout are reported as
abandoned work with unknown billing, never a claim of zero spend.
Activation requires both the worker switch and an approved real-French calibration
artifact. No artifact is approved today, so no request is dispatched in normal use.


### Optional live correction explanations
The live thread replaces generated why with a Why? control only for a validated
closed authored reason. Recap/drill reasons stay as before. Session/view/index and
exact confirmed-input pair fence the optional result; no new store or completion
is written. Key/flag alone cannot activate it: real-French calibration must supply
a threshold, which the report does not give. One optional request active, at most
three unique views per session, 2.5-second deadline. New inputs before queueing,
finish, safety/failure and departure cancel it. Reset clears held thread text.
Late provider usage after the first spend summary emits a session/activity-linked
late-usage total, never a learner quote or late explanation. Unknown abandoned
provider billing remains labelled as abandoned rather than claimed free.


### Onboarding continuity and device preferences

`onboarding-practice` is excluded from sync: it holds the bounded starter replies and feedback on this phone. Its guest capability is removed before account adoption. Kept phrases enter the normal synced `review` deck only by explicit import; existing account preferences remain authoritative. Account reset/export include this namespace.

The separate device-only keys are `@luvani/pre-account-onboarding/v1` for choices, `@luvani/guest-practice/v2` for bounded guest replies/capability, `@luvani/has-used-app/v1` (and native SecureStore `luvani.has-used-app.v1`) for a non-personal used-app hint, `@luvani/interaction-haptics/v1` for the device haptics preference, and `@luvani/interaction-sound/v1` for the device sound-effects preference. Neither hint identifies an account. Guest/draft deletion drains queued writes and invalidates pending work. Refusal deletes the guest/draft keys and leaves no refusal marker. iOS keychain reinstall persistence is best effort; Android uninstall clears it.

The server stores a hashed installation signal, usage counters and one-account ownership in a 30-day guest ledger, never replies or recordings. Service attempts expire at 24 hours and the start allowance at one day. Optional anonymous daily event counts expire at ninety days and contain only closed event, variant and evidence enums.

`GuestPractice` (still version 2) gains `finishedAt`: the moments a guest practice was saved as finished, one per local day, oldest first, the newest 31 (F732). A guest's streak day comes from these and nothing else (`guestPracticeDays`), so replies on a practice left unfinished are never a day. A record written before the field reads as having none, because a finish nobody recorded is not one this phone can vouch for. `finishGuestPractice` adds the moment and the `completed` flag together, so the day exists only once that value is saved, and a second finish on a day already held adds nothing, so many finishes in one day never push an earlier day out. Not wired yet: `PreAccountOnboarding.tsx` still saves `{ ...guest, completed: true }` on finish, and `guestPractice.ts` builds a new practice without carrying `finishedAt` forward, so until the first-run owner changes both, a guest records no finish day.
