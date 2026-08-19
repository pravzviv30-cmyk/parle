# Known issues — the goal file

This ledger is not prose. `scripts/gate.mjs` parses it, and the gate **fails** while any
P0 or P1 box is unchecked. A box may only be ticked when the test named in its
`verified-by:` line exists and passes — so ticking one without a real test fails the gate
too, and so does deleting the entry.

That is the whole discipline: a goal you can check beats a goal you can argue about.

## Format

    ### <id> — <one-line title>
    - severity: P0 | P1 | P2
    - status: [ ] or [x]
    - where: path/to/file.ts:line
    - verified-by: `exact test title`      (one line per test; all must pass)

---

### A1 — A spoken answer has to match the script exactly
- severity: P0
- status: [x]
- where: packages/core/src/lessons/types.ts:99
- note: normalised equality only. Beginner STT fillers, a dropped word or a near miss all
  grade `poor`, drop a rung and print "Not quite." The typed drills already forgive one
  edit; the lesson that is the whole first session forgives nothing.
- verified-by: `a hesitation before the line is still the line`
- verified-by: `a different French sentence is still wrong`

### A2 — An empty transcript is graded as a wrong answer
- severity: P1
- status: [x]
- where: packages/core/src/session/session.ts:233
- note: silence that reaches the engine as an empty `spoke` should rescue, not demote.
- verified-by: `an empty transcript is treated as silence, not a wrong answer`

### A3 — A freeze at the top rung still asks the learner to invent French
- severity: P1
- status: [x]
- where: packages/core/src/ladder/ladder.ts:107
- note: a rescue drops one rung; from FREE that lands on PROMPTED, an English-only hint,
  while RESCUE_PREFIX simultaneously tells the model to give the line. Split brain.
- verified-by: `a rescue hands over the full line from every rung`

### A4 — A rescue can skip the beat the learner froze on
- severity: P1
- status: [x]
- where: packages/brain/src/engine/conversation.ts:397
- note: English is protected from `beatDone`; silence and help are not.
- verified-by: `a rescue never completes the beat the learner froze on`

### A5 — Two different opening-rung formulas
- severity: P2
- status: [x]
- where: packages/brain/src/engine/conversation.ts:146
- note: an A1 who reached FREE reopens at ECHO instead of PROMPTED.
- verified-by: `both engines open the next session on the same rung`

### A6 — A focus point vanishes when the worst sound has no drill
- severity: P2
- status: [x]
- where: packages/core/src/phonemes/scoring.ts:173
- note: reachable today via /oe/, difficulty 4 with no drill.
- verified-by: `focus falls through to the next phoneme that has a drill`

### A7 — A v2 snapshot with no memory crashes the worker
- severity: P2
- status: [x]
- where: services/tutor-agent/src/convo.ts:135
- note: two doors — the agent's guard omits `memory`, and the app casts unchecked at
  apps/mobile/src/profile/store.ts:62.
- verified-by: `a v2 snapshot with no memory is repaired, not discarded`

### B0 — ParleTutor cannot be tested at all
- severity: P1
- status: [x]
- where: services/tutor-agent/src/agent.ts:88
- note: not exported, and importing the module runs preflight + cli.runApp at module
  scope. Every live-agent fix below is unverifiable until this is split.
- verified-by: `the tutor can be built without booting the worker`

### B1 — Live pronunciation scoring never receives audio
- severity: P0
- status: [x]
- where: services/tutor-agent/src/agent.ts:192
- note: `scoreUtterance({ reference })` with no audio returns [] every time, and
  `durationSec: 0` is hard-coded, so speaking share and longest turn are always zero. The
  end card then looks like a clean session rather than an unscored one.
- verified-by: `an utterance carries the duration the recogniser measured`
- verified-by: `a session with nothing scored reports pronunciation unavailable`

### B2 — Speechace phone symbols are assumed to be IPA
- severity: P2
- status: [x]
- where: services/shared/speechace.ts:74
- note: a non-IPA alphabet drops every observation silently at scoring.ts:179.
- verified-by: `vendor phone symbols map onto the inventory`

### B3 — An empty transcript lets the pipeline speak unladdered
- severity: P1
- status: [x]
- where: services/tutor-agent/src/agent.ts:185
- note: the early return never throws StopResponse, unlike the conversation agent.
- verified-by: `an empty transcript stops the pipeline reply`

### B4 — A rescue and a spoken turn can both apply
- severity: P1
- status: [x]
- where: services/tutor-agent/src/agent.ts:169
- note: nothing serialises state, and clearing the timer cannot cancel a rescue already
  in flight.
- verified-by: `a rescue that loses the race is discarded`

### B5 — A live lesson has no quiet path
- severity: P1
- status: [x]
- where: apps/mobile/src/LiveSessionScreen.tsx:74
- note: option cards are display-only and there is no typed route, so a learner who
  cannot speak aloud finishes having said nothing.
- verified-by: `a tapped option advances the turn without claiming it was heard`
- verified-by: `a lesson can be completed entirely by typing`

