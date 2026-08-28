# State and storage

Where the learner's data lives, what shape it is in, and the ways that shape has
gone wrong.

## On the device

`apps/mobile/src/storage/scope.ts` keys **everything** to the signed-in account:
`parle.u.{uid}.{suffix}`. `userKey()` throws if called with no active user, which
is deliberate — a store read before the auth gate is a bug, and a silent global
fallback would leak one learner's history into another's session.

Stores: `profile`, `history`, `review`, `drills`, `tutorIntro`, `activity`,
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
`journal`.

`journal` is the only store that is meant to be empty. A conversation's recap is
written there the moment it arrives and deleted once every store that took part
in banking it says the write reached the disk, so anything found at launch
belongs to a session that was closed in between and is banked then. It exists
because the order things arrive in leaves a gap: the recap ships first, practice
follows, and the leave-early fallback that covers the difference only runs when
the learner taps Done. Reading the recap and swiping the app away used to lose
the session's phrases outright.

### The age stop, and exactly how strong it is

`profile` is at **version 5**, and the field version 5 added is `ageStopAt`: the
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
merge (`PROFILE_DEVICE_FIELDS` in `@parle/brain`) so the account copy never carries
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

What is still lost, said plainly. A session killed before the recap, which is
the next section and is not closable from the app. And a batch on a phone that
never gets its space back, which stays in the journal, unbanked and unbankable,
until it does. The proof is in `live/journal.test.ts` and
`storage/ack.test.ts`: storage-full on each store separately, a crash at each
boundary, a launch that still cannot write, a duplicate delivery, and an
account switch mid-recovery.

### The pre-recap window

**Owner: tutor-agent. Closes in Phase 5. Open today, and it is a real loss.**

The journal covers everything after the recap arrives. It cannot cover a session
killed BEFORE it. The wire's `ConvoView` carries no phrase list, so until the
recap the app holds a transcript and nothing else, and turning a transcript into
review cards is curation, which the agent owns. A learner who talks for ten
minutes and force-quits during the goodbye keeps the minutes they spent and none
of the phrases they earned.

**The agent side used to be worse and no longer is.** `finish()` in
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

**What remains is a delivery window, which is a different thing.** `extractMemory`
and `curateAndDrill` publish three frames into the room — `practice`, `drills`,
and a second `recap` carrying the enriched profile. Nothing on the agent stores
them and nothing redelivers them. `lastRecap` is replayed when a reconnecting app
sends `ready`, but only inside the same live room, and there is no equivalent for
`practice` or `drills` at all. So a learner who force-quits after the recap has
that session's topics, drills and learner-model update computed, paid for, and
published into a room they have already left. That is the `participantDisconnected`
path, which is the path that calls `finish()` in the first place: the work runs
precisely because they are gone, and lands nowhere because they are gone.

Neither window is closable from the app. Both need the same two things: the agent
persisting a recap server-side, and a **protocol tag that redelivers it into a
later session** — which also needs cross-session identity and app-side dedup so
a redelivered recap is banked once. That is wire-and-agent work, not data-sync
work, and doing half of it would only narrow a window that Phase 5 removes.
F92 in `docs/KNOWN_ISSUES.md` keeps it on the books.

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
nothing and leaves `[parle] RECORDING_NOT_DISCARDED` in the log, because swallowed
is not the same as hidden.

**The reset sweeps whatever is left.** `clearActiveUserData` empties the two cache
directories `expo-audio` records into (`storage/attemptAudio.native.ts`) **before**
it touches a single key, and both doors go through it — the progress reset and
account deletion. It is the backstop for the three cases per-attempt deletion cannot
reach: the app killed between `stop()` and the delete, the builds that shipped before
that discard existed and whose recordings an upgrade does not remove, and whatever
path nobody thought of.

The **cache root is not swept**, on purpose. `progress/saveFile.native.ts` writes the
Anki export straight into `<cache>`, and a learner who exported a deck and has not
opened the share sheet yet would lose it. Only the two audio directories go, and both
are recreated by `expo-audio` on the next recording.

