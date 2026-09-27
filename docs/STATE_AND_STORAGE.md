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
below), `practiceSession`
(the one unfinished practice sitting on this phone and the frozen plan that finishes
it, device-local), and `analytics` (one boolean: whether the learner agreed to usage data being
sent. It is a store of its own rather than a field on `profile` because
`mergeStoredProfiles` picks scalar answers by evidence weight, so a consent on
the profile could let an older yes from a heavier device win against a
withdrawal made on a lighter one, and a consent that can resurrect itself is a
privacy defect. `null` from `loadConsent` means nobody has been asked, which is
deliberately a different fact from a stored `false`).

Before an account exists, the app may also hold `@luvani/pre-account-onboarding/v1`.
It contains only `ageConfirmed: true`, a catalogue Tutor voice key and
`analyticsConsent`, the answer to the usage-data question the first run asks
once. It is not a user-scoped learning store, and is removed once `App.tsx`
creates the signed-in profile. It never holds a name, free-form answer,
transcript or audio. The draft stays at **version 1** with the consent added,
because a missing field reads `false` on load: a draft written before the
question existed is a learner who was never asked, and never asked is opted out.

`journal` is the only store that is meant to be empty. A conversation's recap is
written there the moment it arrives and deleted once every store that took part
in banking it says the write reached the disk, so anything found at launch
belongs to a session that was closed in between and is banked then. It exists
because the order things arrive in leaves a gap: the recap ships first, practice
follows, and the leave-early fallback that covers the difference only runs when
the learner taps Done. Reading the recap and swiping the app away used to lose
the session's phrases outright.

### The age stop, and exactly how strong it is

`profile` is at **version 8**. Version 8 added `forgottenFacts`, the normalised
keys of memory facts the learner asked the tutor to forget, kept as tombstones
because the extraction would otherwise write the fact back the next session that
mentions it, and `learnerGoals`, up to three lines the learner wrote about what
they want from French, appended after the remembered facts in the session
snapshot so the agent's last-five slice always carries them
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

### The pre-recap window

**Owner: tutor-agent. Closed in code; deployment proof is still required.**

The journal covers everything after the recap arrives. It cannot cover a session
killed BEFORE it. The wire's `ConvoView` carries no phrase list, so until the
recap the app holds a transcript and nothing else, and turning a transcript into
review cards is curation, which the agent owns. A learner who talks for ten
minutes and force-quits during the goodbye used to keep the minutes they spent
and none of the phrases they earned.

**The agent persists the recovery artefact.** `finish()` in
`services/tutor-agent/src/convo.ts` ends with

```ts
await Promise.allSettled([this.extractMemory(state.turnCount), this.curateAndDrill(state)]);
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
stores; `sync/policy.ts` is the count of record (fourteen synced, nine excluded once
`goalSteps` joined). `apps/mobile/src/sync/` holds a **state-based reconciler**:
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

`sync/policy.ts` is the one to read. Fourteen namespaces under three merge classes:

- **structured** — `profile`, delegated to `@luvani/brain`'s `mergeStoredProfiles`.
- **per-item** — `review` (delegated to core's `mergeDecks`), `drills`, `topics`,
  `bookmarks`, `scenarioProgress`.
- **set-union** — `history`, `activity`, `missions`, `soundChecks`, `coachMarks`,
  `tutorIntro`, `practiceHistory`, `goalSteps`.

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

Nine are excluded, each with a written reason in `SYNC_EXCLUSIONS`. `practiceSession`
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

What this does **not** do: it does not merge `cefr`, `memory` or `stats`
field-wise. Those ride whole with the evidence-heavier side, so two simultaneous
offline sessions lose the smaller one's deltas to those three fields. Phrases and
error patterns always survive, because they are unioned. That is the biggest
accepted loss in the design and field-wise merging is Phase 4. The one outer field that does not ride whole is `forgottenFacts`: the tombstones of memory facts the learner asked to forget are unioned as a sorted set (`PROFILE_UNION_FIELDS` in the brain's merge), because a forget made on the quieter phone must survive the busier one; `learnerGoals` rides whole like everything else, there being no clock to order two lists by.

`npm run verify:sync` runs the whole engine twice as two devices on two real
accounts against a live project. It proves isolation, forged filters, offline
replay across a restart, duplicate convergence, two-device conflict convergence
and quarantine of a corrupt payload — and it says `BLOCKED` rather than passing
when the credentials are absent.

`apps/mobile/src/profile/store.ts` holds `StoredProfile`:

```ts
{ version: 8, name, dob, ageConfirmed, ageStopAt, tutorVoice, preferTyping, forgottenFacts, learnerGoals, motivation, dailyGoalMin, onboardedAt, username, brain: LearnerProfile }
```

`brain` is `@luvani/brain`'s learner model, stored verbatim — the app is its
storage, not its author.

`apps/mobile/src/profile/upgrade.ts` is the app-side forward migration.
`upgradeStored` takes whatever was on disk and returns a version-8 profile or
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
only with the explicit local-development opt-in.

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