### B6 — Anyone can debit anyone's minutes
- severity: P2
- status: [x]
- where: services/token-server/src/server.ts:181
- note: /session/end is unauthenticated and body-trusted, and the store is in-memory, so
  a restart zeroes every learner's balance.
- verified-by: `a debit without the agent secret is refused`

### C1 — The conversation agent's rescue and brain turn have no tests at all
- severity: P1
- status: [x]
- where: services/tutor-agent/src/convo.ts:433
- note: convo.test.ts covered the pure mapping helpers and never instantiated
  ParleConversation, so `rescue()`, `runBrainTurn()`, `armRescue` in voiceless
  mode, the StopResponse throw and the serial queue guard were all uncovered. The
  queue guard in particular was added to this file by analogy with the scripted
  tutor and had never been executed by a test — the exact shape of change that
  looks done and is not. It was not: only the spoken path went through the queue.
  A typed answer and an aide-moi tap called the engine directly, so a rescue that
  had already fired still read as current and applied on top of them — two
  rescues on the card, or two turns of the scene, for one moment of being stuck.
  Both call sites are queued now, and the class takes an injectable `client` so
  it can be built at all without a vendor key.
- verified-by: `a conversation rescue that loses the race is discarded`
- verified-by: `a typed conversation turn is integrated once, not twice`

### C2 — A learner who mangles /œ/ is told nothing, because there is no drill
- severity: P1
- status: [x]
- where: packages/core/src/phonemes/drills.ts
- note: /œ/ is difficulty 4 (`peur`, `sœur`, `fleur`, `heure`), it clears the
  priority bar comfortably, and it was the one sound at that difficulty with
  nothing to practise it. buildReport walks past it to the next drillable
  problem, which stops the whole report vanishing — but the sound itself still
  went unaddressed, and the fallthrough is a floor, not a fix. The English
  substitution to teach against is the vowel in "her". `oeu-vs-e` teaches it:
  there is no French /ɜː/ to contrast against, but "her" says the vowel with
  flat lips, and an unrounded /œ/ lands on /ɛ/ — peur/père, heure/air,
  meurt/mère — so the minimal pairs are exactly what the substitution costs.
  The buildReport fallthrough is now a backstop for the easier sounds; its two
  tests moved onto /ɲ/, the hardest phoneme still without a drill.
- verified-by: `every phoneme hard enough to become a focus has a drill`

### C3 — Nothing proves audio ever reaches the scorer
- severity: P1
- status: [x]
- where: services/shared/speechace.ts:36
- note: the capture is tested and the parser is tested, but scoreUtterance itself
  had no test that gave it audio and checked what leaves the building — the
  reference text, the audio part, the dialect. The tests only covered the two ways
  it returns nothing. The whole pronunciation claim rests on this request being
  well formed, so it should not be the one link taken on trust. preflight.ts
  already established the pattern, and `scoreUtterance` now takes the same
  injectable fetch. The request is asserted end to end: the reference text as
  `text`, the learner's exact bytes as `user_audio_file`, the dialect in both the
  form and the query, and the vendor's answer arriving back as observations. The
  dialect default was computed twice from `req.dialect ?? 'fr-fr'` — form and URL
  could not disagree in practice, but a score attributed to the wrong French is
  the kind of thing that should be impossible rather than merely unlikely, so it
  is read once. Two behaviours nothing had held down are held down now: a vendor
  that refuses leaves the session unscored instead of ending it, and an
  unconfigured scorer sends the learner's voice nowhere at all.
- verified-by: `an utterance with audio is sent to the vendor with its reference text`
- verified-by: `the utterance is scored against the dialect the learner is learning`
- verified-by: `no request is made at all when there is nothing to score`

### D1 — A failed brain turn in text mode strands the learner in silence
- severity: P1
- status: [ ]
- where: services/tutor-agent/src/convo.ts:291
- note: found by the loop while closing C1, and left alone as out of scope —
  correctly, but it is the more serious of the two. When the model refuses,
  fails to parse or times out, `runBrainTurn` says RECOVERY_LINE and returns.
  In voiceless mode `say()` returns early, so nothing is spoken and no view is
  published: the learner sits looking at their own typed answer with no reply,
  no explanation and no way to tell a broken tutor from a slow one. "Never
  strand a learner mid-scene" is one of this product's stated invariants, and
  the quiet path is exactly where a stranded learner has least to go on.
- verified-by: `a failed brain turn in text mode still says something to the learner`

### D2 — /œ/ changes the word but is not marked as meaning-bearing
- severity: P2
- status: [ ]
- where: packages/core/src/phonemes/inventory.ts:139
- note: also found by the loop, while writing the /œ/ drill. The drill's whole
  argument is that an unrounded /œ/ lands on /ɛ/ and says a different word —
  peur/père, heure/air — which is the definition of meaningBearing, and every
  other phoneme carrying that weight has the flag. Setting it raises /œ/'s
  priority by 1.4× and will shift fixtures that were tuned around the old
  weight, so it wants doing deliberately rather than in passing.
- verified-by: `every phoneme whose drill teaches a word-changing contrast is marked meaning-bearing`
