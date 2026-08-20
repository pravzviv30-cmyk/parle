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
- status: [x]
- where: services/tutor-agent/src/convo.ts:291
- note: found by the loop while closing C1, and left alone as out of scope —
  correctly, but it is the more serious of the two. When the model refuses,
  fails to parse or times out, `runBrainTurn` says RECOVERY_LINE and returns.
  In voiceless mode `say()` returns early, so nothing is spoken and no view is
  published: the learner sits looking at their own typed answer with no reply,
  no explanation and no way to tell a broken tutor from a slow one. "Never
  strand a learner mid-scene" is one of this product's stated invariants, and
  the quiet path is exactly where a stranded learner has least to go on.
  Both exits now go through `recover()`, which in text mode publishes the same
  RECOVERY_LINE as a `{t:'error'}` notice — the one channel the app surfaces
  inside a live session instead of as a dead-end screen — and re-arms the
  silence clock. The re-arm is half the fix and the easier half to miss: a
  spoken session re-arms when the recovery line finishes playing (agent.ts, on
  `listening`), nothing plays in text mode, so without it the rescue never
  fires again and the learner loses the one thing that still works with the
  model down — the full line, rendered locally from material already in hand.
- verified-by: `a failed brain turn in text mode still says something to the learner`
- verified-by: `a text learner whose turn failed is still on the silence clock`

### D2 — /œ/ changes the word but is not marked as meaning-bearing
- severity: P2
- status: [x]
- where: packages/core/src/phonemes/inventory.ts:139
- note: also found by the loop, while writing the /œ/ drill. The drill's whole
  argument is that an unrounded /œ/ lands on /ɛ/ and says a different word —
  peur/père, heure/air — which is the definition of meaningBearing, and every
  other phoneme carrying that weight has the flag. Setting it raises /œ/'s
  priority by 1.4× and will shift fixtures that were tuned around the old
  weight, so it wants doing deliberately rather than in passing. Doing it
  deliberately turned up two more: /ʒ/ (j'ai/chez) and /e/ (fée/fait, and it is
  what marks the verb tense) carry drills making exactly the same argument and
  were unflagged too. The flag is not a judgement call — a minimal-pair drill
  whose pairs are two real words with two different meanings *is* the claim that
  the sound changes the word — so the test holds the drill bank and the
  inventory to each other rather than listing the three by name. No fixture
  moved: the weights that shifted did not change any ranking that is asserted.
- verified-by: `every phoneme whose drill teaches a word-changing contrast is marked meaning-bearing`

### D3 — The orb thinks forever when the answer never comes
- severity: P2
- status: [x]
- where: apps/mobile/src/live/useLiveSession.ts:496
- note: found by the loop while closing D1, and it is the app-side half of the
  same moment. `sendSay` sets `thinking` true and only `prompt`, `convo`,
  `topics` or `speaking: true` ever clears it. A trouble notice does not, so
  after a failed brain turn in text mode the learner now reads "Say that once
  more for me." while the orb beside it still says the tutor is thinking — and
  the notice clears itself after eight seconds while the orb does not. Typing
  is never blocked, which is why this is a P2 and not the stranding D1 was.
  The fix is one line in the `error` case; what makes it worth an entry rather
  than a drive-by is that apps/mobile has no test suite at all — no *.test.ts
  anywhere under it and no floor in scripts/gate.floors.json — so this cannot
  be closed honestly until there is somewhere for its test to live. There is
  now: apps/mobile has a test script, a floor, and its first suite. The fix came
  out larger than one line and better for it — the rule was spread across five
  branches of the switch, which is why a sixth was missed, so it is one function
  over the whole message union in live/thinking.ts with the compiler holding
  every case. That the app had no tests at all is the more useful half of this
  entry; the orb was just the first thing to fall through the gap.
- verified-by: `a trouble notice stops the tutor looking like it is still thinking`

### F1 — One command boots the whole product, waits for health, and reaps its children
- severity: P1
- status: [x]
- where: scripts/dev.mjs:1
- note: four hand-started terminals is the whole reason "there is no server available"
  ever happened. README documents the four, `.claude/launch.json` starts only Expo, and
  the root package.json has no orchestration script at all, so the founder's own product
  has never simply worked. The boot plan, port policy, readiness rules and gap messages
  are pure functions in services/shared/devPlan.ts, tested from the tutor-agent workspace
  exactly as services/shared/speechace.ts already is. The spawning, log labelling and
  process-group reaping in dev.mjs are eye-verified, and said so plainly rather than
  wrapped in a test that would only be testing the OS.
- verified-by: `the boot plan orders livekit, then the token server, then the agent, then the app`
- verified-by: `a port already answering as livekit is reused rather than fought over`
- verified-by: `a port held by something else stops the boot and names the port`

### F2 — The brain runs on the founder's Claude subscription, and the swap to an API key is one env var
- severity: P1
- status: [ ]
- where: packages/brain/src/llm/claudeCli.ts:1
- note: measured twice at 8.96s and 8.32s per `claude -p` call, of which only about two
  seconds is model time and the rest is CLI startup rebuilding a 19k-token system prompt.
  The realtime turn budget is under 800ms, which is why routing.ts pins turn to the fast
  tier at low effort. So the brain splits by who is waiting: Groq answers turn and frame,
  Claude answers extract, drills and curate, which routing.ts already calls load-bearing
  pedagogy and which run once with nobody waiting. The CLI has no server-side structured
  outputs, so this adapter follows the Groq one and validates against the same zod
  schemas. The LiveKit plugin LLM stays on Groq regardless: it is a streaming interface
  that cannot shell out. TUTOR_LLM=anthropic must still select the API client with no
  other change, or the swap at publish is a rewrite rather than a line.
