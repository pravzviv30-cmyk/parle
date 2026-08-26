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
attempt evidence and a single learner-safe focus, never raw audio or a numeric score),
`coachMarks` (which of the in-conversation controls have been pointed out, one
key for all of them), and `journal`.

`journal` is the only store that is meant to be empty. A conversation's recap is
written there the moment it arrives and deleted the moment its phrases are
banked, so anything found at launch belongs to a session that was closed in
between and is banked then. It exists because the order things arrive in leaves a
gap: the recap ships first, practice follows, and the leave-early fallback that
covers the difference only runs when the learner taps Done. Reading the recap and
swiping the app away used to lose the session's phrases outright.

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
