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
list and requests, sample-roster preview until a backend exists), and `journal`.

`journal` is the only store that is meant to be empty. A conversation's recap is
written there the moment it arrives and deleted the moment its phrases are
banked, so anything found at launch belongs to a session that was closed in
between and is banked then. It exists because the order things arrive in leaves a
gap: the recap ships first, practice follows, and the leave-early fallback that
covers the difference only runs when the learner taps Done. Reading the recap and
swiping the app away used to lose the session's phrases outright.

What it does not cover, and cannot from here: a session killed BEFORE the recap.
The wire's `ConvoView` carries no phrase list, so until the recap the app holds a
transcript and nothing else, and turning a transcript into review cards is
curation, which the agent owns. That window needs the agent to redeliver a recap
to a later session. Same for the learner-model update and the generated drills,
which are computed agent-side and only ever delivered over the live room.

`apps/mobile/src/profile/store.ts` holds `StoredProfile`:

```ts
{ version: 2, name, dob, motivation, dailyGoalMin, onboardedAt, brain: LearnerProfile }
```

`brain` is `@parle/brain`'s learner model, stored verbatim — the app is its
storage, not its author.

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

`services/token-server/src/store.ts` — `EntitlementStore` is three async methods
so the database, when it arrives, is a one-file change.

- `InMemoryEntitlementStore` — the default. **A restart returns everyone's
  minutes**, which makes a balance a property of the server's uptime.
- `FileEntitlementStore` — used when `ENTITLEMENT_STORE_PATH` is set. JSON,
  written to a sibling and renamed over the target, because rename is atomic and
  a half-written balance file is worse than a stale one.

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