A sweep that cannot finish does not take the reset down with it. The keys still go,
the module caches still drop, and `[parle] ATTEMPT_AUDIO_NOT_SWEPT` is what says so.
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
anyone is signed in and `userKey()` throws there: `parle.legacyMigrated.v1`, the
marker that stops a second account inheriting the first one's pre-auth data, and
`parle.seenSplash.v1`, which recorded that this install had seen the pre-auth
splash.

A device-level key is the one kind that survives everything a learner can do to
their own data: it outlives `clearActiveUserData`, it outlives signing out, and it
outlives deleting the account. So when the screen that reads one is deleted, the
key does not go with it — it sits on every phone that ever ran the old build,
readable by nobody.

The splash is gone, so `parle.seenSplash.v1` now encodes "has seen a screen that
no longer exists". Nothing of value is lost by removing it, and that is the whole
migration. `RETIRED_DEVICE_KEYS` in `scope.ts` names it and `migrateLegacyStores`
sweeps it on sign-in, in the same batched read the legacy inheritance already
does — **before** the `parle.legacyMigrated.v1` short-circuit, deliberately. Every
device still carrying the flag inherited its pre-auth data long ago and therefore
already has the marker set, so a sweep behind the marker would run only on the
devices that do not need one. It is idempotent because a key that is gone never
reads as present: after the launch that removes it, the sweep costs one entry in a
batch already being read and no write at all.

The audit that has to happen before a key joins that list is in
`docs/DELETION_LEDGER.md`, and `scope.test.ts` holds both halves — that the flag is
actually removed, and that nothing in the app still reads a key the sweep deletes.

### The sync contract

Since Phase 2, the account rather than the device is the durable home for ten of
the twelve stores. `apps/mobile/src/sync/` holds a **state-based reconciler**:
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

`sync/policy.ts` is the one to read. Ten namespaces under three merge classes:

- **structured** — `profile`, delegated to `@parle/brain`'s `mergeStoredProfiles`.
- **per-item** — `review` (delegated to core's `mergeDecks`), `drills`, `topics`.
- **set-union** — `history`, `activity`, `missions`, `soundChecks`, `coachMarks`,
  `tutorIntro`.

Two are excluded, each with a written reason in `SYNC_EXCLUSIONS`. `journal` is a
device-local crash buffer whose whole meaning is bank-then-delete, so syncing it
would re-bank a session another device already banked. `friends` is a dormant
surface running on labelled sample profiles, and syncing it would write fixtures
into the account where they would outlive the decision to ship the feature.

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
accepted loss in the design and field-wise merging is Phase 4.

`npm run verify:sync` runs the whole engine twice as two devices on two real
accounts against a live project. It proves isolation, forged filters, offline
replay across a restart, duplicate convergence, two-device conflict convergence
and quarantine of a corrupt payload — and it says `BLOCKED` rather than passing
when the credentials are absent.

`apps/mobile/src/profile/store.ts` holds `StoredProfile`:

```ts
{ version: 4, name, dob, ageConfirmed, motivation, dailyGoalMin, onboardedAt, username, brain: LearnerProfile }
```

`brain` is `@parle/brain`'s learner model, stored verbatim — the app is its
storage, not its author.

`apps/mobile/src/profile/upgrade.ts` is the app-side forward migration.
`upgradeStored` takes whatever was on disk and returns a version-4 profile or
`null` if it cannot be read at all. Version 1 and version 2 records both gain
`username: null`; a version-3 record keeps the username it already has.

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

`supabase/migrations/202608220001_parle_learning.sql` creates the durable
entitlements, privacy-filtered product events and a row-level-secured
`learner_state` envelope for cross-device sync. `learner_state.namespace` carries
a check constraint naming the twelve stores, so a namespace that is not on that
list cannot be written at all — which is also why `syncState`, the engine's own
dirty set, never leaves the device.
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
