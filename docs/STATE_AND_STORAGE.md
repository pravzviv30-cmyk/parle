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
written there the moment it arrives and deleted the moment its phrases are
banked, so anything found at launch belongs to a session that was closed in
between and is banked then. It exists because the order things arrive in leaves a
gap: the recap ships first, practice follows, and the leave-early fallback that
covers the difference only runs when the learner taps Done. Reading the recap and
swiping the app away used to lose the session's phrases outright.

### The post-recap durability gap

**Owner: data-sync with practice UX. Closes in Phase 4. Open today.**

The journal closes the crash window only while its writes and the destination
stores succeed. Today those stores cannot say that. `ConvoScreen` sets its
in-memory `practiceBankedRef` before persistence, fires the topic write without
awaiting it, and clears the journal when `addPhrases` resolves. But the review,
topic and drill stores deliberately swallow AsyncStorage failures, and their
promises therefore resolve even when storage is full. The journal writer also
swallows its own failure. In that case the cache can look correct for this launch
while the only recoverable disk copy is cleared.

Phase 4 replaces that best-effort handshake with one durable batch/outbox contract:
a stable batch or session id, journal first, idempotent writes into phrases,
topics and drills, explicit per-store acknowledgements, and clear only after all
required acknowledgements have landed. A crash between acknowledgement and clear
must replay safely; storage-full must keep the batch pending and visible to the
next retry. F118 records the regression test that closes it.

### The pre-recap window

**Owner: tutor-agent. Closes in Phase 5. Open today, and it is a real loss.**

The journal covers everything after the recap arrives. It cannot cover a session
killed BEFORE it. The wire's `ConvoView` carries no phrase list, so until the
recap the app holds a transcript and nothing else, and turning a transcript into
review cards is curation, which the agent owns. A learner who talks for ten
minutes and force-quits during the goodbye keeps the minutes they spent and none
of the phrases they earned.

The agent side of the same window is `finish()` in
`services/tutor-agent/src/convo.ts` — `void this.extractMemory(...)` and
`void this.curateAndDrill(...)`, the last two statements in the method. They run
after the recap ships and the seconds are debited, they are deliberately not
awaited, and if the room closes first their results are dropped with no error
anywhere: the learner-model update, the practice topics and the generated drills
for that session simply never existed. (The ledger cites `convo.ts:1539-1540`;
Phase 1 moved the lines, and the two `void` calls are what it means.)

Neither half is closable from the app. Both need the same two things: the agent
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
