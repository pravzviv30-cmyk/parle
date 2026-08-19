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
- status: [ ]
- where: packages/core/src/lessons/types.ts:99
- note: normalised equality only. Beginner STT fillers, a dropped word or a near miss all
  grade `poor`, drop a rung and print "Not quite." The typed drills already forgive one
  edit; the lesson that is the whole first session forgives nothing.
- verified-by: `a hesitation before the line is still the line`
- verified-by: `a different French sentence is still wrong`

### A2 — An empty transcript is graded as a wrong answer
- severity: P1
- status: [ ]
- where: packages/core/src/session/session.ts:233
- note: silence that reaches the engine as an empty `spoke` should rescue, not demote.
- verified-by: `an empty transcript is treated as silence, not a wrong answer`

### A3 — A freeze at the top rung still asks the learner to invent French
- severity: P1
- status: [ ]
- where: packages/core/src/ladder/ladder.ts:107
- note: a rescue drops one rung; from FREE that lands on PROMPTED, an English-only hint,
  while RESCUE_PREFIX simultaneously tells the model to give the line. Split brain.
- verified-by: `a rescue hands over the full line from every rung`

### A4 — A rescue can skip the beat the learner froze on
- severity: P1
- status: [ ]
- where: packages/brain/src/engine/conversation.ts:397
- note: English is protected from `beatDone`; silence and help are not.
- verified-by: `a rescue never completes the beat the learner froze on`

### A5 — Two different opening-rung formulas
- severity: P2
- status: [ ]
- where: packages/brain/src/engine/conversation.ts:146
- note: an A1 who reached FREE reopens at ECHO instead of PROMPTED.
- verified-by: `both engines open the next session on the same rung`

### A6 — A focus point vanishes when the worst sound has no drill
- severity: P2
- status: [ ]
- where: packages/core/src/phonemes/scoring.ts:173
- note: reachable today via /oe/, difficulty 4 with no drill.
- verified-by: `focus falls through to the next phoneme that has a drill`

### A7 — A v2 snapshot with no memory crashes the worker
- severity: P2
- status: [ ]
- where: services/tutor-agent/src/convo.ts:135
- note: two doors — the agent's guard omits `memory`, and the app casts unchecked at
  apps/mobile/src/profile/store.ts:62.
- verified-by: `a v2 snapshot with no memory is repaired, not discarded`

### B0 — ParleTutor cannot be tested at all
- severity: P1
- status: [ ]
- where: services/tutor-agent/src/agent.ts:88
- note: not exported, and importing the module runs preflight + cli.runApp at module
  scope. Every live-agent fix below is unverifiable until this is split.
- verified-by: `the tutor can be built without booting the worker`

### B1 — Live pronunciation scoring never receives audio
- severity: P0
- status: [ ]
- where: services/tutor-agent/src/agent.ts:192
- note: `scoreUtterance({ reference })` with no audio returns [] every time, and
  `durationSec: 0` is hard-coded, so speaking share and longest turn are always zero. The
  end card then looks like a clean session rather than an unscored one.
- verified-by: `an utterance carries the duration the recogniser measured`
- verified-by: `a session with nothing scored reports pronunciation unavailable`

### B2 — Speechace phone symbols are assumed to be IPA
- severity: P2
- status: [ ]
- where: services/shared/speechace.ts:74
- note: a non-IPA alphabet drops every observation silently at scoring.ts:179.
- verified-by: `vendor phone symbols map onto the inventory`

### B3 — An empty transcript lets the pipeline speak unladdered
- severity: P1
- status: [ ]
- where: services/tutor-agent/src/agent.ts:185
- note: the early return never throws StopResponse, unlike the conversation agent.
- verified-by: `an empty transcript stops the pipeline reply`

### B4 — A rescue and a spoken turn can both apply
- severity: P1
- status: [ ]
- where: services/tutor-agent/src/agent.ts:169
- note: nothing serialises state, and clearing the timer cannot cancel a rescue already
  in flight.
- verified-by: `a rescue that loses the race is discarded`

### B5 — A live lesson has no quiet path
- severity: P1
- status: [ ]
- where: apps/mobile/src/LiveSessionScreen.tsx:74
- note: option cards are display-only and there is no typed route, so a learner who
  cannot speak aloud finishes having said nothing.
- verified-by: `a tapped option advances the turn without claiming it was heard`
- verified-by: `a lesson can be completed entirely by typing`

### B6 — Anyone can debit anyone's minutes
- severity: P2
- status: [ ]
- where: services/token-server/src/server.ts:181
- note: /session/end is unauthenticated and body-trusted, and the store is in-memory, so
  a restart zeroes every learner's balance.
- verified-by: `a debit without the agent secret is refused`