- verified-by: `the realtime turn never goes to the command line brain`
- verified-by: `the post-session calls go to Claude while the turn goes to Groq`
- verified-by: `a post-session brain failure costs quality, not the session`
- verified-by: `switching to the anthropic key needs no code change`

### F3 — The English opener is heard in English, and the scene is heard in French
- severity: P1
- status: [ ]
- where: services/tutor-agent/src/agent.ts:175
- note: the opener is spoken in English on purpose, because a brand-new learner must
  never be opened at in a language they do not have yet. But Deepgram is pinned to
  French, so the learner's very first answer, the one that starts the whole session,
  transcribes as garbage and the scenario prompt has to guess intent from it. A pure
  rule gives multilingual to the choosing phase and French to the scene and to the
  scripted lesson from its first word, and opening the scene flips the recogniser
  through the plugin's own updateOptions. Unconditional, because the English opener is
  unconditional and a flag would leave the default broken.
- verified-by: `the choosing moment listens in multilingual mode and the scene listens in French`
- verified-by: `opening the scene returns the recogniser to French`
- verified-by: `the scripted lesson listens in French from its first word`

### F4 — The end card's Start button starts the focus drill
- severity: P1
- status: [ ]
- where: apps/mobile/src/SummaryScreen.tsx:113
- note: the one solid pill on the screen that closes every session is
  `onPress={() => {}}`, and it fronts the product's headline promise of one focus sound
  with one drill attached. A focus drill player renders in place, the way ConvoScreen
  already renders its recap in place, so nothing enters navigation state. It speaks each
  word through the existing tutor voice and advances on a plain Next: it never records,
  never scores, and never implies it heard anything, because a pronunciation score is
  never invented and no path may require speaking aloud. The step sequencing is a pure
  core function and is tested; the player surface is eye-verified.
- verified-by: `the focus drill plays every pair and every item exactly once`
- verified-by: `a focus drill with no material offers nothing to start`

### F5 — Go again goes again, and Review reviews
- severity: P1
- status: [ ]
- where: apps/mobile/src/nav/RootNavigator.tsx:102
- note: onAgain and onReview both call nav.goBack(), which matches neither label. Two
  differently labelled buttons with identical behaviour is worse than one button, and
  the Review route it should be opening already exists in the same stack. Review
  navigates there; Go again clears the summary and remounts the session so it is a new
  sitting rather than a retreat. Behaviour is eye-verified in a real browser; the named
  test is a source walk that trips if either button retreats to goBack again.
- verified-by: `the end card's buttons do what their labels say`

### F6 — A topic node the tutor has not finished writing is locked, with honest words
- severity: P1
- status: [ ]
- where: packages/core/src/path/path.ts:172
- note: the reported version of this, that a fresh account strands on six of seven
  Practice stops, does not reproduce: buildDrillSession was run against every authored
  node with an empty deck and all seven open onto real sittings, because the
  introduction path plus the drill fixtures already cover a new learner, and path.test.ts
  already pins that. The reachable dead end is a topic node whose phrases reached the
  review deck but whose generated drills never arrived, because the app died in the
  window between. It renders as tappable and opens onto "Nothing due right now", which
  breaks never stranded. The path projection already holds the bank, so a topic node
  with nothing drillable projects as locked, the one lock DESIGN.md sanctions, and says
  the tutor is still writing it. A node with even one drillable phrase stays open.
- verified-by: `a topic node the bank cannot drill yet is locked`
- verified-by: `no tappable node ever opens onto an empty sitting`
- verified-by: `a still-being-written topic says the tutor is writing it`

### F7 — A conversation's phrases survive the app dying before the recap
- severity: P1
- status: [ ]
- where: apps/mobile/src/live/journalRules.ts:1
- note: everything a session leaves behind arrives in the recap at the very end, so
  closing the app one beat early loses the lot. Scene lines are journalled as they
  arrive, on the same serialized single-promise write chain and userKey scoping as
  topics/store.ts, the recap retires the journal so nothing is banked twice, and a
  journal orphaned by a crash banks its phrases into the review deck on the next launch.
  The honest limit, stated here rather than papered over: the learner's memory update
  and that session's generated drills are computed agent-side and delivered only over
  the live room, so a crash still loses those, and recovered phrases live in Review
  until some later session drills them.
- verified-by: `a scene line is written to the journal the moment it arrives`
- verified-by: `the recap retires the journal so nothing is banked twice`
- verified-by: `a journal orphaned by a crash banks its phrases on the next launch`

### F8 — The token server address has one home in the app
- severity: P2
- status: [ ]
- where: apps/mobile/src/live/serverUrl.ts:1
- note: the same default is spelled out in live/useLiveSession.ts:38, app/LiveContext.tsx:12
  and DrillScreen.tsx:70. Three copies already disagree about nothing; a fourth would
  eventually disagree about something. One exported constant, three imports, and a walk
  that proves the literal appears exactly once, in the manner of copy.test.ts.
- verified-by: `the token server address has exactly one home in the app`
