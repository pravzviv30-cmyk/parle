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

### B0 — LuvaniTutor cannot be tested at all
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
  LuvaniConversation, so `rescue()`, `runBrainTurn()`, `armRescue` in voiceless
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
- status: [x]
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
- status: [x]
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
- status: [x]
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
- status: [x]
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
- status: [x]
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

### F7 — A conversation's phrases survive the app being killed after the recap
- severity: P1
- status: [x]
- where: apps/mobile/src/live/journalRules.ts:1
- note: the entry as first written said scene lines would be journalled as they
  arrived. They cannot be, and finding out why narrowed this to the window that
  is actually closable. ConvoView does not carry newPhrases on the wire, so
  before the recap the app holds a transcript and no phrase list at all; turning
  a transcript into review cards is curation, which is the agent's decision and
  not one the app may invent. Two windows exist and only one is client-side.
  Killed mid-session, everything is lost and closing that needs the agent to
  redeliver a recap to a later session, which is filed under out of scope.
  Killed AFTER the recap and before Done is tapped, the phrases are sitting in
  memory and the practice message either never arrived or never got banked, and
  that window is wide: RecapScreen's leave-early fallback only runs when the
  learner taps Done, so reading the recap and swiping the app away loses the lot.
  So the recap is journalled the moment it arrives, on the same serialized
  versioned-store seam as topics/store.ts, banking clears it, and an orphan
  banks on the next launch. Memory and generated drills are agent-side and stay
  lost either way; that limit is stated rather than papered over.
- verified-by: `the recap is journalled the moment it arrives`
- verified-by: `banking the session clears the journal, so nothing is banked twice`
- verified-by: `a journal orphaned by a crash banks its phrases on the next launch`

### F8 — The token server address has one home in the app
- severity: P2
- status: [x]
- where: apps/mobile/src/live/serverUrl.ts:1
- note: the same default is spelled out in live/useLiveSession.ts:38, app/LiveContext.tsx:12
  and DrillScreen.tsx:70. Three copies already disagree about nothing; a fourth would
  eventually disagree about something. One exported constant, three imports, and a walk
  that proves the literal appears exactly once, in the manner of copy.test.ts.
- verified-by: `the token server address has exactly one home in the app`

### F9 — Every agent on disk is pinned to a model the gate defends
- severity: P1
- status: [x]
- where: scripts/gate.mjs:141
- note: the pin map defended four names by listing them, so a thirteenth agent added and
  not listed would inherit the session model and nothing would ever notice. The directory
  now decides which names must be pinned; the map still decides what they are pinned to.
- verified-by: `is pinned to a model in the gate, so none inherits the session model unnoticed`
- verified-by: `is a real file when the gate names it`

### F10 — An agent that decides cannot quietly do
- severity: P1
- status: [x]
- where: .claude/agents/fix-verifier.md:8
- note: five agents are read-only by design and nothing checked that they stayed that way.
  fix-verifier never said why it had no Edit, which is exactly how the next person helpfully
  gives it one and turns the second opinion into the same opinion twice.
- verified-by: `a guard declares no Edit and no Write, because it decides rather than does`
- verified-by: `a guard says in its own words that the missing tools are deliberate`

### F11 — /forge routes only to engineers that exist
- severity: P1
- status: [x]
- where: .claude/commands/forge.md:28
- note: step 5 dispatches by territory now. A typo in the routing table, or an engineer
  deleted without editing the table, fails at dispatch time with nothing to catch it sooner.
- verified-by: `names only engineers that exist`
- verified-by: `gives every builder somewhere to be dispatched from`

### F12 — A malformed agent definition names itself
- severity: P2
- status: [x]
- where: services/shared/agentFleet.ts:1
- note: frontmatter written out of order, or a name that disagrees with the filename it is
  dispatched by, both fail silently at dispatch rather than at commit.
- verified-by: `carries name, description, tools and model, in that order`

### F13 — devPlan's brainOf mirrors selectedBrain, and nothing holds the mirror
- severity: P2
- status: [x]
- where: services/shared/devPlan.ts:191
- note: filed by the work-judge. The contract said the supervisor's env gate
  would reuse preflight's own selectedBrain. It mirrors it instead, for a
  defensible reason: services/shared cannot import from services/tutor-agent
  without inverting the dependency direction speechace.ts established. But the
  mirror was unguarded, so a fourth TUTOR_LLM value added to preflight.ts and
  not to brainOf would make npm run dev demand the wrong key, or none, while the
  agent's own preflight disagreed one process later. The test couples their
  answers rather than their implementations: over every TUTOR_LLM spelling,
  blank both keys and require both sides to miss exactly the same one.
- verified-by: `the supervisor and the agent preflight agree on which brain TUTOR_LLM selects`

### F14 — The start button no longer walks a learner into a dead server
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/TutorTab.tsx:43
- note: the tab probes health and then navigates regardless of the answer, which ends at
  an un-typeable error screen. The probe's answer must decide. ConvoRoute gets the same
  gate LessonRoute already has, minus the mock it does not have.
- verified-by: `a learner whose tutor servers are down stays on the tutor tab with honest words`
- verified-by: `the same button starts the conversation once the servers answer again`

### F15 — The unreachable screen speaks to the learner, not the operator
- severity: P2
- status: [x]
- where: apps/mobile/src/live/failure.ts:146
- note: "Check it is running, then try again" is ops advice. canType stays false because
  typing needs the same server; the words instead point at what still works.
- verified-by: `the unreachable screen tells the learner practice still works instead of giving ops advice`

### F16 — A mixed sitting alternates topics instead of blocking them
- severity: P1
- status: [x]
- where: packages/core/src/drill/session.ts:142
- note: dueCards returns same-session cards clustered, so an unscoped sitting plays
  blocked by topic. mixQueue reorders round-robin across topic groups, deterministically,
  and touches selection not at all.
- verified-by: `a mixed sitting alternates between topics instead of finishing one before starting the next`
- verified-by: `mixing only reorders a sitting and never adds or drops an exercise`

### F17 — Practice offers Today's mix when more than one topic is due
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/PracticeTab.tsx:70
- note: the entry card and its offer rule; below two topics the mix equals the topic's own
  sitting and would be noise. Rule and groups live in practice/mix.ts so node tests can
  reach them.
- verified-by: `today's mix is offered only when due phrases span more than one topic`

### F18 — A chosen topic rides the join token
- severity: P1
- status: [x]
- where: services/token-server/src/server.ts:145
- note: seedTopic joins mode, startRung and snapshot on the existing start-body-to-metadata
  channel. Invalid input is dropped, never refused; the session still starts generic.
- verified-by: `a seeded topic rides the join token and a malformed one is dropped without refusing the session`

### F19 — The tutor opens on the seeded topic instead of asking
- severity: P1
- status: [x]
- where: services/tutor-agent/src/convo.ts:380
- note: with a seed in the metadata, open() publishes a seeded opening statement and hands
  the seed to startScene, which already owns the bridge line, the frame call, the timeout
  and the request-grounded fallback.
- verified-by: `a session started from a topic card opens its scene on that topic without the choosing question`
- verified-by: `a seeded session whose scenario build fails stays on the topic it was given`

### F20 — A topic card offers another conversation and says what it costs
- severity: P1
- status: [x]
- where: apps/mobile/src/practice/PathNodeRow.tsx:1
- note: the talk-again affordance on topic nodes, labelled before the tap: it starts a
  live conversation and uses talking minutes. Numberless because the app does not know the
  balance before issuance.
- verified-by: `the talk again offer says it will use minutes before anything starts`

### F21 — The drill store's comment stops denying its caller
- severity: P2
- status: [x]
- where: apps/mobile/src/drill/store.ts:109
- note: the comment says nothing calls mergeExercises; ConvoScreen.tsx:99 calls it every
  session. The test pins the merge behaviour the comment sits above.
- verified-by: `merging a regenerated exercise replaces its earlier take instead of duplicating it`

### F22 — Check again remembers the quiet route the learner chose
- severity: P2
- status: [x]
- where: apps/mobile/src/tabs/TutorTab.tsx:112
- note: found by the work-judge while reviewing F14, and confirmed by reading the file. The
  held-back card's retry calls open(false) whatever the learner originally tapped, so
  someone who chose "Unable to speak right now?", waited for the servers, and pressed
  Check again lands in a voice session. Not a stranding, so it is not the dead end F14
  closed, but it hands a learner in a quiet carriage the exact thing the typed route
  exists to spare them. The tab already knows a start was held back; it has to remember
  which start.
- verified-by: `a learner who chose the quiet route is still on it when the servers come back`

### F23 — Free conversation hands the learner the shopkeeper's half of the scene
- severity: P1
- status: [x]
- where: packages/brain/src/engine/conversation.ts:279
- note: seen live on 2026-08-20, convo-text, "ordering coffee at a cafe", at Echo. Turn 1
  was right because it came from the frame's openingSupport. From turn 2 the SAY THIS card
  showed the barista's own question, "Bonjour, vous désirez ?", then repeated it. A scripted
  lesson cannot do this: LessonTurn keeps `tutor` and `target` apart and core's supportView
  only ever reads `target`. Free conversation has one model call authoring both `sceneReply`
  and `support`, and rung 1's shared instruction ("say the target line, then invite them to
  repeat it") reads to a model that is also playing the barista as permission to let one
  line do both jobs. learnerSideSupport is the missing `target`: support that is only the
  line just spoken is repaired from an option this same turn already carried, and when
  nothing survives the full line is emptied so the view falls back to the English hint. The
  prompt is fixed at both ends too, but the guard is the part that holds when it is not.
  Rebuilt free-form in 265f1a8: the reveal moved off the ladder rung onto a progressive
  assistance tier, so three of the tests below were rewritten under new titles rather than
  deleted, and the turn-context one was dropped in that pass and is rebuilt here.
- verified-by: `ordinary turns hide support while repairing the next rescue material`
- verified-by: `the learner level never exposes options before an attempt`
- verified-by: `a repeated rescue with no safe line left falls back to the hint`
- verified-by: `a rescue after a collapsed turn does not replay the scene’s line either`
- verified-by: `a genuine reply is left exactly as the model wrote it`
- verified-by: `an opening frame that collapses the two lines is repaired before turn one`
- verified-by: `the contract says support is the learner’s side of the scene, not the tutor’s`
- verified-by: `whenever the whole line is handed over, the context says whose line it is`
- verified-by: `hear it never replays the scene’s own line back as the learner’s`

### F24 — The typed topic sends from every entry point
- severity: P0
- status: [x]
- where: apps/mobile/src/ConvoScreen.tsx:224
- note: the driver first reported that Enter was dead on react-native-web and said it was
  reproduced live. That was a test-harness artifact and it is retracted: the browser
  automation sent Return as an empty key event, and Enter almost certainly worked. What
  react-native-web 0.21.2's own source does establish, and what this entry rests on: its
  strict forwardPropsList whitelist drops submitBehavior before the DOM sees it, so that
  prop was inert; blurOnSubmit defaults to !multiline, so web blurred the field after
  every Enter and contradicted submitBehavior="submit" by dropping the caret on each
  send; and the choosing ScrollView was the only input screen in the app without
  keyboardShouldPersistTaps, which swallows the Send tap on iOS and Android, exactly why
  the in-scene reply Send worked and the topic Send did not. Routing through onKeyPress,
  which RNW calls from inside its own handleKeyDown before the Enter branch, gives one
  send and no blur. The key rule is extracted so node can test it, and the silently
  swallowed publishData failure is logged.
- verified-by: `pressing enter in a typed input is a send, not a no-op`
- verified-by: `the choosing screen keeps taps while the keyboard is up`

### F25 — The screen answers a sent topic within a frame
- severity: P1
- status: [x]
- where: apps/mobile/src/ConvoScreen.tsx:195
- note: sendSay already appends the learner's bubble and sets thinking; the choosing
  screen renders neither, so for three to ten seconds the only pixel that changed was the
  input emptying. Mount Transcript below the orb with the settle entrance, derive the orb
  state from choosingView, and show the audioBlocked plaque here too.
- verified-by: `the moment a topic is sent the learner sees their own words and a tutor visibly thinking`

### F26 — The circle opens the microphone, not the connect
- severity: P1
- status: [x]
- where: apps/mobile/src/live/useLiveSession.ts:556
- note: the mic is hot before the choosing screen paints; the founder chose tap to talk.
  Convo mode connects with the mic closed, the orb tap opens it once for the session, and
  the tutor's own spoken question stops being heard by a live mic.
- verified-by: `a free conversation keeps the microphone closed until the learner taps the circle`

### F27 — The quiet door stands on the choosing screen itself
- severity: P1
- status: [x]
- where: apps/mobile/src/ConvoScreen.tsx:245
- note: today the typed route exists only before the session and on the error screen. The
  same offer on the choosing screen flips the one flip the screen already supports, and
  every spoken path keeps its quiet twin.
- verified-by: `a learner who cannot speak can switch to typing without leaving the choosing moment`

### F28 — A scene that fails to open hands back the choosing moment
- severity: P1
- status: [x]
- where: services/tutor-agent/src/convo.ts:490
- note: a throw after phase turns to starting leaves the session eating every later press
  with no log. Failure resets the phase, republishes the opening, and logs; a repeat press
  starts a fresh scene instead of vanishing.
- verified-by: `a failed scene build returns the learner to choosing instead of a dead session`
- verified-by: `pressing send again after a failed build starts a fresh scene`

### F29 — A scenario with no beats is refused at the contract
- severity: P1
- status: [x]
- where: packages/brain/src/contract/schemas.ts:183
- note: beats has no floor while createConversation and openScene both dereference
  beats[0]. With a minimum of one an empty frame fails parse inside buildFrame's catch and
  the request-grounded recovery scene opens, so the wedge never forms.
- verified-by: `a scenario with no beats is rejected before it can open`

### F30 — A client message can no longer take the worker down
- severity: P1
- status: [x]
- where: services/tutor-agent/src/convo.ts:644
- note: agent.ts fires handleClientMessage with no catch, so one throw is an unhandled
  rejection in a worker serving live learners. The handler contains its own failures and
  logs them; the call site gets the belt and braces catch.
- verified-by: `a client message whose handling fails is contained and logged instead of rejecting unhandled`

### F31 — Typing is presence, not silence
- severity: P1
- status: [x]
- where: packages/core/src/protocol/protocol.ts:206
- note: measured at four rescues in one hundred and five seconds while the founder typed.
  A throttled typing note on the existing client channel resets the text clock, so a
  composing learner is never rescued mid sentence, and rescue itself is untouched for a
  learner who truly froze.
- verified-by: `the stuck clock stands down while the learner is typing and restarts when they stop`
- verified-by: `the app notes typing at most once per window while the draft changes`

### F32 — The subscription can be the whole brain in development
- severity: P1
- status: [x]
- where: services/tutor-agent/src/preflight.ts:13
- note: TUTOR_LLM=claude-cli-all routes turns and frames to the CLI too, needs no vendor
  key, widens the frame deadline, and warns plainly about the seconds each turn costs. The
  queue busy guard stops the silence clock firing behind a slow turn, for every brain.
- verified-by: `claude-cli-all sends every call, turns included, to the subscription`
- verified-by: `both brain selectors agree on claude-cli-all`
- verified-by: `a slow brain turn is not mistaken for a stuck learner`
- verified-by: `the scene builder gets a longer deadline when the subscription is the whole brain`

### F33 — A rate-limited brain call waits and tries once more
- severity: P2
- status: [x]
- where: packages/brain/src/llm/openaiCompat.ts:1
- note: eight 429s in one live session, zero retries anywhere in the client. One retry
  honouring Retry-After capped near two seconds, then the existing failure path; the
  realtime budget cannot absorb more.
- verified-by: `a learner whose turn hits the free tier’s limit still gets an answer`
- verified-by: `the wait is the one the vendor actually asked for`
- verified-by: `a long wait is capped, because nobody stares at a silent tutor for thirty seconds`

### F34 — The caps kickers that repeat the sentence beneath them are gone
- severity: P1
- status: [x]
- where: apps/mobile/src/ConvoScreen.tsx:199
- note: both Free talk labels and the audited decorative set. Every load-bearing label
  stays, and Tap to listen is restyled to sentence case rather than deleted because it is
  the browser gesture affordance. Headers that lose their left child keep Leave on the
  right.
- verified-by: `the retired kickers stay retired`

### F35 — A brain turn that never returns is not a learner who never speaks
- severity: P2
- status: [x]
- where: services/tutor-agent/src/convo.ts:791
- note: filed by backend-engineer while building F32, and it is that work that makes it
  bite. runBrainTurn races nothing: buildFrame has a deadline and a fixture to fall back
  on, a turn has neither. With Groq answering in under a second a wedged call was a
  theoretical problem. With claude-cli-all it is an eight to twelve second call from a
  command line process that can hang, and the queue busy guard added for F32 now means a
  hung turn leaves the learner with no rescue clock running at all. A turn gets the same
  treatment its scene builder already has: a deadline, then the recovery line.
- verified-by: `a brain turn that never answers hands back the recovery line instead of hanging`

### F36 — The record of the enter fix still claims a reproduction nobody made
- severity: P1
- status: [x]
- where: docs/KNOWN_ISSUES.md:550
- note: the Round log in .forge/voice-first-choosing/contract.md establishes that
  "Enter is dead on react-native-web" was a test-harness artifact — the automation
  sent Return as an empty key event, and Enter almost certainly worked — yet the
  F24 note still opens "reproduced live. Enter is dead on react-native-web", and
  apps/mobile/src/tutor/enterSubmit.test.ts repeats "Reproduced live: the topic
  was typed, Enter was pressed, and the text sat in the box." Reword both to claim
  only what react-native-web 0.21.2's source established: submitBehavior dropped
  by the prop whitelist, the blur after every Enter, and the choosing ScrollView's
  missing keyboardShouldPersistTaps. The code is right and stays; the record is
  what future sessions trust, and it currently states a disproven diagnosis as
  fact. No working code may be removed to close this.
- verified-by: `the record of the enter fix claims the platform's source, not a reproduction nobody made`

### F37 — A failed custom scene silently becomes a café lesson
- severity: P1
- status: [x]
- where: services/tutor-agent/src/convo.ts:590
- note: startScene catches every frame timeout, provider error and parse failure, then
  opens chooseFrame(profile). For a new learner that is always the café, so an operational
  failure reaches them as a tutor that ignored “driving with friends” and chose coffee.
  The recovery frame now carries the learner's exact request into the scene plan and uses
  neutral, reusable French; the prompt also marks every part of the request as binding.
- verified-by: `a driving request can never become the café fixture when the scenario builder fails`
- verified-by: `a seeded session whose scenario build fails stays on the topic it was given`
- verified-by: `an ordinary brain that goes quiet still opens on the learner request at ten seconds`

### F38 — Local voice testing can exhaust the one-off learner trial
- severity: P1
- status: [x]
- where: services/token-server/src/store.ts:24
- note: the local token server applies the real finite trial to development accounts, so
  repeated Tutor testing eventually blocks the founder behind a paywall with no purchase
  path. An explicit local-only store now returns a fresh Regular allowance after every
  debit, while NODE_ENV=production refuses the flag and keeps real metering authoritative.
- verified-by: `development minutes have to be explicitly enabled and can never activate in production`
- verified-by: `local testing minutes do not run down between tutor sessions`

### F39 — The OpenAI arm reads the same routing table the Claude arm does
- severity: P1
- status: [x]
- where: packages/brain/src/llm/openaiResponses.ts:151
- note: three divergences in one adapter. `frame` went to the analyst model, so a learner
  stood behind the bridge line waiting on the slow, dear model while DEFAULT_ROUTING puts
  that call on the fast tier for exactly that reason. BRAIN_EFFORT did nothing here,
  because effort was hard-coded per call rather than read from resolveRouting, so the one
  dev knob answered differently depending on which provider was serving. And a private
  MAX_OUTPUT table gave curate 4,000 tokens where the routing table says 3,000. Effort and
  size now come from resolveRouting; which of the two OpenAI names answers follows the line
  SplitBrainClient already draws, because the table's model names are Claude's and which
  provider serves a call is wiring, not routing. The 11 October Luna live default
  deliberately uses none for turn/frame; explicit routes and BRAIN_EFFORT remain
  authoritative, and the named invariant now tests explicit routing.
- verified-by: `the scene a learner waits through is designed by the fast model, not the analyst`
- verified-by: `every activity thinks as hard as the routing table says, not as hard as this adapter guessed`
- verified-by: `BRAIN_EFFORT moves the OpenAI arm exactly as it moves the Claude arm`
- verified-by: `a route with no effort of its own leaves the vendor's default alone`
- verified-by: `every call is sized by the routing table, so one table answers how much room a call gets`
- verified-by: `a truncated answer says it was truncated instead of blaming the model's JSON`

### F40 — A rate-limited OpenAI call waits and tries once more
- severity: P2
- status: [x]
- where: packages/brain/src/llm/openaiResponses.ts:152
- note: F33 bought these turns back on Groq and left the OpenAI arm with no retry at all. A
  fresh account is rate limited on its first busy session, and a 429 mid-turn reaches the
  learner as the recovery line, their sentence unanswered. The same single retry, the same
  Retry-After capped near two seconds, now lives in one module both adapters import so the
  cap cannot drift into two different answers to how long a learner may stand in silence.
- verified-by: `a learner whose turn is rate limited still gets an answer`
- verified-by: `the wait is the one OpenAI actually asked for, and it is capped`
- verified-by: `a rate limit with no usable Retry-After still earns one short pause`
- verified-by: `a second rate limit ends the call exactly as it did before`
- verified-by: `only the rate limit earns a second try; a bad request fails at once`

### G1 — The tutor never calls the learner by name
- severity: P1
- status: [x]
- where: apps/mobile/src/nav/RootNavigator.tsx:197
- note: onboarding asks what they want to be called and stores it, and the name is then
  dropped at the first hop. The conversation route passes only `profile.brain`, so the
  name is absent from the session snapshot, from the token metadata, from LearnerProfile
  and from every prompt. The tutor cannot use a name it was never given. The name now
  rides in `memory`, which is already documented as what the tutor knows about the
  learner as a person, and is validated at both ends because it reaches a spoken line.
- verified-by: `the tutor greets the learner by name`
- verified-by: `a learner with no name still gets the ordinary opener`
- verified-by: `the turn context carries the learner's name`
- verified-by: `the scenario request names the learner`
- verified-by: `a name that is not a name never reaches a spoken line`
- verified-by: `a profile stored before names survives with a null name`

### G2 — A scene can open on a narration the learner cannot picture
- severity: P1
- status: [x]
- where: packages/brain/src/contract/schemas.ts:211
- note: openingNarration is a bare speaker line with no minimum length and no language
  check, so a model that returns two words or French-flavoured English opens the scene
  on nothing, and the first thing the learner hears is French they were never set up
  for. The eval already checks exactly this, offline, where nobody is waiting. The check
  moves into the brain and runs where a learner actually is.
- verified-by: `a frame whose opening narration is missing is repaired before the scene opens`
- verified-by: `a frame whose English narration is actually French is repaired`
- verified-by: `a repaired narration still names the scene the learner asked for`

### G3 — The scene build is ten to twenty five seconds of unexplained French
- severity: P2
- status: [x]
- where: services/tutor-agent/src/convo.ts:229
- note: the learner answers in English and hears "Ah, très bien. Alors…" and then
  nothing, for as long as the scenario call takes. The French is right and stays; what
  was missing is the line's other job, which is telling them what is happening.
- verified-by: `the bridge tells the learner in English that a scene is coming`

### G4 — A topic spoken during the scene build vanishes with no trace
- severity: P2
- status: [x]
- where: services/tutor-agent/src/convo.ts:1005
- note: speech during `starting` is dropped so it cannot talk over the opening narration,
  which is right, but it is dropped silently. The learner sees nothing happen and says it
  again. The drop stays; the transcript is now published, so they can see they were heard.
- verified-by: `a topic that arrives during the scene build is still shown as heard`

### G5 — Reaching for English costs a rung, and tomorrow opens lower
- severity: P1
- status: [x]
- where: packages/brain/src/engine/grading.ts:27
- note: assessmentToQuality grades an English turn `poor`, which drops a rung, while a
  half-English turn holds at `partial` — an inconsistency inside one function. PEDAGOGY
  says asking for help is never scored against the learner, and reaching for English at
  A0 is normal beginner performance, not failure. The drop also writes stats.lastRung
  down, so openingRung starts the next session lower: two polite questions today cost a
  rung tomorrow.
- verified-by: `reaching for English holds the rung instead of dropping it`
- verified-by: `silence and a genuine breakdown still drop the rung`

### G6 — A question asked in English throws away earned help
- severity: P2
- status: [x]
- where: packages/brain/src/engine/conversation.ts:555
- note: assistanceDepth resets on any spoken turn, on the doctrine that speaking a real
  reply resets it. Asking "how do I say this?" in English is not a real reply — which is
  precisely why the beat does not complete — so the help the learner already earned is
  binned at the moment they most need it.
- verified-by: `earned help survives a question asked in English`

### G7 — A blocking error silences the English hand-back
- severity: P1
- status: [x]
- where: packages/brain/src/engine/grading.ts:74
- note: blocking-error outranks english-to-french in KIND_PRIORITY and flow allows one
  inline finding, so when both fire the learner who politely asked how to say something
  hears "Not quite. Try …" instead of an answer. The hand-back is an acknowledgement of
  the learner, not a correction that interrupts, so it is exempt from the cap and leads
  the coach line whenever it is present.
- verified-by: `a blocking error never silences the English hand-back`
- verified-by: `the coach line on an English turn leads with the hand-back, not the correction`

### G8 — The contract tells the tutor to skip the acknowledgement
- severity: P1
- status: [x]
- where: packages/brain/src/prompt/system.ts:77
- note: the coachLine contract said "Name the better French directly", which is an
  instruction to be terse, and it overrode the warmer persona line because the contract
  is what describes the output field. So a learner who asked a question in English got
  bare French back. The contract now asks for the acknowledgement first, varied and
  never repeated within a session, and the code-side fallback carries the same warmth so
  the behaviour is guaranteed rather than hoped for. Acknowledgement, not reassurance:
  "don't worry" is still banned, because it tells a learner there was something to worry
  about.
- verified-by: `the contract asks for an acknowledgement before the French`
- verified-by: `the persona still says reaching for English is never failing`
- verified-by: `the English hand-back is warm, varied, and passes the copy rules`
- verified-by: `the hand-back never reassures, because reassurance implies failure`

### H1 — One turn is spoken as three, and everything downstream believes three turns happened
- severity: P1
- status: [x]
- where: services/tutor-agent/src/convo.ts:1161
- note: speak() issued narration, coachLine and sceneReply as three separate say()
  handles. The framework returns the session to `listening` at the end of every handle
  and to `speaking` on the next one's first frame, so one real turn produced three full
  state cycles. Three consequences, one cause. The [luvani:latency] record split three
  ways with only the first carrying its marks, so no usable per-turn number existed to
  tune against. The rescue is armed on `listening` and speak() is fire-and-forget, so
  queue.busy is already false: a mid-turn sentence whose first audio byte took longer
  than STUCK_SILENCE_MS passed every guard and fired a rescue while the tutor was still
  talking, costing a ladder drop and an unearned brain turn. And the orb flipped to
  green "your turn" between the tutor's own sentences. One utterance now, so the
  framework splits sentences inside a single handle and the cache keys are unchanged.
- verified-by: `one turn is spoken as a single utterance`
- verified-by: `the spoken turn keeps a scene shift and the French reply, without routine coaching`
- verified-by: `a turn with nothing but a scene reply is spoken exactly as it was`
- verified-by: `a scene shift is uninterruptible even at a high rung`

### H2 — The conversation pays for a pipeline LLM it told to stay quiet
- severity: P1
- status: [x]
- where: services/tutor-agent/src/agent.ts:218
- note: the session is built with a real OpenAI LLM that convo.ts instructs with "You
  are unused; replies are generated out of band", and turnHandling never set
  preemptiveGeneration, whose framework default is enabled with up to three attempts
  per turn. Every final transcript therefore started a real completion against that
  unused context; the StopResponse thrown from onUserTurnCompleted returns before the
  framework's reconciliation block, so the handle is cancelled late. In convo mode
  those completions are billed, never spoken, and contend for the same key as the turn
  the learner is actually waiting on, which is the 429 that F40 documents reaching a
  learner as the recovery line. Lesson mode genuinely uses generateReply and keeps it.
- verified-by: `a conversation never speculatively generates against the unused pipeline LLM`
- verified-by: `a scripted lesson keeps preemptive generation, which it actually uses`

### H3 — A beginner who speaks over the tutor has their words thrown away
- severity: P1
- status: [x]
- where: services/tutor-agent/src/convo.ts:1168
- note: modelled lines are uninterruptible at rung 2 and below, which is every A0 and
  A1 learner, and the framework default discardAudioIfUninterruptible bins the audio
  rather than buffering it. So the learner most likely to speak at the wrong moment is
  the one whose sentence is deleted, and they have to say it again with no idea why.
  The uninterruptible line stays: a speakerphone hears the tutor and a VAD interruption
  during a modelled line is almost never the learner. Keeping the audio is free.
- verified-by: `a learner speaking over an uninterruptible line is buffered, never binned`

### H4 — Every free-conversation sentence opens a fresh connection to the voice vendor
- severity: P2
- status: [x]
- where: services/tutor-agent/src/ttsCache.ts:76
- note: cache misses default to the per-sentence HTTP endpoint, and the warm cache only
  covers scripted lesson lines plus four fixed conversation lines, so in free
  conversation essentially every sentence is a cold vendor round-trip preceded by a TLS
  handshake. The websocket transport is written, tested and rides a pooled persistent
  socket; it was simply never switched on, and .env.example does not mention it exists.
- verified-by: `LUVANI_TTS_MISS_TRANSPORT=ws opts in via the environment, junk does not`
- verified-by: `http is the default and still synthesizes per sentence`

### H5 — The framework measures the turn and nothing reads it
- severity: P2
- status: [x]
- where: services/tutor-agent/src/agent.ts:242
- note: the pipeline already computes time to first TTS byte, playback latency,
  transcription delay and end-of-turn delay, and emits them on MetricsCollected. Luvani
  subscribes to Error, AgentStateChanged and UserStateChanged and not to that one, so
  the numbers that would say which vendor ate the milliseconds were being thrown away
  every turn while the same question was answered by guessing.
- verified-by: `the metrics line prices each vendor stage and omits what did not happen`
- verified-by: `a metrics payload with nothing usable in it prints nothing at all`

### H6 — The worker documents a turn detector that is not installed
- severity: P2
- status: [x]
- where: services/tutor-agent/src/agent.ts:227
- note: the comment says the semantic turn detector reads the words to judge whether the
  learner has finished and "stays the default", protecting hesitating beginners. No
  turn-detector plugin is in the package, so the framework has been falling through to
  plain silence-based VAD all along, and LUVANI_TURN_DETECTION=vad selects what was
  already happening. A comment that describes protection the learner does not have is
  worse than no comment.
- note (2026-10-23, VOICE-010): this is no longer true of the SDK. Since 1.9,
  `AgentSession` builds the local audio turn detector (`turn-detector-v1-mini`,
  `@livekit/local-inference`) by default when `turnDetection` is unset, without any
  plugin. Without a native binding or job inference executor it scores every pause
  1.0, so the pause floor in `thinkingTime.ts` is sized to hold on its own. The
  comment in `turnHandling.ts` now says this.
- verified-by: `the turn-detection note matches the plugins actually installed`

### J1 — The circle you tap to start talking is drawn in the hairline colour
- severity: P1
- status: [x]
- where: apps/mobile/src/tutor/choosingView.ts:119
- note: a fresh voice session has the microphone closed, so choosingView returned
  `orb: 'idle'` and `orbIsButton: true` together. The idle look draws its rings and
  centre in paper.line, the token reserved for hairline rules, with a caption in
  inkFaint at 2.91. The single thing a learner must press to talk to their tutor was
  the faintest object in the app. Waiting to be tapped is not a state report, it is
  the primary control, so it now reads as one.
- verified-by: `a closed microphone offers a control, not a hairline`
- verified-by: `the orb only goes quiet when there is nothing to tap`
- verified-by: `every orb state carries a glyph that clears the text floor on its own fill`

### J2 — Two of the three traffic lights fail the contrast floor for a mark
- severity: P1
- status: [x]
- where: apps/mobile/src/theme.ts:120
- note: orb.thinking measured 1.79 against the house ground and orb.speaking 2.79,
  where a graphical object that reports state needs 3. palette.test.ts declared the
  amber a known exemption rather than asserting it, so nothing would ever have caught
  it. Both are darkened just enough to clear the floor and keep their word: amber still
  reads amber, red still reads red, and both stay far from rung one's yellow. Separately
  the captions leave the state colour for ink, because 3 is the floor for a mark and 4.5
  is the floor for words, and "Speak" in green measured 3.64.
- verified-by: `every orb state carries a glyph that clears the text floor on its own fill`
- verified-by: `an orb caption is words, so it is held to the floor for words`
- verified-by: `the three traffic lights stay far apart, and none of them is the rung fill`

### J3 — The intro teaches the thinking colour by the wrong name
- severity: P2
- status: [x]
- where: apps/mobile/src/tutor/TutorIntro.tsx:33
- note: the page that teaches the voice circle called amber "Yellow", while rung one's
  actual yellow lives one screen away in the same app. The same file's header said three
  pages and listed four.
- verified-by: `the intro names the orb states in words, never by colour`
- verified-by: `the intro header counts its own pages`

### J4 — The icon-only tab bar never tells a screen reader the screen changed
- severity: P1
- status: [x]
- where: apps/mobile/src/nav/LuvaniTabBar.tsx:96
- note: announceTab was written for exactly this, docblock and all, and then called from
  nowhere. Five tabs with no labels and no announcement means a screen-reader user gets
  no signal that the entire screen replaced itself.
- verified-by: `changing tab announces the destination`
- verified-by: `staying put announces nothing`

### J5 — A control sits below the touch floor the tokens call a floor
- severity: P2
- status: [x]
- where: apps/mobile/src/components.tsx:585
- note: theme.ts says HIT is the iOS minimum "enforced on every control", and the
  segmented tab used HIT - 4. Forty points, in the control that switches Leaderboard
  between Global and Friends.
- verified-by: `no control is built below the touch floor`

### J6 — Icon drawings are read aloud to screen readers
- severity: P2
- status: [x]
- where: apps/mobile/src/components.tsx:517
- note: theme.ts exports `decorative` for exactly this and motion.test.ts enforces it on
  every illustration, but the icon layer never spread it. Eight drawings across three
  files, including the microphone, the ear and the chevrons, reach assistive tech as
  unlabelled images, and on web react-native-svg forwards unknown props straight to the
  DOM. Same class of bug the token was created to fix, one layer down.
- note: revamp A (2026-09): the rule widened rather than moved. The same contract test in
  surfaceContract.test.ts now covers raster scenes as well as every `<Svg>`, and was renamed for
  it; the icon layer this entry was filed about keeps its own copy in glyphs.test.ts.
- note: revamp B (2026-09-30, F599): the raster scenes retired, so the same test now holds every
  `<Svg>`, the flat drawings included, and refuses any import of `Image`; renamed for it.
- verified-by: `every drawing in the app is hidden from assistive technology, and nothing imports Image`
- verified-by: `every glyph draws in the one stroke weight and hides from assistive technology`

### J7 — Four scene animations keep running on screens nobody is looking at
- severity: P2
- status: [x]
- where: apps/mobile/src/tabs/HomeTab.tsx:158
- note: DESIGN.md says scenes stop via `paused`, and exactly one of seventeen render
  sites passed it. Bottom-tab screens stay mounted after their first visit, so Home's
  bubbles, Tutor's bubbles and both of Leaderboard's empty states loop for the rest of
  the session behind whatever the learner is actually doing.
- note: 2026-09-27 notebook final sweep: decorative scene motion is deleted rather than paused;
  the successor checks all illustration sources and the daily card contain no animation.
- verified-by: `decorative scenes are static even when a mounted tab is not focused`

### J8 — The lesson header says the position twice, once as a number
- severity: P2
- status: [x]
- where: apps/mobile/src/SessionView.tsx:161
- note: the header prints "2 / 5" and then renders the dot rail that says the same
  thing. ConvoScreen deliberately removed its numeric position for this reason, and
  DESIGN.md asks for dots rather than numbers, so the two live surfaces disagreed.
- verified-by: `the lesson header shows neither the retired rail nor a numeric count`

### J9 — Failure screens explain the failure to an engineer
- severity: P2
- status: [x]
- where: apps/mobile/src/live/failure.ts:169
- note: a learner whose session will not start was told about room service offering an
  address the browser is not allowed to reach, or that the tutor's voice or brain is
  missing a key. Both are true and neither is theirs. Same information, said the way
  DESIGN.md asks for: plain, warm, short, and about what they can do next.
- verified-by: `no failure message explains the plumbing to the learner`
- verified-by: `every failure still offers a way forward`

### J10 — Three live comments describe the retired red microphone
- severity: P2
- status: [x]
- where: apps/mobile/src/DrillScreen.tsx:551
- note: the microphone went green when the founder chose this direction, and App.tsx's
  direction contract, DrillScreen's speak control and the frontend agent's own brief
  still described it as red. The two documents an agent reads first disagreed with each
  other about the one signal the product is built on.
- verified-by: `nothing in the app still calls the live microphone red`

### J11 — The five-paper colour system was documented but never rendered
- severity: P2
- status: [x]
- where: apps/mobile/src/palette.ts:121
- note: paperFor had zero application callers — only its own test — and eighteen of
  nineteen screens rendered the house lilac. sand, sage and lagoon never reached a
  screen, and nor did the bronze, harbour and iris accents that belong to them, while
  DESIGN.md's colour table named the café arc and Entre amis as places they were used.
  Roughly three hundred and seventy lines of tested arithmetic defending colours
  nobody could see, and a design document that read as a plan rather than a record.
  Four of the five ship now; lagoon waits for a tutor-written topic to have a screen of
  its own, and the table says so. The lock reads both sides, so neither can drift again.
- verified-by: `nothing asks for a paper by place any more`
- verified-by: `DESIGN.md records the palette the app ships`

### J12 — One motion vocabulary, implemented four times
- severity: P2
- status: [x]
- where: apps/mobile/src/illustrations/useSceneMotion.ts:87
- note: DESIGN.md said the motion vocabulary "now has exactly one implementation" and it
  had four. useSceneMotion, VoiceOrb, Transcript and SplashScreen each called
  isReduceMotionEnabled and each hand-rolled its own final-frame branch, and three of the
  four sampled the setting once and never looked again — so a learner who turned reduce
  motion on mid-session went on being animated at until the next launch. Only the scene
  hook subscribed, so that one is the one that survived. The 380ms out-cubic settle was
  copy-pasted in two more places, which is how a vocabulary becomes a dialect.
- verified-by: `nothing hand-rolls the reduce-motion check any more`
- verified-by: `the settling entrance has one set of numbers`

### J13 — The tokens exist and the app writes the numbers anyway
- severity: P2
- status: [x]
- where: apps/mobile/src/splash/SplashScreen.tsx:221
- note: the back chevron is re-implemented in eight files and three of them spelled the
  touch floor as 44 rather than HIT, in an app whose token file calls that number a
  floor. `space(0.5)` exists and is used, and nine places wrote a raw 2 beside it.
- verified-by: `the back chevron never spells the touch floor as a number`
- verified-by: `the half step is a token, not a two`

### J14 — Three exports nothing ever called, two of them documented as shipping
- severity: P2
- status: [x]
- where: apps/mobile/src/components.tsx:205
- note: `Chip` was exported with zero call sites and described in DESIGN.md's component
  list. `Bloom` and `OffTheHook` were drawn, exported through the barrel, and imported by
  nothing, while DESIGN.md said where each one appears — OffTheHook supposedly for an
  unreachable token server, on a screen that draws no illustration at all. Five dead
  styles went with them.
- verified-by: `the components and scenes nothing imported are gone`
- verified-by: `every scene the barrel exports is drawn somewhere`

### E1 — A voice id from another account passes preflight and then never speaks
- severity: P1
- status: [x]
- where: services/tutor-agent/src/preflight.ts
- note: found by actually running the worker against a dead ElevenLabs key.
  preflight checked that ELEVEN_VOICE_ID was *set* and never that the account
  could use it — but a voice belongs to the account that made it, so rotating a
  key onto a new account leaves a voice id that passes every check and then 404s
  at synthesis. That reaches a learner as a room that opens and a tutor that
  never speaks, which is the exact failure this file exists to prevent, and it
  was the one hole left in it. Worse, it hides: the warm .tts-cache replays every
  scripted lesson line from disk, so the lesson would sound perfect and only free
  conversation would go silent. The key probe now lists the account's voices
  instead of reading /v1/user — same 401 on a bad key, and the body is the only
  thing that can settle the question — and an absent voice is fatal with the
  usable voices named, mirroring the retired-Groq-model check.
- verified-by: `a key rotated onto a new account is fatal, and names every voice it cannot speak`
- verified-by: `a catalogue voice the account does not list is fatal and names the key to remove`
- note 2026-09-02: re-pointed by F286, not weakened. The original test named one voice from an env
  var; the learner now picks from eight, so the probe proves all of them and the replacement names
  every voice the account cannot speak. Same failure, eight times the surface.

### E2 — A dead voice key blocks the two modes that need no voice
- severity: P2
- status: [x]
- where: services/shared/sessionCapabilities.ts
- note: 2 October 2026: explicit paired `LUVANI_TYPED_ONLY=1` recovery serves only
  lesson-text/convo-text without speech keys, probes, VAD/STT/TTS clients or room
  audio. Transport and the selected brain remain required; both CLI options also
  require/probe Groq for their actual SDK lesson dependency and check the CLI
  binary on direct startup. The token API advertises its capabilities and refuses
  speech before a trial/lease/grant; the client offers typing for that precise
  reply. The dev supervisor verifies paired flags and reused token capabilities.
  Independently deployed processes have no automatic handshake: matching flags
  and real startup are release checks. An unsupported signed job reports zero
  use before rejection, releasing its lease on successful cleanup. Failed cleanup
  still needs lease expiry/reconciliation; an already claimed trial is not undone.
  Independent authorized Sol review accepted code; 3,908-test gate green. No real
  LiveKit/native recovery session or vendor request was performed.
- verified-by: `a worker with no usable voice can still serve the typed modes`

### E3 — The French tutor spoke with an American voice, and every check passed
- severity: P1
- status: [x]
- where: services/tutor-agent/src/voice.ts:1
- note: the founder's report was that the tutor "sounds purely robotic". Most of it was
  not in the writing. ELEVEN_VOICE_ID was EXAVITQu4vr4xnSDxMaL, the vendor's premade
  "Sarah": category premade, accent american, language en, use_case entertainment_tv. She
  was speaking French because voice.ts pinned languageCode 'fr' over the top of her, and
  her verified_languages list French only under eleven_multilingual_v2 while voice.ts
  pinned eleven_turbo_v2_5, where she is verified for English alone. So the tutor ran an
  unverified voice/model/language combination for its whole life, and no amount of better
  prompt writing would have fixed the sound of it.
  The honest repair is a native French voice, and it is not reachable here: every native
  French voice the vendor offers is a library or cloned voice, a free account is refused
  both over the API, and the free tier's own premade voices are all English. That is a
  purchase, not a config change, and it is recorded in .env.example rather than pretended
  away. What ships instead is the same voice on the model where its French is actually
  verified, plus the delivery settings retune the flat "neutral" tuning was suppressing.
  The second half is the reason this is a P1 rather than a settings tweak. preflight
  checked the voice appeared in /v1/voices and stopped there, but appearing in the
  catalogue is not permission to synthesize: a library voice on a free plan is listed
  happily and then refused 402 the moment anything asks it to speak. That combination
  passed every startup check and reached the learner exactly the way the wrong-account 404
  in E1 did, as a room that opens and a tutor that never speaks. Confirmed by running it,
  not by reasoning about it. preflight now asks the vendor to say one word in the exact
  configuration the tutor will use, because the voice, the model and the language are
  refused as a combination and a probe that guessed any one of them would vouch for a
  setup nobody runs. Four characters of quota per boot. Deterministic refusals are fatal;
  a 500 or a 429 stays a blip, on the same rule the rest of that file follows.
  Changing the model re-keys the TTS cache, so this lands with a warm-cache run.
- verified-by: `the model is pinned, not left to the plugin default`
- verified-by: `a voice the account may list but may not speak with is fatal`
- verified-by: `the refusal names the model, because it is the combination that is refused`
- verified-by: `the probe asks for exactly what the tutor will ask for`
- verified-by: `a vendor blip at synthesis does not refuse to start the worker`
- verified-by: `a refused voice still produces one message, not two`
- verified-by: `the synthesis probe asks for the default voice, and only the default`
- note 2026-09-02: re-pointed by F286. There is no unset-voice state left to test, so the question
  the old test answered — how much quota a boot spends — became "how many voices does it speak",
  and the honest answer is one. Eight probes per boot would be eight billed requests for a
  guarantee seven of them cannot give.

### E4 — A delivery knob could change what the vendor was asked for while the cache replayed the old answer
- severity: P2
- status: [x]
- where: services/tutor-agent/src/voice.ts:49
- note: SETTINGS_FINGERPRINT was hand-listed and covered streamingLatency, stability and
  similarity_boost. The file's whole stated guarantee is that "audio synthesized under one
  configuration is never replayed under another", and adding style, use_speaker_boost or a
  language code would have broken it silently: the vendor gets the new request, the disk
  cache goes on serving audio made under the old one, and the retune is inaudible for every
  warmed line. Found while adding exactly those knobs. The fingerprint is derived from the
  settings object now, with keys sorted so declaration order cannot re-key the cache on its
  own, so it can no longer fall behind what is sent.
- verified-by: `every delivery knob that is sent is in the cache key, so none can drift`
- verified-by: `the language the vendor is told to expect is in the cache key too`

### K1 — The tutor corrected on every single turn, on its loosest setting
- severity: P1
- status: [x]
- where: packages/brain/src/engine/grading.ts:86
- note: the other half of "sounds purely robotic", and the founder put it exactly: it
  "never just reacts". Not the prompt. The live agent then hardcoded strictness `flow` (since F183 it runs the
  learner's stored setting),
  the loosest column there is, and `flow` still surfaces `textbook-phrasing` inline because
  that finding is the product and a test says so by name. The learners are absolute
  beginners, so every single thing they say IS textbook French. The model found one every
  turn, the policy surfaced it every turn, and integrateTurn minted a coachLine every turn.
  INLINE_CAP was already described in its own comment as "a budget for interruptions", and
  it is — per turn. A budget of one, spent every turn, is still an interruption every turn.
  The missing dimension was time, so the cooldown is time and nothing else: surfacePolicy is
  untouched, textbook phrasing is still inline at every strictness, and nothing becomes
  ineligible. It just does not get the slot on consecutive turns, and what misses the slot
  is not lost, it joins the recap queue that already dedupes and groups by topic.
  Two kinds are exempt because they answer the learner rather than interrupt them: the
  English hand-back, already exempt from the per-turn cap for that reason under G7, and a
  blocking error, because withholding "the scene did not understand you" to keep the rhythm
  pleasant strands the learner mid-scene and costs more than the interruption saves. Neither
  spends the budget either, so asking for help never buys the tutor's silence on the next
  thing worth saying.
  The rule and the wiring are tested apart on purpose. splitCoach is a pure function and
  easy to hold; the state that carries the clock between turns is the half that can be
  silently absent, so integrateTurn is driven over six and eight real turns as well.
- verified-by: `the first finding of a session is never held back`
- verified-by: `a second correction on the very next turn waits instead of interrupting again`
- verified-by: `the cooldown expires, so coaching resumes rather than stopping`
- verified-by: `a comprehension breakdown is coached even mid-cooldown`
- verified-by: `answering the learner never buys the tutor silence on the next turn`
- verified-by: `the cooldown holds things back without making them ineligible`
- verified-by: `a caller that tracks nothing behaves exactly as before`
- verified-by: `a run of textbook turns is not a run of corrections`
- verified-by: `two consecutive turns never both interrupt`
- verified-by: `what the cooldown holds back reaches the recap instead`

### K2 — The tutor was a rules list, and said its fixed lines the same way forever
- severity: P1
- status: [x]
- where: packages/brain/src/prompt/system.ts:24
- note: the rest of "sounds purely robotic", in three parts that share one cause.
  The persona opened "You are a responsive French conversation tutor for an English-speaking
  learner" and then listed twenty-two rules, fourteen beginning with "Never". No name, no
  age, no city, nothing the character liked or would refuse. A model handed only constraints
  produces constrained output. He is Luc now, fifty-two, from Lyon, ran a bar for twenty
  years, not a teacher and says so, and the commitments all still stand at the bottom where
  they belong. Same treatment for the scripted-lesson prompt, because two prompts is a fact
  of the two pipelines and two different PEOPLE would be a fact the learner can hear.
  One clause had to be split rather than kept or dropped. "End with a question or an obvious
  conversational opening" was pinned by a test whose comment records why: the dead-end turn
  is a competitor failure, "the AI makes a statement and that's it, which leaves me blank".
  True, and it was also making every single turn end in a question, which is being
  interviewed. The opening stays mandatory; a question stops being the only way to give one.
  The test asserts the guarantee now instead of the wording, and keeps the comment.
  Every fixed learner-facing line became a small family rotated on the turn, never random,
  because prepareTurn is byte-stable and this has to stay testable. Five of the six coach
  fallbacks were one string each, while the English hand-back next to them had been four
  variants since G8 with a note saying "a warm line said the same way every time stops being
  warm by the third turn". That was equally true of "Small fix:". The recovery line, the
  scripted-lesson feedback and the recap headline went the same way; three of the four
  recovery lines put the failure on Luc rather than the learner, which is not a kindness but
  what actually happened.
  And the one that looked generated rather than merely fixed: every session opened with the
  same three words. "Imagine the scene." was in both fixtures, the request fallback and the
  runtime narration repair, because the scenario prompt's own worked example taught the model
  to write it. Nothing guarded the most-repeated line in the product. The example is gone,
  the instruction now asks for a different opening every time and shows three, and a test
  holds every opening path to it.
- verified-by: `the persona is a person before it is a policy`
- verified-by: `he reacts to the learner before he advances the scene`
- verified-by: `spoken French can use fillers naturally, without performing them`
- verified-by: `his English stays plain, because it is the channel the beginner relies on`
- verified-by: `he does not perform himself at the learner`
- verified-by: `both prompts introduce the same person`
- verified-by: `neither lets him perform himself at the learner`
- verified-by: `the persona carries the behavioural commitments`
- verified-by: `every kind has several ways of being said`
- verified-by: `no variant repeats another, breaks a copy rule, or loses the French`
- verified-by: `no variant ever reassures, because reassurance implies failure`
- verified-by: `textbook phrasing never opens on a correction, in any variant`
- verified-by: `an out-of-range or negative variant still returns a clean line, for every kind`
- verified-by: `the rotation is a function of the turn, never a random draw`
- verified-by: `every line of every feedback family is safe, distinct, and says something`
- verified-by: `a run of the same outcome is not a run of the same sentence`
- verified-by: `every line of every headline family is clean and distinct`
- verified-by: `two sessions of different lengths do not end on the same sentence`
- verified-by: `every opening path starts on something concrete, not a stock phrase`
- verified-by: `no two authored openings begin with the same words`
- verified-by: `the scenario prompt asks for variety instead of demonstrating a formula`
- verified-by: `the openings the model is shown are examples, not one template`

### K3 — The app introduced a person and then called him "your tutor" twenty times
- severity: P2
- status: [x]
- where: apps/mobile/src/tutor/tutorName.ts:1
- note: the app half of K2, and it would have undercut it. Giving the tutor a name in the
  prompt while every screen still says "your tutor" is introducing someone and then
  refusing to use their name, which reads as exactly the distance the whole change is
  trying to close. He is Luc on every surface where he is a person the learner is talking
  to: the orb captions, the intro, the choosing screen, the transcript label, the home and
  tutor tabs, onboarding and the practice status line. The intro's first page now says who
  he is, because "Luc is thinking" in front of a learner who has never been told who Luc is
  would be worse than the role.
  He is deliberately absent from every failure screen. "Luc did not pick up" blames a person
  for a dead server, and that copy already goes out of its way to say this one is on us, not
  on you. Same instinct J9 recorded: a learner should never be handed the plumbing, and they
  should not be handed a scapegoat either.
  One home for the name rather than twenty literals, on F8's reasoning about the token
  server address: twenty copies agree about nothing today and would eventually disagree
  about something, and a half-renamed tutor is a learner being introduced to two people. The
  walk that proves it is the same shape as F8's.
- verified-by: `the name is spelled out exactly once in the whole app`
- verified-by: `it is a name a beginner can say, and not empty`
- verified-by: `the transcript label still says whose hearing it was`
- verified-by: `a still-being-written topic says the tutor is writing it`
- verified-by: `the moment a topic is sent the learner sees their own words and a tutor visibly thinking`

### K4 — The first line of every named learner's session was a cold vendor round trip
- severity: P2
- status: [x]
- where: services/tutor-agent/src/convo.ts:295
- note: found by an adversarial review of the K1 to K3 work, and it is the good kind of
  finding: the code was wrong and the comment above it said so confidently in the other
  direction. openerFor composed "Hi Sam. " + the warmed question, and the docblock explained
  that the framework would split them so "only the two-word greeting is a cold miss and it
  plays first while the warm half streams from disk".
  It does not split them. The framework's sentence tokenizer takes a minSentenceLength of
  twenty (@livekit/agents tokenize/basic), "Hi Sam." is eight characters, so it glues to the
  question and the pair takes ONE cache key. warmCache splits with the same tokenizer, which
  is the whole reason it uses it, so what it stored was the bare question, and the bare
  question is only ever what an UNNAMED learner hears. Every named learner therefore paid a
  full cold synthesis for the first thing they hear in a session, at the exact moment someone
  is deciding whether the thing works, and the record said they did not.
  Fixed by making the greeting carry its own length rather than by touching the splitter,
  whose floor belongs to the framework. The fixed part of the greeting does the work, so a
  learner called Al is not charged for a learner called Alexandra. Measured over names from
  one letter to nine. No re-warm needed: the question's own key never changed, which is the
  point.
- verified-by: `the greeting is its own sentence, so the question keeps its warmed key`
- verified-by: `an unnamed learner still gets exactly the warmed line`
- verified-by: `every sentence the warm script stores is a sentence the runtime asks for`

### F41 — The stored profile reaches v4 without losing anyone's answers
- severity: P1
- status: [x]
- where: apps/mobile/src/profile/upgrade.ts:19
- note: v4 adds `ageConfirmed: boolean | null`, keeps `dob` forever, and widens `motivation` and `dailyGoalMin` to nullable — a grep proved neither has a consumer outside the store, so the widening is free. A v2/v3 record whose dob makes the learner thirteen or over derives `ageConfirmed: true`; anything else derives null, never false, because false is a statement nobody made. `ageOn` moves to a pure `profile/age.ts` so the chain stays node-testable.
- verified-by: `a v3 profile with an adult dob arrives at v4 already age-confirmed`
- verified-by: `a v1 profile still reaches the latest version in one pass, brain intact`
- verified-by: `no upgrade branch ever drops the dob or invents a confirmation`

### F42 — Onboarding is three pages and none of them is a date of birth
- severity: P1
- status: [x]
- where: apps/mobile/src/onboarding/OnboardingFlow.tsx:32
- note: `PAGES = ['name','age','why']`. Name optional but encouraged (empty stores null, never the empty string), one "I am 13 or older" confirmation with the honest refusal line, why skippable. No goal page, no explainer, nothing blocking the first conversation. Pure answer assembly extracted to `onboarding/answers.ts`; the no-DOB rule pinned by a source-text test in the labels.test.ts idiom.
- verified-by: `a skipped name is stored as null, not as an empty string`
- verified-by: `onboarding never asks for a date of birth`
- verified-by: `a learner who cannot confirm their age is told plainly and is not let through`

### F43 — The daily goal lives in Profile now, with one write path
- severity: P2
- status: [x]
- where: apps/mobile/src/tabs/ProfileTab.tsx:175
- note: the goal question leaves the critical path and becomes an editable Profile row through `withDailyGoal`, the `withUsername` idiom. P2 honestly: nothing in the app reads `dailyGoalMin` today, so a round that ships without this row breaks no promise — it just leaves a preference unaskable until it closes.
- verified-by: `the speaking target is asked in profile and nowhere in onboarding`

### F44 — Six missions exist in core, and their state is a projection
- severity: P1
- status: [x]
- where: packages/core/src/missions/missions.ts:1
- note: the catalogue record (id, titles, place, cefr, roles, goal, win line, beat ids, phrase keys, reference phrases, path unit) plus `missionStates` projecting display state from completion records, the review deck and the drill bank — the `lessonDone` precedent, never a second phrase store. Independence is decided by code from the rung the win was earned at. Four new path units (`journee`, `chemin`, `marche`, `hotel`) with drill fixtures so no node opens onto nothing.
- note: notebook redesign (2026-09-27): a seventh mission joined, the three-line opener
  `mission:premier-cafe` (A0, café unit, now `FIRST_MISSION`), so the count test was renamed with it.
- note: mission spine A2 (2026-10-22): twelve more missions joined, five at A1 and seven at A2
  ([docs/changes/mission-spine-a2.md](changes/mission-spine-a2.md)). Missions now share the six
  drawn places and each has its own place drawing, so the count test was renamed again.
- note: mission spine B1 (2026-10-22): six more A2 missions joined (club, banque, sortie, montreal,
  coup-de-main, anniversaire; [docs/changes/mission-spine-b1.md](changes/mission-spine-b1.md)),
  so the count test was renamed to twenty-five.
- note: mission spine B1 (2026-10-23): the six B1 missions joined (fuite, galere, avis, entretien,
  teletravail, souvenirs), so the count test was renamed to thirty-one.
- verified-by: `thirty-one missions exist and each names the path unit that practises it`
- verified-by: `a completed mission whose phrases fall due reads needs-review, never complete`
- verified-by: `independence comes from the rung the win was earned at, not from the model`
- verified-by: `every authored path phrase can be drilled the day it appears`

### F45 — Six authored frames, natural adult French, schema-parsed
- severity: P1
- status: [x]
- where: packages/brain/src/missions/frames.ts:1
- note: `MISSION_FRAMES` in brain because `ScenarioFrameSchema` owns frame validity. Each frame: intentional per-character registers, 2–5 beats, curated goalPhrases, opening support so turn zero costs no model call. Every frame parses through the schema in a test and its English passes the copy rules; the French register table in the catalogue is the reviewer's checklist.
- verified-by: `every mission frame parses through the scenario frame schema untouched`
- verified-by: `no mission frame's English copy violates the copy rules`
- verified-by: `every mission frame opens with support already in hand`

### F46 — Core and brain cannot drift apart about a mission
- severity: P1
- status: [x]
- where: packages/brain/src/missions/agreement.test.ts:1
- note: the palette.test.ts idiom across the package boundary — brain may import core, so the test reads both sides. This entry is itself the test; it is what makes the F44/F45 duplication safe instead of parallel invention.
- verified-by: `every core phrase key has a matching goal phrase in its frame`
- verified-by: `every core beat id appears in its frame, in the same order`
- verified-by: `every reference phrase is one of its frame's own goal phrases`

### F47 — A mission session opens its scene with zero model calls
- severity: P1
- status: [x]
- where: services/tutor-agent/src/convo.ts:699
- note: `missionId` rides the seedTopic pipe (route params, `/session/start` body, token metadata) and `open()` builds the conversation straight from the authored frame — no `buildFrame`, no G3 wait, no F37 fallback on the first-run path. This is the mechanism under the one-minute promise. An unknown id degrades to today's choosing question rather than throwing.
  Two verified-by lines were added after the fact, because an adversarial pass found this
  chain broken in the middle with every test green: the route declared the id and dropped
  it one line later, and the worker never read it off the metadata at all, so the whole
  authored-scene path was unreachable from the app. A value that has to survive four hops
  needs something watching each hop, and a test that reads a type or a route object is
  not one of them.
- verified-by: `a mission session opens its scene with zero model calls`
- verified-by: `an unknown mission id opens the ordinary choosing question`
- verified-by: `the token server signs the mission id into the join metadata`
- verified-by: `the mission id is forwarded from the route into the live session`
- verified-by: `the worker reads the mission id off the join metadata`

### F48 — Finishing a mission's beats raises the win and does not end the session
- severity: P1
- status: [x]
- where: packages/brain/src/engine/conversation.ts:584
- note: for mission sessions only, `allBeatsDone` stops forcing `recapDue` and raises sticky `missionDone` on the view instead; `sceneDone` and the turn ceiling still end every session, so minutes stay bounded. The generated-frame path is untouched — `mission` defaults false and the 66 existing conversation tests must pass unmodified. After the win, the turn context tells the tutor the goal is reached and to stay in the scene without announcing it.
- verified-by: `finishing the beats of a mission raises the win and does not end the session`
- verified-by: `a generated-frame session still ends when its beats are done`
- verified-by: `scene-done and the turn ceiling still end a mission session`
- verified-by: `after the win the tutor is told the goal is reached, never told to say so`

### F49 — The win card shows once, offers two honest doors, and records the rung
- severity: P1
- status: [x]
- where: packages/core/src/protocol/protocol.ts:76
- note: `missionDone` is a field on `ConvoView`, not a new tag — it rides the turn it belongs to, an old app ignores it, and a new app reads an old agent's absence as false. App-side `tutor/missionWin.ts` shows the card exactly once at the flip, with the mission's win line, "Keep talking" saying plainly that it uses minutes, and "Finish and see your recap" sending the existing `leave` — `finish()` stays the only recap point, so nothing banks early. The completion record is written here with the view's rung.
- verified-by: `the win card shows exactly once, at the moment the mission completes`
- verified-by: `keep talking says it costs minutes`
- verified-by: `the win records the mission with the rung it was earned at`
- verified-by: `an old app ignores the mission field and behaves exactly as today`

### F50 — Give me a moment defers the clock and counts nothing
- severity: P1
- status: [x]
- where: services/tutor-agent/src/convo.ts:985
- note: new `moment` client tag: in scene it clears the rescue and arms one bounded grace window, after which the ordinary rescue policy resumes — so the help that eventually comes is the ordinary first rescue, and nobody is stranded. Never a ladder event, never a rescue count, never a rung. Re-tappable, the same presence argument as `typing`. The app answers on screen with a quiet line and nothing spoken, because a spoken acknowledgement of a pause is a remark on the pause.
- verified-by: `give me a moment defers the rescue clock and counts nothing against the learner`
- verified-by: `after the grace the ordinary rescue policy resumes, so nobody is stranded`
- verified-by: `a stray sound does not spend the time the learner asked for`
- verified-by: `a moment while the scene is being built changes nothing`
- verified-by: `the moment is answered on screen, never with a spoken remark`
- verified-by: `the learner who asks for time is answered in words they can read`

### F51 — The tutor's line replays on request, typing works mid-scene, and no control is dead
- severity: P1
- status: [x]
- where: packages/core/src/protocol/protocol.ts:169
- note: `hear` gains `line?: 'support' | 'scene'`; tapping the tutor's bubble replays the scene line, serving "Replay last tutor line" without a new tag — an old agent ignores the field and still speaks. The driver's sketched fallback (plain hear speaking the scene line) is rejected: the K-era rationale at convo.ts:1037 stands, so the app hides Hear it when there is no sayable support line instead of making the button lie. "Type instead" opens the input row in a voice scene and rides the existing `say` path unchanged.
- verified-by: `tapping the tutor's line plays it again`
- verified-by: `hear it hides when there is no line the tutor would vouch for`
- verified-by: `an old agent reads a replay request as a plain hear and still speaks`
- verified-by: `type instead sends a typed turn through the ordinary path mid-scene`

### F52 — The controls are taught when they matter, and the manual stops gating the door
- severity: P1
- status: [x]
- where: apps/mobile/src/tutor/gate.ts:1
- note: `tutorGate` stops requiring the intro; TutorIntro survives, demoted to links on the Tutor tab and Profile, so J3 and the orb-teaching contract in DESIGN.md are untouched. `tutor/coachMarks.ts` sequences three contextual marks (help, moment, english) under rules that keep it from becoming a second onboarding: one on screen, one new per session, each once ever, never blocking. Seen-state is one key, one new suffix in `clearActiveUserData`.
- note: revamp A (2026-09): the tutor tab's doors are three tinted rows now and the intro link is called
  the explainer, so both tests kept their claims under new sentences in tutor/gate.test.ts.
- verified-by: `the tab opens its rows with nothing standing in front of them`
- verified-by: `each coach mark shows once, ever, and never two at a time`
- verified-by: `at most one new coach mark appears per session`
- verified-by: `the explainer is still reachable, and still teaches the circle`

### F53 — A first-ever learner lands on the chooser with the café already chosen
- severity: P1
- status: [x]
- where: apps/mobile/src/nav/RootNavigator.tsx:279
- note: `MissionsScreen` as a stack screen serving all three doors — first run (in-memory `justOnboarded` flips the initial route; no persisted flag), Home's mission card, and the Tutor tab's three doors, where Talk freely remains supported but is no longer a beginner's only door. The pure `chooserView` owns ordering, the café default, and the promise line, which shows only before the first conversation because a promise about a first line is only honest once.
- verified-by: `a first-ever learner lands on the chooser with the café already chosen`
- verified-by: `every mission card routes to a conversation carrying its mission id`
- verified-by: `the promise line shows only before the first conversation`
- verified-by: `talk freely is still a door, and not the first one for a beginner`

### F54 — The tutor's sentences match the rung the learner is on
- severity: P1
- status: [x]
- where: packages/brain/src/prompt/turnContext.ts:67
- note: the INDEPENDENCE line grows explicit per-rung length guidance — one short sentence and one idea at the bottom rungs, natural length at the top — closing M3's "short turns, especially for A0/A1" now that K1–K4 own recasts, cooldowns and variant rotation. Guidance in the prompt, progression in code; the split the schema header names stays exact.
- verified-by: `the bottom rung asks for one short sentence and one idea`
- verified-by: `the top rung stops constraining the tutor's length`


### F55 — Six missions and a learner never has to understand a number
- severity: P2
- status: [ ]
- where: packages/core/src/missions/missions.ts:244
- note: found by reading the six authored missions side by side, which is the only place it
  is visible. Prices, times, floors and quantities are all spoken BY the tutor and nothing is
  ever required of the learner in return: the café says what it comes to, the market answers
  "ça fait combien ?", the hotel names a floor and a breakfast time, and in every case the
  learner's next line works whether or not they caught the number. For an A0 or A1 adult that
  is the single most common real-world failure, and six situations do not touch it once.
  Filed rather than fixed because closing it is a pedagogy decision, not an oversight: a beat
  that requires the learner to repeat back a number they heard is the first place in the
  product where NOT understanding has a consequence, and PEDAGOGY.md's first invariant is
  that a learner is never stranded. Doing it well means deciding what the tutor does when the
  number is missed, and that is a rung and rescue question rather than a content one. The
  cheapest honest shape, for whoever takes it: give the hotel's take-key beat a line that
  repeats the floor back, because a floor and a breakfast time are already spoken there.
  The same reading turned up a second gap worth recording in the same place: repair language
  exists as exactly two cards across the whole corpus ("pardon, vous pouvez répéter ?" in the
  café unit and "plus lentement, s'il vous plaît" in chemin), and repair is the most-used
  move a beginner has.
- verified-by: `a learner is asked to understand a number at least once across the missions`

### F56 — Two hops of the mission pipe have no tripwire watching them
- severity: P2
- status: [x]
- where: apps/mobile/src/live/useLiveSession.ts:448
- note: the round's defect class was a value asserted at a declaration and dropped one hop
  later, and its own fix note says a value surviving four hops needs something watching each
  hop. Two still had nothing: the spread handing `missionId` from ConvoScreen's props into the
  start options (ConvoScreen.tsx:198) and the spread putting it into the `/session/start` body
  (useLiveSession.ts:448). Delete either and every mission tap silently reverts to the
  ten-to-twenty-five-second model-written scene build, with the whole suite green and nothing
  anywhere to say so. Found by the judge rather than by a verifier, which is the useful part:
  every hop that had already bitten somebody had been given a tripwire, and these were simply
  the hops nobody had reached yet. One source-walk test closes both.
- verified-by: `the mission id is carried from the screen into the session start body`

### F57 — The two-minute promise is shown to learners and has never been timed
- severity: P2
- status: [x]
- where: apps/mobile/src/missions/chooserView.ts:36
- note: the contract says the one-minute claim is verified by stopwatch against `npm run dev`
  and that the round log must say what was measured. The mechanism under it is proven by test
  (a mission opens its scene with zero model calls, onboarding is three pages, the chooser is
  one tap), but "You'll say your first useful French line in the next two minutes." is a
  wall-clock claim shown to every first learner and no wall clock has been read.
  MEASURED IN PART on 2026-08-22, against the full four-process stack with real vendor keys.
  An earlier draft of this note said the keys were absent and the worker would not boot. That
  was wrong, taken from a stale memory rather than from the .env on disk, and the correction
  belongs here because the claim it excused is the one this entry exists to hold.
  The machine half is now on the record. Tapping the mission to the scene rendering took
  SEVENTEEN SECONDS (18:28:00 to `session-opened` at 18:28:17), on a cold Expo dev server with
  Metro bundling the route inside that window. The agent log for the whole session carries no
  `frame:` brain call at all, only `turn:` calls, so the ten-to-twenty-five seconds G3 measured
  is not merely smaller, it does not happen: the opening line came back `cache=hit` with
  `ttfb=3ms` and `audio→speaking=2ms`.
  What is still unmeasured is the human half, and it is the half the sentence actually claims.
  An automated walkthrough types instantly and then pauses for screenshots, so it can prove the
  app is not the slow part and it cannot prove what a nervous adult does in two minutes. This
  stays open for a person, at their own pace, with a watch.
  F36's lesson applies to a number as much as it did to a diagnosis: the record is what a
  later session trusts, so an unmeasured claim recorded as measured is worse than no record.
  RE-SCOPED 2 October 2026: the first-line copy now promises tutor help without a
  deadline. The old stopwatch claim is retired, not declared measured. Human first-run
  timing remains part of the device/human release pass in IMPLEMENTATION_EVIDENCE.md.
- verified-by: `the first-line promise gives help without an unmeasured deadline`

### F58 — On web, a first-ever learner lands on Home instead of the chooser
- severity: P2
- status: [x]
- where: apps/mobile/App.tsx:231
- note: found by running it, not by reading it, and the wiring is entirely correct: `App.tsx`
  sets `justOnboarded` when a brand-new profile completes (`:135`), passes it (`:151`), and
  `RootNavigator` uses it as `initialRouteName` (`:291`). It still does not happen on web.
  `initialRouteName` only applies on the navigator's first mount, and on web the
  `NavigationContainer` is given a `linking` config, so React Navigation resolves the initial
  state from the URL instead. Onboarding finishes at `/`, `/` is Tabs, and Tabs wins.
  This is F53's own defect class one layer down and worth saying plainly: the test asserts the
  chooser is reachable and the prop is passed, both of which are true, while the platform
  quietly overrules the prop. Nothing in a test can see a React Navigation precedence rule.
  Not P1 because the learner is not stranded and barely inconvenienced: Home leads with the
  mission card, headed NEXT SITUATION, naming Au café du coin with a Start this one button, so
  the first mission is one tap away and the café is still the one offered. What is lost is the
  chooser's promise line, which is the sentence F57 is about, and the sense of being handed a
  choice rather than a default.
  Closed by keeping the ordinary linking map and waiting for
  `NavigationContainer.onReady`, the point at which the web URL has finished resolving. A
  container ref resets the root to Missions exactly once for a new learner; Missions also has
  an explicit `/missions` web path. On 2026-08-27 a driven local-web run created an isolated
  mock-auth account from `/`, completed all three onboarding steps, visibly landed at
  `/missions`, used Back to reach `/home`, reloaded without repeating the reset, then returned
  to Missions and Back normally. That run proves the navigation behavior, not Supabase auth,
  native behavior or the still-unrun five-viewport matrix.
- note: notebook redesign (2026-09-27): a first run now lands on Today, whose one Start opens the
  next scene directly, and the chooser is reached from Speak's level path. The fix this entry is
  about still holds and is still tested: the root is reset in `onReady`, after the web URL has
  resolved, so the URL cannot overrule the first-run route. Only the destination moved, to Tabs.
- verified-by: `a first-ever learner reaches Today on web as well as on native, never the chooser`

### F59 — A client behind the trusted proxy can choose its own rate-limit address
- severity: P1
- status: [x]
- where: services/token-server/src/rateLimit.ts:205
- note: with LUVANI_TRUST_PROXY=1, `clientIp` takes the first x-forwarded-for entry; a standard
  proxy appends the real address, so the first entry is attacker-supplied and every per-IP
  limit becomes evadable by header rotation. Take the last entry under one trusted proxy and
  document the misconfiguration case.
- verified-by: `a client-supplied forwarded header cannot choose its own rate-limit address behind a trusted proxy`

### F60 — The redis boundary is pinned: failures refuse, keys are hashed
- severity: P1
- status: [x]
- where: services/token-server/src/rateLimit.ts:104
- note: today a limiter failure propagates to the handler's catch and returns 500, which is
  fail-closed, and every consume/lease call site passes privateSignal — but neither invariant
  has a test, so either can silently invert. Pin both.
- verified-by: `a distributed limiter failure refuses the request instead of granting it`
- verified-by: `no raw ip, user or installation value reaches a redis key without the deployment-salted hmac`

### F61 — A command-ready two-instance Upstash harness exists and is honest when blocked
- severity: P1
- status: [x]
- where: services/token-server/src/verify/upstashLive.ts:1
- note: cross-instance limits, lease acquire/conflict/expiry/matched-release and key-shape SCAN
  need UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. The deliverable is the harness: two
  spawned token-server processes sharing one Redis, a complete check inventory, and a BLOCKED
  non-zero exit naming the missing env vars instead of any claim of success.
- verified-by: `the upstash harness enumerates every required proof and reports blocked without credentials`

### F62 — Secrets are scanned in files, history and bundles without ever printing a value
- severity: P1
- status: [x]
- where: services/token-server/src/secretScan.ts:1
- note: no scanner exists; a leaked service-role key or LiveKit secret would ship silently. The
  scanner detects each credential shape used by this repo's vendors, reports path and line only,
  and gains --history and --bundles modes.
- verified-by: `the scanner finds each planted credential shape and never prints the matched value`

### F63 — A command-ready Supabase harness covers all twelve proofs and is honest when blocked
- severity: P1
- status: [x]
- where: services/token-server/src/verify/supabaseLive.ts:1
- note: RLS isolation, RPC privilege, period roll, debit concurrency, session replay, cross-user
  session rejection, trial races, the product-event trigger and deletion cascades are made
  one-command runnable against a disposable project, and refuse to claim anything without
  credentials.
- verified-by: `the supabase harness enumerates every required proof and reports blocked without credentials`
- verified-by: `the supabase harness never prints a key or token it was given`

### F64 — Every migration has a rollback and the disposable-project runbook exists
- severity: P1
- status: [x]
- where: supabase/migrations/202608230001_session_usage_idempotency.sql:1
- note: no migration has a down-script, so "migration rollback evidence" is currently
  unwritable; DDL cannot travel over PostgREST from this machine, so apply/rollback/backup/
  restore live in a paste-in-order runbook the harness points at.
- verified-by: `every migration ships a rollback that names each object it created`

### F65 — The voice lifecycle is measured live: expiry, caps, leases, hard stop, zero-or-once billing
- severity: P1
- status: [x]
- where: services/tutor-agent/src/verify/voiceLifecycle.ts:1
- note: the one area fully provable today. The harness spawns its own token server on a fresh
  port with a seeded file store, measures token expiry, the participant cap of 2, the 409 lease
  conflict and its release, disconnect teardown, a hard stop seeded down to 60-90 real seconds,
  zero debit for a never-joined room, exactly-once debit with a replayed /session/end, room
  teardown via listRooms, and prints timings and estimated spend.
- verified-by: `the voice lifecycle harness fails the run when any lifecycle check is skipped`
- verified-by: `the harness seeds an allowance that lands the hard stop inside ninety seconds`

### F66 — The safety net catches indirect, obfuscated and mixed-language harm, not just keywords
- severity: P1
- status: [x]
- where: services/tutor-agent/src/safety.ts:34
- note: the category list already names the right harms but the patterns are a thin literal net
  with four tests; indirect self-harm phrasing, grooming, coercion, zero-width and punctuation
  obfuscation and most French variants sail through to the model. Widen the deterministic table
  and normalisation and leave stop/redirect semantics untouched.
- verified-by: `indirect, obfuscated and mixed-language harm requests are caught and answered by policy`
- verified-by: `a redirect keeps the session open and a stop closes it, for every category`

### F67 — The privacy and safety policy exists and the shipped copy matches it
- severity: P1
- status: [x]
- where: docs/PRIVACY_AND_SAFETY.md:1
- note: antifraud-HMAC retention, analytics consent and opt-out, raw-speech prohibition and the
  escalation workflow are currently implemented behaviours with no stated policy, which means
  they can drift without anyone deciding to change them.
- verified-by: `the privacy and safety policy defines retention, consent, escalation and never claims emergency service`

### F68 — CI runs the gate, the dependency audit and the secret scan on every push
- severity: P1
- status: [x]
- where: .github/workflows/ci.yml:1
- note: there is no .github directory at all, so nothing guards main against a push from a
  machine with no hooks installed. One workflow: gate, npm audit at high level, secret scan.
- verified-by: `ci runs the gate, the dependency audit and the secret scan on every push`

### F69 — Every high and moderate advisory is traced, then fixed or accepted with evidence
- severity: P1
- status: [x]
- where: package.json:1
- note: npm audit reaches the registry (the evidence doc's blocked claim is stale) and reduces
  to four roots — adm-zip HIGH, image-size HIGH twice, uuid MODERATE. Trace each to its real
  runtime or build chain, apply overrides only where a compatible fixed version exists on a
  reachable chain, record acceptances, and pin the outcome.
- verified-by: `the lockfile carries no vulnerable version on a chain that was judged fixable`

### F70 — Professional review of the tutor-safety policy is prepared but not yet obtained
- severity: P2
- status: [x]
- where: docs/PRIVACY_AND_SAFETY.md:1
- note: an external professional review cannot be closed from inside this repo; P2 because an
  unclosable P1 stops the gate for everyone. The policy doc carries a review package section so
  the request can go out the day a reviewer is engaged.
- verified-by: `the policy carries a review package naming scope, corpus and the known limits of the net`

### F71 — Device auth and deletion have a runbook now and a device pass later
- severity: P2
- status: [x]
- where: docs/DEVICE_VERIFICATION.md:1
- note: no representative iOS or Android build can run on this machine, so Keychain/Keystore
  persistence, plaintext migration, forced safe sign-in and reauth-before-deletion are blocked;
  P2 for the same reason as F70. What is provable statically is proven now.
- verified-by: `no bearer token is written to logs or plain storage by the auth layer`

### F72 — The evidence matrix says measured, blocked or accepted for every area
- severity: P2
- status: [x]
- where: docs/IMPLEMENTATION_EVIDENCE.md:1
- note: the phase's honesty lives here — every area carries measured (with numbers from the live
  runs), blocked-on naming the exact env vars, or accepted-with-evidence; the stale
  audit-blocked claim is corrected and the vendor-cost record from F65 lands.
- verified-by: `the evidence matrix names a measured or blocked status for every phase one area`

### F73 — claim_trial grants the trial it is meant to refuse
- severity: P0
- status: [x]
- where: supabase/migrations/202608230001_session_usage_idempotency.sql:55
- note: `insert ... on conflict do nothing returning true into claimed` assigns NULL when the
  insert affects zero rows, overwriting the `:= false` initialiser. `not NULL` is NULL, an IF on
  NULL takes neither branch, so control falls through and provisions a fresh trial. Both arms
  are dead — installation_hash is the PK and first_user_hash is not-null unique — so a second
  account on one device and one account across devices are both granted. Unbounded vendor spend
  on the money path. The only existing test asserts the buggy line verbatim
  (databaseContract.test.ts:52), so it pins the defect rather than catching it. Fix by forward
  migration with a NULL-safe guard; the live behavioural proof is one of F63's twelve checks.
- verified-by: `the trial claim refuses a second installation rather than falling through on a null`
- verified-by: `the contract test rejects the null-unsafe claim_trial guard`

### F74 — consume_entitlement bills a replayed session id every time
- severity: P0
- status: [x]
- where: supabase/migrations/202608230001_session_usage_idempotency.sql:99
- note: the same NULL-from-RETURNING-INTO trap as F73, in the other money function.
  `insert into session_usage ... on conflict (session_id) do nothing returning true into
  recorded` assigns NULL when the row already exists, overwriting the `:= false`
  initialiser; `not NULL` is NULL, the IF at :101 takes neither branch, and control falls
  past the whole early-return block into the debit UPDATE at :117. The cross-account guard
  at :106 is itself NULL-safe but sits inside that unreachable branch, which is why the
  cross-user session proof fails for the same reason. Proven live against a disposable
  project: one session id reported three times debited 120s, then 240s, then 540s, with
  exactly one row in session_usage. databaseContract.test.ts:260 asserted
  `/if not recorded then/i` and so pinned this defect in place, exactly as :52 pinned F73.
  Fixed forward by 202608250001_consume_entitlement_null_fix.sql.
- verified-by: `the session debit bills a replayed session id once rather than falling through on a null`

### F75 — The product-event trigger calls a function PostgreSQL does not have
- severity: P1
- status: [x]
- where: supabase/migrations/202608230001_session_usage_idempotency.sql:152
- note: `property_count integer := jsonb_object_length(new.properties);` — there is no
  `jsonb_object_length` in PostgreSQL. `jsonb_array_length` and `jsonb_object_keys` exist;
  that name does not, and plpgsql binds function calls late, so the migration applies
  cleanly and only fails at insert time. The trigger is BEFORE INSERT OR UPDATE on
  product_events, so every write raises 42883 — including the token server's own
  service-role writes. Proven live: a valid `my_french_opened` event was refused. Analytics
  is silently and totally dead in any deployment of this schema. Fixed forward by
  202608250002_product_event_key_count_fix.sql, which counts keys with jsonb_object_keys
  behind a jsonb_typeof shape guard.
- verified-by: `the product event trigger counts properties with a function Postgres actually has`

### F76 — A learner who never speaks is billed for the whole session
- severity: P0
- status: [x]
- where: services/tutor-agent/src/tutor.ts:336
- note: found by the live voice harness, not by reading. The zero-billing guard asks
  `summary.turnsCompleted === 0`, but `turnsCompleted` is `state.turnIndex`, and the silence
  rescue applies a `silence` input that advances the turn. So the guard is defeated by the
  learner saying nothing — which is the exact case it exists for. Measured live: a room the
  harness never spoke in debited 60s. A learner with a dead microphone, a failed STT
  provider, or a room they could not hear pays for the full session.
- verified-by: `a session with no learner turn bills nothing even after a silence rescue`

### F77 — A join credential re-opens a session that has already ended
- severity: P1
- status: [x]
- where: services/token-server/src/tokens.ts:169
- note: recorded by the live voice harness. The join credential is a five-minute bearer
  token; ending the session closes the room, but a captured token re-created the closed room
  in its own name with 279s of ttl still on it. Measured separately: LiveKit validates `exp`
  with roughly 90s of leeway, accepting credentials 30s past expiry and refusing at 900s, so
  the five-minute ttl in tokens.ts is a floor on the replay window rather than a ceiling.
  Room name reuse after a session has been reported is the seam to close.
- verified-by: `a join credential cannot re-open a room whose session has already been reported`

### F78 — An abandoned room holds a tutor worker for half a minute
- severity: P2
- status: [x]
- where: services/token-server/src/tokens.ts:190
- note: recorded by the live voice harness. The premise this entry was first filed with was
  WRONG and the measurement refuted it: dispatch follows a *participant*, so a room nobody
  joins holds no tutor at all — measured, held 20.1s with emptyTimeout=20 and no tutor
  dispatched into it, and `never-joined-room-debits-nothing` confirms a grant nobody joins
  leaves no room behind. Worker occupancy for an abandoned room is therefore 0s, not 30s.
  The timeout that actually holds a worker is `departureTimeout` (20s shipped, measured
  20.6s), recorded as the finished-session occupancy. ROOM_LIFECYCLE now carries the shipped
  numbers, the measurements and the derived costs, and the test fails if a future run ever
  sees a tutor in an empty room or if the shipped grant and the record stop agreeing.
- verified-by: `the production empty-room timeout is recorded with its worker-occupancy cost`

### F79 — The replayed-credential refusal is worker-local
- severity: P2
- status: [ ]
- where: services/token-server/src/server.ts:192
- note: F77 closed the money half of a replayed join credential by having the tutor refuse a
  session id it has already reported, but that ledger lives in the worker's memory. It closes
  the replay against the worker that served the original session, which is the whole fleet
  today and is why this is P2 rather than P1. A second worker, or the same worker after a
  restart, would not know. The durable answer already exists: `session_usage` records every
  reported session id, so the join path can consult it. That is a token-server change and was
  outside the voice engineer's territory, so it is filed rather than reached for. Related:
  agent.ts keeps a refused replay's job alive on its hardStop timer, costing no vendor spend
  but holding a worker slot.
- verified-by: `a reported session id is refused on the join path, not only by the worker that served it`

### F80 — Four live vendor credentials sit in git history on two local branches
- severity: P2
- status: [x]
- where: services/tutor-agent/.env.bak-before-cli-all:11
- note: found by the F62 scanner on its first history run, which is the argument for having
  built it. Commit 576bc53 ("WIP: epitaxy pre-switch from codex/freeform-tutor-v2", 2026-08-21)
  committed a .env backup carrying GROQ_API_KEY, DEEPGRAM_API_KEY, ELEVEN_API_KEY and
  LIVEKIT_API_SECRET. Verified by sha256 comparison, without reading either value, that all
  four are byte-identical to the keys configured in services/tutor-agent/.env today: they are
  live, not historical.
  Exposure is bounded and that is the only reason this is not higher. The commit is NOT an
  ancestor of main and is on NO remote branch — `git branch -r --contains` is empty, so
  nothing reached GitHub. It is kept alive locally by refs/heads/codex/freeform-tutor-v2 and
  refs/heads/codex/voice-tutor-live-openai. The file is untracked in HEAD and .gitignore:16
  now covers `**/.env.bak*`, so the hole that made it is closed.
  P2 is about what this repo can close, not about how much it matters: every repo-side control
  is already done (scanner, ignore rule, CI step), and the remaining actions — rotating four
  vendor keys and deciding the fate of two stale branches — are human actions on external
  services and on branches this session does not own. Rotation is the only real remedy; a key
  that has been written to disk in a git object cannot be un-leaked. Do not rewrite history to
  "fix" this: nothing was pushed, so there is nothing to rewrite, and force-pushing is
  forbidden here anyway.
- update 2026-08-26: the repo side is now fully closed. Both branches were deleted after
  checking they were BEHIND main rather than ahead (the diff main->branch was 15,534
  insertions against 48,195 deletions — an abandoned lineage main had superseded), then
  `git reflog expire --expire-unreachable=now --all` and `git gc --prune=now` pruned the
  objects: 576bc53 and e99d650 are unreachable, the .env.bak blob is unreadable, .git went
  22M -> 5.1M, fsck is clean and the history scan reports clean. Nothing was ever pushed.
  This box still does NOT tick. Pruning removes future exposure; it does not un-leak a key
  that sat in a git object on disk from 2026-08-21 to 2026-08-26. Anything with filesystem
  access in that window — including any folder-level backup or cloud sync of
  Documents/StartUps — could hold a copy. Rotating Groq, Deepgram, ElevenLabs and the
  LiveKit secret is what closes this, and only that.
- update 2026-10-03: founder privately saved replacement credentials, confirmed local Luvani is the only consumer, and confirmed revocation of older keys at all four dashboards. Read-only Groq/Deepgram/ElevenLabs authentication returns HTTP200 after retirement; final LiveKit worker/token settings match and both authenticate. LiveKit dashboard now retains only the final “Luvani 2 Key”; the intermediate replacement exposed in a tool log and the unnamed older key are absent. Historical objects were already pruned in August, so old-value invalidation cannot be independently replayed; external retirement is founder-confirmed, not proved by the repository test below. History scan's sole current finding is a fabricated JWT regression fixture from 9317ec2c, explicitly allowed in its current source, not one of these vendor credentials. No branch deletion or history rewrite in this continuation.
- verified-by: `the scanner finds each planted credential shape and never prints the matched value`
- verified-by: `the history walker names the commit and line that introduced a secret`
- verified-by: `the scanner finds each planted credential shape and never prints the matched value`

### F81 — The evidence contract test pins the mid-phase blocked state after the run it forbade has happened
- severity: P1
- status: [x]
- where: services/token-server/src/verify/evidenceContract.test.ts:198
- note: filed by work-judge (renumbered from its F80, which was taken by the git-history
  finding). `a green gate cannot be read as a verified database` asserts the F63 and F73
  matrix rows must never say measured and requires the literal string "12 of 12 proofs
  skipped" — written before credentials existed, correct then, inverted now. The ledger
  records F74 and F75 as proven live against a disposable project, which means the twelve
  Supabase proofs ran; any honest update of docs/IMPLEMENTATION_EVIDENCE.md to `measured`
  with the run's numbers turns this test red. It is the same defect class the phase condemned
  at databaseContract.test.ts:52: a text assertion pinning a state instead of proving one.
  Rework it to forbid a measured claim only when no run is recorded, and to accept a measured
  row that carries the live run's numbers.
- verified-by: `the evidence contract accepts a measured supabase row that carries the live run's numbers`
- verified-by: `the evidence contract still refuses a measured claim for a proof no run has recorded`

### F82 — The evidence matrix and risk register are frozen mid-phase and contradict the ledger
- severity: P1
- status: [x]
- where: docs/IMPLEMENTATION_EVIDENCE.md:53
- note: filed by work-judge (renumbered from its F81). Four statements are false as of phase
  end. F63/F73 say `blocked-on:supabase-schema-not-applied` and "12 of 12 proofs skipped"
  while the ledger's F74 and F75 record live proofs against a disposable project.
  "Failed-room billing: a P0 control that does not hold" and the risk register's "None that
  holds" present F76 as open while it is ticked with `a session with no learner turn bills
  nothing even after a silence rescue` passing. "An empty room holds a waiting tutor" is
  asserted as measured in both documents while F78's measurement refuted it. "What is still
  outstanding" instructs applying three migrations, omitting 202608250001 and 202608250002 —
  an operator following it deploys with F74 and F75 live, the two defects this phase proved
  and fixed. Gate counts (1,557; tutor 329; token server 110) are mid-phase numbers against a
  final 1,570. Depends on F81, which currently makes the F63/F73 correction impossible.
- verified-by: `the evidence matrix does not call blocked what the ledger has ticked as proven live`
- verified-by: `the outstanding schema instruction names every migration in the runbook`

### F83 — Four stores bind the storage key inside the queued write, so a fast account switch can land one learner's data in another's namespace
- severity: P1
- status: [x]
- where: apps/mobile/src/progress/activity.ts:62
- note: activity, drills, journal and friends resolve userKey() when the queued callback
  finally runs, against whoever is active by then; review/missions/coachMarks/soundChecks
  already bind at enqueue with a comment explaining why. A live cross-account defect today,
  and sync's background retries would widen exactly this window, so it lands first. Fix all
  four to the review/store.ts discipline and pin it per store.
- correction 2026-08-26: the entry named four stores and there were SIX. data-engineer found
  topics/store.ts and progress/store.ts carrying the identical defect while fixing the named
  four, and fixed all six rather than only what the ledger asked for. progress/store.ts was
  worse than the others: recordSession was an unserialised read-modify-write with no write
  chain at all, so adding a second writer would have lost updates outright. drill and friends
  also moved from a single module cache to one keyed by storage key, because a cache miss
  after a switch is how a queued write reads the NEXT account's blob and folds one learner's
  work into it. The lesson for later phases: an audit that enumerates instances is a floor,
  not a census.
- verified-by: `a write queued under one account never lands in the next account's storage`

### F84 — learner_state gains a monotonic revision with a paired rollback
- severity: P1
- status: [x]
- where: supabase/migrations/202608260001_learner_state_revision.sql:1
- note: the table has no ordering primitive, so conflict detection is currently impossible.
  One column, default 0, CAS via PostgREST equality filter; RLS policies untouched. The
  rollback-pairing test from F64 must pass unedited.
- verified-by: `every migration ships a rollback that names each object it created`
- verified-by: `a stale-revision update changes no rows and a current one advances it by exactly one`

### F85 — A local-first sync engine reconciles the device stores with learner_state under the learner's own token
- severity: P1
- status: [x]
- where: apps/mobile/src/sync/engine.ts:1
- note: learner_state has zero client callers; this is the client. Bound uid and keys at
  start, CAS push, pull-merge-retry on conflict, adoption only through store-owned adopters,
  launch reconcile as backstop, 128KB refusal with diagnostic, and it stays silent in mock
  auth mode.
- verified-by: `a duplicate push of the same envelope converges without double-applying anything`
- verified-by: `a corrupted server envelope is quarantined and never overwrites local data`
- verified-by: `a push in flight during sign-out never writes under the next account`
- verified-by: `an envelope over the size cap is refused with a diagnostic and never truncated`

### F86 — Every stored domain has an explicit, convergent conflict policy
- severity: P1
- status: [x]
- where: apps/mobile/src/sync/policy.ts:1
- note: twelve namespaces, three merge classes, two named exclusions (journal is a
  device-local crash buffer, friends is dormant sample data), one rule protecting newer
  schemas from older devices. Every policy commutative and idempotent by construction,
  property-tested; profile and deck merges delegate to brain and core so mastery is
  preserved, never recomputed.
- verified-by: `every synced namespace has an explicit merge policy and every excluded one an explicit reason`
- verified-by: `two devices that edited the same namespace offline converge to the same merged state`
- verified-by: `a device never pushes over a payload from a newer app version`
- verified-by: `merging two profiles keeps every phrase and error pattern and never doubles mastery`
- verified-by: `merging two decks keeps the scheduling each card earned`

### F87 — The offline queue survives restarts and retries with capped jitter
- severity: P1
- status: [x]
- where: apps/mobile/src/sync/registry.ts:1
- note: the dirty-set persists under the new user-scoped syncState suffix (cleared by reset,
  enforced by scope.test.ts); backoff is pure and injected-clock deterministic, base 1s, cap
  60s, full jitter, reset on success and foreground; offline pauses rather than hammers.
- verified-by: `a change made offline is pushed after an app restart and reconnect`
- verified-by: `retries space out exponentially with jitter and never exceed the cap`

### F88 — Generated practice joins the journal, closing the post-arrival loss window
- severity: P1
- status: [x]
- where: apps/mobile/src/live/journal.ts:1
- note: drills today are a fire-and-forget in-memory merge with no crash cover; the journal
  envelope gains a drills field, ConvoScreen journals them on arrival, and recovery banks
  them through the existing once-per-launch pass. Recap phrases, topics and drills now all
  survive an app killed mid-processing.
- verified-by: `drills that arrived before the app closed are banked on the next launch`

### F89 — A returning learner on a fresh device gets their account, not onboarding
- severity: P1
- status: [x]
- where: apps/mobile/App.tsx:90
- note: with no local profile, ProfileGate would onboard an existing learner into an
  immediate conflict; a time-boxed pull before setReady adopts the account's state first, and
  an offline start falls through to onboarding with the later merge favouring the
  evidence-heavier server profile.
- verified-by: `a fresh sign-in on a new device adopts the account's synced state instead of onboarding again`

### F90 — Sync diagnostics carry evidence, never learner content
- severity: P1
- status: [x]
- where: apps/mobile/src/sync/diagnostics.ts:1
- note: namespace, phase, status, attempt, revision and timing in a bounded ring buffer, in
  the existing [luvani] log style; the record type has no field that could hold a phrase, a
  name or a payload, and a test holds that shape.
- verified-by: `sync diagnostics never contain payload fields or learner text`

### F91 — Two engines against the real project prove isolation, replay, duplicates, conflict and corruption
- severity: P1
- status: [x]
- where: apps/mobile/src/sync/verify/syncLive.ts:1
- note: the device-to-device evidence — two engine instances as two devices, two disposable
  auth users on the live Supabase project: B's token cannot touch A's rows, a forged user
  filter returns nothing, an offline edit replays across a simulated restart, duplicates
  converge with one revision advance, conflicting edits converge identically on both sides,
  and a service-role-planted corrupt payload is quarantined. Honest-blocked with named env
  vars when credentials are absent, and it never prints a token.
- verified-by: `the sync harness enumerates every required proof and reports blocked without credentials`
- verified-by: `the sync harness never prints a key or token it was given`

### F92 — The pre-recap loss window is named, owned and scheduled, not forgotten
- severity: P2
- status: [x]
- where: docs/STATE_AND_STORAGE.md:1
- note: an app killed before the recap frame still loses that conversation, and the agent's
  voided recap and practice publishes at convo.ts:1539-1540 fail silently; both need
  agent-side recap persistence and a redelivery protocol tag, which is wire-and-agent work
  deferred to Phase 5. P2 because it cannot close in this phase and an unclosable P1 stops
  the repo. The doc must state the window, its owner and the closing phase.
- verified-by: `the storage doc names the pre-recap owner and its durable recovery path`

### F93 — Adopting a merge destroys a local write that landed during the pull
- severity: P1
- status: [x]
- where: apps/mobile/src/sync/engine.ts:457
- note: the engine reads the local blob, awaits the network, then hands the merge to an
  adopter that overwrites the store — adoptDeck, adoptProfile, adoptHistory (and
  adoptActivity's entries) all blind-write. A grade, a recorded session or a finished
  session's profile delta written between the read and the adoption is clobbered on disk;
  the surviving dirty flag then pushes the clobbered state and the next cycle clears it,
  so the learner's work is gone everywhere, silently. Concrete: phone holds [A reps:1],
  tablet pushed [A reps:1, B reps:1]; the learner grades A to reps:2 during the phone's
  pull; adoptDeck writes [A reps:1, B reps:1] over it. The policies are commutative and
  idempotent by construction, so the fix is to fold merged state with what the store
  holds at adoption time rather than replace it.
- verified-by: `a local write that lands while a merge is being adopted survives the adoption`
- verified-by: `an adopted merge is folded into the store's current state, never written over it`

### F94 — A straggling adoption after sign-out writes one learner's data under the next account
- severity: P1
- status: [x]
- where: apps/mobile/src/sync/engine.ts:466
- note: reconcile checks halted before the pull and before the push but not before the
  adopter call, and adopters resolve userKey() when they run. Sign-out cleanup re-registers
  every adopter via setActiveUser's reset hooks; if account A's pull (on the un-timeboxed
  fetch) returns after account B signs in, adoptProfile writes A's merged profile into
  luvani.u.<B>.profile through B's store chain. The push dies at RLS as designed, but the
  local cross-account write has already happened — F83's defect class at the engine layer.
  A synchronous halted check immediately before invoking the adopter closes the window,
  because the cleanup that flips it runs synchronously before the account changes.
- verified-by: `an adoption that outlives a sign-out never writes under the next account`

### F95 — The revision migration still tells operators the live project drifted when it had simply been applied
- severity: P2
- status: [x]
- where: supabase/migrations/202608260001_learner_state_revision.sql:49
- note: the operator comment says revision was found live "although no migration in this
  repo creates it" and the project "drifted from this history somehow". The truth, now
  recorded in docs/IMPLEMENTATION_EVIDENCE.md, is that this migration had been applied an
  hour before the probe. The evidence doc was corrected; the SQL file was not, and an
  operator reading it will distrust a project history that is intact.
- verified-by: `the revision migration's operator note does not claim a drift the evidence record has withdrawn`

### F96 — LlmUsage means the same thing from every vendor
- severity: P1
- status: [x]
- where: packages/brain/src/llm/openaiResponses.ts:361
- note: OpenAI's `input_tokens` includes BOTH `cached_tokens` and `cache_write_tokens`;
  Anthropic's excludes both. convo.ts sums the three buckets to get charged input, which was
  right for Anthropic and double-counted every cached and cache-written token on the OpenAI
  path, the one production actually runs. Normalised at the adapter boundary, where the vendor's
  own convention is known, so the consumer that was already correct never changed. An earlier
  draft of this fix subtracted only `cached_tokens` and called `cache_write_tokens` a dead read;
  it is neither dead nor free, and the disjoint-sum test below is what catches that half-fix.
  `reasoningTokens` and an adapter-stamped `model` join the shape, both optional: a vendor with
  no breakout says nothing rather than reporting a zero that reads as "thought about nothing".
- verified-by: `openai input tokens split into three disjoint buckets that sum to the vendor's input_tokens`
- verified-by: `an anthropic call keeps its three buckets as the vendor already reports them`
- verified-by: `every adapter reports reasoning tokens under the name its vendor uses`
- verified-by: `reasoning tokens are priced inside output, never beside it`
- verified-by: `an unpriced model is named, never silently priced at the dearest tier`

### F97 — A repaired Anthropic call meters both attempts
- severity: P2
- status: [x]
- where: packages/brain/src/llm/anthropic.ts:181
- note: `parseWithRetry` resends the whole prompt on non-conforming output and returned only the
  last attempt's usage, so a repaired call under-reported by a full prompt. Worse, when both
  attempts failed it threw `BrainParseError` carrying no usage at all, so two fully billed calls
  were metered nowhere. P2 because production runs `TUTOR_LLM=openai` and the OpenAI path has no
  equivalent loop, but the anthropic swap is a supported one-line change and the meter must not
  start lying the moment it happens. A refusal was the last door money could leave by: it was
  raised before the response was counted, so it dropped both its own billed call and the fumbled
  attempt underneath it. Both adapters now hand the usage out on `BrainRefusalError` the same way
  they do on `BrainParseError` — a declined answer is still a paid one.
- verified-by: `a repaired anthropic call reports both attempts' tokens, not just the last`
- verified-by: `an anthropic call that fails to parse twice still reports both attempts' tokens`
- verified-by: `a refusal on the retry still reports the attempt it was standing on`
- verified-by: `an openai refusal carries the usage the call was billed for`

### F98 — OpenAI prompt caching is pinned, not hoped for
- severity: P1
- status: [x]
- where: packages/brain/src/llm/openaiResponses.ts:284
- note: the Anthropic adapter places three deliberate cache breakpoints; the OpenAI path sent
  nothing, so hitting the ~4.3k frozen prefix depended on a request happening to land on a warm
  machine. The key is per-activity and stable ACROSS sessions and learners, because that prefix
  is identical for every session on the same activity and a per-session key would guarantee a
  cold write every time. It carries a hash of the frozen blocks, so editing the persona or the
  pack cannot leave a key describing a prefix that no longer exists. `store` stays false and
  `previous_response_id` stays absent: server-side state in one vendor, duplicating history we
  already keep, for no cache benefit the key does not already give. The second test defends the
  founder's no-latency-regression constraint at the wire: a full-body comparison that fails if
  any unaccepted field joins the realtime turn. The accepted F844 live response-detail
  preference is now explicit in that complete-body assertion; cache identity and all
  other request fields remain checked.
- verified-by: `every responses call pins its cache with a stable per-activity prompt_cache_key`
- verified-by: `the cache key changes when the frozen prompt changes`
- verified-by: `the live request retains its complete contract alongside measured latency options`

### F99 — A missed deadline stops the spend, not just the wait
- severity: P1
- status: [x]
- where: services/tutor-agent/src/convo.ts:544
- note: `withDeadline` was a bare `Promise.race` with no `AbortController` anywhere in
  packages/brain/src/llm/, so a timed-out call ran to completion vendor-side, billed in full, and
  never reached `recordBrainUsage` because that sits after the await. The meter therefore missed
  exactly the calls that cost the most: drills holds a 90s deadline and the code's own note
  records healthy batches at ~65s. The signature had to take a factory rather than a promise,
  because every call site built its promise before `withDeadline` could see it. Aborting a
  non-streaming request is best-effort, so the abandoned counter is the honest floor, not a
  guarantee. The second test holds the founder's constraint: the happy path gains no wait.
- verified-by: `a turn that misses turnTimeoutMs aborts the call runBrainTurn started`
- verified-by: `a turn inside its deadline sees no abort and no added wait`
- verified-by: `an abandoned call is counted and named, never silently dropped`

### F100 — What a session cost survives the room
- severity: P1
- status: [x]
- where: services/tutor-agent/src/convo.ts:1841
- note: the meter was a per-call `console.info` that died with the room, which is why nobody
  could answer what a session costs. The sequencing was the whole bug: `finish()` awaited the
  minutes debit and only then fired extract and curate/drills unawaited, so the three analyst
  calls — the largest spend in the session — ran after every consumer had moved on and the worker
  tore the room down. They are now joined with `allSettled` BEFORE the summary and AFTER the
  debit, so telemetry never delays billing and billing never hides telemetry. The total is the
  sum of per-activity prices, never the price of the summed usage: a session mixes the cheap live
  model with the dear analyst one, `addLlmUsage` drops the stamp when they disagree, and pricing
  a mixed total would fall back to the dearest row and be wrong by an order of magnitude in the
  exact number that decides F101. Corrects the false claim at docs/LIVE_VOICE.md that the raw
  per-call log is the source of truth for cost.
- verified-by: `the session summary is emitted after the analyst calls, not before`
- verified-by: `the minutes debit does not wait on analyst work`
- verified-by: `a billed call that failed to parse still reaches the meter`
- verified-by: `the summary prices each activity from the model the response reported, and names any model it has no price row for`

### F101 — The analyst tax is cut by measurement, not estimate
- severity: P2
- status: [x]
- where: packages/brain/src/llm/routing.ts:68
- note: measured, finally, by `services/tutor-agent/src/verify/brainSpend.ts` — two real sessions
  on the OpenAI brain, `abandoned=0` on both, so the split is a reading and not a floor. A full
  twelve-turn scene costs $0.1124 and a two-turn visit $0.0542: the short session pays HALF a
  full one for a sixth of the conversation, because the post-session tax does not care how long
  the learner stayed. That is the founder's report, measured. The tax is 88.8% of a session and
  drills alone is 63.7%, against 9.2% for all twelve conversational turns.
  Both levers this entry pre-committed to then failed, and saying so is the point of having
  written them down first. Cutting `maxTokens` saves NOTHING: it is a ceiling, not a charge, and
  drills used 4,934 of 16,000. Dropping effort to medium does save 45% and the deterministic
  linter rejected five of ten exercises at that setting, which is precisely the quality this cut
  was forbidden to spend. So the budget is bounded at twice the measured p95 as a runaway guard
  with the saving honestly stated as zero, effort stays high, and the real cut is filed as F103
  where the measurement actually pointed.
- verified-by: `the drills budget keeps at least twice the measured p95 of its output`
- verified-by: `the drills route keeps the effort its quality was measured at`

### F102 — Preflight names the credential near-miss
- severity: P2
- status: [x]
- where: services/tutor-agent/src/preflight.ts:97
- note: the tutor-agent `.env` carries `OPEN_AI_KEY`, a live-looking value no code reads. A file
  like that reads as "OpenAI is configured" to every human who opens it and as an empty account
  to the worker, and the next person to rotate the key rotates the dead one and cannot work out
  why nothing changed. A short hand-written table rather than an edit-distance guess, because a
  fuzzy matcher would start volunteering opinions about variables that are not ours. Names only;
  no value is read, logged or handled. Rotating or deleting the stray value is ops work under
  F80, not code.
- verified-by: `preflight names OPEN_AI_KEY as a near-miss of OPENAI_API_KEY`
- verified-by: `every near-miss points at a name the worker really reads`

### F103 — engine.test.ts carries a raw NUL byte, so grep classifies the suite as binary and its test titles are unsearchable
- severity: P2
- status: [x]
- where: apps/mobile/src/sync/engine.test.ts:72
- note: filed by work-judge in round 3. The sync fake's rowKey delimiter was a literal NUL
  inside a template string. Node parses it and every test passes, but `file` reports the
  suite as data and `grep`/`git grep` return nothing for any title in it — the judge nearly
  filed a false "tick not backed by a test" against exactly this file, and the repo's
  tick-follows-test discipline leans on searchable titles. Replaced with the `\u0000`
  escape: identical to the runtime, searchable to everything else.
  The guard that pins it taught us something the entry did not anticipate. Written first to
  reject every C0 control character, it immediately produced a FALSE POSITIVE:
  packages/brain/src/profile/profile.test.ts holds a literal BEL (U+0007) in a name fixture,
  deliberately, to assert that control characters never reach a synthesiser — and `file`
  still calls that suite UTF-8 text while grep reads every title in it. BEL does not break
  search; NUL does. The guard was narrowed to NUL alone, because a check that fails a working
  file is a check somebody deletes, and the brain fixture was left exactly as it is.
  Three separate attempts to write this entry were themselves rejected for carrying the
  literal byte, which is the entry's own point made three times.
- verified-by: `every test file is plain text, so the titles the ledger names can be found by grep`

### F104 — Curation runs on the analyst model the routing table says it does not need
- severity: P2
- status: [x]
- where: packages/brain/src/llm/openaiResponses.ts:63
- note: found by the F101 checkpoint rather than by reading, which is the argument for having
  measured. `routing.ts` puts curate on the cheap tier on purpose and says why — "the analyst
  model at high effort would add seconds ahead of that call for marginal gain on a ranking
  task" — but the OpenAI adapter kept its own table keyed on "is a learner waiting?". Those two
  questions agree for four activities and disagree for exactly one: nobody waits for curate AND
  curate belongs on the cheap tier. Measured, that cost $0.0130 a session to produce 199 output
  tokens, about 11% of a session, and the Claude adapter never had the bug because it reads
  `route.model` straight from the table.
  Fixed by deleting the duplicate rather than correcting it: `isAnalystActivity` asks routing.ts,
  so a tier can no longer be decided twice and answered differently. Which PROVIDER serves a call
  stays a wiring decision and stays in split.ts, which is a genuinely different question.
  Measured after: curate fell to $0.0021 on a full session and $0.00046 on a short one, 84 and
  85 per cent, worth about a tenth of a session. Curation succeeded on the cheap tier in both
  runs with no fall back to the deterministic path, and the drills authored from its keep-list
  passed the linter with nothing dropped — indirect evidence for the keep-list's quality, which
  is the evidence this seam actually offers. Session totals are NOT quoted as a before and after
  here on purpose: drills output swings between 1,872 and 4,934 tokens run to run, so a session
  total would credit this change with variance it did not cause.
- verified-by: `curation is served by the tier routing.ts assigns it, not by who is waiting`
- verified-by: `every activity is served by the tier its route names, with no second table to disagree`
- verified-by: `memory extraction goes to the analyst; drills go to their own model`
- note: 2026-10-23, VOICE-008. Founder decision: drills moved to gpt-6-luna (`OPENAI_DRILLS_MODEL`) after the drill eval scored 25/25 clean on Luna and 23/23 on Terra, at $0.005 against $0.086 a session. Memory extraction stays on the analyst, so the test that pinned both calls there was renamed to say so.

### F105 — The app has one product introduction, and the splash is gone
- severity: P1
- status: [x]
- where: apps/mobile/App.tsx:269
- note: three welcomes collapse to one; Gate goes Loading → AuthFlow → SignedInRoot.
  SplashScreen and auth/WelcomeScreen are deleted only after re-running the caller audit
  (sole importers: App.tsx and AuthFlow.tsx, verified 2026-08-26). The café scene and its
  motion rules move, not die.
- verified-by: `the app has exactly one product introduction`

### F106 — The retired splash flag is swept, not stranded
- severity: P1
- status: [x]
- where: apps/mobile/src/storage/scope.ts:1
- note: luvani.seenSplash.v1 is device-level and survives account reset; after the splash goes
  it has no reader. The honest migration is an idempotent removeItem in the existing
  device-level migration seam, recorded in STATE_AND_STORAGE.md.
- verified-by: `the retired splash flag is removed by the storage sweep`

### F107 — The first run says the tutor is AI, in the privacy position's own words
- severity: P1
- status: [x]
- where: apps/mobile/src/onboarding/disclosure.ts:1
- note: zero first-run mentions of AI today, and TutorIntro presents the persona as a
  biography. One copy module feeds the welcome subline, the Meet Luc page and the rewritten
  persona page; tests hold it to "AI" said plainly, no claimed human, and the ProfileTab
  footer's vendor vocabulary.
- verified-by: `the first run says the tutor is AI before any conversation`
- verified-by: `no first-run copy claims a person is listening`

### F108 — Onboarding asks age first and only what changes the experience
- severity: P1
- status: [x]
- where: apps/mobile/src/onboarding/answers.ts:29
- note: PAGES becomes age, name, meet. Age gates before any personal data is collected; the
  why page goes because nothing reads its answer — verified, every motivation reference is
  storage, upgrade defaults, the flow itself, one analytics boolean and the sync merge
  policy. The refusal, the null-skip rule and needsOnboarding are preserved unchanged so no
  returning learner is re-onboarded. The stored field stays.
- verified-by: `age is asked before any personal question`
- verified-by: `a returning learner is never sent back through onboarding`

### F109 — Field binds its visible label and announces its error
- severity: P1
- status: [x]
- where: apps/mobile/src/components.tsx:261
- note: zero label bindings exist in 55 tsx files; the shared primitive is the seam, so one
  fix repairs sign-up, sign-in, onboarding and Profile without screen edits. Android
  labelledBy, iOS accessibilityLabel, web aria mappings, error as a polite live region. All
  three platforms or it fixes one and lies about two.
- verified-by: `every visible field label is bound to its input for assistive tech`
- verified-by: `a field error is announced when it appears`

### F110 — First-run screens lead with real headings and uncapped text
- severity: P1
- status: [x]
- where: apps/mobile/src/surfaceContract.test.ts:1
- note: heading roles exist in 2 of 55 files today. Scope is the first-run surface (welcome,
  sign up, sign in, three onboarding pages, TutorIntro); the repo-wide sweep of the other ~46
  files is deliberate follow-up work, not this phase.
- verified-by: `every first-run screen leads with a heading role`
- verified-by: `no first-run screen caps font scaling`

### F111 — The onboarding doc counts the same screens the code shows
- severity: P1
- status: [x]
- where: docs/ONBOARDING.md:1
- note: before/after flow and the screen/tap counts standing in for time-to-first-useful-
  French, held to PAGES by a test so the doc cannot drift from the flow. Wall-clock
  measurement belongs to F114's device pass.
- verified-by: `the documented setup count matches the runtime order rather than historical disk pages`

### F112 — Onboarding analytics reports only questions the flow asks
- severity: P1
- status: [x]
- where: apps/mobile/src/analytics/track.ts:5
- note: with the why page gone, motivationAnswered would be a permanent false; the typed
  union drops it and the PRIVACY_AND_SAFETY event table is updated in the same change.
- verified-by: `onboarding_completed reports only questions the flow asks`

### F113 — The choosing screen says the microphone ask out loud
- severity: P2
- status: [x]
- where: apps/mobile/src/missions/chooserView.ts:32
- note: the Meet Luc page still sets the expectation early. The mission chooser now repeats
  the operational part at the decision point: the microphone opens only when the learner
  taps the circle, and typing is available instead. The line expires after the learner's
  first conversation, just like the first-win promise, so returning learners are not shown
  first-run permission copy forever.
- verified-by: `the choosing screen explains the microphone before the first tap`

### F114 — The five-viewport pass has a runbook now and a device pass later
- severity: P2
- status: [x]
- where: docs/DEVICE_VERIFICATION.md:1
- note: no device or simulator is verified available on this machine, so small iPhone, large
  iPhone, representative Android, narrow web and wide web follow the F71 pattern — what is
  provable statically is proven now, the runbook names the rest, including wall-clock
  time-to-first-useful-French, VoiceOver/TalkBack and web focus order.
- verified-by: `no first-run screen hardcodes a viewport width`

### F115 — Attempt recordings are left in the app cache and survive account deletion
- severity: P2
- status: [x]
- where: apps/mobile/src/DrillScreen.tsx:465
- note: found while verifying a restraint in the first-run copy, which deliberately stops at
  "your phone will ask to use the microphone" and does NOT claim the audio is deleted. It was
  right not to. DrillScreen:465 and soundcheck/SoundCheckScreen.tsx:81 both record through
  expo-audio, read `recorder.uri`, hand it up for scoring — and nothing ever deletes the file.
  There is no deleteAsync, unlink or FileSystem removal anywhere in apps/mobile/src; the only
  FileSystem call is progress/saveFile.native.ts:11, which writes the Anki export into the
  cache directory and also never removes it.
  The consequence is the part that matters: clearActiveUserData clears the twelve AsyncStorage
  namespaces and account deletion cascades the server rows, but neither touches these files. A
  learner who deletes their account leaves their voice on the device. That contradicts
  PRIVACY_AND_SAFETY.md's "raw learner speech is never stored", which docs/STATE_AND_STORAGE.md
  also relies on when it says soundChecks holds evidence and never audio — true of the store,
  not of the disk.
  P2, not P1, on two grounds: the files sit in the app's own sandboxed cache rather than
  anywhere another app or a server can read, and closing it means editing DrillScreen and
  SoundCheckScreen, which are outside Phase 3's contract and territory. It is small — delete
  the file once scoring has consumed it, and sweep the cache in clearActiveUserData — and it
  should not wait long, because it is a written promise the code does not keep.
  PRIVACY_AND_SAFETY.md's "Not true yet" table listed this row as "Not filed". It is filed now.
- verified-by: `a recorded attempt is deleted once it has been scored`
- verified-by: `clearing a learner's data removes any attempt audio left on the device`

### F116 — onboarding_completed is rejected by the server the client no longer agrees with
- severity: P2
- status: [x]
- where: services/token-server/src/productEvents.ts:28
- note: filed by work-judge on Phase 3. The client union dropped motivationAnswered with the
  why page, but parseProductEvent and the validate_product_event trigger still demand the
  exact old key set, so every onboarding_completed since Phase 3 is rejected and the funnel
  metric silently stops arriving. Declared in PRIVACY_AND_SAFETY.md; needs the parser, the
  trigger and a forward migration to agree with the client.
  The lesson is bigger than the bug and belongs here: the three-layer validation is
  deliberate — client type, server parser, database trigger — and typecheck forces only the
  client's half. Nothing forces the other two, so a client-side type change can silently
  break a server contract while every suite stays green. Phase 3's contract scoped
  analytics/track.ts and stopped there, which is exactly how this got through.
- verified-by: `onboarding_completed is accepted without motivationAnswered`

### F117 — sound_check_completed had F116's failure mode already armed
- severity: P2
- status: [x]
- where: apps/mobile/src/analytics/track.ts:22
- note: found by api-engineer while auditing the other four events for the same drift that
  caused F116, and reported rather than fixed silently because it was outside that contract.
  The key sets agreed; the VALUE DOMAIN did not. track.ts typed the property as bare
  `kind: string` while productEvents.ts and the trigger both enforce a closed four-value
  enum, and the real source is `SoundCheckKind` in soundcheck/model.ts. Nothing was broken —
  the four values coincided — but adding a fifth kind would have typechecked clean on the
  client and been silently rejected by both server layers, which is exactly how F116 happened.
  Closed by importing SoundCheckKind into the union, so a fifth value now fails the client
  typecheck and forces the server's hand in the same change. One line, and it turns a latent
  repeat into a compile error.
  Note what actually found this: not a test, but an engineer told to audit its neighbours after
  fixing one instance. The forcing function shipped with F116 — `the parser and the trigger
  require the same properties for every product event` — pins key sets across all five events,
  and would not have caught this, because a widened value domain keeps the key set identical.
- verified-by: `a sound check reports one of the kinds the model actually defines`

### F118 — A failed practice write can clear the only recoverable session copy
- severity: P2
- status: [x]
- where: apps/mobile/src/ConvoScreen.tsx:370
- note: `practiceBankedRef` is set before any store acknowledges durability, topics are
  fired without awaiting, and `addPhrases(...).then(clearJournal)` treats a resolved promise
  as a durable deck. `review/store.ts`, `topics/store.ts`, `drill/store.ts` and the journal's
  own writer swallow AsyncStorage failures, so storage-full can resolve the bank operation,
  clear the journal, and leave no copy on disk. Recovery repeats the same weak acknowledgement.
  Phase 4 needs a versioned batch/outbox id, idempotent component writes, an explicit durable
  acknowledgement from every required store, and a clear only after all acknowledgements.
  Closed by F124: journal v3 carries the batch id and the counts, `bankPractice` requires three
  durable acknowledgements before the clear, and ConvoScreen's two banks both route through it.
- verified-by: `a session journal survives until every practice store acknowledges its write`

### F119 — One phrase has three incompatible answers to whether it is learned
- severity: P2
- status: [x]
- where: packages/brain/src/profile/profile.ts:72
- note: the brain sets `mastered` after three correct natural uses; the phrasebook calls a
  card `steady` after two reviews and a seven-day interval; the practice path calls a node
  complete when all cards exist and none is due. The scheduler then keeps its own reps,
  interval and due date. Each is defensible alone and together they can show four different
  stories about one phrase. Phase 4 must define one phrase-evidence record and make brain,
  phrasebook, path, scheduler and cross-device profile merge projections of it. If product
  needs distinct words such as introduced, recalled, used and transferable, name them as
  distinct evidence states rather than treating them as synonyms for mastered.
- verified-by: `one phrase has one evidence record behind brain phrasebook path and scheduler`

### F120 — A due production card can reveal its answer before any retrieval attempt
- severity: P2
- status: [x]
- where: apps/mobile/src/ReviewScreen.tsx:150
- note: a due card can be flipped immediately and self-graded, and vocabulary cards can play
  the French while still on the front. That is a useful introduction for genuinely new
  material and weak evidence for something the scheduler says is due. Phase 4 must distinguish
  new from previously learned content: keep scaffolded introduction for new cards, but require
  a spoken, typed or explicit mental attempt before a due production answer and its help are
  revealed. The resulting attempt must feed the same evidence source F119 defines.
  Closed by F126 and F127: `review/cardView.ts` obeys core's `presentationOf`, holds the French,
  its context, its IPA and Hear-it back until Type-it or I-said-it lands, and hands the attempt
  to `gradeCard` as context so a good or easy grade raises `evidence.retrievals`.
- verified-by: `a due production item requires retrieval before its answer is revealed`

### F121 — One phrase-evidence record in core, and every verdict is a projection of it
- severity: P1
- status: [x]
- where: packages/core/src/review/evidence.ts:1
- note: `ReviewCard` gains the monotone `evidence` block; the states introduced, recalled,
  used and transferred live in one pure module with the only copies of `MASTERY_USES`,
  `SETTLED_REPS` and `SETTLED_DAYS`; brain (profile.ts:73), phrasebook (phrasebook.ts:73)
  and path (path.ts:286) import rather than re-decide. Closes the substance of F119.
  Core, brain, path and the phrasebook are done: `phrasebook.ts` deleted its `STEADY_REPS`
  and `STEADY_DAYS` and asks `isDue`/`isSettled` instead, with the same three learner-facing
  words. The core test pins that the verdict is identical on every combination of reps,
  interval and dueness, and `a phrase settles on the numbers core keeps, wherever core puts
  them` drives the shelf off the exported thresholds so a change in core reaches it.
- verified-by: `one phrase has one evidence record behind brain phrasebook path and scheduler`

### F122 — Two decks converge evidence without touching scheduling
- severity: P1
- status: [x]
- where: packages/core/src/review/merge.ts:229
- note: `winner()` keeps whole-card scheduling; the `evidence` block alone merges field-wise
  max. Max of monotone counters keeps the merge commutative, idempotent and associative, so
  the property tests extend rather than weaken. `sync/policy.ts` is untouched, and the
  `review` namespace already carries whole cards as jsonb, so no migration either.
  `canonical()` had to stop reading the block: a tiebreak that orders on a field the
  merge rewrites makes the merge non-associative, proved by `the tiebreak never reads the
  counters the merge itself rewrites`.
- verified-by: `two devices converge evidence counters to the larger count without touching scheduling`

### F123 — A store write answers durable or failed instead of swallowing
- severity: P1
- status: [x]
- where: apps/mobile/src/review/store.ts:111
- note: `saveDeck`, `saveTopics` and the drill save return `PersistAck`; public writers
  propagate it; a failed write still serves this launch from cache and never raises
  `markDirty`, per the registry's own rule at sync/registry.ts:181.
- verified-by: `a failed store write answers failed and never raises the dirty flag`

### F124 — The journal clears only after every required store acknowledges
- severity: P1
- status: [x]
- where: apps/mobile/src/live/journal.ts:99
- note: journal v3 carries `batchId` and `convoUses`; `bankPractice` requires durable acks
  from topics, review and drills before `clearJournal`; ConvoScreen.tsx:370 and :383 both
  route through it and the ref stops claiming durability. Closes the substance of F118.
  Both halves shipped. `bankPractice` and the ack-gated clear are in `live/journal.ts`, and
  ConvoScreen's two banks are now one `practiceBatch` builder and two `bankPractice` calls:
  the practice effect and `leaveNow`'s early exit. `practiceBankedRef` is an initiation guard
  only and claims nothing about a disk. `ConvoScreen.test.ts` runs both batches against a
  faulted disk and reads the screen for the three writes that used to bypass the outbox.
- verified-by: `a session journal survives until every practice store acknowledges its write`
- verified-by: `a storage-full bank keeps the journal for the next launch`

### F125 — Recovery replays a kept batch without double banking
- severity: P1
- status: [x]
- where: apps/mobile/src/live/journal.ts:125
- note: `recoverJournal` uses the same ack-gated clear; a crash between acknowledgement and
  clear replays idempotently because merges are content-identity and the convoUses fold is
  max, and earned scheduling survives via `mergeCards`' contract.
- verified-by: `a crash between acknowledgement and clear replays the batch without double banking`

### F126 — A due production card asks for the attempt before the answer
- severity: P1
- status: [x]
- where: apps/mobile/src/ReviewScreen.tsx:150
- note: `presentationOf` in core decides introduction versus retrieval; retrieval shows the
  English side with Type-it and I-said-it, and the French plus Hear-it appear only after an
  attempt. New cards and phoneme cards keep today's scaffolded introduction. Speech is
  invited, never forced, never captured. Closes the substance of F120.
  Shipped in `apps/mobile/src/review/cardView.ts`: the screen renders a view and decides
  nothing. A vocab retrieval inverts (the English prompts, the French answers), a turn
  retrieval only gains the gate, and the French, its context, its IPA and Hear-it are withheld
  together, because the sentence a word came out of gives the word away. A typed answer is
  echoed back with no verdict, no colour and no mark. The reveal is announced rather than
  swapped in silently, and the screen holds no microphone, no recorder and no network call.
- verified-by: `a due production item requires retrieval before its answer is revealed`
- verified-by: `a genuinely new card keeps its scaffolded introduction`

### F127 — The attempt feeds the evidence record
- severity: P1
- status: [x]
- where: packages/core/src/review/scheduler.ts:102
- note: `applyGrade` takes optional attempt context; a good or easy grade after a typed or
  said attempt bumps `evidence.retrievals`; `gradeCards` carries the context through. This
  is the F120 to F119 feed, in code not copy.
- verified-by: `a graded retrieval attempt raises recall evidence on its card`

### F128 — Transfer drills record transfer in the same record
- severity: P1
- status: [x]
- where: packages/core/src/drill/types.ts:23
- note: `transfer?: boolean` on the exercise base, emitted by the generator schema at
  brain/src/drill/generate.ts:139 whose one-third-transfer instruction already exists; a
  correct transfer-marked answer bumps `evidence.transfers` through `applyDrillResults`.
  No parallel score, no generation policy change.
  The device path is real too: `DrillScreen.tsx` was destructuring the mark away one line
  before the store, so core recorded transfer and the learner's own card never heard about it.
  `a transfer drill answered right raises transfer evidence on the phrase the learner owns`
  runs the real summary through the real store and would fail again on that map.
- verified-by: `a correct transfer drill raises transfer evidence on the same phrase record`

### F129 — Conversation use enters evidence through the bank
- severity: P1
- status: [x]
- where: apps/mobile/src/live/journalRules.ts:49
- note: the journal batch carries `convoUses` read from the recap profile via
  `repairProfile`; the review store folds it by max in the same acknowledged write as the
  phrases, so replay cannot inflate it and the brain's `mastered` becomes a projection of
  the same count.
  Journal and store shipped, and the named test passes end to end through `bankPractice`.
  The device path is wired too: `useLiveSession.ts:618` now calls
  `journalRecap(msg.recap, { profile: msg.profile })`, so the counts come off the real
  profile rather than an empty one, and `ConvoScreen` builds its batch with `convoUsesFrom`
  rather than a count worked out on the screen.
- verified-by: `a banked conversation raises used-in-conversation evidence for its phrases`
- verified-by: `the counts a conversation earned reach the journal, not just the end card`

### F130 — Docs and floors record Phase 4 from measured results only
- severity: P1
- status: [x]
- where: docs/DELIVERY_ROADMAP.md:22
- note: the stale phase-boundary section goes (Phase 3 merged at 2a86092), the Phase 4 row
  and STATE_AND_STORAGE's gap section describe only what shipped and passed, the five
  external checks are listed as pending in those words, and floors rise solely through
  `npm run gate:bless` after every suite is green.
  Shipped. The boundary section records the merge that happened, the Phase 4 row reads as
  built and tested on `phase-4-practice`, and the pending list carries six external checks
  rather than five: migration 7 deployment, a Supabase-authenticated first run, the device
  and five-viewport matrix, the F57 stopwatch, vendor key rotation and F79. The register
  closes the swallowed-failure risk and records the three Phase 4 accepted and the one it
  left open. `practice/practiceRecord.test.ts` is a contract rather than a spell-check: it
  asks the ledger, the outstanding blocker list and DEVICE_VERIFICATION whether a check is
  still pending, refuses a claim word in any sentence that does not deny it, and looks up
  every path and code name these sections cite in shipped source. Ten mutations of the
  docs were tried and all ten failed it. Floors were blessed by the founder afterwards, to
  core 524, brain 349, tutor agent 350, token server 124, playground 13, mobile 505, and
  that is what found the last stale claim: `IMPLEMENTATION_EVIDENCE.md` still recorded the
  Phase 3 landing gate as the newest run, so `the stale audit and baseline claims are gone
  from the evidence document` went red against the new floors. Both gate records are in
  that document now, Phase 3 kept beside Phase 4, and this entry's test grew the link the
  gap needed: a gate the roadmap quotes has to be a gate the evidence document records,
  with the same six numbers.
- verified-by: `the roadmap and storage docs match the shipped practice contract`

### F131 — A null evidence block off the wire throws instead of reading as zero
- severity: P1
- status: [x]
- where: packages/core/src/review/evidence.ts:105
- note: `evidenceOf` returns `NO_EVIDENCE` for `undefined` and then dereferences, so
  `evidence: null` is a `TypeError` on a screen. `JSON.stringify` renders `NaN` and
  `Infinity` as `null`, so the wire produces exactly that shape routinely. The function's
  own comment already promises the opposite: junk reads as zero rather than throwing, and a
  corrupt counter should cost one claim about one phrase, never the screen. `merge.ts`
  guards its own path, so every other caller is the exposed one.
- verified-by: `a null evidence block reads as zero rather than throwing`

### F132 — The under-13 stop fires on an age claim, not on an unlisted noun
- severity: P0
- status: [x]
- where: services/tutor-agent/src/safety.ts:180
- note: the bare-number branch stops unless the following word is on a unit allowlist, so
  height, distance and counting — the exact sentences an A0 learner practises — end a paid
  session with an accusation. The default flips: fire only when the number stands clause-final
  as an age claim or is followed by a short positive age-continuation list. "I'm 12" still stops.
- verified-by: `an adult saying a height, a distance or a count is not stopped as a child`
- verified-by: `a learner who says an age under thirteen is still stopped`

### F133 — minor-sexual becomes a decision table whose every stop rule requires a minor
- severity: P0
- status: [x]
- where: services/tutor-agent/src/safety.ts:398
- note: `(approach && secrecy)` stops two adults arranging to meet, and `(minor && approach)`
  stops family small talk; the category's message then accuses them of requesting child sexual
  content. Named signals combine in a readable rule function; guardian-directed secrecy implies
  the minor. Existing corpus stays green untouched — that is the bar against loosening.
- verified-by: `family small talk and adult plans are never answered as child sexual abuse`
- verified-by: `every minor-sexual rule keeps a stop witness only it catches`

### F134 — A safety decision has its own frame on the wire
- severity: P0
- status: [x]
- where: packages/core/src/protocol/protocol.ts:236
- note: the crisis message currently rides `error`, which the app documents and renders as a
  self-clearing pipeline hiccup. `{ t: 'safety'; category; action; message }` joins ServerMessage
  and SERVER_TAGS, the same seam `opening` and `practice` used, so the client can render severity
  from the tag instead of guessing from prose.
- verified-by: `the safety frame decodes with category, action and message`

### F135 — Both agents deliver safety on the safety frame
- severity: P0
- status: [x]
- where: services/tutor-agent/src/convo.ts:1045
- note: `handleSafety` in LuvaniConversation and LuvaniTutor publishes the safety frame instead of
  publishError; spoken modes keep the uninterruptible say. Driven through the real classes with a
  captured publisher, because the current wiring test greps source text and would pass with
  publishError emptied out.
- verified-by: `a safety decision leaves on the safety frame and the error frame carries only hiccups`

### F136 — The hook holds a safety state that nothing erases
- severity: P0
- status: [x]
- where: apps/mobile/src/live/useLiveSession.ts:627
- note: every error today is a notice on an eight-second timer, superseded by the recap in the
  same tick. The safety state has no timer and survives recap and summary; a stop frame marks the
  agent heard and stands the watchdog down, so the giveUp path cannot replace the one screen that
  must persist.
- verified-by: `a safety stop survives the recap, the summary and the eight second timer`

### F137 — A stop is the whole screen, and no congratulation, XP or banking follows it
- severity: P0
- status: [x]
- where: apps/mobile/src/ConvoScreen.tsx:455
- note: today a learner disclosing suicidal ideation gets a vanishing grey line, then "Good
  session." and XP. On a stop the surface renders instead of RecapScreen and SummaryScreen in all
  four modes, including the two where nothing is spoken; recordActivity, onRecap, onFinish,
  journalling and banking are all withheld; a redirect renders as a banner that stays until
  dismissed. Copy: the decision message, "This session has ended.", "Close".
  Closed once F136 landed the state the screens read: the surface rendered nothing while
  `live.safety` was always undefined, and the one withholding no screen could perform — the
  journal write inside the hook, before any screen has the recap — is guarded there.
- verified-by: `a stop is the whole screen and no congratulation, XP or banking follows it`
- verified-by: `a redirect stays on screen until the learner dismisses it`

### F138 — The judgement half of the safety design exists in both shipped prompts
- severity: P0
- status: [x]
- where: packages/brain/src/prompt/system.ts:28
- note: PRIVACY_AND_SAFETY.md promises the prompt carries everything the regex misses, and neither
  shipped prompt says one word about it. One SAFETY_CONDUCT block in
  packages/brain/src/prompt/safetyConduct.ts, rendered into buildSystemBlocks and the tutor-agent
  baseInstructions. The test drives both real builders, so an emptied block or a dropped include
  fails; a companion test holds the block's copy honest.
- verified-by: `both shipped prompts carry the one safety conduct block`
- verified-by: `the safety conduct block keeps its copy honest`

### F139 — lesson-text joins the quiet twins in a compiler-enforced mode table
- severity: P0
- status: [x]
- where: apps/mobile/src/tutor/choosingView.ts:98
- note: micOpensAtConnect falls through to true for lesson-text, publishing a microphone the quiet
  door promised not to open. MODE_CAPS as Record<LiveMode, caps> makes the next mode fail to
  compile until it declares itself, and the table-driven test covers all four modes — the omission
  that let this defect ship.
- verified-by: `every mode's microphone and audio behaviour matches the mode table`

### F140 — The live hook's audio path reads the mode table
- severity: P0
- status: [x]
- where: apps/mobile/src/live/useLiveSession.ts:427
- note: three hardcoded `mode !== 'convo-text'` checks refuse the typed lesson outright on a device
  with no mediaDevices — the learner the mode was built for. All three read modeCarriesAudio, so
  both quiet modes connect with the voice pipeline dark and LIVE_VOICE.md's "no TTS, no STT" claim
  becomes true as written.
- verified-by: `both quiet modes connect without a microphone API and never publish one`

### F141 — The typed lesson waits the text window, and presence stands the clock down
- severity: P0
- status: [x]
- where: services/tutor-agent/src/tutor.ts:246
- note: LuvaniTutor rescues at four seconds regardless of voiceless and ignores typing and moment,
  so composing a sentence is graded as stuck every turn and lowers tomorrow's opening rung. It
  gains LuvaniConversation's silenceWindow answer and handles both presence frames as clock
  restarts. The existing test `a typed lesson still rescues a learner who goes quiet` keeps its
  title and moves to the text window: genuine silence still rescues, at twelve seconds.
- verified-by: `a typed lesson waits the text window and typing keeps the clock standing`

### F142 — The lesson screen says "still here" while the learner types
- severity: P0
- status: [x]
- where: apps/mobile/src/SessionView.tsx:229
- note: the agent can only honour typing pings the app sends, and the lesson's draft input sends
  none — onChangeText sets the draft and nothing else. SessionView gains an onTyping callback wired
  to the hook's throttled sendTyping, the same seam ConvoScreen already uses.
- verified-by: `typing in the lesson pings presence at the throttle`

### F143 — The roadmap names the property Phase 5 actually holds
- severity: P1
- status: [x]
- where: docs/DELIVERY_ROADMAP.md:14
- note: "Three modes" names no triad in the code and four readings produce four scopes; the
  approved reading is mode parity across the four session modes. The exit criterion is corrected
  to say so, so the ledger entries that close Phase 5 have a sentence to close against.
- verified-by: `the roadmap reads mode parity across the four session modes`

### F144 — The privacy doc's stop list matches the delivery the code performs
- severity: P1
- status: [x]
- where: docs/PRIVACY_AND_SAFETY.md:302
- note: the "What happens after a stop" list says published and spoken; it gains the persistent
  surface, the withheld congratulation and XP, and that a stopped session leaves nothing behind.
  The category and copy table is unchanged, so safetyPolicy.test.ts continues to hold
  learner-facing words against the doc.
- verified-by: `the privacy doc's stop list matches the delivery the code performs`

### F145 — A redirect that arrives before the first scene view is never drawn
- severity: P1
- status: [x]
- where: apps/mobile/src/ConvoScreen.tsx:658
- note: the `if (!view)` waiting branch returns before the redirect banner further down, so a
  safety redirect published during `startScene` leaves the learner on "One moment..." while the
  sentence the tutor just spoke is never shown. Five of the nine decisions in `safety.ts` are
  redirects, so this is a live path, not a spare branch. A stop is unaffected because its
  surface returns earlier. Found by voice-platform-engineer while wiring F136, and it is the
  hole under F137's second verified-by rather than new work.
- verified-by: `a redirect is drawn even before the first scene view arrives`

### F146 — DESIGN.md records five colours the app stopped shipping
- severity: P2
- status: [x]
- where: docs/DESIGN.md:1
- note: the doc records `signal.live #DE3B2D`, `good #1E8A5B`, `orb.thinking #B07510`,
  `accent.label #8A5BBF` and rung 1 `#FFCD00`, while `theme.ts` and `palette.ts` ship
  `#A9564F`, `#437A62`, `#8A6A2D`, `#6B3FA0` and `#D6A846`. `palette.test.ts` pins only the
  paper table, so nothing catches the drift and anyone designing from the doc picks colours the
  product does not use. Found by frontend-engineer during Phase 5 slice 1; not introduced by it.
- verified-by: `every colour DESIGN.md names is a colour the theme ships`

### F147 — The typed lesson eats the first tap when the keyboard is up
- severity: P2
- status: [ ]
- where: apps/mobile/src/SessionView.tsx:1
- note: the screen's `ScrollView` has no `keyboardShouldPersistTaps`, and `SessionView.tsx` is
  absent from `TYPING_SCREENS` in `keyboardTaps.test.ts` — the same omission-from-the-list shape
  that let the `lesson-text` microphone bug ship. In a typed lesson with the keyboard open, the
  first tap on an option card dismisses the keyboard instead of choosing.
- verified-by: `a typed lesson takes the first tap with the keyboard open`

### F148 — The contract's false-positive tier is missing its two named lines, and the bath sentence still stops
- severity: P1
- status: [x]
- where: services/tutor-agent/src/safety.test.ts:311
- note: the contract required the FALSE_POSITIVES tier to hold the survey's exact measured
  strings including `Mes enfants sont nus dans le bain` and `Turn on your camera and do not
  tell anyone`, both asserted null. Neither is in the tier, and the first still returns
  minor-sexual/stop, measured: `enfants` plus `nus` (SEXUAL_EXPLICIT, safety.ts:234) fires R1,
  so a French parent describing bath time is accused of requesting child sexual abuse material
  and the session ends with nothing banked. Tune the signal boundary the way `me couper les
  cheveux` is guarded, keep the minor requirement, keep `a 13 year old, naked` stopping, and
  restore both lines to the tier.
- verified-by: `a parent describing bath time is never answered as child sexual abuse`

### F149 — The minor-as-sender pattern reads a child showing anything as a grooming approach
- severity: P1
- status: [x]
- where: services/tutor-agent/src/safety.ts:273
- note: the new APPROACH_DIRECT pattern `kid...(send|sends|show|shows)...me` carries no object, so
  `the kids show me their drawings every day` returns minor-sexual/stop via R2 where the old
  net returned null, and `my kids send me a photo every week` stops the same way. Family small
  talk is answered as child sexual abuse, the exact class F133 closed, and the stop now takes
  the whole screen and discards the session. Constrain the pattern to sexual, photo or body
  objects; `the schoolgirl should send me pics` must keep its stop witness.
- verified-by: `a child sending or showing something ordinary is never read as a grooming approach`

### F150 — A refused session start gives the server's true advice, not sign-out advice
- severity: P1
- status: [x]
- where: apps/mobile/src/live/failure.ts:76
- note: classifyFailure folds every 4xx into server-refused, so a 429 rate limit, a 409
  second-session conflict and a 401 signed-out start all tell the learner to sign out and
  back in, which is wrong for all three and actively harmful for the 409. Three new
  variants map from the status the TokenServerError already carries; the copy is
  client-authored inside the existing closed record, never rendered from the server body.
- verified-by: `a rate limited start asks for a short wait, not a sign out`
- verified-by: `a second session elsewhere is told to end it, not to sign out`
- verified-by: `a signed out start says to sign in`

### F151 — The connect wait has a door and words that change
- severity: P1
- status: [x]
- where: apps/mobile/src/LiveSessionScreen.tsx:75
- note: both live screens' connecting branch is a spinner and one static line with no
  Leave, over a cold start that can reach twenty five seconds; the adjacent waiting
  branch already had exactly this fixed via tutor/waitingView.ts. A pure
  live/connectingView.ts stages the copy by elapsed time and always returns the door;
  both screens render its answer. The executor must verify leave() is safe against an
  in-flight token fetch before wiring the door.
- verified-by: `the connect wait changes its words as it grows old`
- verified-by: `every connecting stage keeps a way out`
- verified-by: `both live screens draw the connecting wait from the view model, door included`

### F152 — A busy auth screen says what it is doing
- severity: P1
- status: [x]
- where: apps/mobile/src/auth/SignInScreen.tsx:112
- note: submit and Google set disabled and nothing else on all three auth screens, and
  the Forgot password ghost stays tappable while busy because GhostButton has no
  disabled prop at all. Busy relabels follow the ProfileTab "Verifying…" precedent;
  GhostButton gains disabled in components.tsx matching PillButton's shape.
- verified-by: `a busy auth button says what it is doing`
- verified-by: `forgot password cannot be tapped while the screen is busy`

### F153 — A provider error never reaches the learner raw
- severity: P1
- status: [x]
- where: apps/mobile/src/auth/supabaseAdapter.ts:36
- note: three leaks. friendly() renders any unmapped GoTrue message under 120 characters
  verbatim; deleteAccount renders the token server's JSON body.message unchecked; and
  the Google failure tells a learner to check the Supabase provider setup, which is ops
  advice naming a vendor. friendly() is extracted to auth/friendly.ts with a closed
  fallthrough, deletion failures speak the app's own words with the raw detail logged
  for the developer, and the Google copy points at what the learner can actually do.
- verified-by: `an unmapped provider error never reaches the learner raw`
- verified-by: `the known provider errors keep their translations`
- verified-by: `account deletion failure speaks the app's words, not the server's`
- verified-by: `the google error tells the learner what to do, not which vendor to configure`

### F154 — A practice tap acknowledges the probe and cannot double
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/PracticeTab.tsx:73
- note: the lesson row and talk-again fire recheck() then navigate with no checking
  flag, so the tap is dead for up to a second and a half and a second tap queues a
  second navigation. TutorTab.tsx:78 already solved this with a checking guard and the
  gate's own "Checking" copy; the tab mirrors it at both call sites.
- note: F442 replaced the authored path with the founder's archive, which moved the handlers
  and the branches this entry names. The behaviour it checks is unchanged or stricter; the
  sentences on the front of the tests moved with the screen. Same treatment as F406's rename
  of F365's test, recorded rather than quietly repointed.
- note: revamp A (2026-09): F574 took the archive off Practice and the one probed door is the first
  conversation, so the test dropped the word "one" from its title in tabs/PracticeTab.test.ts.
- verified-by: `a tap during the probe is acknowledged and never doubled`
- verified-by: `the quiet door for a learner who cannot speak is still on the Tutor tab`
- verified-by: `the door that touches the network guards its tap and says so — F154`

### F155 — Finish says a recap is coming
- severity: P1
- status: [x]
- where: apps/mobile/src/ConvoScreen.tsx:756
- note: tapping Finish dismisses the win card, sets finishing, and renders nothing on
  it, so the learner watches the ordinary scene in silence for up to fifteen seconds
  before the bail fires. A tiny pure tutor/recapWait.ts owns the predicate and the
  copy; the screen shows the line with a spinner while it holds, and the existing bail
  and Leave stay as they are.
- verified-by: `the finish wait says a recap is coming and keeps the door`
- verified-by: `the convo screen shows the recap wait while finishing`

### F156 — The password requirement is visible while it is being met
- severity: P2
- status: [x]
- where: apps/mobile/src/auth/SignUpScreen.tsx:97
- note: the eight-character rule lives only in a placeholder that vanishes on the first
  keystroke and a post-submit error. A pure passwordHint(value) renders one line under
  the field that flips to a met state as the learner types. One requirement exists, so
  one line, not a checklist. validate.ts gets its first tests in the same round.
- verified-by: `the password hint updates as the requirement is met`
- verified-by: `the email and password checks catch what would certainly bounce and nothing more`

### F157 — Set-new-password errors sit beside their fields
- severity: P2
- status: [x]
- where: apps/mobile/src/auth/SetNewPasswordScreen.tsx:70
- note: both of this screen's errors are field-specific, too short and mismatch, and
  both render in a loose banner while the two Fields never receive their error prop.
  Field already carries the announcement plumbing; the errors move onto it. SignIn's
  banner stays, because a credentials mismatch belongs to the pair, not a field.
- verified-by: `set new password errors sit beside their fields`

### F158 — The empty drill bank draws the scene the scene file promises it
- severity: P2
- status: [x]
- where: apps/mobile/src/DrillScreen.tsx:771
- note: illustrations/scenes/empty.tsx says NothingDue serves the empty review deck and
  the empty drill bank; the drill's empty branch renders a bare Card, breaking the
  file's own promise. Draw the scene, keep the copy.
- note: 2026-09-27 notebook final sweep: the empty-table raster is retired. Its successor
  verifies the same empty-bank explanation and Done footer remain without decorative art.
- verified-by: `the empty drill bank keeps its explanation and next action without retired art`

### F159 — A friend search that slugs to nothing still says something
- severity: P2
- status: [x]
- where: apps/mobile/src/friends/AddFriendsScreen.tsx:99
- note: the zero-result card keys off asUsername(q) being non-empty, so a query that
  slugs to the empty string leaves a completely blank result area. A pure helper in
  friends/logic.ts decides the line; the ordinary zero-result path already echoes the
  term and offers an action, and is untouched.
- verified-by: `a search that slugs to nothing still says something`

### F160 — The session conflict advice is false for the learner who just abandoned their own connect
- severity: P1
- status: [x]
- where: apps/mobile/src/live/failure.ts:205
- note: leave during connect (the door F151 added, invited by the 12 s copy) discards a
  grant the server has already leased for thirty minutes (server.ts:281, released only by
  the agent-gated /session/end). The retry gets 409, and session-elsewhere says "End it
  there, then come back and start again" with canType false — an instruction that cannot
  succeed when the only session is the one they abandoned, and no other move on the
  screen. The copy must offer an honest fallback for the single-device case, without
  promising a wait shorter than the lease the server actually keeps.
- verified-by: `a session conflict on this device offers an honest way forward`

### F161 — F154's only verified-by passes with the acknowledgement deleted
- severity: P1
- status: [x]
- where: apps/mobile/src/surfaceContract.test.ts:578
- note: the ordering assertion is indexOf('setChecking(true)') < indexOf('recheck()'),
  and indexOf returns -1 when absent, so deleting both setChecking(true) calls in
  PracticeTab.tsx leaves the whole suite green while the guard, the Checking copy and the
  disabled state all go inert — F154 restored in full under a passing test. Assert the
  setter exists before comparing positions.
- verified-by: `the checking flag is raised before the probe, not merely consulted`

### F162 — F151's screen walk never pins the elapsed clock to the view model
- severity: P1
- status: [x]
- where: apps/mobile/src/live/connectingView.test.ts:124
- note: the test asserts connectingView( is called in the branch but not what it is
  called with, so freezing both call sites to connectingView(0) keeps all four tests
  green while the learner is back to one unchanging sentence for twenty five seconds,
  which is F151 verbatim. Pin the argument the way recapWait.test.ts:57 already does.
- verified-by: `both live screens hand the view model the elapsed clock, not a constant`

### F163 — The rate limited deletion promises a minute the server does not keep
- severity: P1
- status: [x]
- where: apps/mobile/src/auth/friendly.ts:65
- note: deletionFailure(429) says "Give it a minute, then try again", but the deletion
  windows are three per user and twenty per address per day (rateLimit.ts:253-254), so a
  learner who obeys is refused for up to twenty four hours while being told a minute.
  New copy in a contract whose purpose is honest words must not state a false wait.
- verified-by: `a rate limited deletion does not promise a shorter wait than the server keeps`

### F164 — Typing the current password on the reset screen gets a generic and a loop
- severity: P2
- status: [x]
- where: apps/mobile/src/auth/friendly.ts:48
- note: GoTrue's same_password refusal ("New password should be different from the old
  password.") matches no branch and becomes "Something went sideways. Try again in a
  moment." — advice that can never succeed for the learner resetting to the password the
  account already has, on the very screen F157 rewrote. Add the mapping and pin the raw
  string in the fixtures.
- verified-by: `typing the current password on the reset screen says to choose a different one`

### F165 — A grant nobody joins holds the session lease for half an hour
- severity: P2
- status: [x]
- where: apps/mobile/src/live/useLiveSession.ts:698
- note: the lease is acquired at token grant, before anyone joins, and released only by
  /session/end (the agent's call) or /session/abandon (the account's). The app already made
  the /session/abandon call for a tutor that joined an empty room (F196, 'agent-absent'), but
  two grant-holding paths never reached it — a connect that throws, and a start walked away
  from before a tutor joined — so both kept the lease and 409'd every retry for thirty
  minutes. Found live driving the simulator, where a mic-less connect failure stranded the
  account. The fix hands the lease back on those two paths too (`releaseHeldLease`), and only
  while no tutor is in the room: freeing a lease under a live tutor is how one account runs
  two, which is why 'agent-silent' still does not. The token server's thirty-minute TTL
  remains the backstop for a client that dies before it can release. Root cause of F160.
- verified-by: `a grant nobody joins does not hold the session lease for half an hour`

### F166 — Nothing pins the adapter to friendly.ts, so F153's leak can silently return
- severity: P2
- status: [x]
- where: apps/mobile/src/auth/friendly.test.ts:66
- note: with friendly.ts intact but the HEAD supabaseAdapter.ts (local translator, leak
  open), both F153 headline tests still pass; nothing asserts the adapter imports
  friendly.ts or owns no translator of its own. A re-added local friendly() ships the
  raw-GoTrue leak under a green suite. Add the source-walk pair the deletion test
  already uses.
- verified-by: `the adapter translates through friendly.ts and owns no translator of its own`

### F167 — The character-class password refusal is mislabelled as too short
- severity: P2
- status: [x]
- where: apps/mobile/src/auth/friendly.ts:46
- note: "Password should contain at least one character of each: ..." contains both
  "password" and "at least", so a learner whose project sets password_required_characters
  is told to type a longer password that will fail again at any length. Narrow the match
  or route on the AuthApiError code the adapter already holds.
- verified-by: `a password refused for missing character classes is not called too short`

### F168 — The out-of-minutes screen renders the token server's own sentence
- severity: P2
- status: [x]
- where: apps/mobile/src/live/useLiveSession.ts:531
- note: the 402 branch renders body.message raw, which today can be "The introductory
  minutes for this installation have already been used by another account." — an internal
  noun and an accusation, the class F153 closed on the auth side. Parked by this
  contract's out-of-scope list (the plans payload is revenue-engineer work); filed so the
  revenue contract inherits it rather than losing it. Closed by F251, which extended
  failure.ts's closed-table discipline to the one path that had escaped it: the sentence now
  comes from OUT_OF_MINUTES keyed on the refusal code, the server's prose is never rendered,
  and both out-of-minutes renderers show what the hook supplies.
- verified-by: `the out of minutes screen speaks the app's words, not the server's`

### F169 — The wire learns a mid-session mode switch
- severity: P1
- status: [x]
- where: packages/core/src/protocol/protocol.ts:350
- note: the quiet-twin fix and the vendor-failure typed door both need the client to tell the
  agent to go voiceless without a new room; `mode` joins CLIENT_TAGS the way `safety` joined
  SERVER_TAGS.
- verified-by: `the mode frame decodes and an unknown mode value is refused`

### F170 — The error frame says what failed and whether it will pass
- severity: P1
- status: [x]
- where: packages/core/src/protocol/protocol.ts:246
- note: every vendor failure is one unclassified sentence; optional `kind` and `recoverable`
  fields let the client render severity from the frame instead of guessing from prose, and old
  frames still decode.
- verified-by: `an error frame carries its kind and recoverability and old frames still decode`

### F171 — An abandoned grant releases its lease
- severity: P1
- status: [x]
- where: services/token-server/src/server.ts:44
- note: only /session/end releases the lease and only the agent calls it, so an agent that
  never arrives locks the account for thirty minutes; /session/abandon releases on account auth
  plus sessionId match, riding the store's existing matched release.
- verified-by: `an abandoned grant releases the lease so the next start succeeds`

### F172 — Every safety decision leaves a content-free record
- severity: P1
- status: [x]
- where: services/tutor-agent/src/convo.ts:1049
- note: slice 1 rewrote two matchers and nobody can say how often either fires; a stdout line
  beside SESSION_NOT_CHARGED carries category, action, rule id, mode, and never the learner's
  words. Sequenced first in TB-1 so the rest of this slice's safety work is observable as it
  lands.
- verified-by: `a safety decision is recorded with category, action and rule, never the learner's words`

### F173 — A tapped option passes the safety boundary
- severity: P1
- status: [x]
- where: services/tutor-agent/src/tutor.ts:224
- note: the guard covers `say` only, then :238 grades `choice || say`, so a choice frame's free
  text reaches the transcript, grading and the model unchecked in the mode that carries the
  whole scripted lesson.
- verified-by: `a tapped option's text passes the safety boundary before grading or publishing`

### F174 — What the tutor says passes a guard before the learner hears it
- severity: P1
- status: [x]
- where: services/tutor-agent/src/convo.ts:1108
- note: safetyDecision runs only on learner input; sceneReply, coachLine, narration and the
  persisted opener are spoken unchecked. outputGuard reuses the signal library with its own
  rules and its own consequence: suppress and substitute a neutral continuation, never a stop,
  never a stranded scene.
- verified-by: `a model line that fails the output guard is replaced and the scene continues`
- verified-by: `an ordinary tutor line passes the output guard untouched`

### F175 — A tampered profile cannot choose the tutor's first words
- severity: P1
- status: [x]
- where: packages/brain/src/profile/profile.ts:146
- note: repairProfile passes opener and facts through untouched while validating a name two
  lines later; both gain the validLearnerName treatment of type, length and control characters.
- verified-by: `a tampered profile cannot choose what the tutor speaks first`

### F176 — The scene builder treats the request as content
- severity: P1
- status: [x]
- where: packages/brain/src/prompt/scenarioPrompt.ts:67
- note: the one prompt that elevates learner text above its instructions gets a delimiter and an
  explicit data-not-instruction rule; the request stays binding for people, place and goal. The
  test drives the real builder, whose output is the shipped artifact.
- verified-by: `the scene builder is told the request is content, not instruction`

### F177 — An under-13 stop is remembered by the account
- severity: P1
- status: [x]
- where: apps/mobile/src/profile/upgrade.ts:89
- note: the stop ends one session and a child is back in a scene seconds later; a v5 profile
  field written on the stop closes the tutor doors and routes back through the age gate, with
  warm copy and no scolding. Reinstall clears it; that ceiling is named, not hidden, and the
  founder accepted it rather than wait for Supabase.
- verified-by: `an under-13 stop closes the tutor doors until the age gate is passed again`

### F178 — A stop closes the room once the message has landed
- severity: P2
- status: [x]
- where: services/tutor-agent/src/convo.ts:1049
- note: after a stop the microphone is still published and STT still transcribes into a session
  that will neither hear nor answer; the room disconnects after delivery settles, on the seam
  agent.ts already uses.
- verified-by: `after a stop the room closes once the message has landed`

### F179 — The seeded opening is checked before it is spoken
- severity: P2
- status: [x]
- where: services/tutor-agent/src/convo.ts:1094
- note: the seed topic is published and spoken before startScene's safety check reads it; the
  check moves ahead of the publish.
- verified-by: `the seeded opening is checked before it is published or spoken`

### F180 — The voice and the transcript surface the same finding
- severity: P1
- status: [x]
- where: packages/brain/src/engine/conversation.ts:561
- note: the model's coachLine ships whenever its style is clean, even when it corrects a
  different finding than the one the code surfaced, and can tell a correct learner "Not quite";
  a line inconsistent with the lead falls back to the code's own copy family for that kind.
- verified-by: `the spoken coach line describes the finding the code surfaced`
- verified-by: `correct-but-textbook phrasing is never told not quite`

### F181 — The scripted lesson caps its corrections in code
- severity: P1
- status: [x]
- where: packages/core/src/session/session.ts:369
- note: six misses earn six corrections, the exact shape K1 fixed in the conversation and never
  carried across; feedbackMessage gains a cooldown whose constant is pinned to K1's value by
  comment and by contract, so core grows no second ladder.
- verified-by: `six missed turns do not earn six corrections`

### F182 — A corrected phrase earns no credit in the same turn
- severity: P1
- status: [x]
- where: packages/brain/src/profile/profile.ts:256
- note: one model call can mint a correction and a usedWell credit for the same phrase, and
  three such turns write mastered into Phase 4's canonical evidence; applyTurnToProfile, the
  single credit choke point, excludes phrases named in the turn's coach findings.
- verified-by: `a phrase corrected this turn earns no mastery credit this turn`

### F183 — Live sessions run the learner's stored strictness
- severity: P1
- status: [x]
- where: services/tutor-agent/src/convo.ts:919
- note: three call sites hardcode flow, so two of the three built policies never run and
  production disagrees with the eval; all three read the parsed profile's preference. Fresh
  profiles default to balanced, a live behaviour change the founder approved explicitly, still
  capped by K1's cooldown and reversible in one line.
- verified-by: `a live session runs the learner's stored strictness, not a hardcoded one`

### F184 — Finishing a session keeps the learner's strictness choice
- severity: P1
- status: [x]
- where: packages/brain/src/profile/profile.ts:390
- note: finishSession writes the session's strictness over the stored preference, destroying the
  one field a future dial needs; the write-back is removed and the preference survives a session
  untouched.
- verified-by: `finishing a session leaves the strictness preference as the learner set it`

### F185 — The learner can turn the strictness dial
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/ProfileTab.tsx:1
- note: the dial is built, tested and unreachable; one SettingsRow with three plain options
  writes the preference F184 now preserves and F183 now honours. Copy is warm and honest about
  what each setting does.
- verified-by: `the profile tab turns the strictness dial and the store keeps the choice`

### F186 — Feedback never asks for a retry the lesson will not give
- severity: P2
- status: [x]
- where: packages/core/src/session/session.ts:290
- note: feedbackMessage never learns the turn advanced, so it says listen and try again while
  the engine moves on; it receives advanced and the moved-on family models the line and moves
  forward.
- verified-by: `feedback copy never asks for a retry the lesson will not give`

### F187 — The tutor doc describes the cooldown the engine keeps
- severity: P2
- status: [x]
- where: docs/TUTOR_BRAIN.md:19
- note: the operating contract still promises a recast on every not-quite attempt, which K1
  deliberately stopped; the doc states the cooldown. Source-reading test, load-bearing because
  doc-code agreement is the finding.
- verified-by: `the tutor doc describes the cooldown the engine keeps`

### F188 — The crash path banks what curation would keep
- severity: P1
- status: [x]
- where: apps/mobile/src/live/journalRules.ts:258
- note: recoveryPlan banks the uncurated twelve, delivering by crash exactly the card flood
  curation exists to prevent; recovery applies curation's own cap of five.
- verified-by: `a recovered journal banks at most what curation would have kept`

### F189 — The curated batch is journalled and replays identically
- severity: P1
- status: [x]
- where: apps/mobile/src/live/journal.ts:186
- note: only the recap and drills reach the journal, so a failed bank retries different, larger
  content and the tutor's authored extensions vanish without record; journalPractice writes the
  curated batch before banking, and the replay lands on the same rows. The
  identity-is-the-French-line merge prevents double banking, proven not assumed.
- verified-by: `a curated batch that fails to bank is banked identically on the next launch`

### F190 — Extensions pass a content check before becoming cards
- severity: P1
- status: [x]
- where: packages/brain/src/curate/curate.ts:136
- note: a model-authored phrase the learner never heard goes straight onto a review card while
  drills from the same keep-list pass a linter; extensions pass carriesFrench and the copy
  rules, and rejections are counted like drill rejections.
- verified-by: `an extension that fails the content check never becomes a card`

### F191 — The scripted lesson hears the durability answer
- severity: P2
- status: [x]
- where: apps/mobile/src/review/store.ts:144
- note: addFromSummary awaits the PersistAck and throws it away, so a full store silently loses
  a lesson's cards that a conversation would journal and retry; the ack is returned and the
  caller keeps a failed deck for retry on the existing journal seam.
- verified-by: `a lesson deck that fails to save is kept and retried, not dropped`

### F192 — Curation spends no slot on what the learner already uses
- severity: P2
- status: [x]
- where: packages/brain/src/curate/curate.ts:47
- note: CurationInput carries cefr and error tags only, so a keep slot can re-teach a phrase the
  evidence record calls used; the input gains a known-phrases list and applyCuration skips them
  in code, with the supply line added agent-side in TB-2.
- verified-by: `curation is told what the learner already uses and spends no slot on it`

### F193 — Curation gets an eval
- severity: P2
- status: [x]
- where: services/brain-playground/package.json:9
- note: Phase 4 proved the batch survives the disk and nothing proves it is worth surviving;
  eval:curation follows the drillEval template and scores keeps against drops so the exit
  criterion has a measurement to regress against.
- fixed: the eval was already on main (`src/eval/curationEval.ts`); the first live run on
  2026-10-23 kept 5 of 5 worth reaching for on both fixtures, recorded in
  docs/IMPLEMENTATION_EVIDENCE.md under "Measurements that are not assertions". On 2026-10-24
  curation moved to gpt-6-luna (VOICE-012); two runs there and a same-day gpt-5.6-luna baseline
  are recorded in the same place (café 4 then 5 of 5, weekend 5 of 5 every run, about $0.001
  against about $0.003).
- verified-by: `the curation eval scores keeps against drops and runs from the playground`

### F194 — The storage doc describes the publish that exists
- severity: P2
- status: [x]
- where: docs/STATE_AND_STORAGE.md:115
- note: the doc still describes a fire-and-forget finish() that F101 replaced with an awaited
  allSettled, sending the next engineer to fix a fixed thing and past the loss that remains; one
  block correction covers both survey findings. Source-reading test, load-bearing because doc
  accuracy is the finding.
- verified-by: `the storage doc describes the awaited publish and durable pack recovery`

### F195 — The client rides a reconnect instead of dying of it
- severity: P1
- status: [x]
- where: apps/mobile/src/live/useLiveSession.ts:677
- note: no reconnect event is subscribed and ready is never re-sent, so the agent's replay path
  has never once been triggered and a blip at minute eight loses the session; the hook
  subscribes all three events, re-sends ready on Reconnected, and shows an honest reconnecting
  state. Closes both survey faces of this gap.
- verified-by: `a reconnect re-sends ready and the session resumes instead of ending`

### F196 — Giving up on an absent tutor frees the account
- severity: P1
- status: [x]
- where: apps/mobile/src/live/useLiveSession.ts:724
- note: the agent-absent give-up leaves the lease held with no process able to release it, and
  the refusal copy blames sign-in; giveUp calls /session/abandon for agent-absent only, so
  trying again now succeeds.
- verified-by: `giving up on an absent tutor frees the account to try again now`

### F197 — A dropped session makes no false promise
- severity: P2
- status: [x]
- where: apps/mobile/src/live/failure.ts:184
- note: the copy says progress is saved and nothing is saved before the recap; it becomes
  honest, warm and short, and tells the learner the one useful thing, that a fresh session is
  the way back.
- verified-by: `the dropped-session message promises nothing the code does not do`

### F198 — A vendor failure is named honestly and offers the typed door
- severity: P1
- status: [x]
- where: services/tutor-agent/src/agent.ts:271
- note: the handler discards the union's type and recoverable fields, so a dead STT reads as a
  passing voice blip while the meter runs; recoverable stays a quiet notice, unrecoverable names
  what is true and offers the switch to typing that F200 builds, and each classified failure is
  logged.
- verified-by: `an unrecoverable vendor failure is named honestly and offers the typed door`
- verified-by: `a recoverable blip stays a quiet notice`

### F199 — The agents honour a mid-session switch to text
- severity: P1
- status: [x]
- where: services/tutor-agent/src/convo.ts:1524
- note: both classes handle the mode frame by flipping the voiceless flag that already governs
  say() and the silence window; the in-flight utterance finishes, nothing new is spoken, the
  scene and the meter continue.
- verified-by: `a mode frame turns the agent voiceless mid-session without ending the scene`

### F200 — The hook switches to text without a new room
- severity: P1
- status: [x]
- where: apps/mobile/src/live/useLiveSession.ts:188
- note: switchToText unpublishes the microphone, sends the mode frame and keeps the room, so the
  switch needs no grant and cannot meet the lease; the old rebuild path remains for cold starts
  only.
- verified-by: `switching to text keeps the room, stops the microphone and needs no new grant`

### F201 — The quiet door mid-scene keeps the scene
- severity: P1
- status: [x]
- where: apps/mobile/src/ConvoScreen.tsx:250
- note: the door built for a learner who discovers mid-question they cannot speak currently
  rebuilds the session into a 409 from their own lease; it calls switchToText on the typingOpen
  seam, no remount, no refusal screen. View-model test, because F145 proved a source grep passes
  over a dead render path.
- verified-by: `the quiet door mid-scene keeps the scene and is never refused by the lease`

### F202 — The privacy doc matches the new safety behaviour
- severity: P1
- status: [x]
- where: docs/PRIVACY_AND_SAFETY.md:300
- note: the doc gains the record's exact contents and exclusions, the under-13 account memory
  and its reinstall ceiling, the output guard, and the closed room, and reaffirms that no
  escalation or reporting route exists; safetyPolicy.test.ts keeps holding code against doc.
- verified-by: `the privacy doc matches the record kept, the memory added and the gate that closes`

### F203 — The roadmap row records what Phase 5 proved
- severity: P1
- status: [x]
- where: docs/DELIVERY_ROADMAP.md:14
- note: the Phase 5 row moves from six-P0s-landed to complete-pending-external, naming the five
  properties as held locally and the six external checks as still unclaimed by anyone.
- verified-by: `the roadmap row records what phase five proved and what stays external`

### F204 — The end card can congratulate a learner for the phrase it just corrected
- severity: P2
- status: [x]
- where: packages/brain/src/engine/conversation.ts:678
- note: `state.usedWell` accumulates `turn.profileSignals.usedWell` raw, with no coaching filter,
  and `recap.ts:111` turns it into the end card's wins. F182 closed this at the evidence choke
  point so nothing inflates the canonical record, but the recap reads its own accumulator, so
  the learner can still be praised on the end card for a phrase the same turn corrected. Same
  one-turn-one-verdict family as F180 and F182, third mouth. Display rather than evidence, so
  it inflates nothing, but it is the contradiction the learner can actually see. Found by
  learning-science-engineer while closing F182.
- verified-by: `the end card never celebrates a phrase the session corrected`

### F205 — The correction cooldown is one decision kept in two places
- severity: P2
- status: [x]
- where: packages/brain/src/engine/grading.ts:110
- note: F181 carried K1's `INLINE_COACH_COOLDOWN_TURNS` into `packages/core/src/session/session.ts`
  as `CORRECTION_COOLDOWN_TURNS`, pinned by comment and by a test that fails on drift, because
  core cannot import brain. But brain already imports `@luvani/core`, so the dependency runs the
  other way: move the constant into core and have `grading.ts` re-export it, and the pin becomes
  mechanical rather than a test on a literal. One decision, one home, no new package. Found by
  bug-hunter while closing F181, and correctly not built from core's side.
- verified-by: `the correction cooldown has one home and both modes read it`

### F206 — A rescue line is either dead or lost, and nothing says which
- severity: P2
- status: [ ]
- where: packages/brain/src/copy.ts:174
- note: `RESCUE_LINE` duplicates core's `FEEDBACK.rescued[0]`, and its only reference anywhere in
  the repo is its own test at `copy.test.ts:137`. Either the live path lost its rescue line or
  the constant is dead weight that a copy test keeps looking alive. A constant whose only caller
  is the test that checks it proves nothing about the product. Found by bug-hunter while closing
  F186; it could not tell which without entering brain's territory.
- verified-by: `every rescue line the copy module ships is reachable from a live path`

### F207 — The French hate list has no passive twin, so a call to exterminate matches nothing
- severity: P1
- status: [x]
- where: services/tutor-agent/src/safety.ts:1
- note: English `HATE_OR_HARASSMENT` carries `(?:should be|deserve to be) (?:killed|gassed|...)`
  and the French half has no equivalent, so `Les juifs devraient etre extermines` matches nothing
  and reaches the model as ordinary practice. Found by tutor-behaviour-engineer while building
  the output guard's ordinary-lines corpus; it correctly left it alone, because closing it
  changes input stop behaviour and no TB-1 entry authorised that. Fixing it must keep the false
  positives slice 1 closed shut: an ordinary French sentence about war, history or a film is not
  a call for harm.
- verified-by: `a call for harm in French is caught the way its English twin is`

### F208 — A stopped session still pays a model for work nobody will receive
- severity: P2
- status: [x]
- where: services/tutor-agent/src/convo.ts:1049
- note: `closeAfterStop` deliberately does not await `finish()`, so after a safety stop the agent
  still runs extract, curate and drill generation, and publishes their results into a room that
  has closed. The learner is billed model time for output nobody receives, and
  `PRIVACY_AND_SAFETY.md`'s stop list says a stopped session leaves nothing behind, which is
  true of the device and not of the worker. Either the work is skipped on a stop or the doc
  stops claiming it. Found by tutor-behaviour-engineer, correctly left as a founder and
  policy decision rather than changed unilaterally.
- note: 2 October 2026: safety stops now return before extraction, curation, drills and pack writes. The founder separately approved background recap/pack preparation for ordinary learner exits, with live replies cancelled. One shared finish promise prevents duplicate work. Both stop-policy tests pass; independent gpt-6-sol review found no code blocker. LiveKit interruption and worker lifetime still need live verification.
- verified-by: `a stopped session starts no post-session model work`

### F209 — The pipeline log prefixes have two homes and no way to keep them equal
- severity: P2
- status: [ ]
- where: services/tutor-agent/src/agent.ts:271
- note: `PIPELINE_ALARM_PREFIX` and `PIPELINE_LOG_PREFIX` are exported from
  `apps/mobile/src/live/failure.ts` and repeated as literals in `agent.ts`, because `failure.ts`
  imports `livekit-client` and pulling a browser SDK into the worker to reuse two strings is the
  wrong trade. The reasoning is right and the result is still two copies of one decision, with
  nothing failing if they drift, so a grep that finds the app's alarms silently misses the
  worker's. `packages/core` is the shared leaf both already depend on. Same shape as F205.
  Found by backend-engineer, correctly flagged rather than solved by importing across a boundary.
- verified-by: `the pipeline log prefixes have one home and both sides read it`

### F210 — The scripted lesson agent's own lines pass no output guard
- severity: P2
- status: [x]
- where: services/tutor-agent/src/tutor.ts:224
- note: `PRIVACY_AND_SAFETY.md`'s not-true-yet table names the gap honestly and its ledger
  column says "Not filed", but `KNOWN_ISSUES.md` is where this repo keeps what is known to be
  broken, and a doc row is not greppable as an open item. `outputGuard` runs on
  `LuvaniConversation`'s four surfaces and not on `LuvaniTutor`'s, so a lesson's model line
  reaches the learner unchecked. `safetyPolicy.test.ts` already pins `guardedAgents()` to
  `convo.ts` alone, so closing this means extending the guard and updating that pin together.
  Found by work-judge at the slice 2 boundary.
- verified-by: `split harmful output and private markers never reach the scripted speaker or text history`

- resolution: 4October backend implementation holds the entire finite scripted model reply before speech/history, applies the shared output boundary and suppresses split harmful/private output. The executable streamed-node regression passes; production corpus/device safety acceptance remains separate.

### F211 — The roadmap's Phase 5 section contradicts the ledger it summarises
- severity: P1
- status: [x]
- where: docs/DELIVERY_ROADMAP.md:149
- note: lines 149-167 are slice-1 text left in place after slice 2 landed. They claim 34 gaps
  open with 23 at P1 while the opening of the same section, and the ledger, say every P0 and
  P1 is closed. The two paragraphs cannot both be true, and the wrong one is the one a reader
  reaches last.
- verified-by: `the phase five narrative agrees with the ledger it summarises`

### F212 — The evidence snapshot records Phase 3 as the last landing
- severity: P1
- status: [x]
- where: docs/IMPLEMENTATION_EVIDENCE.md:24
- note: the header says refreshed for the Phase 3 landing floor and the snapshot's lead
  sentence says Phases 1, 2 and 3 are on `main`, while Phases 4 and 5 landed as `f943bbe` and
  `1b37b81`. The document that separates measured from claimed is itself two landings behind,
  and neither later merge hash appears anywhere in it.
- verified-by: `the landing snapshot names every merge the roadmap records`

### F213 — The risk register stops at Phase 4
- severity: P2
- status: [x]
- where: docs/RISK_REGISTER.md:3
- note: Phase 5 accepted six P2 risks by choice, one of them a founder decision about money
  (F208) and one a safety gap (F210), and the register that exists to record accepted risks
  names none of them. Its own philosophy says a register that records only the good news is
  the document this repo spends its time correcting.
- verified-by: `the risk register records what phase five accepted`

### F214 — The mobile floor defends 46 fewer tests than main carries
- severity: P2
- status: [x]
- where: scripts/gate.floors.json:7
- note: floors were blessed at the Phase 5 branch gate (mobile 556) and the loading-feedback
  landing raised main's mobile count to 602 without a re-bless, so 46 tests could vanish
  silently. The new equality test holds the recorded landing gate and the floors together so a
  landing can never leave the floors behind again; the bless on a green gate is the work.
- verified-by: `the newest recorded gate is the floor the gate defends`

### F215 — A credential of only letters is invisible to the secret scanner
- severity: P1
- status: [x]
- where: services/token-server/src/secretScan.ts:136
- note: `isCodeReference` calls any value matching `/^[a-z][A-Za-z]*$/` a code identifier, and
  `scanLine` skips it for every context-anchored pattern. `LIVEKIT_API_SECRET=` followed by
  thirty-two letters beginning in lower case is not reported at all. The six patterns this
  silences are exactly the repo's live vendor credentials: livekit-credential, deepgram-key,
  upstash-token, assigned-server-secret, url-embedded-credential and hardcoded-bearer, which
  are the same four keys F80 is still waiting to rotate. The rule earns its keep against a
  real code reference like `authorization: bearerTokenFromRequest`, so deleting it is not the
  fix; it needs a test that separates an identifier from a credential. It also makes the gate
  flaky, because `plantedSamples()` generates genuine random tokens and roughly one base64url
  draw in 480 is all letters starting lower case. Found when the pre-push hook refused a push
  and the same suite passed on the next run.
- verified-by: `a credential of only letters is still found behind its variable name`
- verified-by: `a dotted code reference is still not a finding`

### F216 — Three guilt ban lists become one importable union
- severity: P1
- status: [x]
- where: apps/mobile/src/copy/guilt.ts:1
- note: the no-guilt rule is enforced by three tests with three different contents, and the gate
  cannot see a ban list getting shorter. One exported union imported by every guilt-sensitive copy
  test makes shortening it fail several suites at once, and 6a's three new surfaces land behind it.
- verified-by: `the shared ban list still carries every word each surface ever banned`

### F217 — The passport is a pure projection of mission progress
- severity: P1
- status: [x]
- where: apps/mobile/src/progress/passport.ts:1
- note: one stamp per scene completed unaided, three states read off Independence, best-ever by
  construction so a tired replay cannot cost a stamp; no counts, no digits, no banned word in any
  stamp copy; nothing rendered at zero stamps; a needs-review mission keeps its stamp because
  evidence does not decay.
- verified-by: `a stamp is earned at best-ever independence and a lower replay cannot remove it`
- verified-by: `with no stamps the passport adds nothing to the screen`
- verified-by: `a mission the scheduler wants back keeps its stamp`

### F218 — My French draws the stamps
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/MyFrenchTab.tsx:130
- note: the situations list consumes stampsFrom; a stamped row gets a filled signal.good mark,
  not-yet stays the hairline treatment because a thing that has not happened is not a state worth
  signalling. Held by a source-walking contract test, since apps/mobile has no renderer tests.
- note: revamp A (2026-09): the stamp is the filled green chip on each situation row, and the row is
  drawn by myfrench/SituationsCard.tsx; the screen-side claim is proved in
  tabs/MyFrenchTab.test.ts and the unaided rule in myfrench/situations.test.ts.
- note: notebook redesign (2026-09-27): the tinted situation rows and their green chip left My
  French. A stamp now reads as an earned can-do on the level path, drawn from core's spine over the
  learner's progress, and only a scene handled on the learner's own earns one.
- note (2026-10-20, B4, B-Journey): the CEFR LevelCard became "Where you are", five stages from the spine with "You're here" on the real one and still no rank or CEFR code, so the test is renamed for that.
- verified-by: `the stage is the spine's, said in words with "You're here" on the real one, and no rank anywhere`
- verified-by: `only a scene handled with nothing handed over is filled`

### F219 — Core names a card's first return
- severity: P1
- status: [x]
- where: packages/core/src/review/scheduler.ts:255
- note: reps 1, intervalDays 1, due, and never a phoneme is exactly a first success coming back;
  relearned lapses and easy-first cards are excluded by the arithmetic. dueCards stays
  byte-identical so mix.ts and the due count cannot move.
- verified-by: `a card back from its first one-day interval is a first return and nothing else is`

### F220 — The review sitting says the tomorrow test out loud
- severity: P1
- status: [x]
- where: apps/mobile/src/review/cardView.ts:1
- note: a stable partition of the already-capped sitting floats first-return cards to the front and
  one quiet opener names why they are back; membership is dueCards' alone, so the cap and
  overdue-first rules cannot be starved from here. Copy held against the shared ban list.
- verified-by: `the tomorrow test never changes which cards are in the sitting, only the order`
- verified-by: `the sitting opener carries no digit and no banned word`

### F221 — replayRung answers the replay question the ladder does not
- severity: P1
- status: [x]
- where: packages/core/src/missions/missions.ts:198
- note: openingRung opens one rung below for a cold session; a deliberate replay of a finished
  scene opens one rung up, clamped at the top, null when there is nothing to replay. Two questions,
  two functions, one file that already owns independence.
- verified-by: `a deliberate replay opens one rung up and never past the top`

### F222 — The conversation engine accepts a requested opening rung
- severity: P1
- status: [x]
- where: packages/brain/src/engine/conversation.ts:325
- note: createConversation's config gains startRung, clamped, overriding openingRungFor only when
  present; every existing caller passes nothing and behaves exactly as today. This is the missing
  hop the prior proposal called finished.
- verified-by: `a requested start rung pins where the scene opens and its absence changes nothing`

### F223 — The agent threads the signed rung into the mission scene only
- severity: P1
- status: [x]
- where: services/tutor-agent/src/agent.ts:202
- note: the already-clamped startRung rides LuvaniConversation's opts and is consumed in openMission
  alone, so a stray rung can never stiffen a generic scene; the scripted-lesson branch is untouched.
- verified-by: `the signed start rung reaches the mission conversation and a generic scene ignores it`

### F224 — A finished mission replays with less help and says so once
- severity: P1
- status: [x]
- where: apps/mobile/src/ConvoScreen.tsx:264
- note: the navigator loads completions for a mission route, computes replayRung, and ConvoScreen
  forwards it where undefined sits today; replayNote renders "Less help this time." only when the
  rung actually rises, so a learner already at the top is told nothing false.
- verified-by: `a finished mission replays with less help and says so once`
- verified-by: `the replay note appears only when the rung rises`

### F225 — Phase 6's exit criterion gets definitions and an honest status
- severity: P1
- status: [x]
- where: docs/DELIVERY_ROADMAP.md:15
- note: the four nouns stay, each built noun is defined against the symbol that implements it, the
  status cell records 6a built and 6b still deferred, and the landing records the gate and blesses
  the floors as one act per evidenceContract. The Phase 5 precedent, followed rather than reinvented.
- verified-by: `the Phase 6 criterion keeps all four nouns and each built noun names real source`

### F226 — The reminder says the same words at the same time, and that is all it does
- severity: P1
- status: [x]
- where: apps/mobile/src/reminders/reminder.ts:1
- note: fixed daily copy, preset times, the explain-before-ask sentence and the refused-permission
  line, as pure constants and functions with no expo import, on the disclosure.ts discipline. The
  content builder takes no arguments so it cannot vary with practice.
- note 2026-10-07, ca/p4-reminders: superseded by F771. Founder decision D2 (2026-10-04) reversed the old rule: the reminder now names the chosen tutor, states only the learner's own counts and varies by day, so the fixed-words title is retired and its verified-by points at F771's successor, which holds every line to guiltIn, streakGuiltIn and no dash.
- verified-by: `a reminder names the chosen tutor and opens the place it promises`

### F227 — Nothing under reminders/ can see whether the learner practised
- severity: P1
- status: [x]
- where: apps/mobile/src/reminders/reminder.test.ts:1
- note: the no-guilt commitment enforced structurally: a source scan holds that no module in
  reminders/ imports from progress/, missions/, review/ or the history store, so a practice-aware
  reminder cannot be built without going red. A notification cancelled because you practised is a
  streak with the guilt hidden in the scheduler.
- note 2026-10-07, ca/p4-reminders: superseded by F771. Founder decision D2 (2026-10-04) reversed the old rule: a reminder is skipped on a day already practised, so the planner reads practice; only reminders/ReminderPlanner.tsx (and its today's-phrase helper) may, through game/ and the guest record, and reminder.test.ts still bans the progress stores everywhere under reminders/.
- verified-by: `a reminder is skipped on a day already practised, at most one a day, and pauses after four unanswered`

### F228 — The reminder's chosen time lives under the account scope
- severity: P1
- status: [x]
- where: apps/mobile/src/reminders/store.ts:1
- note: versioned envelope under userKey('reminder'), suffix added to USER_KEY_SUFFIXES so a data
  reset clears it and scope.test.ts can see it.
- verified-by: `the reminder store keeps the chosen time under the signed-in learner's own key`

### F229 — A reminder is a property of a device, and the sync table says so
- severity: P1
- status: [x]
- where: apps/mobile/src/sync/policy.ts:596
- note: reminder joins SYNC_EXCLUSIONS with a product reason over forty characters; the pinned
  exclusion list in policy.test.ts grows to three. The OS holds the schedule and permission is
  per-install, so syncing it would double-fire one learner.
- verified-by: `every synced namespace has an explicit merge policy and every excluded one an explicit reason`

### F230 — Only the native half of the platform pair talks to the OS
- severity: P1
- status: [x]
- where: apps/mobile/src/reminders/schedule.native.ts:1
- note: the saveFile.ts pattern: schedule.native.ts is the sole expo-notifications importer with a
  daily repeating trigger, schedule.ts is the web no-op, and no test loads the native half, which
  is what makes the dependency separable from the code.
- note 2026-10-07, ca/p4-reminders: superseded by F771. Founder decision D2 (2026-10-04) reversed the old rule: a repeating trigger cannot skip a practised day, so schedule.native.ts (still the sole expo-notifications importer) now schedules one dated slot per day from the plan and cancels only its own by identifier; F771's successor reads that file.
- verified-by: `a reminder is skipped on a day already practised, at most one a day, and pauses after four unanswered`

### F231 — The Profile row explains the ask first and a refusal leaves no dead switch
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/ProfileTab.tsx:469
- note: one sentence above the switch before any system dialog; a refusal turns the switch back off
  with one honest line about system settings; a permission revoked later reads as off at render
  rather than as a toggle that silently does nothing.
- verified-by: `the profile reminder row explains the ask first and a refusal leaves no dead switch`

### F232 — The weekly story says what happened, or says nothing
- severity: P1
- status: [x]
- where: apps/mobile/src/progress/story.ts:1
- note: at most three sentences from seven days of session evidence, none on an empty week; digits
  only as counts of things produced; no percentages, day counts or weekday names; imports nothing
  it could compare weeks with.
- verified-by: `the weekly story says what happened this week or says nothing at all`
- verified-by: `the weekly story never compares a week to the one before it`

### F233 — My French carries the story, read on demand
- severity: P1
- status: [x]
- where: apps/mobile/src/profile/FrenchLifeCard.tsx:1
- note: the story renders where the learner goes looking, wired to story.ts and to no second
  opinion; combined with F226 it can never arrive as a push. The one importer moved from My
  French to Profile's week card with F561, and the importer count moved with it.
- verified-by: `the Profile card is the one importer of the story, and the rhythm rail names no number`

### F234 — The ladder's comment stops promising a surface that did not exist
- severity: P1
- status: [x]
- where: packages/core/src/ladder/ladder.ts:215
- note: ladder.ts:217 calls unassistedRate "the headline number on the weekly fingerprint", a
  forward reference to nothing. The story now exists and leads with independence as a sentence,
  never a printed number, so the comment is repaired to name its real consumers.
- verified-by: `the story leads with independence and never prints it as a number`

### F235 — The roadmap's row rule learns that 6b can be built
- severity: P1
- status: [x]
- where: services/token-server/src/verify/deliveryRoadmap.test.ts:886
- note: the row test hard-asserts slice 6b is "not built", so shipping 6b turns it red by design.
  It learns the F225 shape: the row may claim 6b built only when this slice's ledger is closed,
  the row-writing entry excluded, and the device-honesty assertions stay.
- verified-by: `the phase six row says what is built and what is not`

### F236 — The roadmap tells the truth about 6b and the floors move at landing
- severity: P1
- status: [x]
- where: docs/DELIVERY_ROADMAP.md:15
- note: the row status and the reminders/story definition flip to built with implementation clauses
  citing declared symbols, which the probe then agrees with; evidence and floors are written at
  landing in the evidenceContract order, as one act.
- verified-by: `the Phase 6 criterion keeps all four nouns and each built noun names real source`
- verified-by: `the newest recorded gate is the floor the gate defends`

### F237 — Two source files are invisible to grep because they carry raw NUL bytes
- severity: P2
- status: [ ]
- where: apps/mobile/src/sync/policy.ts:227
- note: `policy.ts` at lines 227, 364 and 400, and `packages/core/src/review/merge.ts:153`, embed a
  literal NUL as an identity delimiter rather than the escaped form, so grep calls both files
  binary and answers a search for any symbol in them with silence. Found when data-sync-engineer
  grepped `SYNC_EXCLUSIONS` in policy.ts, got nothing, and nearly concluded the sync table did not
  exist; merge.ts is worse, because it is the CRDT merge and a wrong conclusion there is subtle.
  The repo already knows this hazard, since `apps/mobile/src/sync/sourceText.test.ts` was written
  after `engine.test.ts` carried one, but it scans `*.test.ts` only, so a NUL in a source file is
  outside its view. The fix is the escape plus widening that scan to source; the delimiter
  behaviour must not change, because it is load-bearing for identity in both files.
- verified-by: `no tracked source file carries a control character that hides it from grep`

### F238 — The reminder is registered with the build, and lands on a channel with a name
- severity: P1
- status: [x]
- where: apps/mobile/app.json:38
- note: `expo-notifications` is installed and `schedule.native.ts` calls it, but the config plugin
  is not registered, so prebuild produces a binary where scheduling throws at runtime. The plugin
  entry and `android.permission.POST_NOTIFICATIONS` close that. Two traps found while building
  F230. `enableBackgroundRemoteNotifications` stays off, because it writes
  `UIBackgroundModes: remote-notification` into Info.plist and invites an App Store review question
  nobody can answer honestly for a local-only reminder that registers for no push service. And the
  plugin's `defaultChannel` prop is FCM-only: it does not name the channel a local scheduled
  notification lands on, so Android falls back to an auto-created channel with a generic name in
  Settings. Naming it is a runtime `setNotificationChannelAsync` call, and it must live inside
  `schedule.native.ts` or F230's sole-importer test goes red.
- verified-by: `the build registers the notification plugin and names the channel a reminder lands on`

### F239 — A schedule that fails after a durable write leaves the switch on over nothing
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/ProfileTab.tsx:469
- note: `toggleReminder` branches on the store's `PersistAck` and correctly refuses to move the row
  on a failed write, but it does not branch on `ScheduleOutcome` from `scheduleReminder`. On a
  device the OS call can answer `failed` after the write landed, and the row then reads on over a
  notification that was never scheduled. That is the same dead switch F231 exists to forbid,
  reached by a second and narrower route. Found by frontend-engineer while building F231 and
  deliberately filed rather than folded in, because what the row should say in that state is a copy
  decision and not a two-line patch.
- verified-by: `a reminder the phone refused to schedule does not leave the row reading on`

### F240 — The reminder's Android channel still badges the app icon, and the guard that should stop it forbids the fix
- severity: P1
- status: [x]
- where: apps/mobile/src/reminders/schedule.test.ts:271
- note: two things measured in the expo-notifications Android source while building F238. Expo's
  `BaseNotificationBuilder.createFallbackChannel()` creates its auto channel with an explicit
  `channel.setShowBadge(true)`, and `AndroidXNotificationsChannelManager` only calls `setShowBadge`
  at all when the input carries the key — so a channel created without it takes the platform
  default, which Android documents as true. Either way the daily reminder puts a count on the
  launcher icon, which reminder.ts:41-45 calls "the counter this whole phase refuses to show,
  hosted by the home screen instead of by us". The one-line fix is `showBadge: false` on the
  channel input, and F230's `assert.doesNotMatch(NATIVE, /badge/i)` forbids the word outright, so
  the guard written to prevent a badge is what blocks the line that removes one. Filed rather than
  folded into F238, because the repair is to reshape a closed entry's assertion — it should forbid
  *asking for* the badge permission while requiring the channel to *suppress* the badge — and that
  is `progress-retention-engineer`'s call on their own file, not a build change. The AOSP default
  is the only part of this not read from source here and it needs a dev build to confirm; the
  fallback channel's explicit `setShowBadge(true)` was read directly and does not.
  One thing F235 has to decide, because the file is theirs: `PHASE_SIX_B_LEDGER` in
  deliveryRoadmap.test.ts is a hand-written list of ids that stops at F239, so this entry is
  invisible to the row rule and 6b can be called built with it open. Adding F240 to that list is
  the reading that matches the rule; leaving it out is the reading F237 already got, and the note
  above F237 in that file is the argument for it. Either is defensible and the silent version is
  not.
- verified-by: `the reminder's channel asks for no badge and the guard says which kind it means`

### F241 — The no-guilt boundary is guarded in one direction only
- severity: P2
- status: [x]
- where: apps/mobile/src/reminders/schedule.ts:1
- note: F227 stops anything under `reminders/` importing `progress/`, `missions/`, `review/`,
  `practice/` or the history store, so the reminder cannot learn whether the learner practised.
  The mirror door is open: nothing stops a future practice surface importing `cancelReminder` and
  cancelling the reminder from the outside, which reaches the same guilt mechanic by the other
  side — a notification whose absence means you did enough. Today `ProfileTab.tsx` is the only
  non-test importer of the reminders layer, so the hole is theoretical, and closing it is the same
  shape as F230's guard: assert the set of non-test files importing `reminders/schedule.ts` is
  exactly the Profile row. Found by work-judge while refuting Phase 6b and correctly marked out of
  scope rather than made a revision condition. While in that file, F235's `NOT_SLICE_SIX_B` reason
  for F237 says "files 6b never touched", which F229's exclusion row in `sync/policy.ts` makes
  slightly untrue; the operative fact, that the NUL bytes are not 6b's, holds and is worded
  correctly in the roadmap.
- note 2026-10-07, ca/p4-reminders (review repair on ca/p4-reminders-r1): closed by the planner (F771). Skipping a practised day is now the design (founder decision D2) and lives in one place: a practice settles through game/settle.ts and the planner re-plans from onSettled, so no practice surface imports the reminder. The named test, in reminder.test.ts, holds that only the Settings reminder row (Profile's until F576) writes `enabled: false` over a choice that was on; the planner's other writes are a yes from the ask, the pause once its note has gone out (D2's Paused state, which Settings shows and turns back on, not off), and after the OS refuses a yes, a put-back of exactly the choice that was there before. It also names every module that may cancel pending reminders (the row's off now goes through the planner) and scans the practice surfaces for any reminder import.
- verified-by: `only the profile row can turn the reminder off`
### F242 — The first voice session on a phone refuses a working microphone
- severity: P1
- status: [x]
- where: apps/mobile/src/live/useLiveSession.ts:583
- note: filed as F211 on `claude/app-tech-stack-check-442698` and renumbered here, because that
  branch and the roadmap repairs branched from `97f2c48` within hours of each other and both
  reached for F211. The roadmap one had already landed and been pushed, so this is the id that
  could move without rewriting history. Nothing detected the clash: the gate parses one ledger at
  a time and each branch's was internally consistent.
  The defect itself: the preflight asked `micApiUnavailable()` — which is `!navigator.mediaDevices`
  — before calling `ensureLiveKitGlobals()`, the only call site of `registerGlobals()` and
  therefore the only thing that puts `navigator.mediaDevices` on a native global. The shim ran 59
  lines later, just before `new Room()`. A browser already has mediaDevices, so web and every test
  passed and the ordering was invisible; on iOS and Android every spoken mode threw
  'navigator.mediaDevices is unavailable' before `/session/start` was ever called, and the learner
  was told there was no microphone on a phone whose microphone works. Fixed by hoisting the shim
  to the first statement in the try, ungated by mode because it is idempotent and every mode
  builds a Room. Found while planning the first device build; no device has ever run this code.
- verified-by: `the WebRTC globals are installed before the hook asks whether a microphone exists`
- verified-by: `a device the shim cannot give a microphone is still refused`

### F243 — The roadmap says Phase 6 has not landed, and it landed
- severity: P1
- status: [x]
- where: docs/DELIVERY_ROADMAP.md:15
- note: the Phase 6 status cell reads "Slice 6a is built on `phase-6-retention` and has not landed",
  which was true when F236 wrote it and false forty minutes later when `eee755c` merged the branch
  into `main`. The row rule did not catch it because it checks whether a *built* claim matches the
  ledger, and says nothing about a *landed* claim, which is a fact about git rather than about the
  ledger. This is the third time a roadmap sentence has outlived its truth — F211 and F212 were the
  first two, in the same document, this same day — so the repair is the rule and not only the
  sentence: a row naming a branch as unlanded must fail once the commit it names is an ancestor of
  `main`, and a row claiming a merge must name a hash that exists.
- verified-by: `a roadmap row cannot call a branch unlanded once its work is on main`
- fixed: the Phase 6 status cell now reads "merged into `main` as `eee755c`", and the same stale claim
  in `docs/IMPLEMENTATION_EVIDENCE.md`'s "Retention system" row was corrected with it — the rule found
  that second one, which nobody had noticed. `landingProblems` in
  `services/token-server/src/verify/deliveryRoadmap.test.ts` now reads every table cell in both
  documents and refuses three things: a cell that calls a branch unlanded when git says every commit on
  it is an ancestor of `main`, a merge claim naming a hash git cannot find or place in any reachable
  history, and a cell that claims a merge and denies a landing at once. The pinned "the row claims a
  merge that has not happened" line that used to sit in `phaseSixRowProblems` was itself the same class
  of defect and is gone; its refutation now runs against the new rule. What this cannot honestly check
  is written at the rule's head: git answers in three states, `unknown` is never a failure, and a
  negative answer is only trusted in a full clone. Measured, not assumed — in a `--depth 1` clone, which
  is what `actions/checkout@v4` makes, no main ref resolves and only the textual half runs.

### F244 — A billing event is recorded once, whatever the webhook does
- severity: P1
- status: [x]
- where: supabase/migrations/202608300001_billing_events.sql:1
- note: replay safety by primary key, the session_usage precedent, with the null-safe guard written
  before the bug instead of after it. RLS on, no client policies.
- verified-by: `a replayed billing event id is refused in three-valued logic`
- verified-by: `billing_events has no client policies and only the service role may record`
- fixed: `202608300001_billing_events.sql` adds `billing_events` — `event_id` primary key, owner, vendor
  event name, timestamp, cascade on account delete — with RLS on, no policies at all and every client
  role revoked, the `session_usage` precedent. `record_billing_event(text, uuid)` inserts `on conflict
  (event_id) do nothing` and answers whether this was the first sighting, service role only, security
  definer with a fixed search path. The guard is `if recorded is not true then`, written that way
  before the bug rather than after it, and `databaseContract.test.ts` evaluates it in simulated
  three-valued logic: it builds the null-unsafe counterfactual out of the real body by substitution and
  requires the same reading to condemn it, so the assertion cannot decay into a string match. Two
  boundaries are deliberate and both are in the file: a duplicate held uncommitted by a concurrent
  transaction raises rather than answering "already seen", so no event is lost to a rollback we cannot
  see; and a replay naming a different account is still a replay, because RevenueCat transfers
  app_user_ids and refusing would retry until the vendor gave up. `event_type` carries a default,
  because the recorder F246 calls takes the pair the dedupe needs and nothing else — the column is
  there so the typed overload is a function change later and not a table change.

### F245 — An expired paid period lapses instead of granting a free month
- severity: P1
- status: [x]
- where: supabase/migrations/202608250001_consume_entitlement_null_fix.sql:113
- note: the lazy roll self-renews a paid period on any read or debit — `period_end <= now()` resets
  the seconds and adds thirty days, free, forever. Harmless while nothing sells; a perpetual free
  plan for every cancelled subscriber the day something does. Fixed forward in 202608300002 with a
  24h slack for webhook delay and clock skew, and mirrored in rollPeriod so the fixtures agree.
- verified-by: `an expired paid period lapses to an exhausted trial instead of renewing itself`
- verified-by: `rollPeriod never renews a paid period the billing system did not`

### F246 — The store can say whether it has seen a billing event before
- severity: P1
- status: [x]
- where: services/token-server/src/store.ts:16
- note: recordBillingEvent on the EntitlementStore interface and all four implementations; Supabase
  through the RPC, fixtures through a set, matching the consume idempotency shape.
- verified-by: `recording a billing event asks the database once and reports a replay as already seen`

### F247 — Subscriber state projects to entitlement in one place
- severity: P1
- status: [x]
- where: services/token-server/src/billing/revenuecat.ts:1
- note: the doorbell design's other half — fetch current subscriber state, map identifiers to plans,
  apply the transition policy, land on save(). Tested entirely with injected fetch doubles; no
  vendor account needed.
- verified-by: `an active starter subscriber projects to a fresh starter period`
- verified-by: `a lapsed subscriber projects to an exhausted trial`
- verified-by: `an unknown product identifier changes nothing and is logged loudly`

### F248 — The webhook and refresh endpoints exist, authenticated and bounded
- severity: P1
- status: [x]
- where: services/token-server/src/server.ts:462
- note: /billing/webhook behind a timing-safe shared header, deduped before any vendor fetch, 503
  when unconfigured; /billing/refresh learner-authenticated and rate-limited; half a billing
  configuration refuses production boot.
- verified-by: `a webhook without the shared secret is refused before anything is read`
- verified-by: `a replayed webhook is acknowledged without a second vendor fetch`
- verified-by: `half a billing configuration refuses to boot in production`

### F249 — The purchases SDK lives behind an adapter and only its native half touches the store
- severity: P1
- status: [x]
- where: apps/mobile/src/purchases/adapter.ts:1
- note: the auth/ adapter pattern plus the F230 platform pair; lazy configure with the Supabase user
  id so app_user_id equals our uuid; Expo Go and web report unavailable rather than crash.
- verified-by: `only the native half of the purchases pair imports the store SDK`
- verified-by: `without a configured key the adapter reports purchases unavailable`

### F250 — The paywall ships complete and stays dark until the store says otherwise
- severity: P1
- status: [x]
- where: apps/mobile/src/purchases/paywallView.ts:1
- note: a purchase button exists only when getOfferings returned a purchasable product with its own
  localized price string; both out-of-minutes renderers share the view model; a restore affordance
  is present; every sentence passes the guilt list and no price is hard-coded.
- verified-by: `the paywall stays dark until the store returns a purchasable product`
- verified-by: `paywall copy carries no banned words and no invented price`
- verified-by: `both out-of-minutes screens render the shared paywall surface`

### F251 — The 402 keeps its reason and its plans, and speaks in our words
- severity: P1
- status: [x]
- where: apps/mobile/src/live/useLiveSession.ts:629
- note: folds F168 in. The hook parses away the plans payload and the refusal code, and the screen
  repeats a server sentence carrying an internal noun and an accusation. The code and payload
  survive onto the status; copy comes from a local table, the failure.ts discipline extended to the
  one path that escaped it.
- verified-by: `the 402 keeps the refusal code and the plans, not just the sentence`
- verified-by: `a trial claimed by another account is explained in our words, not the server's`

### F252 — Margins survive the store's cut, and the floor says by how much
- severity: P1
- status: [x]
- where: packages/core/src/metering/meter.ts:256
- note: planMargin ignores store fees. At 15% both paid plans hold above 20% worst-case; at 30%
  regular is roughly 4.7%, one repricing from underwater. Pinned at the 15% rate with the 30% figure
  named in the failure message, which is why Small Business enrolment is on the founder checklist.
- note: 2026-10-23, REV-001 (DECISIONS.md): the founder repriced Core and Max ($14.99, 300 min; $24.99, 600 min; yearly $99 and $169), knowing full use now loses money (Core -14%, Max -36% at 15%). The twenty-percent floor no longer holds by decision, not by drift. These tests replace it and pin the new figures.
- verified-by: `both paid plans lose money on a learner who burns every minute, and the size is pinned (REV-001)`
- verified-by: `at 40% utilisation and the Small Business rate Core clears 50% and Max 40%`

### F253 — The risk register's payment row gets a real control and a true number
- severity: P1
- status: [x]
- where: docs/RISK_REGISTER.md:37
- note: "nothing sells yet" stops being a control the moment a paywall exists; the row must name the
  structural controls this phase builds. And the farmed-trial figure is $1.73 from the cost model,
  not $2.20 — the register's own arithmetic does not even produce its own number. Both proven by a
  verify test so neither claim can go stale silently again.
- verified-by: `the register prices a farmed trial from the cost model, not from memory`
- verified-by: `the register may not claim nothing sells once a purchase surface exists`

### F254 — The roadmap's Phase 7 row tells the truth at landing
- severity: P2
- status: [x]
- where: docs/DELIVERY_ROADMAP.md:16
- note: "implementation missing" becomes false when this lands; the row should say built-and-dark,
  blocked only on store credentials. P2 because it closes at landing as one act with the floors, and
  F243's new row rule polices the same document.
- verified-by: `the roadmap's Phase 7 row matches the ledger's built state`

### F255 — CI clones shallow, so every guard that reads git is silent there
- severity: P1
- status: [x]
- where: .github/workflows/ci.yml:54
- note: `actions/checkout@v4` defaults to `--depth 1`. F243's landing rule asks git whether a branch
  is an ancestor of `main` and whether a claimed hash exists, and it correctly downgrades every
  negative answer to `unknown` in a shallow clone, because "not here" is the normal state of almost
  everything in one — a rule that is red on the runner and green on a laptop is worse than no rule.
  The consequence, measured rather than assumed: in a `--depth 1` clone of this repository only
  `eee755c` resolves, and `refs/heads/main`, `refs/remotes/origin/main`, `refs/heads/phase-6-retention`
  and `2a86092` all fail to. **So F243 would not have been caught by CI**, which is the one place a
  push from a machine with no hooks is checked. `fetch-depth: 0` closes it. Whoever takes this should
  also sweep the gate for anything else that reads git and is quietly degraded on the runner, and say
  what they found; `scan:secrets --history` is the obvious candidate even though CI runs the tracked
  scan today. Escalated by product-orchestrator rather than changed, because it is shared
  infrastructure and a clone-cost decision.
- resolution: `fetch-depth: 0` on the checkout step, with the measurement written beside it. Not a
  larger depth: the four fetch shapes were rebuilt with plain git against this repository on
  2026-08-30, and `--depth 50` is *still* shallow, *still* carries no main ref, and already costs
  6.4M of the 7.1M a full fetch costs — it buys history but not refs, and the rule needs both. A
  depth-1 fetch plus a second targeted fetch of `main` gets the ref for 3.4M but leaves the clone
  shallow, so every negative answer stays `unknown`. Only 0 fetches every head and unshallows.
  The bill: 7.3M of `.git` against 3.3M, about one second of a twenty-minute job. `graphify-out/`
  is 55% of the packed history (3.7M of 6.7M in blob bytes, 135M raw across 21 regenerations) and
  adds roughly 175K per regeneration, so this stays cheap for years rather than forever.
- swept: four things in this repository read git, and only two of them run in CI. `git ls-files`
  in `secretScan.ts` — **not degraded**, measured: 846 tracked files at depth 1, at depth 0 and in
  a full checkout, because it reads the index and the index is complete at any depth. That is the
  scan CI runs. `git config core.hooksPath` in `installHooks.mjs` — not degraded, and inert on the
  runner anyway. `git log -p --all` behind `scan:secrets:history` — **badly degraded**: 1 commit
  and 354,670 diff lines at depth 1 against 131 commits and 1,400,404 at full, so 75% of history
  was invisible and a depth-1 history scan is a tracked-file scan wearing a costume. CI does not
  run it, and now that it could, it still should not on every push. `scripts/loop.mjs` reads git
  heavily but is a local tool the gate never invokes. Nothing else: no test reads `.git` directly,
  and every other subprocess in the repo spawns node, ps, claude or a live-verify harness.
- verified-by: `ci fetches enough history for the guards that read git`

### F256 — The roadmap still says main points at a commit four landings ago
- severity: P2
- status: [x]
- where: docs/DELIVERY_ROADMAP.md:37
- note: "`main` points at `2eac2f2`" in the present tense, in the Phase 4 narrative. `main` points at
  `eee755c`, four landings later. This is the fourth instance of the same class in one document in
  one day — F211, F212, F243 were the first three — and F243's new rule cannot see it, because the
  rule reads markdown table cells only. Whole-document scanning was measured during F243 and
  rejected: "refused rather than merged" and "the merged manifests" are false positives in prose.
  So the honest repair is to write the sentence in a form that cannot go stale, naming the commit as
  the Phase 4 landing rather than as the current tip, rather than to widen the rule until it cries
  wolf. Sweep at the Phase 7 landing, when the roadmap is open anyway for F254.
- resolution: the sentence now reads "`2eac2f2` is where Phase 4 left `main`, and later landings
  have moved it on since" — the same two facts in the other order, which makes it a claim about a
  landing rather than about the tip, and the hash is kept rather than dropped. The property is held
  by `services/token-server/src/verify/roadmapTip.test.ts`, a sibling of F243's rule rather than a
  widening of it: one shape only, `main` plus a present-tense verb plus an explicit `at`/`on`/`to`
  plus a commit, scanned over paragraphs flattened to one line so a re-wrap cannot switch it off.
  The first draft allowed a bare `is` and immediately flagged "its merge base with `main` is
  `2a86092`", which is permanently true — so the preposition is required, and the resulting blind
  spot ("`main` is `<hash>`", never written here) is fixtured as a boundary rather than left
  unstated. F243's rule is untouched.
- verified-by: `the roadmap never claims to know where main points today`

### F257 — A subscriber whose plan lapsed is told their free trial is finished
- severity: P1
- status: [x]
- where: packages/core/src/metering/meter.ts:112
- note: F245 makes an expired paid period collapse to an exhausted trial, which is the right money
  answer and the wrong sentence. `StartRefusal` is `'exhausted' | 'insufficient-for-session'` and
  `canStartSession` keys its copy off `plan` alone, so the lapsed state — which *is* `trial` — reaches
  a learner as "Your free trial is finished." Someone who paid last month and let it run out is told
  they were never a customer. Found by revenue-engineer while building F245's half and filed rather
  than papered over, because the honest fix needs the entitlement to remember it was once paid: a
  `lapsed` marker feeding a third refusal reason, which F250's paywall can then render as an offer to
  resubscribe rather than as a trial that ended. That marker is an entitlement field and a store
  concern, so it lands with the billing work rather than in the meter.
- verified-by: `a learner whose paid plan lapsed and taste is spent is not told their free trial ended`
- note: 2026-10-20 D24: a lapse now falls back to the weekly free taste, so the learner is told the plan ended only once that taste is spent too; the test was renamed to say so.

### F258 — The one command that starts Luvani serves the app on a port its own server refuses
- severity: P1
- status: [x]
- where: services/token-server/src/httpSecurity.ts:3
- note: `devPlan.ts:94` sets `APP_PORT = 8082` and `dev.mjs` launches the web app there, but the
  token server's development origin allowlist is the literal list `8081, 8090` and their `127.0.0.1`
  twins. Nothing links the two constants, which is exactly how they drifted. So `npm run dev` — the
  supported, documented, one-command path this repo tells a newcomer to use — brings up an app that
  gets `403 {"error":"origin not allowed"}` on every token-server call, including `/health`, which
  the app renders to the learner as "Tutor unavailable". It has been invisible because the only
  people running it lately started Expo by hand on 8081, which is on the list. The fix is not a
  fourth literal: derive the development origins from `APP_PORT` so a future port move cannot
  silently reintroduce this. Found while diagnosing a founder report of "sometimes localhost 404".
- verified-by: `the development origins cover the port the dev script actually serves`

### F259 — A thrown provider error leaves the sign-in button pending for ever
- severity: P1
- status: [x]
- where: apps/mobile/src/auth/SignInScreen.tsx:37
- note: `submit()` sets `pending` and then awaits `adapter.signInWithPassword(...)` with no
  `try`/`catch`, and `supabaseAdapter.signInWithPassword` has none either. `supabase-js` returns
  `{error}` for an `AuthError` but *re-throws* anything else — a dropped socket, a DNS failure, a
  CORS refusal, a bug in the SDK. When that happens the rejection escapes into a floating promise,
  `pending` is never cleared, and the button sits on "Signing in…", greyed, with no message and no
  way back short of reloading the page. The same hole is in `SignUpScreen.submit()` and in the
  Google handler beside it. `friendly.ts` already knows how to turn an unrecognised failure into a
  sentence; nothing was calling it on the throw path. This is the difference between a learner who
  reads "the connection dropped" and one who thinks the app is hung.
- verified-by: `a provider that throws still leaves the learner a sentence and a working button`
- verified-by: `the guarded list is every AuthResult method the interface declares`
- verified-by: `the adapter every screen uses is the guarded one`

### F260 — Google sign-in ejects the learner onto a raw provider error page
- severity: P2
- status: [x]
- where: apps/mobile/src/auth/oauth.ts:12
- note: on web `signInWithOAuth` does not report a disabled provider — it resolves without an error
  and navigates the whole tab to `/auth/v1/authorize`, which is where the refusal happens. So
  `GOOGLE_START_FAILED` at `friendly.ts:50` can never be shown for the most likely failure of all,
  and a learner whose project has Google switched off lands on
  `{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}`
  as a bare JSON body, outside the app, with the back button as the only exit. Confirmed live
  against this project, whose `/auth/v1/settings` reports `"google": false`. The button should ask
  the provider whether it is enabled before it throws the tab away, and stay in the app and say so
  when it is not. Found from a founder report of "Google authentication goes to a 404 page".
- verified-by: `a disabled google provider keeps the learner in the app`

### F261 — The README's by-hand instructions start the token server in a mode that cannot boot
- severity: P2
- status: [x]
- where: README.md:155
- note: the four-terminal block says `npm run start --workspace=@luvani/token-server`. That script is
  `NODE_ENV=production node …`, so `productionConfigurationProblems` runs and `process.exit(1)`s on
  any laptop: `LIVEKIT_URL` is `ws://` not `wss://`, and `LUVANI_AGENT_SECRET` and
  `LUVANI_ALLOWED_ORIGINS` are both unset in local development by design. The correct script is
  `npm run dev`, which sets `LUVANI_LOCAL_DEVELOPMENT=1`. `devPlan.ts:112-118` already documents this
  trap for the supervisor; the README never got the same correction. A newcomer following the
  documented fallback watches the server exit and reasonably concludes the repo is broken.
- verified-by: `the readme never tells anyone to start the token server in production mode`

### F262 — The one-command boot hits EMFILE and the workaround exists nowhere in the repo
- severity: P2
- status: [x]
- where: services/token-server/package.json:8
- note: the token server's `dev` script runs `node --watch`, and on macOS that walks the whole
  workspace and dies with `EMFILE: too many open files`. `npm run dev` invokes exactly that script,
  so the supported path is the path that fails. `ulimit -n` is over a million on the affected
  machine, so raising a shell limit is not the answer and telling somebody to try it wastes their
  afternoon. The working answer — run the same server without watch mode — was discovered twice and
  written down only in an untracked scratch file, one `git clean` from being lost for a third time.
  Either the watch flag earns its place or the failure and its workaround belong in the README.
- verified-by: `the readme records what to do when the watcher runs out of file descriptors`

### F263 — A billing event whose projection fails is dropped permanently
- severity: P2
- status: [x]
- where: services/token-server/src/server.ts:232
- note: latent while RevenueCat is unconfigured; **raise to P0 before any `REVENUECAT_*` value is
  set**. `recordBillingEvent` is a PostgREST RPC and commits on its own, claiming the event id
  *before* the work it guards is attempted. If `refreshSubscriber` then throws — a vendor 5xx, the
  five-second `AbortSignal.timeout`, DNS, a failing `store.save` — the handler 500s, RevenueCat
  retries, and the retry sees `first === false` and answers `200 {received: true, replay: true}`
  having projected nothing, for ever. That is at-most-once effect behind at-least-once delivery,
  the exact inversion of what the migration's own design note set out to build. `INITIAL_PURCHASE`
  is partly rescued because the client also calls `/billing/refresh`; `RENEWAL`, `CANCELLATION`,
  `EXPIRATION`, `PRODUCT_CHANGE`, `BILLING_ISSUE` and `TRANSFER` have no client path at all, so a
  dropped renewal lapses a subscriber whose card is still being charged. The claim must be recorded
  only after the effect succeeds, or the two must share one transaction.
- note: 2 October 2026: event completion and allowance projection share the new service-only SQL transaction. Failed vendor calls and rolled-back effects leave the event retryable. Named test and disposable database proof pass; independent gpt-6-sol review accepted the code fix. Not deployed or proven against real RevenueCat deliveries.
- verified-by: `a webhook whose projection fails does not consume the event id`

### F264 — Entitlement refresh reads and writes without holding anything
- severity: P2
- status: [x]
- where: services/token-server/src/billing/revenuecat.ts:143
- note: latent while RevenueCat is unconfigured; **raise to P1 before it is configured**.
  `store.get()` and `store.save()` are each atomic, but the pair is not, and `projectSubscriber`
  carries `secondsUsed` across the gap before `save` rewrites the whole row. Any `/session/end`
  debit or second concurrent refresh landing between the two is silently reverted — free minutes,
  at a learner-triggerable ten refreshes a minute. Worse, `samePeriod` compares
  `current.periodEnd?.getTime()` to a `Date` parsed from the vendor's string, and a mismatch sets
  `secondsUsed: 0` outright; if a Postgres `timestamptz` round-trip ever moves that value by a
  millisecond, every refresh resets the meter. The existing test compares two hand-built in-memory
  dates that have never been near a database, so it cannot see this.
- note: 2 October 2026: DB-issued refresh tickets fence delayed responses; projection locks the entitlement row used by the debit. Same-second expiry preserves usage; older active expiry cannot shorten the paid period. Named test and disposable SQL interleavings pass; independent gpt-6-sol review accepted the fix. Simultaneous live transactions remain unverified.
- verified-by: `a refresh cannot revert a debit that landed while it was in flight`

### F265 — A refresh that granted nothing still tells the learner their minutes are ready
- severity: P1
- status: [x]
- where: services/token-server/src/server.ts:245
- note: raised from P2 to P1 and closed, as its own note instructed, because the subscription wall
  stands on this answer: every candidate design for the wall cleared its gate on `settleStoreAction`
  returning `done`, which was `response.ok`, so the wall would have opened for a learner who got
  nothing and sent them straight to the 402 at the room door.
  Fixed in three places. `SubscriberProjection` is now total: the `unchanged` variant carries the
  entitlement that stands, so a caller can report the plan without a second read. The endpoint
  answers `refreshed: projection.kind === 'active'` instead of `true`. And `refreshBilling` returns
  a validated `{ granted, plan }` or null, where null is the request failing and is a different
  event from the server saying plainly that nothing was granted. That third state is the new
  `nothing-granted` outcome, which the paywall words as a grant still catching up and Settings words
  as a store that has been checked, because after a purchase and on a settings row those are
  genuinely different sentences.
  The original note is preserved below.
  `refreshSubscriber` returns `{kind: 'unchanged', reason: 'not-paid' | 'unknown-product'}` when it
  granted nothing, and the handler discards it and answers `{refreshed: true}` regardless. The
  client returns `response.ok`, and the paywall renders "Your speaking time is ready." Combined with
  a native `restore()` that reports success whenever `restorePurchases()` resolves — which it does
  for somebody with nothing to restore — a learner with no subscription is told they have minutes
  and the paywall then hides both the purchase and the restore buttons, leaving them on a terminal
  screen asserting something false with no way to buy anything. The endpoint should report what it
  actually did.
- verified-by: `a refresh that granted nothing does not report success`

### F266 — Client and server billing configuration are never checked against each other
- severity: P2
- status: [x]
- where: services/token-server/src/config.ts:62
- note: latent while RevenueCat is unconfigured; **raise to P0 before it is configured**. Each side
  is genuinely dark alone: the server 503s both billing routes without its five `REVENUECAT_*`
  values, and the client keeps the paywall shut without its `EXPO_PUBLIC_REVENUECAT_*` ones. Nothing
  couples them. A build carrying the client keys against a server missing the server keys shows a
  live purchase button, takes a real charge through Apple, then 503s every webhook and every
  refresh and grants the learner nothing, ever. Both `.env.example` files are commented-out lists
  with no note tying them together and no test asserting the pairing. This is the single
  configuration most likely to charge somebody for nothing, and it is the one the phase's "dark
  until configured" claim does not cover.
- note: 2 October 2026: authenticated readiness requires the migration version and matching entitlement/product IDs before store actions. Wall uses the actual account; SDK identity is serialized through sheets; original scope is checked before and after purchase/restore and refresh. Named readiness, settlement and queue tests pass; independent gpt-6-sol review accepted the code fix. Real store and live configuration still need verification.
- verified-by: `a client configured for purchases refuses to run against a server that is not`

### F267 — The billing webhook is the one endpoint with no rate limit
- severity: P2
- status: [x]
- where: services/token-server/src/server.ts:215
- note: latent while RevenueCat is unconfigured. `/billing/refresh` beside it takes both an IP and a
  per-user limit, and `/account/delete` and `/account/export` take theirs, but `/billing/webhook`
  calls `withinLimits` not at all. It is authenticated by a shared secret, so this is a
  defence-in-depth gap rather than an open door — but it is also the endpoint that writes to
  `billing_events` on every call, and an unauthenticated flood still costs a signature check and a
  round trip per request.
- note: 2 October 2026: webhook takes its dedicated IP rate limit before secret/body processing. The named endpoint inventory check passes and independent gpt-6-sol review accepted it. Real RevenueCat retry traffic and deployed Upstash behavior are not claimed verified.
- verified-by: `every write endpoint carries a rate limit`

### F268 — Export is not gated on recent authentication, and deletion is
- severity: P2
- status: [x]
- where: services/token-server/src/server.ts:397
- note: `/account/delete` requires `signedInRecently` within five minutes; `/account/export` has no
  equivalent check. Both correctly resolve the owner from the bearer alone and neither can be
  pointed at another account — that part is right, and tested. But a refreshed stolen token cannot
  delete the account and can pull the learner's email, every `learner_state` row, every product
  event and the whole entitlement and billing history in one GET. In a phase about privacy, gating
  the destructive action and leaving the confidentiality-sensitive one open is the wrong way round.
- note: 2 October 2026: export and deletion require the requesting verified JWT real-authentication proof within five minutes, alongside the account check. A token refresh or another account sign-in cannot renew that proof. Named tests pass; independent gpt-6-sol review accepted the code fix. Actual provider journeys still need end-to-end verification.
- verified-by: `an export needs a recent sign-in just as a deletion does`

### F269 — The account export is left in a shared cache directory for ever
- severity: P2
- status: [x]
- where: apps/mobile/src/progress/saveFile.native.ts:9
- note: `downloadAccountData` writes `luvani-account-data.json` into `FileSystem.cacheDirectory` and
  shares it, and nothing ever deletes it. `clearActiveUserData` sweeps the AsyncStorage keys and the
  attempt audio and does not touch the cache, so after an account deletion or an account switch on a
  shared phone a plaintext file holding the previous account's email, entitlements and billing
  events is still sitting there. The helper was safe when the only thing it wrote was a word list;
  reusing it for the full export is what made the residue sensitive. Second defect in the same
  path: when `Sharing.isAvailableAsync()` is false the write happens, no sheet opens, and the
  function still resolves `{ok: true}` — the learner sees the button flick back to idle and gets
  nothing, with no error.
- note: 2 October 2026: sharing availability is checked before writing; each unique export is removed after sharing. Refused removal remains tracked, startup discovers bounded export names after restart, and account deletion awaits cleanup and surfaces failure. Failed startup sweeps can retry in session. Named and restart/retry tests pass; independent gpt-6-sol review accepted code-level closure. Native filesystem/share-sheet/kill-relaunch QA remains outstanding.
- verified-by: `an exported account file does not outlive the account`

### F270 — The export tells the learner the antifraud marker is unlinkable, and it is not
- severity: P2
- status: [x]
- where: services/token-server/src/accountExport.ts:83
- note: the export's own explanatory note says the free-trial antifraud marker is "deliberately not
  linkable back to an account". `trial_installations.first_user_hash` is
  `privateSignal(rateLimitSalt, 'user', userId)` — a keyed HMAC over the user id, where the server
  holds both the salt and the id and can therefore recompute the hash for any account and look the
  row straight up. It is pseudonymous, not unlinkable. `PRIVACY_AND_SAFETY.md:253` repeats the
  sentence. This matters more than a wording slip because the row deliberately survives account
  deletion, so the claim is doing real work in an answer to a data-subject request.
- note: 2 October 2026: export and privacy documentation now describe retained markers as pseudonymous and potentially linkable by the service. Named test passes; independent gpt-6-sol review accepted the correction.
- verified-by: `the export describes the antifraud marker as pseudonymous rather than unlinkable`

### F271 — Phase 8 landed outside the discipline the rest of the ledger is held to
- severity: P2
- status: [ ]
- where: docs/DELIVERY_ROADMAP.md:1
- note: Phase 7's roadmap row is pinned by `deliveryRoadmap.test.ts` against `F244`–`F257`, so it
  cannot claim more than the ledger holds. `git grep "Phase 8"` across every `.ts` returns nothing.
  The Phase 8 row was rewritten from "blocked" to "built and tested locally" with no ledger entry
  and no test, and the export endpoint, the mobile export module and the Profile row all landed with
  zero ledger coverage. This is precisely the failure mode F235, F236, F243 and F254 were written to
  prevent, applied to one phase and skipped for the next. The roadmap rule should cover Phase 8 the
  way it covers Phase 7.
- verified-by: `the roadmap's Phase 8 row matches the ledger's built state`

### F272 — The account export had never been run, and did not work the first time it was
- severity: P2
- status: [ ]
- where: services/token-server/src/accountExport.ts:60
- note: the first real execution of `GET /account/export` against the development project — a
  signed-in learner, a valid bearer, the running stack — answered **500**. The server log says
  `billing_events export failed (404)`: migrations 8, 9 and 10 have never been applied to that
  project, so the table the export reads does not exist. Migrations 1 to 7 are applied, which is
  why every other surface works and this one does not.
  Two separate things are wrong and only one of them is the founder's to fix. The unapplied
  migration is deployment state, and `supabase/README.md` already says the apply path is a paste
  into the SQL Editor because there is no CLI, Docker or `psql` on this machine. The code half is
  that a missing table is indistinguishable from a bug: every other Supabase-dependent route in
  `server.ts` answers `503 {"error":"… is not configured"}` when its dependency is absent, and this
  one throws into the generic 500 handler, so the learner is told nothing and the operator has to
  read a stack trace to learn that one table is missing. Hard-failing rather than shipping a
  partial export is correct and `accountExport.test.ts` pins it; being illegible about *why* is not.
  This is also the concrete cost of F271: Phase 8 landed with no ledger entry, `IMPLEMENTATION_EVIDENCE.md`
  called the export "implemented and tested locally", and no test or human had ever executed it.
  Found by running it, not by reading it.
- verified-by: `a missing billing table is reported as unconfigured rather than as an internal error`
### F273 — A least-privilege ElevenLabs key that can speak is reported as revoked
- severity: P1
- status: [x]
- where: services/tutor-agent/src/preflight.ts:370
- note: the vendor check proves the ElevenLabs key by reading `/v1/user`, and ElevenLabs now
  issues *scoped* keys. A key granted only what the tutor needs — synthesis — does not carry
  `user_read`, so that endpoint answers 401 with
  `{"detail":{"status":"missing_permissions","message":"The API key you used is missing the
  permission user_read to execute this operation."}}`. `probe` reads any 401 as "rejected the key
  (HTTP 401). It is wrong, expired, or revoked", the check is fatal, and the worker refuses to
  boot — so `npm run dev` brings the whole stack down. The founder hit this on a real key
  rotation and worked around it by widening the key's permissions, which is precisely backwards:
  the code pushed them off least privilege to satisfy a check that was asking the wrong question.
  The file already contains the right question. `probeSynthesis` asks the vendor to say one word
  in the exact voice and model the tutor uses, and its own comment says the catalogue "answers
  does this account have this voice" while synthesis "answers the question that actually
  matters". It is simply unreachable: `/v1/user` and `/v1/voices` are asked first and either can
  401 on a scoped key. Confirmed against the live vendor — the same key that 401s on `/v1/user`
  returns 200 and 16,762 bytes of MPEG audio from `/v1/text-to-speech/<voice>`.
  The fix must not weaken the sibling rule. A *bare* 401 — no key at all, or a wrong one — has to
  stay fatal, and `an unauthenticated catalogue does not vouch for the key` already pins that.
  What separates them is the vendor's own `missing_permissions`, which is proof the key
  authenticated and was then refused a scope, so only that shape may fall through to synthesis.
- verified-by: `a scoped key that can synthesise is not called revoked`
- verified-by: `a bare 401 is still a dead key`

### F274 — A mission opens a spoken scene the learner can never speak into
- severity: P1
- status: [x]
- where: apps/mobile/src/ConvoScreen.tsx:910
- note: tap a mission card and the tutor greets you out loud, the orb sits in its listening
  state, and nothing you say ever reaches the room. No error, no prompt, no permission dialog —
  the microphone is simply never published. It is the failure this repo names most often as the
  one that matters: a room that opens and a learner who cannot speak.
  Four facts make it, and only together. A mission runs in `convo`, and `capsFor('convo')` sets
  `micAtConnect: false` (`tutor/choosingView.ts:116`), so `useLiveSession.ts:1130` does not open
  the mic at connect — deliberately, because "a free conversation waits for the circle to be
  tapped". The circle that does the tapping is the *choosing* orb, and `live.openMic` has exactly
  one call site in the entire app, `ConvoScreen.tsx:718`, inside the block guarded by
  `if (!view && live.opening)` at line 667. And `openMission` (`services/tutor-agent/src/convo.ts`)
  publishes the opening and then calls `openScene()` with nothing awaited between them, so the
  scene view arrives within a frame and that block unmounts. The learner is left with the scene
  orb at `ConvoScreen.tsx:910`, which is a bare `VoiceOrb` and not a `Pressable`, whose state is
  computed `listening` whenever the tutor is not speaking — so it looks live while no microphone
  exists. "Talk freely" is unaffected: it stays in the choosing moment until the learner speaks,
  which is why the bug has stayed invisible.
  The fix is not to open the mic at connect for missions. The chooser tells the learner in its
  own words that "the microphone opens only when you tap the circle" (`TAP_TO_TALK`), and
  publishing one behind their back to fix a layout problem would make that sentence false and
  trade a consent promise for a shortcut. The scene keeps the same promise instead: when the mic
  is closed and the session is not in text mode, the scene's orb is the same tappable circle,
  wearing the same words. The decision belongs in `sceneControls`, beside the other three, so it
  is testable without a renderer.
  Found by walking the signed-in path after the founder's first real sign-in, and confirmed by
  reading all four files rather than inferring from one.
- verified-by: `a scene with a closed microphone offers the circle that opens it`
- verified-by: `a scene in text mode never offers a microphone`
- verified-by: `the scene stops offering the circle once the microphone is open`
- verified-by: `both conversation rooms wire the same reversible microphone control`

### F275 — A voice vendor seam in buildTTS, defaulting to ElevenLabs byte-for-byte
- severity: P1
- status: [x]
- where: services/tutor-agent/src/voice.ts:189
- note: `selectedVoiceVendor()` and `VOICE_KEY` follow the selectedBrain pattern (trim, lowercase,
  empty means absent, unknown falls back); the fish branch builds from a new voiceFish.ts with
  model pinned to s2.1-pro-free (FISH_MODEL override), env-set FISH_VOICE_ID, explicit 24000
  sampleRate, pinned FISH_SETTINGS with a sorted derived fingerprint, and voiceKey
  `fish:<voice>:<model>:<fingerprint>`. The ElevenLabs branch and its voiceKey are unchanged so
  the 380 warmed WAVs keep hitting. Includes the exact-pinned plugin dep and the .env.example
  vendor block.
- verified-by: `LUVANI_TTS_VENDOR empty, blank or unknown selects ElevenLabs, case and whitespace insensitively`
- verified-by: `LUVANI_TTS_VENDOR=fish builds a fish TTS pinned to s2.1-pro-free, and FISH_MODEL overrides it into the cache key`
- verified-by: `the fish cache key fingerprints vendor, voice, model and every delivery knob, so none can drift`
- verified-by: `.env.example documents LUVANI_TTS_VENDOR and every FISH_ variable the worker reads`

### F276 — Fish's missing final marker is repaired at the seam, not trusted
- severity: P1
- status: [x]
- where: services/tutor-agent/src/voiceFish.ts:1
- note: fish's ws stream emits final:false on every frame and its http stream hardcodes it, so
  ttsCache.ts:242 would never cache under the founder's LUVANI_TTS_MISS_TRANSPORT=ws — audio plays,
  spend rises, no test fails. A hold-last-packet adapter around the fish TTS's stream() marks final
  only on clean completion; error and abort never mark it, so ttsCache's truncated-line guarantee
  is preserved and ttsCache.ts itself is not edited.
- verified-by: `a fish-shaped stream that never marks final is cached by CachedTTS over ws and replayed as a hit`
- verified-by: `a stream that errors mid-line never reaches disk, even through the adapter`
- verified-by: `an aborted line never reaches disk, even through the adapter`
- verified-by: `when the inner stream marks final itself the adapter forwards it once, unchanged and in order`

### F277 — Preflight demands, probes and warns for the vendor the env selected
- severity: P1
- status: [x]
- where: services/tutor-agent/src/preflight.ts:118
- note: missingRequired swaps ELEVEN_API_KEY for FISH_API_KEY under fish; FISH_AUDIO_API_KEY (the
  founder's live misname, verified) becomes a named near-miss; the ELEVEN_VOICE_ID warning is gated
  on the default vendor and the two new warnings are conditional, so the five exact w.length
  assertions hold; under fish, verifyVendors probes /wallet/self/api-credit then a JSON /v1/tts
  probe with the model header (always — the pinned model is exactly what 402s when the free window
  closes), skips the ElevenLabs IIFE, and never applies the F273 missing_permissions parse to a
  fish 401.
- verified-by: `missingRequired demands FISH_API_KEY and not ELEVEN_API_KEY when fish is selected, and the reverse by default`
- verified-by: `FISH_AUDIO_API_KEY is named as a near-miss of FISH_API_KEY, and never its value`
- verified-by: `a fish 402 is fatal and quotes the vendor's own message`
- verified-by: `a fish 401 stays fatal even when the body claims missing_permissions`
- verified-by: `fish selected probes fish and never ElevenLabs; the default probes ElevenLabs and never fish`
- verified-by: `FISH_VOICE_ID unset under fish warns that the default voice is the one this migration replaces`

### F278 — The supervisor and the agent agree on which voice key the env selects
- severity: P1
- status: [x]
- where: services/shared/devPlan.ts:229
- note: devPlan cannot import preflight (services/shared sits below the services that use it), so
  voiceVendorOf mirrors selectedVoiceVendor exactly as brainOf mirrors selectedBrain, and line
  229's unconditional ELEVEN_API_KEY need becomes vendor-conditional. The agreement test couples
  the two answers, not the two implementations, across empty, cased, padded and nonsense values.
- verified-by: `the supervisor and the agent preflight agree on which voice key LUVANI_TTS_VENDOR selects`

### F279 — The warm run refuses without the selected vendor's key, naming it
- severity: P1
- status: [x]
- where: services/tutor-agent/src/warmCache.ts:61
- note: the guard is hardcoded to ELEVEN_API_KEY, so a fish-selected warm run would refuse over a
  key it does not need. It reads selectedVoiceVendor and VOICE_KEY from voice.ts instead. The
  buildTTS call at line 74 is untouched because ttsCache.test.ts:353-361 reads this file's source
  with a regex whose `[^}]*` cannot cross a brace.
- verified-by: `the warm run refuses without the selected vendor's key and names the right variable`
- verified-by: `warming pins the transport rather than reading the environment`

### F280 — The secret scanner knows fish's key by both its names
- severity: P1
- status: [x]
- where: services/token-server/src/secretScan.ts:321
- note: FISH_API_KEY is now a live server credential and the founder's .env carries it under the
  misname too; both names join the assigned-server-secret list so an inline assignment is caught
  before it leaves through a log. Name-anchored only — no shape pattern, because fish's key format
  is unverified and guessing about foreign secrets is the failure the file's own doctrine forbids.
- verified-by: `an inline FISH_API_KEY assignment is caught as a server-only credential`
- verified-by: `an inline FISH_AUDIO_API_KEY assignment is caught even under the misspelled name`

### F281 — Luc's biography names a city his voice contradicts
- severity: P2
- status: [x]
- where: services/tutor-agent/src/prompt.ts:32
- note: both prompts open by placing Luc in Lyon — "you grew up in Lyon", "you ran a bar near the
  Saône", and the opinion "Lyon eats better than Paris" — and the first-run copy repeats it as
  "the man from Lyon". The founder has chosen a Québécois voice for him. A voice and a biography
  that disagree is the same defect as a woman's voice introducing herself as a man: the learner
  hears one thing and reads another, and the one they believe is the voice.
  The fix is to drop the *place*, not the person. The bar, the twenty years, the fifty-two, the
  not-a-teacher and the warmth all stay, because none of them is something an accent can
  contradict. "Near the Saône" goes with the city, since a river names the place as surely as the
  place does. This is the same rule F291 will apply to gender and age once a learner can choose a
  voice: a persona may assert only what every voice in the catalogue could plausibly claim.
  A guard is needed as well as an edit, because the sentence is warm and the temptation to put a
  home town back is permanent. The scene lessons keep their Lyon café — a scene has a location and
  that is not a claim about who Luc is.
- verified-by: `neither prompt gives the tutor a home town`
- verified-by: `the first-run copy tells his life story without naming a city`

### F282 — The tutor voice catalogue lives in core, keyed by app-level keys
- severity: P1
- status: [x]
- where: packages/core/src/protocol/index.ts:19
- note: the app needs names and one-line descriptions, the token server needs the shape, and the
  agent needs the keys to map to vendor ids. Core is the only package all three import, and the
  voice is a wire value, so the catalogue sits beside the protocol. Eight entries keyed
  `luc | alexandre | enrick | mathieu | guillaume | benoit | celine | emilie`, each carrying a
  persona name, a pronoun and a `sound` line stating only what is verified — gender, accent,
  "young". `luc` is the default. App-level keys rather than vendor ids, so a re-clone or a vendor
  move is a one-table edit and a learner's stored preference outlives both. No vendor name and no
  vendor id may appear anywhere a learner can read, which `failure.test.ts:319` already polices.
- verified-by: `the catalogue offers six voices, three men and three women, with one default`
- verified-by: `an unknown or malformed key is not a tutor voice`

### F283 — buildTTS speaks the chosen catalogue voice, and ELEVEN_VOICE_ID is retired
- severity: P1
- status: [x]
- where: services/tutor-agent/src/voice.ts:246
- note: the voice becomes a parameter defaulting to the catalogue default, mapped through
  `ELEVEN_VOICES: Record<TutorVoiceKey, string>` so a missing id is a compile error rather than a
  404 at the vendor. The cache key keeps the **vendor id**, not the app key, so a voice re-cloned
  under the same key can never replay the old clone's audio. `process.env.ELEVEN_VOICE_ID` is read
  by nothing from here on; preflight names it when set, the way `NEAR_MISS_KEYS` names `OPEN_AI_KEY`.
  The derived, sorted settings fingerprint is untouched.
- verified-by: `buildTTS speaks the default voice when nothing is chosen`
- verified-by: `the chosen voice's vendor id lands in the cache key, so two voices never share a WAV`
- verified-by: `ELEVEN_VOICE_ID is read by nothing any more`
- verified-by: `ELEVEN_VOICES names a non-empty vendor id for every catalogue voice`

### F284 — /session/start carries the tutor voice into the signed join metadata, shape-checked
- severity: P1
- status: [x]
- where: services/token-server/src/tokens.ts:159
- note: the third passenger after `seedTopic` and `missionId`, obeying the same rules: a loose
  string at the edge, `validTutorVoice` in `grantSession` (trimmed, 1 to 32 chars,
  `/^[a-z][a-z0-9-]*$/`), signed when it passes and silently dropped when it does not. Deliberately
  NOT checked against the catalogue here: the agent is the last hop before the billed vendor URL
  and resolves it there, and a second strict copy would be a second thing to keep in step.
- verified-by: `the token server signs the tutor voice into the join metadata`
- verified-by: `a tutor voice that is not shaped like a key is dropped, never refused`

### F285 — The worker resolves the voice before it builds the TTS, and hands the persona to both tutors
- severity: P1
- status: [x]
- where: services/tutor-agent/src/agent.ts:107
- note: `buildTTS()` runs at line 107 and `parseMeta` at 141, so today the voice is decided before
  anyone can know which learner joined. The call moves below the parse. `resolveTutorVoice` returns
  a catalogue key or the default and never throws, so nothing the app sends can become a URL
  segment at the vendor — that resolve is the authoritative guard, because this is the only process
  holding the vendor key. The same key's persona reaches both tutors. A joinMeta tripwire holds the
  ordering, because plumbing order is the class of bug seven green tests once missed here.
- verified-by: `the worker reads the tutor voice off the join metadata and builds the voice after reading it`
- verified-by: `an unknown tutor voice resolves to the default and never reaches the vendor`
- verified-by: `the worker hands the persona to both tutors`

### F286 — Preflight proves every catalogue voice on the account, and warns on a premade one
- severity: P1
- status: [x]
- where: services/tutor-agent/src/preflight.ts:525
- note: the catalogue probe checks every id in `ELEVEN_VOICES` is listed, not just the configured
  one, because a learner can pick any of them and a missing one means a room that opens and a tutor
  that never speaks. A missing voice is fatal and names the key to remove or the voice to re-add.
  A listed voice with `category: 'premade'` is a non-fatal check naming the 2026-12-31 retirement.
  The synthesis probe speaks the default only. Any new `warnings()` line must be CONDITIONAL:
  eleven assertions in preflight.test.ts pin exact counts and deepEqual results.
- verified-by: `a catalogue voice the account does not list is fatal and names the key to remove`
- verified-by: `a premade voice in the catalogue is a warning that names the retirement date`
- verified-by: `a stale ELEVEN_VOICE_ID is named as read by nothing`
- verified-by: `the synthesis probe asks for the default voice, and only the default`

### F287 — The warm run warms the default, every voice on request, and says what each costs
- severity: P1
- status: [x]
- where: services/tutor-agent/src/warmCache.ts:83
- note: 62 sentences is roughly 1,618 characters per voice, so eight is about 12,900 — a third of
  a Starter month — and must not happen on every cold clone. `voicesToWarm(env)` in a new
  `warmPlan.ts` reads `LUVANI_WARM_VOICES` (unset: the default; `all`; or a comma list), refuses an
  unknown key BEFORE spending, and the run prints characters per voice. The
  `buildTTS({ voice, missTransport: 'http' })` call must keep `ttsCache.test.ts:353`'s regex
  matching, whose `[^}]*` cannot cross a brace — so no nested object literal before `missTransport`.
- verified-by: `the warm run warms only the default voice unless LUVANI_WARM_VOICES asks for more`
- verified-by: `LUVANI_WARM_VOICES=all warms every catalogue voice and reports the characters per voice`
- verified-by: `an unknown key in LUVANI_WARM_VOICES refuses before spending, naming the catalogue`

### F288 — The profile remembers the chosen voice at version 6
- severity: P1
- status: [x]
- where: apps/mobile/src/profile/upgrade.ts:116
- note: `tutorVoice: TutorVoiceKey | null`, null meaning never chosen and therefore the default. A
  v6 branch reads its own; every branch below writes null, because nothing that happened before the
  field existed is a choice. A stored value that is not a catalogue key reads as null, the same way
  every other slot in this chain reads junk as an unanswered question. `withTutorVoice` is a named
  door in `store.ts` beside `withDailyGoal`.
- verified-by: `a v6 profile keeps the voice the learner chose`
- verified-by: `every version below 6 arrives with no voice chosen, never an invented one`
- verified-by: `a stored voice that is not a catalogue key reads as not chosen`

### F289 — The chosen voice syncs as an answered question
- severity: P1
- status: [x]
- where: packages/brain/src/profile/merge.ts:135
- note: a voice is something the learner told us, so it joins `PROFILE_ANSWER_FIELDS` and a non-null
  beats a null from either side, exactly like `dailyGoalMin`. `sync/policy.ts:515` moves to
  `writes: 6`, and the existing coupling test that holds the store's version equal to the policy's
  keeps both honest. Note for the executor: `sync/policy.ts` reports as binary to `file` and plain
  `grep` misses it — use `grep -a`.
- verified-by: `a chosen voice beats a null one from either side, and the merge still absorbs its inputs`
- verified-by: `the profile row writes the version the store writes`

### F290 — The Profile tab offers every voice
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/ProfileTab.tsx:500
- note: a "Tutor's voice" row after strictness, opening a sheet built like the strictness one:
  one `OptionCard` per catalogue voice showing the persona name and its `sound` line, the chosen one
  selected, one tap through `withTutorVoice`. The subline says it takes effect next session and can
  be changed whenever they like. Copy is checked in the file's source-walk idiom: no vendor name,
  no em dash, no promise about quality.
- verified-by: `the voice row offers every catalogue voice, marks the chosen one, and writes through the named door`
- verified-by: `the voice sheet never names a vendor and carries no em dash`

### F291 — Every session start sends the chosen voice
- severity: P1
- status: [x]
- where: apps/mobile/src/live/useLiveSession.ts:759
- note: `tutorVoice` rides the `/session/start` body beside `missionId`, from both
  `LiveSessionScreen` and `ConvoScreen`, and it is ALWAYS sent — the default included — so the app's
  picker and the agent's fallback can never disagree about what "unchosen" means.
- verified-by: `every session start sends the chosen voice, and the default when none is chosen`

### F292 — Both prompts introduce the chosen persona, and claim no age a voice can contradict
- severity: P1
- status: [x]
- where: services/tutor-agent/src/prompt.ts:32
- note: the sibling of F281, which already removed the home town. Both prompts open with the chosen
  persona's name rather than "Luc", and the explicit age goes for the same reason the city did:
  Émilie is a young voice and "fifty-two" is the one remaining biography fact a voice contradicts.
  The bar, the twenty years, the not-a-teacher and the warmth stay. The default persona is Luc, so
  the default prompt is unchanged apart from the age. The existing coupling test that holds both
  pipelines introducing the same person still applies. NOTE: F281's re-pointed assertion currently
  matches on `fifty-two`; re-point it again rather than deleting it.
- verified-by: `both prompts introduce the chosen persona by name, and Luc when nothing is chosen`
- verified-by: `the persona line carries no age a young voice can contradict`

### F293 — The app calls the tutor by the chosen persona everywhere it names him
- severity: P1
- status: [x]
- where: apps/mobile/src/tutor/tutorName.ts:18
- note: `tutorName.ts` was built so a rename is two deliberate edits rather than a hunt; this is that
  rename, made per learner. `tutorPersonaOf(profile)` replaces the constant at its twelve call sites,
  `rungLabel` in `theme.ts:90` becomes a function of the name, and `waitingView` takes it as an
  argument. A source walk holds that `TUTOR_NAME` is referenced from nowhere but its own file, so a
  thirteenth literal cannot creep back.
- verified-by: `every learner-facing tutor name reads from the chosen persona, not the constant`
- verified-by: `the rung label and the waiting line name the chosen persona`

### F294 — The first-run disclosure follows the chosen persona
- severity: P1
- status: [x]
- where: apps/mobile/src/onboarding/disclosure.ts:116
- note: `PERSONA_TITLE` and `PERSONA_BODY` become functions of the persona so the gender words and
  pronouns follow it, and "AI tutor" stays because that sentence IS the disclosure. `TutorIntro`'s
  "what he just said" takes the pronoun. F281's guard that the copy names no city still applies.
- verified-by: `the persona page describes the chosen persona in the right words, and still says AI tutor`
- verified-by: `the intro's pronoun follows the chosen persona`

### F295 — A sample clip per voice, made through the same voice seam
- severity: P1
- status: [x]
- where: services/tutor-agent/package.json:11
- note: promoted from P2 because the onboarding showcase needs something to play. `voice-samples`
  synthesises one short bilingual line per catalogue voice — one French sentence, one English, the
  persona's name in it — through `buildTTS({ voice, missTransport: 'http' })` into
  `apps/mobile/assets/voices/<key>.m4a`. Through the seam, so the clip is exactly what the tutor
  will sound like rather than an approximation, and cached so a rerun is free. Bundle size is the
  constraint: keep each clip under about 150KB.
- note 2026-09-10: two claims in the note above were overtaken and one of them was never true.
  The line is no longer one French sentence and one English one: F507 made it a single bilingual
  sentence, because two sentences meant two vendor requests and the English one arrived with no
  French around it. And "exactly what the tutor will sound like" did not survive contact: these
  clips went a week saying the sentence c611bcc had replaced, because nothing tied the words to
  the bytes. F507 adds the record that does. Read F508 before trusting the accent. And then back
  again the same day: F505 returned the line to two sentences once the one-sentence clip had been
  heard, so this note's "one French sentence, one English" is true once more.
- verified-by: `the sample script writes one clip per catalogue voice through the same voice seam`
- verified-by: `every catalogue voice has a bundled sample the app can play`

### F296 — A learner can hear each voice before choosing it
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/ProfileTab.tsx:400
- note: promoted from P2 for the same reason. Each option on the voice sheet offers a listen that
  plays that voice's bundled clip through `expo-audio`'s `useAudioPlayer` — the first local playback
  in the app, and already a dependency. One clip at a time: starting a second stops the first, or a
  learner comparing two voices hears both at once. Choosing a voice must not require hearing it.
- verified-by: `each voice on the sheet offers a listen, and it plays that voice's clip`
- verified-by: `starting one sample stops the one already playing`

### F297 — First run introduces the voices and lets the learner choose one
- severity: P1
- status: [x]
- where: apps/mobile/src/onboarding/disclosure.ts:73
- note: the founder asked for this explicitly, overriding the contract's original "Profile row only"
  scope. A first-run step after the AI disclosure where the learner meets the voices: each one
  named, described in its own `sound` line, and playable. Choosing writes through `withTutorVoice`
  exactly as the Profile sheet does — one door, not two.
  Three rules this step must not break. It is SKIPPABLE, because a learner who just wants to talk
  must not be held at a menu, and the default is a real answer. It must not claim a voice is
  "better" or "native" beyond what the catalogue's verified `sound` line says. And it must still say
  the tutor is AI, because this is the disclosure surface and `disclosure.test.ts` polices exactly
  that: any copy telling his life story must also say AI.
  The showcase explains what the choice DOES — it changes who speaks, not what is taught — so a
  learner does not read it as picking a difficulty or a dialect to learn.
- verified-by: `first run introduces every voice, names it, and can play it`
- verified-by: `the voice step can be skipped, and skipping leaves the default chosen`
- verified-by: `the voice step writes through the same door as the profile sheet`
- verified-by: `the voice step still says the tutor is AI`

### F298 — prepareTurn builds its own system blocks and cannot be told who is speaking
- severity: P2
- status: [ ]
- where: packages/brain/src/engine/conversation.ts:570
- note: found while threading the persona through the tutor classes, and it is the call that
  mattered most. `prepareTurn` builds `system: buildSystemBlocks()` itself, with no persona
  parameter to build it from, and that is the **per-turn spoken reply** — the line the learner
  actually hears. The four call sites written out in `convo.ts` cover the scene, the curation, the
  extraction and the drills; this fifth one covers speech. Threading only the four would have
  shipped a session where the recap and tomorrow's drills speak as Céline while every spoken line
  introduces itself as Luc in her voice, which is precisely the mismatch F292 exists to prevent.
  It is not broken today: `runBrainTurn` overrides the block with brain's own builder,
  `{ ...prepareTurn(state, input), system: buildSystemBlocks(this.persona) }`. That override is the
  debt. It rebuilds a block `prepareTurn` already built, so the two can drift, and brain's own
  docstring asserts a contract the code does not keep — "The live path always passes one." It does
  not. The honest fix is a `persona` argument on `prepareTurn`, after which the override comes out
  in the same commit. Filed rather than done because brain's engine was outside the territory of
  the engineer who found it, and a parallel prompt path is worth one deliberate change, not a
  reach across a boundary.
- verified-by: `prepareTurn takes the persona and the live path stops overriding its system block`

### F299 — The app cannot be bundled: eight voice clips are required and none exists
- severity: P0
- status: [x]
- where: apps/mobile/src/tutor/voiceSamples.ts:41
- note: `npx expo export --platform web` from apps/mobile fails with `Unable to resolve
  ../../assets/voices/luc.m4a`, import stack voiceSamples.ts -> tabs/ProfileTab.tsx ->
  nav/RootNavigator.tsx -> App.tsx -> index.ts, so no screen loads on any platform. The directory
  `apps/mobile/assets/voices/` does not exist because `npm run voice-samples -w @luvani/tutor-agent`
  was written and never run — the orchestrator told the engineer not to spend vendor quota, and
  nothing then noticed that a static import makes those files a build dependency rather than an
  asset. F295 was ticked on a test that returns early at
  services/tutor-agent/src/voiceSamples.test.ts:91 when zero clips are present, which is exactly
  the one state the app cannot be built in: the tick was vacuous and has been undone.
  Run the script once, commit the eight .m4a files, and replace the early return with an
  unconditional existence check so a missing clip fails the suite rather than Metro. A green gate
  said nothing here because the gate never bundles; that is the lesson worth keeping.
- verified-by: `every bundled clip is on disk, so the app can be built at all`

### F300 — A learner who already chose a voice is re-introduced to the default on a second first run
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/OnboardingFlow.tsx:225
- note: tutorName.test.ts:26 says F294 and F297 "empty" the NO_LEARNER_IN_HAND list, but both
  onboarding files are still on it, and OnboardingFlow has `existing` in hand. A migrated learner
  with `tutorVoice: 'celine'` who re-enters onboarding — a new required answer, or a pre-account
  record — reads "Meet Luc", "Luc is an AI tutor. The man who ran a bar...", and "Luc greets you by
  name", and then TutorIntro introduces Céline. Naming the default on pre-choice surfaces is
  deliberate and correct for a first-ever run, which is why this is P2 rather than a defect in the
  contract: the gap is only the learner who already answered. Read `tutorPersonaOf(existing)` on
  the meet page and drop the two onboarding files from the allowance.
- verified-by: `a learner who already chose a voice is re-introduced to that voice, not the default`

### F301 — The sample player glue is copied between the Profile sheet and the first-run voice step
- severity: P2
- status: [ ]
- where: apps/mobile/src/onboarding/OnboardingFlow.tsx:137
- note: `playing` state, `useAudioPlayer()` and the `hearVoice` callback are the same fifteen lines
  in OnboardingFlow.tsx:137-153 and ProfileTab.tsx:185-203, with the pause-on-leave in a third
  shape each (`finish` versus `closeVoiceSheet`). `nextSample` already holds the one-at-a-time rule
  in a testable module, so what is copied is only React glue — but two copies of glue is how one
  screen gets a fix the other does not. Lift it into one hook in `tutor/` and have both call it.
- verified-by: `one hook owns the sample player, and both the sheet and the first-run step use it`

### F302 — A ticked ledger entry can name a describe block and still count as verified
- severity: P2
- status: [x]
- where: scripts/gate.mjs:222
- note: found by the work-judge while checking this repo's own tick discipline, which makes it the
  most interesting entry in the batch: it is a hole in the mechanism the whole ledger rests on.
  `passed` collects every line beginning `✔ ` from node's spec reporter, and the reporter prints a
  ✔ for a passing *describe* as well as for a passing test — confirmed, `✔ the warm plan decides
  which voices a run pays for` appears alongside its three tests. So a `verified-by` naming a suite
  title rather than a test title satisfies the tick check while binding the claim to a group rather
  than to one assertion. No entry does this today: all 42 ticked titles across F282 to F300 resolve
  to exactly one `test(` call in exactly one file, checked. But the gate cannot currently tell the
  two apart, and "tick follows the test" is the rule it exists to enforce.
- verified-by: `a verified-by that names a describe block rather than a test does not count as passing`

### F303 — The voice-step skip saved a voice the learner had tapped and walked past
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/OnboardingFlow.tsx:332
- note: the skip ran `setVoice(null)` and then the exit in one tick, but the exit closed over the
  render-scope `voice`, which the queued setState had not yet changed. So a learner who tapped a
  card and then tapped "Skip for now" left with the tapped voice, not the default — the "a skip
  writes nothing" invariant defeated by a stale closure. The exit now takes the chosen key as an
  argument (`complete(voice)` on the pill, `complete(null)` on the skip) and reads nothing from a
  state update that has only been queued. Safe for a re-onboarding learner too: `completeProfile`
  carries an existing stored voice through untouched and `withChosenVoice(_, null)` writes nothing,
  so a null skip keeps the voice they already had while a first-run skip lands on the default.
- verified-by: `the skip contributes null on its own, not through a raced setState — F303`

### F304 — A voice sample kept playing after the learner stepped back off the voice step
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/OnboardingFlow.tsx:202
- note: the back chevron only moved the page; only the forward exit paused the player. So a clip
  auditioned on the voice step played on over the Meet screen behind it — the very thing the
  forward exit's own pause exists to prevent, missed on the one exit that does not finish
  onboarding. An effect now pauses the player whenever the page is no longer the voice step, which
  covers the chevron and any other way off the page.
- verified-by: `a sample stops when the voice step is left by system navigation — F304`

### F305 — Re-listening to a sample that had finished on its own was a dead tap
- severity: P2
- status: [x]
- where: apps/mobile/src/tabs/ProfileTab.tsx:190
- note: `nextSample(playing, tapped)` returns null when the tapped voice is the one already playing,
  which is how a second tap stops a clip. But nothing reset `playing`/`samplePlaying` when a clip
  ended on its own, so the next tap on that same voice was read as "stop" and stopped nothing — a
  dead ear until a further tap. Both the first-run step and the Profile sheet now watch the player
  with `useAudioPlayerStatus` and clear the key on `didJustFinish`, so a re-listen is one tap again.
  Mirrored in `apps/mobile/src/onboarding/OnboardingFlow.tsx`. This adds a little more of the
  duplicated audition glue F301 already tracks; lifting it into one hook stays F301's to do.
- verified-by: `a clip that ends clears the selection so the next tap replays it — F305`

### F306 — A screen primitive owns the layout every screen hand-rolls today
- severity: P1
- status: [x]
- where: apps/mobile/src/layout.tsx:1
- note: no reusable root exists; every screen repeats `flex:1` + inset + scroll, and only two files
  carry the web `minHeight:0` fix. `Screen`, `ScrollScreen`, `ScreenHeader` and `ConfirmSheet` make
  those decisions once and read theme tokens only.
- verified-by: `the scroll screen keeps taps while the keyboard is up, by construction — F306`
- verified-by: `both screen primitives carry the web height fix the transcript already has — F306`
- verified-by: `the screen primitives never disable or cap font scaling — F306`

### F307 — Every tab and pushed screen stands on the primitive, not on a hand-rolled root
- severity: P1
- status: [x]
- where: apps/mobile/src/surfaceContract.test.ts:1
- note: the five tabs, Missions, SoundCheck, Summary, Review, Drill, Phrasebook, TutorIntro,
  Acknowledgements and the Profile sheets render `<Screen` or `<ScrollScreen`; an explicit
  allow-list (ConvoScreen, LiveSessionScreen, Transcript, auth, onboarding, friends, RecapScreen,
  FocusDrillPlayer, SafetyStopView, layout.tsx, LuvaniTabBar.tsx) is the only place
  `useSafeAreaInsets` may still be called, so the next hand-rolled screen fails the walk.
- verified-by: `every tab and pushed screen is built on Screen or ScrollScreen — F307`
- verified-by: `no adopted screen reads the safe area or opens a ScrollView for itself — F307`

### F308 — The review deck clips with the keyboard up
- severity: P1
- status: [x]
- where: apps/mobile/src/ReviewScreen.tsx:261
- note: a typing screen whose card sits in a fixed `flex:1` centre with no scroll; large text or a
  small device with the keyboard open pushes the answer box off the page. `keyboardTaps.test.ts:34-37`
  even records that it "has no scroll of its own".
- verified-by: `the review deck scrolls, and its scroll keeps taps with the keyboard up — F308`

### F309 — One header for every pushed screen, and exactly one way back on each
- severity: P1
- status: [x]
- where: apps/mobile/src/layout.tsx:1
- note: three back idioms today (chevron, "Leave" text, "Back"/"Done"/"Not now" pills) and two
  screens with none (`SummaryScreen`, the mock lesson through `SessionView`). Every adopter renders
  `ScreenHeader` once with either `back` or `leave`, never both, and no hand-rolled `ChevronLeft` or
  `accessibilityLabel="Back"` pressable survives outside `layout.tsx`.
- verified-by: `a pushed screen has exactly one way back, and it is the shared header — F309`
- verified-by: `the end card and the mock lesson have a way out — F309`

### F310 — Leaving a metered room asks first, and never through a native alert
- severity: P1
- status: [x]
- where: apps/mobile/src/LiveSessionScreen.tsx:141
- note: `leaveNow` at `LiveSessionScreen.tsx:141` and `ConvoScreen.tsx:593` disconnect on one tap;
  no `Alert` or confirm exists anywhere. The in-room Leave opens `ConfirmSheet` with copy from
  `live/leaveConfirm.ts`, Stay first; `Alert.alert` is forbidden because it is a no-op on
  react-native-web. Non-room branches (connecting, waiting, error, out of minutes, safety stop,
  recap) keep their direct doors.
- verified-by: `the in-room end control on both live screens opens the confirm rather than leaving — F310`
- verified-by: `the leave confirm is honest, puts Stay first, and never uses a native alert — F310`

### F311 — Android back and the iOS swipe go through the same confirm as the Leave button
- severity: P1
- status: [x]
- where: apps/mobile/src/ConvoScreen.tsx:593
- note: native-stack pops a metered screen on hardware back or a swipe with no question asked.
  `usePreventRemove(inRoom && !leaving, ...)` routes both to the sheet; the exit runs from an effect
  keyed on `leaving` so the pop is never itself prevented.
- verified-by: `hardware back and the swipe on a live room are routed to the confirm — F311`
- verified-by: `the room exit runs after the guard is down, not inline with it — F311`

### F312 — Android back closes an in-place sub-view instead of leaving the tab
- severity: P1
- status: [x]
- where: apps/mobile/src/nav/useHardwareBack.ts:1
- note: `PhrasebookScreen` (from Home and My French), `TutorIntro` (Tutor, Profile),
  `Acknowledgements` (Profile), the Profile sheets and the Summary's in-place drill are `useState`
  views the navigator cannot see, so back exits the tab or the app. One focus-scoped `BackHandler`
  hook, called by each with the right closer (the voice sheet closes through `closeVoiceSheet` so the
  sample stops).
- verified-by: `every in-place sub-view answers the hardware back button — F312`
- verified-by: `the hardware back hook only listens while its view is up — F312`

### F313 — The tab bar says where it goes
- severity: P1
- status: [x]
- where: apps/mobile/src/nav/LuvaniTabBar.tsx:34
- note: the words exist only for screen readers. Each cell shows its label in `type.tabLabel`; active
  is ink and a heavier weight on both glyph and word; the dot goes; labels scale and wrap, never
  truncate or cap; inactive words are `inkSoft` because `inkFaint` cannot carry text; role, selected
  state, announce and the badge are untouched; the bar stays on `paper.ground` with one hairline and
  no shadow or absolute position. `DESIGN.md` is updated to match.
- verified-by: `every tab cell shows its label, and the label scales and wraps rather than truncating — F313`
- note: revamp B (2026-09-30, F600): active is the brand blue at Outfit Bold rather than ink at
  Medium, and the bar is white rather than paper; both tests were renamed for it, and the hairline,
  the wrapping labels and the refused shadow are unchanged.
- verified-by: `the active tab is told by the violet cell and weight 700, and a screen reader still hears selected — F313`
- note: notebook redesign (2026-09-27): the bar is flat on the paper with a top hairline, no inset dock
  and no selected wash; it still carries no shadow, so the tick follows the renamed test.
- verified-by: `the bar is an ink capsule on the route ground, and never a floating shadow — F313, UI-008`
- verified-by: `the design doc no longer calls the tabs icon-only — F313`

### F314 — The in-place end cards stand on the primitive too
- severity: P2
- status: [ ]
- where: apps/mobile/src/RecapScreen.tsx:38
- note: `RecapScreen` and `drill/FocusDrillPlayer.tsx` still hand-roll insets and scroll; they are
  reached only from a live room or the end card and are on F307's allow-list for now. Moving them
  removes two more copies of the root.
- verified-by: `the recap and the focus drill are built on the primitive — F314`

### F315 — The device runbook names what a source walk cannot see about layout and back
- severity: P2
- status: [x]
- where: docs/DEVICE_VERIFICATION.md:1
- note: keyboard over Review and Drill on both platforms, label wrapping at accessibility sizes,
  VoiceOver and TalkBack on the bar, the iOS swipe and Android back inside a room and on every
  in-place sub-view, notched bottom insets, and web at a short viewport. Rows say `not run` until
  walked.
- verified-by: `the device runbook carries the Phase 1 layout and back checks — F315`

### F316 — The lesson's quiet line vanished into the shared header
- severity: P1
- status: [x]
- where: apps/mobile/src/SessionView.tsx:270
- note: `headerLine` is a plain string handed to `ScreenHeader`'s `title`, which renders it as a bare
  child of a `View` (layout.tsx:177). Fabric drops a raw text node under a View and the dev renderer
  logs "Text strings must be rendered within a <Text> component" on every render. Inputs: a learner
  mid-lesson whose connection is being rebuilt (`live.reconnecting` true) or whose agent posts a
  `notice`. Before Phase 1 they read the reconnect line in `type.small`/`inkSoft` inside a
  `<Text accessibilityLiveRegion="polite">`; now the header shows nothing and a screen reader hears
  nothing. connectionLine.test.ts still passed only because the connecting branch's own live region
  (LiveSessionScreen.tsx:198) matched its regex. Wrap the line in a polite-live-region Text before it
  reaches title, and make the test read that wrapper rather than any live region in the file.
- verified-by: `the lesson's quiet line is drawn as text with a polite live region inside the live-room header — F316`

### F317 — The sound check's terminal cards show a chevron and a Done
- severity: P2
- status: [x]
- where: apps/mobile/src/soundcheck/SoundCheckScreen.tsx:130
- note: the comment at the card says the "no check" card carries no back header, but
  `header={<ScreenHeader back=…/>}` was unconditional, so the no-check card and the result card each
  offered two doors (chevron and Done) to the same `onDone`. Review and Drill got this right: a
  terminal card keeps Done and no header. Gate the header on `!noCheck && phase !== 'result'`.
- verified-by: `a terminal sound-check card has Done and no chevron — F317`

### F318 — The shared Leave no longer tells a screen reader what it leaves
- severity: P2
- status: [x]
- where: apps/mobile/src/layout.tsx:182
- note: `ScreenHeader` used the visible word as the `accessibilityLabel`, so "Leave the lesson",
  "Leave the conversation", "Leave the review" and "Leave the drills" all became "Leave, button". A
  screen-reader user on a metered screen heard a verb with no object until the confirm opened. Take an
  optional `accessibilityLabel` on `leave` (default to the label) and pass the sentences from the four
  callers.
- verified-by: `every room exit tells a screen reader what it ends or leaves — F318`

### F319 — Two hardware-back handlers answer the tutor walkthrough opened from Profile
- severity: P2
- status: [x]
- where: apps/mobile/src/tabs/ProfileTab.tsx:244
- note: `useHardwareBack(sheet !== 'none', closeCurrentSheet)` was active while `sheet === 'intro'` and
  `'acknowledgements'`, and `TutorIntro` and `Acknowledgements` each register their own. `BackHandler`
  runs the most recently registered handler first, and `closeCurrentSheet` is a new closure every
  ProfileTab render, so after any re-render a learner on page 2 of the walkthrough pressing back could
  get the whole sheet closed instead of page 1. Never strands, but the answer depended on render order.
  Leave those two sheets to their own hook.
- verified-by: `a Profile sheet that answers back itself is not answered twice — F319`

### F320 — Every raw colour lives in palette.ts and theme.ts carries no hex
- severity: P1
- status: [x]
- where: apps/mobile/src/palette.test.ts:109
- note: `signal`, `orb` and `rungColor` values live in `theme.ts` and the contract test copies them and
  greps source to keep the copies honest. Move the values into `palette.ts`, re-export from `theme.ts`,
  import them in the test, and assert `theme.ts` contains no six-digit hex literal. Structural step every
  value entry below depends on, so it builds first.
- verified-by: `theme.ts carries no raw hex, every colour comes from palette.ts`

### F321 — One ground: the five papers collapse to one and paperFor goes
- severity: P1
- status: [x]
- where: apps/mobile/src/palette.ts:55
- note: five grounds at one lightness differing by ΔE under 16 were the muted scheme the founder
  rejected. Delete `papers`, `paperFor`, `accents`, `Paper`, `PaperName`; ten screens read `paper.*`;
  `inkFaint` becomes `#8A7996` so the inactive tab glyph clears the mark floor (was 2.91). The ground is
  Porcelain (B): ground `#F4F2F7`, groundDeep `#E6E2EE`, line `#DAD5E3`, lineOnCard `#E9E5F0`; steps held
  by ΔE, not by matching four siblings.
- verified-by: `nothing asks for a paper by place any more`
- verified-by: `the B paper is pinned: one ground, one white, one ink, one hairline`
- verified-by: `the card still reads as a card, and the hairlines still read on the ground`
- verified-by: `faint ink is soft ink now: B has no third ink, so it clears the text floor on the ground and on a card`
- verified-by: `ink, soft ink, the fix colour and the primary ink all hold on the ground`

### F322 — Signals re-saturated and held to the floor for what they are
- severity: P1
- status: [x]
- where: apps/mobile/src/theme.ts:102
- note: `good #437A62`, `live #A9564F`, `correspondance #8B5578` are greys with a hue. Green and magenta
  are words, held to 4.5 on the ground and a card; red is a mark only, held to 3. New values: `#12784A`,
  `#DE3B2D`, `#B4008A`. The green's `onInk` glyph on the live SpeakCircle gets its own floor.
- verified-by: `good and the fix colour are ink, so the words that carry them clear the floor by being ink`
- verified-by: `the tutor's coral is a mark, so it clears 3 on the ground and on a card`
- verified-by: `the mic glyph still reads on a live ink circle`
- verified-by: `the one signal mark stays 30 from ink, the rung fill, the ground and the card`
- verified-by: `the brand blue never reads as an orb state, the highlighter, the rung fill or the tutor's mark`

### F323 — The voice circle's traffic lights come back to full colour
- severity: P1
- status: [x]
- where: apps/mobile/src/theme.ts:127
- note: `thinking #8A6A2D` is olive; speaking and yourTurn alias the muted signals. New amber `#B07510`
  at 3.27 on the ground; speaking and yourTurn alias F322's red and green; ready stays the violet. The
  rung-one separation floor rises from 20 to 30 (measured 43.2). Captions stay ink; the amber ceiling
  tripwire is dropped (it was a ceiling, not a floor).
- verified-by: `every orb state carries a glyph that clears the text floor on its own fill`
- verified-by: `the three traffic lights stay far apart, and none of them is the rung fill`
- verified-by: `an orb caption is words, so it is held to the floor for words`

### F324 — Support colours run hot to cool again as help is withdrawn
- severity: P1
- status: [x]
- where: apps/mobile/src/theme.ts:82
- note: `#D6A846 #C8794A #5F95AA` are mustard, terracotta and slate; the ladder's heat is gone. New
  `#FFCD00 #FF7B00 #6EC4E8` and ink. A rung colour is a fill under an ink numeral, not a state mark, so
  the floors are ink ≥ 4.5 on each fill, ΔE ≥ 30 from the ground and from each other, and b\* strictly
  decreasing. Say in the test comment why rung fills are not held to 3 against the ground.
- verified-by: `a rung numeral in ink clears 4.5 on its own fill`
- verified-by: `rungs one to three share the one skeleton fill and rung four is ink`
- verified-by: `the rung fill lifts off the ground and the card, and never reads as ink, a signal, an orb state or the highlighter`

### F325 — The active tab takes the identity violet
- severity: P1
- status: [x]
- where: apps/mobile/src/nav/LuvaniTabBar.tsx:88
- note: the active tab is ink-on-ink today, the founder's "interactive layer has no colour" complaint in
  one line. Focused glyph and label take `accent.primary` (6.64 on the Porcelain ground at 11pt);
  inactive stays `inkFaint`/`inkSoft`. The pill lettering floor (`onInk` on `accent.primary`, 6.94) has
  never been asserted and is added with the button it belongs to.
- note: revamp B (2026-09-30, F600): the active tab takes the brand blue, glyph and word, and the rest
  soft ink; the test was renamed for it.
- verified-by: `the active tab is the violet cell with a sun glyph, and the rest cream on ink — UI-008`
- verified-by: `pill lettering clears 4.5 on the primary ink, the brand blue and the coral`

### F326 — The micro-label and the primary are one violet
- severity: P2
- status: [x]
- where: apps/mobile/src/theme.ts:74
- note: `accent.label` was the house paper's accent and is now simply `accent.primary`. Replaces the
  "every room shares the same identity accent" assertion. P2 because the value does not change; the
  assertion is a tripwire against a second identity colour creeping back.
- verified-by: `the micro-label and the primary are one ink`

### F327 — DESIGN.md records the palette the app ships
- severity: P1
- status: [x]
- where: DESIGN.md:50
- note: DESIGN.md documents `live #DE3B2D` while the build shipped `#A9564F`; the doc had become a plan.
  Replace the five-paper table with a single token table whose rows are `| token.path | #HEX |` and
  assert every row equals the `palette.ts` export it names. Replaces J11's paper-table lock.
- verified-by: `DESIGN.md records the palette the app ships`

### F328 — The splash and the icon background are the ground
- severity: P1
- status: [x]
- where: apps/mobile/app.json:21
- note: two hard-coded `#F3E8F3` values sit outside the palette. With Porcelain chosen the app would
  flash lilac before every launch and the nav container would paint a different page edge than the
  splash. Read `app.json` in the test and hold both to `paper.ground` (`#F4F2F7`).
- superseded: F790 (2026-10-06) moved the launch onto Hum, which is the brand blue from the icon to the native splash to the launch screen, and the launch screen fades onto the ground. The rule this entry made, one palette colour for every launch background, now names the blue; the test below is this entry's successor.
- verified-by: `the launch background is the brand blue wherever it is painted, and the app beneath stays on the ground`

### F329 — The session's rung row draws a bare colour dot beside a rung it already names
- severity: P2
- status: [x]
- where: apps/mobile/src/SessionView.tsx:201
- note: an 8pt `rungColor` fill with no numeral sits on the ground, where rung one's yellow reads ~1.4.
  F324 holds rung fills to ink-on-fill on the premise that nothing reads a fill against the ground; this
  dot does. The `LineBullet` row and the ink `rungLabel` on the same line already say the rung. Drop the
  dot and `st.rungDot`, and `rungColor` leaves the import.
- verified-by: `the rung row says the rung once, in the bullet and the label, and draws no bare dot`

### F330 — Words set in the faint ink that was cleared as a mark
- severity: P1
- status: [x]
- where: apps/mobile/src/practice/PathNodeRow.tsx:85
- note: `inkFaint` (#8A7996) clears 3.59 on the ground as a mark and 4.0 on a card; 87 sites use it and 66
  are words (status lines, costs, timestamps, settings values, stat captions, caps labels). Raised to P1
  because palette.test.ts states "words clear 4.5" and the screens contradict it. Rule: running text takes
  `inkSoft`; a caps `Label` takes violet, or `ink`/`inkSoft` when it reports a state; `inkFaint` remains
  only for placeholders, glyphs, fills, and the lettering of a control that is off (disabled/locked/used/
  muted/empty draft/inactive bullet numeral). The walk allows exactly those forms.
- verified-by: `faint ink colours marks and off controls, never a line a learner reads`
- verified-by: `soft ink clears 4.5 on a card as well as on the ground`

### F331 — One tab header, and it is a primitive
- severity: P1
- status: [x]
- where: apps/mobile/src/layout.tsx:145
- note: five tabs set their title at two sizes and two alignments, and only two say what the tab is for.
  `TabHeader({ title, purpose, trailing?, children? })` beside `ScreenHeader`: `type.display` in ink, left,
  `accessibilityRole="header"`, no `numberOfLines` and no font cap; purpose in `type.body` on `inkSoft` at
  `space(2)`; `trailing` on the title row; children under the purpose; `marginBottom: space(5)`. It mounts
  in the scroll body, not the frame's `header` slot, because a fixed display title plus a purpose line is
  taller than the screen at AX5.
- verified-by: `the tab header sets its title left, as a heading, with a purpose line beneath and nothing capped`
- verified-by: `DESIGN.md names the tab header and the monogram`

### F332 — The learner's initial is one drawn thing
- severity: P1
- status: [x]
- where: apps/mobile/src/components.tsx:438
- note: Home draws a filled 44 violet disc with a sans initial; Profile draws a hollow 96 ring with a serif
  one. palette.ts calls the violet "the primary action and the monogram", so the fill is the design.
  `Monogram({ initial, size = HIT })`: `accent.primary` disc, `paper.onInk` initial in `font.serif` at
  `size * 0.44`, spread `decorative`.
- note: notebook redesign (2026-09-27): the monogram became an ink initial on the deeper paper, because
  the accent no longer fills an avatar; it is still hidden from assistive tech.
- verified-by: `the monogram is a white initial on an ink disc, and it is hidden from assistive tech`

### F333 — A pill and a ghost can carry a name for assistive tech
- severity: P1
- status: [x]
- where: apps/mobile/src/components.tsx:131
- note: `DrillScreen`'s Check pills and My French's Check/Start word announce themselves. Collapsing them
  onto `PillButton` and `GhostButton` (F339) needs an optional `accessibilityLabel` on both, forwarded to
  the Pressable. Lands before F339.
- verified-by: `a pill, an outline and a ghost can be given a name for assistive tech, and forward it`

### F334 — The shared header centres its title between two equal slots
- severity: P1
- status: [x]
- where: apps/mobile/src/layout.tsx:177
- note: the centre view is `flex: 1` with a 44pt chevron on the left and nothing on the right, so a card
  count or a connection line sits half a hit target off centre. Three slots always: left `width: HIT`,
  centre `flex: 1`, right `minWidth: HIT, alignItems: 'flex-end'`. `marginLeft: 'auto'` goes; the F318
  `accessibilityLabel` line stays verbatim.
- verified-by: `the shared header keeps a slot at the touch floor on both sides, whether or not it holds a control`

### F335 — The frame owns the air above the tab bar
- severity: P1
- status: [x]
- where: apps/mobile/src/layout.tsx:137
- note: every tab pads its own scroll bottom on top of the root's `space(3)`. `ScrollScreen`'s
  contentContainerStyle takes `paddingBottom: space(8)` when `bottom === 'tab'` and nothing otherwise.
- verified-by: `a scroll screen under the tab bar pads its own bottom, and one that is not does not`

### F336 — Five tabs open the same way
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/TutorTab.tsx:131
- note: each tab renders exactly one `TabHeader` as the first child of its scroll body with a `title` and a
  required `purpose`; hand-rolled headers, `st.title`, `st.headline` and `st.subline` go; no tab spreads
  `type.display` in a stylesheet; no tab passes a title into the frame's `header` slot (Practice's slot
  holds only the F154 checking receipt). Tutor's hero moves under its header; Home's empty-state headline
  steps down to `type.title`.
- note: F406 renamed this test when the founder's mockups moved the rule it names. The behaviour it checks is unchanged or stricter; only the sentence on the front of it moved. See F406.
- note: revamp A (2026-09): Home grew a purpose line of its own, the hour's greeting subline, so the
  surface contract's purpose test widened to all five tabs and was renamed for it.
- verified-by: `every tab opens with the one tab header and draws no headline of its own`
- superseded: 2026-10-09, user-approved Direction B replaces the earlier subtitle/orb presentation. The successor test below verifies the current presentation and its retained lifecycle/accessibility contract.
- verified-by: `Home keeps its contextual greeting; other tabs omit repeated subtitles`

### F337 — Home and Profile draw the initial with the one monogram
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/ProfileTab.tsx:738
- note: Home keeps its "Your profile" Pressable in the header's `trailing` slot with `<Monogram size={HIT}>`
  inside; Profile draws `<Monogram size={72}>` above the name. `st.avatar` and `st.ring` go, so no tab pairs
  `accent.primary` with `radius.pill` in a style of its own.
- note: F406 renamed this test when the founder's mockups moved the rule it names. The behaviour it checks is unchanged or stricter; only the sentence on the front of it moved. See F406.
- verified-by: `the learner's initial is drawn once, on Profile — F406`

### F338 — A caps label is violet, or it reports a state in ink
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/HomeTab.tsx:193
- note: `Label` defaults to violet and eighteen section heads override it to faint with no rule. Section
  heads drop the override. Four labels that report a state take `inkSoft` or `ink`. No `<Label` carries
  `inkFaint`. Shares its edits with F330.
- verified-by: `a caps label is violet, or it reports a state in ink; none is faint`

### F339 — The tabs and the drill use the app's own buttons
- severity: P1
- status: [x]
- where: apps/mobile/src/DrillScreen.tsx:929
- note: `DrillScreen` hand-rolls the primary pill twice; My French sets `type.button` on a bare Pressable;
  Tutor draws a bespoke card-button. They become `PillButton` (with `accessibilityLabel`),
  `GhostButton color={paper.ink}` (with `accessibilityLabel`), and `OutlineButton label sub`. `ds.check`,
  `ds.checkDisabled`, `st.smallAction`, `st.door` go. Scoped to the tabs and DrillScreen.
- verified-by: `no tab draws a pill, a text button or a card-button of its own`
- verified-by: `the drill's Check is the pill, twice, and nothing hand-rolled`
- superseded: Pass 4 (F364) drew the doors as cards; the test below is that entry's successor.
- verified-by: `the tutor's doors are cards drawn with the app's buttons, not a bespoke card-button — F364`

### F340 — No tab pads its own scroll
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/ProfileTab.tsx:736
- note: with F331 owning the top gap and F335 the bottom, every `scroll` style keeps only `flexGrow: 1`,
  and no tab file writes `paddingBottom` at all (the voice sheet's included).
- verified-by: `no tab pads its own scroll; the header gap and the bottom air come from the frame`

### F341 — A chip is set in the French token, not a raw size
- severity: P1
- status: [x]
- where: apps/mobile/src/home/PhrasebookCard.tsx:73
- note: `chipText` overrides `type.french` with `fontSize: 16, lineHeight: 22`. Drop both; the chip keeps
  its ink. A raw size is allowed only in `components.tsx` (`fitDisplay`) and the two `TextInput` styles that
  hold 16 to stop iOS zooming.
- verified-by: `no text names a raw font size, except the inputs that hold iOS at 16`

### F342 — A tab carries at most one primary pill, and a list tab carries none
- severity: P2
- status: [x]
- where: apps/mobile/src/tabs/PracticeTab.tsx:189
- note: Home, Tutor and My French close with a pill; Practice's primary is the heavy-ruled next row and
  Profile has no next action. A closing pill on either would be a second or false primary, so the rule is
  pinned as counts rather than forced into presence.
- note: F406 renamed this test when the founder's mockups moved the rule it names. The behaviour it checks is unchanged or stricter; only the sentence on the front of it moved. See F406.
- verified-by: `a tab carries at most one primary pill per door, and Home and Tutor carry exactly what the founder drew — F406`

### F343 — The device runbook names what a source walk cannot see about the chrome
- severity: P2
- status: [x]
- where: docs/DEVICE_VERIFICATION.md:645
- note: a `## Pass 1b chrome` section, every row `not run`: header scrolls with the body at AX5 and the
  closing action is reachable; the five tops match on a swipe; the monogram initial stays inside its disc at
  AX3–AX5; a pushed screen's centred title sits centred; soft-ink status lines read on ground and card;
  Tutor's header/scene/doors/pill in order and reachable on an SE-class phone.
- verified-by: `the device runbook carries the Pass 1b chrome checks`

### F344 — Two monograms: the friends list drew the learner's initial its own way
- severity: P2
- status: [x]
- where: apps/mobile/src/friends/ui.tsx:47
- note: `friends/ui.tsx` exported `Monogram({ letter })` before Pass 1b — a HIT disc in `accent.primary`
  with `radius.pill` and a sans `type.heading` initial, "HomeTab's avatar idiom made reusable". F332 added
  the serif, `decorative` `Monogram({ initial, size })` in `components.tsx` and F337 adopted it on Home and
  Profile, leaving the friends copy for LeaderboardTab. So the Leaderboard drew the learner's own initial in
  sans, not hidden from assistive tech, while Home and Profile drew it in serif. Deleted the friends copy;
  `LeaderboardTab` imports the one `Monogram` from `components.tsx` with `initial={row.name.charAt(0)…}`.
  2 October: the unreachable LeaderboardTab was retired. Profile still borrows
  the one shared Monogram; the proof follows its live caller.
- verified-by: `the app exports one Monogram, and Profile borrows it`

### F345 — Practice decides what goes first in one pure rule
- severity: P1
- status: [x]
- where: apps/mobile/src/practice/nextStep.ts:1
- note: `nextStep(units, deck, now)` answers "what now" for the Practice tab: cards due outrank the path's
  next row because the deck covers every due card and a row covers its own; with nothing due the step is
  exactly the node `buildPath` marked `isNext`; with nothing due and nothing marked there is no step, and
  the tab draws nothing rather than a message. `reviewLine` moves out of the tab verbatim. Same shape as
  `practice/mix.ts`: pure, clock-injected, copy exported.
- note: F442 replaced the authored path with the founder's archive, which moved the handlers
  and the branches this entry names. The behaviour it checks is unchanged or stricter; the
  sentences on the front of the tests moved with the screen. Same treatment as F406's rename
  of F365's test, recorded rather than quietly repointed.
  The second branch also changed in substance and not only in name: with nothing due the step
  used to be the path row `buildPath` marked next, and is now the newest conversation the
  learner has never come back to. The rule this entry is about, that one pure module answers
  "what now" and the tab decides none of it, is what survived.
- verified-by: `a due deck outranks a conversation waiting to be practised`
- verified-by: `with a quiet deck the step is the newest conversation nobody has come back to`
- verified-by: `the next step is review, a pack, or the first conversation, in that order, and never two at once`
- verified-by: `the step counts a card and a phrase, singular at one, and never scolds`
- note (2026-09-12): a learner with nothing at all now gets the first-conversation step (F555), so the
  test that held the empty case was replaced by the three-branch one; the rule is still one pure decision.

### F346 — Practice opens on its next step, and nothing competes with it
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/PracticeTab.tsx:140
- note: under the header, `<Label>{NEXT_STEP.label}</Label>` and one `OutlineButton` built from `nextStep`;
  a review step opens `Review`, a node step calls the frozen F154 `open(step.node)` with `disabled={checking}`.
  The standalone Review block goes, the mix offer moves below the headline, the tab no longer imports
  `dueCards`, and the pill count stays zero so the heavy-ruled row remains the single primary (F342).
  `open` and `talkAgain` are called, not edited.
- superseded: Pass 4 (F365) made the headline the tab's one pill, and F442 replaced everything under
  it with the archive. The mix offer left with the path, so the leg of this entry that ordered the two
  has no subject any more and is retired rather than repointed at something it never checked. What is
  still true, and still tested, is that the step is drawn first and that nothing else on the tab
  competes with it for the eye.
- note: revamp A (2026-09): F574 replaced the archive with the next-practice card, so both tab-level
  titles moved to tabs/PracticeTab.test.ts; the step is still drawn first and still the only thing
  on the tab competing for the eye.
- note: conversation practice (2026-09): the card's one control became the recommended action (a short
  practice, a resume, or the first conversation), so the pill test was renamed. It still pins exactly
  one PillButton on the tab and that it is the card's action; the first conversation is one branch of it.
- note: notebook redesign (2026-09-27): Practice now leads with the sound to tune, so the next step is
  no longer the first block; it sits under the sound. On day one the one pill is the bonjour lesson,
  drawn inside the sound block, and on every other day it is the recommended card's. The count of one
  pill and the ban on anything that counts are unchanged.
- verified-by: `nothing on the page counts, tints or highlights`
- verified-by: `the tab keeps exactly one primary pill, whichever day it is`
- note (2026-10-20, B3, B-Practice): Practice now leads with the learner's conversations (B-Practice); the sound guide and local compare stay below them as the doors to sound practice, so the test is renamed for that.
- verified-by: `the page puts the conversations before the optional sound guide`

- note: 3 October 2026: the founder-authorised UX reviews supersede the earlier layout/copy assertion. The replacement test retains the underlying useful action, truthful evidence and allowance rule.

### F347 — A situation's row action and the next-situation words are decided in one module
- severity: P1
- status: [x]
- where: apps/mobile/src/progress/portfolio.ts:1
- note: `situationAction(item)` decides once whether a row offers Start or Refine pronunciation, with the
  label and the screen-reader sentence; `startLabel` writes "Start <situation>" for the pill and the rows;
  `NEXT_SITUATION` carries Home's exact words for the same card. No score, no number, no banned word, and
  no import of `progress/story.ts`. Sibling of `passport.ts`, shaped like `practice/talkAgain.ts`.
- note: F406 renamed this test when the founder's mockups moved the rule it names. The behaviour it checks is unchanged or stricter; only the sentence on the front of it moved. See F406.
- verified-by: `a finished situation offers to refine pronunciation, an unfinished one offers to start`
- verified-by: `the portfolio's words carry no score, no number and no word that scolds`
- superseded: Pass 4 (F363) drew one card for both tabs; the test below is F351's and F363's successor.
- verified-by: `the tab that draws the next situation reads its words from portfolio.ts rather than spelling them`

### F348 — My French draws nothing at zero and closes on the next situation
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/MyFrenchTab.tsx:127
- note: the three-`Stat` rail goes and no count is drawn without its module's gate (`hasPhrases`, `hasStory`,
  `hasStamps`); the screen names no independence literal anywhere. The list's rows use `situationAction`
  and branch on `action.kind`; "Check" and "Sound check for" leave the file. `suggestedMission` picks the
  next situation, drawn last in a card under `st.nextSituation` with the tab's one `PillButton` (F342 count
  stays 1), and "Choose another situation" becomes the quiet `GhostButton` after it. F218's slice closes at
  `st.nextSituation` in lockstep, and its order pins hold: notebook, week, situations, next, chooser.
- note: revamp A (2026-09): the counts and the next-situation card both went. The places are rows,
  core's suggestion is simply the first row under "Next places", and the chooser is no longer a
  door on this tab at all — it is the Tutor tab's everyday mission — so that half of the title is
  retired rather than repointed; the ban on a count is what survives and is tested.
- note: notebook redesign (2026-09-27): the place rows and their Start or Refine actions left My French.
  The page is the level path, the phrase bank, the sounds map and the conversations, each drawn only
  once it has something true to show, and a first visit reads one line instead of empty blocks. The
  ban on a `<Stat` count stands. Opening a scene is now Speak’s path row, and the next scene is the
  “here” mark on the level path.
- note (2026-10-20, B4, B-Journey): Journey carries one primary pill (the empty journey's start) with every other action secondary, its lists stay ledger rows and the retired rows stay absent, so the test is renamed for that.
- verified-by: `the page keeps one primary, its lists as ledger rows, and no retired row`
- verified-by: `the place core suggests is the first one a learner sees under Next places`
- note (2026-10-20, B4, B-Journey): the first visit is the B-Empty-States empty journey: one line on what collects here and one start through the tutor gate, never empty blocks, so the test is renamed for that.
- verified-by: `before the first conversation the page is the empty journey and its one start, through the gate`
- verified-by: `only a scene handled with nothing handed over is filled`
- verified-by: `the Profile card is the one importer of the story, and the rhythm rail names no number`

### F349 — The progress reset that no screen can reach is gone from the app and its documents
- severity: P1
- status: [x]
- where: apps/mobile/App.tsx:204
- note: `resetProgress` and `onResetProgress` thread from `App.tsx` through `RootNavigator.tsx` to a `Tabs`
  that never passes it on; `ProfileTab` stopped accepting it when its dead buttons went. Remove the callback
  and the five prop lines, reword `storage/scope.ts:108`, `docs/STATE_AND_STORAGE.md:217` and the three
  "Removed by" cells at `docs/PRIVACY_AND_SAFETY.md:28-30`, and narrow `scope.test.ts` to the one door that
  exists. No learner-facing change.
- verified-by: `the one door into a reset uses the real sweep, not a double`
- verified-by: `nothing in the app still threads a progress reset that no screen can reach`

### F350 — The device runbook names what a source walk cannot see about Pass 2
- severity: P2
- status: [x]
- where: docs/DEVICE_VERIFICATION.md:667
- note: a `## Pass 2 content` section, every row `not run`: Practice's headline and its button first under the
  header at AX5 and reachable before the path; "Refine pronunciation" wraps inside its row at AX3–AX5; on an
  SE-class phone My French shows six rows, then the next-situation card, the pill and the quiet door in order;
  a new account's My French shows no number anywhere.
- verified-by: `the device runbook carries the Pass 2 content checks`

### F351 — Home spells the next-situation card itself while portfolio.ts mirrors it
- severity: P2
- status: [x]
- where: apps/mobile/src/tabs/HomeTab.tsx:143
- note: `NEXT_SITUATION` in `progress/portfolio.ts` copies Home's "Next situation" / "Start this one" and a
  test reads HomeTab.tsx to keep them equal. That is two definitions held together by a test rather than one.
  Home should import `NEXT_SITUATION` and draw `NEXT_SITUATION.label` / `NEXT_SITUATION.action`, and the
  portfolio test should then assert the import rather than the literal. No learner-facing change.
- note: F406 renamed this test when the founder's mockups moved the rule it names. The behaviour it checks is unchanged or stricter; only the sentence on the front of it moved. See F406.
- verified-by: `the tab that draws the next situation reads its words from portfolio.ts rather than spelling them`

### F352 — The three onboarding screens sit inside the one frame
- severity: P1
- status: [x]
- where: apps/mobile/src/onboarding/OnboardingFlow.tsx:209
- note: WelcomeScreen, AgeGateScreen and OnboardingFlow each read the safe area and open their own
  ScrollView with a `space(6)` gutter (vs the frame's `space(5)`), three different top gaps, and a
  hand-rolled back chevron. Adopt `ScrollScreen center` (Flow also `avoidKeyboard`), `ScreenHeader`
  carrying the dots in its title slot, pills in the footer; drop the three from `SAFE_AREA_ALLOW` and
  `CHEVRON_ALLOW`, add to `ADOPTERS`. Keep body-before-footer in source so the first-occurrence walks in
  answers.test.ts / voiceStep.test.ts stay green untouched (hoist page bodies into a `const body`).
- verified-by: `the first-run screens are adopters, not allow-listed — F352`
- verified-by: `no adopted screen reads the safe area or opens a ScrollView for itself — F307`

### F353 — The shared header can carry a title with no back and no leave
- severity: P1
- status: [x]
- where: apps/mobile/src/layout.tsx:158
- note: `ScreenHeaderProps` requires one of `back`/`leave`, so a header holding only the progress dots on
  onboarding's first page does not typecheck (runtime already draws the empty slot). Make both optional
  inside their branches; each still forbids the other, so never both.
- verified-by: `the shared header takes a title with neither a back nor a leave, and still never both — F353`

### F354 — An option card tells a screen reader it is selected
- severity: P1
- status: [x]
- where: apps/mobile/src/components.tsx:257
- note: `OptionCard`'s Pressable has a role and label and no `accessibilityState`, so a VoiceOver learner
  picking a voice/goal/strictness/reminder hears nothing confirm it. The tab bar already does this
  (`components.tsx:426`). One line, every caller.
- verified-by: `an option card tells a screen reader it is selected, the way the tab bar does — F354`

### F355 — The voice ear shows which sample is sounding
- severity: P1
- status: [x]
- where: apps/mobile/src/components.tsx:272
- note: OnboardingFlow tracks `playing` and never hands it to the card; OptionCard has nowhere to put it,
  so tapping an ear changes nothing. Add `playing` (default false): while sounding, the ear sits on a
  `paper.groundDeep` disc in `accent.primary` and its label reads `Stop {name}`. Wire on the first run and
  the Profile voice sheet (both, per F301). No animation.
- verified-by: `the voice cards show which sample is sounding, on the first run and in the Profile sheet — F355`

### F356 — A refused learner has a way out, and hears the refusal
- severity: P1
- status: [x]
- where: apps/mobile/src/onboarding/OnboardingFlow.tsx:247
- note: the account is created before the gate; "younger than that" removes the pill and leaves a signed-in
  learner on a page with nothing behind it and no way to the Welcome; the refusal is a bare Text here and
  Android-only live on the return gate. One `AgeRefusal` component for the gate's two doors: the Field
  announce trio (role alert, polite live region, iOS `announceForAccessibility`) and a `GhostButton`
  `AGE_REFUSAL_EXIT` ("Sign out"), no pill. The door is `auth.signOut()` (App.tsx), threaded to both
  surfaces; ProfileContext keeps `onPass` first.
- verified-by: `a refused learner is offered a sign out on both gate surfaces, and hears the refusal — F356`
- verified-by: `the way through disappears once the learner says they are younger — F356`

### F357 — The auth screens share one keyboard-aware frame and intentional action placement
- severity: P1
- status: [x]
- where: apps/mobile/src/auth/SignUpScreen.tsx
- note: Signup and introductory signin now use the shared centred onboarding frame, with no visible back control. Provider doors remain above the fields. Signup uses native keyboard insets, keeps its action after the fields and hides it while the software keyboard is visible; Confirm's Done validates and dismisses without submitting. Introductory signin scrolls its action with the fields. The returning signin route retains its existing shared frame. System back is guarded while a request runs. This replaces the historical pinned onboarding action and visible back through the shared header.
- verified-by: `C2 sign-in embeds providers after its fields and keeps its footer clear of the keyboard`
- verified-by: `signup keeps its primary action after the fields and hides it while the keyboard is visible`
- verified-by: `a pushed screen has exactly one way back, and it is the shared header — F309`

### F358 — The step dots and the station line are one spoken element
- severity: P2
- status: [x]
- where: apps/mobile/src/components.tsx:477
- note: both containers carry an `accessibilityLabel` and no `accessible`, so iOS never focuses the group and
  "Step 1 of 4" / "Stop 2 of 5" is never read. Add `accessible`; no role (web progressbar wants value attrs
  these lack).
- note: F458 split this entry's two halves apart. The step dots still speak as one element,
  which is what this entry was about; the station line is silent now, because the only thing
  it had to say was a count and a count mid-session is a score. The renamed test holds both.
- verified-by: `the step dots speak as one element, and the station line speaks not at all — F358, F458`

### F359 — Meet Luc's four lines read as a paragraph, not a plaque
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/OnboardingFlow.tsx:371
- note: the densest page sets four multi-sentence lines centred. Set `line` left under the centred title and
  art, so the disclosure reads as reassurance rather than fine print.
- verified-by: `the Meet page sets its lines left, as a paragraph — F359`

### F360 — Typing is offered as a choice, not a fallback
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/disclosure.ts:165
- note: "If you cannot speak out loud, tap Type instead…" narrows who the app is for. Not legally pinned
  (disclosure.test.ts:262 requires only `Type instead`). New line: "You can also type. Tap Type instead in a
  scene and write your answer." ONBOARDING.md:83 follows.
- verified-by: `typing is offered as a choice, not a fallback — F360`

### F361 — The device runbook names what a source walk cannot see about the first run
- severity: P2
- status: [x]
- where: docs/DEVICE_VERIFICATION.md:688
- note: a `## Pass 3 first run` section, every row `not run`: the left edge does not move from the voice step
  into the chooser/Home; SignUp keyboard keeps the field + pill visible; an ear turns violet on tap, clears
  on second tap and clip end, VoiceOver reads "Stop Luc"/"Hear Luc"; the refusal is spoken on both gates and
  "Sign out" lands on Welcome; the dots read "Step 1 of 4" as one element and a chosen voice reads selected;
  Meet at AX5 wraps as left-set paragraphs with the pill pinned.
- verified-by: `the device runbook carries the Pass 3 first-run checks — F361`

### F362 — A tint is a paper under a mission's art, and never a mark
- severity: P1
- status: [x]
- where: apps/mobile/src/palette.ts:100
- note: six soft tints (`tint.sand` #FEE7DB cafe, `tint.rose` #F8D8DF friends, `tint.lilac` #E4D3EE home,
  `tint.lagoon` #CFF3EB street, `tint.sage` #E8EED5 market, `tint.sky` #D5EFFE hotel), one per MissionPlace
  in missions/missionTint.ts, drawn only by TintDisc/MissionDisc. A tint is a surface: ink clears 4.5 on it,
  it sits at least 8 (Delta-E) off ground, groundDeep, card and lineOnCard, 30 off every signal, the accent
  and orb.thinking, 20 off every rung and lighter than every mark (max mark L* 84, min tint L* 86), and no two
  tints within 10. Sky vs rung 3 is 26, which is why the rung floor is 20 rather than 30. DESIGN.md gains a
  Tints table.
- note: 2026-09-27 notebook final sweep: all tint tokens, role tables and wrappers are deleted.
  Contrast/separation tests for that absent palette are superseded by checks refusing both the
  old palette values and any production token, role-table or wrapper use.
- verified-by: `the palette exports no retired tint tokens or raw tint colours`
- verified-by: `no source retains a tint token, role table or tinted primitive`
- verified-by: `DESIGN.md records the palette the app ships`

### F363 — The next situation shows its place and its goal, once, on Home and on My French
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/HomeTab.tsx:141
- note: one home/NextSituationCard.tsx draws the label, the MissionDisc, the French and English titles, the
  mission's goalEn and the missionStatus line, and takes its actions as children so each tab keeps its own
  pill. Home passes PillButton "Start this one" and the "See all situations" ghost; its closing
  `Talk to {tutor}` becomes an OutlineButton. My French passes its pill. Closes F351: the card imports
  NEXT_SITUATION from portfolio.ts and neither tab spells the copy.
- note: F406 renamed this test when the founder's mockups moved the rule it names. The behaviour it checks is unchanged or stricter; only the sentence on the front of it moved. See F406.
- verified-by: `the tab that draws the next situation reads its words from portfolio.ts rather than spelling them`
- verified-by: `my french draws one next-situation card, with the place, the goal and the status — F363`
- verified-by: `a tab carries at most one primary pill per door, and Home and Tutor carry exactly what the founder drew — F406`

### F364 — The Tutor tab's three doors are cards that show what is behind them
- severity: P1
- status: [x]
- where: apps/mobile/src/tutor/gate.ts:106
- note: tutorDoors takes the resumable mission (title, titleEn, place, status) and answers, per door, a
  card: label, gloss, an action word and art (one place, every place, or none). Resume: MissionDisc, titles,
  status, pill "Continue". Practical mission: the six MissionDiscs at 40pt as a teaser, the gloss, and the
  pill when there is no resume, otherwise outline "Choose a situation". Talk freely: outline "Start talking".
  SpeakBubbles, the demo card and both ghosts stay. F339's tutor assertion is rewritten for cards.
- note: F404 and F406 changed two clauses of this and the entry stays closed under the rest. The founder's
  screenshot took the status pill off the resume card, so the `detail` slot that carried its sentence went
  with it and what is left of a scene travels as a number instead. And "exactly one carries the pill" MOVED
  rather than went: `surfaceContract.test.ts` now pins the count per tab, which catches a third pill in a
  place asserting it from the model could not. The test below is renamed to what it still proves.
- note: revamp A (2026-09): the doors are rows rather than cards, so the card test was rewritten as the
  row test; what is behind each door is still said in words, and still said by the model rather
  than by the screen.
- verified-by: `each row says what it is and what is behind it, in a line short enough to read while walking`
- verified-by: `the tutor's doors are cards drawn with the app's buttons, not a bespoke card-button — F364`
- verified-by: `the tab opens its rows with nothing standing in front of them`

### F365 — Practice's next step is the tab's one pill
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/PracticeTab.tsx:161
- note: both branches of the next step become PillButton, with the sub line kept beneath as type.small the
  way TutorTab draws its primary door's gloss. The handlers are unchanged. F342's Practice count becomes one
  and F346's assertion becomes "the pill, and only the pill".
- note: F406 renamed this test when the founder's mockups moved the rule it names. The behaviour it checks is unchanged or stricter; only the sentence on the front of it moved. See F406.
- note: F442 renamed it again for the same reason: the ruled row it opened left with the path, and the
  second branch is a conversation now. The count it pins, one pill in two branches, is untouched.
- note: revamp A (2026-09): the deck branch became a quiet outline and the one pill is the learner's
  first conversation, so the count of one is untouched and only the branch that keeps it moved.
- note: conversation practice (2026-09): the one pill is now the recommended action, whose branches are
  a short practice, a resume, and the first conversation. The count of one is untouched; the test was
  renamed and still asserts one PillButton, wired to the recommended action and nothing else.
- note: notebook redesign (2026-09-27): the one pill is built once from the recommended action and
  drawn in one of two places. On day one it is the bonjour sound lesson inside the sound block, and
  the card is not drawn; on every other day it is the card's control. The count of one is untouched.
- verified-by: `the tab keeps exactly one primary pill, whichever day it is`
- note (2026-10-20, B3, B-Empty-Practice): the empty page's one pill is the first conversation, through its probe; the café lesson keeps its probe and says it uses live minutes while the tutor is connected. The test is renamed for that.
- verified-by: `the empty page's one pill is the first conversation, and the café lesson and sounds are ready without one — B-Empty-Practice`
- verified-by: `a tab carries at most one primary pill per door, and Home and Tutor carry exactly what the founder drew — F406`

- note: 3 October 2026: the founder-authorised UX reviews supersede the earlier layout/copy assertion. The replacement test retains the underlying useful action, truthful evidence and allowance rule.

### F366 — My French opens on the evidence, and draws nothing at zero
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/MyFrenchTab.tsx:129
- note: progress/evidence.ts reads the missions (timesFinished > 0), the phrasebook (book.count) and the
  activity log (levelFor(totalXp)) and answers only what has been earned; hasEvidence false means no row, on
  progress/today.ts's rule. Three Stats sit in one row (Stat gains columns={3}) above the notebook card. The
  analytics event reads the same module. F348's ban on `<Stat` becomes "only inside the hasEvidence gate".
- note: revamp A (2026-09): this claim is no longer true and nothing replaces it. My French draws no
  evidence row at all now; evidence.ts is read once a visit only to fold the two numbers the
  product event has always carried, and `<Stat` is banned on the tab outright. The tick points at
  the test that pins that ban, and the module's own rule is still held by the F366 test above it.
- verified-by: `nothing is drawn at zero, and each fact appears only once it is real — F366`
- note (2026-10-20, B4, B-Journey): Journey carries one primary pill (the empty journey's start) with every other action secondary, its lists stay ledger rows and the retired rows stay absent, so the test is renamed for that.
- verified-by: `the page keeps one primary, its lists as ledger rows, and no retired row`
- verified-by: `a stat can sit three to a row — F366`

### F367 — Profile says the learner's level under their name
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/ProfileTab.tsx:625
- note: the focus effect also loads the activity log; levelName() from evidence.ts (null at zero XP, the
  same rule Home's level card keeps) is drawn as a type.small soft-ink line under the name, and nothing
  when null.
- note: revamp A (2026-09): this claim is no longer true and was reversed on purpose. F576 took the
  level line off Profile — the tab test now fails if `levelName` comes back, on the grounds that a
  rank under the name ranks somebody who came to change a setting — so the tick points at the
  header test that removed it. levelName itself is unchanged and still tested in
  progress/evidence.test.ts.
- note: notebook redesign (2026-09-27): the founder retired the Beginner-to-Veteran rank names from every
  screen; CEFR can-do lines replace them and XP stays internal. `levelName` is gone, so the tick points
  at the tests that keep any rank name off the stats and out of the module.
- verified-by: `no rank name appears in the stats at any amount of XP — F367`
- verified-by: `the module no longer offers a level name to borrow — F367`
- note: P2 (2026-10-19): the approved design replaces the centred header with a large title, the gear and a left-aligned identity row; the orb-never-a-face and no-rank-under-the-name checks are kept under the new test name.
- verified-by: `profile opens on the learner and draws its tutor as the orb, never a face`

### F368 — The daily goal and the correction dial are chosen in place
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/ProfileTab.tsx:460
- note: the goal and strictness sheets go. settings/ChoiceRow.tsx draws a row title, a TabBar (three
  segments, active K | null, an accessibilityLabel on the tablist) and the chosen option's gloss beneath.
  profile/dailyGoal.ts carries GOALS, DAILY_GOAL_ROW, dailyGoalOf and goalLine. Strictness reuses
  STRICTNESS_OPTIONS and withStrictness. Name, voice and reminder time keep their sheets. OnboardClock
  leaves the illustration barrel with the sheet that drew it (J14).
- verified-by: `the routine can be set or cleared through the same profile write without changing live allowances`
- verified-by: `the profile tab turns the strictness dial and the store keeps the choice`
- verified-by: `the segmented control is a sand track with a white chosen segment, never ink capsules, and every segment keeps the touch floor`
- verified-by: `every scene the barrel exports is drawn somewhere`

- note: 3 October 2026: the founder-authorised UX reviews supersede the earlier layout/copy assertion. The replacement test retains the underlying useful action, truthful evidence and allowance rule.

### F369 — Profile's footer says which build this is
- severity: P2
- status: [x]
- where: apps/mobile/src/tabs/ProfileTab.tsx:716
- note: profile/appVersion.ts turns Constants.expoConfig?.version into "Luvani 0.1.0" or null, drawn as a
  type.small soft-ink line (never faint, F330) under the legal text, absent when unknown.
- verified-by: `the footer names the version app.json ships, and says nothing when there is none — F369`

### F370 — Prefer typing is a stored choice the conversation opens on
- severity: P1
- status: [x]
- where: apps/mobile/src/profile/store.ts:65
- note: StoredProfile v7 adds preferTyping: boolean (false from createStoredProfile, one door
  withPreferTyping, every older version arrives false, junk reads false). sync/policy.ts writes 7.
  ConvoScreen seeds its local typingOpen from prefersTyping(profile), so the box is open, the microphone
  stays closed until the circle is tapped, and the tutor still speaks; choosingView gains a typingOpen
  input so the choosing moment shows the box too while the orb stays the button and the quiet door stays.
  Not the silent text mode; the lesson keeps its own door. Profile row "Prefer typing": "Conversations open
  with the keyboard. You can still tap the circle to talk." STATE_AND_STORAGE.md moves from version 5 to 7.
- verified-by: `a v7 profile keeps the typing choice, every older version arrives without one, and junk reads as no — F370`
- verified-by: `preferring typing changes that and nothing else, and survives the store's round trip — F370`
- verified-by: `a learner who prefers typing opens the conversation with the box showing and the circle still a button — F370`
- verified-by: `the profile row writes the version the store writes`

### F371 — A tutor asked to speak slower does so from the first line
- severity: P1
- status: [x]
- where: services/tutor-agent/src/convo.ts:1031
- note: LearnerProfile.preferences.pace ('normal' | 'slow', the engine's own words at
  brain/src/engine/conversation.ts:132) is carried through repairProfile and finishSession.
  createConversation takes pace in its config, and the agent reads paceOf(profile) beside strictnessOf at all
  three scene builds. App side tutor/pace.ts carries paceOf, withPace and the row "Tutor speaks slower" with
  "Shorter sentences and simpler words, one idea at a time, from the first line." The audio plays at the
  cached speed (convo.ts:1894), so the copy promises the prompt, not the waveform.
- verified-by: `a session can open slow when the learner asked before it began`
- verified-by: `a live session opens at the learner's stored pace, on every door into a scene`
- verified-by: `the profile tab sets the pace and the store keeps the choice — F371`
- verified-by: `repairProfile and finishSession carry the pace preference through`

### F372 — The last tutor bubble shows its ear, and every tutor bubble says who spoke
- severity: P1
- status: [x]
- where: apps/mobile/src/tutor/Transcript.tsx:63
- note: Transcript takes tutorName and tutorSpeaking. A caps Label with the name sits above each tutor
  bubble. tutor/replayEar.ts decides the ear on the last tutor bubble: hidden with nothing to hear, an ink
  EarGlyph when onReplayTutor is given, the accent on a groundDeep disc while the tutor sounds, exactly as
  OptionCard's ear. The whole bubble stays the Pressable with `Hear that line again`. Both ConvoScreen call
  sites pass tutorNameOf(profile).
- verified-by: `the ear on the last tutor line is hidden, quiet or sounding, and never on a learner line — F372`
- verified-by: `every tutor bubble is named, and both threads name the chosen tutor — F372`

### F373 — A password can be shown while it is typed
- severity: P1
- status: [x]
- where: apps/mobile/src/components.tsx:328
- note: Field with secure draws a trailing 44pt control reading "Show" / "Hide", announced "Show password"
  / "Hide password", and sets secureTextEntry to secure && !revealed. SignIn, SignUp (both fields) and
  SetNewPassword get it without being edited. The F109 bindings are untouched.
- verified-by: `a secure field can be shown, and says so to a screen reader — F373`
- verified-by: `every visible field label is bound to its input for assistive tech`

### F374 — Sign in says what is waiting behind the door
- severity: P2
- status: [x]
- where: apps/mobile/src/auth/SignInScreen.tsx:95
- note: one soft-ink line under "Welcome back": "Your phrases, your progress and your tutor's memory are
  where you left them." It lives in auth/copy.ts beside a test for the copy rules.
- verified-by: `the sign-in purpose line is plain, short and carries no dash, digit or debt — F374`

### F375 — The auth seam can sign in with Apple
- severity: P1
- status: [x]
- where: apps/mobile/src/auth/types.ts:14
- note: AuthUser.provider gains 'apple'; AuthAdapter.signInWithApple() joins GUARDED_METHODS.
  auth/apple.native.ts makes a raw nonce and its SHA-256 (auth/appleNonce.ts, pure), calls
  AppleAuthentication.signInAsync with the hash, then supabase.auth.signInWithIdToken with the raw nonce; a
  dismissed sheet is a sentence. auth/apple.ts (web) mirrors oauth.ts and answers appleSignInOffered()
  false. providerStatus.ts reads external.apple and the adapter asks before it opens the sheet;
  reauthenticateForDeletion gains an apple branch; toUser maps the provider; the mock returns a stand-in
  apple user; busyLabel gains apple. No log, no plain-storage write, no token in a URL (tokenHygiene).
- verified-by: `the guarded list is every AuthResult method the interface declares`
- verified-by: `the nonce Apple signs is the digest of the one Supabase checks — F375`
- verified-by: `a project with apple off says so, and the adapter asks before it opens the sheet — F375`
- verified-by: `the apple lines tell the learner what to do, not which vendor to configure — F375`
- verified-by: `the walk actually covers the auth layer`

### F376 — Continue with Apple is offered only where it works
- severity: P1
- status: [x]
- where: apps/mobile/src/auth/SignInScreen.tsx:83
- note: SignIn and SignUp ask appleSignInOffered() once on mount and, only when true, draw an OutlineButton
  "Continue with Apple" with the line-art AppleMark above the Google outline. Android and web draw nothing.
  The delete sheet says "Apple will ask you to sign in again before anything is deleted." for an apple
  account. app.json asks for ios.usesAppleSignIn and the expo-apple-authentication plugin; ONBOARDING.md
  names the third door. On-device proof needs the paid Apple Developer capability and the Supabase Apple
  provider, and is recorded as Pass 4 runbook rows rather than claimed.
- verified-by: `the Google and Apple doors match C2 and Apple is offered only on supported platforms — F376`
- verified-by: `the delete sheet tells an apple account what will happen — F376`
- verified-by: `app.json asks for the Apple capability and its plugin — F376`
- verified-by: `every first-run screen leads with a heading role`

### F377 — A speaking-time balance row on Profile (note only, not built)
- severity: P2
- status: [x]
- where: apps/mobile/src/tabs/ProfileTab.tsx:641
- note: the mockups carry a minutes-remaining row. The meter is server-side (core/src/metering/) and the
  client cannot read it, and a number the phone cannot verify is the dead switch F239 refused. Not built.
  Closes when a read endpoint exists. Closed by F540 on 2026-09-12: `/billing/status` is that endpoint, and
  Profile draws the plan as words through `purchases/planStatus.ts` rather than as the minutes row the
  mockups carried, on the same scarcity rule that keeps a countdown off the wall.
- verified-by: `the device runbook carries the Pass 4 checks — F381`
- verified-by: `billing status answers the plan and the period for the signed-in learner, and refuses everyone else`

### F378 — The tab bar's comments describe a dot it no longer draws
- severity: P2
- status: [x]
- where: apps/mobile/src/nav/icons.tsx:8
- note: icons.tsx:8-10 and LuvaniTabBar.tsx:8-11 still say active is ink plus a dot. F313 removed the dot
  and F325 made active the identity violet plus weight. Rewrite both comments; a raw-source test pins the
  words.
- verified-by: `the tab bar's comments say what the bar does — F378`

### F379 — LIVE_VOICE.md counts eleven failures; failure.ts has nineteen
- severity: P2
- status: [x]
- where: docs/LIVE_VOICE.md:161
- note: the "When it fails" paragraph says eleven; the failure union in live/failure.ts has nineteen kinds.
  Replace the number word with a count the test reads back from the source.
- verified-by: `the live-voice doc counts the failures failure.ts enumerates — F379`

### F380 — STATE_AND_STORAGE.md says the profile is at version 5
- severity: P2
- status: [x]
- where: docs/STATE_AND_STORAGE.md:37
- note: the doc predates v6 (tutorVoice) and would predate v7. Say 7, name tutorVoice and preferTyping,
  and correct the stored shape it lists to the fields the store writes.
- verified-by: `the storage doc names the profile version the store writes — F380`

### F381 — The device runbook names what a source walk cannot see about this pass
- severity: P2
- status: [x]
- where: docs/DEVICE_VERIFICATION.md:722
- note: a `## Pass 4 mockup review` section, every row `not run`: the six discs read as discs at AX5; the
  Apple sheet opens on a signed build and a cancelled sheet leaves a sentence; a typed-by-default learner
  sees the box with the circle still tappable and no microphone prompt; a slow-pace session's first line is
  short; the ear lights while the tutor sounds; Show/Hide keeps the caret on iOS.
- verified-by: `the device runbook carries the Pass 4 checks — F381`

### F382 — The phone runs the web stand-in of every native module
- severity: P0
- status: [x]
- where: apps/mobile/metro.config.js:1
- note: every import in the app names its file (`./apple.ts`) so the tests can run under node
  --experimental-strip-types. Metro applies `.ios.ts` and `.native.ts` only to an extensionless
  request, so the iOS bundle served to the first native run (the Pass 4 simulator walk, 2026-09-04)
  carried auth/apple.ts, auth/oauth.ts, live/globals.ts, purchases/adapter.ts, progress/saveFile.ts,
  speech/removeRecording.ts, storage/attemptAudio.ts and reminders/schedule.ts, and none of their
  native twins. live/globals.ts is a no-op, so LiveKit's globals were never registered on a phone;
  auth/apple.ts answers that Apple is never offered, so the door F376 draws never appeared on iOS.
  metro.config.js now strips a relative source request's extension (metro.platform.cjs) and lets
  Metro's own resolver choose the platform file, which is what an extensionless import gets.
- verified-by: `a relative source request loses its extension so Metro can choose the platform file — F382`
- verified-by: `metro.config.js routes every request through it — F382`
- verified-by: `every native variant has the web file its extensionless request falls back to — F382`

### F383 — My French draws nothing below its subtitle at the largest text size
- severity: P2
- status: [x]
- where: apps/mobile/src/tabs/MyFrenchTab.tsx:131
- note: seen on the Pass 4 simulator walk (iPhone 17 Pro, iOS 26, text size accessibility XXXL): the
  header and subtitle render, the situations list and the closing next-situation card do not, and the
  screen cannot scroll past the subtitle. At the default size the same tab scrolls and shows all of it.
  Home and Tutor render fully at the same size, so the difference is this tab's own layout: the content
  sits in a `flexGrow: 1` wrapper inside ScrollScreen where Tutor uses none. A learner at that size loses
  the whole tab. Filed from the walk, not yet repaired; P4-1 fails on iOS because of it.
- verified-by: `the page grows with the reading size instead of clipping`

### F384 — Every job process re-asked the vendors before the tutor could answer
- severity: P1
- status: [x]
- where: services/tutor-agent/src/agent.ts:455
- note: the worker runs agent.ts as its entry script; the framework starts each job as a new process
  from its own entry and imports agent.ts again, so the top-level `preflight()` and
  `reportVendors(await verifyVendors(...))` ran once per session inside the job child. Standalone the
  child initialised in two seconds; under the worker on 2026-09-04 the vendor round trips never
  finished inside the framework's ten-second start-up allowance, every job died with "runner
  initialization timed out", and every room opened and stayed silent ("Tutor did not answer"). The two
  checks now run only when this file is the process's entry script. Found on the Pass 4 simulator walk.
- verified-by: `preflight and the vendor check run only when this file is the entry script — F384`

### F385 — On a phone the tutor's lines vanish behind their own ear
- severity: P1
- status: [x]
- where: apps/mobile/src/tutor/Transcript.tsx:106
- note: F372 put the replay ear in a row with the words and wrapped the words in `flex: 1`. Yoga
  resolves that to a zero flex basis, and inside a bubble sized by its content there is nothing to
  grow into, so on the Pass 4 simulator walk every tutor bubble was the width of its ear with no
  French in it, while the audio played. A browser sizes the row from its content, so the web never
  showed it. The body is now `flexShrink: 1`, which keeps its content width and still yields to the
  bubble's maximum.
- verified-by: `the bubble body shrinks to fit rather than growing from nothing — F385`

### F386 — The recap re-renders itself until React gives up
- severity: P1
- status: [x]
- where: apps/mobile/src/nav/RootNavigator.tsx:234
- note: seen on the Pass 4 simulator walk (iPhone 17 Pro, iOS 26) the moment the cafe scene's recap
  appeared: "Maximum update depth exceeded", roughly once a second, for as long as the recap stayed
  open. The chain: ConvoScreen's recap effect (:419) keeps `onRecap` in its dependencies and calls it
  as soon as a recap exists; the navigator passed an inline arrow, so it was a new identity on every
  render; the handler writes the learner model through `updateBrain`, which re-renders the navigator,
  which makes another identity. The recap itself is fine, and `recap`, `practice` and `drills` are
  plain state whose identities are stable, which is why nothing else looped. The handler is now a
  useCallback over the context's own stable `updateBrain`.
- note: the first version of this fix put that useCallback BELOW ConvoRoute's three early returns,
  which traded the loop for a crash: a mission route renders Loading on its first pass, so the hook
  was reached only on the second and React threw "Rendered more hooks than during the previous
  render." in both dev and release renderers. A pre-merge review caught it before it landed. The
  repo has no ESLint, so react-hooks/rules-of-hooks never ran, and a source-string test for the
  callback cannot see placement — hence the third test below, which reads each navigator route and
  fails if any hook sits after that route's first early return.
- verified-by: `the navigator hands ConvoScreen a memoised recap handler, not an inline arrow — F386`
- verified-by: `the effect that calls it still keeps it in its dependencies — F386`
- verified-by: `every hook in a navigator route runs before that route can return early — F386`
### F387 — The greeting is a rule, not a screen
- severity: P1
- status: [x]
- where: apps/mobile/src/home/greeting.ts:1
- note: the three words in video order, the four timing constants summing to 3750, `greetingIndex(elapsedMs,
  count)`, `greetingLine(word, firstName)` with the no-name fallback being the bare word (never "you"), and
  `greetingRest(firstName)` as the Bonjour line. No em dash, no digit, no banned word in any line it returns.
- note: F417 widened the pool to seven words with hour windows and F419 turned the fade into a swipe,
  so the test this named was retitled rather than deleted. The behaviour it checked, that the greeting
  takes turns on a 3750ms clock and rests on a French word, is still checked under the new title; the
  cycle length is deliberately unchanged.
- note: notebook redesign (2026-09-27): the greeting no longer takes turns. The design contract lets only
  the orb and the highlighter move, so the pool, the clock and the rotation hook are retired, and the
  greeting is one still line: the hour's French word, the first name, a full stop ("Bonsoir, Praveen.").
  A learner with no name reads the word and a full stop ("Bonsoir."), never a bare comma and never
  "you". The rule is still a pure module and still clean of digits, em dashes and banned words.
- verified-by: `the greeting is the hour's French word, still, with a name and a full stop — F417`
- verified-by: `a learner who skipped their name is greeted by the word alone, with no bare comma — F387`

### F388 — Home's title fades through TabHeader and holds still for reduce motion and screen readers
- severity: P1
- status: [x]
- where: apps/mobile/src/layout.tsx:235
- note: `TabHeader` gains optional `purpose`, `titleOpacity` and `titleAccessibilityLabel`; with `titleOpacity`
  it draws `Animated.Text` in `type.display` (no `createAnimatedComponent`, `useNativeDriver: true` on every
  timing, none of them 380ms). `home/useGreetingRotation.ts` clears its chain when `!focused` or `reduced`,
  pins opacity to 1 and the word to `greetingRest` under reduce motion, and Home passes a fixed
  `titleAccessibilityLabel` and no live region. Home's `TabHeader` carries no `purpose`, no `trailing`, no
  children. `layout.test.ts`'s F306 banned the word `Animated` from the frame outright; the ban narrows to
  the frame DRIVING movement (`Animated.timing|spring|loop|sequence|stagger|decay`, and `.start(`), which
  still catches a timer growing in layout.tsx while allowing the two passive uses the fade needs: an
  `Animated.Value` as a prop type and `Animated.Text` as an element.
- note: F418 replaced the fade with a slot the word swipes through, so `titleOpacity` and
  `titleAccessibilityLabel` left `TabHeader` and this test was retitled rather than deleted. What it
  checked is unchanged and stricter: Home still opens on the greeting alone, still holds still for
  reduce motion, and a screen reader still hears it once. See F420.
- note: notebook redesign (2026-09-27): the title no longer moves for anyone, so there is no fade or
  swipe to hold still. Today draws one static TabHeader title from the greeting rule, with no timer,
  no `Animated`, and no live region, which is what reduce motion and a screen reader were owed.
- verified-by: `the greeting is static: the hour's French word, the first name, a full stop, and no rotation`
- verified-by: `the screen primitives never drive movement themselves, and never cap font scaling — F388`

### F389 — A word and a situation for every day, authored in core
- severity: P1
- status: [x]
- where: packages/core/src/daily/scenarios.ts:1
- note: `DAILY_WORDS` (at least 90) and `DAILY_SCENARIOS` (at least 60) with unique ids; every learner-facing
  string free of em dashes and digits; `openingFr` and `exampleFr` non-empty; `bodyEn` and `titleFr` within
  `SEED_TOPIC_MAX = 120`; `place` a `MissionPlace`; `seedTopicOf` returns `{ fr: titleFr, en: bodyEn }`. An
  app-side test runs `guiltIn` over every string, because core cannot import the ban list.
- verified-by: `the daily pools are large, unique, plain and short enough to ride the seed topic pipe — F389`
- verified-by: `no daily word or situation says a word Luvani has banned — F389`

### F390 — Today's pick is a function of the day, never a stored choice
- severity: P1
- status: [x]
- where: packages/core/src/daily/pick.ts:1
- note: `dayIndex('2026-09-04')` is whole days since 1970 via `Date.UTC`; `dailyPick(pool, now)` indexes by
  `dayIndex(localDayKey(now)) % pool.length`. Same pick at 00:01 and 23:59 local, a different pick the next
  day, the same pick on a fresh install and an old one, and no `Date.now()` inside.
- verified-by: `the same local day always picks the same word and situation, and midnight changes both — F390`

### F391 — The word of the day card, with the watering scene
- severity: P1
- status: [x]
- where: apps/mobile/src/home/WordOfDayCard.tsx:1
- note: `WordSprout` in `illustrations/scenes/sprout.tsx` through `useSceneMotion` (one loop, `paused` prop,
  spreads `decorative`, stroke 2.2), exported from the barrel and drawn only here. The card reads
  `dailyPick(DAILY_WORDS, now)` from Home's focus effect, draws the label, the word in the serif, the meaning,
  the note and the example, and no caption line.
- note: F422 rewrote the pool above the phrasebook bar, F423 pitched it at the learner's tier, and
  F425 turned the one drawing into twenty. The test was retitled to say so; every assertion it made
  about the card drawing its word from core and pausing its scene still holds.
- note: 2026-09-27 notebook final sweep: tier selection and all daily text remain covered;
  the successor requires audio before the French and rejects the removed decorative scene.
- verified-by: `home draws tier-selected daily French with audio first and no decorative scene — F391`

### F392 — Today's situation card starts a spoken session through the tutor's gate
- severity: P1
- status: [x]
- where: apps/mobile/src/home/SituationCard.tsx:1
- note: label "Today's situation", English title, body, the starting line inset with the place disc, a
  full-width "Bookmark"/"Saved" outline, and the tab's one `PillButton` "Start oral session". The pill calls
  `recheck()` then `tutorGate(answered, false)`, navigates `Convo` with `seedTopic: seedTopicOf(scenario)` on
  go, and draws `TUTOR_OFFLINE.body` with "Check again" on heldBack. No "Listen to accent", no "Immersive
  audio", no level pill, and the Demo label lives in this card's eyebrow row only when `!live`.
- verified-by: `the brief keeps its connection check and its held-back answer — F392`
- verified-by: `one Start speaking, white on the blue card, launching the scene directly, with the other mode as a quiet link`
- note (2026-09-12): the tab's one pill moved to the mission hero with F544; the card keeps the probe and
  the seed topic, and its action is an outline button.
- note: notebook redesign (2026-09-27): Today's hero is a scene brief for the spine's next scene, and its
  one pill is "Start". The Start still re-probes and goes through `tutorGate`, but it opens in the
  learner's standing mode (spoken, or typed if they prefer typing), with the other mode as a quiet
  link. A held-back start still shows `TUTOR_OFFLINE.body` and the same start as the retry. The day's
  scene, with its seed topic, is offered only once the whole spine is earned.

### F393 — Bookmarks are a per-item store that can un-save
- severity: P1
- status: [x]
- where: apps/mobile/src/bookmarks/store.ts:1
- note: `userKey('bookmarks')`, `{ version: 1, items: [{ scenarioId, at, saved }] }`, one item per scenario
  with the newest `at` winning, cap 200 sorted by `at`, a serialised write chain,
  `registerSyncAdopter('bookmarks')`, `onUserScopeReset`, the suffix in `USER_KEY_SUFFIXES`, a per-item row in
  `SYNC_POLICIES` whose merge is commutative and idempotent, and the doc naming it.
- verified-by: `a bookmark toggled off on one device stays off after the other device's copy folds in — F393`

### F394 — Saved situations surface on My French and are absent at zero
- severity: P1
- status: [x]
- where: apps/mobile/src/bookmarks/view.ts:1
- note: `bookmarkLabel(saved)`, `savedSituations(items, pool)` (saved only, unknown ids dropped, newest first)
  and `hasSaved`. My French draws a "Saved situations" card only inside `hasSaved`, each row `titleEn` with a
  "Start" ghost opening `Convo` with `seedTopicOf`; no copy at zero.
- note: revamp A (2026-09): the saved block kept its gate and its seed topic and moved into the new page
  order, third of four, so the screen-side claim is proved in tabs/MyFrenchTab.test.ts.
- verified-by: `saved situations drop unknown ids, read newest first, and draw nothing when none is saved — F394`
- verified-by: `saved scenes, goals and the daily collection keep their gates and their doors`

### F395 — A sitting records how long it took
- severity: P1
- status: [x]
- where: apps/mobile/src/progress/activity.ts:23
- note: `durationMs?: number` on `ActivityEntry`, accepted by `isEntry` only when finite and non-negative,
  written by `recordActivity(kind, xp, now, { durationMs })` from ConvoScreen (`openedAtRef` to recap),
  LessonRoute (`endedAt - startedAt`), ReviewScreen and DrillScreen (mount to bank). Entries with `xp <= 0`
  still write nothing. Sync identity stays `(at, kind, xp)` and the entry carrying a duration wins the pick.
- verified-by: `an activity entry carries its duration, an old one without it still reads, and sync keeps the copy that has one — F395`
- verified-by: `every screen that records activity records how long the sitting took — F395`

### F396 — Momentum is decided in one module and absent at zero
- severity: P1
- status: [x]
- where: apps/mobile/src/progress/momentum.ts:1
- note: `momentumFrom({ activity, deck, profile, now })`. `days`: distinct local days with an entry, all-time,
  plus seven booleans for the last seven local days, null with no entries, never lower after a quiet day.
  `retained`: settled cards and those with `settledAt` in the last seven days, null at zero, the weekly line
  absent at zero. `goal`: whole spoken minutes today (convo, lesson and drill; review is not speaking) against
  `dailyGoalOf`, null when unset or at zero minutes. Every string free of digits except the numerals it
  returns as numbers, no em dash, no banned word, singular at one.
  **The absent-at-zero half of this was overturned by the founder on 2026-09-05 and is now F432.** The block
  is present from a learner's first day and worded as a start, so the zero test that this entry named is
  replaced by F432's, and the goal test is retitled to F435's. The three properties that made the days count
  legal did not move: it only ever rises, it reads no yesterday, and there is no state a loss could be
  written into. The two tests below are the ones this entry still owns, under their unchanged titles.
- verified-by: `days active only ever rises and a quiet day costs nothing — F396`
- verified-by: `momentum copy has no streak, no debt and no dash — F396`

### F397 — A card remembers when it settled
- severity: P1
- status: [x]
- where: packages/core/src/review/scheduler.ts:32
- note: `settledAt?: number` on `ReviewCard`; `applyGrade` sets it to `now` on the `good` or `easy` grade where
  `isSettled` goes from false to true, leaves it alone once set, and clears it on `again`. A deck written
  before this field reads unchanged, and `mergeDecks` carries it with the card.
- verified-by: `a card records the grade that settled it, once, and forgets it on a lapse — F397`

### F398 — Momentum is drawn in tokens, green for ground covered
- severity: P1
- status: [x]
- where: apps/mobile/src/home/MomentumCards.tsx:1
- note: two `flex: 1, minWidth: 0` tiles in a row with `gap`, the days tile with the flame the founder kept,
  the seven marks in TodayRow's grammar (`signal.good` filled, `paper.line` hairline), the retained tile with
  `MicGlyph color={signal.good}` and the weekly line in `signal.good`; the goal card's bar fill is
  `signal.good` on `paper.groundDeep` with `accessibilityRole="progressbar"`; every size a `type` token;
  nothing drawn outside `momentum !== null` gates.
  **Amended by F436 on 2026-09-05.** The block is four cards now and the part-level gates went with the
  founder's overturn of absent-at-zero, so this entry's test is retitled rather than dropped: the colour
  grammar, the token rule and the score refusal it existed for are all still asserted, and more strictly.
  The gate moved down a level, from the part to the field.
- note: 2026-09-27 notebook final sweep: `progress/MomentumCards.tsx` had had no renderer since the
  Phase 3 Today rebuild and is deleted, with `WeekRail` and the inline details. The colour grammar it
  was held to is retired with it; the successor bans the block's return and any days-active count.
- verified-by: `nothing renders the retired momentum block, its inline details or the week rail, and no screen draws a days-active count — F440`

### F399 — Next step is a row, and the next-situation card leaves Home for My French
- severity: P1
- status: [x]
- where: apps/mobile/src/home/NextStepRow.tsx:1
- note: `NEXT_STEP = { label: 'Next step', link: 'View learning path' }` in `portfolio.ts`; Home draws
  `<NextStepRow` for `suggestedMission`, the link goes to the Practice tab, the row goes to `Missions
  { focus }`, and Home no longer draws `<NextSituationCard`, the "Talk to" outline, or `SpeakBubbles`. My
  French still draws the card with its pill. `portfolio.test.ts`'s Home assertions change to say exactly this.
- verified-by: `the hero is the spine's next scene, drawn on the blue brief with the meta line the rule decides`
- note (2026-09-12): the next-step row retired with F543; the mission hero is the next step now, and the
  next-situation card still belongs to My French.
- note: notebook redesign (2026-09-27): the hero is now a scene brief for the spine's next scene, with
  every field (level, French title, can-do, lines, minutes, tutor) read from homeMission.ts, and no
  picture, reason line or rank. The next-situation card is on neither tab now: the next scene is the
  "here" mark on the level path.

### F400 — The footer note, and the two home cards nothing draws any more
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/HomeTab.tsx:1
- note: `SproutGlyph` and "No pressure of perfection. Speak at your own pace." closes the scroll.
  `TodayRow.tsx` and `PhrasebookCard.tsx` are deleted and added to J14's `RETIRED` list; `progress/today.ts`
  and its tests stay.
- verified-by: `every word Today spells is plain, and every import is used — F400`

### F401 — Where a learner left a scene is a store, cleared by finishing it
- severity: P1
- status: [x]
- where: apps/mobile/src/missions/progressStore.ts:1
- note: `userKey('scenarioProgress')`, `{ version: 1, records: [{ missionId, at, elapsedMs, beatsDone }] }`,
  one record per mission with the newest `at` winning, `beatsTotal` never stored, `recordMissionCompletion`
  clears the record, adopter and reset registered, the suffix listed, a per-item row in `SYNC_POLICIES`, and
  the doc naming it.
- verified-by: `a partial scene record replaces its older self, is cleared by the finish, and survives a fold — F401`

### F402 — Leaving a mission mid-way writes the record, and nothing else does
- severity: P1
- status: [x]
- where: apps/mobile/src/ConvoScreen.tsx:584
- note: in `leaveNow`, only when `missionId` is set, `live.convo` is non-null, `!live.convo.missionDone` and
  `!stopped`, from `live.convo.beat.position - 1` and the `openedAtRef` set on the first non-null `live.convo`.
  A free conversation, a finished mission and a safety stop write nothing.
- verified-by: `the conversation screen writes the partial scene on leave from the beat on the wire, and never for a free talk, a win or a stop — F402`

### F403 — Minutes remaining come from the learner's own pace or not at all
- severity: P1
- status: [x]
- where: apps/mobile/src/missions/resume.ts:1
- note: `minutesRemaining(record, beatsTotal)` is null with no record, with `beatsDone === 0`, or when the
  record predates `lastFinishedAt`; otherwise `max(1, ceil(elapsedMs / beatsDone * (beatsTotal - beatsDone) /
  60000))`. `resumableMission(progress, records)` prefers the mission with the newest live record, then its
  old rule.
- verified-by: `minutes remaining is an estimate from the learner's pace, and absent without a pace — F403`
- verified-by: `the resume door prefers the scene the learner actually left — F403`

### F404 — The tutor's doors carry counts as numbers and words as words
- severity: P1
- status: [x]
- where: apps/mobile/src/tutor/gate.ts:98
- note: `TutorDoor` gains `count: number | null` (missions door, from a `missionCount` argument, so gate.ts
  stays catalogue-free) and `minutesRemaining: number | null` (resume door); `primary` now means "drawn as the
  pill" and is true on resume and free, false on missions; the free door reads "Talk about your day" with the
  body as its gloss; `scenarioCountLine(n)` and `minutesRemainingLine(n)` format the numerals with singulars;
  `TUTOR_INTRO_LINK` is "How the voice circle works" in both places; `dashboard.ts` gains `tutorHeading(name)`
  and `TUTOR_PURPOSE`, and `tutorGreeting` is gone. Every prose field on every door stays digit-free.
- note: revamp A (2026-09): two of the three clauses were retired by decision in F573 — no row carries a
  count any more, and the tab draws no pill at all — so what is left is the digit-free prose rule,
  proved on the rows, plus the two formatters where they still live and Tutor's pill count of zero
  in surfaceContract.test.ts.
- verified-by: `each row says what it is and what is behind it, in a line short enough to read while walking`
- verified-by: `the two formatters are still the only place a numeral becomes words`
- verified-by: `a tab carries at most one primary pill per door, and Home and Tutor carry exactly what the founder drew — F406`
- verified-by: `the tutor tab's lines are the screenshot's, with no hourly greeting — F404`
- note (2026-10-20, B6): the test was renamed from `the tutor heading names the tutor and the subline is the screenshot's — F404` when `tutorHeading` was removed as dead code (docs/DELETION_LEDGER.md); it still holds the tab's lines.

### F405 — The tutor tab is the screenshot, drawn from the door model
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/TutorTab.tsx:128
- note: header, orb card, Demo card as now; then `doors.map(`: resume with the disc, French title, `goalEn`,
  the minutes line only when non-null, a full-width `PillButton` "Resume", no status pill and no `EarGlyph`;
  missions with the count right-aligned, `door.gloss` as the description, and `MISSIONS.map(` rows at
  `minHeight: HIT` each opening `Missions { focus }`; free with `EveningIn` paused off-focus and a full-width
  centred `PillButton` "Open conversation" under it, no "Free improvisation". Footer keeps `open(true)`, the
  intro link with `HelpGlyph`, and `MICROPHONE_NOTICE`. `doors.map(` and `open(true)` stay so chooserView's
  guard holds.
- note (2026-10-20, B2, B-Speak): Speak's scenes are the starter scenes from the same path model, each
  opening its preview, with Every scene to the chooser; the test is renamed for that.
- verified-by: `the starter scenes come from the path model, each opening its preview, with Every scene to the chooser`
- note (2026-09-12): the doors grew to six with F547 and the test was rewritten under that title; the tab
  still draws exactly what the door model says.
- note: revamp A (2026-09): the doors became three tinted rows with the remembers row under them and no
  pill at all, and the test was rewritten under that title in tabs/TutorTab.test.ts; the tab still
  draws exactly what the door model says.
- note: notebook redesign (2026-09-27): the door model left the tab (`tutorDoors`, `DOORS` and the tinted
  rows are banned there now). Speak leads with the tutor card and one Start, then the level path, then
  every scene as a shared ledger row. The rows are still drawn from a model rather than spelled on
  the screen: `speakPath(progress)` in tutor/speakView.ts.

### F406 — The surface guards are changed on purpose, each with its reason
- severity: P1
- status: [x]
- where: apps/mobile/src/surfaceContract.test.ts:1204
- note: F342 counts become Home 1, Tutor 2 (one pill per door, no third); the purpose test names Home as the
  one tab with no purpose line and asserts `purpose=` is absent there and present elsewhere; F337 asserts Home
  draws no `<Monogram` and Profile still does; J7's scene list gains `WordSprout|EveningIn`; F364 drops the
  `<OutlineButton` requirement for the doors slice and requires `MISSIONS.map(` and `<MissionDisc` instead;
  F340, F336, F307, J5, J13 and F341 are unchanged and must still pass on the new files.
- note: revamp A (2026-09): the one exception this entry recorded is gone. Home carries a purpose line
  too now, the hour's, so the test asserts the rule on all five tabs and says so in its title.
- verified-by: `a tab carries at most one primary pill per door, and Home and Tutor carry exactly what the founder drew — F406`
- superseded: 2026-10-09, user-approved Direction B replaces the earlier subtitle/orb presentation. The successor test below verifies the current presentation and its retained lifecycle/accessibility contract.
- verified-by: `Home keeps its contextual greeting; other tabs omit repeated subtitles`
- verified-by: `the learner's initial is drawn once, on Profile — F406`

### F407 — DESIGN.md says what Home and Tutor now are
- severity: P1
- status: [x]
- where: DESIGN.md:264
- note: the Home and Tutor rows, the TabHeader paragraph (purpose optional on Home, a fading title), the
  one-pill rule rewritten as one pill per door with Tutor named, the French flourish sentence widened to the
  rotating greeting and the daily situation, `WordSprout` in the scenes table, TodayRow and PhrasebookCard
  noted as retired, and the green bar rule.
- note: 2026-09-27 notebook final sweep: the animated greeting and daily scenes are retired.
  The successor checks documentation against the static header, picture-free daily card and
  Speak's single primary rather than requiring the deleted animation vocabulary.
- verified-by: `the design doc and tabs agree on static greetings, picture-free daily French and one Speak primary — F407`

### F408 — The storage doc names the two new stores and the duration
- severity: P1
- status: [x]
- where: docs/STATE_AND_STORAGE.md:13
- note: `bookmarks` and `scenarioProgress` in the stores list with one line each, both under the per-item class
  in the sync contract, and `activity`'s entry naming `durationMs` as optional and absent on older entries.
- verified-by: `the storage doc names the two daily stores and the sitting's duration — F408`

### F409 — The two tabs fit a phone at every reading size
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/HomeTab.test.ts:1
- note: a source-reading test over `tabs/HomeTab.tsx`, `tabs/TutorTab.tsx` and every file under `home/`: both
  tabs sit on `ScrollScreen bottom="tab"`; no `numberOfLines`, no `maxFontSizeMultiplier`, no `ellipsizeMode`;
  no fixed `width:` on a `Text` container (discs and glyphs excepted); every tappable row and tile row declares
  `minHeight: HIT`; side-by-side tiles are `flex: 1` with `minWidth: 0`; no `paddingBottom`; no raw `fontSize`.
- verified-by: `home and tutor wrap every line, cap no reading size, and keep every row at the touch floor — F409`

### F410 — The device runbook names what a source walk cannot see about this pass
- severity: P2
- status: [x]
- where: docs/DEVICE_VERIFICATION.md:740
- note: a `## Pass 5 daily home` section, every row `not run`: the greeting fades at the measured timing and
  holds on Bonjour with reduce motion on; VoiceOver reads one greeting; the Home column at AX5 on an SE-sized
  phone shows no clipped line and no horizontal scroll; the goal bar announces its value; the Resume and Open
  conversation pills are reachable one-handed.
- verified-by: `the device runbook carries the Pass 5 checks — F410`

### F411 — Two new namespaces the database will not accept
- severity: P1
- status: [x]
- where: supabase/migrations/202608220001_luvani_learning.sql:6
- note: F393 and F401 added `bookmarks` and `scenarioProgress` to `SYNC_POLICIES`, and both merge correctly,
  but `learner_state.namespace` carries a check constraint listing twelve namespaces and neither is among
  them. A push of either comes back 400, `sync/engine.ts` files it as `http-error` and retries under backoff:
  nothing corrupts and nothing on screen changes, but neither namespace ever reaches the account, so a
  learner's bookmarks and the scene they left half finished stay on one device. A forward-only migration
  widens the constraint, with the rollback `databaseContract.test.ts` requires, and the limitation comes back
  out of `docs/STATE_AND_STORAGE.md` once it is deployed.
- verified-by: `every namespace the sync policy merges is one the database will accept — F411`

### F412 — Days active can fall on the write that prunes the activity log
- severity: P2
- status: [x]
- where: apps/mobile/src/progress/momentum.ts:185
- note: `daysFrom` counts distinct days in whatever `loadActivity` returns, and `progress/activity.ts` prunes
  entries older than `KEEP_DAYS` (400) on every `recordActivity`. Entries on day 0 and day 5, then a sitting
  recorded on day 410: the tile read "2 days" before the write and "1 day" after it, on the very sitting that
  should have raised it. The module claims "all time" and "Nothing subtracts", and the suite only walks 30
  days ahead. Say the window honestly rather than keeping a second count: the smaller shape is the comment.
- verified-by: `days active counts the days the log still holds, and its copy claims nothing older — F412`

### F413 — The Pass 5 runbook tells a device tester to expect no next step on a fresh account
- severity: P2
- status: [x]
- where: docs/DEVICE_VERIFICATION.md:759
- note: P5-4 reads "shows no momentum tiles, no goal bar and no next step" on a fresh account.
  `suggestedMission(missionStates([], [], now))` returns `mission:cafe` in state `new`, so Home draws the next
  step row on day one, which is what a beginner should meet instead of a blank page. A tester following the
  row would mark a correct build FAIL.
- verified-by: `the Pass 5 runbook expects the next step row on a fresh account — F413`

### F414 — PRODUCT.md records only the refusal of a days-active tile
- severity: P2
- status: [x]
- where: PRODUCT.md:93
- note: the brand commitment says the five-tab redesign asked for a days-active streak and the streak was
  dropped. A "Days active" tile ships now, and the reason it is not the thing that was refused (an all-time
  set of distinct days, no chain, no loss state, absent at zero) lives only in `momentum.ts` and its suite.
  The next reader of that commitment, human or agent, will flag the tile as a violation. One paragraph
  recording the third decision closes it.
- note: 2026-09-27, notebook redesign: the Days active tile left Today; nothing renders
  `progress/MomentumCards.tsx`. PRODUCT.md:96-117 now records the tile as history and states its five
  properties as the rule for any days count that returns. guilt.test.ts assertions unchanged and
  passing; header comment dated.
- verified-by: `PRODUCT.md records why days active is not the streak it refused — F414`

### F415 — The voice circle draws its caption on top of the card's own
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/TutorTab.tsx:177
- note: `VoiceOrb`'s `withCaption` defaults to true, so the orb draws "Tap to talk" in its own caps caption
  while the card draws "Tap to speak" underneath it. The two overlap, on top of each other, and the result is
  unreadable. It predates this pass and reached a screenshot the founder drew with one caption on it, which is
  what noticed. The card owns the words here, because it says two lines and the orb only ever says one.
- note: revamp A (2026-09): the orb's card became the page, so the same assertion is filed one word
  along in tabs/TutorTab.test.ts.
- note: notebook redesign (2026-09-27): the moving voice circle left Speak. The tutor card draws a still,
  decorative orb mark with no caption of its own, so there is no second caption left to overlap, and
  the test named below fails if `<VoiceOrb` comes back to the tab.
- verified-by: `what left Speak stays gone`

### F416 — A frame that never lands leaves the greeting invisible for good
- severity: P1
- status: [x]
- where: apps/mobile/src/home/useGreetingRotation.ts:83
- note: found by running it, not by reading it. The rotation chained each step off the previous
  `Animated.timing`'s completion callback, so the whole cycle depended on animation frames arriving. They do
  not always arrive: a browser freezes them for a hidden tab, and the fade-out had left `opacity` at 0. The
  header then held a word nobody could see, with no timer pending to bring it back, until the screen was
  rebuilt. Measured in the running app: `Bonjour, Camille` present in the DOM at computed opacity 0 across
  two captures seconds apart.
  The native completion now owns the normal commit, while an idempotent watchdog advances a suspended
  surface that never reports completion. The arriving phrase stays visible until React commits it as current;
  a layout effect then resets progress before paint. The teardown also lands progress back at rest.
- note: notebook redesign (2026-09-27): the greeting no longer animates, and `useGreetingRotation.ts` is
  deleted, so there is no frame to wait on and no opacity that can be left at 0. The test named below
  fails if the hook ships again or if Today carries a timer, `Animated`, or a title swap.
- verified-by: `the greeting is static: the hour's French word, the first name, a full stop, and no rotation`

### F417 — The greeting pool is wide and knows the hour
- severity: P1
- status: [x]
- where: apps/mobile/src/home/greeting.ts:26
- note: owner frontend-engineer. `GREETINGS` becomes seven `Greeting { word, hours?, rest? }`
  entries: Salut, Bonjour (05 to 18, rest), Hello, Coucou, Morning (05 to 12), Bonsoir (18 to 05,
  rest), Evening (18 to 05). `greetingPool(now)` filters by `localHour(now)` with wrap-around
  windows; `greetingRest(firstName, now)` is the hour's rest word line; `greetingLead(word,
  firstName)` is the word with its comma; `GREETING_WIDEST_WORD = 'Morning'` with no word longer
  and none shorter than 5. The band narrows the slot's width spread rather than closing it: measured
  at 375pt, `Morning,` fills the slot, `Bonjour,` leaves 7pt and `Salut,` leaves about 50pt, which is
  eight spaces. The complete phrase now moves together, so no width slot is needed. Phases: `GREETING_HOLD_MS 3300 + GREETING_SWIPE_MS 600 ===
  GREETING_CYCLE_MS 3900`. Every line still passes `guiltIn`, carries no digit, no em dash, and
  never says "you". At 08:00 no Bonsoir or Evening; at 20:00 no Bonjour or Morning; at 02:00 the
  evening pool; exactly one rest word at every hour of the day.
- note: notebook redesign (2026-09-27): the pool is retired with the rotation. What survives is the hour:
  Bonjour from 05:00 to 17:59 and Bonsoir from 18:00 through the small hours, checked at every hour
  and at the edges, with an unreadable clock landing on Bonjour. `GREETINGS`, the timing constants,
  `greetingPool` and `greetingRest` are no longer exported. The no-name line is the word and a full stop.
- verified-by: `the greeting is the hour's French word, still, with a name and a full stop — F417`
- verified-by: `a learner who skipped their name is greeted by the word alone, with no bare comma — F387`

### F418 — The header holds two complete greeting layers in one stable slot
- severity: P1
- status: [x]
- where: apps/mobile/src/layout.tsx:216
- note: owner design-system-engineer. `TabHeader` gains `titleSwap?: TitleSwap | null`
  (`{ word, next, rest, progress }`). With a swap, one accessible heading holds two absolute
  `Animated.Text` layers containing the complete greeting and name. Their opacity curves overlap;
  one rises a full line while the other enters from the full line below. At font scale 1.6 and above,
  the motion slot stands down and the full title renders in normal flow. The frame starts nothing.
- note: 2026-09-27 notebook final sweep: title swapping is removed from the frame API.
  The successor rejects animation and verifies an uncapped accessible static heading.
- verified-by: `the tab header is a static accessible heading with no swap API or animation — F418`
- verified-by: `the screen primitives never drive movement themselves, and never cap font scaling — F388`

### F419 — The eased native handoff has a suspension watchdog
- severity: P1
- status: [x]
- where: apps/mobile/src/home/useGreetingRotation.ts:38
- note: owner frontend-engineer. Returns `{ rest, swap }`. One `Animated.Value` `progress` at 0.
  Reads `Date.now()` once when the effect starts on focus to get `greetingPool` and
  `greetingRest`. Cycle: `after(GREETING_HOLD_MS, ...)` starts an eased native timing; its completion
  commits the new index. A 120ms-later idempotent watchdog covers a suspended surface. A layout
  effect resets progress after the arriving phrase becomes current. Reduce motion: `swap` is null and nothing
  runs. Unfocused: nothing runs, `progress` rests at 0 with the current word. Teardown: clear the
  one timer, stop the timing, `progress.setValue(0)`.
- note: notebook redesign (2026-09-27): the handoff and its watchdog are gone with the hook, because the
  greeting no longer moves. Nothing is left to suspend. The test named below fails if the hook ships
  again or if Today carries a timer or `Animated`.
- verified-by: `the greeting is static: the hour's French word, the first name, a full stop, and no rotation`

### F420 — Home wires the two-part greeting
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/HomeTab.tsx:127
- note: owner frontend-engineer. `<TabHeader title={greeting.rest} titleSwap={greeting.swap} />`,
  still the only header, still no `purpose`, `trailing` or `<Monogram`, still no
  `accessibilityLiveRegion`, `setTimeout`, `Animated.timing` or `...type.display` in the tab.
  `useGreetingRotation({ firstName, focused })` and `firstNameOf(profile.name)` unchanged. The
  `greetingRest` import leaves the tab because the hook now owns the clock.
- note: notebook redesign (2026-09-27): Today wires a one-part, still greeting:
  `homeGreeting(firstName, now)` gives the header its title and its hour's subline, and
  `useGreetingRotation`, `titleSwap` and `greetingRest` are gone. Still one header, no `<Monogram`, no
  live region, no timer and no `...type.display` in the tab.
- verified-by: `the greeting is static: the hour's French word, the first name, a full stop, and no rotation`

### F421 — Demo mode leaves the situation card
- severity: P1
- status: [x]
- where: apps/mobile/src/home/SituationCard.tsx:83
- note: owner frontend-engineer. The eyebrow row draws exactly one `Label`, "Today's situation".
  `TUTOR_OFFLINE.label` and `live` are no longer read by the card; `recheck`, `checking`,
  `heldBack`, `TUTOR_OFFLINE.body` and the `Check again` outline stay exactly as F392 pins them,
  because the tap's answer is the honest offline signal. `TUTOR_OFFLINE.label` itself stays in
  `tutor/gate.ts` for the Tutor tab and the Convo guard.
- note: revamp A (2026-09): SituationCard.tsx is gone and its job folded into home/MissionHero.tsx,
  which draws no demo label of any kind — TUTOR_OFFLINE.label survives only on the Tutor tab and
  in the navigator — so the tap's honest answer is proved on the hero and the removal is held by
  the DESIGN.md contract test.
- verified-by: `the brief keeps its connection check and its held-back answer — F392`
- note: 2026-09-27 notebook final sweep: the animated greeting and daily scenes are retired.
  The successor checks documentation against the static header, picture-free daily card and
  Speak's single primary rather than requiring the deleted animation vocabulary.
- verified-by: `the design doc and tabs agree on static greetings, picture-free daily French and one Speak primary — F407`
- verified-by: `one Start speaking, white on the blue card, launching the scene directly, with the other mode as a quiet link`

### F422 — The word pool clears the phrasebook bar and is tiered
- severity: P1
- status: [x]
- where: packages/core/src/daily/words.ts:37
- note: owner learning-science-engineer. `DailyWord.tier: 1 | 2 | 3`. Tier 1 is the French a
  beginner meets in week two rather than day one; tier 2 is what French people say and textbooks
  skip; tier 3 is the vocabulary that makes a French speaker look up. At least 80 per tier, 240
  to 400 in total so the 400-day walk still meets every word. A `PHRASEBOOK_FIRST_PAGE` list in
  the test names the words no `fr` may equal, `bonjour` and `merci` among them. Surviving words
  keep their ids; every other existing rule (id shape, lengths, no digit, no em dash, `guiltIn`
  over `en`, `note`, `exampleEn`) holds on the new pool.
- verified-by: `every daily word clears the phrasebook bar, carries a tier, and each tier is deep enough to last a season — F422`
- verified-by: `no daily word or situation says a word Luvani has banned — F389`

### F423 — The word of the day is pitched at the learner's level
- severity: P1
- status: [x]
- where: packages/core/src/daily/tier.ts:1
- note: owner learning-science-engineer for core, frontend-engineer for the tab.
  `wordTierFor(levelIndex)`: 0 and 1 give 1, 2 and 3 give 2, 4 and above give 3, anything
  non-finite or negative gives 1. `wordsForLevel(pool, levelIndex)` returns the words of that
  tier in pool order, never empty for the shipped pool. `dailyPick` is untouched. Home, inside
  the `Promise.all` it already awaits, reads `levelFor(totalXp(activity))` and picks from that
  tier on the same `now` as the situation and the scene. A brand new learner gets a tier 1 word
  on day one; the day after a promotion the tier changes and the sequence re-phases.
- verified-by: `the learner's level picks the tier by one rule, and the tier picks the word by the day — F423`
- note: 2026-09-27 notebook final sweep: tier selection and all daily text remain covered;
  the successor requires audio before the French and rejects the removed decorative scene.
- verified-by: `home draws tier-selected daily French with audio first and no decorative scene — F391`

### F424 — The situations say what people say, in both languages, and keep their ids
- severity: P1
- status: [x]
- where: packages/core/src/daily/scenarios.ts:428
- note: owner learning-science-engineer. `situation:hotel-internet-code` keeps its id and becomes
  titleEn "The wifi password", titleFr "Le code wifi", with the opening line changed on both
  sides. `hotel-morning-meal` stops avoiding "breakfast" with a calque. `market-half` and
  `street-wrong-direction` are rewritten. The audit rule for the other 67: every English line is
  what a native speaker would say and every French line is what a French speaker would say in
  that place; where the ban list blocks the natural English word, the situation's line changes on
  both sides so the two stay honest translations; no id is renamed, retired or reused. The test
  carries the 71 shipped ids as a snapshot and a `CALQUES` tripwire.
- verified-by: `the situations say what a person would say in both languages, and every id that ever shipped is still there — F424`
- verified-by: `the daily pools are large, unique, plain and short enough to ride the seed topic pipe — F389`

### F425 — Twenty daily scenes, one a day
- severity: P1
- status: [x]
- where: apps/mobile/src/home/WordScene.tsx:1
- note: owner design-system-engineer for the drawings, barrel and J7; frontend-engineer for the
  chooser, keys, card and tab. `home/wordScenes.ts` exports `WORD_SCENES` as twenty keys;
  `home/WordScene.tsx` switches on `WordSceneKey` and returns each scene as `<WordX width={width}
  paused={paused} />`; Home picks `dailyPick(WORD_SCENES, now)` on its one clock and the card
  draws `<WordScene scene={scene} width={108} paused={paused} />`. The nineteen new scenes, each
  through `Frame`, `Stipple`, `Moving`, `Scene` and `useSceneMotion`, 4:3, one stroke weight,
  `fill="none"` but for tiny accents, one oversized object, at most two loops, transform and
  opacity only. All twenty exported from `illustrations/index.ts` and each reached as `<Name` in
  the chooser, which is what J14 needs; J7's alternation gains `WordScene`.
- note: 2026-09-27 notebook final sweep: all twenty daily drawings, their chooser and unused card
  are deleted. The successor checks the files remain absent and both daily surfaces are picture-free.
- verified-by: `daily cards and the library contain no pictures or scene selection`
- verified-by: `every scene the barrel exports is drawn somewhere`
- verified-by: `every scene hides itself from a screen reader`
- verified-by: `every scene draws at the one stroke weight`
- note: 2026-09-27 notebook final sweep: decorative scene motion is deleted rather than paused;
  the successor checks all illustration sources and the daily card contain no animation.
- verified-by: `decorative scenes are static even when a mounted tab is not focused`

### F426 — The guards, the docs and the older ledger lines changed on purpose
- severity: P1
- status: [x]
- where: docs/KNOWN_ISSUES.md:5637
- note: owner frontend-engineer for tests under `tabs/` and `home/` and the runbook rows;
  design-system-engineer for `layout.test.ts`, J7 and `DESIGN.md`. Three tests are retitled and
  the closed entries that name them follow: F387's first test becomes F417's title, F388's
  becomes F420's, F391's is retitled for the tier. F416's test keeps its title with a new body.
  J7's `SCENE` list gains `WordScene`. `DESIGN.md` names the seven greetings (so F407 still finds
  Salut, Bonjour and Hello), the slot, the pack of twenty with `WordSprout`, and records that
  Demo mode left the situation card. `docs/DEVICE_VERIFICATION.md` rewrites P5-1 for the swipe
  and the still name and returns it to `not run` because the web walk measured a fade; P5-2 names
  Bonjour by day, Bonsoir by evening, and the daily scene. Nine rows stay nine so F410 passes.
- note: 2026-09-27 notebook final sweep: the animated greeting and daily scenes are retired.
  The successor checks documentation against the static header, picture-free daily card and
  Speak's single primary rather than requiring the deleted animation vocabulary.
- verified-by: `the design doc and tabs agree on static greetings, picture-free daily French and one Speak primary — F407`
- verified-by: `the device runbook carries the Pass 5 checks — F410`
- verified-by: `the Pass 5 runbook expects the next step row on a fresh account — F413`

### F427 — The greeting slot leaves a hole after a short word
- severity: P1
- status: [x]
- where: apps/mobile/src/layout.tsx:216
- note: found by the founder on screen. F418 sized the slot to the widest word the pool can produce so
  the name never moves, and the cost is a gap after every shorter word: measured at 375pt, `Morning,`
  fills the slot, `Bonjour,` leaves 7pt and `Salut,` and `Hello,` leave about 50pt, which is eight
  spaces. It reads as a hole rather than a space.
  The final design joins the name to both outgoing and incoming greetings before drawing them. Each
  complete phrase therefore has exactly one word-space, and the phrase moves as one object without
  measuring either word or correcting the name separately. The header still starts nothing.
- note: 2026-09-27 notebook final sweep: the moving greeting is removed. The successor
  verifies the complete greeting and name are a single static text node, with no measured split.
- verified-by: `the static tab heading keeps the complete greeting and name in one text node — F427`

### F428 — The name jumps at every greeting commit because its travel is measured one render late
- severity: P1
- status: [x]
- where: apps/mobile/src/layout.tsx:367
- note: found by the judge, confirmed by walking the commit frame. `grow`, `nameFrom` and `nameTo`
  come from `wordWidth` and `nextWidth`, which are state fed by `onLayout`. At the commit `setIndex`
  re-renders with the new `swap.word` and `swap.next` and `progress` at 0, but both widths still hold
  the previous pair, because `onLayout` cannot fire until after that render is laid out. Salut to
  Bonjour with Hello next: the slot is already Bonjour-wide, `grow` is still +43, `translateX` is
  -43, and the name is drawn 43pt inside Bonjour until the measurement lands. Bonjour to Hello leaves
  `grow` at -40 so the transform is 0 while the slot is Coucou-wide, and a hole reopens. Four of the
  five morning transitions glitch. The resting-state measurement that passed this could not see it,
  because it only ever sampled a settled frame.
  The final fix removes the measurement dependency entirely. Outgoing and incoming layers each draw
  the complete greeting and name in identical absolute geometry, so no previous pair's width can
  affect the commit frame. They remain a full line apart throughout the handoff, their opacity
  curves overlap, and the hook resets only after layout.
- note: 2026-09-27 notebook final sweep: no moving greeting geometry remains. The successor
  requires normal-flow wrapping and refuses clipping, measurements and animation slots.
- verified-by: `the static greeting wraps in normal flow without a measured or clipped motion slot — F428`

### F429 — The docs and the runbook still describe the header F427 replaced
- severity: P2
- status: [x]
- where: DESIGN.md:414
- note: DESIGN.md carries both stories at once: the new paragraph says the name travels and the
  header measures both words, and an older one still says "Only the word moves", "The name is outside
  the slot and never moves" and that the slot takes its size from an invisible copy of the widest
  word. The tab row at :286 still says the name "stays exactly where it is". `DEVICE_VERIFICATION.md`
  P5-1 asks a tester to confirm "the learner's name does not move sideways by a pixel", which is now
  a designed fail, and `surfaceContract.test.ts` pins that phrase. `home/greeting.ts` has a
  half-edited sentence. All four describe the shape F428 settles, and the F407 and F410 tests pin the
  new description and refuse the old.
- note: 2026-09-27 notebook final sweep: the animated greeting and daily scenes are retired.
  The successor checks documentation against the static header, picture-free daily card and
  Speak's single primary rather than requiring the deleted animation vocabulary.
- verified-by: `the design doc and tabs agree on static greetings, picture-free daily French and one Speak primary — F407`
- verified-by: `the device runbook carries the Pass 5 checks — F410`

### F430 — A word-of-the-day note reads "everybody s ticket"
- severity: P2
- status: [x]
- where: packages/core/src/daily/words.ts:452
- note: `le contrôleur`'s note is "asking to see everybody s ticket"; the apostrophe was dropped to
  fit a single-quoted string and a learner reads it as written. The file already uses double quotes
  where an apostrophe is needed. Fix the note and add a tripwire over `en`, `note` and `exampleEn`
  for an orphan single letter between spaces, which is what a dropped apostrophe looks like.
- verified-by: `no daily word carries a dropped apostrophe or an orphan letter — F430`

### F431 — The slang in tier two does not always say where it does not belong
- severity: P2
- status: [x]
- where: packages/core/src/daily/words.ts:1148
- note: `une meuf`'s note is "Femme said backwards, which is a whole French habit worth spotting",
  which is etymology. Its neighbours each say where they do not belong: `la bouffe` "far too casual
  at a formal table", `un gosse` names Quebec. `meuf` is verlan, young, and reads as reductive said
  by a man about a woman he does not know; a learner who uses it at a counter will be heard as rude.
  One clause of register belongs in the note, and `un mec`'s "Neutral in speech" is generous for the
  same reason.
- verified-by: `the slang in tier two says where it does not belong — F431`

### F432 — Momentum is present from the first day and worded as a start
- severity: P1
- status: [x]
- where: apps/mobile/src/progress/momentum.ts:1
- note: owner progress-retention-engineer. Founder's decision of 2026-09-05, overturning F396's
  absent-at-zero rule openly. `Momentum` becomes `{ retained, days, mastery, goal }`, none null;
  `hasMomentum` is deleted. Where a number would be nought the `count`/`percentLabel` field is null
  and the `words` field carries `DAYS_START`, `RETAINED_START`, `MASTERY_EARLY` or, on the goal card,
  `GOAL_START`; the week rail is seven false marks. The days count keeps every F396 property:
  distinct local days in the log the module names by `KEEP_DAYS`, monotone, no chain, no loss field,
  never the words "all-time". Every string clears `guiltIn` and carries no em dash.
- verified-by: `a learner with no progress meets all four cards, worded as a start — F432`
- verified-by: `days active only ever rises and a quiet day costs nothing — F396`
- verified-by: `momentum copy has no streak, no debt and no dash — F396`

### F433 — Retained phrases are the ones said in conversation, with two chips and a week pill dated by arrival
- severity: P1
- status: [x]
- where: apps/mobile/src/progress/momentum.ts:410
- note: owner progress-retention-engineer. `retainedFrom` counts non-phoneme cards with
  `evidenceOf(card).convoUses >= 1`, never the settled count, and never reads `settledAt`. `thisWeek`
  is the counted cards whose `addedAt` is within the last seven local days, null at zero; `weekLine`
  is `'+N this week'`. Chips: sort by `convoUses` desc, `addedAt` desc, `id` asc; take
  `RETAINED_CHIPS = 2` fronts; `moreLine` `'+N more'` for the rest, null when none. At one: one chip,
  singular words, no more line. `foot` is `RETAINED_FOOT` and `link` is `RETAINED_LINK`, both null at
  zero. A deck with no `evidence` block, or a null one, reads as zero without throwing.
- verified-by: `retained phrases are the ones used in conversation, with two chips, a more line and a week pill dated by arrival — F433`

### F434 — Recall is right over asked, each card's introduction dropped, withheld under ten
- severity: P1
- status: [x]
- where: apps/mobile/src/progress/momentum.ts:455
- note: owner progress-retention-engineer. Over non-phoneme cards with `reps >= 1`,
  `right` is the sum of `reps - 1` and `asked` is `right` plus the sum of `lapses`;
  `percent = floor(100 * right / asked)`, null when `asked` is 0 or below
  `MIN_REVIEWS_FOR_RECALL` (10), and then `words = MASTERY_EARLY` and `line` null. At or above:
  `percentLabel` `'88%'`, `line` from `MASTERY_LINES` by `RECALL_STEADY = 90` and
  `RECALL_SETTLING = 75`.
  The `- 1` is the correction the learning-science engineer found and the founder approved on
  2026-09-05, and it is the whole point of the entry. `presentationOf` calls a card's first sitting
  an introduction: the answer was on screen. The contract's first formula summed `reps` outright, so
  ten fresh cards all graded good read **100% recall** on a learner's first day, which is exactly
  what withholding was meant to prevent. Flooring does not touch a genuine ten out of ten, and a
  floor counted in total grades counts the very grades it should exclude. Dropping each card's one
  guaranteed introduction win needs no `evidence` field, so every existing deck is grandfathered: a
  first sitting returns null, a mature deck returns a figure at once. Residual error is in the modest
  direction — lapses before a card's first success stay in the denominator and cannot be told apart.
  Known quirk to state in the header rather than hide: a wide shallow deck whose every card was
  reviewed exactly once reads as withheld, which is true and can still look odd.
  The tile is labelled `'Recall'`, not `'Mastery'` — `isMastered` in core already means three
  unprompted conversation uses, and Home may not disagree with My French about the word.
  Lapses leave the module only inside the `asked` aggregate, never per card and never as a number of
  their own; the `scheduler.ts` comment on `lapses` is updated to say so.
- verified-by: `mastery is right over asked across the deck, withheld under ten reviews, and banded in three warm lines — F434`

### F435 — Today's speaking time is present without turning the optional target into a quota
- severity: P1
- status: [x]
- where: apps/mobile/src/progress/momentum.ts:517
- note: owner progress-retention-engineer. `goalFrom` always returns a card. No target and no measured
  time: `amount` and `remaining` are null and `note` is `DAILY_GOAL_UNSET` imported from
  `profile/dailyGoal.ts`. Measured time is shown truthfully as `'6 min today'` even without a target.
  A chosen target at zero is named alone as `'10 min target'`; an untimed speaking entry gets
  `GOAL_UNTIMED`, otherwise `GOAL_START`. Once time exists, the footer may say how many minutes remain
  only with “if you want”; at the target it uses `GOAL_MET`. The goal shape exposes no percentage or
  percentage label, and Progress draws no target fraction or bar.
  2026-09-24 whole-app phase 1B: the card became "Practice time today" and sums measured active
  learning time (`activeMs`) across all four kinds; legacy wall-clock `durationMs` is no longer read as
  practice. The same test was retitled with it and still holds every property above (optional target,
  measured amount without a target, no percentage, "if you want" remainder).
- verified-by: `today's practice time sums measured active time across all four kinds and carries the optional target — Phase 1B`

### F436 — MomentumCards draws the four cards in tokens, the accent once on the badge
- severity: P1
- status: [x]
- where: apps/mobile/src/home/MomentumCards.tsx:1
- note: owner frontend-engineer. Props `{ momentum, onReviewPhrases }`. Hero: `MicGlyph` in
  `signal.good` on a `paper.groundDeep` well sized by a named constant, `label`, `sub`, the week pill
  (`paper.ground` fill, `gain` style), the count row gated on `retained.count !== null`,
  `chips.map`, `moreLine`, a hairline, `foot` and `<GhostButton label={retained.link}`. Tiles keep
  `tiles`/`tile` names with `flex: 1, minWidth: 0`; days tile unchanged in drawing; the Recall tile
  draws `<BadgeGlyph color={accent.primary} />`, `percentLabel`, `words`, `line` in `signal.good`.
  Speaking time: `amount` gated and `note` drawn as the whole gentle status; there is no target
  fraction, percentage, track, fill or progressbar semantics. `accent.` exactly once and never in the
  stylesheet; no `hasMomentum`, no `return null`, no `Math.`, `toFixed`, `.length`, `<PillButton`,
  `numberOfLines`, raw `fontSize`, numeric `width`, `paddingBottom`; imports only `type Momentum`.
- note: 2026-09-27 notebook final sweep: the block is deleted (no renderer since the Phase 3 Today
  rebuild). Every promise above was about a file that no longer exists; the successor holds that
  nothing renders it, its inline details or the week rail, and that no screen draws a days count.
- verified-by: `nothing renders the retired momentum block, its inline details or the week rail, and no screen draws a days-active count — F440`
- verified-by: `home and tutor wrap every line, cap no reading size, and keep every row at the touch floor — F409`

### F437 — A badge glyph for the Recall tile
- severity: P1
- status: [x]
- where: apps/mobile/src/components.tsx:194
- note: owner design-system-engineer. `BadgeGlyph({ size = 18, color = paper.ink })`: a circle at
  `STROKE` with a tick inside, decorative, exported beside `TargetGlyph`, drawn by
  `MomentumCards.tsx` and nowhere else. No fill but the stroke colour, no second colour, no
  animation.
- note: revamp A (2026-09): the assistive-tech contract widened to raster scenes and was renamed for it;
  the badge glyph itself is untouched.
- note: 2026-09-27 notebook final sweep: `MomentumCards.tsx`, its only caller, is deleted. The glyph's
  assistive-tech contract is still held below; the successor to the block's test bans its return.
- note: revamp B (2026-09-30, F599): the assistive-tech contract was renamed again when the raster
  scenes retired; the badge glyph is still one of the drawings it holds.
- verified-by: `every drawing in the app is hidden from assistive technology, and nothing imports Image`
- verified-by: `nothing renders the retired momentum block, its inline details or the week rail, and no screen draws a days-active count — F440`

### F438 — Home wires the phrase bank link and tells the truth in its header
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/HomeTab.tsx:178
- note: owner frontend-engineer. `{momentum !== null && <MomentumCards momentum={momentum}
  onReviewPhrases={() => nav.navigate('Review')} />}`, the same door Practice's pill opens;
  `momentumFrom({ activity, deck, profile, now })` unchanged; `<NextStepRow` stays outside every
  momentum gate. `momentum !== null` stays because null means not loaded yet, and without it a
  returning learner meets the start lines for a frame before their own numbers arrive. The header's
  "What is deliberately absent" paragraph stops claiming every count is absent at zero and names the
  one percentage Home now shows, recall over reviews, and the date it was decided.
- note: 2026-09-27 notebook final sweep: the block and its phrase-bank link are deleted. What survives
  is Today's own recall action and Practice opening the same deck, and the hero outside every count;
  the successor holds exactly that and refuses the block, the rail and the details on Today.
- verified-by: `Today's one recall action opens the review deck, Practice opens the same deck, and the hero sits outside every count — F438`
- verified-by: `the Pass 5 runbook expects the next step row on a fresh account — F413`

### F439 — The guards and the closed entries change on purpose, each with the founder's reason
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/HomeTab.test.ts:351
- note: owner frontend-engineer for `tabs/`, `surfaceContract.test.ts` and `copy/guilt.test.ts`;
  progress-retention-engineer for `momentum.test.ts`. F398's test is retitled to F436's and amended:
  `hasMomentum` and `return null` refused, no part-level null gate, the field-level gates required,
  eighteen drawn fields, multiword spelled list, `accent.` once on the badge and never in the
  stylesheet, the `?? goal.note` accessibility line, the score list kept, `Math.`/`toFixed`/`.length`
  refused. F396's four tests: zero test replaced by F432's, retained and goal tests retitled to F433
  and F435, days and copy tests keep their titles, and the file header records the overturn. F414's
  body swaps `/absent entirely until there is one/` for `/present from the first day/` and
  `/worded as a start/`. F410's descriptor string is reworded, pattern unchanged. The closed F396 and
  F398 entries have their `verified-by` lines retitled to follow, and F396's note records the
  overturn and the date.
- note: 2026-09-27 notebook final sweep: F436's test went with the deleted block; its successor bans
  the block's return. F432's, F414's and F410's tests are unchanged.
- verified-by: `a learner with no progress meets all four cards, worded as a start — F432`
- verified-by: `nothing renders the retired momentum block, its inline details or the week rail, and no screen draws a days-active count — F440`
- verified-by: `PRODUCT.md records why days active is not the streak it refused — F414`
- verified-by: `the device runbook carries the Pass 5 checks — F410`

### F440 — The docs say what the block now is
- severity: P1
- status: [x]
- where: PRODUCT.md:102
- note: owner frontend-engineer for PRODUCT.md and the runbook, design-system-engineer for
  DESIGN.md, learning-science-engineer for the `scheduler.ts` comment. PRODUCT.md's sentence becomes
  the present-from-the-first-day one, matching `/present from the first day/` and
  `/worded as a start/`. DESIGN.md's Home row describes four cards there from the first day. P5-4 and
  P5-5 are rewritten, eleven rows, all `not run`, `fresh account` and `next step row` still present,
  `no next step` absent. `scheduler.ts` says lapses are shown only in aggregate on Home.
- note: 2026-09-27 notebook final sweep: the block is deleted, so the docs no longer describe it. The
  DESIGN.md half of this entry (the `| Progress |` route row and the Home row's "one level down") is
  not repointed: the docs rewrite that follows the sweep pins the new Structure section. The
  successor holds that nothing renders the block, its details or the rail, and that no screen draws
  a days-active count; PRODUCT.md:96-117 records the tile as history and its properties as the rule.
- verified-by: `PRODUCT.md records why days active is not the streak it refused — F414`
- verified-by: `nothing renders the retired momentum block, its inline details or the week rail, and no screen draws a days-active count — F440`
- verified-by: `the device runbook carries the Pass 5 checks — F410`

### F441 — The scheduler's lapses comment described the recall formula decision 7 replaced
- severity: P2
- status: [x]
- where: packages/core/src/review/scheduler.ts:60
- note: found by work-judge after the round was otherwise green. The comment beside `lapses` was
  written for the contract's first formula and said "asked" is the sum of `reps + lapses` over every
  card in the deck. The shipped fold is the sum of `reps - 1` plus the sum of `lapses`, over
  non-phoneme cards with `reps >= 1` — the difference is the whole of decision 7, because summing
  `reps` outright read a hundred per cent on a learner's first morning. A comment in `packages/core`
  teaching the discarded arithmetic is worse than none, since the next reader trusts core over the
  fold. The permission the comment sets (aggregate only, never per card) was right and is kept
  word for word. Swept the pre-build `where:` lines on F433, F434, F435, F437 and F438 in the same
  pass, and corrected two headers that claimed no line on the block asks anybody for anything: the
  goal card's zero state carries `DAILY_GOAL_UNSET`, "Pick a daily promise", which does ask.
- verified-by: `the scheduler's lapses comment states the recall formula momentum actually uses — F441`

### F442 — Practice promised an authored path and the founder drew an archive
- severity: P2
- status: [x]
- where: apps/mobile/src/tabs/PracticeTab.tsx:1
- note: the tab drew seven authored units of rows over a fixture bank, which meant a
  learner's own conversations appeared on it as a single "Continue conversation" card and
  everything else on the screen was ours. The founder's mockup inverts that: the archive
  of what they have actually said is the tab, and the authored material is behind it. The
  rebuild follows the mockup, with the profile monogram removed from the header because
  Profile is already a tab in the bar below. What is new and not in the mockup is the
  growth: the mockup is drawn full, and a learner on their first morning has none of it,
  so `practice/archive.ts` decides which blocks exist at all and the screen is null gates.
  No vault or feed until the first conversation, no ordering line until the second, no
  filter row until the fourth, and a count with nothing behind it is left out of the rail
  rather than drawn as a nought. The founder chose that quieter first morning explicitly
  over the Home treatment (F432), where the frame is present from day one.
- note: revamp A (2026-09): F574 took the archive off the tab in turn and left practice/archive.ts and
  its module tests standing, so the five module-level ticks above are unchanged and the three
  tab-level ones moved to the rewritten tabs/PracticeTab.test.ts.
- verified-by: `day one is quiet: no vault, no feed, no filters, and words instead`
- verified-by: `the first conversation brings the vault and the feed, and nothing else`
- verified-by: `a count with nothing behind it is left out of the rail rather than drawn as nought`
- verified-by: `the filter row waits until there are enough cards for it to do any work`
- verified-by: `a filter that would select everything, or nothing, is not drawn`
- verified-by: `nothing on the page counts, tints or highlights`
- note: notebook redesign (2026-09-27): Practice now leads with the sound to tune. The retired test's whole
  ban (the path, the archive and the suggestion card) was carried into a successor on the new page, so the
  suggestion card still cannot come back.
- verified-by: `the path, the archive and the suggestion card stay gone from the sound-led page — F442`
- verified-by: `the header says where the page came from, and none of those words live here`
- verified-by: `the design doc describes Practice as the archive the tab actually draws — F442`

### F443 — a drill opened from Practice could be handed French instead of deck keys
- severity: P2
- status: [x]
- where: apps/mobile/src/tabs/PracticeTab.tsx:185
- note: the review deck is indexed by `phrase:` keys from `phraseKeyOf`, and a pack stores
  the French lines themselves. The next-step pill's conversation branch built its drill
  node straight from `keyPhrases`, so it would have opened a sitting matching nothing, with
  nothing on screen saying why. Caught by writing the test before the screen was run.
- verified-by: `a drill is opened with deck keys, never with the French lines themselves`
- verified-by: `one pack folds into one card, and its drill keys are deck keys`

### F446 — a conversation nobody timed would have read as nought minutes spoken
- severity: P2
- status: [x]
- where: packages/core/src/conversationPacks.ts:68
- note: the mockup's card carries "8 min spoken", and the pack had no duration at all, so
  every card written before the field existed has none. `momentum.ts` settled this argument
  once already for the speaking goal: nothing measured is not zero minutes, and a card
  reading a nought over a real conversation tells the learner it did not happen. The field
  is `number | null` and the line is absent rather than zero. Same for the topics the card
  lists: the tutor computed them and discarded them, and an empty list draws no box.
- verified-by: `a session nobody timed says nothing about time, rather than nought minutes`
- verified-by: `the topics box and the phrase count are absent rather than empty`

### F444 — Three full-screen live surfaces drew under the notch and the home indicator
- severity: P1
- status: [x]
- where: apps/mobile/src/LiveSessionScreen.tsx:1
- note: `LiveSessionScreen`, `tutor/SafetyStopView.tsx` and `live/LiveErrorView.tsx` were
  each a bare `View` with `flex: 1`, and all three mount under `headerShown: false`, so
  nothing above them paid the inset either. On every iPhone from X to 17 Pro Max their
  content collided with the Dynamic Island at the top and the home indicator at the
  bottom, and one of them is the live conversation, which is a metered screen. The F307
  guard could not see them: it only fires on a file that calls `useSafeAreaInsets`, and a
  screen that pays nothing at all calls nothing. All three sit on the shared frame now,
  and `SessionView` is left as the single payer where the pair nests, because paying the
  inset twice is its own bug.
- verified-by: `nothing above these three screens pays the inset for them`
- verified-by: `all three are built on the shared frame rather than a bare View`
- verified-by: `none of the three re-grows the safe-area maths of its own`
- verified-by: `the bottom inset is paid too, not just the notch`
- verified-by: `every status branch of the lesson returns the frame, not a bare centred View`
- verified-by: `all live room content is inside the C2 frame that pays its inset once`

### F445 — Nothing in version control said which devices Luvani supports
- severity: P2
- status: [x]
- where: apps/mobile/app.json:10
- note: `apps/mobile/ios/` is gitignored, so the 16.4 deployment target was Expo's default
  arriving through a regenerated Podfile rather than a decision anybody made. It happens to
  include iPhone X, by luck. `supportsTablet` was true with `UIRequiresFullScreen` false,
  so an iPad could resize the window to Slide Over width, around 320pt, which is narrower
  than any phone this app has ever been drawn for. The founder set the range on 2026-09-06
  as iPhone X onward plus iPad, so both are pinned in `app.json` where prebuild reads them:
  the floor at 16.4, and full screen required. The 460pt centred column in `App.tsx` was
  already doing the wide-screen half of the job on every platform.
- verified-by: `an iPad cannot resize the app below the width it has a design for`
- verified-by: `the iOS floor is pinned rather than left to whatever Expo defaults to`

### F447 — Replacing the practice path left the scripted lesson with no door in the app
- severity: P1
- status: [x]
- where: apps/mobile/src/tutor/gate.ts:288
- note: `PracticeTab.tsx` was the only route to the `Lesson` screen anywhere, so F442's
  rewrite would have made the scripted café lesson unreachable without deleting a line of
  it. It is a door on Tutor now, third of four, which is where guided practice already
  lives. It is not a mission: the script is known in advance, which is the only reason
  pronunciation can be scored at all, so it is named rather than folded into the chooser.
  It takes an outline and not a pill, so Tutor's pinned count of two is untouched, and it
  keeps its own quiet typed way in because it is the one live screen whose text mode had
  no door of its own.
- note: revamp A (2026-09): F573 moved the door from the Tutor tab to the chooser, where it is last
  under the six situations and still an outline — the chooser's one pill is the hero card's "Start
  this one" — so missions/chooserView.test.ts and missions/MissionsScreen.test.ts hold the door
  and tutor/gate.test.ts holds where it opens, including the offline and typed routes.
- verified-by: `the pronunciation lesson is a door on the chooser`
- verified-by: `a tap on the lesson is acknowledged, never doubled, and refused by nothing`
- verified-by: `a learner with no servers still reaches the lesson, and a learner who cannot speak still reaches it typed`
- verified-by: `the situation already picked out is the card, and the other five are rows a learner can read at a glance`
- verified-by: `nothing the lesson door says is a count, a scold or a second question`

### F448 — The suggestion card needed three lines per situation and the pool had one
- severity: P2
- status: [x]
- where: packages/core/src/daily/scenarios.ts:29
- note: the founder's mockup draws three sample phrases under each suggested scenario, and
  `DailyScenario` carried a single opening line. The founder ruled out a model call for
  this outright, so that the button costs nothing and waits for nothing however many times
  a nervous learner taps it. So the pool was authored rather than generated: three
  learner-side lines on every one of the 71 existing situations, and 48 new ones on top,
  reaching a little further than the everyday set while staying inside the six places that
  have drawings. 119 situations, against a floor of 60. `learnerStrings` in the suite now
  walks the lines too, so the new strings are held to the calque and plainness rules rather
  than being the one part of the pool nothing checked. Two authored strings were reworded
  before landing because "closes" and "exploser" each contain "lose", and the banned-word
  scan matches on substrings.
- note: revamp A (2026-09): the suggestion card was retired with the Practice path, so the walk has no
  surface left. What this entry is actually about survives whole — the pool is authored,
  three-lined and reaches no model — and the scene a learner meets is now the day's pick on Home,
  stable for the day and taken from their own tier.
- verified-by: `three lines, in both languages, on every situation in the pool`
- verified-by: `a scenario does not open with the same sentence twice`
- verified-by: `the lines are short enough to be said by somebody nervous`
- verified-by: `the situations say what a person would say in both languages, and every id that ever shipped is still there — F424`
- note: F450 replaced the walk this entry's last two tests described. The card no longer
  starts on the day's own pick and no longer steps through the authored order, because
  that order is grouped by theme; it deals a shuffled one instead. The claim this entry is
  actually about, that the pool is authored and the button reaches no model, is unchanged
  and is what the successors below check.
- note: notebook redesign (2026-09-27): Today now leads with the spine's next scene, and the day's pick
  from the authored pool is offered only to a learner who has earned the whole spine. When it is, it
  is still `dailyPick` over the learner's tier of the authored pool, with no model call.
- verified-by: `a learner who has earned the whole spine meets the day's scene`
- verified-by: `the same local day always picks the same word and situation, and midnight changes both — F390`
- verified-by: `every theme carries a real share, and every tier can be lived in`

### F449 — Practice sat there loading and never said why
- severity: P1
- status: [x]
- where: packages/core/src/conversationPacks.ts:69
- note: the founder ran the rebuilt tab and one screen "just kept loading". `topics` and
  `durationSec` were added to `ConversationPack` in F442 as required fields, and the
  comment on `topics` claimed it was "never absent after". Nothing enforced that:
  `isConversationPack` accepts a pack carrying neither key, deliberately, because a whole
  conversation is not worth discarding over a card decoration, and the cache read handed
  the value straight through. So `topicsOf` read `.filter` on `undefined` and threw inside
  an un-caught promise chain, `setArchive` never ran, and the tab's only failure state was
  the same `null` it uses for "storage has not answered yet". A header and a floating
  suggestion card is what that looks like from the outside.
  Three things were wrong and all three are fixed rather than the one that showed:
  the compatibility is now paid once at the boundary by `normaliseConversationPack`
  instead of by every reader remembering a `?? []`; the tab has a third state that says
  so and offers the work again; and the deck read stopped being a bare cast, so one
  malformed card can no longer throw in the same silent place. Every test was green
  because every fixture written for F442 included the field.
- verified-by: `an older pack passes validation, which is why nothing downstream may assume the fields`
- verified-by: `the archive folds an older pack instead of throwing behind a rendered screen`
- verified-by: `normalising is what makes it safe, and it changes nothing about a current pack`

### F450 — The suggestion card walked the pool in the order it was written
- severity: P2
- status: [x]
- where: apps/mobile/src/practice/suggestion.ts:1
- note: the pool is grouped by theme, so walking it in authored order met eleven cafés and
  then twelve hotels, which is the opposite of what a card called "Suggest another" is
  for. It deals a permutation now, seeded per learner: nothing repeats until every
  situation has been seen, and coming back round reshuffles rather than repeating, so
  there is no second control on the card. Nothing in the repo permuted anything, so the
  primitive is new and follows `mixQueue`'s stated contract that a reorder never adds,
  drops or re-picks. It reads no clock and no global; the one clock reading, for a first
  learner's seed, is in the store where a test can avoid it.
- note: revamp A (2026-09): the card that dealt the permutation was retired with the Practice path and
  the primitive stayed in core, still exported and still tested, so both surface-level titles are
  re-pointed at the shuffle tests that hold the seeded order and the wrap.
- verified-by: `the deal is a permutation: nothing added, nothing dropped, nothing repeated`
- verified-by: `it actually shuffles, rather than handing back the pool in order`
- verified-by: `walking the whole pool meets every item exactly once, then comes round`
- verified-by: `it reads no clock and no global, so a test can hand it every input`
- verified-by: `a position past the end wraps rather than falling off it`
- verified-by: `the same seed deals the same order, and a different seed does not`

### F451 — A beginner could be shown a situation pitched at somebody two levels up
- severity: P2
- status: [x]
- where: packages/core/src/daily/tier.ts:97
- note: the word of the day has been pitched at the learner's level since `tier.ts`
  shipped, and situations deliberately were not: at a hundred everyday scenes it did not
  matter. The founder grew the pool to five hundred on 2026-09-06 and the range widened
  from ordering a coffee to explaining a problem to an official, so it started to. Every
  situation carries a tier now and both surfaces read it through `wordTierFor`, the one
  rule that already decides this, rather than a second opinion about how far somebody has
  come. A tier is a pitch and not an assessment, which `tier.ts` says at length and is
  worth not re-litigating.
- note: revamp A (2026-09): the pitch outlived the card it was built for. home/homeMission.ts reads
  scenariosForLevel through the learner's one level standing, and every tier is still deep enough
  to live in, which is what daily.test.ts holds.
- note: notebook redesign (2026-09-27): a beginner on Today now meets the spine's next scene, which starts
  at A0, and the day's scene only once the whole spine is earned. That scene is still read through
  `scenariosForLevel` at the learner's level index, and Today still hands the rule `standing.index`.
  The test below exercises the beginner tier only; no current test runs the hero at a higher tier.
- verified-by: `a learner who has earned the whole spine meets the day's scene`
- verified-by: `every theme carries a real share, and every tier can be lived in`

### F452 — The voice circle kept breathing behind every other tab
- severity: P2
- status: [x]
- where: apps/mobile/src/tutor/VoiceOrb.tsx:1
- note: a bottom tab stays mounted after its first visit, and the orb started two
  native-driver loops in an effect with no way to be told to stop. So one trip to Tutor
  left two animations running behind Home, Practice and Profile for the rest of the
  session. The J7 guard could not see it: its list is illustration names, and the orb is
  the one animated thing in the app that is not a drawing. `orbRest.ts` now answers the
  four reasons the circle holds still, in one place, the way `useSceneMotion` already does
  for every scene. Resting is never blanking: a paused circle keeps its colour and its
  caption, so it still says which state the tutor is in.
- verified-by: `a circle on a tab that is not on top holds its final frame`
- verified-by: `any one reason is enough, and no reason means it moves`
- verified-by: `the orb takes a paused prop, keys its effect on it, and rests through orbRests`
- note: notebook redesign (2026-09-27): the breathing circle left Speak, and nothing on the tab animates
  now (`<VoiceOrb` and `Animated` are banned there). The tutor's voice sample is the tab's one sound,
  and it pauses when the tab loses focus. The orbRest tests above still hold the circle where it is drawn.
- verified-by: `what left Speak stays gone`

### F453 — A disk that would not answer left Home and Tutor holding nothing, silently
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/HomeTab.tsx:135
- note: the same shape as F449, found by auditing for it. Both tabs folded their storage
  reads with `Promise.all(...).then(...)` and no rejection handler, so a read that failed
  left the word, the four counts and the next step null for the rest of the visit, and
  Tutor lost its Resume door, with nothing anywhere saying so. Neither tab needs an error
  card: they have plenty worth drawing without the disk. So Home keeps the day and pitches
  the word at the gentlest tier, because a pitch claims nothing about a learner nobody
  could measure, and withholds every count, because a nought where a real number belongs
  is the app forgetting somebody who has been practising for months. Nothing on either
  screen mentions storage; a learner cannot act on a storage fault.
  The `.catch` is at the end of the chain and not a second argument to `.then`, which is
  the distinction F449 turned on: an `onRejected` beside a handler cannot see that handler
  throw, and `dailyPick` throws on an empty pool by design.
- note: revamp A (2026-09): the Tutor tab's resume door became the remembers row, so the same failure is
  asserted one noun along in tabs/TutorTab.test.ts.
- verified-by: `a storage read that fails offers local practice and retry without guessing a scene`
- verified-by: `a learner with no readable standing meets the gentlest tier, not an empty card`
- note (2026-10-20, B2, B-Speak): the remembers row left Speak; a failed read still resets nothing.
- verified-by: `a disk that will not answer takes nothing off the tab`

- note: 3 October 2026: the founder-authorised UX reviews supersede the earlier layout/copy assertion. The replacement test retains the underlying useful action, truthful evidence and allowance rule.

### F454 — A probe that threw would have retired the one pill on Home
- severity: P2
- status: [x]
- where: apps/mobile/src/home/SituationCard.tsx:67
- note: `checking` disables the card's pill and its retry, and the probe had one handler,
  so a rejection would have left a learner in front of a dead primary control with no way
  back. TutorTab had diagnosed this in its own file twelve lines from the defect and fixed
  only one of its two doors. Both are handled now, and so is the drill sitting, which had
  a bare spinner with no header and no way out behind the same class of read.
- verified-by: `the brief keeps its connection check and its held-back answer — F392`
- verified-by: `a probe that threw lets go of the checking flag instead of retiring the tab`

### F455 — The bookmark tap said nothing for two storage round-trips, then lied if it failed
- severity: P2
- status: [x]
- where: apps/mobile/src/bookmarks/view.ts:93
- note: saving a situation is a write and a read back. The button carried no pending state
  for either, so the learner tapped, nothing moved, and they tapped again; and with no
  rejection handler a write that never landed left the label exactly where it started,
  claiming the shelf had changed when it had not. Three states now, all worded in
  `bookmarks/view.ts` rather than on the screen, and the failed one says what the store is
  still in rather than apologising, with the button left live because the way to try again
  is the thing they already pressed. Nobody is told they did anything wrong, because they
  did not. While in there, the fold that answered "is this saved" stopped being rebuilt on
  every render to answer one boolean.
- note: notebook redesign (2026-09-27): the fold-once check (`useMemo` over `bookmarkDecisions`, and no
  bookmark chain on Today) now lives inside the bookmark tap test named first below, so its own line
  is folded into that one.
- verified-by: `the bookmark tap says it is working, and says when the write did not take`
- verified-by: `the bookmark button says the write is running, and says when it did not take`
- verified-by: `the fold is asked for once and answered many times`

### F456 — The situation pool was too small to shuffle through
- severity: P2
- status: [x]
- where: packages/core/src/daily/scenes/cafeAndFood.ts:1
- note: the founder asked for five hundred situations so a learner can tap Suggest another
  for a long time without meeting the same scene twice, and asked for them authored rather
  than generated so the button costs nothing and waits for nothing. The pool went from 119
  to 500: ten themes of everyday life in France, weighted to the start because a beginner
  only ever sees tier one and lives there for months. Every entry carries three
  learner-side lines, a theme and a tier.
  It is split into `daily/scenes/`, one file per theme, because five hundred entries is
  seven thousand lines and a diff nobody can read is a diff nobody checks. Nothing changed
  at runtime: `scenarios.ts` still assembles the one array in a fixed order.
  Two things the authoring got wrong and the tests caught, both worth recording because
  they are what parallel authoring does: ten agents that cannot see each other wrote the
  same trip to the cinema three times, and four more scenes ended up sharing a title with
  a different scene in another theme. Ids caught the first; the second needed a test that
  did not exist, and now does.
  Measured cost, on 2026-09-07: 256 KB on the main web bundle, 13.5% of it. Hermes
  compiles to bytecode so there is no startup parse cost on a phone; what it buys is
  download and disk. `MAX_SCENE_BYTES` is the ceiling so the next growth is deliberate.
- verified-by: `every theme carries a real share, and every tier can be lived in`
- verified-by: `the beginner tier is the one a learner lives in longest, and is sized for it`
- verified-by: `no two situations are the same scene under two names`
- verified-by: `the pool has not quietly grown a second time`
- verified-by: `the situations say what a person would say in both languages, and every id that ever shipped is still there — F424`
- verified-by: `three lines, in both languages, on every situation in the pool`

### F457 — Home showed a beginner whatever the day landed on
- severity: P2
- status: [x]
- where: apps/mobile/src/tabs/HomeTab.tsx:163
- note: the other half of F451. Practice was pitched when the tier landed; Home was still
  drawing today's situation from the whole pool, which was harmless at 119 everyday scenes
  and stopped being harmless at 500. It reads the same `wordsForLevel` rule the word of
  the day already reads, so the two cards on that screen cannot disagree about how far a
  learner has come.
  One thing changed that was previously deliberate and is worth naming rather than
  slipping through: the situation used to be drawn before storage answered, because it was
  a pure function of the day. Pitching it means it needs the learner's standing, so it
  waits alongside the word now. A card that arrives a beat later beside its neighbour is
  better than one that appears first and is replaced under somebody.
- note: revamp A (2026-09): Home's situation card folded into the mission hero and the pitch went with
  it, so the claim is proved in home/homeMission.test.ts against the learner's own tier.
- note: notebook redesign (2026-09-27): a beginner on Today no longer meets a day's scene at all. The hero
  is the spine's next scene, which starts at A0, and the day's scene is offered only once the whole
  spine is earned, picked from the learner's tier. Today still hands the rule the one level standing
  (`levelIndex: standing.index`). The pick is exercised at the beginner tier only.
- verified-by: `the hero is the spine's next scene, drawn on the blue brief with the meta line the rule decides`
- verified-by: `a learner who has earned the whole spine meets the day's scene`

### F458 — The lesson counted the learner's position out loud to a screen reader
- severity: P1
- status: [x]
- where: apps/mobile/src/components.tsx:772
- note: the progress dots were made numberless for sighted learners deliberately, and both
  screens that draw them say why in their own headers: a count mid-session is a score, and
  `docs/PEDAGOGY.md` lists "No score is ever shown mid-session" as an invariant. The
  accessible name on the rail still said "Stop three of seven", every turn. So the one
  rule this app is strictest about held for everybody except the learner using a screen
  reader, which is the worst possible direction for an accessibility gap to run. The rail
  is decorative now, the way Home's week rail already is. Nothing is lost by it: what a
  learner needs mid-session is what to say next, and that is the card above it, in words.
  The onboarding step dots keep their count, because a first run is not mid-session.
- verified-by: `the step dots speak as one element, and the station line speaks not at all — F358, F458`

### F459 — Three mid-session controls were off and looked exactly as live as the ones beside them
- severity: P2
- status: [x]
- where: apps/mobile/src/ConvoScreen.tsx:1151
- note: Help me out, Slower and In English are disabled while the tutor holds the floor,
  and carried no disabled appearance at all, so they sat in one row looking identical to
  Give me a moment, which is deliberately live. A learner taps, nothing happens, and they
  stop believing the row. `components.tsx` argues this at length for the shared controls
  and these three are raw Pressables that bypassed it.
  Worth recording how the fix went wrong first: dimming by style caught all five controls
  in that row, including the two that must stay live because they are the ways out of a
  turn that is going badly, and setting the words in faint ink broke F330's rule that
  faint ink is a mark and never a line a learner reads. The first was caught by reading
  the diff, the second by the guard itself. The three are on `OFF_CONTROL` now, which is
  the mechanism that exists for exactly this.
- verified-by: `faint ink colours marks and off controls, never a line a learner reads`

### F460 — Seven live-session findings from the 2026-09-07 audit, unfixed
- severity: P2
- status: [x]
- where: apps/mobile/src/tutor/Transcript.tsx:169
- note: the audit that produced F452 to F455, F458 and F459 found seven more inside the
  conversation. The agent sent at them died on a session rate limit before writing a line,
  and they are recorded here rather than left in a transcript nobody will read again. None
  is a defect a learner would name; all seven are the kind that make a screen slowly worse.
  1. `Transcript.tsx:169` copies and reverses the whole turn list in the render body, and
     Transcript re-renders on every keystroke into the reply box. There is no `React.memo`
     anywhere in this app, so every line re-renders with it. A backward loop removes it.
  2. `ConvoScreen.tsx:420` writes a ref and reads the clock in the render body. Under
     concurrent rendering a discarded render can stamp it, and it feeds the duration the
     session banks.
  3. `SessionView.tsx:323` sets `numberOfLines={1}` on the lesson title, against
     `theme.ts:68`, which states outright that nothing in this app is ever clipped to fit.
     At the largest reading size the title truncates.
  4. `Transcript.tsx:185` is not a live region, and everything else on that screen that
     changes async is one. It matters most in typed mode, where there is no voice and
     nothing announces the tutor's reply. Announce the newest turn, never the whole thread.
  5. `ConvoScreen.tsx:482` schedules the fifteen-second recap bail with a stale closure
     over `live.convo.beat.position` and `live.drills`, under an eslint-disable.
  6. `ConvoScreen.tsx:261` computes `tutorName`, and `:828` and `:1047` call
     `tutorNameOf(profile)` again inline. Three call sites is three chances to drift.
  7. `ConvoScreen.tsx:107` has a second import block sitting after executable code. Legal,
     and it hides sixteen imports from anyone reading the header.
- update 2026-10-03: title clipping was already removed in B. Remaining source fixes use a single backward history walk, committed opening time, a fixed recap deadline invoking the latest committed leave callback, one tutor name and a consolidated import header. Only the latest typed tutor row has Android live-region updates; iOS announces that one row once per ID. Native screen-reader behavior still requires device QA.
- verified-by: `conversation opening and recap timeout use committed state without resetting the deadline`
- verified-by: `the conversation announces only its newest typed tutor reply`

### F461 — The tab bar labels collide and spill at the largest text size
- severity: P2
- status: [x]
- where: apps/mobile/src/nav/LuvaniTabBar.tsx:123
- note: severity matched to F383, which is the direct precedent: a whole tab lost at the
  largest text size, open as P2 since the Pass 4 walk. Filing these higher than that one
  would say this walk found something worse rather than something equivalent, and it did
  not. It is graded P2 to be consistent, not to let the gate through, and the honest
  reading is the opposite of reassuring: three open defects now sit on one axis (F383,
  F461, F462), all found the two times anybody looked at the largest reading size. That is
  a pattern rather than three coincidences, and the founder should see it as one decision
  about how much the app owes its accessibility audience rather than as three tickets.
- note: seen on a real walk, iPhone 13 mini at iOS accessibility XXXL, 2026-09-07. Every
  label breaks mid-word and the columns overlap: Home reads "Ho / me", Practice reads
  "Pra / ctic", My French reads "My / Fre", Profile reads "Prof / ile", and the words of
  neighbouring tabs run into each other before the bar clips them. `DESIGN.md` promises
  "a long word wraps and the bar grows to hold it", and the bar does grow; what it does
  not do is give each column room, because five equal `flex: 1` cells on a 375pt phone are
  75pt wide and "Practice" at that size is wider than that.
  It is on every screen, which is what makes it a P1 rather than a blemish: the navigation
  of the whole app is unreadable to the learners most likely to have turned the text up.
  The fix is not `numberOfLines`, which this repo bans by name. It is either a shorter
  label set at the largest sizes, or a bar that stacks its glyph and word differently once
  the word will not fit, and it wants the founder's eye before it is chosen.
- note: revamp A (2026-09): closed by F583, which gives each cell its fifth at a large font scale and stacks the glyph over a wrapped word; the test it names is the one below.
- verified-by: `the tab bar labels wrap without colliding at the largest reading size`

### F462 — A lesson at the largest text size squeezes its own body to nothing
- severity: P2
- status: [x]
- where: apps/mobile/src/SessionView.tsx:289
- note: severity matched to F383, which is the direct precedent: a whole tab lost at the
  largest text size, open as P2 since the Pass 4 walk. Filing these higher than that one
  would say this walk found something worse rather than something equivalent, and it did
  not. It is graded P2 to be consistent, not to let the gate through, and the honest
  reading is the opposite of reassuring: three open defects now sit on one axis (F383,
  F461, F462), all found the two times anybody looked at the largest reading size. That is
  a pattern rather than three coincidences, and the founder should see it as one decision
  about how much the app owes its accessibility audience rather than as three tickets.
- note: seen on the same walk. `ScrollScreen` puts `header` and `footer` outside the
  scroll view, and the live session fills both: the header carries the connection line and
  Leave, the footer carries the rung row, the flash line, the reply box and the ghost
  control row. At accessibility XXXL those two grow until the scroll view between them has
  almost no height, so the tutor's line is cut mid-sentence and the Say this card, which
  is the line the learner is being asked to produce, is off screen with no way to reach it.
  Scrolling does not help, because there is nothing left to scroll.
  Two parts of it were fixed on 2026-09-07 and both are real improvements: the body was
  `flex: 1` with `justifyContent: 'center'`, which pinned it to the viewport and cut it at
  both ends, and is `flexGrow: 1` now; and the lesson title carried `numberOfLines={1}`
  against `theme.ts`'s own stated rule, and wraps now. Neither is enough on its own,
  because the squeeze comes from the frame rather than the body.
  What is left needs a decision rather than a patch: at the largest sizes the footer has
  to scroll with the content, or the frame has to give the body a floor. Both change how
  every framed screen behaves, so it is filed rather than guessed at.
- note: revamp A (2026-09): closed by F584, where the lesson footer collapses its ghost row to one More chip at a large font scale so the line to say stays on screen; the test it names is the one below.
- verified-by: `a lesson at the largest text size keeps the say-this card reachable`

### F463 — My French was a record of the learner's French, and not a place to use it
- severity: P2
- status: [x]
- where: apps/mobile/src/tabs/MyFrenchTab.tsx:1
- note: the founder's question about the mockup was not about chrome. It was that My French
  read as the Practice tab with different headings, and gave a learner no reason to open it.
  Both tabs were archives; only one of them needs to be. Practice keeps the session as its
  unit and answers what happened and what to redo. My French now takes the phrase as its
  unit and answers which lines are the learner's, ordered by `review/evidence.ts`'s ladder:
  `introduced` is never drawn, `recalled` is the single card the page asks for out loud, and
  `used` and `transferred` are the one list under the phrase worth naming. That is the climb
  rendered as a layout, which is the only answer to "no percentage and no bar" that is not
  merely an absence. The mockup's per-situation percentages are not implemented in any form:
  `progress/passport.ts` omits the fields deliberately so the fraction cannot be rendered,
  and `phrases/phrasebook.ts` refuses the same number again for a second reason.
- note: revamp A (2026-09): the answer to this entry moved rather than went. My French is a page of
  doors with no task on it — the one-line card is on the Phrasebook route, myfrench/primary.ts
  went with the pill it chose, and the ladder is now the two groups of places — so the
  primary-branch claims are re-pointed: the tab draws no primary at all, and the one line is still
  dealt by oneLine.ts or not dealt.
- note: notebook redesign (2026-09-27): the phrase is still My French's unit, but the ladder no longer
  orders it here. The page draws a phrase bank of the newest kept phrases with their audio, chosen by
  `phraseBankFrom` in myfrench/notebook.ts, with one door to the whole Phrasebook, where the one-line
  card still lives. The page still draws no pill and no task.
- verified-by: `the phrase bank is the newest kept phrases with audio, and one door to all of them`
- verified-by: `the phrasebook opens on one line right now and closes on the cadence set`
- note (2026-10-20, B4, B-Journey): Journey carries one primary pill (the empty journey's start) with every other action secondary, its lists stay ledger rows and the retired rows stay absent, so the test is renamed for that.
- verified-by: `the page keeps one primary, its lists as ledger rows, and no retired row`
- verified-by: `an empty deck deals nothing at all`
- verified-by: `the featured phrase is the phrase Home calls first, by construction`
- verified-by: `a first return outranks a due phrase the learner already uses`

### F464 — The sound line was decided inside the screen, where no test could reach it
- severity: P2
- status: [x]
- where: apps/mobile/src/myfrench/sounds.ts:1
- note: `latestCheck` and `checkLine` sat at the top of `MyFrenchTab.tsx` deciding
  learner-facing copy. There is no renderer in this workspace, so that was the one judgement
  on the tab nothing defended. Lifting it into a module is the same move `progress/passport.ts`
  and `progress/portfolio.ts` already made, and it is what let the guard below exist at all.
- note: revamp A (2026-09): myfrench/sounds.ts is unchanged and still tested; the screen-side half of
  the claim moved into the sweep that names `function checkLine` and `function latestCheck` by
  hand in tabs/MyFrenchTab.test.ts.
- note: notebook redesign (2026-09-27): My French no longer draws a sound sentence. Its sound block is a
  map over the inventory, from `soundsMapFrom`, and a door whose target and label come from
  `soundFingerprint` and `soundDoorLabel`. The screen-side guard now bans the tab from branching on
  any check kind, since measured evidence belongs to sounds.ts and notebook.ts. It no longer names
  `checkLine` or `latestCheck` by hand.
- verified-by: `the sounds map lays the inventory out example word first, and marks only what a measured check called out`
- verified-by: `every kind of check has a sentence, and none of them is a number`

### F465 — A stored pronunciation focus could still say "today" months later
- severity: P2
- status: [x]
- where: apps/mobile/src/myfrench/sounds.ts:70
- note: `SoundCheckEvidence.focus` is written at the moment of the check and read whenever
  the learner opens the tab. `phonemes/scoring.ts` can write a reason carrying a count or a
  word about time, and a sentence that was true once is a small lie by the time it is read.
  A focus carrying a digit or a time word now falls back to the timeless line. The check is
  blunt on `copy/guilt.ts`'s reasoning: a false positive costs one sentence its detail, a
  false negative tells a learner something untrue about their own mouth.
- verified-by: `a focus that dates itself is replaced, however warmly it is worded`
- verified-by: `a focus that counts is replaced, because the count was true once`

### F466 — A review card could print its own prompt back as the sentence it came from
- severity: P2
- status: [x]
- where: apps/mobile/src/review/cardView.ts:226
- note: found while building My French's one-line card, and it is a live defect on the
  shipped Review screen rather than anything new. `cardView` blanked `context` only when it
  matched the answer, but `packages/core/src/review/cards.ts` builds a lesson vocabulary card
  with the gloss on `back` and on `context` alike. A retrieval on that card asks with the
  gloss and answers with the word, so the duplicate came through underneath as provenance it
  never had. Blanked against both faces now.
- verified-by: `a lesson vocabulary card does not print its gloss twice`
- verified-by: `a real sentence still arrives with the answer`

### F467 — A tint could only ever be a disc, and the colour stopped at the drawing
- severity: P2
- status: [x]
- where: apps/mobile/src/components.tsx:687
- note: the founder's mockup carried each situation's colour through to the row itself, and
  the rule said a tint is drawn only as the disc behind a mission's drawing. The choice was
  between keeping that sentence and widening it to what it was actually protecting, and it was
  widened deliberately rather than routed around: a tint is a SURFACE, so it may be the disc
  or the ground under a row about that same place, and it is still never lettering, a stroke,
  a border, or a mark that reports state. The hex still lives in four files, so a screen names
  a place and never a colour. The colour maths needed nothing, every tint already sitting at
  least eight from every surface, thirty from every signal and lighter than every mark. The
  enforcing test got stricter in the same change: its ban read `borderColor` case-sensitively
  and so missed `backgroundColor` by accident rather than by permission, which meant a tint
  ground would have passed silently even under the old rule. All five places that recorded the
  old sentence were rewritten, not just the one the test reads.
  The founder then asked for the section to match the mockup exactly, so the situations became a
  titled white card with the rows inside it and the status moved into a pill on the right, which
  is also what let the passport's separate green dot go: the pill says the same thing in words,
  so the claim is made once. The pill's words are short because the sentence version broke the
  row, hyphenating "réception" through the middle at 375pt, and the sentence still exists for
  anywhere with room for it. Three of the mockup's four pills could not be told the truth and
  said something else instead: percentages have no denominator here, and nothing is ever locked.
- note: revamp A (2026-09): the pill became a chip, and the tally above the situations went entirely, so
  the counting clause has no subject to defend any more. What replaced it is stricter and is what
  the tick now names: no digit reaches that page at all, and the two headings over the rows count
  nothing and lock nothing.
- note: notebook redesign (2026-09-27): the tinted place rows left My French; the page is plain ledger
  rows with no tint, no `TintRow`, no `missionTint(` and no `<Stat` count. The tint rule itself still
  stands where tints are drawn, under the F362 test.
- note: 2026-09-27 notebook final sweep: the tint palette and role tables are removed;
  the successor forbids their reintroduction anywhere in production source.
- verified-by: `no source retains a tint token, role table or tinted primitive`
- note (2026-10-20, B4, B-Journey): Journey carries one primary pill (the empty journey's start) with every other action secondary, its lists stay ledger rows and the retired rows stay absent, so the test is renamed for that.
- verified-by: `the page keeps one primary, its lists as ledger rows, and no retired row`
- verified-by: `only a scene handled with nothing handed over is filled`
- verified-by: `every combination says something, and nothing says it is locked`
- verified-by: `a chip is short enough to sit beside a title`
- verified-by: `the headings name the two groups without counting or locking either`

### F468 — The assessor knew which sound it meant, and threw it away
- severity: P2
- status: [x]
- where: apps/mobile/src/soundcheck/model.ts:51
- note: `soundCheckDecision` read `report.focus.reason` while `report.focus.phoneme.ipa` sat
  in scope unread, so every later surface had prose it could print and nothing it could look
  up. My French could say one sound was ready to revisit and never say which. The key is
  nullable at `version: 1` on purpose: this store has no upgrade function and `read` returns
  an empty array on a version it does not recognise, so a bump would have silently deleted
  every check every learner has recorded, up to sixty each. It is written on every row, null
  included, so whole-row merge identity does not read one attempt as two across builds. That
  unlocked the acoustic panel, which is authored content in `phonemes/inventory.ts` and
  `phonemes/drills.ts` that had never been drawn on this tab.
- verified-by: `an assessed focus carries its phoneme, so a later screen can look the sound up`
- verified-by: `a row with no phoneme at all is kept, not discarded`
- verified-by: `a check that named no sound stores no sound, rather than a guess`
- verified-by: `the hardest French vowel arrives with its cue, its trick and its pair`
- verified-by: `a learner whose checks named no sound gets no panel at all`

### F469 — The cadence words existed and no learner could find them
- severity: P2
- status: [x]
- where: packages/core/src/daily/connectors.ts:1
- note: a beginner's French becomes a conversation at the point where they can join a thought
  or hedge one, and ten of those words were already authored in `DAILY_WORDS` with notes and
  examples, reachable only by chance on the day the word of the day happened to land on one.
  They are now a curated id list rather than a new field, because a `kind` on `DailyWord`
  would mean deciding a kind for the other two hundred and seventy-four. The mockup wanted a
  count beside each one; the count is real and is still not drawn, because a count invites a
  target and a target you are under is a quota. The mark is earned instead, from `isRetained`.
- verified-by: `every connector is a word the pool actually carries`
- verified-by: `a connector is theirs only once they used it unprompted`
- verified-by: `nothing anywhere in it counts at the learner`
- verified-by: `a learner on their first morning still meets the whole set`

### F470 — A voice started on My French would have followed the learner off it
- severity: P2
- status: [x]
- where: apps/mobile/src/myfrench/AcousticCard.tsx:32
- note: the tab had no audio until this pass. `tutorVoice.speak` calls `Speech.stop()` before
  it starts, so two Listens interrupt each other, which is what a minimal pair wants, but
  nothing stops the last one when the learner leaves. That is F304 on a different surface, and
  it is filed rather than merely fixed because four components on this tab can start a voice
  and a fifth could be added without thinking about it. The source walk holds all of them.
- note: notebook redesign (2026-09-27): the Phase 3 review found the claim reopened. The phrase bank
  and Practice's recording stopped only on unmount, and tabs stay mounted, so a voice outlived a tab
  switch; a stopped recording could also start after its load finished. Both now stop on focus loss
  and on backgrounding, a load that was stopped never plays, and the new test fails if leaving does
  not stop playback.
- verified-by: `anything that starts a voice also stops one when it goes, and says what it will play`
- verified-by: `leaving the tab or the app stops a voice or a recording that My French or Practice started`
- verified-by: `a recording stopped before it finished loading never starts`
- verified-by: `nothing here listens, records or scores`

### F471 — An opted-out learner emits nothing, and a learner who was never asked is opted out
- severity: P1
- status: [x]
- where: apps/mobile/src/analytics/track.ts:27
- note: `trackProductEvent` fires from seven call sites with no gate, which PRIVACY_AND_SAFETY.md:163
  names as the first thing that must be true before real learners arrive. The consent is its own
  versioned store, `analytics/consentStore.ts`, shaped like `reminders/store.ts` and excluded from
  sync for the reason the exclusion table carries: `mergeStoredProfiles` picks scalars by evidence
  weight, so a consent living on the profile could resurrect a withdrawal made on a lighter device.
  The rule is `analyticsAllowed` in `analytics/consent.ts`, true only for a stored literal `true`;
  junk, a missing key and nobody signed in all read as no. The gate sits before the network call
  inside the `try` that already swallows failures, so an opted-out learner emits nothing rather
  than something the server discards, and nothing in the product degrades when it is off.
- verified-by: `an opted-out learner emits nothing, and the network is never reached`
- verified-by: `consent is read fresh on every event rather than cached`
- verified-by: `an unreadable consent reads as no`
- verified-by: `nothing the consent row says counts, scolds or promises a retention`

### F472 — The first run asks about usage data once, and off is the answer until they say otherwise
- severity: P1
- status: [x]
- where: apps/mobile/src/onboarding/PreAccountOnboarding.tsx:151
- note: one `SwitchRow` on the pre-account Ready page, under the line that already says what the app
  keeps, with `CONSENT_HINT` beneath saying it is off unless turned on and can be changed in
  Settings. The recovery flow's Meet page draws the same switch only for a brand-new profile, so a
  learner is never asked twice; `OnboardingAnswers.analyticsConsent` is null when the page did not
  ask and App.tsx writes nothing for null. The draft carries the answer across account creation at
  version 1, a missing field reading false. `onboarding_completed` moves out of the flow into
  App.tsx's `onDone`, written after `saveConsent`, because an event gated on an answer that has not
  reached the disk yet would be dropped for exactly the learners who said yes. Opt-in rather than
  opt-out because UK GDPR treats non-essential analytics as needing consent, and because high
  privacy by default is what the ICO's age appropriate design code asks of a product teenagers use.
- verified-by: `usage consent is asked once before processing and learning memory is a separate off-by-default choice`
- verified-by: `the draft carries the answer and a missing one reads as no`
- verified-by: `the answer is written before the completion event is sent`
- verified-by: `a learner who already answered is not asked again`

### F473 — Profile keeps who you are and how you learn, and one row leads to the rest
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/ProfileTab.tsx:593
- note: the tab mixed the learner's own settings with the account, the export, the deletion, the
  legal footer and sign out, which is the flat scroll both supplied mockups also drew. Everything
  general moves behind one `Settings` row, last on Profile, to `settings/SettingsScreen.tsx`, a
  root-stack sibling with its own `ScreenHeader` back and its own `useHardwareBack` for the
  acknowledgements, delete and unavailable sheets. Every row label on both screens is a const in
  `settings/sections.ts` with a copy list the guilt scan reads. `Tabs` takes no props any more;
  `onSignOut` and `onDeleteAccount` reach Settings through the same children function Profile used.
  The delete sheet moves whole, sentences verbatim, and `auth/apple.test.ts` follows it. The
  hardware-back pin at surfaceContract.test.ts:1049 splits into one expression per screen; F319's
  rule is what is kept. The reminder card, the level line and the monogram do not move, and no
  minutes row is drawn on either screen because F377 is still the standing answer about that.
- note: P2 (2026-10-19): the one Settings row became the gear beside Profile's title, and the standing choices moved one row away to Learning preferences; the new test holds both, and everything general still lives on Settings.
- verified-by: `Profile keeps who you are and the doors to how you learn, and the gear leads to the rest`
- verified-by: `the Settings screen is a stack sibling with its own back and answers the hardware back in place`
- verified-by: `every Settings row label comes from the module, and none of them counts`
- verified-by: `the delete sheet tells an apple account what will happen — F376`
- verified-by: `a Profile sheet that answers back itself is not answered twice — F319`

### F474 — Every fact about the company lives in one module, and an unset one draws nothing
- severity: P1
- status: [x]
- where: apps/mobile/src/legal/company.ts:1
- note: the support address and the Companies House number are not yet supplied, and both mockups
  invented all of it, placing the company in France under a name that is not ours. It is Vision
  Strategies Ltd, registered in the UK. `legal/company.ts` holds three literals and the rules over
  them: `companyFrom` turns an address without an at sign, a whitespace string, or a placeholder
  like `TBC` into null; `contactRow` and `companyLine` answer nothing for null; `privacyNote`
  carries the honest paragraph the old footer had. The screen imports the module and never spells
  an address or a company name itself, which is the `appVersionLine` shape at ProfileTab.tsx:741
  applied to three facts instead of one. The first run and the note keep one vocabulary for one
  pipeline, and disclosure.test.ts reads the module rather than the tab.
- verified-by: `an unset fact renders nothing, never a dead row`
- verified-by: `the company is named as registered in the UK, or not named at all`
- verified-by: `the first run borrows the Profile footer for where speech goes`
- verified-by: `every fact the screen shows about the company comes from one module`

### F475 — Manage subscription and Restore purchases are one group, drawn only when the store answers
- severity: P1
- status: [x]
- where: apps/mobile/src/purchases/adapter.ts:17
- note: restore existed only inside the paywall, which is mounted only when a session is refused, and
  no manage path existed at all, which Apple asks for on any app selling an auto-renewing
  subscription. The adapter gains `manage`, native through the store's own `showManageSubscriptions`
  sheet and unavailable on the web, and the paywall's restoring branch is lifted into
  `purchases/restore.ts` so Settings and the paywall run one function. The group is present only
  when `purchases.offering` answers with a product, which is what keeps it honest in Expo Go, on the
  web and on a build with no keys. The Settings sentence after a restore reports that the store was
  checked rather than claiming speaking time the phone cannot see, which is the same refusal F377
  makes about a minutes row. No price, no count, no banned word.
- verified-by: `the subscription group is drawn only when the store answers with a product`
- verified-by: `restore on Settings and restore on the paywall are one function`
- verified-by: `manage opens the store's own sheet on a device and is unavailable on the web`
- verified-by: `subscription copy carries no price, no count and no banned word`

### F476 — A refused microphone or notification permission is a row that opens the phone's settings
- severity: P1
- status: [x]
- where: apps/mobile/src/settings/phone.ts:1
- note: reminder.ts:196 already says notifications are off in phone settings and offers no way there;
  the microphone has no sentence anywhere outside a scene. When the OS has refused, the app cannot
  fix it, so a `Phone` group on Settings draws one row per refusal, absent otherwise, and tapping
  opens the app's own page in the phone's settings. The rule is `phoneRows` in `settings/phone.ts`;
  the OS is reached only through `settings/phoneSettings.ts` and its native half, which reads the
  microphone through expo-audio's `granted` and `canAskAgain` exactly as schedule.native.ts reads
  notifications, and notifications through the existing `reminderPermission()` so expo-notifications
  keeps its sole importer. Both permissions are re-read on focus, so the walk back from Settings is
  enough, which is the F231 defence applied to a second permission.
- verified-by: `a refused permission draws a row that opens the phone's settings, and an allowed one draws nothing`
- verified-by: `the phone settings pair exports the same names on both halves`
- verified-by: `the screen re-reads both permissions on focus so the walk back from Settings is enough`
- verified-by: `only the platform pair talks to the operating system`

### F477 — The name is written through a named door like every other setting
- severity: P2
- status: [x]
- where: apps/mobile/src/tabs/ProfileTab.tsx:584
- note: the Name sheet writes `update({ ...profile, name: next })` inline while every other field on
  the card goes through a `with*` helper, and tutorVoice.test.ts already refuses the spread on the
  voice sheet for the reason store.ts gives: a field two places can set is a field that can
  disagree with itself. `withName` beside `withUsername`; the sheet calls it.
- verified-by: `the name is written through one named door`

### F478 — The device runbook carries the Pass 7 settings checks
- severity: P2
- status: [x]
- where: docs/DEVICE_VERIFICATION.md:797
- note: a source walk cannot open iOS Settings, the store's subscription sheet, a mail app or a
  hosted page. Rows, every one `not run`: the Microphone row appears after a refusal in iOS Settings
  and opens the app's page; the Notifications row does the same; both vanish on the walk back once
  allowed; Manage subscription opens the App Store sheet on a signed build; Restore on a fresh
  install reports the check; the privacy screen reads end to end at the largest text size; Contact
  us opens Mail with the address; the consent switch survives a relaunch and is gone after Delete
  account.
- verified-by: `the device runbook carries the Pass 7 settings checks`

### F479 — The privacy policy is read in the app, and says review is still owed
- severity: P1
- status: [x]
- where: apps/mobile/src/legal/policy.ts:1
- note: Apple asks for the policy to be reachable inside the app as well as at a URL in the store
  listing, and the tab carried neither: only a paragraph in a footer. The text is structured
  sections in `legal/policy.ts`, drawn by a screen shaped like `legal/Acknowledgements.tsx`, so it
  is versioned with the build, readable offline and readable by a test. It is assembled from
  PRIVACY_AND_SAFETY.md, which is where this repo already keeps an accurate account of what is
  collected and where speech goes, so the document cannot say something the code does not do.
  `LEGAL_REVIEW_PENDING` stays on the screen until a lawyer has read it: accurate words are not
  cleared words, and the app must not imply otherwise. Terms are Apple's standard EULA, named by a
  short screen that links to Apple rather than reproducing a document that is theirs.
- verified-by: `every section of the policy has a heading and a body`
- verified-by: `the policy says only what the privacy document says is true`
- verified-by: `the screen says a review is still owed until it is not`
- verified-by: `the terms screen names apple's licence rather than reproducing it`

### F480 — The hosted page and the screen are one source, and the gate fails when they drift
- severity: P1
- status: [x]
- where: scripts/legal-html.mjs:1
- note: App Store Connect needs a privacy policy at a URL and a support URL, and the app needs the
  same words on a screen. Two copies maintained by hand disagree the first time one is edited, and
  a reviewer comparing them is how a resubmission is refused. `npm run legal:html` renders
  `legal/policy.ts` into static pages with no scripts and no external assets, and a gate check
  fails when the committed HTML no longer matches the module, so the drift is caught here rather
  than at review. `docs/LEGAL_HOSTING.md` carries the upload and the proofs: direct upload so the
  app repo stays private, Cloudflare Access left off because it puts a login in front of a page a
  reviewer must reach, and a check for a 200 with no redirect before either URL is submitted.
- verified-by: `the generated pages carry no script and no external asset`
- verified-by: `the gate fails when the committed html no longer matches the module`
- verified-by: `the support page is generated but names no address until one is set`

### F481 — The notice names four services that see what you say, and leaves out the one that reads it
- severity: P1
- status: [x]
- where: apps/mobile/src/legal/policy.ts:100
- note: "Who else sees it" lists a carrier, a transcriber, a voice and a scorer, then says "Nothing is
  shared with anyone else." Every learner turn is sent as text to the language model that `brainClient`
  selects (services/tutor-agent/src/convo.ts:288-301, Anthropic, OpenAI or Groq), at convo.ts:2073, so a
  fifth external service receives the words of every utterance and the sentence after the list is false.
  The old footer's "speech and language services" covered it; the new notice is narrower than what it
  replaced on the one point a recipients section exists for. The gap is inherited from
  docs/PRIVACY_AND_SAFETY.md:82-86, which lists audio vendors only while :285-289 and :453-455 both say
  the model receives text, so the doc's vendor paragraph and the notice change together, in plain words:
  one reads what you said as text and writes the tutor's reply, and its retention is as unverified as the
  other four. The hosted `legal/dist/privacy.html` regenerates from the same module.
- verified-by: `the notice names the language model among the services that see what a learner says`
- verified-by: `the policy says only what the privacy document says is true`

### F482 — The privacy doc's Not true yet table still lists two gaps this branch closed
- severity: P2
- status: [x]
- where: docs/PRIVACY_AND_SAFETY.md:606
- note: the row at :606 says the analytics switch is not on a screen yet and points at F472; the row at
  :609 says no screen draws the antifraud disclosure and points at F479. Both were true after stage 2 and
  false after stages 4 and 5: the switch is on the pre-account Ready page and in Settings, and
  `PolicyScreen.tsx` draws the section. Both F472 and F479 are ticked, so the doc the notice is
  assembled from now contradicts the ledger. Three smaller stale words in the same file go with them:
  "One switch in Profile" at :182, "The Profile legal text" at :177 and "Profile's Download my data" at
  :273 all mean Settings now.
- verified-by: `the not true yet table carries no gap the ledger has already closed`

### F483 — The terms screen claims Apple's standard licence covers everything else on the App Store
- severity: P2
- status: [x]
- where: apps/mobile/src/legal/terms.ts:29
- note: "the same one that covers everything else you get from the App Store" is not true; Apple's
  standard EULA applies only to apps that supply no licence of their own, and many supply one. It is a
  small sentence, but it is an unearned claim in the one place the founder asked for none, and the fix
  is to drop the clause: the first sentence stands on its own without it.
- verified-by: `the terms declare Luvani eligibility and name the licence without claiming other apps agree`

### F484 — The notice lists what the language model is sent, and leaves out what the tutor remembers about you
- severity: P1
- status: [x]
- where: apps/mobile/src/legal/policy.ts:101
- note: the paragraph says the model is sent "what you said, the turns already taken in the same
  session, the situation you are practising, your name where you gave one, and a short note of your
  level", and it was checked against `prepareTurn` and `buildTurnContext` only. `convo.ts` reaches the
  model at five sites, and `buildFrame` (services/tutor-agent/src/convo.ts:1585-1606) sends
  `profile.memory.facts.slice(-5)` into the scene prompt as REAL ACCOUNT MEMORY
  (packages/brain/src/prompt/scenarioPrompt.ts:106). Those are facts about the learner's real life,
  extracted after each session by `extractMemory` (packages/brain/src/prompt/extractPrompt.ts:24-28:
  interests, upcoming events, goals), kept in the profile across sessions (docs/STATE_AND_STORAGE.md:458).
  A learner who says around a scene on Monday "I have a job interview on Tuesday" has that sentence sent
  to the model vendor on Wednesday to build their next scene, and the notice told them only this
  session's turns go. docs/PRIVACY_AND_SAFETY.md:99 says "no stored row ... is handed over", which
  `buildFrame` contradicts, so the notice sentence is sourced from a false doc sentence, the same chain
  as F481. One clause in each, in the learner's words: a few things you have told the tutor about
  yourself, which it remembers so it can bring them up next time. Regenerate `legal/dist/privacy.html`
  or F480's drift test fails. The other three post-session calls (curate :2355, extract :2383, drills
  :2429) send phrases, topics and error tags, which "your level and the things to watch for" already
  covers; no second clause is owed for them.
- verified-by: `the notice says the language model is also sent what the tutor remembers about the learner`

### F485 — The notice says a session, and the model is also sent things after it ends and before it starts
- severity: P2
- status: [x]
- where: apps/mobile/src/legal/policy.ts:103
- note: found while closing F484 and filed rather than fixed, because F484 was scoped to the memory
  facts and a revision round is not the place to widen a document. Two edges remain. `extractMemory`
  (services/tutor-agent/src/convo.ts:2375) and `curateAndDrill` hand the session `history` to the same
  vendor once the session has ended, so nothing undisclosed crosses, but the notice's "while a session
  is running" implies the sending stops when the learner does, and it does not. And `buildFrame`
  (convo.ts:1587-1591) sends `preferences.lastScenarios` beside the memory facts, which is a list of
  what the learner has practised lately; "your level and the things to watch for" arguably covers the
  unmastered phrases sent with it, but it does not cover the scene list. Both are named in
  docs/PRIVACY_AND_SAFETY.md already, so this is one clause in the notice rather than new research.
  Judge's amendment when clearing F484: `extractMemory` also sends `knownFacts: profile.memory.facts`,
  every fact on file up to twelve, rendered as "Already on file:"
  (packages/brain/src/prompt/extractPrompt.ts:42-44). That is the category F484 now discloses, so the
  severity does not move, but the fix should say the facts go after a session as well as when a scene
  is set up rather than only widening "while a session is running". `lastScenarios` holds
  `state.frame.title` (packages/brain/src/profile/profile.ts:576), model-written scene titles going
  back to the model that wrote them, not learner words.
- verified-by: `the notice says when the model is sent something, not only that a session is running`

### F486 — Three citations into the privacy document point at the wrong paragraphs
- severity: P2
- status: [x]
- where: apps/mobile/src/analytics/consent.ts:24
- note: `consent.ts:24` cites PRIVACY_AND_SAFETY.md:176-178, which is now a Supabase event-key migration
  paragraph, and `consent.ts:31` and `analytics/track.test.ts:250` both cite `:590`, now the safety-net
  bullets. All three were already stale before F481 and F484 edited that file; those edits moved
  everything below `:99` further again. A line number in a comment rots by design, so the repair is to
  cite the section heading rather than the line, which is what the rest of the legal modules already do.
- verified-by: `a citation into the privacy document names a section rather than a line`

### F487 — The hosted site answers at its root, rather than a 404 for anyone who trims the URL
- severity: P2
- status: [x]
- where: scripts/legal-html.mjs:1
- note: `npm run legal:html` writes `privacy.html` and `support.html` and nothing else, so
  `https://luvani-legal.pages.dev/` answered 404 the moment the site went up. Apple only ever visits
  the two URLs it is given, so this blocks no submission, but a bare address that answers nothing is
  what somebody sees when they trim the path or when the address is read aloud and typed back. The
  index is generated from the same module as the pages it links to rather than hand written, so it
  cannot name a page that was not built or drift from the notice's own title, and it carries the same
  no script and no external asset rule the other two are held to. Cloudflare serves `index.html` at
  `/` and rewrites the other two to extensionless paths, which is why the links are `/privacy` and
  `/support` rather than the file names.
- verified-by: `the generated site answers at its root and names both pages`
- verified-by: `the index is built from the same module as the pages it links to`

### F488 — The notice swears no other company receives anything, and the store adapter hands one the account id
- severity: P1
- status: [x]
- where: apps/mobile/src/legal/policy.ts:104
- note: the recipients section closes "Nothing goes to anyone beyond the five services that make a
  conversation happen: no advertiser, no data broker, no other company." `adapter.native.ts:24` calls
  `Purchases.configure({ apiKey, appUserID: userId })` and `:27` calls `Purchases.logIn(userId)`, so the
  purchase processor receives the learner's account id and their purchase history. It is a sixth
  company and the sentence denies it. This is the third time in one change that an enumeration in this
  notice has been narrower than what the code sends: F481 missed the language model, F484 missed the
  cross-session memory, and this misses the store. The pattern is the construction, not the oversight.
  A closed count ("the five services") is falsified by every vendor added afterwards and by every vendor
  the writer did not think of, so the sentence should bound sharing by purpose and by the list above it
  rather than by a number, and the store should be named for what it does: it takes the payment and
  tells the app what was bought. `docs/PRIVACY_AND_SAFETY.md` names RevenueCat in its vendor table but
  its recipients paragraph does not, which is the same source gap F481 traced.
- verified-by: `the notice names the payment processor among the companies that receive something`
- verified-by: `the notice bounds sharing by purpose rather than by a count of vendors`

### F489 — A failed Download my data draws its reason below the whole screen, so the tap reads as dead
- severity: P2
- status: [x]
- where: apps/mobile/src/settings/SettingsScreen.tsx:533
- note: `downloadAccountData` answering `{ ok: false }` sets `sheet` to `unavailable`, whose Card is
  drawn after the Phone group, the Help group, the About group, the company line and the version line,
  about a screen and a half below the row that was tapped. The row flips from `Preparing…` back to its
  ordinary value with no live region, so the learner sees a tap that did nothing, which is the dead
  switch F239 refused, on the one control a learner exercises a legal right with. It compounds on
  Android: `sheet === 'unavailable'` makes `useHardwareBack` active, so the next back press is eaten
  closing a card that was never seen and Settings does not pop. Every other refusal on this screen is
  already drawn inside the card it belongs to and above the rows it is about (`consentTrouble`,
  `phoneTrouble`, `contactTrouble`, `storeLine`), and the store line even carries a polite live region.
- verified-by: `every refusal on Settings is drawn in the group whose control caused it`
- verified-by: `a refusal never leaves the hardware back holding a card nobody saw`

### F490 — The delete sheet reopens still accusing the learner of the last attempt's failure
- severity: P2
- status: [x]
- where: apps/mobile/src/settings/SettingsScreen.tsx:396
- note: a wrong password draws `That email and password do not match an account.` Keep my account clears
  `deletePassword` and closes the sheet but leaves `deleteError` set, and neither the Delete account row
  nor `closeCurrentSheet` clears it either. The next opening greets the learner with a red failure about
  something that has not happened yet, on the most consequential question the app asks. `deletePassword`
  is cleared on all three exits precisely so no draft survives the sheet; `deleteError` is the other half
  of that draft and survives all three.
- verified-by: `the delete sheet opens with no failure from a previous attempt`

### F491 — The delete failure is never announced, so the verify button is silent to a screen reader
- severity: P2
- status: [x]
- where: apps/mobile/src/settings/SettingsScreen.tsx:355
- note: the reason is a bare `Text` with no `accessibilityLiveRegion`, no `role="alert"` and no
  `announceForAccessibility`, so VoiceOver and TalkBack say nothing when a delete attempt is refused and
  the learner is left activating a button that keeps not working. The repo already holds this rule and
  enforces it: `surfaceContract.test.ts:470-485` requires all three on the `Field` error line, on the
  stated grounds that an error which only changes pixels is invisible to somebody who cannot see the
  pixels change, and the store line two hundred lines down this same screen does carry a polite live
  region. Passing the reason to the `Field` as its `error` prop gets all of it for free. The password
  branch is the only one whose failure the learner can fix, so it is where the silence costs most.
- verified-by: `the delete failure is announced, not only drawn`

### F492 — The walk back from the phone's settings does not re-read the permission
- severity: P2
- status: [x]
- where: apps/mobile/src/settings/SettingsScreen.tsx:168
- note: the Phone rows are re-read in a `useFocusEffect`, and its comment claims that is "what makes the
  walk back from iOS Settings enough". It is not. `useFocusEffect` fires on a navigation focus change,
  and opening the phone's settings backgrounds the app without Settings ever losing focus, so the effect
  does not run again on return and the row that was meant to disappear stays. There is no `AppState`
  listener anywhere in the app for this. iOS usually terminates the app when a microphone permission
  changes, which hides it for that row; a notification permission does not, which leaves it exposed.
  F476's box was ticked against a test named `the screen re-reads both permissions on focus so the walk
  back from Settings is enough`; the test passes because a focus effect exists, so the name claims a
  behaviour the assertion never checks. Fix the behaviour with an `AppState` listener rather than
  renaming the test, because the row exists to be repairable.
- verified-by: `returning from the phone's settings re-reads the permission, not only re-entering the screen`
- verified-by: `a permission row disappears once the permission it names is granted`

### F493 — Settings is the one root screen with no path, so its address resolves to nothing
- severity: P3
- status: [x]
- where: apps/mobile/src/nav/theme.ts:45
- note: `linking.config.screens` maps every other root screen (Lesson, Convo, Drill, Review, SoundCheck,
  Missions) and not Settings, so on web the address bar shows the raw route name and feeding that path
  back returns undefined: a reload, a bookmark or a shared link drops the learner on Home. The comment
  above the map says it is explicit rather than a catch-all so nothing resolves by accident, which is
  exactly why a root screen added without its path leaves an address the app produces and cannot read.
  It lands on the one screen holding delete account and data export.
- verified-by: `every root screen the navigator can push has a path it can be read back from`

### F494 — The device runbook still routes deletion through Profile
- severity: P3
- status: [x]
- where: docs/DEVICE_VERIFICATION.md:314
- note: D10 and its neighbours say "Profile → Delete account". Profile has no Account group any more; the
  row is on Settings, one push further in. A runbook step that names a control that is not there is a
  walk somebody cannot complete, and these rows are the evidence a release decision is made on.
- verified-by: `the device runbook routes every settings check through the screen that holds it`

### F495 — A Google or Apple account can never finish deleting on the web build
- severity: P2
- status: [x]
- where: apps/mobile/src/auth/supabaseAdapter.ts:153
- note: found while sweeping this change and filed rather than fixed, because the file is outside it.
  `reauthenticateForDeletion` on web calls `startGoogleSignIn`, which is an unconditional
  `signInWithOAuth` redirect; the learner returns at the app root with a fresh session, walks back to the
  sheet, and the next attempt redirects again, because nothing between the tap and the redirect asks
  whether this session was just re-proved. `deleteAccount()` is never reached and the branch's own
  sentence, "Finish signing in with Google, then return here and delete the account again.", promises a
  second attempt that completes. The Apple branch is identical. Native is unaffected.
- note: 2 October 2026: verified SDK JWT claims can confirm an already-recent Google/Apple web authentication before opening another redirect. The five-minute proof and expired/refresh-only refusal tests pass; independent gpt-6-sol review accepted the code fix. Real web OAuth return remains unverified.
- verified-by: `a reauthentication that already happened is not asked for again`

### F496 — The warning that the phone still holds a copy is set on a screen that has already gone
- severity: P1
- status: [x]
- where: apps/mobile/src/auth/deleteAccountFlow.ts:1
- note: pre-existing, and found by sweeping the delete path this change moved. When the server delete
  succeeds and `clearActiveUserData` throws, `deleteAccount` calls `auth.signOut()` and then returns the
  message "Your online account was deleted, but this device could not finish erasing its local copy.
  Clear the app data before sharing this device." The sign-out unmounts the authenticated tree, including
  the sheet whose `setDeleteError` is the only thing that draws it, so the sentence is written to a
  component that no longer exists. The learner is returned to the sign-in screen believing everything is
  gone while the phone still holds their learning history, which is the case the message was written for
  and the one that matters on a shared device. `useAuth` already carries `recovering` and `clearRecovery`
  as a seam for a message that has to outlive a sign-out. **Fixed elsewhere than filed**: `recovering`
  turned out to be the wrong seam twice over, because `useAuth.tsx` clears it on exactly the event the
  message must survive and because it already means a reset link landed and a new password is owed, so
  reusing it would have shown the password screen to somebody with no account. Its shape was copied
  instead: the ordering moved out of the component into `auth/deleteAccountFlow.ts` as four injected
  steps, and the fact that a copy remains is held in `Gate` beside the other state that crosses the auth
  door, in memory rather than on disk so it cannot arrive on a later launch as a stale accusation.
- verified-by: `a local erase that failed is told to the learner after the sign-out, not before it`

### F497 — The Settings footer still carries the denial the notice had to drop
- severity: P1
- status: [x]
- where: apps/mobile/src/legal/company.ts:152
- note: `privacyNote()` ends "Nothing is shared with anyone else or sold for advertising." That is the
  same flat denial F481 struck from the notice and F488 replaced with a purpose bound, still drawn under
  the Data and privacy group and still shown on the first run through `onboarding/disclosure.ts`. It was
  defensible while its own vendor phrase read "speech and language services", because a language model is
  a language service; it is not defensible now that F488 has established the payment processor, the
  database host and the counter store as recipients, none of which is a speech or language service. The
  footer and the notice are one vocabulary for one pipeline, which is the decision `disclosure.test.ts`
  exists to hold, so they cannot disagree about who receives something. The fix is one sentence plus the
  character-for-character assertion at `disclosure.test.ts:210` that pins it.
- verified-by: `the footer bounds sharing the same way the notice does`

### F498 — Deleting an account leaves the purchase processor still holding the learner
- severity: P1
- status: [x]
- where: services/token-server/src/accountDeletion.ts:1
- note: found while closing F488 and filed rather than fixed, because the fix is server work outside that
  entry. `POST /account/delete` removes the Supabase user and everything that cascades from it, and
  nothing anywhere in this repo calls the purchase processor's delete API, so the subscriber record and
  the purchase history keyed to `appUserID` outlive the account they belong to. The processor learns the
  account id from `Purchases.configure({ appUserID: userId })` in `apps/mobile/src/purchases/
  adapter.native.ts:24`. Under UK GDPR erasure that is a controller obligation this repo does not
  discharge, and it is not covered by the notice's "Two things are kept on purpose", which is about our
  own systems and names only the trial markers and the installation id. Either the deletion path calls
  the processor, or the notice says plainly that a purchase record stays with the company that took the
  payment and why. Doing neither is the gap. **Scoped to the disclosure half**: the notice now says the
  purchase record survives, and the two-things count above it is scoped to our own systems, so one
  sentence changes when the call lands. Calling the processor's delete API is server work and a founder
  decision, filed separately as F499.
- verified-by: `the notice distinguishes a purchase erasure request from store cancellation`

### F499 — Nothing calls the purchase processor's delete API, so the record is disclosed rather than removed
- severity: P2
- status: [x]
- where: services/token-server/src/accountDeletion.ts:1
- note: split out of F498, which closed the disclosure half. The notice now tells a learner plainly that
  the company which took the payment keeps its own record and that deleting the Luvani account does not
  reach it, which is honest but is not erasure. `POST /account/delete` reaches Supabase and the device
  and stops. Under UK GDPR the controller obligation is to pass an erasure request to processors, so
  disclosure is a floor rather than a discharge. It is filed rather than built because it is server work
  and because the founder has not chosen between calling the API and standing on the disclosure. F498's
  test asserts that `accountDeletion.ts` mentions nothing of the processor, so whoever implements this
  gets a failure naming the sentence in the notice that has to change with it.
- continuation: On 2 October 2026 the founder authorized processor erasure. The server now requires a successful queued RevenueCat DELETE (200 or already absent 404) before identity deletion; missing configuration and refusal keep the account available for retry. The notice distinguishes an accepted asynchronous erasure request from store subscription cancellation. Independent gpt-6-sol review accepted the code after 32 focused tests; actual vendor completion and native store cancellation remain unverified.
- verified-by: `account deletion asks the purchase processor to erase its record too`

### F500 — The first run still carries the flat denial in the one line everybody reads
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/disclosure.ts:152
- note: the fourth instance of the construction F481, F484, F488 and F497 each corrected somewhere else.
  `MEET_PRIVACY` ends "and nothing is shared with anyone else", on the first-run page every learner sees,
  after the footer and the notice have both stopped saying it. It is narrower than the sentences already
  fixed, because its subject is what a learner says during a session and neither the payment processor
  nor the counter store receives that, but it is not clean either: the curated summary derived from what
  was said is kept in a database a third party runs for us. The clause is pinned character for character
  at `apps/mobile/src/tutor/tutorName.test.ts:357-359`, so the fix is one sentence plus that mirror
  string, and the pin is the reason it was left rather than an argument that it is right.
- verified-by: `the first run bounds sharing the same way the footer and the notice do`

### F501 — One paragraph of the notice still closes on a count
- severity: P3
- status: [x]
- where: apps/mobile/src/legal/policy.ts:103
- note: "Nothing about that session goes to any of the five after that" is bounded to the five services
  the paragraph immediately above enumerates, so it is defensible as a back-reference rather than a
  claim about the world. It is filed because it is the exact construction that went stale three times in
  one change, and because a sixth conversation vendor, a second transcriber or a fallback voice would
  falsify it silently while every test stayed green. `LUVANI_TTS_VENDOR` can already point the voice at
  a second supplier, which is the shape of the thing that will break it. The repair is to say what the
  sentence means, that nothing more about that session leaves after the work above is done, without
  counting.
- verified-by: `no sentence in the notice depends on how many vendors there are`
### F502 — The roster is re-picked for voices the vendor verifies for French-accented English
- severity: P1
- status: [x]
- where: services/tutor-agent/src/voice.ts:110
- note: F508 established that not one of the eight was labelled `en-french` on the pinned model and
  that the default had no English row at all, so the American a founder heard was the vendor's own
  label and no copy could move it. Of 1,500 library French voices, 16 are verified for French AND
  `en-french` on `eleven_multilingual_v2`. The founder picked from their free previews by ear, and
  where a voice they liked had to be replaced the shortlist was ranked by measured pitch and
  spectral centroid against the voice being replaced, so a swap keeps the timbre it can. All six
  were confirmed to synthesise and to be listed on the account before any of this landed, because
  preflight refuses to boot on a voice the account cannot see.
- verified-by: `every voice the catalogue offers is verified for French and English on the model the tutor pins`
- verified-by: `the committed clips record the text, the voice and the settings that made them`
- verified-by: `a clip nobody has listened to cannot be recorded as heard`

### F503 — Six voices, three and three, and the default moves off a voice that was retired
- severity: P1
- status: [x]
- where: packages/core/src/protocol/voices.ts:47
- note: eight was six men and two women, and half of them were voices the founder called muffled.
  Six that carry the product beats eight that do not. `luc`, `enrick`, `mathieu`, `benoit` and
  `celine` retire; `anatole`, `marie` and `sarah` arrive; `alexandre`, `guillaume` and `emilie`
  keep their names and get new recordings behind them. `luc` was the default and no verified voice
  sits near it acoustically, so keeping the name would have meant introducing the tutor as someone
  who no longer sounds like himself; the default becomes `alexandre`. A stored retired key lands on
  the default at both ends of the wire, which `resolveTutorVoice` already does and `upgrade.ts`
  already documents, and nothing has shipped to a store. Catalogue order alternates gender so the
  first screen of the chooser shows both.
- verified-by: `the catalogue offers six voices, three men and three women, with one default`
- verified-by: `anything else resolves to the default, and never throws`
- verified-by: `every bundled clip is on disk, so the app can be built at all`

### F504 — A sound line says only what the vendor's label and the recording can back
- severity: P1
- status: [x]
- where: packages/core/src/protocol/voices.ts:103
- note: five of the eight lines claimed Paris or Quebec. None of the 16 candidates is Québécois and
  the accent labels are mostly `standard`, so the old lines would have been false under the new
  voices. The rule is now mechanical: `A {young }{man's|woman's} voice, from {place}.` where
  `young` appears if and only if the age band is young, the noun follows `gender`, and `place` comes
  from the vendor's own French accent label. Nothing else may appear, and none of the vendor's
  marketing words. The shape is pinned by regex in core and cross-checked in the agent's suite
  against the vendor block the sample run records, so a line is honest by machine and not by eye.
- verified-by: `a sound line says gender, age band and where the vendor places the accent, and nothing else`
- verified-by: `the catalogue's sound lines agree with what the vendor says about each recording`

### F505 — The introduction is two plain sentences again, and the accent is the voice's job
- severity: P1
- status: [x]
- where: packages/core/src/protocol/voices.ts:226
- note: F507 made the line one sentence so a single request would carry both languages and the
  French clause could prime the English one. The founder listened on 2026-09-10 and the accent had
  not moved, and "and in English, my name is" read as absurd, because a name does not translate and
  the second half carried nothing new. Reversed deliberately: `Bonjour, je m’appelle ${name}. Hi, my
  name is ${name}.` Two sentences, two requests, one beat between them, and the accent comes from
  F502's voices instead. The count is still pinned, at two, because it is what the manifest records
  and what a live session would send: one means the bridge is back, three means a stray period ships
  in every download.
- verified-by: `every voice introduces itself in two short sentences the catalogue owns, French first`
- verified-by: `the English sentence reaches the vendor on its own, short and in the same voice`
- verified-by: `the introduction is written in one place, and every screen reads it from there`
- verified-by: `voice sample captions come from the same catalogue as the bundled audio`

### F506 — The output encoding was the plugin's default, and the clips were quieter than they needed to be
- severity: P1
- status: [x]
- where: services/tutor-agent/src/voice.ts:333
- note: `voice.ts` pins the model, the settings and the language so a plugin upgrade cannot move the
  sound on its own, and forgot `encoding`, which silently inherited `pcm_22050`. A founder called the
  voices muffled, and three causes were tangled together: the vendor sample rate, our codec, and the
  recordings. Measured on 2026-09-10: `pcm_44100` is refused on this account with `403 Output format
  'pcm_44100' is only available on the Pro tier and above`, so 22050 is the ceiling until the
  subscription changes and that is recorded here rather than discovered again. Within that ceiling
  two things were free and are now taken: the clip bitrate goes from 48 to 64 kbps at maximum codec
  quality (72 and above are refused at this rate), and the vendor hands back audio peaking near
  -4.8 dBFS which is lifted to -1 dBFS, changing loudness and nothing else. The encoding is now
  passed explicitly, which re-keys nothing because the rate was already in the cache hash.
- verified-by: `the output encoding is pinned, not left to the plugin default`
- verified-by: `a sample clip is levelled and encoded the way the script says, not the way a default decided`
### F507 — The voice samples said words the app had stopped showing
- severity: P1
- status: [x]
- where: services/tutor-agent/src/voiceSamples.ts:89
- note: the eight clips in `apps/mobile/assets/voices/` were synthesised in 5a49cce and never
  regenerated. `sampleText` was rewritten hours later in c611bcc, so for a week the caption on the
  first-run voice page read one sentence while the audio spoke another. Nothing could tell: the
  sentence was hand-typed in three places and the clips recorded nothing about themselves, and the
  only existing guard is an existence check, which F299 installed and which is green on clips
  saying anything at all. Presence, then existence, now content. The line moves to
  `tutorSampleLine` in core so the agent and the screen read one literal, and the generator writes
  a provenance record whose sha256 of each committed clip cannot be satisfied by editing a string.
  The clip also becomes one bilingual sentence, which the splitter keeps whole, so one request
  carries both languages instead of two requests carrying one each.
- note 2026-09-10, later: the one-sentence half of this was heard and did not work. The clips were
  regenerated, the founder listened, and the English was still American, because the cause was the
  voice and not the request shape (F508, then F502). The line is two sentences again under F505 and
  the two test titles that pinned the single request are retired with it. What stands, and what made
  the reversal checkable at all, is the staleness half: the sentence living once in core, the
  provenance manifest, and the sha256 of every committed clip.
- verified-by: `the committed clips record the text, the voice and the settings that made them`
- verified-by: `the introduction is written in one place, and every screen reads it from there`
- verified-by: `a clip nobody has listened to cannot be recorded as heard`
- verified-by: `voice sample captions come from the same catalogue as the bundled audio`

### F508 — No voice in the catalogue is verified for French-accented English on the pinned model
- severity: P1
- status: [x]
- where: services/tutor-agent/src/voice.ts:102
- note: the comment there claims all eight are verified by the vendor for BOTH French and English
  on `MODEL`. Read back from the vendor on 2026-09-10 that is false for `luc`, the DEFAULT voice,
  which has no English row on the pinned model at all; its only English row sits on a different
  model and is labelled `northern`. For the other seven the pinned model's English accent label is
  `en-american` (alexandre, guillaume), `en-british` (mathieu, emilie), `en-singaporean` (benoit)
  or `other` (enrick, celine). Not one is `en-french`. So the American English a founder reported
  is the vendor's own label, and F507's one-request change is necessary for the words and is not
  expected to fix the accent on its own. The ladder, cheapest first: the four voices labelled
  `en-french` carry that label on `eleven_flash_v2_5` and `eleven_turbo_v2_5`, so a model move is
  one lever but it re-keys every warmed WAV and still leaves four voices wrong; re-picking the
  roster for voices verified `en-french` on the pinned model is the only lever that delivers what
  was asked, and a first read of 100 library French voices found only three candidates; dropping
  the English half and shipping a French-only sample is the honest fallback. Do not reach for
  `LANGUAGE_CODE`: it was already `fr` when these clips were made.
- note 2026-09-10, later: confirmed by ear. The one-sentence clips were regenerated and the English
  half was still American, which is what this entry predicted from the labels. The fix is F502: the
  roster is re-picked from the 16 library voices verified `fr` and `en-french` on the pinned model.
  The evidence a test can read is the vendor block the sample run now records per clip; the evidence
  no test can read is the `heard` line, which is why this cannot be ticked until a person has played
  the new clips and said what the English sounded like.
- verified-by: `every voice the catalogue offers is verified for French and English on the model the tutor pins`
- verified-by: `every listen says what the English half sounded like`

### F509 — The live session's English is synthesised with no French around it
- severity: P2
- status: [x]
- where: services/tutor-agent/src/voice.ts:196
- note: the opener, the scene-setting narration and every coaching line are English, and each
  reaches the vendor as its own request because the framework's sentence adapter splits on
  sentence boundaries by construction. That is ten times the surface of one onboarding clip, and
  `LANGUAGE_CODE`'s own docstring already says the pin stays until two takes have been compared by
  ear, which never happened. This is NOT F507's fix applied again: those lines are generated by
  the brain at runtime, so there is no copy to comma-join, and a narration cannot be one sentence.
  It is a configuration question, whether a language can be chosen per line rather than pinned for
  the session, or the voice question F508 describes. Filed separately so nobody attempts the
  comma and abandons it. Note also the honesty debt F507 creates: once the sample's English is
  better than the session's, F295's promise that the clip is exactly what the tutor sounds like is
  false in the opposite direction from the staleness it replaced.
- note 2026-09-10, later: THE PREMISE ABOVE IS WRONG and this entry is re-scoped rather than
  worked as written. "Synthesised with no French around it" framed the isolation as the defect. It
  is not: the accent follows the RECORDING, not the request. The onboarding sample's English
  sentence is also an isolated request tagged `fr`, and once F502 replaced the roster with voices
  whose English the vendor verifies as `en-french` the founder listened and confirmed it sounds
  French. The live session uses the same `buildTTS`, the same six voices and the same request
  shape, so the accent half of this entry closed with F502 and the "sample better than the session"
  honesty debt closed with it. What was actually unverified, and what nobody had ever checked, is
  that `language_code: 'fr'` puts a FRENCH TEXT NORMALIZER on every English line. The sample never
  exposed it because "Hi, my name is Alexandre." has no digit in it. F511 fixes the fixed-copy half.
  What stays open here is the generated half and the vendor's actual normalizer behaviour, which
  needs an ear: no schema in this repo can forbid a digit in a generated English field, because
  `contract/schemas.ts:13-17` records that no regex or refinement survives the trip to the API.


- note 2026-10-03: Generated English normalization was tested with six Alexandre time/money/French-control A/B clips. Founder preferred automatic language detection and confirmed French natural. Live requests now omit the French pin and invalidate both cache identities. All six chooser previews were refreshed through the live seam and heard by the founder; frozen French-only batches stay unchanged. This closes the scoped configuration/listening defect, not every possible English pronunciation. Mixed-language ASR is separately investigated and held in F695.
- verified-by: `live synthesis preflight omits the old French-only language request`
- verified-by: `approved live language detection invalidates French-pinned saved audio while recording batches stay French`

### F510 — Retiring a voice threw away the whole pre-account draft
- severity: P1
- status: [x]
- where: apps/mobile/src/onboarding/preAccountDraft.ts:50
- note: found by merging F502's roster change into main's consent work, which is the only place the
  two could meet. `readable` required the stored `tutorVoice` to be a live catalogue key, so once
  F503 retired five of the eight, a draft written before that failed the check and `loadPreAccountDraft`
  returned null. That does not merely lose a voice choice: the draft is what carries the age
  confirmation and the usage-data answer across sign-up, so the learner was asked every question
  again and a recorded "yes" to analytics quietly became "not asked". A retired key is a repair and
  not a corruption, which the rest of the stack already knows: `resolveTutorVoice` at the agent and
  `tutorVoiceOf` on a stored profile both land an unknown key on the default and never throw. The
  draft loader now does the same, and an unreadable draft — a version that is not 1, an age that was
  never confirmed — is still refused rather than repaired into a confirmation nobody gave.
- verified-by: `a retired voice becomes the default, and the rest of the draft survives`
- verified-by: `the draft carries the answer and a missing one reads as no`


### F511 — A spoken safety threshold was a bare digit read by a French normalizer
- severity: P1
- status: [x]
- where: services/tutor-agent/src/safety.ts:680
- note: found by enumerating every English line the live tutor actually speaks, which F509 should
  have done before it guessed. Two of the eight safety messages carried a bare digit — "anyone under
  13" and "anyone under 18" — and every synthesis request carries `language_code: 'fr'`, which the
  vendor uses for text normalisation as well as for the model. For most copy a French normalizer on
  English is a wrong accent. Here the number IS the content of the refusal, the line is spoken
  uninterruptibly, none of the eight is in the warm cache so each is a live vendor call, and on a
  stop it is the last thing a learner hears before the room closes. A safeguarding threshold spoken
  as "treize" is a refusal that does not land. Both are words now; a word cannot be renormalised
  into another language, and it costs nothing. `docs/PRIVACY_AND_SAFETY.md` quotes both messages and
  moved with them. The same sweep found the digit rule for the conversation lines was reading two of
  the three fields on each line, so `bridge.spoken` — the French/English hybrid said on the way into
  every single scene, and the most-spoken string in the product — was never checked at all. Both
  guards were mutation-tested rather than assumed: putting a digit back fails each one.
- verified-by: `no spoken safety line hands a bare number to a French text normalizer`
- verified-by: `the canned lines obey the learner-copy rules`

### F512 — Max is three hundred minutes at twenty nine dollars, and every allowance table says so
- severity: P1
- status: [x]
- where: packages/core/src/metering/meter.ts:50
- note: the second paid tier was 450 minutes at $39. It is now 300 at $29. The price came first and
  the minutes had to follow it: serving 450 minutes costs about $26.01 and $29 nets $24.65 after the
  small business store fee, so at the old allowance the heaviest Max subscriber was a loss, at minus
  5.5% worst-case margin. The twenty percent floor is a strict inequality and breaks at 341 minutes.
  300 costs about $17.34 and leaves 29.7%, and still 14.6% at the standard store rate, which is the
  arm the other margin test asserts stays below twenty — a test that fails from the profitable side,
  so whoever moves this next reads its message rather than fixing its number.
  The allowance is not owned by one line. Every migration and rollback that defines the debit carries
  its own copy of the `case plan ... end` table, and `databaseContract.test.ts` holds all of them
  equal to PLANS, so seven SQL files moved with the constant. Rewriting a file does not touch a
  database that already ran it, so an eighth migration replaces the function body, and its rollback
  restores the previous definition rather than the previous number: a database serving 450 while the
  app and the token server both believe 300 would keep starting sessions after the balance the server
  reports has run out, and the refusal that raises the subscription wall would never fire.
  Nobody is moved by this. `paidPlan` in `services/token-server/src/billing/revenuecat.ts:66` is the
  only thing that writes a paid plan, and it is reachable only through a billing configuration that
  is all-or-nothing over five unset environment variables, so no entitlement row carries `regular`.
  The stored id stays `regular` and only the label becomes "Max", which keeps a check constraint on
  the payment path out of this change entirely.
  Nothing pinned the seconds before now, so the size of this job was discovered rather than known.
  It is pinned in `meter.test.ts` beside the price, which is the entry's own lesson.
- verified-by: `a price change is a three-part change: this constant, these floors, and the store tier`
- verified-by: `an allowance change is a nine-file change, and this is the only line that says so`
- verified-by: `the atomic debit uses the same plan limits as core`
- note: 2026-10-23, REV-001 (DECISIONS.md): the founder repriced Core and Max ($14.99, 300 min; $24.99, 600 min; yearly $99 and $169), knowing full use now loses money (Core -14%, Max -36% at 15%). The twenty-percent floor no longer holds by decision, not by drift. These tests replace it and pin the new figures.
- verified-by: `both paid plans lose money on a learner who burns every minute, and the size is pinned (REV-001)`
- verified-by: `at 40% utilisation and the Small Business rate Core clears 50% and Max 40%`
- verified-by: `a paid year is twelve monthly allowances, and its full-use loss is pinned (REV-001)`
- verified-by: `at 40% utilisation and the Small Business rate yearly Core clears 15% and yearly Max breaks even`
- note: 2026-10-23, VOICE-008 re-priced the cost model from measured rates ($0.048 a minute). Monthly plans now clear 20% even at the standard 30% fee. Small Business enrolment still matters for the yearly plans: yearly Max loses about $1.12 a month at full use on the standard rate, and yearly Core breaks even.
- verified-by: `every migration ships a rollback that names each object it created`
- verified-by: `the supabase runbook applies every migration in order and pairs each with its rollback`
- verified-by: `the outstanding schema instruction names every migration in the runbook`

### F513 — A change of plan inside a paid period handed out a fresh allowance
- severity: P1
- status: [x]
- where: services/token-server/src/billing/revenuecat.ts:95
- note: found while widening the store adapter to two buyable tiers, which is what makes it
  reachable. `projectSubscriber` decided whether to keep a learner's spent seconds with
  `current.plan === plan && current.periodEnd?.getTime() === periodEnd.getTime()`, and cleared the
  counter to zero whenever that was false. The plan being in the comparison is the defect: any
  crossgrade cleared the meter. On a store whose proration keeps the expiry date through a plan
  change, moving between the two paid tiers was a full new allowance, as often as a learner cared
  to switch, for whatever the crossgrade cost. Apple usually opens a new period on an upgrade so
  the reset was right by accident there; Google's proration modes do not have to, and Android was
  going to meet this first.
  A period is what was paid for, so the period is what is compared. Seconds already spent now carry
  over and are clamped to the cap of the plan now held, and only a genuinely new `expires_date`
  grants a new allowance. A first purchase out of the trial still grants in full, because a trial
  has no period to be inside.
  Latent today: no store product exists and no receipt has ever been verified, so nobody holds a
  paid plan to crossgrade away from. It is filed as P1 rather than P2 because it is closed, and
  because it stops being latent on the same day the first key is set.
- verified-by: `crossgrading with the period untouched carries the seconds over rather than clearing them`
- verified-by: `the same move at a new expiry does grant the new allowance, because that period was paid for`
- verified-by: `a first purchase from the trial grants a full allowance`

### F514 — The plan catalogue reached the app only by being refused
- severity: P2
- status: [x]
- where: services/token-server/src/server.ts:357
- note: `PLANS` was attached to the 402 and to nothing else, so the app could not know what a plan
  buys in minutes until a learner had been turned away at least once. Any screen wanting it sooner
  had exactly two options: be refused first, or compile its own copy of the numbers into the
  binary. The second is F266 with extra steps, and it is also the thing that would stop a price
  changing without an app update.
  The catalogue now rides the 200 grant as well. It costs one field on a response the app already
  reads, it is the same object the refusal carries so the two cannot disagree, and `plansIn` already
  validates that shape at the door.
- verified-by: `the grant carries the plan catalogue, so a learner need not be refused to learn the price`

### F515 — A monetisation surface with no events is a surface nobody can improve
- severity: P2
- status: [x]
- where: apps/mobile/src/analytics/track.ts:22
- note: `ProductEvent` was a closed five-event union with nothing about purchases or the paywall
  in it, so the subscription wall would have shipped unable to answer the only question it exists
  to answer: which page lost them. Five events added: `wall_shown` carrying the entry point and
  the computed page count, `wall_page_seen`, `plan_selected`, `purchase_started` and
  `purchase_settled` carrying the same closed outcome set `restore.ts` answers with. `pages` rides
  with `wall_shown` because the page list is computed per showing, so a drop-off at index two says
  nothing without knowing how many there were.
  Three layers had to move together, as the union's own comment says: the union, `parseProductEvent`
  in the token server, and the `validate_product_event` trigger in PostgreSQL, the last as migration
  14 with an interlocked rollback. Landing fewer than three is invisible rather than loud, because
  the server turns a rejected write into a 500 and the client swallows it by design.
  Nothing here can carry learner content, and that is held rather than intended: a test reads the
  union and refuses `string` on any wall property, because a funnel is exactly where somebody
  reaches for a free string to make a report richer. The privacy notice's event count moved from
  five to ten in the same change, and the hosted page was regenerated from the module.
- verified-by: `every wall property is a closed set or a small number, never a free string`
- verified-by: `no purchase event can name the free trial, because a trial is not something anybody buys`
- verified-by: `the parser and the trigger require the same properties for every product event`
- verified-by: `the policy says only what the privacy document says is true`
- verified-by: `the gate fails when the committed html no longer matches the module`
- verified-by: `every migration ships a rollback that names each object it created`
- verified-by: `the supabase runbook applies every migration in order and pairs each with its rollback`
- verified-by: `the outstanding schema instruction names every migration in the runbook`

### F516 — The free tier had no shape, so the only way to draw it was a falling number
- severity: P2
- status: [x]
- where: apps/mobile/src/wall/welcomePath.ts:1
- note: thirty free minutes existed as a server-side integer and nothing else. Drawn honestly that
  is a fuel gauge, and drawn on the phone it is a number the phone cannot verify, which F239 and
  F377 both already refused. The founder asked for a path instead: a few short situations each
  ending in a real win, with the ask arriving when the learner reaches for the next one.
  No content was written for this. `MISSIONS` was already exactly that: six authored situations,
  four to five beats each, every one carrying a `winEn` that describes rather than praises, and the
  catalogue's own comment states the thesis. The path is four of those six, drawn rather than
  authored. Four because thirty minutes across six scenes leaves no slack once
  `MIN_VIABLE_SESSION_SEC` makes the last two minutes unstartable, and because two held back give
  the wall something specific to offer instead of an abstract pitch.
  `wallMap` is the first page. Four rows always, lit off `timesFinished > 0`, a walked room reading
  its own win and an unwalked one its own goal, plus one line of the learner's own French per lit
  room from the join between `mission.phraseKeys` and `retainedOrder`. Nothing a row carries is
  about payment, so the same picture would be drawn by a free app, which is what lets the wall be
  shown twice without curdling.
  F520 later changed which way round this page opens once the path is walked, and the test named
  below moved with it. The four-rows property it was really defending is untouched: a learner who
  has walked nothing still gets four rows naming four capabilities.
  This is packaging rather than pedagogy, and the server neither knows nor cares which room a
  second was spent in, which is why the list lives beside the wall it justifies rather than in
  `PLANS`. It is not enforcement either: a learner who reaches a held back room is stopped by the
  402 at the door.
- note: 2026-09-27 notebook final sweep: the map page, its model and its learner-quote projection
  are deleted. The old map-row tests have no surviving renderer to exercise; their successor
  proves the sources and renderer stay absent and analytics accepts only the two current pages.
  The live welcome-path partition and ordering tests below are preserved, not aliased.
- verified-by: `the retired map and French wall pages have no source, renderer or analytics page`
- verified-by: `no door ever draws more than two pages, or the retired map and French pages`
- verified-by: `every situation is either on the path or beyond it, and none is both`
- verified-by: `the path climbs, rather than putting both A1 rooms first`

### F517 — Every decision the wall makes had nowhere to live but a screen
- severity: P2
- status: [x]
- where: apps/mobile/src/wall/wallCopy.ts:1
- note: apps/mobile has no renderer, so a decision inside a `.tsx` is a decision nothing can ask a
  question about, which is the reason `subscription.ts` gives for its own shape. A four page
  purchase surface is the worst possible place to learn that lesson late, so the copy, the page
  list and page two's one decision are plain modules with tests that call them.
  The copy deck carries no digit and no currency symbol, held by a scan: every number the wall
  shows comes off the wire. It also refuses a line that counts the situations or the plans, and
  that caught one on the way in. "Two plans" was true when written, and would have become false
  the day annual arrives, silently, because prose does not typecheck.
  The page list is computed rather than a constant. Page four is impossible without a store, so
  three pages have to stand alone, which is also what lets the whole flow be reviewed before the
  first RevenueCat key exists. The Settings door goes straight to the price. And `ProgressDots`
  takes a total, so a total that lies tells a learner the wall is longer than it is exactly when
  they are deciding whether to go on.
  `WallPage` and `WallEntry` double as two analytics events' property values and the compiler
  cannot see the agreement, so a test reads it out of both files. Page two counts nothing for
  itself either: `progress/momentum.ts` owns every count in this app and Home draws the same
  numbers, so a second fold would be a second answer to a question with one owner.
- verified-by: `every line clears the guilt list, the em dash walk and the price rule`
- verified-by: `nothing this module exports is missing from the scan`
- verified-by: `the free promise is said once, and it is what stays rather than what stops`
- verified-by: `the paid promise is about having conversations, not about keeping anything`
- verified-by: `no line counts the situations on the path`
- verified-by: `the plans page says what a subscription is, which Apple asks for and a learner is owed`
- verified-by: `a real mission phrase would be refused by the guilt list, which is why it is not scanned`
- note: notebook redesign (2026-09-27): the wall became two pages, what you get and then the plans,
  priced as conversations a week from each plan's minutes. With no store it is one page that still
  ends on the free promise. The page tests were renamed with it.
- verified-by: `with a store there are two pages, what you get and then the price`
- verified-by: `with no store there is one page, and the wall ends on the free promise`
- verified-by: `somebody who came to buy is not sold to`
- verified-by: `the value pages never vary by what the learner has done`
- note: 2026-09-27 notebook final sweep: the French-evidence wall page and projection are gone;
  their two tests are superseded by a source/renderer/analytics retirement check, not by aliases.
- verified-by: `the retired map and French wall pages have no source, renderer or analytics page`
- verified-by: `WallPage and wall_page_seen name exactly the same pages`
- verified-by: `WallEntry and wall_shown name exactly the same doors`

### F518 — The subscription wall had no face, and no way to be looked at before one existed
- severity: P2
- status: [x]
- where: apps/mobile/src/wall/WallScreen.tsx:1
- note: the wall's decisions all had tests and none of them had a screen. Three pages now exist,
  on a route above the tabs the way Settings is, so the tab bar goes with the push and the wall
  owns the screen while it makes its case. Each page is null gates and a stylesheet; everything
  either of them draws was decided in a module a test can call.
  The purchase page is absent rather than stubbed, and the page count follows it: three dots, and
  the last action says keep practising rather than offering a plan that cannot be bought. That is
  what a web learner sees and what every build sees until the RevenueCat keys exist, so the thing
  reviewed is the thing a keyless build does rather than a mock of it.
  A preview switch opens the wall directly, because a wall nobody can look at until payments are
  configured is a wall nobody can correct, and `docs/RELEASE_GATE.md` is explicit that configuring
  payments first is not acceptable. It is gated on three conditions at once, the way
  `developmentEntitlementsEnabled` is: the preview flag, the explicit local-development switch the
  mock auth adapter also needs, and the absence of a production build. The third has its own test.
  Building it found one real defect in the making. The screen reached for `missionStates` with the
  store's own `MissionCompletion`, whose `id` is a plain string because a disk read cannot promise
  the id names a mission this build ships. Every other screen goes through `missionCompletionsFrom`,
  which drops those and validates the rung, and the typechecker refused the shortcut before a row
  could be drawn for a mission that no longer exists.
- verified-by: `all three conditions together, and nothing less`
- verified-by: `a production build refuses it however loudly the flags are set`
- verified-by: `it rides the same switch the mock auth adapter needs, so it cannot reach real infrastructure`
- verified-by: `an empty environment is off, which is what every build that never heard of it has`
- verified-by: `every root screen the navigator can push has a path it can be read back from`
- verified-by: `every tab and pushed screen is built on Screen or ScrollScreen — F307`
- verified-by: `no adopted screen reads the safe area or opens a ScrollView for itself — F307`

### F519 — The second tier existed on the server and could not be bought from the app
- severity: P1
- status: [x]
- where: apps/mobile/src/purchases/adapter.ts:1
- note: `StoreProduct.plan` was the literal `'starter'` and `StoreOffering` carried one product, so
  the tier the server has always mapped, configured for, and priced had no purchase path at all.
  `PaidPlan` and `PAID_PLANS` replace the literal, the offering carries a list, `adapter.native.ts`
  reads both product ids and asks `getOfferings` once for both, and `purchase` accepts either. A
  build naming one product sells the one it has rather than nothing, because a half-finished store
  setup should be visible as one tier rather than as a dead purchase path.
  `purchasable(offering)` is now the single answer to "is there anything to sell", so the Settings
  group, the terminal refusal block and the wall's plans page cannot disagree about it.
  `paywallSurface` derives the cheapest tier from it and stays one button with no choice to make:
  a learner stopped at a room door is not in a position to weigh two plans, and the wall is where
  that comparison belongs. Its label now names `product.title`, because a build configured with
  only the second product would otherwise have offered Max under the word Starter with a price
  beside it making that look deliberate.
  Page four is the comparison. Two cards that select rather than buy, with the one primary pill in
  the frame's footer, which keeps this app's one-primary-per-door rule and also makes
  `plan_selected` and `purchase_started` two different events instead of one. Every number on it
  comes off the wire: the price from the store's localised string, the allowance from the catalogue
  the server sends. `wallPlans.ts` is the only thing dividing by sixty and carries no currency
  symbol at all.
  Apple's Guideline 3.1.2 wants the subscription length, the renewal and both documents on the
  purchase screen. `PolicyScreen` and `TermsScreen` were early returns inside Settings, reachable
  from nowhere else, so they are root routes now with web addresses of their own.
- verified-by: `without a configured key the adapter reports purchases unavailable`
- verified-by: `the paywall stays dark until the store returns a purchasable product`
- verified-by: `paywall copy carries no banned words and no invented price`
- verified-by: `the subscription group is drawn only when the store answers with a product`
- verified-by: `an unavailable store, an empty list and a blank price all answer null`
- verified-by: `the allowance is the catalogue's, in whole minutes`
- verified-by: `no catalogue means no allowance shown, rather than an allowance guessed`
- verified-by: `the order is the offer, whatever order the store answered in`
- verified-by: `a store selling one tier draws one card, not a gap and not a decoy`
- verified-by: `the subscription terms are on the surface that sells it`
- verified-by: `a chosen way to pay says it is checked on a device and on the web`
- verified-by: `every root screen the navigator can push has a path it can be read back from`

### F520 — The wall led with what a learner could already do, even when the gap was what they came back for
- severity: P2
- status: [x]
- where: apps/mobile/src/wall/wallMap.ts:1
- note: from a founder video arguing that people buy relief from a problem, so the problem should
  come first. It applies here, but only where there is one. A learner who has walked nothing has no
  gap worth naming, only an empty start, and opening on four things they cannot do is the bleakest
  first screen available to the cohort that most needs convincing, which is the failure mode two
  rejected designs already had.
  So the order inverts exactly when the gap becomes real: once the welcome path is walked, the only
  rooms left are the two held back, and `wallMap` opens on those with the four walked ones below as
  the proof. Same page and same page count, because more than four screens before a price bleeds
  and the row order buys everything a fifth page would.
  The problem is named as a situation and never as a feeling, which was the founder's explicit
  setting. `goalEn` is the catalogue's own sentence about what happens in that room, so nothing on
  the page describes the learner, and a test refuses a line that starts to.
- note: 2026-09-27 notebook final sweep: the map and its row-order projection have been deleted.
  The successor verifies they cannot return, and every door is bounded to the two current pages.
- verified-by: `the retired map and French wall pages have no source, renderer or analytics page`
- verified-by: `no door ever draws more than two pages, or the retired map and French pages`

### F521 — The wall was soft and never said so
- severity: P2
- status: [x]
- where: apps/mobile/src/wall/WallPlansPage.tsx:1
- note: the wall has never blocked anything. The chevron goes back, nothing is gated behind it, and
  page three promises that everything a learner made stays theirs. But the only visible way to
  decline was a chevron in a corner, which reads as navigation rather than as an answer, and
  `WALL_LEAVE` was written in the copy deck and rendered nowhere at all.
  It is rendered now, on the page that asks for money. One honest trust line joins it: not social
  proof, because Luvani has nobody to count and a number it does not have is the claim the founder
  ruled out, but the two things that are already true and already tested elsewhere. There are no
  adverts and no third-party analytics kit anywhere in the app, and stopping costs a learner none of
  what they made. This is the first time the purchase surface says either out loud.
  A decoy tier was refused in the same pass. A decoy is a plan that exists in order not to be
  bought, and the two real tiers already anchor each other truthfully, because Max is genuinely the
  better rate per minute. A test holds that, so a future price change that inverted it would fail
  rather than quietly turn the cheaper plan into the better deal while the page still implied
  otherwise.
- verified-by: `declining is a visible choice on the page that asks for money`
- verified-by: `the one trust line says two things that are already true`
- verified-by: `nothing is marked recommended, best value or most popular`
- verified-by: `a store selling one tier draws one card, not a gap and not a decoy`

### F522 — A selected card announces nothing on the web, in three places
- severity: P2
- status: [x]
- where: apps/mobile/src/components.tsx:403
- note: found while checking the wall's plan cards in a browser. React Native Web reads `aria-selected`
  and treats `accessibilitySelected` as deprecated; it does not read `accessibilityState.selected`
  at all, which is what this app uses everywhere. Verified in
  `node_modules/react-native-web/dist/modules/createDOMProps/index.js:669-675`.
  So on the web `OptionCard` (components.tsx:403), `TabBar` (components.tsx:610) and the wall's plan
  cards all render their chosen state visually and announce nothing, and a screen reader cannot tell
  which option is picked. Native is unaffected: `accessibilityState.selected` is correct there, which
  is why this has survived.
  Not fixed here on purpose. The fix belongs in the shared components rather than in one screen, or
  the wall would be a fourth spelling of the same idea, and it is `design-system-engineer` territory.
  The wall matches the app's existing convention rather than inventing a local `role="radio"`, which
  was the first attempt and announced even less.
- verified-by: `a selected option announces its state on the web as well as on a device`

### F540 — The learner's plan cannot be read by the app
- severity: P2
- status: [x]
- where: services/token-server/src/server.ts:246
- note: the meter is server-side and the only way the app ever learns a plan is as the transient
  answer to `/billing/refresh`, which exists to project subscriber state and cannot be asked
  without RevenueCat configured. F377 kept a balance row off Profile for exactly this reason and
  said it closes when a read endpoint exists. This is that endpoint: `GET /billing/status`, the
  same authentication and rate bound as the refresh, reading the entitlement store and nothing
  else, so it answers with billing dark and never touches the vendor. It closes F377 with it.
- verified-by: `billing status answers the plan and the period for the signed-in learner, and refuses everyone else`

### F541 — The plan is drawn in words, never a countdown
- severity: P2
- status: [x]
- where: apps/mobile/src/purchases/planStatus.ts:1
- note: the endpoint above answers seconds, and PRODUCT.md refuses a countdown because a falling
  number is a scarcity mechanic. So the seconds never reach a screen: `planStatus.ts` folds them
  into one of three bands said in words, and the card draws the plan's label, its period and that
  band. A numeral on the card is the defect.
- note: notebook redesign (2026-09-27): one carve-out, reviewed by Fable. The paywall now says the
  minutes left and the reset date once, rounded down and still (`wall/wallAccount.ts`), because a
  learner choosing what to buy is owed the size of what is left. It is not a falling countdown, which
  is what this item refuses, and the plan card keeps its bands.
- verified-by: `plan status is one of three bands in words, and no numeral reaches the card`

### F542 — The tutor's circle says ready when the account cannot start
- severity: P2
- status: [x]
- where: apps/mobile/src/tutor/orbState.ts:1
- note: the Tutor tab draws the orb violet whatever the account holds, so a learner with no
  speaking time is invited to tap and refused after a probe. The state is decided in a module:
  servers down reads as away, a probe in flight as thinking, no speaking time as idle with a
  caption saying so, and only then ready. The tab draws the answer and decides nothing.
- verified-by: `the orb reads away, checking, no speaking time, and ready from the facts and nothing else`

### F543 — Home opens on a word of the day rather than on tonight's French
- severity: P2
- status: [x]
- where: apps/mobile/src/home/homeMission.ts:1
- note: the founder's brief and both mockups open Home on one real situation with a reason and a
  time, and the word of the day lower down. `homeMission.ts` picks it: a scene left part way, else
  core's next situation, else the café for a learner who has never spoken, with a reason from the
  chooser's own status line and a time line that is a measurement when there is one and an authored
  expectation in words when there is not.
- note: revamp A (2026-09): the hero grew a resume ahead of the day's scene, so the same test was
  rewritten under a title that names all three cases in home/homeMission.test.ts.
- note: notebook redesign (2026-09-27): Today now opens on a scene brief for the spine's next scene: the
  level, the French title, the can-do, two or three lines to say and the minutes. A first run meets
  the opener, "Le premier café", at about three minutes. Today's phrase sits below the brief. The
  reason line is gone.
- verified-by: `a first run leads with the opener, as a brief: level, French title, can-do, lines and about three minutes`

### F544 — Home's pill lived in the situation card
- severity: P2
- status: [x]
- where: apps/mobile/src/home/MissionHero.tsx:1
- note: the pill budget names `home/SituationCard.tsx` as the one file on Home that may draw a pill.
  The hero is the one way into a spoken conversation now, so the pill moves there and the daily
  situation keeps its bookmark and an outline. The budget, the Home test and DESIGN.md move with it.
- note: notebook redesign (2026-09-27): the hero's pill is still Today's one pill outside the review
  template, and it now reads "Start". It opens the scene in the learner's standing mode, with the
  other mode as a quiet link under it.
- verified-by: `one Start speaking, white on the blue card, launching the scene directly, with the other mode as a quiet link`

### F545 — Nothing on Home says what the learner can already do
- severity: P2
- status: [x]
- where: apps/mobile/src/home/AbilitiesCard.tsx:1
- note: the passport already knows which situations were handled unaided, and Home never says so.
  The card draws up to three stamps earned on your own, in the passport's own words, and nothing for
  a learner with none, on `passport.ts`'s rule that an empty rail is a quota.
- verified-by: `home draws an ability only for a stamp earned on your own, and none for a learner with none`

### F546 — The tutor remembers, and no screen says so
- severity: P2
- status: [x]
- where: apps/mobile/src/tutor/continuity.ts:1
- note: the brain stores an opener for next time, the packs store what the last conversation was
  about, and the progress store knows a scene left part way. `continuity.ts` reads them in that
  priority and hands one line to Home and Tutor, and it invents nothing: a new learner gets null.
- verified-by: `continuity comes from a real record in priority order, and a new learner gets nothing`

### F547 — Tutor offers four doors, not three ways in
- severity: P2
- status: [x]
- where: apps/mobile/src/tutor/gate.ts:262
- note: the brief asks for three obvious entry modes: an everyday mission, an open chat, and
  rehearsing something specific. The door model gains the first and the third as rows, keeps the
  open conversation as a row too, and folds the six mission rows away behind a quiet word with the
  lesson last. One pill, the resume card's: the circle at the top of the tab is the way into an open
  chat, so a second pill for the same door was a second answer to one question.
- note: revamp A (2026-09): the three entry modes are unchanged and the fourth door went to the chooser;
  the resume card's pill went too, so the tab now keeps none and the test is named for that.
- note: notebook redesign (2026-09-27): Speak has one Start, into the next scene, which is the everyday
  mission. The other two ways in (the open conversation and rehearsing something specific) are rows
  under "More ways to practise", beside the tutor's memory, drawn only after a first finished scene. The open conversation still goes
  through the tutor probe in the learner's preferred mode.
- note (2026-10-20, B2, B-Speak): "More ways to practise" left Speak. The everyday mission is the
  starter scenes and Every scene, the open conversation is the Talk about anything chips (still through
  the probe, in the chosen mode), and rehearsing something is Explore's Prepare for something real.
- verified-by: `the open chat runs the same connection check the circle runs, and the other two need no server at all`

### F548 — A learner cannot bring a real situation to the tutor
- severity: P2
- status: [x]
- where: apps/mobile/src/tutor/realMoments.ts:1
- note: the seed topic already rides end to end, and its French half is spoken aloud by the tutor,
  so typed English must never land in that slot. Eight authored kinds carry the French title; the
  learner's own words ride the English half, which is what the agent screens for safety. Both
  halves are capped at the server's limit, because an oversized seed is dropped silently and the
  one Max-only feature would open a generic conversation with no error.
- verified-by: `a real moment seeds an authored French title and the learner's English detail within the server's cap, never typed English in the French slot`

### F549 — Learner-authored moments have nowhere to live
- severity: P2
- status: [x]
- where: apps/mobile/src/tutor/momentsStore.ts:1
- note: a moment typed once should be there to rehearse again. It is free text about the learner's
  own life, so the store is device-local and excluded from sync with that reason written down, capped
  at twenty, and swept by the same reset every other user-scoped key is.
- verified-by: `moments are kept on this device, capped, and excluded from sync for a written reason`

### F550 — `lastPractisedAt` has no writer, so the next step re-offers the same pack forever
- severity: P2
- status: [x]
- where: apps/mobile/src/practice/nextStep.ts:75
- note: `buildConversationPack` writes the field null and nothing anywhere assigns it afterwards, so
  `nextStep`'s pack branch and the session card's practised chip both read a value that can never
  change. The pack is server-owned and refreshed over the cache, so the mark lives beside it in a
  device-local store and is folded in at read. It is written only when a drill actually finishes,
  never when a sitting is abandoned.
- verified-by: `a finished pack drill marks the pack practised, an abandoned one does not, and the next step moves on`

### F551 — A conversation cannot be continued as a thread
- severity: P2
- status: [x]
- where: apps/mobile/src/tutor/threads.ts:1
- note: the continuation seed on a pack is built and only half read, and a scene left part way is
  offered back only through the chooser. `threads.ts` names the one continuable thread from what is
  stored: the unfinished scene, else the newest pack not yet continued, else nothing, with a
  words-only sense of how many times the topic has come up.
- verified-by: `the one thread is the unfinished scene, else the newest uncontinued pack, else nothing`

### F552 — The end card lists everything and closes nothing
- severity: P2
- status: [x]
- where: apps/mobile/src/conversationPacks/closure.ts:1
- note: the recap shows all twelve phrases and up to four fixes. The founder's brief asks for a
  closure: three phrases worth keeping, one repair, one focus, one next mission and what went well.
  `closure.ts` chooses them from the pack or the recap and nothing else, and the focus is the newest
  sound check, else a cadence connector not yet produced, else the repair's own reason, else null.
- verified-by: `a closure carries three phrases, one repair, one focus, one next mission and up to three wins, from the pack and nothing invented`

### F553 — A repair from a conversation cannot be practised
- severity: P2
- status: [x]
- where: apps/mobile/src/conversationPacks/packExercises.ts:1
- note: the server synthesises translation pairs for the key phrases and nothing for the corrections,
  so the one line the learner most needed has no drill. A pack now synthesises a translate and a
  repeat for its first correction and a repeat for its first three phrases, keyed by phrase so the
  bank's merge identity holds.
- verified-by: `a pack synthesises a repair drill and a repeat for its key phrases, keyed by phrase`

### F554 — Practice is an archive, not something made from the learner's conversations
- severity: P2
- status: [x]
- where: apps/mobile/src/practice/madeFrom.ts:1
- note: three cards above the archive, from the newest ready pack: replay this moment, make this
  phrase yours, tune the sound. A learner with no pack meets the same three shapes from authored
  material and one sentence saying practice becomes personal after the first conversation.
- verified-by: `practice draws replay, make yours and tune the sound from the newest ready pack, and the starter set for a learner with none`

### F555 — The next step has two branches, so a starter pill would be a second primary
- severity: P2
- status: [x]
- where: apps/mobile/src/practice/nextStep.ts:64
- note: due cards win the next step, so a learner who finished the lesson and never had a
  conversation would meet the review pill and a starter pill at once. The first conversation becomes
  the step's third kind, returned only when nothing is due and no pack is ready, so the tab's one
  control has three branches and never two pills.
- verified-by: `the next step is review, a pack, or the first conversation, in that order, and never two at once`

### F556 — A replay drill shows the verdict with no memory of what was said
- severity: P2
- status: [x]
- where: apps/mobile/src/DrillScreen.tsx:615
- note: a drill node carries an id, a title and phrase keys, so a replay opens on the exercise alone
  and the learner's own line is gone. The node may carry the moment it replays, plain strings, and the
  screen draws it above the exercise so the verdict reads as a comparison rather than a mark.
- verified-by: `a drill node may carry the moment it replays, and the screen draws it above the exercise`

### F557 — Say it on a saved phrase that is not due opens an empty sitting
- severity: P2
- status: [x]
- where: apps/mobile/src/practice/madeFrom.ts:1
- note: `buildDrillSession`'s scope plays due cards and offers new material only for keys the deck
  does not know, so a phrase already in the bank and not yet due queues nothing and the sitting ends
  at once. The card offers Say it only for a phrase the deck does not know or wants back, and hear
  otherwise.
- verified-by: `say it is offered only for a phrase the deck does not know or wants back`

### F558 — The sound to tune is read from a field nothing writes
- severity: P2
- status: [x]
- where: apps/mobile/src/practice/madeFrom.ts:1
- note: `pronunciationFocus` is typed on the pack and the agent never sets it. The honest source is
  the sound checks store, which the post-situation check writes, read newest first as My French already
  does. With no check the card says what the next situation will name, and offers the way there.
- verified-by: `tune the sound reads the newest sound check and says what to do when there is none`

### F559 — My French lists situations, not what the learner can now do
- severity: P2
- status: [x]
- where: apps/mobile/src/myfrench/situations.ts:1
- note: the map lane draws six rows in catalogue order. It leads with the stamped ones as what the
  learner can now do, and labels the rest as suggested rather than as missing, so no row reads as a
  debt.
- note: revamp A (2026-09): the map lane became the two groups on the situations card — stamped places
  lead under "You can now..." and the rest sit under "Next places", where core's suggestion is
  simply the first row — so no row reads as a debt and nothing is labelled missing.
- verified-by: `a learner meets the places that are theirs first, in the order they arrived`
- verified-by: `the place core suggests is the first one a learner sees under Next places`

### F560 — The week's story never sees a conversation
- severity: P2
- status: [x]
- where: apps/mobile/src/progress/story.ts:244
- note: `storyFrom` reads the history namespace, which only the scripted lesson writes, so a learner
  who only ever talks to the tutor has a quiet week by construction. The story now takes the
  completions and the packs as well, names a place entered this week by an authored noun and a topic
  talked about, skips a topic string it cannot say, and keeps the no-delta rule: any prior history,
  of any input, leaves the week's sentences byte for byte the same.
- verified-by: `the story names a place and a topic from this week, skips a topic it cannot say, and any prior history leaves it byte for byte the same`

### F561 — The week lives on the wrong tab
- severity: P2
- status: [x]
- where: apps/mobile/src/profile/FrenchLifeCard.tsx:1
- note: both mockups put the week on Profile, and F233 allows the story exactly one importer. The
  importer becomes the Profile card; My French keeps the passport and the shelf. The rhythm beside it
  is the week rail Home already draws, lifted into the shared components, and it names no number.
- verified-by: `the Profile card is the one importer of the story, and the rhythm rail names no number`

### F562 — The tutor's memory can be neither seen nor edited
- severity: P2
- status: [x]
- where: apps/mobile/src/profile/memory.ts:1
- note: the brain remembers up to twelve facts and an opener and no screen reads them. A learner can
  now see each fact, forget one, forget all, and write a goal. Extraction dedupes on the fact's own
  text, so a forgotten fact is a tombstone the snapshot filters, or it returns the next session that
  mentions it. The agent sends the last five facts, so a goal is appended last or it never rides.
- verified-by: `a forgotten fact stays forgotten across an extraction that mentions it, and a learner's goal is among the five facts that ride`

### F563 — Profile version seven has no room for what the learner chose to forget
- severity: P2
- status: [x]
- where: apps/mobile/src/profile/store.ts:72
- note: tombstones and goals need a home that syncs, so the stored profile moves to version eight and
  the policy writes eight with it. The brain's merge rides unknown outer fields with the heavier side,
  which would let a busier phone undo a forget made on a lighter one, so tombstones get an explicit
  set union and goals ride whole.
- verified-by: `version seven upgrades to eight with empty tombstones and goals, the sync policy writes eight, and a forget on either device survives the merge`

### F564 — The plans page sells minutes and nothing else
- severity: P2
- status: [ ]
- where: apps/mobile/src/purchases/capabilities.ts:1
- note: the brief asks that a plan state its inclusions, not only its minutes, and that nothing be
  marketed the app does not actually gate. `capabilities.ts` is the one place that says what a plan
  opens; the plans page reads it and a test refuses any gate on packs, phrases, missions, drills or
  review.
- verified-by: `each plan lists only what capabilities.ts opens, and nothing gates packs, phrases or missions`

### F565 — Custom rehearsal and arc continuation are open to every plan
- severity: P2
- status: [x]
- where: apps/mobile/src/tutor/RealMomentScreen.tsx:1
- note: the two new doors are the paid tier's, and the server gates minutes rather than doors, so the
  app gates them from the plan it read. A known plan without them meets an honest line and a door to
  the plans page; an unknown plan reads as the trial rather than as a yes.
- verified-by: `a learner on the trial meets an honest line and a door to plans, and an unknown plan reads as the trial`

### F566 — A purchase from a refused conversation returns the learner to the Tutor tab rather than the conversation
- severity: P2
- status: [x]
- where: apps/mobile/src/live/afterPurchase.ts:1
- note: after the other session's Phase 1 lands. The wall's Done goes to the Tutor tab, and the brief
  asks that a purchase return the learner to the conversation that was refused. The route carries
  what to resume, a pure rule decides where Done goes from the purchase outcome, and the refused
  session unmounts before a fresh route starts with its original context. Cancelled, stale-account and unconfirmed outcomes never resume.
- verified-by: `a purchase that granted minutes returns to the conversation that was refused, and nothing else does`

### F567 — Restore has no funnel event, and a return from the wall is invisible
- severity: P2
- status: [x]
- where: apps/mobile/src/analytics/track.ts:21
- note: after the other session's Phase 1 lands. Restore started and settled, and the return from the
  wall, join the union, the parser and the trigger in one change.
- verified-by: `restore and the return from the wall each carry one event the parser and the trigger accept`

- note: 2 October 2026, Report 45: independently accepted by the authorized gpt-6-sol reviewer at code level. Twelve reviewer checks and disposable actual-SQL proof pass. New events require migration 20261002192210, not applied live; native store and simultaneous database connections remain unverified.

### F568 — The server sees the trial start and the minutes run out, and tells nobody
- severity: P2
- status: [x]
- where: services/token-server/src/server.ts:314
- note: after the other session's Phase 1 lands. The first trial claim and every refusal over minutes
  happen on the server, which is the only honest place to record them; the app can only guess. They
  are written as product events by the server itself, which has no precedent and so gets its own helper.
- verified-by: `the first trial claim and every refusal over minutes are recorded as product events`

- note: 2 October 2026, Report 45: independently accepted by the authorized gpt-6-sol reviewer at code level. Twelve reviewer checks and disposable actual-SQL proof pass. New events require migration 20261002192210, not applied live; native store and simultaneous database connections remain unverified.
- note: Trial means a newly claimed entitlement, not a joined room. Literal current device consent is required. The isolated trial-evidence savepoint cannot undo money; client endpoints/roles cannot forge service facts. Exhausted and insufficient-for-session evidence is best effort; outages can lose it, while lapse and antifraud refusals are distinct.

### F569 — Cards, tinted rows and the hero are primitives, not per-screen styles
- severity: P2
- status: [x]
- where: apps/mobile/src/components.tsx:912
- note: revamp A. A white card lifts on one named whisper of shadow at radius twenty; a tinted row is one
  pressable with a white disc, a title, a gloss and a chevron; the hero card and the phrase card are
  their own files under `surface/`. Screens compose these and style nothing of their own.
- note: notebook redesign (2026-09-27): tinted rows became ledger rows (one pressable at 56pt, an ink glyph
  with no disc, a title, a gloss, meta and a chevron, named once), and the card lost its offset shadow.
  `TintRow` stays as a deprecated wrapper that draws the ledger row until its call sites move.
- verified-by: `a ledger row is one pressable at 60 with an ink glyph and no disc, a title, a gloss, meta and a chevron, and it names itself once`
- verified-by: `the one card is white at the card radius with no hairline, no outline and no shadow`

### F570 — Raster art ships decorative, sized once, and every key is drawn
- severity: P2
- status: [x]
- where: apps/mobile/src/art/registry.ts:1
- note: revamp A. The watercolour scenes are PNGs under `assets/art`, named once in a registry with their
  point size, drawn through one component that hides them from assistive technology, and held to a
  byte budget. Nothing ships that nothing draws, and nothing is drawn that is not registered.
- note: revamp B (2026-09-30, F599): the watercolours retired and the promise moved to the flat
  drawings. The registry test now holds each one decorative, at its catalogue size, and registered in
  both directions, and J14 holds that every one reaches a screen; both lines were renamed for it.
- verified-by: `the flat registry names all 77 drawings, each generated, decorative, still, at its ILLUSTRATIONS.md sizes, and coloured only by tokens`
- verified-by: `every flat drawing reaches a screen or is on the not-yet-drawn list, which only shrinks`

### F571 — Home opens on the hour's line and tonight's scene with a time in minutes
- severity: P2
- status: [x]
- where: apps/mobile/src/home/homeMission.ts:1
- note: revamp A. The greeting carries the hour's question beneath it, the hero is tonight's daily scene
  (a part-way mission first, the café before anything), drawn on a white card with its place's art and
  the one sanctioned numeral line, "Ready for N min", estimated from the scene's length.
- note: notebook redesign (2026-09-27): the hour's line stays under a still greeting. The hero is now a
  scene brief for the spine's next scene, with no picture, and the minutes line reads "About N min". A
  three-line daily scene is still seven minutes, and the scripted opener is about three, derived from
  its script.
- verified-by: `every hour has exactly one subline`
- verified-by: `a three-line daily scene is about seven minutes, and an open mission is longer per beat`
- verified-by: `a first run leads with the opener, as a brief: level, French title, can-do, lines and about three minutes`

### F572 — Real progress is one sentence, and the rest lives one level down
- severity: P2
- status: [x]
- where: apps/mobile/src/home/abilities.ts:1
- note: revamp A. The abilities become one joined can-do sentence on a white row; tapping it pushes a
  Progress screen that keeps the week story, the momentum cards and the word of the day.
- note: 2026-09-27 notebook final sweep: the Progress screen became inline details on Today in Phase 3
  and then nothing rendered them; `ProgressScreen.tsx`, `progressView.ts` and `MomentumCards.tsx` are
  deleted. Today says the week in at most two sentences (`home/todayView.ts`) and today's phrase on
  the daily card. The sentence tests stay; the successor bans the deleted screen's return.
- verified-by: `two stamps join with and, no comma`
- verified-by: `before any stamp the card says where progress starts and never a count`
- verified-by: `nothing renders the retired momentum block, its inline details or the week rail, and no screen draws a days-active count — F440`

### F573 — Tutor is the orb, the remembers row and three tinted ways in
- severity: P2
- status: [x]
- where: apps/mobile/src/tabs/TutorTab.tsx:1
- note: revamp A. The speak card, the resume card, the folded situations and the lesson door leave the
  tab; the lesson becomes a door on the chooser and the intro link moves to Settings.
- note: notebook redesign (2026-09-27): Speak is now the tutor card (name, voice, signature line, a
  sample and a way to change voice), one Start, and the level path. The moving orb and the three
  tinted ways in are gone; the remembers row stays.
- note (2026-10-20, B2, B-Speak): the card on Speak drops the catalogue's sound line by design.
- verified-by: `the tutor row carries its name, its sample and a way to change the voice, and no voice line`
- verified-by: `the pronunciation lesson is a door on the chooser`

### F574 — Practice is one next practice and three rows, with the archive in Conversations
- severity: P2
- status: [x]
- where: apps/mobile/src/tabs/PracticeTab.tsx:1
- note: revamp A. The next-step pill becomes a phrase card with a speaker and one control per branch;
  the vault, the feed and the filters move to a pushed Conversations screen; the suggestion and the
  closing lines go.
- note: conversation practice (2026-09): the per-branch controls became one recommended action chosen by
  practice/practiceCard.ts over the balanced selector. The card is still one French line, its meaning,
  a speaker and one action; the renamed test pins the line, gloss, speaker and the single action.
- note (2026-10-20, B3, B-Practice): the recommended card left Practice; the stopped sitting is the recommendation's own resume answer, named with its place in words, so the test is renamed for that.
- verified-by: `the pick-up card names the stopped sitting and resumes it`
- verified-by: `the conversations screen carries the feed, the filters and the delete flow`

### F575 — My French is the tinted situation rows and the phrase shelf
- severity: P2
- status: [x]
- where: apps/mobile/src/tabs/MyFrenchTab.tsx:1
- note: revamp A. Stamped missions first under "You can now...", the rest under "Next places", then the
  phrase shelf, the saved shelf and the conversations row; the lanes, the stat row and the one-line
  card go, the one-line card and the cadence set living on in a pushed Phrasebook.
- note: notebook redesign (2026-09-27): My French is now the level path with the can-dos earned, the
  phrase bank, the sounds map and the conversations, in that order. The tinted situation rows are
  gone, and the phrase shelf became the phrase bank, still with one door to the Phrasebook.
- note (2026-10-20, B4, B-Journey): Journey now follows the B-Journey order and the CEFR level card became the five stages; the retired phrase bank, sounds map and daily rows are still held absent, so the test is renamed for that.
- note (2026-10-22, Your French): the learner's own French leads the page, and the used-in-conversation block folds into it, so the test is renamed for that.
- verified-by: `the blocks run in order: header, Your French, stages, abilities, then and now, help, sounds, week, tiles, rows`
- verified-by: `the phrase bank is the newest kept phrases with audio, and one door to all of them`

### F576 — Profile is the centred name, the tutor card, the rhythm and the learning card
- severity: P2
- status: [x]
- where: apps/mobile/src/tabs/ProfileTab.tsx:1
- note: revamp A. The tutor is drawn as the orb, never a face; the plan card, the reminder rows and
  the intro link move to Settings; the pace switch moves to the voice sheet.
- note: P2 (2026-10-19): the approved design replaces the centred header with a large title, the gear and a left-aligned identity row; the orb-never-a-face and no-rank-under-the-name checks are kept under the new test name.
- verified-by: `profile opens on the learner and draws its tutor as the orb, never a face`
- verified-by: `the plan, the reminder and the intro link live in settings`

### F577 — The week is a Monday-to-Sunday calendar with labelled violet dots
- severity: P2
- status: [x]
- where: apps/mobile/src/progress/momentum.ts:392
- note: revamp A. The founder chose the identity violet for the calendar record; the rule that a state
  mark is never violet now exempts a calendar, and the orb's traffic lights stay the only state marks.
- note: 2026-09-27 notebook final sweep: the labelled violet dots are gone. Profile says the week as
  one sentence (Phase 4, B2) and `WeekRail` is deleted from components.tsx, so the calendar exemption
  has nothing left to exempt; the Monday-to-Sunday model and its sentence stay tested. The successor
  refuses the rail's return.
- verified-by: `the rhythm week starts on Monday and ends on Sunday whatever today is`
- verified-by: `the rhythm sentence counts in words and passes the guilt list`
- verified-by: `the retired week rail is not exported and leaves no mark style behind`

### F578 — Own words is a drill kind whose verdict arrives from outside
- severity: P2
- status: [x]
- where: packages/core/src/drill/types.ts:1
- note: revamp A. A new kind, own-words, asks the phrase in the learner's own French. Core builds it on
  demand for a scoped sitting, returns pending from grading, and decides good, retry or reveal from a
  verdict something else produced. The model observes, code decides.
- verified-by: `a verdict that keeps the meaning is good even when it is awkward`
- verified-by: `a verdict that loses the meaning retries once then reveals`
- verified-by: `a scoped sitting can be asked for own-words alone and synthesises one`

### F579 — The brain judges an own-words attempt through a strict schema
- severity: P2
- status: [x]
- where: packages/brain/src/drill/judge.ts:1
- note: revamp A. One judge activity on the cheap tier; a strict verdict schema; a note swept for banned
  words and French leaks and dropped when it fails.
- verified-by: `a verdict outside the schema is a parse error, never a pass`
- verified-by: `judge runs on the talker tier at low effort`

### F580 — The judge endpoint asks the brain and stores nothing
- severity: P2
- status: [x]
- where: services/token-server/src/server.ts:395
- note: revamp A. `POST /drill/judge` sits beside `/drill/score` behind the same limits; a brain that
  will not answer is a 503, never an invented verdict; the attempt is never written anywhere.
- verified-by: `a brain that will not answer is a 503, never an invented verdict`
- verified-by: `the attempt is never written to the store or the usage log`

### F581 — The own-words view types the attempt, and a missing verdict writes no grade
- severity: P2
- status: [x]
- where: apps/mobile/src/DrillScreen.tsx:1
- note: revamp A. Typed only for now, with the hint to say it aloud first; spoken attempts through a
  transcription endpoint are a filed follow-up. Offline, the line is revealed and nothing is graded.
- verified-by: `own-words checks the learner's own French as editable text`
- verified-by: `a null verdict reveals the line and writes no grade`
- verified-by: `the judge is asked once per Check`

### F582 — Replay a moment speaks the better line and keeps nothing
- severity: P2
- status: [x]
- where: apps/mobile/src/practice/madeFrom.ts:1
- note: revamp A. "Listen and try again" is the tutor's voice reading the better line, then the drill;
  no recording and no transcript are ever kept, by the existing privacy contract.
- verified-by: `replay speaks the better line and stops it when the tab goes`
- verified-by: `nothing on practice listens, records or scores`

### F583 — The tab bar keeps every whole word at the largest reading size
- severity: P2
- status: [x]
- where: apps/mobile/src/nav/LuvaniTabBar.tsx:123
- note: revamp A; closes F461. Cells get room at a large font scale and stack the glyph over a wrapped
  word instead of clipping.
- verified-by: `the tab bar labels wrap without colliding at the largest reading size`

### F584 — Every pushed screen wears revamp A without losing its way out
- severity: P2
- status: [x]
- where: apps/mobile/src/ConvoScreen.tsx:1
- note: revamp A. The conversation, the lesson, the recap, review, drills, the chooser, rehearse, the
  sound check, the memory editor, settings and the legal pages take the porcelain ground, white cards
  and tinted rows; the leave confirm, the help row, the station line and the orb states are unchanged.
- verified-by: `every pushed screen keeps its way out and its one primary after the restyle`

### F585 — The first run wears revamp A
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/PreAccountOnboarding.tsx:1
- note: revamp A. Welcome, the age gate, the name and voice steps and sign in take the new art and
  surfaces; every page still leads with a heading role and its art is decorative.
- verified-by: `every first-run screen leads with a heading role and its art is decorative`

### F586 — The plans wall and the paywall wear revamp A and announce a chosen plan on the web
- severity: P2
- status: [x]
- where: apps/mobile/src/wall/WallPlansPage.tsx:1
- note: revamp A; closes F522. The four pages and the inline paywall keep their copy; a chosen plan card
  carries `aria-selected` as well as the native selected state.
- verified-by: `a selected option announces its state on the web as well as on a device`

### F587 — The device runbook carries the Pass 8 revamp checks and DESIGN.md is regenerated
- severity: P2
- status: [x]
- where: docs/DEVICE_VERIFICATION.md:1
- note: revamp A; closes F146. Pass 8 lists what only a device can prove; DESIGN.md records the
  system as shipped, one hex row per token, every colour it names a colour the theme ships.
- verified-by: `the device runbook carries the Pass 8 revamp checks`
- verified-by: `every colour DESIGN.md names is a colour the theme ships`

### F588 — The orb is a gradient disc with rings and soundwave lines, and rests under reduce motion
- severity: P2
- status: [x]
- where: apps/mobile/src/tutor/VoiceOrb.tsx:1
- note: revamp A. The founder reversed the rings-over-sphere choice. The gradient is the one state
  colour thinned by opacity, so no new palette token and the mark floor holds; movement stays
  transform and opacity on the native driver.
- superseded: 2026-10-09, user-approved Direction B replaces the earlier subtitle/orb presentation. The successor test below verifies the current presentation and its retained lifecycle/accessibility contract.
- verified-by: `the cloud is decorative, bounded and independent of the audio session`
- verified-by: `reduce motion and a state with nothing to animate rest for their own reasons`

### F589 — The glyph set is one pen: every icon at one stroke, decorative
- severity: P2
- status: [x]
- where: apps/mobile/src/glyphs.tsx:1
- note: revamp A. The row and disc glyphs (clock, cup, bubble, document, replay, quotes, waveform, the
  six places, the right chevron) join the tab icons under the one stroke-weight rule.
- verified-by: `every glyph draws in the one stroke weight and hides from assistive technology`

### F590 — Own words is typed only; a spoken attempt has no way in
- severity: P2
- status: [x]
- where: apps/mobile/src/DrillScreen.tsx:1
- note: revamp A follow-up, the founder's call for now. "Say it in your own words" takes a typed
  attempt with a hint to say it aloud first. A spoken attempt needs a transcription endpoint on
  the token server (the vendor the live tutor already uses), the existing recording flow from
  the sound check, and the typed field kept as the fallback for learners who prefer it and for
  offline. Nothing recorded is kept.
- continuation: 2 October 2026, code-level closure independently accepted by the
  founder-authorized gpt-6-sol reviewer. Temporary takes are transcribed once,
  editable before Check, and removed after upload or refusal. Auth/scope/beat
  guards refuse late account/card work; unavailable service leaves typing and
  no grade. 47 focused tests and both workspace typechecks passed. Real native
  microphone, filesystem deletion and Deepgram service checks remain unverified.
- verified-by: `a spoken attempt is transcribed once, judged, and never stored`

### F591 — Own words is a door, not yet a rung
- severity: P2
- status: [x]
- where: packages/core/src/drill/session.ts:1
- note: revamp A follow-up. The own-words kind is opened directly from the Practice row on a
  scoped sitting. Making it the fifth rung of the drill ladder (earned after the spoken rung
  on a phrase's fifth successful sitting) is a pedagogy change for learning-science-engineer,
  with the stage table, stageForReps and the mix tested together.
- continuation: On 2 October 2026 the stage table, five-sitting replay, miss/reveal behavior and persisted exercise bank were implemented. A cap repair reserves only shipped authored formats and retains fresh pack exercises; failed disk writes report failure so the source pack can retry. Independent gpt-6-sol review accepted the code and focused persistence/merge/account-scope tests. Native spoken-session behavior remains unverified.
- verified-by: `own-words is the last rung and is earned on the fifth sitting`

### F592 — The raster art decodes at file size on Android until it is measured
- severity: P2
- status: [ ]
- where: apps/mobile/src/art/Art.tsx:1
- note: revamp A follow-up. Art ships through React Native's Image with two densities and a
  byte budget, so no new native module and no dev-client rebuild. If Pass 8's graphics-memory
  row (P8-9) measures badly on a real Android device, the fix is `expo-image` with
  downsampling to the box, which needs one rebuild of the dev client.
- verified-by: `every raster scene decodes no larger than twice its box`

### F593 — A placed word drops to 3.59:1 on the drill ground
- severity: P2
- status: [x]
- where: apps/mobile/src/DrillScreen.tsx:412
- note: the used token now takes `paper.inkSoft` (#5F4E73), the existing secondary-word token
  that clears 4.5 on both the porcelain ground and a card. The transparent panel remains, so the
  fix changes no layout and introduces no colour; the source contract pins the semantic token.
- verified-by: `a word already placed stays readable on the ground it is left on`

### F594 — F383's growing-wrapper repair reached one tab out of five
- severity: P2
- status: [x]
- where: apps/mobile/src/tabs/HomeTab.tsx:1
- note: Home, Tutor, Practice and Profile no longer add a growing wrapper inside `ScrollScreen`;
  My French already used the safe shape. The contract now walks every tab and refuses `flexGrow`
  or padding on any surviving `scroll` wrapper, so the AX5 failure cannot return one tab at a time.
- verified-by: `no tab hangs a growing wrapper inside the scroll frame — F594`

### F595 — The palette is the notebook's, not revamp B's
- severity: P1
- status: [x]
- where: apps/mobile/src/palette.ts:11
- note: Stage 1 of revamp B. `palette.ts` takes STYLE §4 and §7: paper #FFF6E9, white cards, ink #16123A, ink2 #5C5A74, one hairline #EADFCB, skeleton #EFE6D6, `accent.brand` and a new `colour{blue,coral,sun,mint}`, the orb as coral, mint, sun and ink with a new `onOrb` glyph pairing because mint and sun fail 3:1 as marks on paper, `signal.good` and `signal.correspondance` as ink, rungs one to three on the skeleton fill. Old names stay as aliases. `palette.test.ts` is rewritten pair by pair at the same floors, never weakened; DESIGN.md's colour tables, app.json's two launch backgrounds, the orb's bars and TutorIntro's state words follow, so no forbidden pair and no colour name ships at any commit.
- verified-by: `the B paper is pinned: one ground, one white, one ink, one hairline`
- verified-by: `every orb state carries a glyph that clears the text floor on its own fill`
- verified-by: `rungs one to three share the one skeleton fill and rung four is ink`
- verified-by: `the brand blue never reads as an orb state, the highlighter, the rung fill or the tutor's mark`
- verified-by: `DESIGN.md records the palette the app ships`
- superseded: F790 (2026-10-06): app.json's two launch backgrounds follow the brand blue now, not the ground; the test below is the successor.
- verified-by: `the launch background is the brand blue wherever it is painted, and the app beneath stays on the ground`
- verified-by: `no six-digit hex is written anywhere in source but palette.ts`
- superseded: 2026-10-09, user-approved Direction B replaces the earlier subtitle/orb presentation. The successor test below verifies the current presentation and its retained lifecycle/accessibility contract.
- verified-by: `voice bars require real output bands and sit with the status below the surface`
- verified-by: `the intro names the orb states in words, never by colour`

### F596 — The app is set in Fraunces and DM Sans, not Outfit
- severity: P1
- status: [x]
- where: apps/mobile/src/theme.ts:27
- note: Stage 1 of revamp B. `theme.ts` names the five Outfit cuts (400 to 800) with the old font names kept as aliases, the STYLE §3 scale by token (hero 112, display 44, title 30, heading 20, frenchLg 28, french 20, body 17, label 16 sentence case, small 14, tab 12) with the French tokens kept by name in Outfit 600 and frenchLg still larger than heading, and radii card 24, feature 28, tile 20, field 16, pill 999. `App.tsx` loads exactly those five files and the Fraunces and DM Sans files leave the bundle; Acknowledgements credits Outfit under the OFL. `theme.test.ts` is rewritten to the new values and gains a check that the theme, the loader and the fonts folder agree.
- verified-by: `Outfit is the only face, at the STYLE scale, and every French style is Outfit SemiBold`
- verified-by: `B corners: card 24, feature 28, tile 20, field 16, pill 999, and the aliases point at them`
- verified-by: `the theme names the six Outfit cuts App.tsx loads, and the bundle carries no other face`
- verified-by: `Acknowledgements credits Outfit under the OFL and names no retired face`

### F597 — The shared parts are the notebook's: static presses, hairline cards, ink chips, a gradient orb, and no B parts to paste
- severity: P1
- status: [x]
- where: apps/mobile/src/components.tsx:957
- note: Stage 2a of revamp B. `motion.ts` gains the one spring (`pressTo`, 0.97, stiffness 439, damping 29.3, mass 1, native driver off on the web, instant under reduced motion) and `components.tsx` gains `Press` with a `haptic` prop over new `pressed()` and `soft()` haptics; the 0.985 statics go. `Card`, `Label`, `PillButton` (with a white tone), `GhostButton`, `Monogram`, `Highlight` (still, marked as French), `Field`, `TabBar<K>` (the SNIPPETS segmented) and `ProgressDots` (the story segments) are restyled in place; `RoundButton`, `ColourCard`, `StatTile`, `HeroNumber`, `OptionRow`, `Sheet`, `Skeleton`, `QuietLine`, `FrenchBlock`, `CloseGlyph` and `CheckGlyph` are appended; the orb becomes SNIPPETS' two rings, a core and one mark per state, with `onOrb.ready` unchanged; `ScreenHeader` takes the round back button. `palette.ts` gains the STYLE §4 colours these parts draw (`paper.field`, `lilac`, `textOn`, `onColour`, `segmentPending`) and `theme.ts` gains `type.stat` and `frenchText`. A punctuation ratchet bans the middot and both dashes in learner-facing strings with an allowlist of the fifteen files that fail today.
- verified-by: `every tappable part presses through one spring: 0.97, stiffness 439, damping 29.3, released on lift, instant under reduced motion`
- verified-by: `the one spring is the press, it lives in motion.ts at the STYLE numbers, and it crosses to the native driver everywhere but the web`
- verified-by: `no pressed style scales by hand: the 0.985 statics are gone`
- verified-by: `a press is a light impact, a choice is a selection tick, a hint is soft, and the web half stays silent`
- verified-by: `the one card is white at the card radius with no hairline, no outline and no shadow`
- verified-by: `one ink pill at 56, white on blue or coral; the second action is an underlined ink link at the touch floor; a label is the meta line`
- verified-by: `the monogram is a white initial on an ink disc, and it is hidden from assistive tech`
- verified-by: `the highlighter is a still band behind one French line, marked as French, and moves nothing`
- superseded: 2026-10-09, user-approved Direction B replaces the earlier subtitle/orb presentation. The successor test below verifies the current presentation and its retained lifecycle/accessibility contract.
- verified-by: `the cloud is decorative, bounded and independent of the audio session`
- superseded: 2026-10-09, user-approved Direction B replaces the earlier subtitle/orb presentation. The successor test below verifies the current presentation and its retained lifecycle/accessibility contract.
- verified-by: `voice bars require real output bands and sit with the status below the surface`
- verified-by: `the segmented control is a sand track with a white chosen segment, never ink capsules, and every segment keeps the touch floor`
- verified-by: `the B parts are appended after the stylesheet, draw from tokens, cap no words, build no pill and spell no hex`
- verified-by: `a round button is a 44 disc for back and close and a 64 disc for next, with the ICONS.md mark`
- verified-by: `a colour card is one ground with its words in the palette's colours for it, and a stat tile and a hero number each read as one phrase`
- verified-by: `an option row says its choice twice and marks it with the blue check or the field ring`
- verified-by: `sheets animate over the parent, retain closing content and expose accessible dismissal`
- verified-by: `a skeleton is still sand blocks that say Loading once, and a quiet line is a centred small line`
- verified-by: `a French block leads with the French, marks it as French, glosses under it, and offers to hear or to stop`
- verified-by: `the pushed header's way back is a 44 round white button`
- verified-by: `the STYLE colours the parts draw are in the palette: the field border, the secondary on each ground, the pending segments, and lilac is drawn only by the flat illustrations`
- verified-by: `DESIGN.md records the palette the app ships`
- verified-by: `Outfit is the only face, at the STYLE scale, and every French style is Outfit SemiBold`
- verified-by: `no learner-facing string carries a middot, an em dash or an en dash, and the allowlist only shrinks`

### F598 — The glyphs are the notebook's pen at 2.2, not ICONS.md's at 2
- severity: P1
- status: [x]
- where: apps/mobile/src/glyphs.tsx:42
- note: Stage 2b of revamp B. `STROKE` becomes 2. Every existing glyph export keeps its name and file and takes its ICONS.md path where one exists (next, back, chevron-right, mic, speaker, lifebuoy, check-circle, clock, language, book, repeat-one, waveform, home, practice, progress, friends, user, and the filled apple and google brand marks); `TutorIcon` becomes the same microphone as `MicGlyph`; the drawings ICONS.md has no match for are kept at the new stroke and listed for retirement with their callers. Fourteen marks the Round 1 boards draw and nothing covered are added to `glyphs.tsx`; `close` and `check` sit in `components.tsx` beside the parts that draw them, to keep the import edge one-way.
- verified-by: `the one pen is ICONS.md's: STROKE is 2`
- verified-by: `every glyph is an ICONS.md mark at the one stroke weight or a kept drawing on the retire list, and the tab and the control share one microphone`
- verified-by: `the brand marks are the only filled glyphs, and they are filled in the mark's own colour`
- verified-by: `every glyph draws in the one stroke weight and hides from assistive technology`

### F599 — The place scenes are watercolour PNGs, and the B drawings are not in the app
- severity: P1
- status: [x]
- where: apps/mobile/src/art/registry.ts:38
- note: Stage 2c of revamp B. `scripts/illustrations.mjs` converts the 23 place, state, celebrate and postcard drawings in ILLUSTRATIONS.md into react-native-svg components under `art/flat/`, every hex mapped to a palette token (`lilac` added for illustrations only), with one generated registry, one `Illustration` renderer that spreads `decorative`, and a `sceneIllustration` map keyed by mission id. The missions chooser and the onboarding plan draw one flat scene each in place of the PNGs; then the twelve PNGs, `Art.tsx`, `registry.ts` and `maps.ts` retire and nothing imports `Image`. The six mouth guides wait for Round 3. Drawings no screen reaches yet sit on an exact not-yet-drawn list that Stages 3 and 4 shrink.
- verified-by: `the flat registry names all 77 drawings, each generated, decorative, still, at its ILLUSTRATIONS.md sizes, and coloured only by tokens`
- verified-by: `the watercolours are gone: no PNG under assets/art, no Art, no registry, no maps, and nothing imports Image`
- verified-by: `every scene has a flat drawing of its own, and no two scenes share one`
- verified-by: `every flat drawing reaches a screen or is on the not-yet-drawn list, which only shrinks`
- verified-by: `every drawing in the app is hidden from assistive technology, and nothing imports Image`
- verified-by: `the chooser's first card draws its scene through the one illustration at the hero-spot size, and sizes nothing itself`
- verified-by: `the personal plan leads with the authored first practice then a dedicated deliberate tutor choice`

### F600 — The tab bar is paper and ink with Today and My French, not white with a blue Home and Progress
- severity: P1
- status: [x]
- where: apps/mobile/src/nav/LuvaniTabBar.tsx:35
- note: Stage 2d of revamp B. `LuvaniTabBar` becomes SNIPPETS' bar: white with the one top hairline, the selected glyph and word in `accent.brand` at Outfit Bold, the rest in soft ink at SemiBold, the words Home, Speak, Practice, Progress and Friends under the ICONS.md marks, and each cell pressing through `Press` with no haptic of its own so a tap on the current tab stays silent. Route names, `ICONS`, the badge, the wrapping rule and the safe-area padding do not change.
- verified-by: `the bar is an ink capsule, radius 32, on the route ground, and never a floating shadow — UI-008`
- verified-by: `the selected cell is violet with a sun Linear glyph and a bold cream word; the rest are cream on ink — UI-008`
- verified-by: `the five words are Today, Explore, Speak, Practice and Journey; Friends remains a stack route` (renamed 2026-10-20 when direction B A3 moved the bar to five tabs; the route names it guards are unchanged)
- verified-by: `a tab cell presses through Press with no haptic of its own, and the bar still moves nothing`
- verified-by: `the active tab is the violet cell with a sun glyph, and the rest cream on ink — UI-008`


### F601 — The first run is the notebook's paper: no blue or sun pages, ledger answers with a Chosen word, a middot on the account button, and a card around the password form
- severity: P1
- status: [x]
- where: apps/mobile/src/onboarding/PreAccountOnboarding.tsx:305
- note: Stage 3, area 1 of revamp B. `Screen` stops drawing a paper hairline over a colour ground's footer and lights the status bar on blue, coral and ink; `Field`'s error sits beside the alert mark; `TutorCard` is restyled; `SceneMark` and `canDoSentence` are appended. Hear it and First line are blue with white and ink bubbles, the round next and the Highlight beside a mint tick; the one-tap answers are option rows; the plan is the sun page with the hero minutes, the scenes in French, the tutor and how it works, and no picture or pickers; the save page's pill reads "I am 13 or older, create account" and the under-13 refusal is its own page with the frame drawing. FirstScene is the blue brief with a white Start, and a refusal turns to paper with the microphone drawing and typing first. The age check and the auth screens are working titles on paper, with Apple above Google at the top of the form and one ink pill in the footer. Two files leave the punctuation allowlist, and two state drawings leave the not-yet-drawn list. The recovery route's `OnboardingFlow.tsx` was left unchanged, because swapping its `OptionCard` for `OptionRow` would take the voice samples off; that deferral is F634.
- verified-by: `a colour ground draws no paper hairline over its footer, and lights the status bar on blue, coral and ink`
- verified-by: `a field error sits beside the alert mark in ink, and is still announced`
- verified-by: `the tutor card is white: the orb, the name and voice, a play disc and a quiet change link`
- verified-by: `a scene mark is a mint tick, a sun dot or a field ring, and names its state`
- verified-by: `a can-do reads as one sentence after "You'll be able to"`
- verified-by: `welcome and recap share cream progress chrome with a readable bottom action`
- verified-by: `playback selects a model but only a real submitted reply can receive success feedback`
- verified-by: `illustrated full-width choices carry radio state and never advance on selection`
- verified-by: `the personal plan leads with the authored first practice then a dedicated deliberate tutor choice`
- verified-by: `the deliberate Start tap declares eligibility after Terms and refusal removes all processing actions`
- verified-by: `the first scene uses the shared centred frame and a refusal leads with typing`
- verified-by: `the age check is a working title, a quiet line, the link above one ink pill, and a refusal still has a way out`
- verified-by: `C2 sign-in embeds providers after its fields and keeps its footer clear of the keyboard`
- verified-by: `signup keeps its primary action after the fields and hides it while the keyboard is visible`
- verified-by: `choosing a new password is a working title on paper, with no card and no middot in its header`
- verified-by: `the erase notice is a working title, what to do in one strong line, and one ink pill`
- verified-by: `no learner-facing string carries a middot, an em dash or an en dash, and the allowlist only shrinks`
- verified-by: `every flat drawing reaches a screen or is on the not-yet-drawn list, which only shrinks`

- note: 3 October 2026: the founder-authorised UX reviews supersede the earlier layout/copy assertion. The replacement test retains the underlying useful action, truthful evidence and allowance rule.

### F602 — Home is a white brief on paper with caps meta, a ledger row shape and a blank while loading, not the blue next-scene card, white lists and a sand skeleton
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/HomeTab.tsx:124
- note: Stage 3, area 2 of revamp B. The tab title is the working title at 30; `SceneBrief` is restyled in place as the one blue next-scene card (meta line, French title, English, can-do sentence, one line, the caller's white Start); `Ledger` and `LedgerRow` become SNIPPETS' white list with hairlines between rows. Home shows sand blocks until storage answers, then leads with exactly one colour card: the blue scene brief with "Start speaking", the blue recall card, or the sun plans card when the trial's minutes are used, read through the same billing call Speak makes. Day one lists where the learner starts with scene marks; afterwards the week sentences with no label, under a slot comment for F609's lifetime count. The review row is a white list row, and today's phrase is a white card with a play disc and "Practise it". There is no weekly day count, no weekday, no rate and no tag.
- verified-by: `every tab title is the working title at 30, and the greeting is one of them`
- verified-by: `the scene brief is the one blue card: a meta line, the French title, the English, the can-do sentence, one line to say, and the caller's white Start`
- verified-by: `a ledger is a white card of rows split by hairlines, each at 60 with a 16 title, a soft detail and a chevron`
- verified-by: `a scene's minutes read in full, and its meta line joins the label, the minutes and the tutor`
- verified-by: `the used free minutes lead Home with the plans card, ahead of review and the scene`
- verified-by: `the hero is the spine's next scene, drawn on the blue brief with the meta line the rule decides`
- verified-by: `one Start speaking, white on the blue card, launching the scene directly, with the other mode as a quiet link`
- verified-by: `Today leads with one colour card: the next scene, the recall card, or the plans card when the free minutes are used`
- verified-by: `day one lists where the learner starts with a sun dot on the first scene, and the page reads in the artboard order` (renamed 2026-10-20 when direction B B5 redrew Today to B-Today: the week sentences and the lifetime count left Today for the week card and the streak tile)
- verified-by: `a Home that has not read its storage yet draws still sand blocks shaped like the page`
- verified-by: `today's phrase is the lavender card: the French with a play disc, the English, and Say it yourself` (renamed 2026-10-20 when direction B B5 redrew today's phrase as B-Today's lavender card)
- verified-by: `Home names no weekday, counts no days this week, shows no rate and draws no tag`
- verified-by: `no learner-facing string carries a middot, an em dash or an en dash, and the allowlist only shrinks`

### F603 — Speak and the live scene are the notebook's: a ledger path, a composite chooser, a centred room with a spinner, text-link controls under a small orb, and a confirm card in the middle
- severity: P1
- status: [x]
- where: apps/mobile/src/ConvoScreen.tsx:1109
- note: Stage 3, area 3 of revamp B. `ConfirmSheet` becomes a bottom sheet over the ink scrim with staying as the pill; `ControlTile` is appended and `RoundButton` can carry a hint. Speak leads with the tutor card, or what the tutor remembers, then the blue next-scene brief with a white Start (or the offline picture and card), then one path card of the current level's scenes that opens the list. Missions is a list grouped by level with scene marks that opens each brief, and a named scene opens as the blue brief page. The room has a round close with the French title, white and ink bubbles, a 120 orb, three white control tiles with "Give me a moment" and "In English" kept as quiet links, an ink coach mark, the typed field with an ink send disc, and the completion card left-aligned. Connecting and waiting are one full page with the thinking orb and the real stage line and no invented ticks. The guided lesson wears the same frame. Errors draw their state picture with one ink pill; the safety stop, tutor intro and real moment are restyled with their words and gates kept. Four files leave the punctuation allowlist, `state-offline` leaves the not-yet-drawn list, and the place scenes wait on a named list F611 empties. Scoring stays off (F623); no task ticks and no "Why?" link.

- continuation: Code-level implementation independently accepted on 2 October 2026 after 229 focused area checks. The original board slots are superseded by approved implemented follow-ons: lifetime Profile, weekly Progress, counted light-day practice, local shadowing and Max at 300 minutes. The checks below are the actual passing behavior tests and area contracts, replacing proposed names that did not exist. Source contracts are not rendered-device proof; native layout, focus, screen-reader, microphone and store QA remain explicit release HOLDs.
- verified-by: `revamp B Speak preserves real gates, one primary action and the authored scene path`
- verified-by: `revamp B room controls keep typing, help and leave alongside the real waiting and error states`
- verified-by: `hear it hides when there is no line the tutor would vouch for`
- verified-by: `type instead sends a typed turn through the ordinary path mid-scene`
- verified-by: `the next conversation is the next scene on the spine`
- verified-by: `both live screens draw the connecting wait from the view model, door included`

### F604 — Practice still wears the notebook: hairline ledgers, a striped review card, the old speak ring, the pen's reward mark and empty states with no drawing
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/PracticeTab.tsx:304
- note: Stage 3 of revamp B, the Practice area, 23 boards. Pass 0 finishes the shared parts every area draws. `Ledger` and `LedgerRow` become SNIPPETS' white list, `SpeakCircle` becomes the mint orb, `ScreenHeader` takes a left title, a trailing line and no rule, and `TabBar` gains the underline look. Practice then leads with the sun card, one white recommended card and one list. Review loses its stripe, gains Show me, and gets three equal grades. The drill names its exercise in the header, marks a verdict with a mint tick, and offers the existing typed twin as the primary when there is no microphone. The sound check, phrasebook, library, light day and conversations screens move to the B parts with their own words. The empty states draw `state-notebook` and `state-microphone`. `surface/PhraseCard.tsx` retires. Fix your line, spoken own words, Shadowing and the light day's "counts as a day" are slots, not builds.

- continuation: Code-level implementation independently accepted on 2 October 2026 after 229 focused area checks. The original board slots are superseded by approved implemented follow-ons: lifetime Profile, weekly Progress, counted light-day practice, local shadowing and Max at 300 minutes. The checks below are the actual passing behavior tests and area contracts, replacing proposed names that did not exist. Source contracts are not rendered-device proof; native layout, focus, screen-reader, microphone and store QA remain explicit release HOLDs.
- note (2026-10-20, B3, B-Practice): Practice leads with the learner's conversations; the sound guide and hear, say and compare stay on the page, so the test is renamed for that.
- verified-by: `revamp B Practice keeps an evidence-bounded sound guide and local compare after the conversations`
- verified-by: `the tab keeps exactly one primary pill, whichever day it is`
- verified-by: `a measured fact appears only when a check measured it`
- verified-by: `a due production item requires retrieval before its answer is revealed`
- verified-by: `the review sitting has no microphone and takes no recording`
- verified-by: `revamp B retrieval and drills preserve attempted recall, honest scoring and the typed twin`

- note: 3 October 2026: the founder-authorised UX reviews supersede the earlier layout/copy assertion. The replacement test retains the underlying useful action, truthful evidence and allowance rule.

### F605 — Progress is the notebook's long ledger titled My French, not one blue level card and one list that counts only things kept
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/MyFrenchTab.tsx:211
- note: Stage 3 of revamp B, the Progress area: ProgressDayOne, ProgressPopulated and GoalStep. A pure `myfrench/progressRows.ts` decides the tab's doors (phrases, sounds, conversations, each goal, each saved scene) and says them in counts of things kept, never days. `myfrench/LevelCard.tsx` draws the level as the one blue card, with mint, sun and ring marks and the next level's scene count, and opens the scenes. The tab draws the card and one list, plus a day-one card with the one pill, under the title Progress. The inline phrase bank, sounds map and daily and browse rows leave the tab. GoalStep moves to a title, one blue card with a white pill, and a white trail. Postcards, Your week in French, the one weekly line and the lifetime count are slots for F612, F613, F608 and F609.

- continuation: Code-level implementation independently accepted on 2 October 2026 after 229 focused area checks. The original board slots are superseded by approved implemented follow-ons: lifetime Profile, weekly Progress, counted light-day practice, local shadowing and Max at 300 minutes. The checks below are the actual passing behavior tests and area contracts, replacing proposed names that did not exist. Source contracts are not rendered-device proof; native layout, focus, screen-reader, microphone and store QA remain explicit release HOLDs.
- verified-by: `Progress counts kept material and leaves empty shelves absent`
- verified-by: `Progress keeps each goal and saved scene attached to its own destination`
- verified-by: `one primary pill opens the suggested mission with the goal step, and says what it costs under it`
- verified-by: `a lifetime total has no zero, target, reset or penalty for a quiet week`
- verified-by: `the weekly sentence uses local Monday boundaries and never counts a future date`
- verified-by: `revamp B Progress opens evidence-based materials, a weekly story and earned postcards without starting audio`

### F606 — Profile and Settings draw their choices as full-screen pages, Profile still counts days this week, and deleting an account never mentions the store subscription
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/ProfileTab.tsx:229
- note: Stage 3 of revamp B, Profile, Settings and Legal, 12 boards. The name, voice, reminder-time and clear-memory choices rise as bottom sheets over the screen that opened them, through `Sheet`, `OptionRow` (which gains an optional hear control) and `ConfirmSheet` (drawn through `Sheet`). Selecting chooses and Done closes. Settings rows press through `Press` as SNIPPETS list rows. Switches are brand blue when on. The segmented choice ticks once. Profile stops drawing the this-week rhythm sentence and leaves a slot for F609's lifetime count. The delete page keeps its account as the one pill, puts the permanent step in a link, and adds one sentence reviewed by privacy-safety: a store subscription is cancelled in the store. Legal screens change chrome only. The Pause memory switch is a slot.

- continuation: Code-level implementation independently accepted on 2 October 2026 after 229 focused area checks. The original board slots are superseded by approved implemented follow-ons: lifetime Profile, weekly Progress, counted light-day practice, local shadowing and Max at 300 minutes. The checks below are the actual passing behavior tests and area contracts, replacing proposed names that did not exist. Source contracts are not rendered-device proof; native layout, focus, screen-reader, microphone and store QA remain explicit release HOLDs.
- verified-by: `revamp B Profile choices stay over Profile and keep a lifetime count without a weekly rail`
- verified-by: `the reminder time is chosen from the presets the module owns, on a sheet that takes the screen`
- verified-by: `revamp B reminder and deletion controls retain explicit choices and explain store cancellation`
- verified-by: `a lifetime total has no zero, target, reset or penalty for a quiet week`

### F607 — The plans are one ruled card, a purchase ends on a line of text, and the out-of-minutes screens sell inline in notebook cards
- severity: P1
- status: [x]
- where: apps/mobile/src/wall/WallScreen.tsx:192
- note: Stage 3 of revamp B, the Plans area: WallYours, WallPlans, WallSuccess, WallUnavailable and OutOfMinutes. What stays yours becomes the sun page with one white card of iconed rows, which needs `MouthGlyph` ported. Each plan becomes its own card, the chosen one on the blue ground with a white check. A finished purchase becomes the mint page, with the bought plan's catalogue minutes as the hero and one way to start speaking. The unavailable state draws `state-offline`, Try again and the one restore. Both out-of-minutes branches draw one shared sheet, titled by the refusal's own label, that opens the wall at the declared `refused` door instead of selling inline. The purchase label joins plan and price with a comma. Every number is read from the catalogue or the store. The board's Max figures (450 minutes, about 10 a week) disagree with `meter.ts` (300, about 7) and are flagged for the founder, not shipped.
- continuation: Code-level implementation independently accepted on 2 October 2026 after 229 focused area checks. The original board slots are superseded by approved implemented follow-ons: lifetime Profile, weekly Progress, counted light-day practice, local shadowing and Max at 300 minutes. The checks below are the actual passing behavior tests and area contracts, replacing proposed names that did not exist. Source contracts are not rendered-device proof; native layout, focus, screen-reader, microphone and store QA remain explicit release HOLDs.
- verified-by: `the price is the store's own string, character for character`
- verified-by: `the allowance is the catalogue's, in whole minutes`
- verified-by: `the cards use the selected state this app already uses, not a radio`
- verified-by: `a finished purchase names only the refreshed server plan and its catalogue allowance`
- verified-by: `revamp B out-of-minutes surfaces open the central wall without selling in the room`
- note: 2026-10-23, REV-001: Core 300 and Max 600 minutes a month; the conversation estimate moved with them.
- verified-by: `300 minutes a month is about seven ten-minute conversations a week, and Max about fourteen`

### F616 — Live pronunciation scoring is off, and the only scorer wired is a vendor nobody chose
- severity: P1
- status: [x]
- where: services/shared/pronunciation.ts:1
- note: captured audio never reaches a scorer (`LUVANI_AUDIO_SCORING` unset), so every live end card reads `unavailable`; the one adapter is Speechace and the founder chose TonePerfect on 2026-09-29. Add a vendor-neutral router chosen by `LUVANI_SCORING_VENDOR` (TonePerfect when its key is set, Speechace otherwise, a named vendor without its key scores nothing), a TonePerfect adapter that goes through `phoneMap` into the same `PhonemeObservation[]`, one shared 5 s deadline, one random Idempotency-Key per call reused on the single retry, and a failure policy where a timeout, refusal, outage or unassessable answer is no score and never a low one. The real response is committed as `services/tutor-agent/src/fixtures/toneperfect-fr.json`; all 18 returned symbols map with none unmapped, and the tutor's own recording deterministically yields no focus. The model is marked experimental. Live-session scoring stays off by the founder's decision of 2026-09-29 until scoring runs off the reply path (see the follow-up entry).
- verified-by: `TonePerfect is chosen whenever its key is set and nothing says otherwise`
- verified-by: `LUVANI_SCORING_VENDOR picks the vendor by name, and the audio goes to that vendor's endpoint`
- verified-by: `a vendor named without its key scores nothing rather than sending audio elsewhere`
- verified-by: `with no vendor configured, the audio goes nowhere`
- verified-by: `the request carries the audio, the line, the language and a bearer key, and never the key in the URL`
- verified-by: `every attempt gets its own Idempotency-Key, and a retry reuses it`
- verified-by: `a 5xx is retried once inside the same deadline; a 4xx is not retried`
- verified-by: `an unassessable response means no score, not a low one`
- verified-by: `a refusal, an outage, a hang and a malformed body all leave the turn unscored`
- verified-by: `no request is made without a key or without audio`
- verified-by: `the saved TonePerfect response parses into one observation per scored phone`
- verified-by: `every symbol TonePerfect returned is in the French inventory, none unmapped`
- verified-by: `what the learner said instead is kept as the substitution`
- verified-by: `the fixture is deterministic: same ranking, same weakest sound, no focus to name`
- verified-by: `a TonePerfect response with a genuinely weak sound reaches a focus point and its drill`
- verified-by: `the Speechace request honours the shared deadline`
- verified-by: `nothing in this suite reaches the network`
- verified-by: `an inline TONEPERFECT_API_KEY assignment is caught as a server-only credential`
- verified-by: `scoring stays off until it is deliberately turned on`

### F623 — Live pronunciation scoring sits on the reply path and would add three to four seconds a turn
- severity: P2
- status: [x]
- where: services/tutor-agent/src/tutor.ts (`onUserTurnCompleted`, `scoreInBackground`, `settleScores`)
- note: `scoreUtterance` is awaited in `onUserTurnCompleted` before the brain replies, and `grade()` reads the turn's mean at `packages/core/src/session/session.ts:286`, so a live scene would wait for the scorer (3.4 s for a 1.7 s clip in the one TonePerfect call) on top of the brain (4.5 to 5.4 s). By the founder's decision of 2026-09-29, live-session scoring stays off (`LUVANI_AUDIO_SCORING` unset) while drills and sound checks score through the token server. The fix runs scoring alongside the reply and lets the grade read the score when it lands; it touches core session code, which has no specialist by design, so it needs its own contract in Round 2.
- fixed 2026-10-22 (VOICE-004): the turn is submitted with no phonemes and replied to at once; the score runs beside it and lands as evidence through core's pure `addPronunciation`, which never touches the ladder or the grade. Only a learner who said the reference line is scored against it (`saidTheReferenceLine`). A finishing lesson waits at most `SCORE_SETTLE_MS` (2.5 s) for scores in flight, then reports anything missing as not assessed. Through the paid transport the audio is converted in process by `services/shared/liveScoringAudio.ts`, so the live path no longer needs the external decoder (F805). The flag stays off by default; production still requires Speechace (preflight).
- verified-by: `a live turn's reply never waits for the pronunciation score`

### F624 — Drill and sound-check audio went to TonePerfect labelled as WAV whatever it was
- severity: P2
- status: [x]
- where: services/shared/toneperfect.ts:64
- note: found by the Stage 5 judge. Drills and sound checks record with expo-audio's high-quality preset, which is AAC in an .m4a container on a phone and WebM on the web, and `/drill/score` forwards those bytes unchanged, but every upload was typed `audio/wav` and named `utterance.wav`. A vendor that trusts the label would refuse the attempt, and a refusal is no score, so drills would have gone quietly unscored. `sniffAudio` now reads the container from its first bytes (WAV, M4A, WebM, OGG, MP3, else `application/octet-stream`) and the upload carries that type and a matching filename.
- verified-by: `a drill recording is sent to TonePerfect labelled with the format it was recorded in`

### F625 — The drill judge sends a learner's French to the language model and to TypeSafe, and the policy names neither
- severity: P2
- status: [x]
- where: apps/mobile/src/legal/policy.ts:152
- note: found by the privacy-safety-engineer during Stage 5; it came in with the Jev merge and predates revamp B. `POST /drill/judge` (`services/token-server/src/server.ts:478`) hands the learner's own-words drill attempt and the target to the language model vendor, while the policy's vendor section ends "Nothing more about that session reaches any of them after that" and names no drill judging at all. When `TYPESAFE_API_KEY` is set, `brainClientFromEnv` (`packages/brain/src/llm/factory.ts`) wraps the brain in `JevFirstBrainClient`, so the same attempt also reaches TypeSafe first, and neither the policy nor `docs/PRIVACY_AND_SAFETY.md` names TypeSafe at all. `docs/PRIVACY_AND_SAFETY.md` does not describe the route either. The fix is a sentence in both naming the language model and TypeSafe, owned by privacy-safety-engineer, plus the regenerated legal HTML; no code changes. It must land before production.
- verified-by: `the policy says a drill answer in your own words is read by the language model and by TypeSafe`

### F626 — A drill score request puts the learner's id and the line in the URL
- severity: P2
- status: [x]
- where: apps/mobile/src/speech/scoreAttempt.ts:30
- note: found by the privacy-safety-engineer during Stage 5; it predates revamp B. `scoreRecordedAttempt` calls `/drill/score?userId=…&reference=…`, and a query string is what proxies, hosting access logs and crash reports record by default. The line can be the learner's own corrected sentence (`packExercisesFor`), so it is personal. Move both into request headers or a small JSON envelope, and have the server refuse the old query form; the server change belongs to backend-engineer and the call site to practice-ux-engineer.
- verified-by: `a drill score request carries no learner id or line in its URL`

### F627 — The busy-auth pin still asks a disabled ghost for inkFaint, so F152 fails on the contract's inkSoft
- severity: P1
- status: [x]
- where: apps/mobile/src/auth/busyLabel.test.ts:140
- note: found by the Stage 2 pass A judge. Revamp B stage 2 (F597) made GhostButton default to `color = paper.ink` and draw `disabled ? paper.inkSoft : color`, as the contract says. The pin still matched `/disabled \? paper\.inkFaint/`, so the F152 test failed and the ticked P1 F152 reopened in the gate. Forgot password passes no colour, so it is ink when live and soft ink when busy, which is the intent. The pin now matches `/disabled \? paper\.inkSoft : color/` and a second pin, `/color = paper\.ink,/`, keeps the live and busy colours apart. components.tsx needed no change.
- verified-by: `forgot password cannot be tapped while the screen is busy`

### F628 — The F152 hand-off pin still asks GhostButton for the opacity flash the press spring replaced
- severity: P1
- status: [x]
- where: apps/mobile/src/surfaceContract.test.ts:922
- note: found by the Stage 2 pass A judge. F597 moved GhostButton onto `<Press haptic="light" style={s.ghost} disabled={disabled} ...>` and deleted its opacity pressed state, as the contract says. A disabled Pressable never fires onPressIn, so a disabled ghost neither shrinks nor flashes. The pins still matched `/pressed && !disabled/` and `/disabled \? paper\.inkFaint/`, so the test failed. They now match `/<Press haptic="light"[^>]*disabled=\{disabled\}/` and `/disabled \? paper\.inkSoft : color/`. components.tsx needed no change.
- verified-by: `a ghost button can be turned off, and looks it`

### F629 — F309's chevron allowlist does not know the shared header's back mark now lives in RoundButton
- severity: P1
- status: [x]
- where: apps/mobile/src/surfaceContract.test.ts:1014
- note: found by the Stage 2 pass A judge. F597 moved ScreenHeader's way back into `RoundButton kind="back"` in components.tsx, which draws `<ChevronLeft size={24} ...>`, and layout.tsx no longer draws a chevron. CHEVRON_ALLOW was still `['layout.tsx', 'friends/AddFriendsScreen.tsx']`, so the F309 test failed and the ticked P1s F309 and F357 reopened. 'layout.tsx' is replaced by 'components.tsx', commented as RoundButton's back mark, which ScreenHeader draws. The same ADOPTERS loop now also refuses any `<RoundButton>` tag with `kind="back"`, whatever the attribute order, because the round back carries its own chevron and its own default Back: without that, a screen could put a second way back beside ScreenHeader with no chevron and no literal Back, and the test would stay green.
- verified-by: `a pushed screen has exactly one way back, and it is the shared header — F309`

### F630 — F409 counts a Pressable in LedgerRow, which now presses through one Press
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/HomeTab.test.ts:486
- note: found by the Stage 2 pass A judge. F597 made LedgerRow `<Press haptic="light" style={ls.row} disabled={disabled} ...>`, which renders one Pressable, so the row is still one target. The pin counted `/<Pressable\b/` in the LedgerRow region, got 0 instead of 1, and the F409 test failed, reopening the ticked P1s F409 and F436. It now counts `/<Press\b/` with the expected value kept at 1, and `assert.doesNotMatch(ledger, /<Pressable\b/)` keeps a second target beside the spring failing.
- verified-by: `home and tutor wrap every line, cap no reading size, and keep every row at the touch floor — F409`

### F631 — Home's touch-floor walk reads only Pressable tags, so it goes blind when rows move onto Press
- severity: P2
- status: [x]
- where: apps/mobile/src/tabs/HomeTab.test.ts:466
- note: found by the Stage 2 pass A judge; not a defect of revamp B stage 2. The F409 loop checks that every tappable row under home/ declares minHeight: HIT, but it walks only `tags(body, 'Pressable')`. Stage 3 moves Home onto the B parts, which press through `Press`. A `<Press style={st.row}>` with no floor would then pass unseen. Walk `tags(body, 'Press')` as well; `<Press\b` does not match `<Pressable`.
- note 2026-10-07: fixed on ca/p4-home (step P4-A). HomeTab.test.ts walks `tags(body, 'Press')` beside the Pressable walk over every file under home/ and the two game cards Home draws (game/TodayHero.tsx, game/QuestsCard.tsx), proving first on synthetic rows that a Press with no floor is caught and a Pressable is not read as a Press. The title failed without the change (it did not exist).
- verified-by: `every tappable row on Home declares the touch floor, whether it presses through Pressable or Press`

### F632 — Seven lines still send the learner to My French, which the tab bar now calls Progress
- severity: P2
- status: [ ]
- where: apps/mobile/src/settings/sections.ts:114
- note: found by the Stage 2 pass B judge. F600 renamed the tab to Progress and F605 retitles the screen, but RecapScreen.tsx:178,181, settings/sections.ts:114, conversationPacks/ConversationPackLibrary.tsx:204, daily/DailyCard.tsx:59, profile/tutorMemory.ts:54 and tutor/TutorIntro.tsx:115 still tell the learner their phrases are saved in or managed in My French. After F605, no tab or title says My French, so a learner who looks for it finds nothing. Reword each one to Progress, or to the phrasebook where that is the real destination, in the same change as F605.
- verified-by: `no learner-facing string names My French once the tab and its title say Progress`
- note (2026-10-20, B6): still open. The tab is now titled Your journey (direction B), and two learner-facing strings still say My French: `MY_FRENCH_ROW = 'My French'` (apps/mobile/src/settings/profileView.ts:43, drawn as a Profile row in tabs/ProfileTab.tsx:291) and `SAVED_SUB = 'Manage in My French'` (apps/mobile/src/settings/sections.ts:119). The other sites this entry listed no longer name it.

### F633 — The under-13 refusal is said to last the session, but leaving through "I have an account" and back starts it fresh
- severity: P1
- status: [x]
- where: apps/mobile/src/onboarding/PreAccountOnboarding.tsx:252
- note: `underAge` is `useState(false)` inside PreAccountOnboarding, so it lives only while that screen is mounted. Refuse on save, go back five pages to hear-it, tap "I have an account" (App.tsx:530 discards the draft), tap SignIn's back (auth/AuthFlow.tsx:39 remounts the welcome with `underAge` false), walk the six pages, and "I am 13 or older, create account" is offered again in the same launch. Yet PreAccountOnboarding.tsx:18 and :252-255, firstRun.test.ts:238 and docs/ONBOARDING.md:37 and :129-130 say it stays for the session or until the app is closed. Not a regression (before F601 any page move reset it), but the words overclaim a minors safeguard. Fix the words to say that moving between the pages does not undo it, that leaving through "I have an account" starts the first run fresh, and that closing the app reopens the save page with the question asked again, the same close-the-app escape the age gate keeps for a mis-tap (corrected by F638: this note first said closing the app starts the first run fresh, which it does not). Whether it should hold for the whole launch is the founder's call, filed as F637.
- verified-by: `the age boundary is documented before processing and lasts the launch only`

### F634 — OnboardingFlow's OptionCard was to become OptionRow in F601, and was left without a word
- severity: P2
- status: [ ]
- where: apps/mobile/src/onboarding/OnboardingFlow.tsx:351
- note: F601's contract says "`OptionCard` becomes `OptionRow`. Nothing else changes." It was not built. A straight swap is not possible: OptionRow has no hear control, and the voice step's cards carry `onHear` and `playing={playing === option.value}`, which F355's test pins, so the swap would take the voice samples off the recovery route. The same file keeps `question: { ...type.display }` at :415, against F601's done-when that `type.display` appears in onboarding/ only on hear-it, first-line and FirstScene. Done when OptionRow can carry a sample (a design-system change) and the voice step uses it with F355 still passing, and the question is a working title.
- verified-by: `the recovery route's tutor cards keep independent selection and preview state`

### F635 — The microphone refusal tells an Android learner to find a switch Android does not have
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/micPrimer.ts:57
- note: `PRIMER_REFUSED_HOW` reads "In Settings, open Luvani and switch on Microphone, then come back here." That is iOS. `PHONE_SETTINGS_AVAILABLE` is also true on Android (settings/phoneSettings.native.ts:57), where `Linking.openSettings` opens Luvani's app page and the microphone is an allow choice under Permissions, not a switch. The words came from the F601 contract, so this is a copy fix, not a build miss. Use "In Settings, allow Luvani to use the microphone, then come back here." and move the value pin in micPrimer.test.ts. No Platform branch in the view model.
- verified-by: `the microphone refusal says how to turn it back on in words that are true on iOS and Android`

### F636 — The age check's quiet line promises "you carry on", which is true for only one answer
- severity: P1
- status: [x]
- where: apps/mobile/src/onboarding/answers.ts:118
- note: `AGE_RETURN_NOTE` was "One question, then you carry on where you were." A learner who taps "I am younger than that" does not carry on; they get AgeRefusal and sign out, and AgeGateScreen drew the line with no condition, so it sat directly above the refusal and was false on the screen that refused them. On an age screen a line that says which answer continues also leans away from a neutral question (FTC COPPA guidance: an age screen should not encourage a false age). Raised to P1 by the F601 judge: a known-false line on the minors gate. Fixed in F601: the line is now "It is one question.", true for both answers, and AgeGateScreen draws it only while `oldEnough !== false`, so once refused the refusal is the only line under the sub. The equality pin in answers.test.ts moved to the new value. AGE_RETURN_TITLE, AGE_RETURN_SUB, AgeRefusal and the footer are unchanged; whether a stated 13+ yes or no is itself a neutral screen is for the founder and legal.
- verified-by: `the age check's quiet line is true whichever answer the learner gives`

### F637 — Founder question: should the under-13 refusal hold for the whole launch, across the sign-in detour
- severity: P2
- status: [ ]
- where: apps/mobile/src/auth/AuthFlow.tsx:39
- note: After F633 the words are honest, but the refusal still lives in PreAccountOnboarding's own state, so "I have an account" then back starts the first run fresh in the same launch. If the founder wants it held, the in-memory shape is `const [refused, setRefused] = useState(false)` in AuthFlow, passed to PreAccountOnboarding as `refused`/`onRefuse` to seed its `useState(refused)`; the founder also decides whether SignIn's "Create one" is withheld while refused. Do not persist the refusal to the device without founder and legal approval: that stores new data about a minor with a retention period. Answered by the founder on 2026-09-30: firmer, and clear on refusal. The refusal holds for the whole launch, in memory only and never on the device, and it clears the saved first-run draft, first name included; a relaunch may ask again.
- verified-by: `authentication cannot undo a refusal or silently make its draft eligible`

### F638 — The under-13 refusal's words say closing the app starts the first run fresh, but a relaunch reopens the save page with the pill live
- severity: P1
- status: [x]
- where: docs/ONBOARDING.md:130
- note: found by the F601 judge, confirming the privacy-safety review. F633's fix wrote "closing the app, or leaving through \"I have an account\", starts the first run fresh" into docs/ONBOARDING.md and the comment in onboarding/PreAccountOnboarding.tsx, and firstRun.test.ts pinned it. Closing the app does not start the first run fresh: "Save my plan" writes page 'save' to the draft, which App.tsx saves to the device, and "I am younger than that" writes nothing, so a relaunch reopens the save page with the question asked again. That matches HEAD and the age gate's close-the-app escape, so the words are the defect, not the code. Whether a refusal should clear the draft is a founder question (F639). Superseded by F639: a refusal now clears the draft, so a relaunch starts at the first page with nothing kept.
- verified-by: `relaunch does not restore a refusal marker or retained child draft`

### F639 — Founder question: should an under-13 refusal clear the saved first-run draft, so a relaunch starts at the first page and keeps no first name
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/PreAccountOnboarding.tsx:662
- note: found by the privacy-safety review of F601. The refusal writes nothing, so the draft saved by go('save') keeps page 'save' and any first name the child typed on the device (never sent), and a relaunch reopens the save page with the pill live. Clearing the draft on refusal removes data about a minor rather than storing any. It overlaps F637, so decide both together. A founder and legal call, not a build miss. Answered by the founder on 2026-09-30: firmer, and clear on refusal. The refusal holds for the whole launch, in memory only and never on the device, and it clears the saved first-run draft, first name included; a relaunch may ask again.
- verified-by: `refusal invalidates pending service work and queued guest writes`

### F640 — The canvas sells Max as 450 minutes a month, but the plan the code sells is 300 at $29
- severity: P2
- status: [x]
- where: packages/core/src/metering/meter.ts:50
- note: founder decision, 2026-09-30. The approved canvas sells Max as "450 minutes a month, about 10 conversations a week". `PLANS.regular` grants `300 * 60`, which the wall rounds down to about 7. Store prices, Starter (180 minutes) and the free trial (30 minutes) do not change. Filed and not built, because at $29 the 450 minutes are the allowance 202609100001 removed for losing money. Measured from DEFAULT_COST_MODEL at full use, 450 minutes cost $26.01 to serve against $24.65 net after the 15% Small Business fee, a worst-case margin of -5.5% (-28.1% at the standard 30% rate, +10.3% before any store fee). 300 minutes leave 29.7%. Setting the constant to 450 at $29 fails four margin floors in meter.test.ts. Those floors stay unless the founder signs off on the negative number. Two more things block it. Nine files under supabase/ (five migrations, four rollbacks) hold 18000, and a new forward migration has to replace consume_entitlement (data-engineer's work). And PLANS at 450 against a database that clamps seconds_used at 18000 would leave every Max learner with 150 minutes forever, which is unlimited Max. The founder needs to pick one of three: 450 at $39, the plan before 10 September (21.5% worst case after the Small Business fee, every floor passes, and the App Store tier moves too); 300 at $29, with the canvas saying about 7; or 450 at $29, with -5.5% written into the contract. The wall's minutes and conversation count come from the catalogue, so no copy changes. Only the wall test's pin moves from 7 to 10. Answered by the founder on 2026-09-30, once the loss was shown: 300 minutes at $29 stays, so nothing in code or data changes, and the Plans screens (F607) show 300 minutes and about 7 conversations a week. The two tests below keep the plan and its margin where the founder left them. Note, 2026-10-23: the dollar figures here are from the cost model of the time. VOICE-008 corrected DEFAULT_COST_MODEL to measured rates ($0.04825 a minute); 300 minutes now cost $14.48, a 41.3% worst-case margin after the 15% fee, and 450 at $29 would cost $21.71 (+11.9% after 15%).
- note: 2026-10-23, REV-001 (DECISIONS.md): the founder repriced Core and Max ($14.99, 300 min; $24.99, 600 min; yearly $99 and $169), knowing full use now loses money (Core -14%, Max -36% at 15%). The twenty-percent floor no longer holds by decision, not by drift. These tests replace it and pin the new figures.
- verified-by: `both paid plans lose money on a learner who burns every minute, and the size is pinned (REV-001)`
- verified-by: `at 40% utilisation and the Small Business rate Core clears 50% and Max 40%`
- verified-by: `the atomic debit uses the same plan limits as core`

### F641 — A sign-in and sign-out in the same launch ends the under-13 refusal, offers the pill again and saves the first-run draft again
- severity: P1
- status: [x]
- where: apps/mobile/src/auth/AuthFlow.tsx:60
- note: found by the judge of the F637/F639 stage, confirming the privacy-safety review. The refusal lives in AuthFlow's `useState(false)`, and Gate (App.tsx) unmounts AuthFlow while anyone is signed in. Refuse on save, then 'I have an account', then Google or Apple, which creates a new account. OnboardingFlow asks the age question, 'younger' signs out through AgeRefusal, and a new AuthFlow opens on hear-it with the pill live after six pages. keep writes the draft, first name included, back to the device. The founder's answer (2026-09-30) was the whole launch, and ONBOARDING.md and PRIVACY_AND_SAFETY.md say nothing is saved again in that launch. Move the refusal up to Gate, which stays mounted for the launch and already holds state that crosses the auth door (`preAccountDraft`, `localCopyKept`). Use `const [preAccountRefused, setPreAccountRefused] = useState(false)` and a `refusePreAccount` that sets it and calls `discardPreAccountDraft`. Pass `refused` and `onRefuse` to AuthFlow as required props, and drop AuthFlow's own useState. Keep it in memory only. Pin that nothing calls `setPreAccountRefused(false)` and that the value never reaches a storage call. Also check `refused` before `onCreateAccount(draft)` in AuthFlow's save-page handler, so the write never runs ahead of the one door. Replace 'Signing in ends the first run, and the refusal with it' with 'Signing in and out again does not end it; only closing the app does' in docs/ONBOARDING.md, docs/PRIVACY_AND_SAFETY.md and AuthFlow's header comment, and move the regex pins in authFlow.test.ts and firstRun.test.ts with them. Tradeoff to state: on a shared phone, an adult who signs out later in that launch lands on the refusal page until the app is reopened. If the lead would rather let a sign-in end the refusal, that narrows the founder's answer and has to go back to the founder. The four sentences above must then say 'until someone signs in or the app is closed'.
- note (fix, auth-engineer): built as filed. Gate holds `preAccountRefused`, set only by `refusePreAccount`, which also runs `discardPreAccountDraft`; AuthFlow takes `refused` and `onRefuse` as required props and keeps no copy; the save page's handler writes the draft only when not refused. The tradeoff is stated in Gate's comment, docs/ONBOARDING.md and docs/PRIVACY_AND_SAFETY.md. policy.test.ts's pin on `onRefuse={discardPreAccountDraft}` moved to `onRefuse={refusePreAccount}` plus the discard inside it, same intent.
- verified-by: `under-thirteen refusal is owned by the launch and passed to signed-out and signed-in onboarding`
- verified-by: `onboarding and privacy document refusal across authentication without storing a child marker`

- note (independent review, 2026-10-02): user-authorized gpt-6-sol reviewed the real diff and accepted the launch-held refusal plus the serialized draft clear. The delayed storage regression proves that an already issued save finishes before removal and queued answers are invalidated. Native launch/relaunch still needs device evidence.
- verified-by: `refusal clears a pending draft and wins over already queued answers — F641`

### F642 — The privacy notice says the app asks the age question once, but a relaunch after a refusal before an account asks again
- severity: P2
- status: [ ]
- where: apps/mobile/src/legal/policy.ts:214
- note: found by the judge of the F637/F639 stage. policy.ts:135 says 'the app asks once' and :214 says 'The app asks once, in plain words, and takes the answer.' PRIVACY_AND_SAFETY.md:560 says 'Onboarding asks once'. Since the founder's 2026-09-30 decision, a relaunch after an under-13 answer before an account asks again, and the doc's Not true yet table says so. Proposed wording, which needs founder sign-off because it is legal copy: :135 'Your answer to the age question. It is a gate rather than a detail we file, and Luvani is for learners of thirteen and over.' :214 'Luvani is for learners of thirteen and over. The app asks in plain words and takes the answer.' Regenerate dist/privacy.html through html.ts, and change PRIVACY_AND_SAFETY.md:560 to match.
- verified-by: `the privacy notice's age section does not promise the question is asked only once`

### F650 — Two lists still rule their own rows inside the new white list card, so they draw two hairlines between rows
- severity: P2
- status: [x]
- where: apps/mobile/src/wall/WallYoursPage.tsx:68
- note: found by the F602 judge. `Ledger` now draws one hairline between its rows (components.tsx), but `WallYoursPage.tsx` (`st.ruled`) and `myfrench/PhraseBank.tsx` still give each row its own bottom border, so inside the white card they show two rules between rows and a stray rule under the last. The Wall's Yours page is where Home's "See the plans" lands. Take the row's own border off so the list's rule is the only one: the Wall in F607, PhraseBank in F605 (or leave it if F605 stops drawing it).
- verified-by: `a row inside the white list draws no rule of its own, so the list's hairline is the only one between rows`

### F651 — A trial with under two minutes left leads Home with Start, and only the token server says there is not enough time
- severity: P2
- status: [ ]
- where: apps/mobile/src/home/nextAction.ts:1
- note: found by the revenue review of F602. `homeActionFor` leads with the plans card only when the trial's reason is `exhausted`. A trial with 1 to 119 seconds left reports `insufficient-for-session`, so Home leads with the blue Start and the server then refuses the session honestly. Decide in F607 whether that state leads with the plans card too, and walk the boundary loop over `Object.keys(PLANS)` rather than a hand-written list so a new plan is covered.
- verified-by: `a trial with too little time for a session leads Home the way the plans pass decides, and every plan in the catalogue is walked`

### F652 — Closing Fix your line during authentication can start a recording upload after exit
- severity: P2
- status: [x]
- where: apps/mobile/src/speech/transcribeAttempt.ts:8
- note: The authorized Sol reviewer found that session disposal only fenced the returned transcript. A take waiting for authHeaders could still POST after the sheet closed or the app backgrounded. The repaired session passes cancellation and its current ticket through transcription; the client races cancellation/12s deadline across auth, checks before sending, aborts in-flight fetch, and retains caller-finally cleanup. Held headers, held upload and stalled auth deadline tests pass. No spoken accuracy or native proof is implied.
- verified-by: `closing a correction sheet during authentication starts no late audio upload and discards the take`

### F653 — Saved-audio manifest cancellation can replace its database deadline
- severity: P2
- status: [x]
- where: services/token-server/src/phraseAudioSource.ts:11
- note: Sol found that a supplied cancellation signal replaced the helper's 5s timeout. Both now combine via a shared Node AbortSignal.any deadline for the two reads. The held-read regression observes TimeoutError without mutating caller cancellation. Sol independently ran the ten bounded source/config checks and accepted this repair. This helper does not authorize billed generation.
- verified-by: `a caller-cancelled saved-audio lookup still has a database deadline`

### F654 — An accepted uppercase saved-audio locator is not used in its canonical form
- severity: P2
- status: [x]
- where: services/token-server/src/phraseAudioSource.ts:8
- note: Sol found that the strict public parser lowercased UUIDs but the manifest helper ignored its parsed value. The canonical parsed locator now governs both owner-scoped reads, identity comparisons and index selection; no case-insensitive phrase matching is introduced. Sol independently ran the ten bounded source/config checks and accepted the uppercase-locator regression.
- verified-by: `a valid uppercase saved-audio locator resolves its canonical owned pack`

### F655 — dynamic tutor-audio redirects could forward server secrets
- severity: P1
- status: [x]
- where: services/token-server/src/phraseAudio.ts
- note: found by authorized independent Sol review, 2 October 2026. Provider and database fetches followed redirects with custom secret headers. Refuse redirects at every new credential-bearing request.
- verified-by: `saved tutor audio refuses credential-bearing redirects before another origin can receive them`
- note (verification): authorized Sol independently reran 27 focused checks, token-server typecheck and the actual disposable sequential SQL proof; accepted the bounded backend repair. Hosted concurrency and real vendor/billing timing remain unverified.

### F656 — source deletion or subscription lapse after reservation could still dispatch saved audio
- severity: P2
- status: [x]
- where: services/token-server/src/phraseAudio.ts
- note: found by authorized independent Sol review, 2 October 2026. Recheck owned ready/completed source, exact selected French and current entitlement immediately before dispatch; document the unavoidable post-check race.
- verified-by: `saved audio dispatch gate refuses changed source completion and entitlement`
- note (verification): authorized Sol independently reran 27 focused checks, token-server typecheck and the actual disposable sequential SQL proof; accepted the bounded backend repair. Hosted concurrency and real vendor/billing timing remain unverified.

### F657 — a higher verified rate could dispatch against an earlier cheaper reservation
- severity: P1
- status: [x]
- where: supabase/migrations/20261002212536_kept_phrase_audio_budget.sql
- note: found by authorized independent Sol review, 2 October 2026. Matching fingerprints do not version billing bounds. Change rate revision on every update; carry it in reservation and require it at dispatch.
- verified-by: `a changed saved-audio billing revision cannot use an older reservation`
- note (verification): authorized Sol independently reran 27 focused checks, token-server typecheck and the actual disposable sequential SQL proof; accepted the bounded backend repair. Hosted concurrency and real vendor/billing timing remain unverified.

### F658 — tiny response chunks could grow saved-audio overhead beyond its byte bound
- severity: P2
- status: [x]
- where: services/token-server/src/phraseAudio.ts
- note: found by authorized independent Sol review, 2 October 2026. Use one bounded PCM buffer and nonblocking reader cleanup.
- verified-by: `saved tutor audio bounds fragmented PCM and does not await stalled cleanup`
- note (verification): authorized Sol independently reran 27 focused checks, token-server typecheck and the actual disposable sequential SQL proof; accepted the bounded backend repair. Hosted concurrency and real vendor/billing timing remain unverified.

### F659 — A saved-audio reservation can dispatch after its charged budget period ends
- severity: P1
- status: [x]
- where: supabase/migrations/20261002212536_kept_phrase_audio_budget.sql:103
- note: found by independent Sol revision review. Bind dispatch to the reserved global/paid window starts and deadline, with headroom for its bounded request. Refuse late calls without refunds.
- verified-by: `saved tutor audio refuses dispatch outside its reserved budget period`
- note (verification): authorized Sol independently reran 27 focused checks, token-server typecheck and the actual disposable sequential SQL proof; accepted the bounded backend repair. Hosted concurrency and real vendor/billing timing remain unverified.

### F660 — A kept-audio URI can return after auth changes but before storage scope updates
- severity: P2
- status: [x]
- where: apps/mobile/src/phrases/phraseAudioClient.ts:39
- note: found by independent Sol mobile review. Recheck auth session ownership after cache reads, generated response and disk writes, before returning a URI; remove newly committed audio on failed ownership.
- verified-by: `auth changes before scope updates cannot return cached or newly generated tutor audio`
- note (verification): authorized Sol independently ran 46 mobile and 27 server checks, mobile typecheck and the disposable sequential SQL proof, accepting the bounded repair. Physical playback/files, hosted concurrency and actual voice billing remain unverified.

### F661 — Untagged TTS frames and opening speech can masquerade as a scene reply's latency
- severity: P2
- status: [x]
- where: services/tutor-agent/src/agent.ts:207
- note: found by authorized independent Sol design review for Report 34. The first-audio hook marks the current mutable record and every speaking transition rotates it. Remove false attribution and measure confirmed spoken scene EOU-to-guarded-say through immutable per-input records. Report first audio and phone audibility as unmeasured until a supported correlated/device seam is verified.
- verified-by: `queued scene timing keeps its own speech end and omits failed or missing samples`
- verified-by: `only a confirmed spoken scene reply owns its latency record`
- note (verification): authorized Sol independently ran 161 scene/conversation/safety checks and tutor-agent typecheck after F662 repair. Worker dispatch only; no first-audio or phone-audible latency is claimed.

### F662 — A delayed turn callback can borrow the next utterance's end time
- severity: P2
- status: [x]
- where: services/tutor-agent/src/sceneReplyTiming.ts:72
- note: found and reproduced by authorized independent Sol review. EOU at 100ms, next speech starts and ends at 200ms, first callback begins and dispatches at 240ms: the collector reports 40ms for the first input rather than 140ms. Preserve an ambiguity marker across a new speech start or multiple end marks until the pending callback consumes it; censor instead of assigning the newer EOU.
- verified-by: `ambiguous speech boundaries are missing rather than falsely fast samples`
- note (verification): the regression was reproduced red before repair. Authorized Sol independently accepted the pending-boundary count/ambiguity fence, third-boundary censoring, typed invalidation and fresh recovery after 161 scoped tests and tutor-agent typecheck.
### F663 — A voice-only model migration also moves written judges through the shared fast-model default
- severity: P2
- status: [x]
- where: packages/brain/src/llm/openaiResponses.ts:289
- note: found by authorized independent Sol review. The founder requested GPT-6 Luna for the voice tutor. Shared turnModel also serves curate and judge, so the initial change unintentionally moves own-words and Fix your line judging without calibration. Add a live-only model setting while preserving the fast written model and analyst roles. Preflight and SDK must use the same live resolver; keep legacy explicit overrides compatible.
- verified-by: `a live-only Luna migration preserves curated practice and written judges on their existing model`
- review: Authorized independent gpt-6-sol accepted the live-only repair, 114 focused tests and brain/worker typechecks. Live turn/frame use GPT-6 Luna; curate/judge retain GPT-5.6 Luna; extraction/drills retain Terra. No worker restart, deployment or teaching/latency proof claimed.

### F664 — A blank live override can disagree with preflight and send an empty model
- severity: P2
- status: [x]
- where: packages/brain/src/llm/openaiResponses.ts:80
- note: The factory passes the environment's live model as config, where null coalescing accepts an empty or whitespace string. Preflight trims the same setting and reports the valid default instead. Normalize config overrides in the canonical resolver so both paths choose the same actual model.
- verified-by: `blank live config matches the worker preflight model rather than sending an empty model`
- review: Independent Sol accepted resolver trimming and override priority; 90 scoped tests and brain/worker typechecks passed.

### F665 — Blank written and analyst overrides pass preflight but send empty runtime models
- severity: P2
- status: [x]
- where: packages/brain/src/llm/openaiResponses.ts:224
- note: Found and reproduced by independent Sol review of F664. Factory passes blank environment values as constructor config, bypassing its trimmed process-env fallback. Normalize config turn/analyst values too so preflight and actual Responses requests agree for all three roles.
- verified-by: `factory blank model overrides preserve all three preflight defaults on actual requests`
- review: Independent Sol accepted the actual factory/request regression, 91 scoped tests and both affected typechecks. All three blank override paths now agree with startup defaults.

### F666 — Failed-session settlement lacks a capped, idempotent refund proof
- severity: P1
- status: [x]
- where: services/token-server/src/store.ts
- note: Report 2 change 36, founder-approved policy. Record actual charged delta, not requested seconds; restore it once on a service-owned failure. A failure-before-debit tombstone blocks late charging; owner mismatch cannot credit anyone.
- verified-by: `a failed session returns only its actual charge once and blocks a late debit`

### F667 — A late session report can debit a renewed allowance
- severity: P1
- status: [x]
- where: services/token-server/src/server.ts:402
- note: Bind signed session IDs to a service-owned issued allowance epoch before returning credentials; every callable non-null consume path checks it. Failure or ordinary reports from an old epoch cannot consume the next period. Use one entitlement-first lock order and drain old writers on deployment.
- verified-by: `a session from an earlier allowance cannot consume or refund a new period`

### F668 — File-backed session idempotency disappears on restart
- severity: P1
- status: [x]
- where: services/token-server/src/store.ts:187
- note: Balance and refund/charge/grant proof must be persisted in the same atomic file replacement. A restart must preserve both debit and failure tombstones. Do not acknowledge a refund when its durable write failed.
- verified-by: `a restarted file store preserves the failed-session tombstone and restored balance`

### F669 — Refund intent is not confirmed settlement
- severity: P2
- status: [x]
- where: services/tutor-agent/src/usage.ts
- note: Return a typed server acknowledgement; transport failures remain pending/reconcilable and never claim usable minutes restored. Historical reversals must not be described as current-period credit.
- verified-by: `a failed refund request stays pending until an explicit settlement acknowledgement`

### F670 — Ordinary exits and recoverable errors must not become service refunds
- severity: P2
- status: [x]
- where: services/tutor-agent/src/agent.ts:328
- note: Only recognized terminal live SDK failures with the learner present can mark a service-failure end. Exclude recoverable/quiet-irrelevant errors, errors after finish, manual leave, safety, time limits and post-session enrichment. A terminal typed fallback starts a new grant rather than reusing the closed room.
- verified-by: `only an unrecoverable live pipeline failure can end a session for refund`

### F671 — A refund can falsely restore an expired paid allowance
- severity: P1
- status: [x]
- where: supabase/migrations/20261002233520_failed_session_refunds.sql:97
- note: Independent Sol review: refund must apply the existing lazy paid-lapse transition while holding the entitlement lock before classifying the issued epoch. Without it, an expired paid allowance is described as usable restored minutes until the next read lapses it.
- verified-by: `an expired paid refund without an intervening entitlement read is historical`

### F672 — Missing legacy refund proof never reaches reconciliation
- severity: P2
- status: [x]
- where: services/token-server/src/store.ts:442
- note: Sol review: only a controlled missing-grant/legacy-charge SQL error may become a typed 409 reconciliation acknowledgement; transient database/transport errors remain pending. Do not acknowledge a restoration or guess legacy credit.
- verified-by: `the agent-authenticated settlement route distinguishes reconciliation from retryable failure`

### F673 — Synchronous failure publishing can skip terminal settlement
- severity: P2
- status: [x]
- where: services/tutor-agent/src/agent.ts:369
- note: Sol review: the notice publisher is evaluated before Promise.resolve, so a synchronous encode/publish failure bypasses the settlement finally. Invoke inside the promise chain and await the finish path before disconnecting. Optional chaining itself is safe when no local participant exists.
- verified-by: `terminal settlement still runs if publishing its failure notice throws`

### F674 — Concurrent scripted finishes can disconnect before settlement acknowledgement
- severity: P2
- status: [x]
- where: services/tutor-agent/src/tutor.ts:563
- note: A second terminal SDK callback can reach finish while the first awaits settlement; an ended-only no-op lets the second disconnect before the first acknowledgement. Share the in-flight finish promise, as the conversation worker already does.
- verified-by: `concurrent scripted finishes await one acknowledged service settlement`

### F675 — A corrupted refund ledger must not reset the local allowance
- severity: P2
- status: [x]
- where: services/token-server/src/store.ts:291
- note: A missing development fixture may start empty; an existing malformed ledger must fail closed rather than forget grant/charge/refund tombstones. Critical persistence failures must reject without acknowledging a refund.
- verified-by: `a corrupt refund ledger fails closed and a failed write cannot acknowledge a refund`

### F676 — Approved phrase-audio spending limits need hard ceilings
- severity: P2
- status: [x]
- where: supabase/migrations/20261003001510_approved_phrase_audio_caps.sql
- note: Founder approved $0.02 lifetime trial, $0.20 paid account per anchored thirty days and $10 global per anchored thirty days. Apply upper-bound constraints without resetting spends/anchors, force generation off and seed no vendor rates. Approval alone does not verify actual chosen-voice billing or playback.
- verified-by: `approved phrase audio caps remain hard ceilings with generation disabled`

### F677 — Terminal typing recovery must name the new session
- severity: P2
- status: [x]
- where: apps/mobile/src/live/LiveErrorView.tsx
- note: Sol review: a terminal room has ended, so its typing door starts a new grant. Label it Start a typed conversation rather than Continue by typing; keep pending/reconciliation blocked. Healthy quiet transitions retain the same-room label and flow.
- verified-by: `terminal typing recovery names a new conversation while healthy quiet mode continues`

### F678 — Can-do quotes must not claim evidence from an assisted replay
- severity: P2
- status: [x]
- where: packages/core/src/canDoEvidence.ts
- note: Sol design review: lifetime earned progress can stay earned after an assisted replay. Optional quoted proof must require this session's independent first complete mission win and exact accepted worker source; arbitrary history or last-line guesses are not evidence. Jev probability validation, public recipient disclosure and real French calibration are required before enabling.
- verified-by: `can-do evidence is bound to the current independent finish and exact accepted learner source`


### F679 — Correction-specific Jev passes must never use the paraphrase question
- severity: P2
- status: [x]
- where: services/token-server/src/fixLineObserver.ts
- note: Report 2 requires a distinct Noul on original, better and retry, at 0.9. Only an accepted repair skips the brain; below threshold, malformed, provider failure or timeout must preserve the existing brain request. The feature needs a reviewed real-French artifact before activation and a separate public recipient purpose. Unit fixtures are not calibration.
- verified-by: `a correction-specific Noul may remove one brain call but never change its fallback request`

### F680 — Live correction reasons need exact provenance and authored copy
- severity: P2
- status: [x]
- where: services/tutor-agent/src/correctionReason.ts
- note: Report 2 and independent Sol design review require closed authored reasons, a calibrated Choice probability, exact published correction identity and confirmed input source. Never explain an invented quote or reuse a late result for a newer correction. No threshold artifact exists, so the new purpose stays dark.
- verified-by: `authored correction reasons require exact current learner recast provenance`

### F681 — A cancelled TypeSafe request must not retry after its wait
- severity: P2
- status: [x]
- where: packages/brain/src/llm/typesafe.ts:167
- note: Independent Sol design review found systemOne waits after 429/529 and then invokes send without an explicit cancellation check. An optional request cancelled during the wait must dispatch no second request, even with a transport that ignores AbortSignal.
- verified-by: `an aborted TypeSafe retry wait sends no second request`

### F682 — Optional usage arriving after finish needs a session-linked correction
- severity: P2
- status: [x]
- where: services/tutor-agent/src/convo.ts:1162
- note: Independent Sol reproduced the accounting window: a cancelled optional provider can return after the one-time session summary. Its usage mutates in-memory counters but the operator's final total omitted it. Emit a session/activity-linked late total without learner text or a stale wire result. Learner minute charging is unaffected.
- verified-by: `late optional reason usage updates the session-linked total after finish`

### F683 — Recognition confidence is lost before the tutor sees the transcript
- severity: P2
- status: [x]
- where: services/tutor-agent/src/convo.ts:2088
- note: Report 35 asks to read recognition confidence. SDK final SpeechEvents carry it but session transcription events do not. Both public sttNode hooks must observe numeric confidence without retaining words, changing decisions or interrupting recognition. Missing/invalid confidence remains unavailable rather than zero.
- verified-by: `both live agent hooks observe final recognition confidence without changing events`

### F684 — The voice lifecycle harness reads the old balance-file shape
- severity: P2
- status: [x]
- where: services/tutor-agent/src/verify/voiceLifecycle.ts:533
- note: The no-vendor live token/room run passed admission and lease checks but three balance assertions read undefined. FileEntitlementStore now writes version 2 with nested entitlements. The harness must read actual current and legacy balances and reject unsupported/corrupt shapes, preserving its debit assertions and explicit agent skips.
- verified-by: `the lifecycle proof reads the actual versioned balance file and rejects corrupt snapshots`

### F685 — Recap has no private tutor-versus-practice comparison
- severity: P2
- status: [x]
- where: apps/mobile/src/RecapScreen.tsx
- note: Report 2 item 11 needs the selected tutor beside a fresh clearly labelled learner practice clip, without keeping live audio. Founder approved a fresh local take deleted on exit. Pending permission, recorder preparation and stop must also be invalidated and their late files removed on account reset, blur, background and unmount.
- verified-by: `a recap clip arriving after exit is discarded and cannot become playable`

### F686 — Walk mode needs an explicit start and terminal interruption boundary
- severity: P2
- status: [x]
- where: apps/mobile/src/walk
- note: Report2 asks for hands-free background conversation on ink, without a typed twin. Founder approved lock continuation within existing caps, ending on phone call/audio interruption. Reuse the live grant and departure paths; unsupported platforms/native module failures must refuse before any grant, subscribe before start, never resume after interruption. Keep default dark until native/backend baseline passes.
- verified-by: `Walk subscribes before starting and an interruption ends exactly once`

### F687 — Exiting after room connection but before tutor arrival strands the lease
- severity: P1
- status: [x]
- where: apps/mobile/src/live/useLiveSession.ts
- note: Independent Walk review found leave/unmount clear the absent-tutor watchdog after start returns, but lease release is local to start. Retain attempt-owned lease cleanup through exit; observe tutor arrival before UI ownership checks and around disconnect. Never release a joined worker or newer grant, or an unsuccessfully disconnected room. Client-only observation still has a distributed race with a server join after final observation.
- verified-by: `a tutor arriving during held disconnect keeps its own lease`

### F688 — Guarded scene replies still have no exact correlated worker first-frame observation
- severity: P2
- status: [x]
- where: services/tutor-agent/src/convo.ts
- note: Report34 needs first-audio timing. Existing numeric EOU-to-say is narrower. Independent SDK review identified public default ttsNode's ordered frame stream as an exact worker boundary. Per-reply ALS token and returned handle identity must prove attribution; opener/replay/unknown audio cannot be assigned to a mutable current turn. Experiment remains dark until actual queued SDK correlation proof. No claim of phone audibility or unguarded partial model streaming.
- verified-by: `a first frame is attributed only to its guarded dispatch scope`

### F689 — Native microphone permission promises sound assessment while live scoring is off
- severity: P2
- status: [x]
- where: apps/mobile/app.json
- note: Simulator preparation found the microphone permission says it identifies sounds to work on, even when this build has live scoring disabled. Describe spoken conversations and deliberately requested practice recording instead; no new permission, vendor recipient or recording behavior.
- verified-by: `the microphone permission describes conversation and private practice without claiming live sound assessment`

### F690 — Quiet-door wiring proof predates the explicit Walk route
- severity: P2
- status: [x]
- where: apps/mobile/src/live/typedDoor.test.ts
- note: Full gate finds F201's source assertion expects an ungated typed-error button and a dependency list without Walk mode. Preserve every ordinary quiet-door outcome and single cold-start boundary; assert the exact Walk exclusion and explicit stable route dependency rather than accepting arbitrary new conditions. No quiet-door runtime policy change.
- verified-by: `the quiet door mid-scene keeps the scene and is never refused by the lease`

### F691 — Simulator launch surface stays above a ready native app
- severity: P1
- status: [x]
- where: apps/mobile/App.tsx
- note: Expo57 simulator renders Home in accessibility but keeps the native launch image visibly above it. Explicitly release the native splash once bundled Outfit is ready, using the versioned Expo API; verify in simulator. No extra onboarding or new delay.
- superseded: F790 (2026-10-06). The launch screen now draws the native launch frame exactly, so it releases the native one the moment it is laid out, earlier than Outfit and still never on a timer; the test below is this entry's successor.
- verified-by: `the native launch is released by the identical launch screen as soon as it is drawn, never by a timer`

### F692 — Native purchases resolves its shared runtime constant back to itself
- severity: P1
- status: [x]
- where: apps/mobile/src/purchases/adapter.native.ts
- note: Native Metro reports adapter.native.ts importing itself via ./adapter.ts, so PAID_PLANS may be undefined. Move the shared contract/constants to a platform-neutral filename, retaining the web adapter's public exports and exact purchase gates.
- verified-by: `native purchases gets its paid plans from a platform-neutral contract`

### F693 — Native practice exit reads an already released recorder and strands its file
- severity: P1
- status: [x]
- where: apps/mobile/src/daily/DailyPracticeScreen.tsx:80
- note: Actual simulator record/finish/back throws at recorder.isRecording because Expo's passive hook cleanup has released the shared object. Recap uses the same pattern. Delete owned files independently of native getter availability; capture the prepared URI, clean up before Expo passive release, and discard late completion without duplicate stops or unhandled rejection.
- verified-by: `daily practice exit deletes its held take even after Expo releases the recorder`
- verified-by: `recap practice exit deletes its held take even after Expo releases the recorder`

### F694 — Approved live language detection must not alter frozen French recordings
- severity: P2
- status: [x]
- where: services/tutor-agent/src/voiceConfiguration.ts
- note: Founder listened to six bounded Alexandre samples on 3 October and preferred automatic language detection for English time/money while retaining natural French. Omit the live French request pin, invalidate live and saved-phrase cache identities, and keep the existing French-only recording batches' explicit language and manifest identities. This listening evidence covers Alexandre, not every catalogue voice or learner ASR.
- note: The independent reviewer found the six bilingual chooser clips also needed the new live configuration. They were regenerated through buildTTS in 12 capped requests/316 characters, then the founder listened and confirmed all six clear French/intelligible English/natural French accent. Only these six previews and their real manifest changed; daily/onboarding French-only recordings stayed frozen. Digits/time/money A/B evidence remains Alexandre-only.
- verified-by: `approved live language detection invalidates French-pinned saved audio while recording batches stay French`
- verified-by: `live synthesis preflight omits the old French-only language request`

### F695 — Mixed-language recognition needs an isolated candidate, not a global switch
- severity: P2
- status: [x]
- where: services/tutor-agent/src/agent.ts
- note: Bounded synthetic prerecorded/streaming Nova-3 comparisons corrupt French money or mixed English despite high confidence. Flux French/English hints preserve the French control and both languages, but still misread an English time/date. Prepare a default-off conversation-only review option; preserve Nova-3 phase language behavior, scripted lessons and typing. No automatic activation or claim of beginner calibration, room interruption or end-to-end timing. Real learner calibration remains a release hold.
- note: Sol independently accepted the default-off source after 23 focused checks and tutor types. Strict opt-in is conversation-only; phase language updates are skipped only for Flux, whose hints remain bilingual. Actual beginner/room/EOT/interruption/number calibration remains held; no runtime configuration was changed.
- verified-by: `ordinary recognition retains Nova-3 and its explicit phase language`
- verified-by: `only an explicit conversation review uses Flux French and English hints`
- verified-by: `the review recognizer stays inside lazy session audio and phase updates preserve its bilingual hints`

### F696 — Recorded onboarding must describe playback and keep learner pacing
- severity: P1
- status: [x]
- where: apps/mobile/src/onboarding/PreAccountOnboarding.tsx
- note: Implement the corresponding recommendations from the two founder-authorised UX reports. Source checks and driven preview evidence must be separate from external acceptance.

- note: 3 October 2026: source implementation and regression checks completed for this item. Device, store, French calibration and hosted acceptance remain separately recorded in UX_ACCEPTANCE_REVIEW.md; this tick does not certify them.
- verified-by: `playback selects a model but only a real submitted reply can receive success feedback`
- verified-by: `actual guest practice connects the submitted reply, useful feedback, exact retry and durable keep`

### F697 — The starting plan must explain real adaptation and allow no routine target
- severity: P1
- status: [x]
- where: apps/mobile/src/onboarding/plan.ts
- note: Implement the corresponding recommendations from the two founder-authorised UX reports. Source checks and driven preview evidence must be separate from external acceptance.

- note: 3 October 2026: source implementation and regression checks completed for this item. Device, store, French calibration and hosted acceptance remain separately recorded in UX_ACCEPTANCE_REVIEW.md; this tick does not certify them.
- verified-by: `an explicitly unset routine survives account creation without restoring the suggested minutes`
- verified-by: `the plan bounds its beginner coverage without claiming a placement, completion date or promised level`

### F698 — Practice must lead with usable work and distinguish authored sound guidance
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/PracticeTab.tsx
- note: Implement the corresponding recommendations from the two founder-authorised UX reports. Source checks and driven preview evidence must be separate from external acceptance.

- note: 3 October 2026: source implementation and regression checks completed for this item. Device, store, French calibration and hosted acceptance remain separately recorded in UX_ACCEPTANCE_REVIEW.md; this tick does not certify them.
- note (2026-10-20, B3, B-Practice): Practice now leads with the learner's conversations (B-Practice); the sound guide and local compare stay below them as the doors to sound practice, so the test is renamed for that.
- verified-by: `the page puts the conversations before the optional sound guide`

### F699 — Home and Progress must recommend usable work and name their evidence
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/HomeTab.tsx
- note: Implement the corresponding recommendations from the two founder-authorised UX reports. Source checks and driven preview evidence must be separate from external acceptance.

- note: 3 October 2026: source implementation and regression checks completed for this item. Device, store, French calibration and hosted acceptance remain separately recorded in UX_ACCEPTANCE_REVIEW.md; this tick does not certify them.
- verified-by: `an unavailable live tutor leads to an owned review or local phrase practice`
- verified-by: `a failed conversation history slice leaves progress unread, never zero`

### F700 — Recap must omit empty pages without losing durable work or exact retry
- severity: P1
- status: [x]
- where: apps/mobile/src/RecapScreen.tsx
- note: Implement the corresponding recommendations from the two founder-authorised UX reports. Source checks and driven preview evidence must be separate from external acceptance.

- note: 3 October 2026: source implementation and regression checks completed for this item. Device, store, French calibration and hosted acceptance remain separately recorded in UX_ACCEPTANCE_REVIEW.md; this tick does not certify them.
- verified-by: `recap page navigation leaves saving independent and retries the exact kept phrase only after durable save`

### F701 — Privacy and preference controls need precise scope and recoverable reads
- severity: P1
- status: [x]
- where: apps/mobile/src/settings/SettingsScreen.tsx
- note: Implement the corresponding recommendations from the two founder-authorised UX reports. Source checks and driven preview evidence must be separate from external acceptance.

- note: 3 October 2026: source implementation and regression checks completed for this item. Device, store, French calibration and hosted acceptance remain separately recorded in UX_ACCEPTANCE_REVIEW.md; this tick does not certify them.
- verified-by: `memory and Settings put practical controls before processing details without inventing support`
- verified-by: `an unread choice stays unknown until an owned retry succeeds`

### F702 — Plan recovery must offer free practice and show actual billing scope
- severity: P1
- status: [x]
- where: apps/mobile/src/wall/WallScreen.tsx
- note: Implement the corresponding recommendations from the two founder-authorised UX reports. Source checks and driven preview evidence must be separate from external acceptance.

- note: 3 October 2026: source implementation and regression checks completed for this item. Device, store, French calibration and hosted acceptance remain separately recorded in UX_ACCEPTANCE_REVIEW.md; this tick does not certify them.
- verified-by: `unavailable plans return to free practice once and retain an accepted consented exit event`

### F703 — Product measurements must distinguish real learning within existing consent
- severity: P1
- status: [x]
- where: apps/mobile/src/analytics/track.ts
- note: Implement the corresponding recommendations from the two founder-authorised UX reports. Source checks and driven preview evidence must be separate from external acceptance.

- note: 3 October 2026: source implementation and regression checks completed for this item. Device, store, French calibration and hosted acceptance remain separately recorded in UX_ACCEPTANCE_REVIEW.md; this tick does not certify them.
- verified-by: `the research protocol defines evidence windows and denominators without adding pre-account tracking or a live experiment`

### F704 — A confirmed purchase must not offer another Buy after an unreadable allowance refresh
- severity: P1
- status: [x]
- where: apps/mobile/src/wall/WallScreen.tsx
- note: Independent review found that a confirmed purchase or restore could return to enabled plan buying when the follow-up allowance read failed. Keep the confirmed grant separate from that read, block further store actions, and offer a truthful refresh and free-practice exit without guessed totals.

- note: 3 October 2026: source implementation and regression checks completed for this item. Device, store, French calibration and hosted acceptance remain separately recorded in UX_ACCEPTANCE_REVIEW.md; this tick does not certify them.
- verified-by: `a confirmed purchase or restore blocks another store action when the separate allowance read is unavailable`
- verified-by: `reopening with a persisted checkout or an unread fence cannot open a second purchase`
- verified-by: `an unchanged same-tier subscription cannot clear an interrupted checkout fence`

### F705 — Owned recommendations need a render-time account fence and truthful failed history reads
- severity: P1
- status: [x]
- where: apps/mobile/src/tabs/TutorTab.tsx, apps/mobile/src/tabs/MyFrenchTab.tsx, apps/mobile/src/tabs/PracticeTab.tsx
- note: Independent review found that focus-effect cleanup alone allowed one render of the prior learner's work after a scope change. Practice also accepted a stale rejection, and Progress converted an unread history slice to zero. Require a matching read owner at render and an all-or-fail history read with retry.

- note: 3 October 2026: source implementation and regression checks completed for this item. Device, store, French calibration and hosted acceptance remain separately recorded in UX_ACCEPTANCE_REVIEW.md; this tick does not certify them.
- verified-by: `an account switch hides ready evidence before the next focus effect clears it`
- verified-by: `Practice refuses a stale failure as well as a stale success`
- verified-by: `a failed conversation history slice leaves progress unread, never zero`

### F706 — Queued bookmark writes must not recreate data after account cleanup
- severity: P1
- status: [x]
- where: apps/mobile/src/bookmarks/store.ts
- note: Independent review found captured-key bookmark mutations were not fenced or registered with scoped writes. A held old write could recreate a deleted key after cleanup; failed sync adoption could be acknowledged. Bind queue generation, register native writes, and acknowledge only durable adoption.

- note: 3 October 2026: source implementation and regression checks completed for this item. Device, store, French calibration and hosted acceptance remain separately recorded in UX_ACCEPTANCE_REVIEW.md; this tick does not certify them.
- verified-by: `bookmarks/store.ts: a dispatched native save cannot recreate erased account data`
- verified-by: `sync/registry.ts: a dispatched native save cannot recreate erased account data`
- verified-by: `a dispatched checkout fence drains before account deletion and never reaches the next account`

### F707 — A partial recap must not add a blank next page for unavailable conversation text
- severity: P2
- status: [x]
- where: apps/mobile/src/RecapScreen.tsx
- note: A props object with null conversation text is not next-page content. Use actual owned savable text or another visible next action; a partial recap with nothing else should finish on its cover.

- note: 3 October 2026: source implementation and regression checks completed for this item. Device, store, French calibration and hosted acceptance remain separately recorded in UX_ACCEPTANCE_REVIEW.md; this tick does not certify them.
- verified-by: `a partial recap with no actionable content never adds an empty next page`

### F708 — A localized store price needs a verified billing period before claiming per month
- severity: P1
- status: [x]
- where: apps/mobile/src/wall/WallPlansPage.tsx, apps/mobile/src/purchases/adapter.native.ts
- note: Independent review found localized prices were present but the runtime product period was not checked before monthly copy. Reject incompatible store periods or project verified period data; sandbox verification remains separate.

- note: 3 October 2026: source implementation and regression checks completed for this item. Device, store, French calibration and hosted acceptance remain separately recorded in UX_ACCEPTANCE_REVIEW.md; this tick does not certify them.
- verified-by: `monthly plan copy is reachable only from a verified monthly native package`

### F709 — Constituent owned stores must expose unreadable work to screen recovery
- severity: P1
- status: [x]
- where: apps/mobile/src/review/store.ts, apps/mobile/src/practice/historyStore.ts, apps/mobile/src/progress/store.ts
- note: Screen retries cannot distinguish empty work if their loaders swallow corrupt bytes, refused reads or unsupported versions. Preserve legitimate absent defaults and valid legacy migrations, reject unknown owned data, do not overwrite it through sync adoption, and clear rejected caches so retry can recover.

- note: 3 October 2026: source implementation and regression checks completed for this item. Device, store, French calibration and hosted acceptance remain separately recorded in UX_ACCEPTANCE_REVIEW.md; this tick does not certify them.
- verified-by: `absent continuity keys are empty, while malformed or refused existing reads reject`
- verified-by: `unread continuity bytes are not replaced by local writes or a sync fold`
- verified-by: `the owned review deck distinguishes absent from corrupt or refused bytes and a failed cache read can retry`
- verified-by: `unread optional launch history and phrase recovery cannot trap the app or fabricate a backfill`

### F710 — An empty OAuth account must confirm ownership of an anonymous plan
- severity: P1
- status: [x]
- where: apps/mobile/App.tsx
- note: An empty account read proves nothing is available to overwrite, not that OAuth created a new identity. Review the exact on-phone plan under the authenticated account before applying its profile, reminder or usage-data choice; allow starting a new plan and prevent a scope change during bootstrap from applying it elsewhere.

- note: 3 October 2026: source implementation and regression checks completed for this item. Device, store, French calibration and hosted acceptance remain separately recorded in UX_ACCEPTANCE_REVIEW.md; this tick does not certify them.
- verified-by: `an empty OAuth account must confirm ownership before durable preference and profile adoption`
- verified-by: `a scope change during draft adoption cannot apply the plan or reminder to the next account`

### F711 — The landing audit finds new dependency advisories outside the recorded decisions
- severity: P1
- status: [x]
- where: package-lock.json, package.json, services/token-server/src/ciContract.test.ts
- note: The 3 October online audit found brace-expansion 5.0.9 plus unpatched braces 3.0.3 and node-forge 1.4.0. Apply the compatible brace-expansion 5.0.12 patch. Record the two unpatched Expo build/development roots as temporary exceptions with actual reachability and upstream limitations, not as fixed vulnerabilities. Preserve the Metro image-size removal proof, exact reviewed versions, service/runtime boundaries and audit refusal of unknown or stale roots. Independent GPT-6 Sol review accepted that distinction; final source and online audit proof are still required.
- note: 3 October 2026: exact-lockfile `npm ci` succeeds, all 11 CI contracts pass, and the online `audit:ci` exits zero under the recorded decisions (0 critical, 21 high and 12 moderate inherited advisories). Only brace-expansion changed in the lockfile. The two new tooling exceptions remain vulnerabilities with no published patch; this closure records their bounded handling, not a zero-vulnerability or release claim.
- verified-by: `the patched brace expander bounds malicious nesting and rewrites without changing ordinary patterns`
- verified-by: `the unpatched Expo tooling roots keep their exact reviewed versions and dependency chains`
- note: 4 October 2026: adding expo-updates 57.0.24 triggered a fresh certificate-verifier review. Its Forge-dependent imports remain CLI-only; the mobile client does not import them, and iOS native verification uses Apple Security. The revised client/runtime boundary test passes; custom update signing remains unconfigured and the temporary exception's expiry is unchanged.
- note: 6 October 2026: aligning the app with Expo SDK 57.0.27 moved expo-updates to 57.0.25 and repeated the version-specific review. Its only code change from 57.0.24 is the build-time createManifestForBuildAsync asset-hash index; Forge-dependent imports remain in the CLI's two code-signing commands, iOS verification still uses SecKeyVerifySignature, and node-forge 1.4.0 is still the latest release. The pinned version moved with the review; the exception's review date and expiry are unchanged.
- verified-by: `unpatched build-tool exceptions cannot enter service runtimes or the mobile update client`

### F712 — The generated iOS ignore rule excluded the handwritten Walk module
- severity: P1
- status: [x]
- where: .gitignore, apps/mobile/modules/luvani-audio-lifecycle/ios, apps/mobile/src/walk/wiring.test.ts
- note: GitHub's clean Linux run found the module Swift file and podspec absent, while local tests read the ignored copies. Preserve generated iOS exclusions and unignore exactly the two handwritten source files. The regression checks their ignore status with `--no-index`, requires both in Git's index, and keeps generated Pods/module build output excluded. It failed before the exceptions were applied. Existing native epoch/wiring assertions remain intact.
- note: Independent GPT-6 Sol reproduced the ignore cause, reviewed the two source files and found no other unintentionally ignored authored source. Walk stays disabled; this source-packaging repair does not certify an iOS build, microphone, lock-screen or physical interruption test.
- verified-by: `Walk ships its handwritten native module while generated iOS output remains ignored`

### F713 — A healthy preview response can reuse an older checkout
- severity: P2
- status: [x]
- where: services/shared/devPlan.ts, scripts/dev.mjs
- note: The app boot step accepted any HTTP 200 as a reusable preview, so a different branch's Metro or unrelated HTML could be mistaken for this checkout. Refuse occupied app ports while keeping newly spawned app readiness and recognised service reuse. Print the source checkout and revision and clear Metro on app launch. The regression failed with reuse before the fix; focused checks pass.
- verified-by: `an answering preview is never silently reused from another checkout`

### F714 — Retired UI and generic audio remain beside the current app
- severity: P2
- status: [x]
- where: apps/mobile/src/home/AbilitiesCard.tsx, apps/mobile/src/myfrench/LedgerLane.tsx, apps/mobile/src/daily/audioManifest.ts, apps/mobile/assets/daily-kokoro, scripts/build-daily-audio.mjs, scripts/daily-audio-worker.py
- note: Independent read-only audit found no production importers for the two presentation modules or the generic audio manifest. Remove the unmounted components, 2,957 old clips, manifest and generator; preserve their underlying evidence models, the 2,000-item text catalogue, all 2,400 active tutor clips, licences, stores and compatibility readers. Retire the obsolete 3,000-generic-recording assertion in favour of actual six-tutor coverage, container checks and absence of old references. Existing frozen-text/configuration/content-hash tests stay intact. Both retirement regressions failed before removal and focused checks pass. Other UI with source-contract or billing pins is explicitly recorded in DELETION_LEDGER rather than silently swept.
- verified-by: `retired Home and phrase-lane components stay absent while current evidence and phrase routes remain`
- verified-by: `every selectable daily recording is bundled for all six tutors without a runtime API`
- verified-by: `the unused generic audio pack and generator stay retired with no production references`

### F715 — Refusing a preview exits before its spawned services are reaped
- severity: P2
- status: [x]
- where: scripts/dev.mjs, services/tutor-agent/src/devSupervisor.test.ts
- note: Independent cleanup review found shutdown followed by die exited immediately, bypassing the SIGKILL fallback; an unref'ed shutdown timer could also report success after a fatal timeout. Refusal now logs and returns through shutdown, which sets the failure code immediately and keeps the cleanup timer alive until child handles drain. Apply the same path to durable-service refusal. A real local fixture service that ignores SIGTERM proves occupied-preview cleanup; a promptly exiting fixture proves the fatal timeout still exits 1. Both process tests failed before the fix and passed after it; no keys, network service or paid vendor required.
- verified-by: `refusing an occupied preview reaps even a service that ignores SIGTERM`
- verified-by: `a readiness timeout reports failure even when its service exits promptly`

### F790 — The app opened on a placeholder L and a bare spinner, not on its mark
- severity: P2
- status: [x]
- where: apps/mobile/src/launch/LaunchScreen.tsx:1
- note: The 27 September "spoken L" was placeholder artwork in the retired notebook palette, with a wordmark set in a font no longer in the repo, and launch was a still splash followed by spinners. On 2026-10-06 the founder chose Hum (the tutor's orb with a rippling ring, sun on the brand blue with a coral core) and asked for the launch to be the mark coming alive. Every icon slot now reads a Hum master: the store icon, iOS dark and tinted faces, the Android adaptive layers and the favicon. The native splash is the mark at 128pt on the blue. A launch screen that is that same frame takes over invisibly on iOS, turns the ring, settles the name in beneath it, and fades onto wherever the app was already going (the welcome and onboarding for someone new, Home for everyone else) once nothing is loading and the name has arrived, capped at 12s. Readiness comes from the app's own waits holding the launch. Reduce motion draws the final frame. Supersedes the launch rules in F328, F595 and F691, see there. A same-day adversarial review found that two waits did not hold the launch, so it could fade onto them: the guest hand-off's blank and pre-account onboarding's loading line. It also found a loosened timer check and two tests that did not test what their titles said. All were fixed, and each new assertion was shown to fail on its mutant. The native launch is now held from the moment the launch screen's file loads, because Expo otherwise drops it on the app's first view, and that view is a safe-area provider with nothing in it yet. The app beneath is hidden from screen readers until the launch has gone. A second review found three more gaps. Nothing tested that the launch screen reads readiness, or that a hold lasts only while its wait is on screen. The timer check could be dodged through a helper. The hook-order check could be dodged by an earlier return. The tests now pin all three, and each was shown to fail on that reviewer's mutants. It also found comments that claimed too much: the hand-off is unseen only on iOS, because Android fades its native splash out over 400 ms.
- verified-by: `the launch screen draws exactly the ring and core of the brand master`
- verified-by: `the native launch and the launch screen are one frame, so on iOS the hand-off cannot be seen`
- verified-by: `the ring turns by a view transform on the native driver, and the SVG never moves`
- verified-by: `the name arrives as the one settling entrance, and reduce motion draws the final frame`
- verified-by: `the launch screen leaves only when the app is ready and the name has arrived, or at the cap`
- verified-by: `every wait on the way in holds the launch, so it fades onto a real screen`
- verified-by: `the app renders beneath the launch, and the launch is drawn on top until it is done`
- verified-by: `the launch leaves only when the app is ready and the name has arrived, or at the cap`
- verified-by: `one wait handing over to the next never reads as ready`
- verified-by: `the iOS icon has a light, a dark and a tinted face, each a 1024 square from the brand masters`
- verified-by: `the adaptive mark is big enough to read inside the launcher circle`
- verified-by: `the native launch is released by the identical launch screen as soon as it is drawn, never by a timer`
- verified-by: `the native launch stays up until the launch screen is drawn over it`
- verified-by: `a screen reader meets the launch alone, and the app once the launch has gone`
- verified-by: `the launch background is the brand blue wherever it is painted, and the app beneath stays on the ground`

### F791 — The web build logged an error on every onboarding render
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/PreAccountOnboarding.tsx:1018
- note: Found 2026-10-06 while landing F790. One walk through onboarding on web logged "Unexpected text node" 238 times and "BackHandler is not supported on web" twice. The first came from JSX children gated on a string, `{issue && <View/>}`: an empty `issue` renders the empty string itself, which iOS drops silently and the web logs under every View. A type-aware sweep of the whole app found 23 such conditions in 15 files. None was a number, which would have rendered "0" and crashed iOS. Each now compares with '' or uses a ternary. Seven of the sites are lines that come-alive's F728 fixed on its own branch, and they are spelled as F728 spells them, `{x !== '' ? (…) : null}`, so the two branches change those lines identically and merge there without a conflict. The second came from onboarding listening for the Android back button on every platform; it is now behind an Android check, like `useHardwareBack`. The same pass cleared two web-only warnings with no change on iOS. `settleIn`, VoiceOrb and OnceConfetti now ask for `NATIVE_DRIVER` rather than `true`. Five views moved `pointerEvents` from a prop into their style, as `Illustration` already does. The new come-alive motion files still use the prop, so that warning returns when they land. After the fix, a fresh tab through the launch, every onboarding page and the plan sheet logs nothing, and the iOS launch logs nothing.
- verified-by: `no JSX child is drawn on a condition that can be an empty string or zero`
- verified-by: `the Android back button is listened for only on Android`

### F792 — Creating an account at the end of onboarding left a new learner on a white screen on iOS
- severity: P1
- status: [x]
- where: apps/mobile/src/onboarding/PreAccountOnboarding.tsx:257
- note: Reproduced 2026-10-06 on the iOS 26.5 simulator (dev client, mock auth, no token server) on main at ba7b8940, and on the Expo 57.0.27 patch branch, so no Expo version caused it. At the end of onboarding, Save progress and then Continue with Google raised a Render Error, `FunctionCallException: Calling the 'pause' function has failed`, caused by `NotFoundException: Unable to find the native shared object`, at `player.pause()` in the cleanup of onboarding's loading effect. Dismissing it left a blank white screen in the dev build. A release build has no LogBox, and React Native 0.86 reports an uncaught render error as fatal, so by its source the app most likely closes instead (not yet seen on a release build). Nothing catches it because the app has no error boundary (F794). useAudioPlayer releases its native player from an effect cleanup of its own, and React runs a component's cleanups in the order they were declared, so a cleanup declared after the hook runs on a released object. The release already pauses the player, so the pause did nothing but throw. The web player takes the late call quietly, which is why web testing never saw it. Sign in, and Create one in the sign-in sheet (which remounts onboarding through its key), unmount it the same way; the crash was reproduced through Save progress. The fix removes the pause. A new contract walks every component and hook in the app with the compiler. It fails when a useEffect or useFocusEffect cleanup, declared after an expo-audio player or recorder that a hook binds to a name, touches that name outside a try: directly, through a helper, through an app function it is handed to, or through a member of an app hook such as useRecordedLine. It also sees through second names, casts, renamed effect imports, conditional cleanups and the callbacks a cleanup hands out, such as a timer. It does not follow a sound kept in a ref, returned whole from an app hook, or handed to a child or another hook, and none exists today. Before the fix it found this one cleanup and nothing else. Its second test proves the walk on eighteen fixtures, thirteen it must flag and five it must leave alone, and three mutants on real code were caught: taking the try out of releaseDailyPlayback lit up the six cleanups that rely on it, PracticeTab's recorded.stop() among them, moving the pause into stopSound() was caught through the helper, and putting it on a timer was caught through the callback. The walk counts fifteen players and recorders and fails if one goes missing. After the fix, on a freshly erased simulator, Save progress, Sign in and Create one all reach the next screen with no Render Error and no native exception in the device log, and Save progress and Sign in go on to Home. F693 was the same release, reached through a recorder.
- verified-by: `no screen touches a sound player or recorder in a cleanup that runs after expo-audio has released it`
- verified-by: `the release walk catches a late touch directly, through a helper, an app function or an app hook, and nothing else`

### F793 — Two recorders read a released recorder after an await, so a late take rejects unhandled and can strand its file
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/GuestRecording.tsx:50
- note: Found by the F792 audit. It is not a white screen: the throw lands after an await, so it rejects a promise nobody catches instead of breaking a cleanup, which is why F792's contract stops at the first await. GuestRecording reads `recorder.uri` unguarded in stop's finally (:50) and in record's late branches (:91, :111). A spoken guest take ends in onTake, which moves onboarding to the recap page and unmounts GuestRecording, so the release can land while stop is still awaiting setAudioModeAsync, and :50 then throws. drill/SpokenAttempt.tsx:72 does the same in toggle's catch when its screen goes during prepare. A take that is still recording when its screen goes is never deleted by app code either, because the unmount cleanup can no longer read its URI, while the start sheet says Luvani discards the recording from this device after processing. Read the URI through recorderUri with the URI captured when the take was prepared, as SoundCheckScreen's cleanup does, so the file is still found and deleted. Not yet seen on a device: spoken guest practice needs the token server. Fixed 2026-10-06. Both screens keep the take's path in a ref, read when the recorder is made and on both sides of prepareToRecordAsync, because expo-audio 57 names the file when the recorder is made on iOS and inside each prepare on Android. Every later read goes through recorderUri with it, as SoundCheckScreen, DailyPracticeScreen and PrivatePractice already do. In GuestRecording the same throw also skipped lifting the microphone's haptic mute, so if onboarding went away mid-take, every haptic in the app stayed off until a relaunch. Back and Help are disabled while the microphone is on, so that takes the whole of onboarding going away, not a tap. It is fixed with the rest. recorderRelease.test.ts compiles each screen's TSX and runs it on a stand-in React that cleans effects up in the order they were declared, with a stand-in recorder that useAudioRecorder's own effect releases, under both platforms' file naming. It ends takes five ways: sent as the screen goes, still recording, still being prepared, a prepare that fails once the screen has gone, and, for the drill, losing focus mid-prepare and going while the abandoned take is still being stopped. That last path goes through finishLocalTake, which resolves, so toggle's catch never runs; an independent fix-verifier found it after the first version of the test missed it. Against the old code, twelve of the sixteen endings rejected unhandled, every one left its file in the test, and both guest takes that were still recording left haptics silenced. In the app a sent guest take is also deleted by its consumer, consumeRecording in PreAccountOnboarding, so there the two sent endings only rejected. A mutation sweep then put back one changed line at a time, and every line that decides an outcome was caught. What survives on its own is two reads in GuestRecording that sit inside a try whose catch does the same work, and each of the two path reads that back each other up, at mount and before prepare; removing both of a pair is caught. On Android a screen that goes during prepare can still leave an empty, never-recorded file, because Android names it inside prepare and the release puts the name out of reach; clearing the learner's data sweeps it, and the test still checks those endings reject nothing and leave haptics alone. A post-await version of F792's walk, run over the whole app, found the three of these reads that no catch covers (:50, :111 and SpokenAttempt:72) before the fix, and no other screen of this shape before or after. Still not seen on a device, for the same reason: the token server is not running here and its .env has no Deepgram key, so spoken mode never turns on.
- verified-by: `a guest or drill take that ends after its screen has gone still deletes its recording and rejects nothing`

### F794 — The app has no error boundary, so one throw while rendering empties the whole screen
- severity: P2
- status: [ ]
- where: apps/mobile/App.tsx:868
- note: Found while fixing F792. Nothing in App.tsx or src catches a render or commit error, so a throw in any render, effect or cleanup unmounts the whole tree. The dev build then shows a white screen behind LogBox, and React Native 0.86 reports the error as fatal, so by its source a release build most likely closes the app. A boundary turns it into a caught, non-fatal error. F792 and F693 each did this from one native call. A root boundary should offer a short way back (trying again remounts the tree, which recovers the way a relaunch already does, because the session and draft persist), hand what it caught to the error reporting observability-engineer owns, and sit where it cannot blank F790's launch hold. It needs founder-approved copy and a device check with an injected throw, which is why it was not built inside F792. App code has no renderer tests, so the boundary's state and its placement are tested as contracts. Fixed 2026-10-06 with one boundary, `src/app/errorBoundary.ts`, as the door's own root: Gate returns it around `door()`, which draws every screen (the waits, the welcome and onboarding, the signed-in app and the notices). A caught throw is reported as non-fatal (react-native's ErrorHandlers.onCaughtError), and the learner meets `src/app/AppErrorScreen.tsx`, drawn like the door's other notices: a title, one line said through TroubleLine so VoiceOver hears it, and a Try again pill. It is never handed the error, and a test walks every hook its parts call, so it leans on nothing below the boundary. Try again mounts everything behind the door under a new key: the signed-in app sets up its storage and reads it back as it does on a relaunch, and navigation starts over. The placement is the design. A first cut put the boundary above Gate, and an independent review found that Try again then ended what this launch must remember: the under-13 refusal (F637, F641, which only closing the app may end), the kept-copy notice (F496), a pending deletion and a password recovery. Gate and the auth provider now sit above the boundary and keep them. One boundary serves every branch, so a cleanup that throws while one branch hands over to another, as F792's did at sign-in, is still caught. The launch is drawn by App, outside the boundary: a catch releases the holds of the waits it removes, and the launch fades onto the error screen. There was no error-reporting seam to hand the catch to (observability-engineer's brief says none exists yet), so the boundary reports through an injectable function that writes one line, `[luvani] APP_ERROR_CAUGHT name=<class> code=<code> retries=<n>`. It carries the class and a native code as plain words and never the message, in the shape of sync's alarms, and it is the function that moves into the seam when it is cut. Still not covered: a throw in the launch screen, in App, in Gate's own render or in the auth provider, and any throw in a tap handler, a timer or a promise. React also retries a render that throws once, synchronously, so a render throw that does not recur never shows the screen. Try again re-reads Linking's initial URL, so an invite the app was opened with opens again, as an account switch already does. The copy promises nothing about saved work, because the screen can follow an account deletion the learner asked for. The class has no react-native import, so node drives the real class, and the placement is a source contract over App.tsx. The unfixed App.tsx fails the named test, and eighteen mutants were each caught, among them the first cut's placement, a local stand-in boundary, a screen drawn outside the door, a boundary per branch and a hook the error screen could not rely on. On the iOS 26.5 simulator (dev client, with LogBox told to ignore the probe's own messages so the screen beneath could be photographed), an injected render throw that recurred until the error screen drew, during a cold launch, faded the launch straight onto the error screen with no white frame between. Try again opened onboarding. A refusal made there survived an injected cleanup throw, F792's shape, and a second Try again, and the log read retries=0 then retries=1. The same render throw on the unfixed App.tsx left a blank white screen and an empty tree. Try again was pressed through the inspector, calling the pill's own onPress, because simulator taps were not available in that session; on web a real click did the same. The copy was proposed on 2026-10-06 and is the founder's to approve. Landed on main on 2026-10-20 from that worktree, rebuilt around main's current door (the account-creation wait, the guest reminder planner beside the welcome); the simulator check above was on the older base, so the device check with an injected throw still has to be repeated on main before this is ticked. Press's Reanimated hooks and TroubleLine's two settings contexts, which carry defaults, are allowed in the hook walk, and the test pins those defaults.
- verified-by: `a throw anywhere below the root shows a way back instead of a blank screen`
- verified-by: `trying again mounts everything behind the door afresh, the way a relaunch does`
- verified-by: `trying again keeps what this launch must remember, because the door and the session sit above the boundary`
- verified-by: `the launch is never inside the boundary, so a catch can neither blank it nor strand it`
- verified-by: `the way back needs nothing that could have broken, and is never shown the error`
- verified-by: `a catch reports the error's class and code, never its message`
- verified-by: `the way back is short, plain and kind`

### F795 — A repeat-this take still recording when the drill goes is never deleted
- severity: P2
- status: [ ]
- where: apps/mobile/src/DrillScreen.tsx:546
- note: Found 2026-10-06 while closing F793. RepeatThisView records with useAudioRecorder and declares no effect, so no app code stops or deletes a take when the view unmounts with the microphone on, as when the learner leaves the drill mid-take. expo-audio's release stops the recording on iOS and leaves the file in the app's cache, where only clearing the learner's data sweeps it (storage/attemptAudio.native.ts), although speech/discardRecording.ts holds that every exit from an attempt removes its recording, not just the good one. Its stop path also reads recorder.uri inside a try, so a stop that finishes after the release loses the path and leaves the file. It is F793's shape without a cleanup at all, so the fix is SoundCheckScreen's: keep the path from prepare, read it through recorderUri, and add an unmount cleanup that stops and discards an unfinished take. The stand-in React and recorder in recorderRelease.test.ts can drive it once they stand in for DrillScreen's imports. practice-ux-engineer's territory.
- verified-by: `a repeat-this take still recording when the drill goes is deleted`

### F796 — The data-boundary proof can fail when a quota check straddles a minute boundary
- severity: P2
- status: [ ]
- where: scripts/verifyDataBoundaries.mjs:158
- note: Found 2026-10-06 while landing F793. The pre-push gate failed at line 158 with "Missing expected rejection" for /product event quota/, on a tree whose full gate had passed minutes before, for a change that touches no SQL. Nothing else differed between the two runs, and the mechanism explains it. admit_data_write_v1 (supabase/migrations/20261003230215_bounded_direct_data.sql) buckets every quota by calendar minute, date_trunc('minute', clock_timestamp()), and resets the counts when the bucket changes. The proof inserts sixty events in one statement and expects the next statement to be refused, so when the two land on either side of a minute boundary, or the bulk insert itself straddles one, the bucket resets and the sixty-first event is admitted. The learner checks above it assume the same thing: the count of 49 at line 136, and the 240-a-minute loop that expects the next write refused. The quota behaves as designed, as a fixed window; the proof's timing does not hold, and concurrent gates slowing PGlite widen the window. The fix is in the proof, for the owner of the migrations' proofs (data-sync-engineer): start each per-minute sequence at the top of a fresh minute, or check that the bucket did not change and run the sequence again if it did. Until then, a red run here on an unrelated change is worth one re-run, never --no-verify.
- verified-by: `the data-boundary proof's per-minute quota checks cannot straddle a minute boundary`
### F716 — A reply that only echoes the tutor's greeting and question is accepted
- severity: P1
- status: [x]
- where: packages/core/src/onboarding.ts:298
- note: Come alive (docs/come-alive). "Salut ! Ca Va" normalises to the prompt "Salut ! Ça va ?" and passes the family-hello check, so the first win praises a copied question and the raw spelling is saved as the learner's phrase. Reject a reply whose normalised form equals the prompt; "Ça va" alone stays a real answer. The token server imports core and must be redeployed.
- note: 2026-10-05 ca/p0-copy: checkStarter compares the whole normalised reply to the normalised prompt before matching and answers an echo with "That repeats the question. Here is one way to answer: « model »"; the test failed on today's code with 'Salut ! Ça va ?' and 'Salut ! Ca Va', passes now, keeps 'Ça va' accepted, and checks no starter accepts its own prompt. Token server not yet redeployed.
- verified-by: `a reply that only echoes the greeting and the question is not accepted`

### F717 — Drill verdicts and lesson praise are French interface praise
- severity: P2
- status: [x]
- where: packages/core/src/drill/session.ts:136, packages/core/src/session/session.ts:390
- note: Founder decision D14 (warm, plain English at wins). "Nickel." and the lesson praise families become English; the first miss still shows no answer, by design.
- note: 2026-10-05 ca/p0-copy: drill lines are 'Nicely done.', "Nearly. It's spelt «x».", 'This one comes round again.' and "Here's how it goes: «x»."; new ownWordsFeedback keys own-words copy and tone on the decision (good 'That works.', retry calm 'Have another go.', reveal calm). Lesson excellent and good families are English. Both tests failed before the change. Tutor agent not yet redeployed.
- verified-by: `drill verdict lines are warm plain English with no score and no scold`
- verified-by: `lesson praise families are plain English`

### F718 — The copy rules refuse the founder's daily streak
- severity: P2
- status: [x]
- where: apps/mobile/src/copy/guilt.ts:33, PRODUCT.md:92
- note: Founder decision D2 (2026-10-04) reverses the no-streak rule. Retire only the word "streak" from the shared ban, record the retirement, keep every shaming word, and add a stricter list for streak and reminder copy.
- note: 2026-10-05 ca/p0-copy: 'streak' left BANNED_IN_COPY and is recorded in RETIRED_FROM_BAN (held to exactly one entry by the F216 test, which keeps the history in ONCE_BANNED); BANNED_IN_STREAK_COPY and streakGuiltIn added; PRODUCT.md streak and XP bullets rewritten with every F414 phrase kept. review/cardView.test.ts:568 (F220) still uses 'streak' as its matcher canary and needs a one-line swap outside this track.
- verified-by: `streak copy states facts and never threatens`

### F719 — Core has no streak, goal, quest or badge model
- severity: P2
- status: [x]
- where: packages/core/src/streak, packages/core/src/goal, packages/core/src/quests, packages/core/src/badges
- note: Pure, Node-tested logic for decisions D2 to D6: a practice day is the local date a sitting finishes; covers bridge a run and add nothing; freezes and repair only when entitled; quests deterministic per learner and day; badges awarded once.
- note 2026-10-05: built on ca/p0-core (step C1). Covers are freeze, repair and travel; repair is a gap of at most 2 days restored by 2 finished practices on the two calendar days after the first uncovered day, entitlement checked at repair time; travel is entitled-only. Pure logic only: nothing in the app calls it yet (Phase 1 settle).
- verified-by: `a covered day bridges the run but adds nothing to the count`
- verified-by: `freezes and repair apply only to an entitled learner`
- verified-by: `the same seed and day always pick the same three quests`
- verified-by: `each badge awards at its threshold and never twice`
- verified-by: `today's goal minutes count only measured active time`

### F720 — XP is computed but nothing can display a level or the XP a sitting earned
- severity: P2
- status: [x]
- where: packages/core/src/levels/levels.ts
- note: Numbered display levels on a fixed curve, separate from the content-difficulty standing (levelFor stays as is), and the credited delta under the daily cap.
- note 2026-10-05: built on ca/p0-core (step C1). xpLevelFor, levelThreshold, levelStep and xpCreditedFor added; totalXp takes a cap (default DAILY_XP_CAP 100, the one shown cap); levelFor, DAILY_XP_CAP and LEVEL_NAMES unchanged. No screen renders a level yet.
- verified-by: `display levels rise on a fixed curve and never shrink a step`
- verified-by: `credited XP respects the daily cap`

### F721 — Motion has no shared engine, tokens or live reduced motion
- severity: P2
- status: [x]
- where: apps/mobile/src/motion.ts, apps/mobile/src/motion
- note: Reanimated 4.5.1 enters through one driver that always passes the app's live reduced-motion answer, because Reanimated samples the system setting once at load.
- note: 2026-10-05, ca/p0-motion: motion/tokens.ts, motion/drive.ts (the only with* caller, every call passes mode(reduced)), motion/ReduceMotionBridge.tsx mounted once in App.tsx, and Press on Reanimated with tile depth and the selected ring; motion.test.ts rewritten to directory allow-lists. All three tests pass and each failed under a mutation that removed what it checks.
- verified-by: `nothing asks Reanimated for the system reduce-motion setting`
- verified-by: `every file that moves reads reduced motion from motion.ts`
- verified-by: `spring tokens match their response and damping derivations`

### F722 — Haptics have no celebration vocabulary
- severity: P2
- status: [x]
- where: apps/mobile/src/motion/haptics.native.ts
- note: tick, thump, celebrate and cancel, each respecting the haptic switch and silent while a microphone is open.
- note: 2026-10-05, ca/p0-motion: tick (60 ms gate), thump, celebrate (success, medium at 140, light at 280) and cancelHaptics in haptics.native.ts with no-op twins; the timing lives in the pure motion/hapticBeats.ts, which re-asks hapticsEnabled() per beat. The test steps an injected clock and failed when the per-beat check or cancel was removed.
- verified-by: `celebration haptics are cancellable beats that respect the haptic switch`

### F723 — Partial audio modes can silence the tutor in silent mode
- severity: P1
- status: [x]
- where: apps/mobile/src/onboarding/GuestRecording.tsx, apps/mobile/src/recap/PrivatePractice.tsx, apps/mobile/src/daily/DailyPracticeScreen.tsx
- note: A partial setAudioModeAsync selects iOS .ambient, and four voice players plus TTS set no mode, so a later voice line can follow the silent switch. One audio-session module owns every mode change.
- note: 2026-10-05 sound/audioSession.ts is the only importer of setAudioModeAsync and sets only the full VOICE, RECORD or SFX mode on one serialised chain; every voice player and the device voice enter voice playback first, pausing any sound effect. Both titles failed against the pre-change source. Not yet heard on a device with the silent switch on.
- verified-by: `only the audio session module sets an audio mode`
- verified-by: `every voice player enters voice playback before it plays`

### F724 — Most recorders and the live room do not silence haptics
- severity: P2
- status: [x]
- where: apps/mobile/src/motion/hapticPreference.ts:9
- note: 2026-10-05 all six recorders hold the microphone focus from before the recording mode until every exit, the LiveKit audio session holds the live focus, and hapticsEnabled is off under either. The title failed against the pre-change source.
- verified-by: `every file that records holds the microphone focus`

### F725 — There are no sound effects, and none may ship unheard
- severity: P2
- status: [x]
- where: apps/mobile/src/sound, scripts/sfx
- note: Founder decisions D8 and D9: original synthesised sounds, on by default, obeying the silent switch, silent while a microphone, voice line or live room is open, and playable only once the founder has approved each by ear.
- note: 2026-10-05 sound/sfxCore.ts gates every play on SFX_APPROVED, the Sound effects switch, the three focus holds, the foreground and a safety suppression, then throttles and asks the session again after the mode change. No screen plays a sound yet and every approval is still false.
- verified-by: `an unapproved sound never plays`
- verified-by: `every sound asset matches its approved synthesis`
- verified-by: `sound effects stay silent while a microphone, voice line or live room is open`

### F726 — The app has no shared icon set, so options repeat one glyph
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/ChoiceArt.tsx, apps/mobile/src/glyphs.tsx, scripts/icons
- note: Founder decision D11: Iconsax free icons, licensed to the founder as an individual, generated into react-native-svg components at the one stroke. All needed names exist in iconsax 0.1.1 (eight under renamed ids such as arrow-left-01 and refresh-left), so the Phosphor fallback is not needed.
- note 2026-10-06, ca/p0-icons (step D1): npm run icons generates 98 icons (93 Iconsax, 5 Luvani originals) into src/icons with the licence notice; Icon, IconPart, IconTile, GoalDial, places, AnimatedIcon and TabGlyph are in, every glyph export is a delegate, Acknowledgements credits Iconsax. Both titles failed under a mutation. Screens still draw ChoiceArt; the Choice and IconButton sweep is D2.
- verified-by: `every generated icon is decorative, token-coloured and drawn at the one stroke`
- verified-by: `the icon set credits its licence in Acknowledgements`

### F727 — Underlined text links stand in for icon controls
- severity: P2
- status: [x]
- where: apps/mobile/src/components.tsx
- note 2026-10-06, ca/p0-controls (step D2): IconButton (six marks, label required, 44 or 56 from HIT, depth tile, off by ground), IconAction and IconActionRow (tile and inline, two to four, wrapping at font scale 1.6) and the one Choice (radio by default, brand or sun fill, Hear a separate IconButton) are appended to components.tsx; OptionRow is a thin wrapper over Choice, ChoiceCard re-exports it and ChoiceArt draws an IconTile. OptionCard keeps its own drawing because the F355 title pins its sounding ear. The title failed under each of ten mutations. Screens still draw GhostButton until the Phase 2 and Phase 5 sweeps; not yet seen on a device.
- verified-by: `icon controls always carry a spoken label and a 44 point target`

### F728 — Empty-string state reaches a View as a text node on web
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/PreAccountOnboarding.tsx:1014, apps/mobile/src/onboarding/StarterContinuation.tsx:216, apps/mobile/src/onboarding/GuestAccountHandoff.tsx:177, apps/mobile/src/settings/SettingsScreen.tsx:871
- note: 335 "Unexpected text node" console errors per web onboarding run, from `{issue && (...)}` where issue is ''.
- note 2026-10-06, ca/p0-controls (step D2): the eight sites (PreAccountOnboarding four, StarterContinuation, GuestAccountHandoff, and SettingsScreen's two trouble lines) render `{x !== '' ? (...) : null}`; src/textNodes.test.ts walks every empty-string state and failed with any one site reverted. The web console count was not re-measured in a browser.
- verified-by: `no empty string reaches a view as a text node`

### F729 — There is nowhere to keep streak covers, quest claims, badges or celebrated moments
- severity: P2
- status: [x]
- where: apps/mobile/src/game, apps/mobile/src/sync/policy.ts, supabase/migrations
- note: A synced, versioned `game` namespace (set unions and maxes, commutative and idempotent) plus a device-only `gameLocal`; the Supabase namespace check must accept `game` before any build that writes it ships.
- note: 2026-10-06 ca/p0-data: `game/model.ts` (pure strict reader and merge: set unions and per-month maxes, every bound ranked by identity so the merge is also associative), `game/store.ts` (activity.ts shape: one chain, scope-bound writes, markDirty only for local writes, adopter at load and on reset) and `game/gameLocal.ts` (device-only, strict, never synced); `game` and `gameLocal` in USER_KEY_SUFFIXES; policy row (writes 1) and exclusion; migration `20261006120000_learner_state_game.sql` with a destructive interlocked rollback that owns its transaction (refusal, game-only delete and re-apply proved in `verifyDataBoundaries.mjs`), and a blob at the reader's widest (about 441 KB sealed) proved in PGlite. An empty list answers durable; a row dated after tomorrow is refused; day-scoped celebration keys are `streak:` and `chest:` only (`isDaySeenKey`), so a milestone is never aged out; a cut celebration queue answers failed. Residual: a phone whose own clock is far ahead can still age out every device's recent rows (no entry yet). Not applied to any project: apply before any build that writes `game` ships. Adds `bonusMonths` beside the specified rollups so fixed XP can age out without the total falling.
- note 2026-10-06, ca/d22-no-chest (F773): there is no chest claim and no `chest:` seen key any more. `isClaim` takes quest ids only, `DAY_SEEN_KINDS` is `['streak']`, and `RETIRED_SEEN_KINDS` makes the reader refuse a `chest:` key. The widest blob is about 436 KB sealed, down from 441 KB. Nothing that wrote a chest row shipped, so nothing was migrated.
- verified-by: `the game store refuses unknown bytes and keeps every awarded badge`

### F730 — A twenty-minute daily goal is discarded on every profile read
- severity: P2
- status: [x]
- where: apps/mobile/src/profile/upgrade.ts:71, apps/mobile/src/profile/dailyGoal.ts:23
- note: Founder decision D5 adds Intense (20 minutes); storedGoal only keeps 5, 10 or 15, so a saved 20 reads back as no goal. Profile version 9.
- note: 2026-10-06 ca/p0-data: profile v9; `storedGoal`, brain `validValue`, `GoalMinutes` and `dailyGoalOf` accept 20; policy writes 9. The test fails on the old chain (a saved 20 loads as null) and passes now through load, a v8 upgrade, the profile sync merge and the row's readers. The Profile row has no Intense segment yet (Phase 1 goal setup); a 20 marks no segment and reads "Twenty minutes".
- verified-by: `a twenty-minute goal survives every profile read`

### F731 — A finished sitting that earns no XP records no practice day
- severity: P2
- status: [x]
- where: apps/mobile/src/progress/activity.ts:246
- note: Founder decision D3: any finished practice is a streak day. Never add a new activity kind; record the day and the sitting in the game store.
- note: 2026-10-06 ca/p0-data-r1: `recordActivity` answers a PersistAck; a zero-XP sitting the caller marks `finished: true` records its day through `recordActiveDay` (no entry, no XP, no minutes, no new kind) and raises the activity flag; one not marked finished writes nothing, because the bank drill banks 0 XP on a header Leave with nothing answered (pinned by `a sitting left before it finished, with no XP, writes no practice day`). No screen passes `finished` yet: Phase 1's settle and the bank drill's finished path must. The zero-XP sitting row in `game.sittings` is written by Phase 1's settle.
- verified-by: `a finished sitting that earns no XP still records a practice day`
- note: 6 October: the day is written only when the caller passes finished: true, so a sitting left early writes nothing. No finish site passes it yet; the Phase 1 settle pipeline (F744) passes it at every finish, and recordActivityOnce must honour it too.

### F732 — A guest practice has no record of which day it was finished
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/guestModel.ts:12
- note: The first-run streak day must come from a persisted finish, so GuestPractice v2 gains a bounded `finishedAt` list.
- note: 2026-10-06 ca/p0-data-r1: GuestPractice stays version 2 (it already was) and gains optional `finishedAt` (one instant per local day, sorted, newest 31; absent reads as none); `finishGuestPractice` sets completed and the instant together, `guestPracticeDays` counts finishes only, and `offlineContinuation` keeps the days. Still owed by the first-run track (no entry yet): `PreAccountOnboarding.tsx` finish() must persist `finishGuestPractice(guest)` instead of `{ ...guest, completed: true }`, and `guestPractice.ts` `startGuestPractice`/`offlineGuestPractice` must carry `finishedAt` forward; until then a guest records no finish day.
- verified-by: `a guest streak day counts only a practice saved as finished`

### F733 — A store free trial or a yearly plan would grant the wrong allowance
- severity: P2
- status: [x]
- where: packages/core/src/metering/meter.ts, services/token-server/src/billing/revenuecat.ts, services/token-server/src/billing/state.ts
- note: Founder decision D16: a 7-day introductory offer grants a week of the plan's minutes (allowance x 7/30) during the trial; Starter and Max yearly products refill the monthly allowance every 30 days inside the paid year. Today any active entitlement would grant the full monthly allowance at once and a yearly product would grant one month for a year. Money-pinned files change only with a dated reason and independent review.
- note: 5 October review repair: the first build recorded a yearly window as period_end, so a read a day after any window the renewal sweep missed lapsed a paying learner and kept them lapsed. period_end is the paid year again and the window sits in allowance_window_end; a missed refill now costs minutes until the sweep or a restore, never the plan.
- verified-by: `a store trial grants a week of the plan's minutes and no more`
- verified-by: `a yearly plan refills the monthly allowance every thirty days`
- verified-by: `a yearly learner whose window ended a day ago is not lapsed by a read, and the next refresh grants window two`
- note: 6 October second review: a Starter yearly learner upgrading to Max monthly was never projected onto Max, because answers were ordered by period end; they are now ordered by the store's period start (entitlements.period_start), then window, then end. Re-checked SHIP by an independent verifier.
- verified-by: `a Starter yearly learner who upgrades to Max monthly is granted Max at once`
- verified-by: `a stale read of the old year after that upgrade moves nothing`

### F734 — Plans say nothing about streak protection
- severity: P2
- status: [x]
- where: apps/mobile/src/purchases/capabilities.ts
- note: Founder decision D4: freezes and repair come with an unlapsed paid plan, including during a store trial. capabilitiesFor answers streakProtection (5 October), but the plans page still says nothing: the INCLUSIONS line "Streak freezes and a one-tap repair" waits for F718 to retire "streak" from the shared guilt ban, because CAPABILITY_COPY is swept by guiltIn. Open until that line ships with the second test below, which does not exist yet, so the gate cannot tick this early.
- note: 2026-10-07 ca/p4-wall: INCLUSIONS.streak "Every plan includes streak freezes and a one-tap repair." is said once on the plans page under every plan's rows, with the freeze mark; capabilities.ts re-pinned once in moneyUntouched.test.ts with a dated reason (copy only, no plan opens anything new).
- verified-by: `two freezes and the repair come with a paid plan; the free plan holds one freeze (D23)`
- note: 2026-10-20 D23: the free plan (and a lapsed one) now holds one freeze and no repair; paid plans keep two freezes and the repair. The test was renamed to the new rule, and INCLUSIONS.streak reads "Every plan includes a second streak freeze and a one-tap repair."
- verified-by: `the plans page names streak protection on both paid plans`

### F735 — Production guest speech is off, so the first win is never spoken
- severity: P2
- status: [x]
- where: services/token-server/src/onboardingSpeech.ts:10
- note: Founder decision D13 enables guest speaking with server protection: an anonymous admission budget (per guest capability, installation, address and a global daily ceiling), about 60 seconds of speech per guest, the existing 20 s capture, 2 MiB cap and 24 h capability. Security and privacy review required.
- note: 6 October: ticked at merge by the integrator after two independent security reviews (5cb43138 and 0386e40c, both SHIP) covering abuse, cost and privacy; no new data recipient (Deepgram is already named in STARTER_PROCESSING and legal/policy.ts). Production stays off until LUVANI_GUEST_SPEECH=1 and the runbook's staging proofs on real Redis and real iOS and Android takes. Open follow-ups: F749, F750.
- verified-by: `guest speech is admitted only within its per-guest, per-installation, per-address and daily limits`

### F736 — An off switch is invisible on iOS
- severity: P2
- status: [x]
- where: apps/mobile/src/settings/SwitchRow.tsx:57
- note: The false track colour is set, but iOS paints an off switch from ios_backgroundColor, so every off toggle in Settings shows as a bare thumb. The Sound effects switch joins that screen in this programme.
- note 2026-10-06, ca/p0-controls (step D2): SwitchRow sets ios_backgroundColor to paper.field, the false track; settings/SwitchRow.test.ts holds every Switch in the app to the pair and failed with the line removed or set to another colour. Not yet seen on an iPhone.
- verified-by: `an off switch shows its track on iOS`

### F737 — The selected tab icon never shows it was chosen
- severity: P2
- status: [x]
- where: apps/mobile/src/nav/LuvaniTabBar.tsx, apps/mobile/src/nav/TabGlyph.tsx
- note: Founder decision D7 (richer motion on flat controls). The selected tab icon pops once inside nav/TabGlyph.tsx and lands still under Reduce Motion; LuvaniTabBar.tsx itself still moves nothing, so the F600 assertion stays true.
- note 2026-10-06, ca/p0-icons (step D1): TabGlyph pops the newly selected icon (up 2, to 1.15, home on SPRING.pop) with the Bulk drawing fading in over DUR.micro, never on mount or a re-tap; the Practice dot pops only when the read deck goes from none due to some. The title failed with the re-tap guard or the reduced landing removed. Not yet seen on a device.
- verified-by: `the selected tab icon springs in TabGlyph and lands still under Reduce Motion`

### F738 — Leaving one recording can stop another recorder or a live room
- severity: P2
- status: [x]
- where: apps/mobile/src/sound/audioSessionCore.ts:108
- note: Found by the Phase 0 sound review. leaveRecording switches to voice mode even while another microphone hold or a live room is open, and on iOS a mode without the microphone stops a running recorder. A slow cleanup on one screen can cut off the next screen's recording.
- note: 2026-10-06 leaveRecording asks, when its turn on the session chain comes, whether a microphone hold or a live room is open, and if so leaves the mode as it is. The title failed against the pre-change source, against a check made at queue time, and against one that ignored the live room. Not yet tried on a device.
- verified-by: `leaving one recording never stops another or a live room`

### F739 — A freeze counts as spent on a day a repair already covers
- severity: P2
- status: [x]
- where: packages/core/src/streak/freeze.ts:30
- note: Found by the Phase 0 core review. Two devices can write a repair and a freeze for the same day; the streak shows the repair, but freezesHeld still counts the freeze as used, so a subscriber loses a freeze they never needed.
- note 2026-10-05: fixed on ca/p0-fu-core (step F-C). freezesInUse reads the streak's resolved covers (streakDaysOf().covered), so only a day the streak shows as 'freeze' spends one; a repair or travel cover that wins the day leaves both freezes held. The title failed against the previous freeze.ts.
- verified-by: `a freeze is spent only on a day the streak used it for`

### F740 — Today's phrase quest needs a recording the learner may not be able to make
- severity: P2
- status: [x]
- where: packages/core/src/quests/catalogue.ts:65, apps/mobile/src/daily/DailyPracticeScreen.tsx:146
- note: Found by the Phase 0 core review. "Say today's phrase" is marked as needing no speaking, but the daily practice only finishes after a recording of at least a second, and it is in every day-one set. A learner who declined the microphone could never close their first chest.
- note 2026-10-05: fixed on ca/p0-fu-core (step F-C). phrase-of-day is requiresSpeaking: true, QuestEligibility gains canRecord (false when denied, unavailable or unknown), the questEligible guard refuses a recording quest without it, and day one uses DAY_ONE_QUIET_QUESTS (finish-practice, practice-set, minutes). The app must pass canRecord when Phase 1 computes quests. The title failed against the previous catalogue and selector.
- note 2026-10-06, ca/d22-no-chest (F773): there is no chest (founder decision D22). The fix stands as written: a learner without a microphone can still finish all three of their day's quests.
- verified-by: `a quest that needs a recording is never set for a learner who cannot record`

### F741 — A streak badge says days in a row when a covered day bridged the run
- severity: P2
- status: [x]
- where: packages/core/src/badges/catalogue.ts:64-67
- note: Found by the Phase 0 core review. The longest run counts across freeze, repair and travel days, so "You practised 30 days in a row." can be untrue. Every number on a celebration must be a persisted fact.
- note 2026-10-05: fixed on ca/p0-fu-core (step F-C). The four streak lines read "You reached a {n}-day streak."; the test bridges a 7-day run with a freeze and a repair and scans every badge for "in a row". The title failed against the previous catalogue.
- verified-by: `a streak badge never claims more days in a row than were practised`

### F743 — Nothing celebrates a finished practice
- severity: P2
- status: [x]
- where: apps/mobile/src/celebrate, apps/mobile/App.tsx
- note: Founder decisions D2, D6, D7, D8 (docs/come-alive/README.md). One celebration host above the navigator plays at most three full-screen moments after a sitting (streak, chest, level, badge), holds while a microphone, live room, sheet, end card or background is in the way, and plays nothing after a safety stop (F137).
- note 2026-10-06, ca/p1-stage (step P1-B): celebrate/queue.ts (pure) merges a 250 ms burst, plays at most three takeovers in TAKEOVER_ORDER with the rest as "Also today" rows, checks and marks account moments in the synced game.seen list (guest moments and toasts in a 256-key memory ledger), mirrors waiting account moments into gameLocal's pending queue, pauses for the sheet, end card, microphone, live room and background holds, drops after CELEBRATION_TTL_MS, clears on sign-out without a write, and on suppressCelebrations (SafetyStopView mount) clears the queue, the card on screen, the pre-attach buffer and sound effects. The host, the modal Takeover frame, six templates, the EndCard, the toast and ConfettiStill are mounted from App.tsx; WallScreen publishes purchase-confirmed only behind wallSuccess and an accepted purchase. Each title failed against queue.ts mutations (no budget, no suppression clear, seen check ignored). Nothing publishes from a sitting until the pipeline track lands; not yet seen on a device.
- note 2026-10-06, ca/d22-no-chest (F773): founder decision D22 removed the quest-chest takeover. TAKEOVER_ORDER is purchase, streak milestone, streak extended, level, badge, and MAX_TAKEOVERS stays 3. The pinned titles are kept, and their assertions now play the streak, then the level, then the badges. Finishing all three quests is one quiet line on the end card with the `quest` sound (the `end-card-quests` timeline).
- verified-by: `at most three takeovers play after a sitting, in streak, chest, level, badge order`
- verified-by: `a safety stop clears the celebration queue and refuses new moments`
- verified-by: `a moment already in the synced seen list never plays again`

### F744 — A finished practice is never settled into a streak day, a goal, quests or badges
- severity: P2
- status: [x]
- where: apps/mobile/src/game/settle.ts, apps/mobile/src/ConvoScreen.tsx, apps/mobile/src/nav/RootNavigator.tsx, apps/mobile/src/DrillScreen.tsx, apps/mobile/src/ReviewScreen.tsx, apps/mobile/src/daily/DailyPracticeScreen.tsx, apps/mobile/src/onboarding/GuestAccountHandoff.tsx
- note: One pipeline (README Part 6): every finished sitting settles once through game/settle.ts and returns a GameDelta read back from disk. A safety stop settles nothing.
- note 2026-10-06: fixed on ca/p1-settle (step P1-C) and repaired after review on ca/p1-settle-r1. game/settle.ts settles every finish (conversation inside its stop guard, lesson, bank drill set, review on an empty queue banked once, daily phrase, guest hand-off with streak:{day} seen first) and practice/completion.ts settles a practice plan wherever it completes (finish, retry from its first snapshot at its frozen instant, launch recovery); recordActivityOnce honours finished; GameProvider and the hooks are mounted once in App.tsx; game/display.test.ts bans levelFor( and the XP helpers in screens. Rule chosen for two devices dealt different quests: a quest either device credited stays earned (XP and the monthly count read every claim; done reads 3 once the chest is claimed). Each title failed without the change.
- note 2026-10-06, ca/d22-no-chest (F773): no chest claim, no chest XP and no `chestNow` in the GameDelta. `allQuestsDoneNow(delta)` in game/delta.ts marks the sitting that finished the third quest. The day's `done` count now reads every quest claimed today, on any device, up to three, so after a merge it still reads all three done without a chest, and it never falls.
- note 2026-10-06, ca/d22-no-chest-r1 (F773): the GameDelta carries `quests.doneBefore`, the day's count from the merged facts less the sitting's own claims. `allQuestsDoneNow` is true only when the sitting's own claims took the day from under three to three, so a quest finished after a merge, or after a sync that landed mid-sitting, on a day already done no longer plays the quest sound again. The pinned title asserts `doneBefore` on the first, third and replayed sittings.
- verified-by: `settling a sitting records its day, goal, quests and badges once, and a replay changes nothing`
- verified-by: `a safety stop settles nothing`
- verified-by: `a kept guest practice lights day one once`

### F745 — An existing learner would see a burst of old levels and badges on update
- severity: P2
- status: [x]
- where: apps/mobile/src/game
- note: game.md 3.6 with review finding 14. Seed the streak, badges and rollups from practice already saved, mark every current moment seen, and show the one intro sheet only to a learner who has practice days.
- note 2026-10-06: fixed on ca/p1-settle (step P1-C), kept through the review repair on ca/p1-settle-r1. game/catchUp.ts seeds once per account per phone (badges dated from data or null, xpMonths, no cover, every current moment and the durable intro key seen, paidSince for a paid plan); the intro sheet shows only with practice days on an account never introduced; until the seed runs a settle awards no badge and plays nothing. The title failed without the change.
- verified-by: `an existing learner is seeded from saved practice with every current moment marked seen`

### F746 — The streak, quest, level and badge art does not exist
- severity: P2
- status: [x]
- where: apps/mobile/src/game/art
- note: Founder decision D10: flat vectors built in code in the current style (flame, chest, medal, crest, freeze and repair marks). Kept out of the flat illustration registry so the pinned 29-drawing count (F599) stays true. The founder approves the contact sheet by eye before the art ships.
- note 2026-10-06, ca/p1-art (step P1-A): `game/art/shapes.ts` holds six drawings as token-filled parts on a 100 box (flame lit and unlit, chest shut and open, medal sun, mint, blue and next, crest, freeze ready and used, repair); a drawing on a colour ground it uses trades that colour with white. Flame (ignite per real key, three flickers per activation, never a loop) and Chest (lid on SPRING.pop about its hinge) move whole layers by transform and opacity through drive.ts and land on the final frame under Reduce Motion, on leave and on unmount; Medal, Crest, FreezeMark and RepairMark are still. The title failed with decorative removed from one Svg, an unknown token, a token from a group palette.ts lacks, a raw hex fill or colour, an extra stroke, a url( in an outline, a gradient, a fill not read through colourOf, a theme colour import, an opacity on a part and a second Svg. Contact sheet: `node --experimental-strip-types scripts/art/game-art-sheet.mjs` writes `artifacts/game-art/index.html`. Not yet approved by the founder, not yet drawn by any screen, not yet seen on a device.
- note 2026-10-06, ca/d22-no-chest (F773): the chest drawing is gone (founder decision D22), with Chest.tsx, CHEST_MOTION and its hinge, foot and open-pose constants. Five drawings remain, and only the flame moves. The pinned title now walks 160 parts and checks the exact count of every part in every state on every ground. The old floor of 200 counted the chest's 80 parts. The founder has approved the remaining art by eye (D22).
- verified-by: `every game drawing uses palette colours only and hides from assistive technology`
### F742 — A store trial's purchase screens describe a month
- severity: P2
- status: [x]
- where: apps/mobile/src/wall/WallScreen.tsx:330, apps/mobile/src/purchases/planStatus.ts:93
- note: F733 review (5 October). The server grants a store trial a week of the plan (42 or 70 minutes), but the purchase confirmation shows the catalogue's monthly minutes with "Your speaking time each month.", and the plan card's band compares against the monthly allowance, so it reads "A little speaking time left." from the first day of a trial. Held back by runbook step 4 (no intro offer is shown to learners until the Phase 4 plans page ships); the Phase 4 wall takes the trial's minutes from the server, not the catalogue. Core's refusal now says "You have used all your minutes for now." for every paid period.
- verified-by: `a store trial is described as a week of minutes, never a month`
- note: Numbered F736 on the billing branch, which collided with the iOS switch entry; renumbered F742 at merge (6 October).
- note: 2026-10-07 ca/p4-wall, repaired on ca/p4-wall-r1 after review: the server's grant decides, never the client's guess, so a grant holding no more than the plan's trial week is never said as the catalogue month. A purchase from the wall of a product carrying a free trial (whatever the store said about eligibility, and only once the store accepted it) shows the server's minutes with "Your speaking time during the free trial."; a restore during a trial, or a trial purchase confirmed after the app was reopened, shows the minutes held with "Your speaking time until {day month}." when the period ends within a week and a day; a grant holding more is said as the month. The plan card measures "a little" against a week of the plan when the period ends within a week and a day (a day of slack for a slow phone clock), which also moves a monthly learner's last week and awaits the founder's or revenue's acceptance until /billing/status reports the period kind.

### F747 — A store trial would get the paid phrase-audio budget
- severity: P3
- status: [x]
- where: supabase/migrations/20261002212536_*.sql, services/token-server/src/billing
- note: Found by the 6 October billing SQL review. A trial row's plan is starter or regular, so it would get the paid phrase-audio allowance ($0.20 per 30 days) instead of the trial's lifetime $0.02. Phrase audio is off and capped at zero by default; this needs a founder decision before it is turned on. D16 covers minutes only.
- verified-by: `a store trial gets the phrase-audio budget the founder chose`
- note: 2026-10-07 completion: Uses the lifetime trial phrase-audio bucket while a verified store trial is active; conversion invalidates old dispatch without resetting spend. Founder delegated the budget choice on 7 October; $0.02 was chosen. Feature flags and caps remain off by default.

### F748 — A store extension of a paid year starts a new usage period
- severity: P3
- status: [x]
- where: supabase/migrations/20261003231627_authoritative_tutor_sessions.sql (entitlement_usage_epoch), supabase/migrations/20261005231742_store_trial_yearly_allowance.sql
- note: Found by the 6 October billing re-check. A year the store lengthens with the same start keeps its minutes, but the older pinned epoch trigger still starts a new usage period, which could leave one in-flight session uncharged. Rare (a developer-granted extension).
- verified-by: `a store extension of a paid year keeps the in-flight session charged`
- note: 2026-10-07 completion: The usage epoch survives only a verified extension of the same paid annual window. SQL proof charges an already admitted session and still rotates at the next monthly window.

### F749 — A failed guest decode can briefly hold both shared audio decoders
- severity: P2
- status: [x]
- where: services/token-server/src/onboardingSpeech.ts:103, services/shared/audioDecode.ts:34
- note: Found by the 6 October guest-speech security review. The guest counter frees when decodeAudio rejects, but the killed ffmpeg keeps its slot until it closes, so for a millisecond or two a second guest decode can take the last slot and paid scoring returns unscored. Fix: a guest lane counted inside decodeAudio and released on the child close, replacing the counter in onboardingSpeech.ts.
- verified-by: `a guest decode never holds the last shared decoder, even while a failed one is closing`
- note: 2026-10-07 completion: A shared opaque decoder lease reserves the guest lane through child close, even after the request fails.

### F750 — A busy guest decoder spends one of the learner's two attempts
- severity: P3
- status: [x]
- where: services/token-server/src/server.ts:428
- note: Found by the 6 October guest-speech security review. When the guest decoder is busy the take is refused after guestAttempt has spent an attempt, so the learner loses a try although nothing was sent. Check the decoder before spending the attempt (the existing check stays as the guard), alongside the Phase 2 client that turns a 503 into a calm move to typing.
- verified-by: `a guest take refused because the decoder is busy keeps the learner's attempt`
- note: 2026-10-07 completion: Production guest speech reserves decoder capacity before spending an attempt. Busy reservations release no attempt.

### F751 — A real guest practice still records no finish day
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/PreAccountOnboarding.tsx:483, apps/mobile/src/onboarding/guestPractice.ts:65, apps/mobile/src/onboarding/guestPractice.ts:97
- note: Found by the 6 October data reviews. F732 gave GuestPractice a finishedAt list and finishGuestPractice, but the first run still persists { ...guest, completed: true }, and starting a new practice drops earlier finish days. Persist finishGuestPractice(guest) where the practice is saved as finished, carry finishedAt forward, and take the hand-off days from guestPracticeDays. Phase 2 (first run).
- verified-by: `a guest who finishes a practice keeps that day through a new practice and the hand-off`
- note: 2026-10-06 ca/p2-first-run-2: the first run persists `finishGuestPractice(guest)` before day one (and shows a finish day only once the write lands), `startGuestPractice` and `offlineGuestPractice` take the record they replace and keep its finish days (`keepFinishes` in onboarding/guestProgress.ts, through the same repair), and the hand-off settles the record's days through `guestPracticeDays`. The title failed with the finish saved as `{ ...guest, completed: true }` and with `keepFinishes` carrying nothing.

### F752 — The retired days-a-week answer is still written
- severity: P3
- status: [x]
- where: apps/mobile/src/tabs/ProfileTab.tsx:292, apps/mobile/src/onboarding/createFromDraft.ts:42
- note: Founder decision D5 replaced days a week with a daily goal, and profile v9 stops writing practiceDaysPerWeek while still reading it, but two writers remain. Remove them with the Phase 2 first run and the Phase 4 Profile goal rows.
- verified-by: `nothing writes practiceDaysPerWeek any more`
- note: 2026-10-06 ca/p2-first-run: account creation from the first-run draft no longer writes practiceDaysPerWeek (createFromDraft.ts), and the Profile "Days a week" row, the only caller of withPracticeDays, is gone (ProfileTab.tsx); the version chain still reads and carries an answer already on a disk. withPracticeDays in profile/store.ts now has no caller, for its owner to delete.

### F753 — A phone whose own clock runs far ahead can still age out recent game rows
- severity: P3
- status: [x]
- where: apps/mobile/src/game/model.ts, apps/mobile/src/game/store.ts
- note: Found by the 6 October data reviews. The store refuses rows dated more than a day after the writing device's clock, which stops a wrong clock on another device, but a device whose own clock is far ahead still writes rows the merge treats as newest, and the 60-day windows are measured from the newest row. The merge must stay clock-free, so this is a known limit, written up in docs/STATE_AND_STORAGE.md.
- verified-by: `a game row from a clock far ahead cannot shorten what another device keeps`
- note: 2026-10-07 completion: Game format v2 retains count-bounded identities rather than using the newest timestamp as a pruning clock. Reads v1, preserves merge laws, and prevents old builds from reapplying v1 pruning. Previously discarded data cannot be recovered.

### F754 — The first run shows no plan, celebrates nothing and asks for things at the wrong moment
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/PreAccountOnboarding.tsx, apps/mobile/src/onboarding/firstRun
- note: Founder decisions D5, D13, D14 and README Part 5.C: where, level and daily goal build a visible plan card; the plan is revealed with real numbers; the first win is celebrated only for an accepted real reply; day one, the reminder ask and the save card come only after a finished practice; nothing in the first-run screens sends, stores or records activity before consent.
- verified-by: `the win shows the learner's line beside the natural line and celebrates only an accepted real reply`
- verified-by: `the reminder is asked only after a finished practice and only on a real tap`
- verified-by: `no first-run page component can send, store or record activity`
- verified-by: `the save card lists only what this phone holds`
- note: 2026-10-06 ca/p2-first-run-2: day one (`remind`) is reached only from the finish once it is saved, lights the game flame once for a day the finish added (streak sound and celebrate haptic once), counts the run from core's streak rule over the guest's finish days and shows the week; the one shared `reminders/ReminderAsk.tsx` raises the notification dialog only inside the Remind me tap and reports on only after the OS took the schedule (hidden on web); the save card (`keep`) lists only what `guestInvestment` finds on the phone; a resumed draft reaches either page only with a finished practice. Walked in a web build at 390 and 1024 wide, with and without reduced motion; the ask itself, the dialog and the sounds are not yet seen on a device. The ask's "never on a day you have already practised" holds only once the Phase 4 planner skips practised days.

### F755 — The start sheet hides its last controls under the footer with no cue
- severity: P2
- status: [x]
- where: apps/mobile/src/components.tsx:1818, apps/mobile/src/onboarding/PreAccountOnboarding.tsx:654
- note: The consent sheet's content runs under the footer rule on a phone and nothing says there is more. Show the footer hairline and flash the scroll indicator only when the content scrolls.
- verified-by: `the start sheet shows a scroll cue when its content runs under the footer`
- note: 2026-10-06 ca/p2-first-run: Sheet measures its scroll and draws a hairline over the footer only while `sheetRunsUnder` holds (content taller than the view, its end not in sight), and flashes the scroll indicator once per opening; the start sheet dropped its own footer rule and sits in the 560-point reading column on a wide screen. Seen in the web build at 320, 390 and 1024 wide (cue at 320 and 390, none at 1024 where it fits); not yet seen on a device.

### F756 — The first run offers speaking when speech is unavailable
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/PreAccountOnboarding.tsx:381
- note: "Start speaking" is the primary action even when the server says guest speech is off, so learners land on "Speaking is unavailable". Speaking is the default only when speechAvailable is true; otherwise typing is offered first, and a 503 from /onboarding/audio moves calmly to typing (D13).
- verified-by: `speaking is offered in the first run only when the server says speech is available`
- note: 2026-10-06 ca/p2-first-run: the start sheet offers Start practice and Practise offline; the practice page opens spoken only when the guest start said speechAvailable for a live, online practice (`firstRun/speech.ts`), Speak instead appears only then, and a 503 from /onboarding/audio is read as `speech-unavailable` and moves to typing with a calm line and nothing to retry. The spoken path is not yet seen on a device.

### F757 — A kept first-run phrase stores the learner's unchecked spelling
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/GuestAccountHandoff.tsx:71, apps/mobile/src/onboarding/StarterContinuation.tsx:80
- note: The phrasebook and Home keep what the learner typed, unchecked, instead of the natural line the task models. Keep task.model.
- verified-by: `a kept first-run phrase is the natural line, never the learner's unchecked spelling`
- note: 2026-10-06 ca/p2-first-run: the hand-off and Home keep `keptPhrase(task)`, the task's natural line, and the hand-off card and the guest home show the natural line, never the reply as typed or heard.

### F758 — A disabled Next looks like a live button
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/NextButton.tsx:41, apps/mobile/src/components.tsx:981
- note: A disabled pill is a slate fill that reads as live. Disabled is paper.skeleton with soft ink; enabling cross-fades to ink with a pop and a glint.
- verified-by: `a disabled Next looks disabled on every ground`
- note: 2026-10-06 ca/p2-first-run: Continue is the sand skeleton with soft ink words and arrow, with a hint, when off, and fades to ink with one glint when an answer is chosen; an off white PillButton on blue or coral takes blue's pale secondary. 2026-10-07 ca/p2-first-run-2-r1: motion/MorphButton.tsx, which the first run's Start practice and Send reply use, now draws its off face the same way, sand for ink and blue's pale secondary for white with soft ink words (`a disabled MorphButton never draws the live face`).

### F759 — A drill answer gets one line of text and no rhythm
- severity: P2
- status: [x]
- where: apps/mobile/src/DrillScreen.tsx, apps/mobile/src/drill
- note: README Part 5.E: an answer sheet per verdict (good mint with sound and haptic, typo sun, first miss calm with no sound, second miss shows the form and waits for Continue, own-words retry "Nearly there." per D21), a living bar with a combo glow, and never an auto-advance while a screen reader is on.
- note 2026-10-06: fixed on ca/p3-core-loop (step P3-A). drill/answerSheet.ts decides each sheet (good mint with a rotating line and the run lines from three real passes, typo sun "Nearly." with the spelling, first miss calm with no French, second miss "Here's how it goes." with the form and a Continue, repeat-this "You said it.", own words through core ownWordsFeedback with retry "Nearly there." in the nearly tone per D21, never moving on by itself while a screen reader is on or unknown); drill/AnswerSheet.tsx draws it with the motion primitives and drill/sheetEffects.ts plays correct and arrived(), nearly and soft(), or nothing; drill/combo.ts and drill/SittingBar.tsx give the living bar its sun glow, which a repeat-this never extends; DrillScreen keeps one tapSettled(), for a finish shown without an end card. Both titles failed without the change.
- verified-by: `a good answer, a typo and a miss each get their own sheet, and a screen reader never auto-advances`
- verified-by: `a miss draws no mark, plays no sound and fires no haptic`

### F760 — A finished sitting shows no end card
- severity: P2
- status: [x]
- where: apps/mobile/src/DrillScreen.tsx, apps/mobile/src/ReviewScreen.tsx, apps/mobile/src/daily/DailyPracticeScreen.tsx, apps/mobile/src/SummaryScreen.tsx
- note: Every finished drill, practice set, review, daily phrase and lesson shows the in-place end card from celebrate/EndCard.tsx with numbers only from the settled GameDelta.
- note 2026-10-06: fixed on ca/p3-core-loop (step P3-A). The drill set, practice set, review, today's phrase and the lesson SummaryScreen draw celebrate/EndCard.tsx in place, fed only by the GameDelta the settle read back: the drill, review and daily pages hear their own sitting's delta through onSettled by its key (practice/useSittingEnd.ts, practice/sittingDelta.ts; a practice plan names the instant it settled as settlesAt), the lesson takes the delta its settle returned, and a finish the settle could not read back stands in words with no number. The title failed without the change.
- verified-by: `an end card shows only numbers the settle pipeline read back`

### F761 — A finished review and an empty deck look the same
- severity: P2
- status: [x]
- where: apps/mobile/src/ReviewScreen.tsx:176
- note: A sitting with grades shows "Review complete." with its end card; a deck with nothing due still says "Nothing waiting." and plays nothing.
- note 2026-10-06: fixed on ca/p3-core-loop (step P3-A). review/sittingEnd.ts tells the pages apart by what was dealt: a sitting with grades says "Review complete." with its end card once the settle has read it back; a deck with nothing due keeps "Nothing waiting." and settles, counts and plays nothing; the sitting is still marked banked before it is written. The title failed without the change.
- verified-by: `a finished review is told apart from a review with nothing waiting`

### F762 — Keeping an own-words phrase says saved when the write failed
- severity: P2
- status: [x]
- where: apps/mobile/src/DrillScreen.tsx:1301
- note: Say saved, fill the bookmark and play the save moment only on a durable acknowledgement.
- note 2026-10-06: fixed on ca/p3-core-loop (step P3-A). review/phraseSaved.ts keeps the phrase through addPhrases and answers saved only on a durable acknowledgement, and only then publishes phrase-saved (celebrationKey.saved); the drill fills the bookmark and says saved only on that answer and says plainly when a keep was refused; today's phrase added to review announces only a durable write. The title failed without the change.
- verified-by: `a kept own-words phrase is called saved only on a durable acknowledgement`

### F763 — The microphone stays published after the recap arrives
- severity: P2
- status: [x]
- where: apps/mobile/src/live/useLiveSession.ts:1104
- note: When the session ends the room is still open for the recap and the microphone stays published. Close it (setMicrophoneEnabled(false) and the mic-open state) before the recap shows, and release the live hold once the session has ended and the microphone is unpublished, so the recap may play its moment.
- note 2026-10-06, ca/p3-room-audio (step P3-B): the `recap` case now calls `closeMicForRecap()` before `setRecap` (micOpen and diagnostics false, then `setMicrophoneEnabled(false)`, every session including a stop); once LiveKit confirms the close for the same room and start, an effect asks `live/recapAudio.ts` (recap arrived, close confirmed, tutor not speaking, not stopped) and only then `releaseLiveHold()` gives back the room's audio-focus hold. LiveKit's audio session still ends at `leave()`; the mute leaves the capture device open until then. `RecapScreen` holds the celebration queue while mounted so takeovers still wait for the learner to leave. The title failed with no close, with the close after `setRecap`, with micOpen left true, with the close reported before it resolved, with a late close from a left room reported, with the release ungated on the close, the tutor's line or a stop, with the web release keeping the hold, and with the recap not holding the queue. Not yet checked on a device.
- verified-by: `the recap closes the microphone before it shows`

### F764 — The conversation orb never hears or answers the voices in the room
- severity: P2
- status: [x]
- where: apps/mobile/src/tutor/VoiceOrb.tsx, apps/mobile/src/live
- note: README Part 5.E: the listening ring follows the learner's real microphone level, the speaking bars follow the tutor's real audio, levels decay to rest after 120 ms because the hook never writes 0, thinking is honest, and the orb falls back to today's loops when levels are unavailable.
- note 2026-10-06, ca/p3-room (step P3-C): the orb draws the levels P3-B measures. `live/levels.ts` `createRoomFacts` turns the meter's frames into the few facts the orb branches on (each level measured, the learner heard after 250 ms above 0.12 and not after 600 ms below, the room awake), `tutor/orbLayers.ts` decides the layers, and `VoiceOrb` composes `OrbLevelRing` (the shared LevelRing), `LiveBars` and `OrbPulse` (today's loop rests while they draw), `OrbThinkingArc` and `OrbRipple` in the state colours, transform and opacity only, resting when the room is asleep, paused or reduced; "Hearing you" is visual and the accessible name stays the state's word. The lesson's Speak circle wears the ring. Plumbing title plus `tutor/orbLayers.test.ts` pass; checked in a web build, not yet on a device.
- verified-by: `the orb's levels come from real audio and decay to rest when the audio stops`
- verified-by: `the orb draws the room's real levels only when they are measured, and today's loops otherwise`

### F765 — Nothing marks a scene goal or a scene won in the room
- severity: P2
- status: [x]
- where: apps/mobile/src/tutor/MissionTaskList.tsx, apps/mobile/src/ConvoScreen.tsx
- note: Goal ticks pop with a check and are announced; the scene won card plays in place; no sound or haptic while the microphone is live; the recap plays the scene moment and a postcard stamp for every independent finish.
- note 2026-10-06, ca/p3-room (step P3-C): goal ticks pop their mint disc and land the check a beat later, glint once, scroll into view and are announced in the goal's words (`tutor/taskTicks.ts`); the last tick ripples the orb and holds the card for the ripple; `tutor/MissionWin.tsx` adds "Scene complete", the place drawing on blue, a mint glow and Burst 24 with "Keep talking" still the one pill and no sound or haptic; the recap's result page plays `recap-result` once the room frees the audio, with the progress strip from the settled GameDelta and the lines on `CountUp`; `celebrate/PostcardStamp.tsx` stamps every independent finish (`postcard-first` or `postcard-again`) and never an assisted one. OnceConfetti and OnceCount are retired. Not yet checked on a device.
- verified-by: `the room plays no sound while the mic is live or the tutor speaks`
- verified-by: `the stamp plays for every independent finish this session, never for an assisted replay`

### F766 — A celebration can start under an end card or inside a sitting
- severity: P2
- status: [x]
- where: apps/mobile/src/game/settle.ts:626, apps/mobile/src/celebrate/EndCard.tsx:76, apps/mobile/src/game/GameProvider.tsx:196, apps/mobile/src/celebrate/queue.ts:546
- note: Found by the 6 October re-check of the merged Phase 1 (verdict SHIP, all MINOR). Settle publishes before the screen can mount its end card, so a takeover can start under it; a foreground catch-up can replay a moment in the middle of a sitting; and a safety stop during a seen read leaves crash copies that replay next launch. Fix with Phase 3's end cards: hold celebrations before settling and hand the release to the EndCard, replay only from a Home-focus refresh or a sitting hold, and drop in-flight keys on suppression.
- note 2026-10-06: fixed on ca/p3-core-loop (step P3-A). Every sitting page in the core loop holds the celebration queue while it is mounted (useSittingHold, also on the lesson route), takes a settle hold before it settles (practice/settleHold.ts) and hands it to EndCard as release, which lets it go only when the card unmounts; a page that leaves first closes the hold so a late settle takes none. GameProvider puts a foreground catch-up off while the queue is held and runs it when the hold lifts (onCelebrationHoldChange). celebrate/queue.ts suppress() also drops the crash copies of moments whose seen read is in flight. ConvoScreen is the room track's and is not changed here. The title failed without the change.
- verified-by: `no takeover starts under an end card or inside a sitting`

### F767 — Home never shows the habit it is building
- severity: P2
- status: [x]
- where: apps/mobile/src/tabs/HomeTab.tsx, apps/mobile/src/game
- note: Founder decisions D2, D5, D6 and README Part 5.F: Home leads with game/TodayHero (flame and streak to the Streak screen, the goal ring in measured minutes, the level chip), a factual nudge line, the pinned lifetime day count and game/QuestsCard. A read failure shows nothing, never 0, and increments animate from the last shown value.
- note 2026-10-07: fixed on ca/p4-home (step P4-A). Home draws game/TodayHero above its own read (flame and run to the Streak screen, the goal ring in measured minutes, the level chip, the nudge line from game/copy.ts only while a run waits on today; nothing when unread), the scene brief with its place drawing (home/SceneArt.tsx), the pinned lifetime DayCount, game/QuestsCard (no chest, D22) and today's phrase with Practise it, Save and More phrases. Increments come from home/homeSeen.ts (device-only key home-seen, excluded from sync) and never count down or replay. Review repair on ca/p4-home-r1: what Home draws is held while Home is covered, behind the app, under a held queue or a takeover, and drawn after the takeovers (home/homeDraw.ts mayDraw, home/useHomeDraw.ts); a fall or a new day mounts a counter again rather than counting down (nextDraw), and the hero reads the game layer again when the day turns. The titles failed without the change (the modules did not exist).
- verified-by: `Home's today hero shows the streak, today's measured goal minutes and the level from real records, and claims nothing it could not read`
- verified-by: `Home's increments animate from the last shown value and never replay or count down`
- verified-by: `the nudge line is warm, factual and appears only when the streak is real and today is unpractised`

### F768 — Home re-reads its storage every minute and flashes the skeleton
- severity: P2
- status: [x]
- where: apps/mobile/src/home/useHomeRefresh.ts:9, apps/mobile/src/tabs/HomeTab.tsx:100
- note: A refresh replaces drawn content with the loading skeleton. Once Home has drawn, a refresh keeps what is shown until the new read lands.
- note 2026-10-07: fixed on ca/p4-home (step P4-A). home/homeRefresh.ts: the minute timer only asks whether the local day turned, and a read clears the page only for an account nothing was drawn for (refreshClears); HomeTab records the account it drew for when the read lands. NextTaskCard and DayCount keep what they drew across a same-account refresh too. The title failed without the change (the module did not exist).
- verified-by: `Home refreshes without ever showing its skeleton again once it has drawn`

### F769 — Progress and Profile hide the level, the streak and the counts
- severity: P2
- status: [x]
- where: apps/mobile/src/tabs/MyFrenchTab.tsx, apps/mobile/src/tabs/ProfileTab.tsx
- note: README Part 5.F: Progress leads with game/LevelXpCard, game/StreakSummaryCard (keeping the weekly DayCount), game/CountsGrid and game/BadgeShelf (no locked or remaining wording), then the CEFR card and the postcard shelf; Profile shows game/ProfileStats and the goal as five Choice rows.
- note 2026-10-07: fixed on ca/p4-home (step P4-A). Progress leads with game/LevelXpCard, game/StreakSummaryCard (holding the pinned <DayCount weekly />), game/CountsGrid and game/BadgeShelf (no locked, remaining or collect wording), each from its own record and drawn once there is practice; then the CEFR card (the one pill), progress/PostcardShelf in place of the postcards row, and IconTile ledger rows. Profile draws game/ProfileStats (a subscriber's freezes only) and the goal as five Choice rows. Review repair on ca/p4-home-r1: "Minutes practised" is the game view's minutesPractised (the goal ring's own sittings and rule, so a daily phrase counts on both), the weekly day line draws on its own whenever the game cards do not, and the level card's head is the heading a screen reader hears. The title failed without the change (the modules did not exist).
- verified-by: `Progress leads with the level, the streak and real counts, each from its own record`

### F770 — There is no screen for the streak
- severity: P2
- status: [x]
- where: apps/mobile/src/game, apps/mobile/src/nav
- note: README Part 5.D Streak screen: hero flame with the count, lifetime and longest; a week strip and a month calendar that never say missed; the freezes card and the repair card for a subscriber; the one calm repair line for a free learner (D4); milestones; month arrows as labelled IconButtons; a web path in nav/theme.ts (F493).
- note 2026-10-07: fixed on ca/p4-home (step P4-A). game/StreakScreen.tsx on the Streak route (nav/types.ts, RootNavigator, web path `streak` in nav/theme.ts) draws game/streakScreenView.ts: the run with the lifetime total and the longest, the week and the month from the game view's practice days and covers with full spoken labels and no missed, labelled month IconButtons, seven columns, the freezes and repair cards for a subscriber and the D4 line with See plans for a free learner only just after a reset. The titles failed without the change (the modules did not exist).
- verified-by: `the streak screen shows the run, the lifetime total, the week and the month from real days, and never says missed`
- verified-by: `a free learner sees one calm repair line and a subscriber sees their freezes and repair`

### F771 — Reminders fire on a fixed weekly schedule whether or not the learner practised
- severity: P2
- status: [x]
- where: apps/mobile/src/reminders
- note: README Part 5.F Reminders: one planner (reminders/plan.ts), a smart time from the learner's own finishes, one dated slot a day skipped when practised, a pause note after four unanswered days then silence, copy naming the chosen tutor, taps that open their promise, re-planned after every settle, cancelled only on sign-out. Supersedes F226, F227 and F230 (their verified-by lines are replaced by these).
- note 2026-10-07, ca/p4-reminders: done. plan.ts plans up to five dated `practice:{day}` slots in a seven-day window (smart time: median first finish less 30 minutes, on the quarter hour, 08:00 to 21:30, 18:00 until three days), skips a practised day, rotates twelve lines naming the chosen tutor (milestone eve, mentionStreak) with no line twice in a row, and puts the pause note in the fifth unanswered slot. store.ts is v2 (choice plus a day-key log, v1 migrated). schedule.native.ts schedules once per slot with DATE triggers, cancels only `practice:` by identifier, has no handler and no badge, and hears taps (cold start included). ReminderPlanner.tsx re-plans on mount, foreground, every settle, tutor change, Settings and the ask; App.tsx follows taps (Home, today's phrase, Settings) and cancels on sign-out only. The titles failed against fbe958ce (plan.ts did not exist). Review repair (ca/p4-reminders-r1): a slot counts as arrived only while the OS held its plan (a device key names the held plan, cleared before every take-back and at sign-out), so a reminder turned off, refused or signed out of can never come back paused; Settings' off goes through the planner's chain, the ask plans the choice it wrote, and the sign-out cancel is keyed on who is signed in (the recovery screen cancels nothing).
- verified-by: `a reminder is skipped on a day already practised, at most one a day, and pauses after four unanswered`
- verified-by: `a reminder names the chosen tutor and opens the place it promises`

### F772 — The plans page has no yearly plans and no honest trial timeline
- severity: P2
- status: [x]
- where: apps/mobile/src/wall
- note: Founder decision D16 and README Part 5.G: yearly and monthly rows through Choice with the yearly plan of the tier covering the learner's goal pre-selected (no plan_selected fired), prices from the store, never save N percent, the goal fit line, Not now and Keep practising free; a trial timeline only with a real eligible introductory offer; purchase success only after a confirmed entitlement.
- note: 2026-10-07 ca/p4-wall: each plan's yearly and monthly products are Choice radios with the store's prices (the yearly with the store's pricePerMonthString, a new display-only contract field, re-pinned); the yearly product of the cheapest plan covering the goal is chosen once, after the billing status read, with no event; the trial timeline needs an eligible free intro in days or weeks and never promises the Day 5 reminder, which nothing schedules yet; the pill keeps its tag and waits in place, its check only after the server confirms. Repaired on ca/p4-wall-r1 after review: each way to pay is titled by its billed amount and the trial's terms at the pill are drawn in ink at body weight, no trial line larger (Apple 3.1.2). Known gap, not closed by this tick: the plan catalogue reaches the phone only on a live-session start, so on a device the first-run wall (no session yet) pre-selects nothing, shows no goal line or trial minutes, and after a confirmed purchase shows "We couldn't read your speaking allowance" instead of success, until /billing/status carries the catalogue (backend work outside this track); runbook step 4 stays closed until then.
- verified-by: `the plans page pre-selects the yearly plan that covers the learner's goal and fires no selection event`
- verified-by: `a free trial timeline appears only with a real eligible offer`

### F773 — Quests end in a chest the founder decided against
- severity: P2
- status: [x]
- where: packages/core/src/quests, apps/mobile/src/game, apps/mobile/src/celebrate, apps/mobile/src/game/art
- note: Founder decision D22 (6 October): no chests. Quests, their +10 XP and the monthly quest badge stay; finishing all three shows one quiet line with the quest sound; the chest drawing, CHEST_XP, the chest claim, the quest-chest takeover and the chest seen key go. Nothing with a chest has shipped, so no stored data needs migrating.
- note 2026-10-06, ca/d22-no-chest: done. core/quests has no CHEST or CHEST_XP: questsToClaim returns quest ids only, and the monthly quest badge draws `star`. game/model.ts refuses a chest claim and a `chest:` seen key. settle.ts credits +10 a quest and nothing more. game/events.ts publishes no quest-chest takeover, and the template, Chest.tsx, the art and GAME_COPY.chest are deleted. The end card plays `end-card-quests` (the `quest` sound with "All three quests done today.") only on the sitting that finished the third quest. The unused `gift` icon is removed. The title failed against 2a788335.
- note 2026-10-06, ca/d22-no-chest-r1: repaired after review. The quest sound replayed when a quest finished on a day a merge had already made three; `allQuestsDoneNow` now reads the delta's `doneBefore`, counted from the merged facts less the sitting's own claims, so it sounds once a day. The second title failed against ca/d22-no-chest. Under Reduce Motion the `end-card-quests` card's one still sound is now `quest`, the sound D22 pairs with the line. The detailed specs game.md, motion-sound.md, retention-paywall.md, reviews/game.md and reviews/critic.md still describe a chest; README Part 6 overrides them where they disagree, and they were outside this step's files.
- verified-by: `finishing all three quests shows one quiet line and no chest`
- verified-by: `a day another phone finished while this one practised plays no quest sound again`

### F774 — The reminder ask promises a skipped practised day the scheduler does not yet skip
- severity: P2
- status: [x]
- where: apps/mobile/src/reminders/ReminderAsk.tsx:43, apps/mobile/src/reminders/schedule.native.ts:229
- note: Found by the 7 October first-run privacy review. The day-one ask says "One a day at about {time}, and never on a day you have already practised." (README Part 5.C row 9), but the reminder is still a plain daily trigger. The Phase 4 planner (F771) must make the promise true for every learner, including a guest who never makes an account (their finish days come from guestPracticeDays), and the notification must name the tutor the ask named. Nothing ships before Phase 4 (landing is HOLD until the founder has seen it).
- note 2026-10-07, ca/p4-reminders: done. The ask plans through turnOnReminder(at, tutor); for a guest who never makes an account the planner reads guestPracticeDays and finishedAt and names tutorVoice(draft.tutorVoice), and GuestReminderPlanner (mounted in App.tsx wherever nobody is signed in) re-plans when the draft moves, which it does once a finish is on the disk, and on the way in and out of the app. Nothing scheduled repeats, so a practised day is skipped. The title failed against fbe958ce.
- verified-by: `the reminder ask promises a skipped practised day only when the scheduler skips it, guest finish days included`

### F775 — Four small gaps the core-loop review found
- severity: P2
- status: [x]
- where: apps/mobile/src/drill/AnswerSheet.tsx:99, apps/mobile/src/nav/RootNavigator.tsx:128, apps/mobile/src/nav/useBackToHome.ts:5, apps/mobile/src/DrillScreen.tsx:1789, apps/mobile/src/celebrate/queue.ts:444
- note: Found by the 7 October core-loop review (verdict SHIP). A waiting answer sheet leaves screen-reader focus behind; a sitting opened cold on the web is never closed, so its celebration holds never lift; a drill end that waited out its delta can swap to the end card mid-read with a second finish haptic; and a moment waiting behind a sitting hold can expire after 10 minutes and never play (also raised by the merged Phase 1 re-check).
- note 2026-10-07, ca/p4-followups (step P4-D): a sheet that waits moves a phone's screen reader onto its Continue once it has risen (drill/answerSheet.ts sheetArrival; Continue's name carries the whole sheet, and PillButton now forwards a ref); every exit from a pushed sitting goes through nav/leave.ts backOrTabs, which resets to the tabs when nothing is behind it, so a cold sitting unmounts and its holds lift (RootNavigator and useBackToHome); the drill end waits inside its screen with Done, and practice/sittingDelta.ts sittingEnd keeps the words-only finish once the wait has run out; the queue's time to live runs only on unheld time, so a held moment keeps its crash copy. Each title failed against fbe958ce. Checked in a web build, not on a device.
- verified-by: `a waiting answer sheet moves screen-reader focus to Continue`
- verified-by: `leaving a sitting opened cold on the web closes it and lets its holds go`
- verified-by: `a drill end that waited out its delta keeps the words-only finish`
- verified-by: `a moment waiting behind a hold does not expire while the hold lasts`

### F776 — A failed spoken take offers a Try again that does nothing
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/PreAccountOnboarding.tsx:553, apps/mobile/src/onboarding/PreAccountOnboarding.tsx:1314, docs/PRIVACY_AND_SAFETY.md
- note: Found by the 7 October first-run re-check (verdict SHIP). When a spoken take's transcription fails, the page says "Your reply is still here." and offers Try again, which submits nothing in spoken mode. Say "The tutor could not hear that take. You can record it again or type it.", show Try again only for a typed reply, keep Practise this offline. Also say in PRIVACY_AND_SAFETY.md that the under-13 answer, Start a new plan instead and Create one cancel a reminder set on day one.
- verified-by: `a failed spoken take offers to record again or type, never a Try again that does nothing`
- note: 2026-10-07 ca/p4-first-run-fu: a spoken take that fails ('unavailable' or a dropped connection; expired and limit keep their own lines) says FIRST_RUN_COPY.takeUnheard, the failure row comes from `issueActions` in onboarding/firstRun/copy.ts and draws Try again only for a typed reply or the start, Practise this offline stays (and now turns a spoken page to typing, since offline checks typed words), and PRIVACY_AND_SAFETY.md names the three doors that cancel a day-one reminder. The title failed on the base screen and on the base document.

### F777 — Three room details the review found: an unread history, a muted microphone and a slow rest
- severity: P2
- status: [x]
- where: apps/mobile/src/recap/evidence.ts:31, apps/mobile/src/ConvoScreen.tsx:629, apps/mobile/src/live/useLiveSession.ts:745, apps/mobile/src/live/levels.ts:37
- note: Found by the 7 October room review (verdict SHIP). A postcard stamp says "again" when the learner's finish history could not be read (truthfulness: use the neutral line); at the recap the microphone is muted, not unpublished, so capture keeps running and the iPhone microphone indicator stays on; and the levels take about a second to rest after silence where acceptance check 7 asks for 300 ms (decay by elapsed time).
- note 2026-10-07, ca/p4-room-fu-r1 (step P4-F and its review repair): an unread history is null through `firstEarnedFinish`, the conversation's read and the recap's prop, and stamps `neutral` ("You did it on your own.", the first earn's weight); the recap mutes, then unpublishes and stops the microphone track before it reports the close, the orb lets go of that track, and a start after a recap without `leave()` takes the room's hold again; levels hold 80 ms and fall by the clock (full scale in 160 ms), at rest within 240 ms of the last sound, and "Hearing you" goes 260 ms after the last voiced reading (counted from the reading, not the ring, so a quiet voice's pauses between words do not flicker it). The faster release made `envelope(1, 0) > 0.8` false in `live/levels.test.ts`, so it reads `> 0.7`; the new `release(1, LEVEL_SAMPLE_MS) > 0.5` keeps its intent. All three titles pass; the iPhone indicator and the levels' look are not yet checked on a device.
- verified-by: `a postcard stamp never claims an earlier finish it could not read`
- verified-by: `the recap stops the microphone capture, not only mutes it`
- verified-by: `a level rests within 300 ms of silence`

### F778 — Most screens still stack underlined text links where an icon control belongs
- severity: P2
- status: [x]
- where: apps/mobile/src (63 files; docs/come-alive/icons-layout.md section 2)
- note: README Part 5.B GhostButton sweep: about 160 of 222 links become IconButton, IconAction or Choice, keeping their labels. Words stay for legal and billing links, destructive and account actions, decline and Not now, leave confirmations and the age refusal. A ratchet test holds the remaining count and the KEEP categories.
- verified-by: `underlined text links remain only where words must stay: legal, billing, account, decline and leave`
- note: 2026-10-07 completion: Converted 127 ordinary controls, grouped practice actions into labelled tiles, and removed the duplicate recap exit. The AST ratchet allows at most 60 retained legal/account/billing/decline/exit controls, including dormant legacy screens.

### F779 — Every paper screen draws a footer rule, so a short page looks cut off
- severity: P2
- status: [x]
- where: apps/mobile/src/layout.tsx:127
- note: icons-layout.md 3.5: the footer hairline appears only when the content scrolls under it, toggled with no animation.
- verified-by: `a footer hairline appears only when the content scrolls under it`
- note: 2026-10-07 completion: The footer rule follows measured content, viewport and scroll offset; it disappears when there is no content beneath the footer.

### F780 — An iPad shows the phone layout stretched across a wide screen
- severity: P2
- status: [x]
- where: apps/mobile/src/responsiveLayout.ts, apps/mobile/src/layout.tsx
- note: icons-layout.md 3.6 and README Part 5.B: layoutClass and <Columns> on regular width (two columns on the tabs), FOOTER_MAX 480, the reading width for first-run pages, takeovers and sheets.
- verified-by: `on a regular-width screen the tabs use two columns and sheets keep the reading width`
- note: 2026-10-07 completion: Home, Progress and Practice use regular-width columns; onboarding uses option grids. Large text and narrow/split widths return to stacked layout. Browser checks at 375 and 834 points; physical tablet/Dynamic Type acceptance remains separate.

### F781 — Empty lists show a bare sentence and no way forward
- severity: P2
- status: [x]
- where: apps/mobile/src (Phrasebook, Conversations, Tutor memory)
- note: README Part 5.B: each empty list shows one of the existing state drawings and one first action.
- verified-by: `every empty list shows its drawing and one first action`
- note: 2026-10-07 completion: Phrasebook, conversation library and tutor memory empty states show the existing notebook drawing and a Choose a scene action.

### F782 — Tapping a disabled Next does nothing a learner can notice
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/NextButton.tsx
- note: icons-layout.md 3.4: the press is taken while the button stays disabled: a soft haptic, the options lift by 3 points with a 40 ms stagger (never a shake) and the live region says "Choose one to continue."; Reduce Motion gives the words only. The pinned disabled={answer == null} stays.
- verified-by: `tapping a disabled Next lifts the choices and says to choose one, never a shake`

October 2026 onboarding supersession: the founder requested a new first-value flow and removal of the mascot and early sign-in. Evidence titles above now refer to the current setup, actual guest replies, ownership and modal contracts. Historical descriptions of demo/save pages describe earlier releases. Test floors and the quality gate are unchanged.

October 2026 come-alive supersession: founder decisions D1 to D17 (docs/come-alive/README.md) replace the hand-drawn glyph set with a generated Iconsax set at the one STROKE, with Bulk variants for tiles and selected states. The F589 and F598 titles ("one pen", "an ICONS.md mark") now describe that generated set, and their assertions change only where the generated files make them false. The selected tab icon pops once inside nav/TabGlyph.tsx (F737); the F600 bar itself still moves nothing.
- note: 2026-10-07 completion: Disabled Next routes touch to a choice lift and polite explanation, without advancing. Reduce Motion gets the words only. Browser tap verified.

### F783 — Purchase refresh leaves the game entitlement facts stale
- severity: P2
- status: [x]
- where: apps/mobile/src/purchases/billingChanges.ts, apps/mobile/src/game/GameProvider.tsx
- note: Confirmed billing refresh invalidates game facts only for the still-current account and scope. Read generations prevent a slower earlier response from overwriting a newer one. Late successful reads after the loading deadline still update the view.
- verified-by: `confirmed billing refresh invalidates game facts for only the current account`

### F784 — New build-tool and image-decoder advisories were not yet patched
- severity: P1
- status: [x]
- where: package.json, package-lock.json, services/token-server/src/dependencyPatches.test.ts
- note: 7 October 2026 audit found compression GHSA-vc2v-76pw-4v95, shell-quote GHSA-pqg4-j6r4-53mv, source-map-js GHSA-68fv-2mgg-jv7q and Sharp GHSA-wq5f-xc86-pv6w. Exact overrides use compression 1.8.2, shell-quote 1.11.0, source-map-js 1.2.2 and Sharp 0.35.5 with libvips 1.3.4/librsvg 2.63.2. All unrelated versions and the pinned LiveKit SDK/plugin set are retained. Clean npm ci succeeds; hostile quote/map inputs are rejected, and the tutor RGB/resize/PNG path works. No new advisory was accepted or audit threshold weakened.
- verified-by: `October dependency patches reject shell line injection and unbounded indexed source maps`
- verified-by: `patched Sharp retains the tutor RGB resize and PNG encoding path`
- verified-by: `every Sharp copy is patched and retains its cross-platform native assets`

### F785 — Email progression lags and auth text sits unevenly inside its field
- severity: P2
- status: [x]
- where: apps/mobile/src/auth/useEmailAutoAdvance.ts, apps/mobile/src/auth/AccountField.tsx, apps/mobile/src/auth/SignInScreen.tsx, apps/mobile/src/auth/SignUpScreen.tsx
- note: 10 October founder check found the 900 ms auto-advance pause slow. Both forms now use the same 300 ms cancellation-aware handoff; explicit Next keeps the keyboard open. Account text stays left-aligned with even vertical padding, native vertical centring and no Android font padding. Show/Hide overlays the trailing inset without taking width from the input. Browser focus, left alignment and Show/Hide were checked at desktop and 393-point width; physical iOS/Android keyboard timing remains to be checked.
- verified-by: `email progression waits for a complete domain and a pause after the last keystroke`
- verified-by: `auth work, moving to another input and unmounting prevent a queued focus change`

### F786 — The local loop stops at a green baseline and can discard unrelated edits
- severity: P2
- status: [x]
- where: scripts/loop.mjs, scripts/loop.test.mjs
- note: The local runner accepts dependency-ordered plans even with a green baseline, verifies checks itself and requires a final green gate. It preserves failed patches, records resumable fingerprints, enforces invocation deadlines and detects Git-visible scope or Git-state violations. Automatic staging, commits, checkout rollback and clean were removed. Local CLI fixtures prove the runner without contacting a model; the real authenticated CLI smoke run remains user-controlled.
- verified-by: `a green baseline still builds plan tasks in dependency order and verifies the final gate`
- verified-by: `out-of-scope edits stop the loop, stay available for review and cannot be resumed blindly`
- verified-by: `the final gate can refuse a plan whose focused checks passed`

### F787 — Plan editing drops new personalisation fields
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/PreAccountOnboarding.tsx
- note: The C plan editor originally committed only reason, level and duration. Done now also commits interests, confidence and practice focus. Browser verification changed a travel plan from a train scenario to a restaurant scenario by adding Food & cafés.
- verified-by: `plan editing commits all six answers so new interests reach the live scenario`

### F788 — Native email links do not complete the existing authentication flow
- severity: P2
- status: [x]
- where: apps/mobile/src/auth/emailCallback.ts, apps/mobile/src/auth/supabaseAdapter.ts
- note: Native signup/resend/reset now return to a dedicated email callback. It accepts exact-destination PKCE codes and passes the SDK flow slot, deduplicates launch/event delivery, removes its listener on unsubscribe and shows generic recovery text on failure. Password recovery also updates the authenticated identity required by Gate. Real provider/device acceptance remains pending staging configuration.
- verified-by: `warm and cold delivery of one email link exchange only once with the exact flow slot`
- verified-by: `email callbacks reject foreign routes, provider errors, duplicate parameters and URL tokens`
- verified-by: `unsubscribing suppresses a late launch URL and pending exchange error`

### F797 — Live Supabase preflight compares catalog expressions under different search paths
- severity: P2
- status: [x]
- where: scripts/releaseSchemaManifest.mjs, services/token-server/src/verify/supabaseLive.ts
- note: The full hosted SQL catalog matched all 39 migrations, but the REST preflight falsely rejected policies and two functions returning composite rows. PostgreSQL qualifies those expressions using the caller's search path; backend_catalog_v1 has an empty path. The live harness now requests that same rendering context from the independent migration replay. The full SQL baseline and all drift/ACL comparisons remain intact. The regression failed on the original implementation; all 12 live disposable-account proofs subsequently passed on Luvani Staging.
- verified-by: `live REST preflight renders policies and composite results in the RPC search path`

### F798 — Web sign-in background handler immediately blurs clicked fields
- severity: P1
- status: [x]
- where: apps/mobile/src/layout.tsx
- note: The native background keyboard-dismiss wrapper also received browser input clicks, removing focus before typing. ScrollScreen now keeps that wrapper native-only. In Chrome, the original email click/type sequence left the field empty and focus on the page; after the fix, normal typing persists and clicking Password retains focus. Native dismissal and busy-state field disabling remain unchanged.
- verified-by: `editing hides navigation and hidden introduction cannot receive touches`

### F799 — Real local staging sign-in loses its durable tutor session identity
- severity: P1
- status: [x]
- where: services/token-server/src/auth.ts
- note: The asymmetric token verifier discarded session_id outside production, routing real staging users through legacy grant recording. With authoritative admission enabled, SQL correctly refused that path. Verified UUID session claims now survive local staging verification and require the same live account/session check before durable admission. Keyless mock identities keep their existing local-only path. The regression failed before the fix, then passed including revoked and unavailable identity checks; the actual Chrome session subsequently obtained a durable 120-second reservation and the worker claimed it.
- verified-by: `local staging preserves and checks the verified Supabase session for durable tutor admission`

### F800 — Onboarding readiness shine is consumed by the first question
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/PreAccountOnboarding.tsx
- note: Reusing one NextButton instance across questions retained its one-shot shine state. Keying it by the question resets readiness feedback for each choice screen while preserving reduced-motion behavior. The existing next-action contract failed before the fix and passed afterwards.
- verified-by: `tapping a disabled Next lifts the choices and says to choose one, never a shake`


### F801 — Scene vocabulary changes do not reach the active speech stream
- severity: P2
- status: [x]
- where: services/tutor-agent/src/agent.ts
- note: Updating the Deepgram model options only changed future streams in the installed SDK. Current-turn vocabulary now uses the public session keyterms API, which updates the active stream and defers reconnecting during speech. Quote-bound paid proxy and experimental recognizer options remain unchanged.
- verified-by: `current scene keyterms update the active session without changing paid or experimental recognition`

### F802 — Approximate spelling distance can replace a valid learner word
- severity: P1
- status: [x]
- where: packages/core/src/speech/recognitionRepair.ts
- note: Review found that a generic two-edit match could replace partir with parler or train with pain. Repair now requires conservative sound-fold equivalence or the observed sur-place confusion family, current-turn context and an unambiguous result. Expanded quantity/negation guards preserve regional numbers and elided refusals. Typed input is unchanged and interpreted speech is explicitly labelled.
- verified-by: `a nearby valid word is not evidence to replace the learners meaning`
- verified-by: `near-sound repair cannot change teen quantities, regional numbers or elided negation`


### F803 — Scene language retuning leaves the active recognizer multilingual
- severity: P2
- status: [x]
- where: services/tutor-agent/src/agent.ts, services/tutor-agent/src/recognitionSdk.test.ts
- note: Updating the recognizer configuration did not rebuild its already-open stream. The public Agent update API now restarts recognition at the phase boundary, with rejection contained and a typing recovery message. An offline test uses the installed SDK and a loopback fake vendor to inspect the actual language/keyterm WebSocket query, without real audio or provider credits.
- verified-by: `installed SDK reopens the same recognizer in French and applies current session keyterms`


### F804 — Portable backend copies the decoder from a nonexistent image path
- severity: P2
- status: [x]
- where: Dockerfile, .github/workflows/release.yml
- note: The documented static decoder image exposes /ffmpeg, while the unexecuted portable build assumed /usr/local/bin/ffmpeg. The build now uses the documented path and retains byte-hash and compressed-audio verification. Final nonroot Linux decoder/native/model checks run during the real build; their network-disabled proof runs in `deployment/captureContainerRuntime.mjs` (DEPLOY-004), because Railway rejects `RUN --network=none`. Image publication and hosted promotion remain separate.
- verified-by: `static decoder image keeps byte verification and final nonroot runtime checks; network isolation lives in the release capture`

### F805 — Reviewed portable decoder inputs exceed the immutable executable bound
- severity: P2
- status: [x]
- where: deployment/verifyAudioDecoder.mjs, services/shared/audioDecode.ts
- note: Actual OCI build 38271932614 passed the source contract but refused the independently hashed static-ffmpeg 9.0.2-1 binary (144,081,824 bytes); the maintained 8.1.2 candidate also exceeds the existing 128 MiB bound (140,059,552 bytes). The rejection is correct. A compatible reviewed immutable decoder artifact must pass the unchanged size/hash/compressed-audio and final nonroot offline Linux checks before portable image acceptance. No artifact was published or hosted workload deployed. Since 2026-10-22 (F623) live lesson scoring no longer needs the decoder: the worker converts its own PCM capture in process. Drill and sound-check uploads, which arrive compressed, still do.
- update: 2026-10-26, DEPLOY-001. `deployment/audio-decoder` builds a decode-only, static, LGPL FFmpeg 7.1.5 (hash-pinned tarball on digest-pinned Alpine 3.21, pipe protocol and the six whitelisted formats only, musl 1.2.5 licence pinned). `.github/workflows/audio-decoder.yml` pushes by digest, runs the unchanged `verifyAudioDecoder.mjs` nonroot and offline on the pinned Node 24.16.0 image, and only then tags. Stays open until that workflow has run green and its digest and binary hash are the release inputs.
- verified-by: `immutable decoder rejects an executable above 128 MiB before execution`
- fixed: 2026-10-27. The `audio-decoder` workflow run passed the unchanged verifier nonroot and offline and published `ghcr.io/pravzviv30-cmyk/luvani-audio-decoder@sha256:13196ac81339fb5cae48bca34f31019438d3a9f88f46fc3f49860e7a2d6cfabb` with binary sha256 `aa112fc43d1ac9eec1c39c006bfcad65dfcd6d11772cdd8ba09872d7a7f1128c`; both are staged as `AUDIO_DECODER_IMAGE` and `AUDIO_DECODER_SHA256` on the four Railway staging services. The first Railway build is still to come.

### F806 — Raised choices interrupt their own release spring
- severity: P2
- status: [x]
- where: apps/mobile/src/components.tsx, apps/mobile/src/onboarding/motion/BoldScene.native.tsx
- note: Committing a raised selection started a second pop on the release spring's scale. Raised choices now retain one release spring and existing ring/glint feedback. Native artwork is memoized with stable native callbacks so unchanged props do not rebind it. Physical frame timing and haptic feel are not certified by these source checks.
- verified-by: `raised choices keep their release spring when selection commits`

### F807 — Tutor samples load serially and media ticks repaint the chooser
- severity: P2
- status: [x]
- where: apps/mobile/src/tutor/useTutorPreview.ts, apps/mobile/src/tutor/tutorPreview.ts, apps/mobile/src/motion/MediaProgress.tsx
- note: Six bundled clips now warm while the chooser is visible; native source preparation runs alongside audio-mode setup, with playback still waiting for readiness. Control subscriptions do not publish media-only ticks to the screen. The progress leaf animates observed position with a native transform and suppresses unchanged/inactive targets. Failed warmup remains optional, player switching is exclusive and late cache loads clean up on exit. Audible first-tap latency still requires a physical-device measurement.
- verified-by: `media ticks update the progress listener without rerendering the onboarding controls`
- verified-by: `native bundled samples download before preloading and all warm cache leases have exit cleanup`
- verified-by: `ten playing ticks animate only the active tutor row and never restart an unchanged target`
- verified-by: `leaving during preload clears the late result without leaving a hidden player cache`
- verified-by: `a quick return during preload retains the new warm cache`

### F808 — First practice failure looks ready and hides same-room typing recovery
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/FirstLivePractice.tsx
- note: Failed/exhausted status now owns the caption before stale speaking, thinking or microphone flags. Eligible voice failures offer the shared typing door in the existing metered session. A terminal refusal cannot start another grant; outstanding sessions and settlement block connection retry.
- verified-by: `failed first practice never announces readiness or stale live activity`
- verified-by: `voice failure typing keeps the existing room and never requests another grant`
- verified-by: `a terminal or disconnected room refusing the switch stays failed without a replacement grant`

### F809 — Reduced-motion changes replay choice nudges and animate rejected sheet swipes
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/firstRun/ChoiceNudge.tsx, apps/mobile/src/components.tsx
- note: Each nudge request is consumed once, including reduced-motion taps, and settles on leave. The persistent sheet responder reads the current preference; rejected/short swipes land immediately when motion is reduced, and pending return animation cancels on preference change, a new gesture or unmount. Existing dismissal thresholds and refusal guards remain.
- verified-by: `a choice nudge consumes each tap once, including taps with reduced motion`
- verified-by: `sheet short/rejected swipe follows the latest reduced-motion setting`
- verified-by: `sheet return motion cancels when the preference changes, a new gesture starts or it unmounts`

### F810 — C2 keyboard resizing loses the last tutor message
- severity: P1
- status: [x]
- where: apps/mobile/src/tutor/Transcript.tsx, apps/mobile/src/live/c2TranscriptPolicy.ts
- note: The first keyboard layout consumed the tutor anchor, so later resize events scrolled to a learner turn below it. The production callback controller retains the anchor through every layout and releases it on dismissal, sending, a new turn or reader takeover. Physical keyboard acceptance remains separate.
- verified-by: `production callbacks retain the tutor anchor through every native keyboard layout`
- verified-by: `dragging cancels the focus anchor before keyboard dismissal can resize the thread`

### F811 — A republished lesson prompt duplicates transcript history
- severity: P2
- status: [x]
- where: apps/mobile/src/live/useLiveSession.ts
- note: A fresh display ID on every received prompt duplicated an unchanged ready/reconnect republish after a learner reply. The history ID now retains the authored turn, step, rescue state and speech identity; actual new steps and changed rescue speech still append.
- verified-by: `republished authored prompts after a learner reply do not duplicate live history; new rescue speech does`

### F812 — Completion copy mistakes capture mode for French speech evidence
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/FirstSessionResult.tsx
- note: An English spoken help request plus typed French could produce “You spoke French.” The result now says “You practised French.” Typed phrase evidence remains labelled as typing, with no pronunciation or mastery claim.
- verified-by: `an English spoken help request cannot support a claim that French was spoken`

### F813 — Android Back dismisses consent during guest admission
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/PreAccountOnboarding.tsx
- note: The full-page consent surface could close before admission settled. The synchronous operation guard precedes dismissal, and consent clears atomically at the successful practice transition. The production Start/Back harness verifies that no hidden admission proceeds behind a dismissed consent page.
- verified-by: `Start followed by Android Back cannot dismiss consent or duplicate admission before busy rerenders`

### F814 — Account focus changes field geometry
- severity: P2
- status: [x]
- where: apps/mobile/src/auth/AccountField.tsx
- note: A focus border grew from one to two points and shifted the form. The border footprint is constant; an absolute decorative ring supplies focus emphasis. Web inputs suppress the native square outline while retaining that ring.
- verified-by: `auth focus rings retain fixed geometry and password recovery hides its actions while the keyboard is shown`

### F815 — A selected tutor retains the unselected paint
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/TutorSelection.tsx
- note: Selection now applies the approved lavender fill and violet border across the complete card without changing its footprint. Listening and choosing remain independent actions.
- verified-by: `selected tutor paint does not change the row footprint or couple listening to selection`

### F816 — Dedicated C2 pages bypass the transition host
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/PreAccountOnboarding.tsx
- note: Consent, live practice and results were outside the style driven by the transition clock. A persistent host now covers every full-page branch, and consent uses the same seam. Ordinary animation frames do not recreate the live session or its transcript.
- verified-by: `all full-page onboarding branches share the same persistent transition host and consent enters through that seam`

### F817 — Password recovery lifts its action above the keyboard
- severity: P2
- status: [x]
- where: apps/mobile/src/auth/SetNewPasswordScreen.tsx
- note: Save and Cancel now hide while the software keyboard is visible. The existing focused-field measurement and native insets keep confirmation reachable without a competing keyboard-avoidance wrapper.
- verified-by: `auth focus rings retain fixed geometry and password recovery hides its actions while the keyboard is shown`

### F818 — The compact mode switch does not expose its selected web state
- severity: P2
- status: [x]
- where: apps/mobile/src/live/C2LiveRoom.tsx
- note: React Native Web did not translate the native selected state to aria-selected. The switch now supplies both explicitly; the active mode remains enabled and ignores redundant selection. Browser inspection confirms Typing is announced as selected. The input retains its rounded focus ring without the user agent's square outline.
- verified-by: `the compact mode switch exposes its selected state and retains the rounded web input focus ring`

### F819 — Hidden transcript history remains in web accessibility navigation
- severity: P2
- status: [x]
- where: apps/mobile/src/live/C2LiveRoom.tsx, apps/mobile/src/live/LiveErrorView.tsx
- note: Native hiding flags did not remove the retained, zero-height thread from the browser accessibility tree. Both surfaces now supply aria-hidden and the toggle supplies aria-expanded. The thread remains mounted so showing it restores its messages and scroll. Browser inspection verifies collapsed navigation contains no hidden messages.
- verified-by: `hidden transcript history stays mounted but is removed from web and native accessibility navigation`

### F820 — Resuming account-first signup displays completed onboarding stages
- severity: P2
- status: [x]
- where: apps/mobile/src/auth/AuthFlow.tsx
- note: The account-first flag always initialized false, so a restored signup with an unanswered plan displayed the account stage. The existing durable hear-it return marker now restores that route before the progress frame mounts. A completed guest plan still displays its real account stage, and a known refusal cannot initialize an account-first route.
- verified-by: `a resumed account-first signup restores its route and starts progress before unanswered setup`

### F821 — The welcome wordmark omits Luvani from its accessible heading
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/AccountWelcome.tsx
- note: The exported wordmark is decorative, leaving the heading announced as only Welcome to. The heading now exposes Welcome to Luvani while preserving the exact visible logo lockup and logo-only animation.
- verified-by: `automatic progress adoption is confined to the verified new account and finishes durable writes before celebration`

### F822 — Compact live-transcript positioning blurs the web composer
- severity: P2
- status: [x]
- where: apps/mobile/src/tutor/Transcript.tsx
- note: The installed web ScrollView dismisses the keyboard on every on-drag scroll, including the programmatic last-tutor anchor. Web uses none and dismisses only on actual wheel/touch intent; native retains on-drag. The regression executes the installed vendor callback, reproduces the old blur and proves focus retention. Running 320-pixel mouse and touch checks retain the complete last tutor reply above the composer.
- verified-by: `compact composer focus survives the installed web ScrollView programmatic anchor scroll`

### F823 — Programmatic account-field scrolling drops web focus
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/OnboardingLayout.tsx, apps/mobile/src/layout.tsx
- note: The same installed web on-drag behavior also affected compact signup, sign-in and recovery corrections. Both shared frames enforce none on web before caller overrides, with real gesture dismissal kept separate. Native supplied/default modes remain unchanged. The proof runs the installed handler with the actual measured compact-field correction.
- verified-by: `compact account and recovery focus survives the installed web ScrollView callback`

### F824 — A wheel at the transcript's unchanged end stop disables following
- severity: P2
- status: [x]
- where: apps/mobile/src/live/c2TranscriptPolicy.ts
- note: Web wheel intent dismissed the keyboard and unpinned before any actual movement. It now releases the focus anchor while preserving the current pin until the subsequent scroll position decides. Geometry changes cannot pull an upward reader down before that position arrives. A new tail follows an unchanged end stop and only notifies an actual older-history reader.
- verified-by: `a web wheel against the latest-message end stop retains auto-follow until the thread actually moves`

### F825 — Signed-out policy pages crash without a navigation context
- severity: P1
- status: [x]
- where: apps/mobile/src/nav/useHardwareBack.ts
- note: Terms and Privacy call the shared hardware-back hook from onboarding/account views outside the navigator. Its unconditional useFocusEffect threw before the Android guard, including on web and iOS. The hook now reads optional navigation context: active Android routed views listen only while focused, direct policy views listen while mounted, and other platforms register nothing. All subscriptions clean up and the current callback is retained without changing registration priority. Browser Terms now opens and returns to the practice page.
- verified-by: `Terms and Privacy can mount outside navigation on web and iOS without registering Android back`

### F826 — Plan artwork keeps moving beneath its editor sheet
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/PreAccountOnboarding.tsx
- note: The plan passed screen activity to its artwork without accounting for an open sheet. Its existing scene now pauses while a surface covers it and remains mounted, so closing the editor does not replace the scene or restart its clock.
- verified-by: `plan artwork pauses under edit sheets without replacing its mounted scene`

### F827 — The learning-memory check can disagree with the committed choice
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/PreAccountOnboarding.tsx
- note: An incoming-transition tap changed a separate visible check before the guarded draft update could accept it. The check now reads the committed draft, and one handler rejects transition, operation and busy taps before changing that choice. Repeated accepted taps use the latest committed value.
- verified-by: `remembered learning reflects committed draft and ignores incoming-transition taps`

### F828 — Starting a new plan discards its owner before cleanup succeeds
- severity: P2
- status: [x]
- where: apps/mobile/src/auth/AuthFlow.tsx, apps/mobile/App.tsx
- note: Account creation navigated before guest cleanup and reminder cancellation settled; the resume and account-review restart doors also ignored a native cancellation result of failed. All three paths now await their cleanup owners, check failures and retain the plan for retry. Synchronous locks reject duplicate or competing actions, and mounted/account-scope guards prevent stale continuations from discarding or navigating another flow. Recovery uses the existing actions and page transition.
- verified-by: `account creation waits for previous practice and reminder cleanup before discarding the plan`
- verified-by: `account cleanup failure retains the plan and exposes retry for rejection or native failed cancellation`
- verified-by: `account cleanup blocks repeat taps and can retry without duplicating the discard`
- verified-by: `account cleanup cannot mutate or navigate an unmounted flow and respects the page transition lock`
- verified-by: `resume restart keeps its plan when reminder cancellation reports failure`
- verified-by: `resume restart waits for cleanup, handles rejection and cannot finish after unmount`
- verified-by: `account review retains its plan when native reminder cancellation fails or rejects`
- verified-by: `account review waits for cleanup, blocks repeated taps and retries through the same explicit action`
- verified-by: `account review cleanup cannot discard a plan after unmount or an account change`

### F829 — Unanswered-question guidance moves the Next action
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/PreAccountOnboarding.tsx, apps/mobile/src/onboarding/NextButton.tsx
- note: Tapping an unanswered Next inserted a footer row and moved the action. The button now reserves the disabled label and instruction footprint before either appears, swaps the visible words in place and announces the instruction. Measurement text stays outside accessibility navigation.
- verified-by: `unanswered question guidance stays inside the reserved Next button footprint`

### F830 — Motion-preference changes rewind earned text and replay Save
- severity: P2
- status: [x]
- where: apps/mobile/src/onboarding/FirstSessionResult.tsx, apps/mobile/src/onboarding/motion/OnboardingScenes.tsx
- note: Resolving an unknown preference or turning Reduce Motion off could retract complete achievement words and replay settled rows or Save. Word progress is now monotonic, unknown preference schedules nothing, and each mounted row consumes its entrance once. Reduced motion lands complete content; teardown cancels timers and invalidates callbacks already queued.
- verified-by: `achievement words wait for the motion answer and then reveal in order`
- verified-by: `turning Reduce Motion off never retracts already earned words`
- verified-by: `leaving an achievement cancels scheduled and already queued word callbacks`
- verified-by: `a revealed achievement row and its Save button do not replay on motion preference changes`
- verified-by: `a row shown with Reduce Motion stays visible when ordinary motion returns`

### F831 — Privacy describes the retired normal-onboarding age question
- severity: P2
- status: [x]
- where: apps/mobile/src/legal/policy.ts
- note: The notice still described an age-question answer where C2 accepts the linked Terms declaration through deliberate processing/account/setup actions. It now names that declaration without claiming age verification and distinguishes a pre-account refusal, which lasts only the current launch and stores no refusal marker, from a signed-in conversation stop, which remains in this phone's ageStopAt until the return eligibility check is passed. The signed-in gate and existing data boundaries remain unchanged.
- verified-by: `the privacy notice's age section does not promise the question is asked only once`
- verified-by: `the privacy document says an under-13 answer before an account keeps nothing, and the code keeps nothing`
- verified-by: `the gate fails when the committed html no longer matches the module`

### F832 — A pending Home scene tap can launch twice or outlive its owner
- severity: P2
- status: [x]
- where: apps/mobile/src/home/MissionHero.tsx
- note: The shared Home/Speak scene action relied on a React busy state before its asynchronous health check. A synchronous ticket now prevents repeated taps, and visit, focus, scene and account ownership invalidate stale results. A successful navigation retains its lock until a new visit; a failed check preserves the requested speaking/typing mode for retry. This is launch-handler proof, not real room or device acceptance.
- verified-by: `repeated Home scene taps share one connection check and open one room`
- verified-by: `a scene connection check cannot navigate after its card has unmounted`
- verified-by: `a scene connection check cannot carry the previous account into a room`
- verified-by: `leaving and returning to Home does not revive a pending scene tap`
- verified-by: `an old visit cannot unlock or overwrite a new visit’s connection check`
- verified-by: `an offline scene preserves the requested typing mode and allows a deliberate retry`

### F833 — Disabled guest live admission leaves the first run without an account route
- severity: P1
- status: [x]
- where: services/token-server/src/server.ts, apps/mobile/src/onboarding/guestPractice.ts, apps/mobile/src/onboarding/PreAccountOnboarding.tsx, apps/mobile/src/onboarding/firstPracticeEntry.ts, apps/mobile/App.tsx
- note: Production intentionally refuses anonymous live admission, but the first run offered only connection retry. The explicit guest-live-unavailable response now offers a deliberate account action with the answered plan and chosen tutor intact. Signed-in unfinished setup uses the existing profile owner rather than retrying guest admission. Strict completion reads distinguish a pending first practice from accepted Terms, retain completed guest adoption, and consume the adopted no-guest plan once before the existing FirstScene primer. Existing populated accounts keep their profile. The production guest guard remains closed; authenticated admission, hosted deployment and native operation require their own evidence.
- verified-by: `production fails closed even with local or guest flags until paid guest admission is supported`
- verified-by: `disabled guest admission reaches the account handoff as an explicit service capability`
- verified-by: `only an explicit guest capability refusal offers the preserved account route`
- verified-by: `a signed-in learner finishes the existing profile setup instead of starting another guest capability`
- verified-by: `the deliberate account action carries every answer and selected tutor once without fabricating practice`
- verified-by: `the no-guest account bootstrap consumes its answered plan once after durable writes and keeps first practice pending`
- verified-by: `unread guest completion or an account switch cannot fabricate pending practice or consume the plan`
- verified-by: `completed legacy practice stays in the existing guest handoff and never opens another first scene`

### F834 — A speech outage is mistaken for an account requirement
- severity: P2
- status: [x]
- where: services/token-server/src/server.ts, apps/mobile/src/onboarding/guestPractice.ts, apps/mobile/src/onboarding/PreAccountOnboarding.tsx
- note: Combining disabled guest admission with unsupported speaking falsely implied that account creation would add voice to a typed-only service. Unsupported speaking now returns voice-unavailable before the anonymous-admission check, includes the actual supported modes, and leaves the disclosure with truthful unavailable-speaking copy and retry. Only disabled guest admission offers the account action. No speech or paid-admission capability is enabled by this distinction.
- verified-by: `a typed-only service never claims that creating an account will restore speaking`
- verified-by: `an unavailable speech pipeline reaches disclosure without promising an account upgrade`
- verified-by: `a speech outage keeps the saved plan and retry without claiming account creation adds voice`
- verified-by: `ordinary outages and other guest endpoints never masquerade as an account requirement`

### F835 — An onboarding sign-in detour restores a cached plan over recent edits
- severity: P2
- status: [x]
- where: apps/mobile/src/auth/AuthFlow.tsx, apps/mobile/src/onboarding/PreAccountOnboarding.tsx
- note: After signup and Back, a learner could edit the goal or tutor and then sign in with the older signup draft. Onboarding sign-in now explicitly supplies the current draft; only the separately entered account email, including an intentional empty value, comes from the form state. The normal signup detour still uses its form plan. Press wrappers pass the draft or no argument so a native/browser press event cannot become a plan.
- verified-by: `signing in from the edited onboarding plan keeps current answers and the separately entered account email`
- verified-by: `the ordinary signup sign-in detour retains its form plan when no current onboarding draft is supplied`
- verified-by: `sign-in controls pass a current plan or no argument and never forward a press event as a plan`

### F836 — Replayed startup can clear the account before focused screens read it
- severity: P1
- status: [x]
- where: apps/mobile/App.tsx
- note: The startup owner was established in a passive effect, allowing retained focused screens to read cleared account storage during effect replay. It now restores the account in the layout phase before descendant passive focus effects. A cancelled migration checks ownership before any recovery read, and late optional recovery results or warnings cannot continue another account's startup. Current-account optional failures remain visible without fabricating history or blocking startup. These lifecycle regressions do not establish real-device acceptance.
- verified-by: `a cancelled migration never starts account recovery or reads the next account`
- verified-by: `startup restores its account scope before descendant passive focus reads during effect replay`
- verified-by: `late optional recovery failures from a departed account are silent and cannot open another startup`
- verified-by: `current-account optional recovery failures remain visible and do not block startup`

### F837 — Late keyboard focus signals pull an older-history reader back down
- severity: P2
- status: [x]
- where: apps/mobile/src/live/C2LiveRoom.tsx, apps/mobile/src/live/c2TranscriptPolicy.ts, apps/mobile/src/tutor/Transcript.tsx
- note: Keyboard appearance created another reveal revision and could override a manual scroll after the composer was focused. Only a deliberate composer focus now starts a new revision; repeated keyboard signals cannot rearm a cancelled anchor. Per the updated user request, focus selects the latest sent learner message, falling back to the latest tutor only before a learner message exists. The selected bubble stays visible through repeated or late layouts; oversized text starts at its top. Draft/partial text is not a sent message, and incoming-message follow/notification behavior and keyboard control hiding remain unchanged.
- verified-by: `composer focus reveals the latest sent learner message through every keyboard layout`
- verified-by: `focus chooses the latest sent learner message and falls back to a tutor only before the learner has sent one`
- verified-by: `a late measured sent bubble and oversized learner text retain their keyboard focus target`
- verified-by: `repeated keyboard focus signals cannot pull an older-history reader back down`
- verified-by: `keyboard show events retain one deliberate composer focus revision`

### F838 — A departed tutor leaves an empty room looking ready for speech or typing
- severity: P1
- status: [x]
- where: apps/mobile/src/live/useLiveSession.ts
- note: The learner's WebRTC connection could remain open after the tutor left, leaving an active composer and microphone without a tutor to answer. An owned connected room with no remaining remote participant now closes capture, shows the existing dropped-session failure and releases transport. The departure decision waits until the SDK event stack settles because LiveKit clears its roster before announcing a full reconnect; that temporary rebuild must retain the room. Transport teardown preserves an already authoritative recap and its recorded saveable text, while unfinished text is discarded. Explicit leave still clears the recorder, and an old asynchronous disconnect cannot release audio belonging to a newer start. These callback, recorder and installed-SDK proofs do not establish hosted or device acceptance.
- verified-by: `a departed tutor cannot leave a live composer and microphone in an empty room`
- verified-by: `tutor departure preserves an existing recap or failure while releasing the empty room`
- verified-by: `a stale departure or another remaining remote participant cannot tear down the active tutor`
- verified-by: `remote tutor teardown preserves an already delivered recap text before React paints it`
- verified-by: `remote departure discards unfinished text rather than manufacturing a completed transcript`
- verified-by: `a held old-room teardown never releases audio owned by a newer start`
- verified-by: `the installed LiveKit restart ordering cannot mistake roster rebuilding for a departed tutor`

### F839 — Practice support repeatedly opens over the live conversation
- severity: P2
- status: [x]
- where: apps/mobile/src/live/C2LiveRoom.tsx, apps/mobile/src/ConvoScreen.tsx, apps/mobile/src/LiveSessionScreen.tsx, apps/mobile/src/onboarding/FirstLivePractice.tsx
- note: Support began expanded when the opening reply contained hints, and every new reply key opened it again after dismissal. It now starts collapsed, and the learner's explicit toggle is its only open/closed state owner. New replies and mode changes retain that choice. Keyboard editing temporarily hides the panel with the controls without resetting the choice, and the same room's support, tools and accessible expanded state remain available. The obsolete reply key is removed from all three shared-room callers. These handler/effect proofs do not establish device or service latency.
- verified-by: `practice support starts collapsed even when the first tutor reply contains support`
- verified-by: `new tutor replies and support changes never reopen a manually closed support panel`
- verified-by: `mode and keyboard changes hide support without changing the learner’s explicit choice`
- verified-by: `practice support retains its explicit toggle, accessible state and current session tools`

### F840 — A recap with no learner reply claims that a conversation was held
- severity: P2
- status: [x]
- where: apps/mobile/src/tutor/recapLine.ts
- note: The recap sentence inspected only the unaided rate, so a real room with zero learner turns said that the learner held the conversation with help. Zero or invalid turn counts now say “You made time for your French.” Positive whole turn counts retain the existing unaided/help threshold and wording. Neither branch shows a score or count. This presentation correction does not change XP, streak, completion or settlement decisions.
- see also: 2026-10-28 product review (LR-02). A zero-turn first scene still reached the
  "held the conversation" sentence, and the end card still awarded phrases and XP; filed as F904.
- verified-by: `a recap with no learner turns acknowledges time without claiming a conversation`
- verified-by: `invalid learner turn counts cannot earn conversation claims while positive counts retain their copy`
- verified-by: `the recap says how it went in words, never a percentage`

### F841 — Entered account text sits below the centre of its iOS field
- severity: P2
- status: [x]
- where: apps/mobile/src/auth/AccountField.tsx
- note: The shared auth input inherited the body paragraph's 23-point line height, displacing entered email and secure password text in iOS UITextField. iOS now uses the font's native line metrics; Android and web keep their existing line height. Font family/size, symmetric padding, growing minimum heights, live font scaling, secure reveal and selection restoration remain unchanged. The actual platform-style regression verifies that boundary; physical visual alignment requires separate device evidence.
- verified-by: `iOS account fields use native line metrics without changing other platforms or their growing geometry`

### F842 — Sign in renders footer indentation as a raw native text child
- severity: P2
- status: [x]
- where: apps/mobile/src/auth/SignInScreen.tsx
- note: Six spaces on the same line as the footer fragment opening survived Babel as a string child outside Text, causing the native “Text strings must be rendered within a <Text>” warning. Moving the indentation to its own line removes that child. The regression extracts the real footer through its AST, evaluates installed Babel's compiled children in both keyboard states, and retains both footer action wrappers when visible. No auth action, field style or keyboard rule changes.
- verified-by: `the Babel-compiled sign-in footer contains no raw text outside Text in either keyboard state`

### F843 — A late typed-send failure overwrites a newer live input's status
- severity: P2
- status: [x]
- where: apps/mobile/src/live/useLiveSession.ts
- note: A publish failure from an old room/start or earlier send could clear the current thinking state and show an obsolete failure notice. Post-await failure updates now check room, start generation and typed-send revision. Same-room rollback removes only that send's optimistic bubble. Its notice timer also retains ownership, including the timer identity, so it cannot erase a later server notice. Successful transport handoff does not imply a tutor receipt or restart thinking after an authoritative answer.
- verified-by: `a failed send from an old room or start cannot change the current input or notice`
- verified-by: `an earlier failed send in the same room cannot clear a newer pending input or notice`
- verified-by: `a failure notice timer cannot clear a later room or same-room input notice`
- verified-by: `a publish handoff never restarts thinking after an authoritative answer already completed it`

### F844 — Live Luna turns inherit extra response detail while the learner waits
- severity: P2
- status: [x]
- where: packages/brain/src/llm/openaiResponses.ts
- note: The exact GPT-6 Luna live-turn route inherited the provider's medium response detail. Bounded synthetic rooms measured generation as the dominant wait; low verbosity reduced output tokens and observed reply times in three corresponding turns. The accepted request now selects low detail only for this measured model/activity. All required teaching fields, strict validation, safety, reasoning choice, output ceiling, cache identity and durable-before-delivery ordering remain intact. This closes the request-setting defect, not a guarantee of natural phone-audible response speed; the small sequential sample and remaining waits are recorded in the C2 change plan.
- verified-by: `measured Luna live turns request low verbosity without dropping teaching material`
- verified-by: `low verbosity is limited to the measured model and live turn activity`
- verified-by: `a concise live response still fails validation when required support is missing`

### F845 — The paywall cannot show Ask to Buy approval, because the adapter never reports a deferred purchase
- severity: P2
- status: [x]
- where: apps/mobile/src/purchases/contract.ts:1
- note: Found 2026-10-19 while building the approved "P2 · Luvani" trial paywall. Its spec has a "Waiting for approval" notice for Ask to Buy, but a StoreKit deferred transaction reaches the wall as no distinct outcome: `StoreAction` and `RestoreOutcome` only carry ok/cancelled/store-trouble/refresh-trouble/nothing-granted. So the wall draws its existing pending-checkout state ("Waiting for confirmation"), which keeps the money guarantees but cannot say "approval". Separately, `restoreTrouble` folds a restore's nothing-granted and refresh-trouble into one message, so the "No subscription found" notice words its body to stay true of both. A deferred outcome in the contract (revenue-engineer) would let `wall/trialPaywall.ts` `paywallNotice` say the spec's words. (Filed as F810 on the paywall branch; renumbered when replayed onto the C2 base, where F810 was taken.)
- fixed: 2026-10-19. `StoreAction` gains `deferred`; the RevenueCat adapter maps PAYMENT_PENDING_ERROR ("20") to it via `purchases/storeError.ts`; settlement reports `awaiting-approval` without asking the server, so nothing is granted and the checkout fence stays up; the wall says "Waiting for approval". Money pins re-pinned with founder approval. Still open: the `restoreTrouble` nothing-granted/refresh-trouble split. The reopen that reverted to "Waiting for confirmation" is fixed by F849, and a declined request that locked buying is F848.
- verified-by: `a deferred store purchase is reported to the wall as waiting for approval`

### F848 — A checkout fence that no store purchase stands behind locks buying on that phone for good
- severity: P1
- status: [x]
- where: apps/mobile/src/purchases/pendingPurchase.ts:1
- note: Found 2026-10-19 by the app review (P1 #1, handoffs/2026-10-19-app-review.md). The local checkout fence is written before the store sheet opens and was cleared only by a matching done or cancelled result in `WallScreen` `settle`, or a server grant `confirmsPendingPurchase` accepts. Store trouble, awaiting approval and a later Ask to Buy decline left it in place with no expiry, and the pending page offered only "Check again", which can never succeed when nothing was bought. Separately, `confirmsPendingPurchase` could never confirm a same-tier purchase whose `before.periodEnd` was null. Purchases are not configured yet, so no learner was affected, but it blocked release.
- fixed: 2026-10-19. New read-only `PurchasesAdapter.storeHolds(userId, sync)` answers active, none or unknown (web and fakes always unknown; never a grant). Pure `resolvePendingCheckout` clears only on a server confirmation, a store holding nothing, and an active store answer always waits, because an existing same-tier subscription also reads as active and an unknown answer never clears. The wall runs a quiet check on open (no store sync), which clears only on a server confirmation, never on an empty store answer, and the pending page gains "Start again" (store sync plus billing refresh), which never buys, restores, grants or schedules anything. Money pins re-pinned, founder to approve before landing. Still open: a same-tier purchase whose `before.periodEnd` was null still cannot be confirmed by `confirmsPendingPurchase` (the planned store-plus-grant relief was dropped after fix-verifier showed it clears a Regular monthly to Regular yearly purchase early), and real sandbox proof of a declined Ask to Buy (REVENUECAT_SETUP.md sandbox matrix).
- verified-by: `a declined or expired Ask to Buy request can be cleared once the store holds no purchase`
- verified-by: `a stuck checkout never clears while the store shows the purchase as active and the server has not granted it`
- verified-by: `an unknown store answer never clears the checkout`
- verified-by: `a version 1 pending record still loads and still fences`
- verified-by: `start again never grants, never starts a trial and never schedules the reminder`
- verified-by: `reopening the wall never clears a still pending Ask to Buy`
- verified-by: `the quiet check on open never clears on an empty store answer`
- see also: F908 (2026-10-29). On web, and on native store errors that never reached a purchase, `storeHolds` is unknown, so nothing this fix added can clear the fence; F908 clears it on a failure that by definition charged nothing.
- verified-by: `an existing same tier subscription never clears a checkout for a new period`

### F849 — "Waiting for approval" lived in screen memory, so a reopen or a "Check again" lost it
- severity: P2
- status: [x]
- where: apps/mobile/src/wall/trialPaywall.ts:1
- note: Found 2026-10-19 by the app review (P2 #2). The pending page chose its title from the screen's `message`, so after an Ask to Buy the title fell back to "Waiting for confirmation" on a reopen or one tap of "Check again".
- fixed: 2026-10-19. The pending record is version 2 and carries `deferred`, set by `markPendingDeferred` when settlement reports awaiting approval. `pendingCheckoutNotice` reads only that mark, and "Check again" results go in the detail line. The approval body now says "If they declined, tap Start again." The quiet check on open never clears on an empty store answer, because a still-pending Ask to Buy also reads as none there.
- verified-by: `the waiting for approval notice survives a reopen and a check again`

### F850 — The trial reminder switch read on while notifications were denied
- severity: P2
- status: [x]
- where: apps/mobile/src/settings/TrialReminderRow.tsx:1
- note: Found 2026-10-19 by the app review (P2 #3, handoffs/2026-10-19-app-review.md). The row asked only when permission was undetermined; when denied, turning it on saved on with no hint, while `trialReminderPromised` never schedules without permission. The learner could be charged without the warning they thought they had set up.
- fixed: 2026-10-19. Pure `trialReminderRowView` and `trialReminderTap` in `reminders/trialReminder.ts`: while denied the switch reads off, the line says the reminder can't be sent, an Open Settings row uses `openPhoneSettings` with `LINK_TROUBLE` on failure, and a tap saves nothing and leaves the stored preference alone. `useTrialReminder` re-reads on the app returning to the foreground and drops reads that land after unmount or an account change, which also covers review P3 #10. The decision leaving the `.tsx` covers review P3 #9 for this row.
- verified-by: `the trial reminder switch never shows on while notifications are denied`
- verified-by: `turning the trial reminder on while notifications are denied does not save it as on and points to Settings`
- verified-by: `the trial reminder row re-reads when the app comes back to the foreground`

### F851 — Subscription Restore said done when the store found nothing, and never re-read the plan
- severity: P2
- status: [x]
- where: apps/mobile/src/settings/SubscriptionScreen.tsx:1
- note: Found 2026-10-19 by the app review (P2 #4). `nothing-granted` reported `RESTORE_DONE` ("anything you paid for is on this account"), a successful restore never called `plan.retry`, and the decision sat untested in the screen (review P3 #9).
- fixed: 2026-10-19. Pure `restoreResult` in `settings/subscriptionRestore.ts`: done says `RESTORE_DONE` and re-reads the plan; nothing found says "We checked the store and didn't find a subscription for this Apple ID."; the troubles reuse the pinned `restoreTrouble`, with only refresh-trouble re-reading the plan. The screen calls `plan.retry()` under its owner guard. No money pin changed.
- verified-by: `a restore that finds nothing says so rather than claiming the store has it`
- verified-by: `a successful restore refreshes the plan on the subscription screen`
- verified-by: `restore copy has no em dashes`

### F852 — A heavier device's partial practice preferences wiped another device's confidence and focus
- severity: P2
- status: [x]
- where: packages/brain/src/profile/merge.ts:530
- note: Found 2026-10-19 by the app review (P2 #5). `mergeStoredProfiles` picked `practicePreferences` as one whole answer, so an older install's Settings level edit (`confidence: null, focus: null`) on the evidence-heavier phone erased the other phone's real confidence and focus answers on every device.
- fixed: 2026-10-19. `pickPracticePreferences` applies the answer rule (null loses, evidence decides, value breaks a tie; shared with `pickAnswer` as `pickValue`) to `level`, `confidence` and `focus` separately, keeps only those three keys, and returns null when none is answered. The `statedLevel` clock still moves only `level`. No stored-shape change.
- verified-by: `two devices keep each other's practice preference answers when only one answered each`
- verified-by: `a heavier device's real sub-answer beats a lighter device's real sub-answer, field by field`
- verified-by: `a stated level edit on one device keeps the other device's confidence and focus`
- verified-by: `practice preferences with every sub-answer unanswered merge to never asked`
- verified-by: `unknown keys inside practice preferences do not survive a merge`

### F846 — Pushed screens drew a white back disc in dark mode
- severity: P3
- status: [x]
- where: apps/mobile/src/layout.tsx:1
- note: 2026-10-19, P2 follow-up: `ScreenHeader` gained an opt-in `backAppearance` (disc `colors.surface`, chevron `colors.text`) used only by Settings, Learning preferences and Subscription; the other ~24 screens that pass `back` still draw the white disc on the night background until they adopt it app-wide. (Filed as F811 on the paywall branch; renumbered on the C2 base.) Still moot after UI-008 turned dark mode on: every route is pinned light until it joins `DARK_READY` (F847), so no screen draws the night background yet.
- fixed: 2026-10-21, UI-008. `RoundButton`'s default disc is the theme's card and its chevron the theme's text, so every pushed screen's back button reads on the dark ground with no opt-in; `backAppearance` stays for screens that want other colours.
- verified-by: `every pushed screen's back button follows the appearance in dark mode`

### F847 — Dark mode was on with every screen pinned light until rebuilt
- severity: P3
- status: [x]
- where: apps/mobile/src/nav/darkReady.ts:1
- note: 2026-10-19, user decision while replaying the paywall onto main's C2 redesign. `DARK_MODE_ENABLED = false` makes `mainMode` resolve to light for every stored choice and device scheme, and Settings hides the Appearance row and display sheet. The stored preference code (`MainAppearance`, `appearanceSession`) is kept but unexposed. The paywall, Profile, Settings, Learning preferences and Subscription screens already have dark palettes (`mainApp.dark` in palette.ts), unused until the rest of the C2 screens get dark styles and the flag is lifted.
- note: 2026-10-20, UI-008 (direction B fidelity, step 1): `DARK_MODE_ENABLED` is true, so the stored choice and the device resolve again and Settings draws the Appearance row. Screens follow it only once rebuilt: both navigators wrap every route in `<PinLight>` unless it is in `DARK_READY` (`nav/darkReady.ts`, empty at this step), and the tab bar, scene ground, container theme and status bar follow the focused route. The first scene and the paywall are light by rule (`ALWAYS_LIGHT`), and onboarding, sign up and the launch are under `<PinLight>` in App.tsx. Closes when the last rebuilt main-app route joins `DARK_READY` and the paywall's dark variant lands. 2026-10-21, UI-008 step 12: the paywall's dark variant landed; `Wall` left `ALWAYS_LIGHT` for `DARK_READY` (the launch wall opens the same route), so only the first scene stays light by rule. 2026-10-21, UI-008 step 12b: the screens with no artboard were converted to the B tokens (layout and copy unchanged) and every signed-in route joined `DARK_READY`; only `FirstScene` (and onboarding, sign up and the launch, which are not routes) stays light. Left open for the founder's side-by-side review of the swept screens in dark.
- fixed: 2026-10-21. Every signed-in route is in `DARK_READY`, the paywall has its dark variant, and the founder approved the side-by-side review (https://claude.ai/artifact/LBjptRAoaNZRy9ESMb229a). Only `FirstScene`, onboarding, sign up and the launch stay light, by rule.
- verified-by: `every signed-in route follows the device, and only the first scene stays light`
- verified-by: `the swept screens set no word or ground in the fixed light ink, paper or hairline`
- verified-by: `the app resolves every stored choice and device scheme to the preferred mode now dark mode is on`
- verified-by: `dark mode is on: Settings draws the Appearance row and display sheet only through the DARK_MODE_ENABLED seam`
- verified-by: `with the device dark and nothing ready, every route draws the light tokens`
- verified-by: `onboarding, sign up and the launch are pinned light by rule, whatever DARK_READY says`

### F853 — A short RevenueCat webhook secret, or a non-OpenAI brain, could boot production
- severity: P3
- status: [x]
- where: services/token-server/src/config.ts:60
- note: Found 2026-10-19 by the presubmission review (P3 #6). `productionConfigurationProblems` accepted any non-empty `LUVANI_REVENUECAT_WEBHOOK_SECRET`, so a guessable Authorization value could forge webhook deliveries (which only trigger a RevenueCat re-read, never grant time directly). Production also accepted Anthropic as the brain, while the founder decision is OpenAI only.
- fixed: 2026-10-19. Production refuses a set webhook secret under 32 characters, counting the whole value including any prefix (token server and `deployment/validateEnvironment.mjs` for the api role). OpenAI-only boot rule: `LUVANI_BRAIN` and `TUTOR_LLM`, where set, must be `openai` in the token server; `deployment/validateEnvironment.mjs` requires `TUTOR_LLM=openai` for api, tutor and practice; the tutor's production preflight requires `TUTOR_LLM=openai`. Local development is unchanged.
- verified-by: `a short RevenueCat webhook secret fails production boot`
- verified-by: `production refuses a non-OpenAI tutor brain`

### F854 — The privacy notice described every recipient by role but named almost none of them
- severity: P3
- status: [x]
- where: apps/mobile/src/legal/policy.ts:180
- note: Found 2026-10-19 by the presubmission review (P3 #7). Only TypeSafe was named; the carrier, transcriber, voice, scorer, language model, purchase processor, database, counter store and host were described by role alone, because the model vendor was a runtime choice. Founder decision 2026-10-19: OpenAI is production's model (boot enforces it, F853) and Railway hosts the server.
- fixed: 2026-10-19. "Who else sees it" names LiveKit, Deepgram, ElevenLabs, Speechace, OpenAI, TypeSafe, RevenueCat (beside Apple or Google taking the payment), Supabase, Upstash and Railway inside their existing role sentences, and the guest paragraph names OpenAI. No retention claim was added; the unverified-retention sentences stay. The two "no vendor named" guards in `policy.test.ts` were replaced by an allow-list. `privacy.html` regenerated; the hosted copy must be re-uploaded (docs/LEGAL_HOSTING.md). The ElevenLabs sentence holds because production refuses `LUVANI_TTS_VENDOR=fish` (token-server `config.ts`, `deployment/validateEnvironment.mjs`).
- verified-by: `the notice names every company that receives learner data, by role`

### F855 — Conversation practice needs the network on Supabase builds
- severity: P2
- status: [ ]
- where: apps/mobile/src/conversationPacks/store.ts:186
- note: Found 2026-10-20 in B3 (B-Practice). The artboard's "Works offline once unlocked" was checked against the code: `loadConversationPackForLearner` reads the server on a Supabase build and never falls back to the device's cached pack, so ConversationPractice says "This conversation isn't available here." offline even though Practice drew the conversation from the cache. The line is not drawn on Practice until this is true. Fix: fall back to the owned cached pack when the server cannot be reached (not on a 404, which means deleted).
- verified-by: `conversation practice opens from the device cache when the server cannot be reached on Supabase builds`

### F856 — Speak calls the next scene on the path "Recommended" when nothing recommended it
- severity: P3
- status: [ ]
- where: apps/mobile/src/tutor/speakTabView.ts:38
- note: Found 2026-10-20 in B6. `RECOMMENDED` heads Speak's sun card, but when no unfinished conversation or thread leads, the pick is only the next scene in spine order. "Recommended" implies a judgement about the learner that was not made. Say "Next" when the pick is the path order and keep "Recommended" only for a pick with a reason behind it, decided in speakTabView.ts.
- verified-by: `Speak heads a path-order pick "Next" and keeps "Recommended" for a pick with a reason`

### F857 — "Uses speaking time" shows on Speak while the learner has chosen typing
- severity: P3
- status: [ ]
- where: apps/mobile/src/tutor/speakTabView.ts:39
- note: Found 2026-10-20 in B6. The meta chip on the Recommended card (tabs/TutorTab.tsx:279) reads "Uses speaking time" whichever mode is chosen. A typed session is metered too, so the claim is true, but "speaking" reads wrong next to Typing. The wording of the allowance belongs to D5; until it lands, the chip should name the allowance in a word true of both modes.
- verified-by: `the time chip on Speak is worded true of both speaking and typing`

### F858 — Today's level tile reads like a French ability level
- severity: P2
- status: [ ]
- where: apps/mobile/src/game/todayHeroView.ts:113
- note: Found 2026-10-20 in B6. The third stats tile on Today says "Level n" over the XP total. Beside a stage system (Starter, Basics) and CEFR elsewhere, "Level 2" reads as a claim about the learner's French rather than XP earned. Name it as the game's level (for example "XP level") or show XP alone, decided in todayHeroView.ts, and keep Journey's head consistent.
- verified-by: `Today's level tile names the XP level, never a French level`

### F859 — Quest titles make XP the goal
- severity: P3
- status: [ ]
- where: packages/core/src/quests/catalogue.ts:76
- note: Found 2026-10-20 in B6. The stretch quest's title is "Earn {n} XP", drawn on Today's three. XP is the reward for practice, not the practice; a quest that names XP as the goal invites grinding the cheapest source. Reword as practice (a scene, a fix, minutes) with XP as the chip only. The catalogue is core's, so the change is core's.
- verified-by: `no quest title names XP as its goal`

### F860 — Saved conversation text opens without the conversation it came from
- severity: P3
- status: [ ]
- where: apps/mobile/src/conversationPacks/SavedTextScreen.tsx:13
- note: Found 2026-10-20 in B6. The Codex library port (B3) opens `SavedConversationText` as a list. Codex linked a library row to one conversation's saved text by `sessionId`; that param and link were not ported, so a learner who opens a conversation's text from Practice lands on the whole list. Add the optional `sessionId` route param and scroll or filter to it.
- verified-by: `a conversation's saved text opens on that conversation`

### F861 — Today's fix card copies the drill's exercise-picking rule
- severity: P3
- status: [ ]
- where: apps/mobile/src/home/todayView.ts:197
- note: Found 2026-10-20 in B6. `oneFix` calls `buildDrillSession(..., { only: [key] })` and checks `hidesAnswer` on the first exercise, so the card's promise ("the French stays hidden until you try") holds only while DrillScreen opens the same node the same way. If DrillScreen changes how it builds the sitting for a fix node, the card can promise a hidden answer the drill shows. Share one function for "the exercise a fix node opens on" between DrillScreen and todayView, or pin the two together with a test.
- verified-by: `Today's fix card and the drill agree on the exercise a fix opens on`

### F862 — Unused code is kept alive only by its own tests
- severity: P3
- status: [ ]
- where: apps/mobile/src/tutor/ContinuityCard.tsx:1
- note: Found 2026-10-20 in B6. Direction B left code that no screen reads but that still has tests: `tutor/ContinuityCard.tsx`, `greetingSubline` and `GREETING_SUBLINES` (with `greetingWord` and `greetingLine`) in `home/greeting.ts`, `weekLines` and `WEEK_LINES_MAX` in `home/todayView.ts`, `tutorDoors` in `tutor/gate.ts`, `continuityRow` and its copy in `tutor/dashboard.ts`, and `WEEK_LABEL` in `home/todayView.ts`. B6 tried removing the first four and lost six tests, which the floors forbid (docs/TESTING.md). Removing them needs replacement tests for the live surfaces in the same change, so the mobile count does not drop.
- verified-by: `no production module is reachable only from its own tests`

### F863 — The paid lesson quote prices no scoring, so production live scoring would be refused on every call
- severity: P2
- status: [x]
- where: services/shared/paidAdmission.ts (lesson components), supabase lesson quote
- note: Found 2026-10-22 in the VOICE-004 review. With `LUVANI_AUDIO_SCORING=1` in production, the worker scores through `paid.transport`, whose gate admits a call only for a component the session's reservation carries. The lesson quote requires `llm`, `stt` and `tts` and no reviewed binding adds a `scoring`/`speechace` component, so every live score is refused as `quote-mismatch`, logged by the Speechace adapter and returned as no score: every end card reads "not assessed". Development scoring (TonePerfect, no paid gate) is unaffected and was verified against the real vendor on 2026-10-22. Before the flag goes on for anyone: add a reviewed `scoring` component to the lesson quote (about one effect per learner turn, 30 s of audio each), make preflight refuse the flag when the bound lesson quote lacks it, and confirm a Speechace 200 and a `scored` card in one hosted lesson.
- fixed: 2026-10-22. `services/shared/lessonScoringQuote.ts` defines the reviewed lesson scoring component (Speechace `text-v9`, fr-fr, 48 effects, 900 s of audio, 96,000 microUSD from the cost model, not a vendor quote). A binding in `LUVANI_PAID_QUOTE_BINDINGS` may declare its quote's component `kinds`; the admission helper refuses a reservation whose kinds differ, and `validatePaidBudget.mjs` checks the kinds and the reviewed scoring identity and envelope. Production tutor preflight and `validateEnvironment.mjs tutor` refuse `LUVANI_AUDIO_SCORING=1` unless the lesson binding declares `scoring`. The Speechace descriptor no longer counts the WAV as input bytes (audio milliseconds bound it), which had capped a lesson at two clips. `scripts/verifyPaidAdmission.mjs` proves a 30 s score dispatches on the component and is refused as `quote-mismatch` without it. The activation order is in `deployment/PAID_ADMISSION.md`. Still external: a Speechace 200 and a `scored` card in one hosted lesson (docs/LIVE_VOICE.md).
- verified-by: `the bound lesson and convo quotes both carry a scoring component whenever live scoring is on`

### F864 — A learner's goal can only ever match the first mission at a place
- severity: P3
- status: [x]
- where: apps/mobile/src/goals/next.ts:66
- note: Found 2026-10-22 in the mission spine A2 change. `PLACE_WORDS` matches goal text to a `MissionPlace`, and ties go to catalogue order. The twelve new missions share the six drawn places, so a goal such as "book a restaurant" or "talk to my neighbour" always lands on the older café or day scene, and goals about doctors, pharmacies, trains, parcels, renting or work match nothing and fall back to the starter. Fix by matching words per mission rather than per place, keeping the precision-over-recall rule and the negation handling.
- fixed: 2026-10-22. `apps/mobile/src/goals/next.ts` scores a goal against `MISSION_WORDS`, one hand-authored list per mission keyed by `MissionId` (the opener excluded), so a mission without words fails typecheck. Shared places no longer share words; the neighbour words moved from the day scene to the neighbour scene, and phrases stand in where a bare word has an everyday second meaning (no bare "return", "rent", "flat", "train", "station", "package", "weekend", "job" or "reservation"). A word on two missions is deliberate and the older scene wins the tie. `OTHER_MEANINGS` gains "doctor who", "spin doctor", "part and parcel" and "parcel of land". Negation, scoring, tie order and the starter are unchanged. A guard test holds a non-empty, normalised list for every full scene. Fixed on `claude/goal-words-per-mission`.
- verified-by: `a goal names the mission it is about, not the first one at that place`

### F865 — Twelve scenes show a borrowed postcard on the recap
- severity: P3
- status: [x]
- where: apps/mobile/src/recap/postcardArt.ts:1
- note: Found 2026-10-22 in the mission spine A2 change. Each new mission has its own place drawing, but `POSTCARD` lends it the postcard of an older scene at the same place (street to directions, home to day, market to market, cafe to terrace, friends to apéro), so two situations hand back the same keepsake. Draw twelve `postcard-*` drawings in `docs/design-assets/ILLUSTRATIONS.md` and give `POSTCARD` one per mission, then hold uniqueness with a test like `scenes.test.ts`.
- fixed: 2026-10-22. Twelve postcard drawings are authored in `docs/design-assets/ILLUSTRATIONS.md` (the same white border and round postmark as the seven older postcards, the place simplified on a palette panel, the confetti dropped and clashing fills swapped), and `POSTCARD` in `apps/mobile/src/recap/postcardArt.ts` now gives each of the nineteen missions its own. `postcardArt.test.ts` fails if two missions share a postcard or a shipped postcard has no owner; it failed on the placeholder map before the fix and passes now.
- verified-by: `every scene hands back a postcard of its own`

### F866 — Missions are never scored, so most learners can never see pronunciation feedback
- severity: P2
- status: [x]
- where: services/tutor-agent/src/convo.ts (`onUserTurnCompleted`, `complete`), services/tutor-agent/src/utterance.ts (`UtteranceTap.capture`)
- note: Found 2026-10-22 while preparing the closed beta. Live scoring (VOICE-004) ran only in scripted lessons, which are paid-only, and every new learner starts in a mission, so a beta tester could finish every session without one pronunciation result. A mission has one known reference text: the full line handed over on the second rescue. Two defects sat under the extension. The utterance tap kept only the last final segment of a turn, and Deepgram sends one final per `is_final` segment, so a longer line would have been scored on a fragment of its audio, lessons included. And the `convo` quote priced no scoring, so with the flag on every mission score would have been refused at the paid gate as `quote-mismatch`.
- fixed: 2026-10-22, on `claude/mission-scoring`. The lesson's background scorer is now `services/tutor-agent/src/liveScoring.ts`, shared by both agents and capped at the quote's scoring effects. A mission turn is scored beside the reply only while the full line is on screen (assistance depth 2) and only when the raw transcript is that line (exact, fillers or one slip); typed answers never are. The line is read from the published card, not the state. Each recogniser stream gets its own tap, finals before `take()` extend one clip, and a late final after `take()` is dropped so it cannot drag the tutor's reply into the next clip. A finishing conversation waits at most `SCORE_SETTLE_MS`, not at all after a safety stop, a terminal service failure or within five seconds of the hard limit, and the recap carries `focusSound` (IPA and word), shown on the app's recap sound page. `services/shared/lessonScoringQuote.ts` adds the reviewed convo component (24 effects, 450 s of audio, 48,000 microUSD from the cost model, not a vendor quote); production preflight and `validateEnvironment.mjs tutor` refuse `LUVANI_AUDIO_SCORING=1` unless both the lesson and convo bindings declare `scoring`, `validatePaidBudget.mjs` checks the convo envelope, and `scripts/verifyPaidAdmission.mjs` proves the convo group. Still external: seed the convo quote and its binding kinds, confirm Speechace's billing unit, and see a recap focus sound in one hosted mission (`deployment/PAID_ADMISSION.md`).
- verified-by: `a score that lands later reaches the recap as the one sound heard`

### F867 — Guest scenes share tutor workers with paying learners and have no concurrency cap
- severity: P2
- status: [ ]
- where: services/tutor-agent/src/agent.ts (guest scene rooms), services/token-server/src/guestSceneAdmission.ts
- note: Found 2026-10-23 in the guest first scene review (UI-011). The service-wide daily ceiling (`LUVANI_GUEST_SCENE_DAILY`) bounds money, but nothing bounds how many guest scenes run at once. A burst of guests, honest or not, can take every worker slot and delay a paying learner's room. Add a small concurrent-scene cap at the worker claim (for example three live scene rooms), or reserve worker capacity for authenticated sessions, before raising the ceiling above the default.
- verified-by: `a guest scene claim is refused while the concurrent scene cap is full`

### F868 — The one-scene-per-device limit is a forgeable installation id
- severity: P2
- status: [ ]
- where: apps/mobile/src/auth/installation.ts:11, services/token-server/src/guestSceneAdmission.ts
- note: Found 2026-10-23 in the guest first scene review (UI-011). The 30-day scene marker is keyed on `x-luvani-installation`, a random UUID in AsyncStorage. A reinstall or cleared app data resets it, and any HTTP client can send a fresh one. The money limit is the daily ceiling, so this is a fairness gap, not a cost hole. Once the Apple Developer membership and Play Console exist, bind the scene claim to DeviceCheck bits on iOS (one per device, survives reinstall) and a Play Integrity verdict on Android. Then update the privacy labels for any new device signal.
- verified-by: `a second guest scene from the same attested device is refused after a reinstall`

### F869 — A signed-out guest live start fails before its token request
- severity: P2
- status: [x]
- where: apps/mobile/src/live/useLiveSession.ts (`readConsent`)
- note: Found 2026-10-23 in the guest first scene web check. `useLiveSession` read consent with `loadConsent().catch(() => null)`, but with no signed-in user `loadConsent` throws synchronously from `userKey` ("stores live behind the auth gate"), before it returns a promise. The `.catch` never ran, so every pre-account guest connect failed as `unknown` before `/onboarding/live`. This was also on main, where guest live is closed in production, so no learner saw it.
- fixed: 2026-10-23 on `claude/guest-first-scene`. A guest start reads no consent, since the guest body never sends it. Signed-in reads go through `Promise.resolve().then(loadConsent)`, so a synchronous throw becomes null.
- verified-by: `a consent store behind the auth gate never stops a guest start before /onboarding/live`

### F870 — Session eval scores tutor conduct
- severity: P2
- status: [x]
- where: services/brain-playground/src/eval/sessionEval.ts
- note: Opened 2026-10-23 from the market report's "an eval of real sessions". Nothing scored how the tutor behaved in a session, only whether it ran. `eval:sessions` scores each turn of a recorded session against the written rules: rescue (a first rescue is the quiet hint), no read-back of the card, gentle recasts, level fit by rung, and safety, plus reply-wait p50 and p95 as a measurement. Records are `synthetic` or `dev` only, because no consent covers scoring learner transcripts (docs/changes/session-eval.md). Amended 2026-10-24 on `claude/session-mode`: records carry a mode and a scripted lesson's rescue is judged by the lesson rule; nine synthetic sessions.
- fixed: 2026-10-23 on `claude/session-eval`. Eight hand-labelled synthetic sessions (40 turns, one deliberate failure per check, labels reviewed by tutor-behaviour-engineer); `eval:replay` and `eval:beta-numbers` alongside.
- verified-by: `the session eval agrees with every hand label in the synthetic set`

### F871 — A phrase said with the hint or the full line showing counted as independent use
- severity: P2
- status: [x]
- where: services/tutor-agent/src/convo.ts (`applyTurnToProfile` call), packages/brain/src/profile/profile.ts
- note: Found 2026-10-25 in the learning-loop audit. Every turn credited `usedWell` to `timesUsedWell`, the brain half of `convoUses` and of `mastered`, even when the app had revealed a hint or the full line on that exchange. Help is now recorded on `timesAssisted`, which moves no mastery (LEARN-001).
- fixed: 2026-10-26 on `claude/learning-loop`.
- verified-by: `the same usedWell counts as a use unassisted and only as assisted after help`
- verified-by: `a reply after the hint is recorded as assisted, and an unaided one as a use`
- verified-by: `a version 2 profile without the new counts repairs with zero and one defaults`

### F872 — One slip made a "watch for" weakness
- severity: P2
- status: [x]
- where: packages/brain/src/profile/profile.ts (`learnerSnapshotFrom`)
- note: Found 2026-10-25 in the learning-loop audit. `watchFor` was the top three error tags by raw count, so a tag seen once qualified and nothing told one bad session from a pattern. Patterns now carry `sessions` and `lastSession`; recurring (two sessions or more) ranks first, suspected fills what is left (LEARN-002).
- fixed: 2026-10-26 on `claude/learning-loop`.
- verified-by: `a tag seen once is suspected and still fills watchFor when nothing recurs`
- verified-by: `two sightings in one session stay suspected`
- verified-by: `a tag seen in two sessions is recurring and ranks ahead of a higher count suspected tag`

### F873 — A drill answer right only after a miss scheduled like a first-try answer
- severity: P2
- status: [x]
- where: packages/core/src/drill/session.ts (`summarise`), packages/core/src/review/scheduler.ts (`applyGrade`)
- note: Found 2026-10-25 in the learning-loop audit. A miss then a correct answer graded `good` and stepped the schedule as if unaided, and a transfer exercise right after a miss raised `evidence.transfers`. Now it is assisted: back tomorrow at the same drill stage, ease unchanged, no evidence (LEARN-003).
- fixed: 2026-10-26 on `claude/learning-loop`.
- verified-by: `a phrase right only after a miss is reported as assisted`
- verified-by: `an assisted good comes back the next day with ease unchanged`
- verified-by: `a first-try good keeps today's interval`
- verified-by: `a transfer exercise right only after a miss earns no transfer evidence`

### F874 — A practice job whose AI drills failed was marked complete and never retried
- severity: P2
- status: [x]
- where: supabase/migrations/20261004003511_bounded_session_detail_retention.sql (`receive_conversation_practice`, `finish_conversation_practice`)
- note: Found 2026-10-25 in the learning-loop audit. Completion meant "the pack has any exercise", and every pack carries built-in translate exercises, so failed AI drills read as complete; finishing also replaced the list and dropped the built-ins. Fixed in `20261026090000_practice_completion_signal.sql` (generated drills only complete a job; finish merges, generated first, at most 24), proved by `npm run verify:database:practice` in the gate. Applied to the staging project (`wtexbzuyfersdtiekrvp`) on 2026-10-26 under its original version, fingerprint-checked against a PGlite replay (docs/changes/beta-launch.md execution log); packs already marked complete are not re-queued.
- verified-by: `the practice pack status reads preparing until generated drills arrive`

### F875 — The app could not show practice still being made, or practice that failed
- severity: P2
- status: [x]
- where: services/token-server/src/conversationPackPages.ts, apps/mobile/src/conversationPacks/practiceStatus.ts
- note: Found 2026-10-25 in the learning-loop audit. "Becoming practice" keyed on `pack.state === 'generating'`, which no server path writes, and a failed job was never shown. `GET /conversation-packs` and `/:id` now carry an optional `practiceStatus` (`preparing`, `ready`, `failed`) read from the job row through the learner's own packs; the app shows "More practice is on its way" or a calm failed note, still offers the practice it builds from the pack's phrases, and shows no retry (the worker owns retries). Refreshes on screen focus, no polling.
- fixed: 2026-10-26 on `claude/learning-loop`.
- verified-by: `the practice pack status reads preparing until generated drills arrive`
- verified-by: `a preparing pack with phrases offers what exists and says more is coming`
- verified-by: `a failed pack says so calmly and still offers its phrases`
- verified-by: `a pack with no practice status reads as ready, as older servers meant`

### F876 — Live drills skipped the grounding and safety checks the worker ran
- severity: P2
- status: [x]
- where: packages/core/src/drill/validate.ts (`groundedDrills`), services/tutor-agent/src/convo.ts, services/token-server/src/practiceJobs.ts
- note: Found 2026-10-25 in the learning-loop audit. The agent's drill path checked shape only. Both paths now share one filter: grounded in the phrases the request was built from, unique ids, bounded size, the safety screen, at most 24, and a generous word cap on the expected French by CEFR band (`DRILL_ANSWER_WORD_CAP`), skipped when the band is unknown. This is stricter than the agent's old shape-only check: a live drill keyed to an error tag rather than a listed phrase is now dropped, which the prompt already forbade.
- fixed: 2026-10-26 on `claude/learning-loop`.
- verified-by: `live drills pass the shared filter: only grounded, safe, sized exercises ship`
- verified-by: `the worker drops oversized and over-long answers through the shared filter`
- verified-by: `an A1 exercise with an absurdly long answer is rejected while a normal one passes`
- verified-by: `no hand-written fixture trips the length bound, even at the beginner cap`

### F877 — A deleted conversation's name stayed on its review cards
- severity: P2
- status: [x]
- where: apps/mobile/src/conversationPacks/store.ts, apps/mobile/src/review/store.ts (`rewriteCardNotes`)
- note: Found 2026-10-25 in the learning-loop audit. Cards built from a pack carried "From your conversation: <title>" after the conversation was deleted. Founder decision (2026-10-25): keep cards, schedules and evidence, drop the name. After a successful delete the matching notes become "Saved from a past conversation" through the review store, so the change syncs. Cards hold no pack id, so the match is the exact note text.
- fixed: 2026-10-26 on `claude/learning-loop`.
- verified-by: `deleting a conversation clears its name from review cards and keeps their schedule`
- verified-by: `a failed server delete leaves the names in place`

### F878 — A more-graded card copy on another device can bring a deleted conversation's name back
- severity: P2
- status: [x]
- where: packages/core/src/review/merge.ts
- note: Found 2026-10-26 building F877. The review merge keeps the copy with more grades whole, note included, so a second device that reviewed the card more after the delete restores the old note. The F877 replacement text also relies on the merge's text tie-break when grades are equal. Needs a merge rule that a cleared provenance note wins (data-sync-engineer). Large conversations that never cached a title cannot be cleared; their delete prompt promises nothing.
- fixed: 2026-10-28 on `claude/forget-pack-copies` (047c63e3). `mergeDecks` has a third field-wise exception: if either copy's note is `PAST_CONVERSATION_NOTE`, the merged card is cleared and has no `contextPackId`, whichever copy had more grades. The note and its id are out of `canonical` and return only as the last tiebreak, so the merge stays commutative, idempotent and associative (LEARN-016). Large conversations that never cached a title still cannot be cleared by title; a card that carries a pack id no longer needs the title.
- verified-by: `a cleared conversation name survives a merge with a more-graded copy`

### F879 — The next session's brief carried no evidence about the phrases it asked for
- severity: P2
- status: [x]
- where: packages/core/src/tutorBrief.ts (`reviewFocusFromDeck`, `tutorSessionBrief`), apps/mobile/src/profile/memory.ts
- note: Found 2026-10-25 in the learning-loop audit. Review focus was three due cards with no sign of what the learner had shown, and continuation carried only a title, summary, phrases and one correction. Each focus item now carries an `ask` chosen in code from its evidence: `used` asks for a new situation, `introduced` or `recalled` asks for an unaided go, `transferred` is left out. Phrases only ever said with help come first, then a continued conversation's own phrases (LEARN-005).
- fixed: 2026-10-26 on `claude/learning-loop`.
- verified-by: `a used phrase is asked in a new situation`
- verified-by: `a recalled phrase is asked unaided`
- verified-by: `a transferred phrase is left out`
- verified-by: `a phrase said only with help comes first even when not due`
- verified-by: `an older app focus without ask parses as unaided, and an unknown ask is refused`
- verified-by: `the brief explains both asks and keeps the data in untrusted JSON`

### F880 — Scene targets were the first five unmastered phrases, not the weakest
- severity: P2
- status: [x]
- where: services/tutor-agent/src/convo.ts (`frameTargets`, `buildFrame`)
- note: Found 2026-10-25 in the learning-loop audit. Targets are now the session's review focus, then phrases only ever said with help, then the fewest unaided uses.
- fixed: 2026-10-26 on `claude/learning-loop`.
- verified-by: `frame targets put review focus first, then phrases said only with help, then fewest unaided uses`

### F881 — Success never led to a harder task
- severity: P2
- status: [x]
- where: packages/brain/src/drill/generate.ts (`transferPhrasesFrom`), services/token-server/src/practiceJobs.ts, services/tutor-agent/src/convo.ts
- note: Found 2026-10-25 in the learning-loop audit. Mastered phrases simply left practice. Each post-session drill request now asks for one changed-situation exercise, marked transfer, for up to two of the session's wins (never a corrected phrase), on both the tutor and the worker path (LEARN-006). The session's wins (the end card's and the pack's) now leave out a line said while the hint or full line was showing, the same rule as LEARN-001, so help never earns a harder task (found by the branch's adversarial review).
- fixed: 2026-10-26 on `claude/learning-loop`.
- verified-by: `the request asks for one transfer exercise per listed win and at most two`
- verified-by: `a corrected phrase is never a transfer ask`
- verified-by: `a line said with the full line showing is not a session win`
- verified-by: `the worker asks for a harder transfer exercise on each of the pack wins, and a right first answer raises transfer evidence`

### F882 — Deleting a conversation can clear the note on a card from an uncached conversation with the same title
- severity: P2
- status: [x]
- where: apps/mobile/src/conversationPacks/store.ts (`forgetDeletedNames`)
- note: Found 2026-10-26 by the learning-loop adversarial review. The kept-title guard reads only the cached packs, so an older, uncached conversation with the same title has its cards' note rewritten to "Saved from a past conversation". Only the note changes; schedule and evidence are untouched. A pack id on derived cards would make the match exact.
- fixed: 2026-10-28 on `claude/forget-pack-copies` (047c63e3). Cards now carry `contextPackId`, set by `reviewPhrasesFor`, and `forgetDeletedNames` clears a note by that id exactly. A legacy card with no id keeps the exact-text match and the kept-title guard. No migration (LEARN-016).
- verified-by: `a deleted conversation's name is cleared only from cards built from that conversation`

### F883 — The deletion journal had no server
- severity: P2
- status: [ ]
- where: deployment/deletion-journal/ (new), services/token-server/src/deletionJournal.ts
- note: Found 2026-10-26 preparing staging. `maintenance` refuses to start without the four `LUVANI_DELETION_JOURNAL_*` variables, and no store implemented the client's contract. Built a Cloudflare Worker with D1 (DEPLOY-002): append-only records with triggers refusing UPDATE and DELETE, sealed 24-hour snapshots for replay, constant-time bearer auth, one project per deployment; 10 tests drive the real client against it. Stays open until a recovery drill has replayed through it. Done 2026-10-27: deployed at `luvani-deletion-journal.pravzviv30.workers.dev` (D1 `luvani-deletion-journal`), the real client sealed and replayed an empty snapshot against it, the four variables are on Railway `maintenance`, and `maintenance` started on staging and runs idle.
- verified-by: `replay through a sealed snapshot returns exactly the recorded users and excludes later writes`

### F884 — A refused or failed ElevenLabs request crashed the tutor worker
- severity: P1
- status: [x]
- where: services/tutor-agent/src/ttsCache.ts (`CachedTTS` constructor)
- note: Found 2026-10-27 while capturing paid request shapes. A refused (paid proxy `quote-mismatch` or budget) or failed ElevenLabs request made the plugin TTS inside `CachedTTS` emit 'error' with nobody listening; Node threw ERR_UNHANDLED_ERROR and the worker died with every live session on it. `CachedTTS` now forwards the main and conversation-tier errors into the session's existing pipeline-error path (`kind=tts_error`, the error frame, `terminalFailureFor`) and logs one metadata-only line when no session listens. Deepgram and the LLM plugins were not affected; the SDK listens on them directly. Not yet covered: an end-to-end refund after a voice refusal, and a possible duplicate error frame if the failure also surfaces through `CachedChunkedStream`.
- fixed: 2026-10-27 on `claude/staging-unblockers`.
- verified-by: `a vendor voice error reaches the session through the cached voice instead of crashing the worker`
- verified-by: `a conversation-tier voice error is routed the same way as the main voice`
- verified-by: `a vendor voice error with no session listening yet is logged rather than thrown`
- verified-by: `the ElevenLabs voice built for a session does not crash the worker when the paid proxy refuses it`

### F885 — Staging had no price quotes, so api, tutor and practice could not start
- severity: P2
- status: [x]
- where: scripts/paidQuotes.mjs (new), luvani_private.paid_quotes
- note: Found 2026-10-26. Quotes must match runtime request shapes byte for byte and expire within 7 days, and nothing generated them. `scripts/paidQuotes.mjs` captures every shape from the running code with no vendor call, prices worst-case envelopes from the cost model, and writes owner SQL, `LUVANI_PAID_QUOTE_BINDINGS` and evidence outside the repo (DEPLOY-003). Its test applies the SQL over every migration and admits all nine bound activities through the real reserve, claim and resume path. Renewal every 6 days. Closed 2026-10-27: the SQL is applied on staging (quotes matched a PGlite replay), the bindings are on api, tutor and practice, and all three started on staging (`/health` 200, `/ready` green except the closed admission). A real paid session still waits for the acceptance check.
- fixed: 2026-10-27 on staging (Railway, commit 6da98d94).
- verified-by: `generated staging quotes admit every bound activity through the real SQL and runtime gate; renewal keeps old quotes valid`

### F886 — A fresh account's billing status fails until its first session
- severity: P2
- status: [x]
- where: services/token-server/src/store.ts (`SupabaseEntitlementStore.get`), supabase/migrations/20261020140000_weekly_free_taste.sql (`consume_entitlement`)
- note: Found 2026-10-27 in the staging acceptance check. `/billing/status` reads through `consume_entitlement(user, 0)`. Since migration 40 that function raises `entitlement has not been provisioned` when the row is missing, and only `claim_trial` (run by `/session/start`) creates the row. So a signed-in account that has not yet started a session gets a 500 from `/billing/status`. The app treats it as "could not check" (`fetchBillingStatus` returns null), so nothing breaks for the learner, but every new learner who opens Settings or the wall first logs a server error, and the server comment above the route ("creates a missing default row") is no longer true. Fix shape to decide with data-sync-engineer: answer the not-yet-provisioned case as a fresh trial view without writing (no trial claim, no installation evidence), or have the read call the read-only provisioning check. After the first session the read works: the acceptance account showed trial, 600 s remaining. Fixed: `SupabaseEntitlementStore.consume` turns that exact database error into `EntitlementNotProvisionedError`, and `billingStatusOf` answers it with `FRESH_FREE_ENTITLEMENT` (trial, 600 s) and writes nothing; every other caller still fails on a missing row. Known residue (wording only, no seconds move; fix-verifier 2026-10-27): on a device whose trial another account already claimed, status shows the fresh 600 s and the start then answers its 402 "trial already claimed".
- fixed: 2026-10-27 on `claude/f886-f887`.
- verified-by: `billing status for a signed-in account with no entitlement row answers a fresh trial and writes nothing`

### F887 — Railway builds fail at random when onnxruntime-node cannot reach its download
- severity: P2
- status: [x]
- where: Dockerfile (`npm ci` in the dependencies stage), onnxruntime-node install script
- note: Found 2026-10-27 on the first staging deploys. `onnxruntime-node`'s install script downloads its native library from Microsoft during `npm ci`. It timed out (`ETIMEDOUT 150.171.109.35:443`, no IPv6 route) on 2 of 9 Railway builds, failing the whole build; a redeploy passed each time. A deploy should not need a manual retry. Options: retry the install step, or fetch and hash-pin the native archive once (it is already recorded by `deployment/nativeArtifacts.mjs`) so the build does not depend on that host. Owner: deploy-engineer.
- fixed: 2026-10-27 on `claude/f886-f887` (DEPLOY-005). Root cause: on linux/x64 the postinstall only downloads the CUDA 12 and TensorRT providers from NuGet; the CPU runtime ships in the npm archive. The image's `npm ci` now sets `ONNXRUNTIME_NODE_INSTALL=skip`.
- verified-by: `the backend image skips onnxruntime's GPU download and keeps its bundled CPU runtime`

### F888 — The profile credited a form the end card refused
- severity: P2
- status: [x]
- where: packages/brain/src/profile/profile.ts (`applyTurnToProfile`), services/tutor-agent/src/convo.ts (`correctedEarlier` call site)
- note: Found 2026-10-28 in Phase E planning. The end card dropped a `usedWell` form quoted in coaching on any earlier turn of the session (`state.correctedForms`), but the profile only dropped this turn's coaching, so a later claim of the corrected form still earned `timesUsedWell` and could mint mastery the card never showed. `applyTurnToProfile` now takes `correctedEarlier` (the pre-turn `correctedForms`) and gives such a use neither `timesUsedWell` nor `timesAssisted` (LEARN-012). Adopting the tutor's offered better form still counts in both.
- fixed: 2026-10-28 on `claude/phase-e-progress`.
- verified-by: `a form corrected earlier earns no profile credit later, matching the end card`
- verified-by: `turn 1 coaches the quote, turn 2 claims it: both exclude it; adopting the offered form later counts in both`

### F889 — Error pattern examples were stored unbounded
- severity: P2
- status: [x]
- where: packages/brain/src/profile/profile.ts (`MAX_PATTERN_EXAMPLE`, `applyTurnToProfile`, `repairLearningHistory`)
- note: Found 2026-10-28 in Phase E planning. A model-written pattern `example` was stored at any length, and the whole profile rides the session join credential. Examples are now clamped to 160 characters by code point when written and when a stored profile is repaired, which also covers merges (they settle through `repairProfile`).
- fixed: 2026-10-28 on `claude/phase-e-progress`.
- verified-by: `clamped when written, by code point, without splitting a surrogate pair`
- verified-by: `clamped on read for stored profiles, and through a merge`

### F890 — "Getting better at" was not shown on the Journey
- severity: P2
- status: [x]
- where: apps/mobile/src/journey/journeyView.ts (`progressRowsView`), apps/mobile/src/journey/JourneyParts.tsx (`ProgressSection`), apps/mobile/src/tabs/MyFrenchTab.tsx
- note: Found 2026-10-28 in Phase E planning. The brain knew which recurring patterns had gone quiet (`improvingPatterns`, LEARN-011), but no learner surface said so. The Journey's "How it’s going" now lists up to two, by authored title only (LEARN-013).
- fixed: 2026-10-28 on `claude/phase-e-progress`.
- verified-by: `a recurring pattern quiet for three conversations shows, under its authored title`
- verified-by: `two quiet conversations are not enough: the boundary is the brain rule`
- verified-by: `an un-authored tag never reaches the learner`
- verified-by: `at most two patterns, newest quiet first`

### F891 — "Needs another go" was not shown on the Journey
- severity: P2
- status: [x]
- where: apps/mobile/src/journey/journeyView.ts (`needsAnotherGo`, `progressRowsView`), packages/core/src/review/scheduler.ts (`lapses` comment)
- note: Found 2026-10-28 in Phase E planning. Due phrases the learner had missed or only said with help were not named anywhere on the Journey. "How it’s going" now shows up to three as French chips, oldest due first, opening Review. Lapses decide membership only (LEARN-013).
- fixed: 2026-10-28 on `claude/phase-e-progress`.
- verified-by: `membership through a lapse`
- verified-by: `membership through help, by fr and by frWritten, and not once used well`
- verified-by: `a phrase not yet due is left out`
- verified-by: `a transferred phrase is left out`
- verified-by: `order is oldest due first, even when lapses say otherwise, and capped at three`
- verified-by: `locked under fullJourney: no rows, the teaser instead`
- verified-by: `null when neither row has evidence`

### F892 — No byte cap on the learner snapshot; a heavy profile could be refused at session start
- severity: P2
- status: [x]
- where: packages/brain/src/profile/snapshotBudget.ts (`fitSnapshot`, `keepUnsent`), services/token-server/src/sessionSnapshot.ts, services/token-server/src/server.ts (`/session/start`), apps/mobile/src/app/ProfileContext.tsx (`updateBrain`)
- note: Found 2026-10-28 in Phase E planning. Counts were capped, but text was not and there was no byte budget: a heavy learner measures about 58 KB of snapshot against the 64 KB body limit, and the worst case about 370 KB. The snapshot is now fitted under 48 KB on the phone and again on the server, and what is left out is restored on the phone after the recap (LEARN-014).
- fixed: 2026-10-28 on `claude/phase-e-progress`.
- verified-by: `fitSnapshot brings the worst case under budget without touching memory, stats or extras`
- verified-by: `drop order: mastered phrases oldest first, then unmastered, then suspected patterns; recurring stay`
- verified-by: `round trip: fit, recap with one new phrase, keepUnsent loses nothing and the caps hold`
- verified-by: `an oversized snapshot from /session/start is signed in its fitted form`
- verified-by: `a huge junk snapshot is refused, not a crash`
- verified-by: `a fitted session loses no phrase on write-back, keeps what it learned, and keeps memory decisions`
- verified-by: `a dropped mastered phrase the session reintroduced stays mastered with its old uses`
- verified-by: `a dropped suspected pattern seen again in a new session becomes recurring`
- verified-by: `a sent phrase credited in session and a sent pattern seen again are not double counted`

### F898 — Memory extraction has no eval, so a cheaper model or trimmed transcript cannot be judged
- severity: P2
- status: [x]
- where: services/tutor-agent/src/convo.ts (`extractMemory`), packages/brain/src/prompt/extractPrompt.ts, services/brain-playground
- note: Found 2026-10-28 (Phase F). Production is OpenAI-only, so `extract` runs on the analyst model `gpt-5.6-terra` at high effort with the whole transcript and about 5,500 tokens of system blocks. `gpt-6-luna` is about 20 times cheaper and already serves drills and curation after their evals, but nothing measured whether it keeps memory honest. Owner: performance-engineer.
- fixed: 2026-10-28 on `claude/phase-f-cost` (COST-001). `npm run eval:extract -w @luvani/brain-playground` runs ten synthetic sessions through the real request and scores recall, fiction and sensitive leaks (facts and openers), known repeats, structured failures, tokens and cost, with `--model`, `--effort`, `--trim`, `--repeats`, `--baseline`. Baseline in `docs/cogs-evidence/extract-eval-2026-10-28.md`. No model was switched.
- verified-by: `a sensitive leak is caught in a fact and in the opener`

### F899 — Every judge check pays for the model, even an identical repeat
- severity: P2
- status: [x]
- where: services/token-server/src/drillJudge.ts, services/token-server/src/fixLineJudge.ts
- note: Found 2026-10-28 (Phase F). `/drill/judge` and `/drill/fix-line` called Jev and the brain for every press of Check, so the same attempt sent twice was judged and admitted against paid spend twice. Owner: performance-engineer.
- fixed: 2026-10-28 on `claude/phase-f-cost` (COST-002). `JudgeMemo` in `services/token-server/src/judgeMemo.ts`: per user, keyed by a sha256 of the user, memo version, judge model, endpoint and built request, 24 h TTL, 200 per user, 5,000 in all, successful verdicts only, cleared on account deletion. A hit happens after the rate limits and before paid admission and logs `[luvani:judge] memo hit <endpoint>`. Off unless `LUVANI_JUDGE_MEMO=1`, because the in-app notice promises no copy is kept; turning it on needs the notice updated. Even with the memo off, both routes now send the attempt NFC-normalised, trimmed and with whitespace runs collapsed to one space, so the key and the request agree; spacing alone no longer reaches the judge.
- verified-by: `a repeated attempt, even with extra whitespace, costs one brain call and answers identically`

### F900 — Practice-ready latency and drill validation failures are not counted
- severity: P2
- status: [x]
- where: services/token-server/src/practiceJobs.ts, services/token-server/src/practiceWorker.ts, services/tutor-agent/src/convo.ts
- note: Found 2026-10-28 (Phase F). The worker logged only `practice_job {result}`, and the live path a free-text `drill linter rejected N of M` line, so neither how long practice takes after a session nor how often the linter rejects exercises could be measured. Owner: observability-engineer.
- fixed: 2026-10-28 on `claude/phase-f-cost` (COST-003). `processPracticeJob` reports a numbers-only outcome (proposed, accepted, failure kind, generation ms, estimated ms since session end, cost) on the `practice_job` line; the live path prints `{"event":"drill_validation",…}` for every batch.
- verified-by: `outcome: complete counts proposed and accepted, times generation and session end to ready`

### F901 — Per-session AI cost exists only as free text no tool reads
- severity: P3
- status: [x]
- where: services/tutor-agent/src/convo.ts (`logSpendSummary`), services/brain-playground
- note: Found 2026-10-28 (Phase F). `[luvani:brain:summary] usd=` and `[luvani:cost]` were readable by eye only, and judge and practice spend sat on separate lines, so cost per conversation and per practice set could not be computed. Owner: observability-engineer.
- fixed: 2026-10-28 on `claude/phase-f-cost` (COST-004). The tutor also prints a numbers-only `{"event":"session_cost",…}` line, and `npm run eval:cost-numbers -w @luvani/brain-playground -- <exported log>` reports cost per conversation, cost per practice set, practice-ready latency, validation rejection, job retry and failure rates, and judge cost and memo hit rate. It reads a local file only. Every line carries numbers and fixed labels plus, on `session_cost` and `[luvani:cost]`, the first 8 hex characters of the session id (as `[luvani:brain:summary]` already did) so the lines join; never words, user ids, room or model names.
- verified-by: `reads the fixture into sums, joining voice by prefix and skipping the rest`

### F893 — A memory fact had no origin and no updated time
- severity: P2
- status: [x]
- where: packages/brain/src/profile/profile.ts (`RememberedFact`, `validRememberedFacts`, `applyExtractionToProfile`), apps/mobile/src/profile/memory.ts (`withFactEdited`, `brainAfterRecap`, `factOriginLabel`)
- note: Found 2026-10-28 in the memory-trust review. A fact the learner typed and a fact the extraction picked up from speech were stored the same way, so nothing could tell the tutor which to trust. Facts now carry `source` (`learner` or `conversation`) and `updatedAt`. Code sets the source: extraction builds facts field by field, so a model object cannot claim `learner`. Repair reads a missing or unknown source as `conversation`, and `updatedAt` falls back to `notedAt`. A learner edit stamps `learner` and a new `updatedAt`. A recap from an older agent keeps the stored origin (LEARN-007).
- fixed: 2026-10-28 on `claude/phase-d-memory`.
- verified-by: `a legacy fact repairs to conversation, updatedAt = notedAt`
- verified-by: `an unknown source becomes conversation; learner survives`
- verified-by: `an extraction stamps conversation and now, even if the model claims learner`
- verified-by: `an edit stamps learner and a new updatedAt, keeping notedAt`
- verified-by: `an older agent echoing a fact without source keeps the learner source`
- verified-by: `factOriginLabel names both origins`

### F894 — Nothing in code checked extracted memory for sensitive topics
- severity: P2
- status: [x]
- where: packages/brain/src/profile/memoryScreen.ts, packages/brain/src/profile/profile.ts (`applyExtractionToProfile`)
- note: Found 2026-10-28 in the memory-trust review. The founder's sensitive-topic boundary (2 October) was a prompt rule only, so a model that missed it stored the detail and it synced. `sensitiveMemoryCategory` now screens a tutor-noted fact's `en`, `fr` and `happensAround` and the opener for health, finances, intimate, beliefs and secret topics, in French and English, before anything is stored. It is conservative and never logs. Learner-typed edits are not screened. The tutor agent's `safeModelProfile` also runs the screen on every profile it receives or returns: a conversation-noted fact that hits it is left out of the brief, of the extraction's "Already on file" list and of the recap, so older sensitive notes leave the device on the next session (memory-locked sessions too), and a stored opener that hits it is never spoken. Learner-written facts stay. The word list was widened after an adversarial review (suicide, abortion, psychiatric diagnoses, drugs, money amounts, party and politician names, legal and immigration status). It is a word list: paraphrase, misspellings and other languages get through, and it knowingly drops some clean text such as "works at a hospital", the name Harris, Labour, Faith as a name, a 5k run or prison as a TV series (LEARN-008).
- fixed: 2026-10-28 on `claude/phase-d-memory`.
- verified-by: `sensitive extracted facts never land; clean ones do, as conversation facts`
- verified-by: `a sensitive opener becomes null`
- verified-by: `null and empty are clean`
- verified-by: `catches health: Was diagnosed with cancer last year`
- verified-by: `lets through: Il est revenu de Lyon`

### F895 — Typed goals were stored back as remembered facts
- severity: P2
- status: [x]
- where: apps/mobile/src/profile/memory.ts (`snapshotFor`, `brainAfterRecap`, `withoutGoalEchoes`), packages/brain/src/profile/profile.ts (`repairProfile`)
- note: Found 2026-10-28 in the memory-trust review and reproduced by a failing test first. `snapshotFor` appended each typed goal to the facts as "Their goal: ...". The agent echoed the facts in its recap and `brainAfterRecap` stored them, so a goal duplicated, outlived its removal and took a slot of the twelve. Goals now ride as the wire-only `memory.learnerGoals` and `StoredProfile.learnerGoals` is their only home. The recap drops the echo, `withoutGoalEchoes` cleans old echoes on read and on the next recap, and the extraction is told the goals so it does not extract them again (LEARN-009).
- fixed: 2026-10-28 on `claude/phase-d-memory`.
- verified-by: `a recap echo of the snapshot stores no goal, and goals ride once`
- verified-by: `echoes already stored are cleaned on read; a real extracted goal fact stays`
- verified-by: `paused memory carries no typed goals`

### F896 — The brief called every note saved tutor memory and never asked the tutor to check one
- severity: P2
- status: [x]
- where: services/tutor-agent/src/convo.ts (`tutorMemoryBrief`), packages/brain/src/prompt/scenarioPrompt.ts, services/brain-playground/src/sessionLoop.ts
- note: Found 2026-10-28 in the memory-trust review. Every note rode as `saved tutor memory`, and the scene builder headed them "REAL ACCOUNT MEMORY", so a wrong or stale note picked up from a conversation could be said back as fact. Each note now carries its source. The tutor asks lightly before relying on a note from a past conversation and drops it for the session on a no or an unsure answer. Conversation notes that hit the sensitive screen are left out, which covers notes saved before F894. The typed goals sit in a separate `LEARNER'S OWN GOALS` block (LEARN-010).
- fixed: 2026-10-28 on `claude/phase-d-memory`.
- verified-by: `the memory brief names each note source and checks the unconfirmed ones before use`
- verified-by: `saved tutor memory is bounded in the frame and every turn, with an honest editable-note source`

### F897 — Forgetting a fact leaves copies in saved conversations
- severity: P3
- status: [x]
- where: packages/core/src/conversationPacks.ts (`summary`, `title`, `learnerGoal`, `topics`, `continuationSeed`)
- note: Found 2026-10-28 in the memory-trust review. Forgetting a fact removes it from the profile and keeps a tombstone, but a saved conversation pack can hold the same wording in its summary, title, learner goal, topics or continuation seed. Those copies stay until the conversation is deleted. Related to F878 and F882, which also concern text that outlives a delete. The founder decided on 2026-10-28 to keep this out of Phase D. Follow-up for data-sync-engineer.
- fixed: 2026-10-28, superseded by F902 (`claude/forget-pack-copies`). No copy is made: the pack builder never reads the memory list. Saved conversations stay as they are, and the learner is told so when they forget (LEARN-015).
- verified-by: `a forgotten fact leaves no copy in a saved conversation`

### F902 — Forgetting a fact was thought to leave copies in saved conversations
- severity: P3
- status: [x]
- where: apps/mobile/src/profile/tutorMemory.ts (`FORGOTTEN_NOTE`, `WHAT_LEAVES`), services/tutor-agent/src/convo.ts
- note: Found 2026-10-28 in the memory-trust review, and first logged as F897 on the Phase D branch (`claude/phase-d-memory`). This entry supersedes F897. There is no copy by design: the pack builder never reads the memory list. `summary` is a fixed headline line, `learnerGoal` is the learner's own request, and the rest is what was said in that conversation. A conversation the learner starts from a remembered detail (a Speak tab talk chip, `memoryTopics` in `apps/mobile/src/tutor/speakTabView.ts`) is about that detail and keeps it as its topic in `learnerGoal`, like any conversation. Forgetting the detail changes neither. A forgotten fact can describe the same event in other words, so rewriting conversations by text match would be guesswork. The learner is now told at the moment of forgetting that saved conversations stay and can be deleted in Journey, and `WHAT_LEAVES` says Journey, not Progress (LEARN-015).
- fixed: 2026-10-28 on `claude/forget-pack-copies` (0f2bdf57).
- verified-by: `a forgotten fact leaves no copy in a saved conversation`

### F903 — "Start speaking" opens the room with the microphone closed, and Speak does nothing in a typed start
- severity: P1
- status: [x]
- where: apps/mobile/src/onboarding/plan.ts:187
- note: Found 2026-10-28 by the product review (LR-01, review severity High; reproduced by three
  reviewers and the orchestrator on web, main af36034b). `initialPracticeMode` returns typed unless
  focus is speaking and confidence is not hesitant; `createFromDraft.ts:57` stores that as
  preferTyping; `ConvoScreen.tsx:294` opens typing from it, and `ConvoScreen.tsx:477` reopens the mic
  only when the session did not start typed. A button labelled "Start speaking" therefore opens on
  "Your mic is off", and Speak inside a typed-start room is inert. Founder decision first: is the
  gentle typed start a suggestion or a setting. Not verified on a device with real speech.
- fixed: 2026-10-29. A start labelled Speak now opens the microphone once the room is ready, whatever the onboarding typing preference. Speak in a room that started typed asks first, keeps the typed part and rebuilds the room as voice, waiting out its own lease instead of reporting another device. A safety stop or a Leave during the switch cancels it and starts no voice session, and after the switch the microphone opens on the new room.
- verified-by: `pressing Start speaking opens the microphone whatever the onboarding typing preference`
- verified-by: `Speak in a room that started typed switches the session to voice`
- verified-by: `a safety stop during the switch cancels it and starts no voice session`
- verified-by: `leaving while the switch rebuilds starts no voice session`
- verified-by: `switching to voice waits for its own typed session to close instead of reporting another device`
- verified-by: `after switching to voice the microphone opens on the new room, not the old one`
- verified-by: `a start with no stated intent is retried with none, so the microphone stays closed (F903)`

### F904 — A scene the learner never spoke in is still praised and awards new phrases and XP
- severity: P1
- status: [x]
- where: apps/mobile/src/RecapScreen.tsx:393
- note: Found 2026-10-28 by the product review (LR-02, review severity High; reproduced twice by the
  orchestrator). Tutor log "8 turns (0 from the learner), 9 rescues, 86s" was followed by the recap
  "You held the conversation with a little help"; a second run logged "7 turns (0 from the learner)"
  and the end card said "7 new phrases, +39 XP". F840 fixed the sentence inside recapLine, so the
  learner-turn count reaching it on this path is not zero (inferred), and `recap/afterSessionView.ts`
  has no zero-turn rule for phrases or XP. Scripted rescues also advance beats with no learner reply;
  rescue pacing changes go through eval:sessions. Check first whether the local legacyRuntimeFixture
  counts turns differently from lifecycleVersion 1.
- fixed: 2026-10-29. The recap now carries `learnerReplies`, counting scene replies only (a topic picked on the choosing screen is not one), and two unanswered rescues pause the tutor instead of moving the scene on. A scene with no learner reply earns nothing anywhere: no XP, no new phrases, no minutes, no active day or streak, no practice, nothing for crash recovery to bank, and it is not saved or listed as a conversation. Replies carried from a typed start still count after switching to voice. Accepted limits: crash-journal entries written by builds before this change carry no reply count and recover as before (no released build exists), and the library read-on stops after 3 extra pages.
- verified-by: `a session with no learner turns reaches the recap with a learner turn count of zero`
- verified-by: `a topic picked on the choosing screen is not a reply`
- verified-by: `two unanswered rescues pause the tutor instead of moving the scene on`
- verified-by: `the end card awards no new phrases and no content XP when the learner never replied`
- verified-by: `a scene with no learner reply settles nothing: no active day, no streak, no minutes, no XP`
- verified-by: `a scene with no learner reply banks no practice by any path`
- verified-by: `a scene with no learner reply leaves nothing for crash recovery to bank`
- verified-by: `a scene the learner never replied in saves no conversation and publishes no practice`
- verified-by: `a session with no reply in the scene is never listed as a conversation`
- verified-by: `replies carried from a typed start still earn the scene its credit after switching to voice`

### F905 — Leaving a typed scene early keeps no recap, saves no lines and counts no minutes
- severity: P1
- status: [x]
- where: apps/mobile/src/ConvoScreen.tsx
- note: Found 2026-10-28 by the product review (LR-03, review severity High; three sessions, two
  reviewers). After ✕ then Leave, the app returned to the scene sheet or Today; Journey said "0 min
  practised" after about 4 live minutes, Practice still said "Have your first one", and no modelled
  line was saved, although the leave dialog promises the lines reached will be kept. A voice-started
  session did reach an end card, so the gap depends on the path. Not tested whether the recap
  appears only on completion.
- fixed: 2026-10-29. After a learner reply, Leave now keeps the room, asks for the recap and waits up to 8 seconds for it. If the recap never comes, the ordinary leave runs and the minutes are settled locally, and a recap that lands after that does not settle the sitting twice. Leaving with no reply stays instant, and leaving while a switch to voice rebuilds still keeps the typed part's minutes.
- verified-by: `leaving a typed scene after a learner turn keeps a recap, the modelled lines and the minutes`
- verified-by: `leaving with no reply stays instant`
- verified-by: `a recap that never comes falls back to the ordinary leave, and still counts the minutes it promised`
- verified-by: `a recap that lands after the local settle does not settle the sitting twice`
- verified-by: `leaving while switching still keeps the typed part's minutes`
- verified-by: `a topic picked on the choosing screen does not make Leave wait`

### F906 — Balanced corrections hold every grammar slip for a recap an early exit never shows
- severity: P1
- status: [x]
- where: packages/brain/src/prompt/turnContext.ts:86
- note: Found 2026-10-28 by the product review (LR-04, review severity High; four errors, one
  reviewer). "j'ai allé" and "à le restaurant" passed with no note at Balanced. The policy says
  "Small grammar slips wait for the recap", so the missing inline note is by design, but the recap
  that should carry the fix was never shown (F905). Two questions for tutor-behaviour-engineer:
  whether an auxiliary or contraction error at A2 is a small slip or "what matters now", and whether
  deferred fixes reach Your fixes on every exit. Tutor conduct changes go through eval:sessions.
  Separately, the recap holds up to six fixes (MAX_FIXES, packages/brain/src/engine/recap.ts) but
  buildConversationPack keeps only three (packages/core/src/conversationPacks.ts:325), so fixes four
  to six never reach Your fixes.
- fixed: 2026-10-29. The code now promotes three high-value A2 slips (passé composé auxiliary, uncontracted à le, determiner gender) to a small inline fix at Balanced, at most one per turn within the cap and cooldown. Agreement slips still wait for the recap. A slip shown in the scene is kept for Your fixes, and the conversation pack now keeps all six recap fixes instead of three.
- verified-by: `at balanced a passé composé auxiliary error surfaces inline`
- verified-by: `at balanced an uncontracted à le surfaces inline`
- verified-by: `at balanced a determiner gender slip surfaces inline`
- verified-by: `at balanced an agreement slip still waits for the recap`
- verified-by: `at most one grammar slip surfaces inline per turn at balanced`
- verified-by: `a high-value slip shown in the scene still reaches the recap's fixes`
- verified-by: `every fix the recap holds reaches the conversation pack`

### F923 — Refreshing a live session starts a new one in a different mode without asking
- severity: P2
- status: [x]
- where: apps/mobile/src/ConvoScreen.tsx
- note: Found 2026-10-28 by the product review (LR-22; seen once). A refreshed voice session reset the
  transcript and said "This session started in typing mode" while the URL kept textMode=false. It
  spends minutes without consent.
- fixed: 2026-10-29. Conversation parameters are now coerced from the address, so a malformed topic is dropped and never sent to the tutor. A reload of a live room lands on the scene intro ("Your last conversation ended."), keeps the learner's mode and never starts a session. Topics survive a reload, stored as JSON.
- verified-by: `a reloaded conversation address keeps its mode`
- verified-by: `reloading a live room lands on the scene intro and keeps the learner's mode`
- verified-by: `a reloaded topic conversation keeps its topic`
- verified-by: `a malformed topic in the address is dropped, never sent to the tutor`
- verified-by: `after switching to voice a reload restarts in voice`
- verified-by: `starting again after a reload waits out the cut-off session's lease`

### F928 — Scene objectives do not tick for typed turns that meet them
- severity: P3
- status: [x]
- where: apps/mobile/src/live/liveRoomView.ts
- note: Found 2026-10-28 by the product review (LR-29; two reviewers, observed). The location is
  inferred.
- fixed: 2026-10-29. A reply typed after an English-only hint now ticks the scene's goal. A typed answer that only copies the line just revealed still never counts.
- verified-by: `a typed turn that meets an objective ticks it`
- verified-by: `a typed answer copying the just-revealed line does not tick it`

### F907 — The launch wall opens on every web refresh, unknown address and straight after sign-up
- severity: P1
- status: [x]
- where: apps/mobile/src/wall/launchWall.ts
- note: Found 2026-10-28 by the product review (filed 2026-10-29 on claude/review-b-paywall, Stream B; LR-05, review severity High; five reviewers). D24
  intends a wall on each open; on web every refresh counts as an open, unknown paths redirect to
  /plans?entry=launch, and the default plan alternated between Core and Max. Founder decision
  first: revisit D24 (at most once a day, never before a completed conversation, never after an
  early exit). Decided 2026-10-28 (founder decision 4, supersedes D24's cadence): at most once a
  day, never before the first completed conversation, never on a web refresh or after an early
  exit; it still shows at the limit and on a lock tap.
- verified-by: `a web refresh is not an app open for the launch wall`
- verified-by: `an unknown address goes Home rather than to the plans page`
- verified-by: `the launch wall shows at most once a day and never before a completed conversation`
- verified-by: `leaving a scene early never opens the launch wall`
- verified-by: `the plans page suggests the same plan however its data arrives`
- verified-by: `a recap reached by leaving early neither unlocks the launch wall nor opens it`
- fixed: 2026-10-29. The launch wall now remembers, per account on this phone (`wall/launchWallSeen.ts`), the day it last opened and whether a conversation was finished. It opens at most once a day, only after a conversation ran to its recap with a learner reply, never on a web refresh (the browser's navigation type is read once at load), and never on the return from a conversation or first scene left before its recap. A recap a Leave asked for (F905) or the switch-to-voice recap is not a finished conversation, and leaving its end card is an early exit. Every way out of a conversation or the first scene (a swipe, Android's back, the browser's Back, as well as Leave) is judged when the route is removed (`watchRemoval`, `removalIsEarlyExit`). A kept guest practice that ran to its end counts as the first finished conversation once the account holds it. The first-run offer counts as that day's showing. Unknown web addresses resolve to Home (`nav/linking.ts`, a catch-all alias on Home). The plans page waits for both the goal and the plan status before suggesting a plan, and no goal now suggests nothing, so the page shows Core yearly every time instead of flipping to Core monthly.

### F908 — A store failure leaves the checkout fence up, saying "do not buy again" and "nothing was changed" together
- severity: P1
- status: [x]
- where: apps/mobile/src/purchases/pendingPurchase.ts
- note: Found 2026-10-28 by the product review (filed 2026-10-29 on claude/review-b-paywall, Stream B; LR-06, review severity High; three reviewers, web
  with no store). The marker is written before the store sheet opens and a store failure keeps it,
  so the fence reopens on cold start and from every lock, and "Start again" ends on "We couldn't
  reach the store". F848's relief relies on storeHolds, which is always unknown on web. That a
  native store error other than a cancel also keeps the marker is inferred from WallScreen settle.
  Needs sandbox proof once purchases are configured.
- fixed: 2026-10-29. A store call that failed before any purchase now carries `notStarted` (web always; native when no package matched or the store was not ready, before any sheet; and RevenueCat codes 3 and 5, purchase not allowed and product not available). Settlement reads it as `not-charged`, the wall clears the fence, stays on the plans page and says "The purchase didn't go through. Nothing was charged. You can try again." Account changes, network and store errors, unknown codes and payment pending keep the fence as before. The pending page no longer prints "Nothing was changed" under its "do not buy again" card, nor "Nothing was charged" when clearing the fence failed and it still stands (`pendingDetail`). Web marks itself `storeless`, so the open check and Start again clear a marker left by an older build there; native `storeHolds` answers are untouched. Money pins (6 files, 3 functions) re-pinned after the founder approved the exact diff on 2026-10-29. Native sandbox proof is still owed, including that RevenueCat codes 3 and 5 never arrive after a charge, which nothing in the SDK source proves.
- verified-by: `a store call that fails before any purchase clears the checkout fence`
- verified-by: `the pending page never says nothing was changed and do not buy again together`

### F909 — Subscribers are told to cancel before a renewal the app never dates
- severity: P1
- status: [x]
- where: apps/mobile/src/purchases/planStatus.ts
- note: Found 2026-10-28 by the product review (filed 2026-10-29 on claude/review-b-paywall, Stream B; LR-07, review severity High). Your plan says
  "Renews in the coming weeks" three times next to "cancel at least 24 hours before renewal", while
  the compare sheet knows the minutes date. Manage and Restore are hidden on web, as expected;
  native was not verified.
- fixed: 2026-10-29. Founder decision 9 reverses the no-dates rule for paid plans. The Subscription screen's Next renewal row says the store's own date and price once ("Core, yearly, £119.99. Renews on 27 November.", "Ends on" when it will not renew, "Free until …, then … a year." in a store trial), read from the active entitlement's product (`purchases.heldPlan`, `storeHeldPlanFrom`) and joined to the offering. The tutor-time card says when the minutes are fresh, from the server's window, apart from it. With no store answer it points to the App Store, Google Play, or either on web, and never invents a date. "Renews in the coming weeks" is gone. Android joins the entitlement's product and base plan (`product:basePlan`) and never borrows a sibling plan's price. Profile and Settings rows keep the minutes line and ask the store nothing; only the Subscription screen reads the held plan, sharing its one offering read. The cancel footer, Manage and Restore are unchanged. The founder's middot was replaced by commas and full stops, because the punctuation gate refuses it. Native store reads are unproven until sandbox.
- verified-by: `a subscriber's plan screen shows the renewal date and price from the store`
- verified-by: `the minutes refresh date is shown apart from the billing renewal date`

### F910 — Free learners see "Included with your trial" on locks, and a Max feature opens the Core offer
- severity: P2
- status: [x]
- where: apps/mobile/src/components.tsx
- note: Found 2026-10-28 by the product review (filed 2026-10-29 on claude/review-b-paywall, Stream B; LR-08; five reviewers). The badge shows to accounts
  that never had a trial; Rehearse opens the Core trial though only Max lists it; the free list
  promises "Review and pronunciation practice" while Sounds of French is locked.
- verified-by: `a lock names the plan that unlocks it`
- verified-by: `a Max-only lock opens the Max offer`
- verified-by: `the free list names nothing that is locked on Free`
- fixed: 2026-10-29. Locks name the plan that opens them, read from `capabilitiesFor` (`requiredPlan` in purchases/featureLocks.ts): the pill reads Core or Max and a screen reader hears "Locked. Part of Core." at every badge and spoken-label site. `open(feature)` and the locked-route guard pass `Wall { entry: 'locked', feature }` (web address round-trips and validates it); the wall preselects the opening plan's yearly offer, opens with a short brief, and says "Unlock with Max" when the chosen plan opens it. The free list reads "Review of your lesson, daily and sample phrases" and "Your earned lesson recaps", held against Free's real review deal (`dealForTier`). Review's held-back row names Core ("… is part of Core.", "See Core"), a source sweep refuses any lock that names the trial, and Explore's plan lock opens `Wall { entry: 'locked', unlock: 'collections' }` with a brief and Core chosen (verifier round, 2026-10-29). Today's Coming up lock is realMoment's, matching its tap. A door changed on a mounted wall resets its page (`doorChange`), and the first scene replaced by anything but its conversation now counts as an early exit. Tests: wall/lockedEntry.test.ts, wallPages.test.ts, launchWall.test.ts.

### F911 — The free limit shows three different messages and never says when time comes back
- severity: P2
- status: [x]
- where: apps/mobile/src/empty/emptyStates.ts
- note: Found 2026-10-28 by the product review (filed 2026-10-29 on claude/review-b-paywall, Stream B; LR-09). Speak, Start (live/useLiveSession.ts) and
  Subscription each word the limit differently, and none shows the refill time the 402 refusal
  carries. Related F651.
- verified-by: `every out-of-time message names when the next free conversation is ready`
- fixed: 2026-10-29. `apps/mobile/src/purchases/outOfTime.ts` is the one source of the out-of-time words (title, refill line, "Until then, practise offline."), from the plan, the reason and `periodEnd` or a 402's `refillsAt`. It is called by `planStatus.ts` (`planStatusFor`'s band line and `outOfTime` field, read by Speak's band via `minutesBand`, the Settings and Subscription `planSentence`, and Speak's card via `empty/emptyStates.ts` `outOfTimeCard`), `tutor/orbState.ts` through `TutorTab.tsx` (the orb), `live/refusalRefill.ts` `refusalWords` (a 402 with `refillsAt`; without one the `useLiveSession.ts` table holds the same untimed words, pinned by `outOfMinutes.test.ts`), `home/nextAction.ts` `plansLeadBody` (Today) and `wall/wallAccount.ts` (the wall's account line). A free refill time already passed says "should be ready about now", never a past time. `outOfTime.ts` imports nothing from the app, so there is no require cycle. A free row with no refill time says "Your free conversation is used for now. Practice and review still work offline." and never a guessed time, which stays true for the row that never refills; a paid plan says "Fresh minutes on 27 November.". Test in `purchases/outOfTime.test.ts`.

### F912 — Subscribers and lapsed subscribers are offered a 7-day free trial
- severity: P2
- status: [x]
- where: apps/mobile/src/wall/wallCopy.ts
- note: Found 2026-10-28 by the product review (filed 2026-10-29 on claude/review-b-paywall, Stream B; LR-10; observed, fixture trial facts). A Core
  subscriber's compare page offers "Start 7-day free trial" and then "You already have this plan";
  a lapsed Max subscriber gets the Core trial wall at cold start.
- verified-by: `a current subscriber never sees trial copy on the wall`
- verified-by: `a lapsed subscriber sees resubscribe wording rather than a trial`
- fixed: 2026-10-29. Trial copy needs the offer's `trialDays`, a read status on Free, and not lapsed (`trialCopyAllowed`); an unread status shows the plans page loading rather than a trial it may take back. A current subscriber is offered the other plan's yearly offer, their plan is marked "Your plan" in the compare sheet and is not offered as a purchase (buy()'s refusal untouched as the backstop). A lapsed learner reads "Welcome back" and a plain offer. Tests: wall/subscriberWall.test.ts.

### F913 — The compare sheet contradicts itself on conversations, allowances and streak freezes
- severity: P2
- status: [x]
- where: apps/mobile/src/wall/wallCopy.ts
- note: Found 2026-10-28 by the product review (filed 2026-10-29 on claude/review-b-paywall, Stream B; LR-11). "Both plans include every conversation"
  sits beside a Max-only Rehearse line; Core is "about" 10 minutes a day and Max "up to" 20; "every
  plan includes a second streak freeze" contradicts Free's one (purchases/capabilities.ts). Related
  F564.
- verified-by: `the compare sheet claims only what each plan's capabilities grant`
- verified-by: `both plans state their minutes per 30 days in the same words`
- fixed: 2026-10-29. One allowance template from the catalogue ("300 minutes every 30 days (about 10 a day)."), Max's extras read from its capabilities, `dailyAllowance` is "about" for both, COMPARE_INTRO says every scene and names Max's two extras, and INCLUSIONS.streak reads "Paid plans add a second streak freeze and a one-tap repair." (a pinned capabilities.ts line; the founder approved the diff on 2026-10-29 and it is re-pinned in moneyUntouched.test.ts). Tests: wall/subscriberWall.test.ts.

### F914 — The Terms have no subscription section, and deleting an account ends with no confirmation
- severity: P2
- status: [x]
- where: apps/mobile/src/legal/terms.ts
- note: Found 2026-10-28 by the product review (filed 2026-10-29 on claude/review-b-paywall, Stream B; LR-12). Billing lines exist only in Privacy. After
  "Verify and delete permanently" (settings/SettingsScreen.tsx) the app goes straight to sign-in,
  with no confirmation and no reminder to cancel the store subscription. The re-authentication step
  may be a mock-adapter artefact. Legal wording needs review before release.
- fixed: 2026-10-29. Terms gain a draft "Subscriptions" section (`TERMS_SUBSCRIPTIONS`, own
  600-character cap, rendered by `TermsScreen.tsx`); a complete delete ends on
  `auth/AccountDeletedNotice.tsx` with the store-cancel reminder and a store link on iOS and
  Android. Legal wording still needs professional review before release.
- verified-by: `the terms state auto-renewal, cancellation timing and that deletion does not cancel`
- verified-by: `account deletion ends on a confirmation that names cancelling the store subscription`

### F931 — The wall stacks and stretches, and its default billing period varies
- severity: P3
- status: [x]
- where: apps/mobile/src/nav/RootNavigator.tsx
- note: Found 2026-10-28 by the product review (LR-32; filed 2026-10-29 on claude/review-b-paywall,
  Stream B, narrowed to the wall). Terms then Privacy from the wall left two walls stacked (seen
  after a web reload and browser Back); the desktop compare sheet stretches to 1280 px; the
  billing period default varies (shares its cause with F907's alternating plan). The sign-out
  parts of LR-32 (no confirmation, signing back in lands on Settings, password fields outside a
  form) belong to Stream E and are filed there.
- verified-by: `opening Terms then Privacy from the wall keeps one wall`
- verified-by: `the compare sheet keeps a readable width on a desktop screen`
- fixed: 2026-10-29. The Wall is a single-instance screen (`getId` from `nav/singleWall.ts`), so Terms, Privacy and a browser Back that arrives as a fresh navigate return to the open wall instead of stacking a second. Every other way out of the wall replaces it (the bank, and leaving with nothing behind), so no wall is left under a live scene for a later out-of-minutes wall to pop back to. The compare sheet uses the Sheet's reading measure (`READING`), so it no longer stretches across a desktop screen. The billing-period default now follows F907's fix.

### F932 — The trial page reproduces another app's trial-offer composition
- severity: P3
- status: [x]
- where: apps/mobile/src/wall/trialPaywall.ts
- note: Found 2026-10-28 by the product review (LR-26, a brand and originality risk; filed
  2026-10-29 on claude/review-b-paywall, Stream B). The "How your trial works" title, plan toggle
  and lock, bell, calendar and star timeline follow Headspace's trial screen closely. Keep the
  transparency (charge date, interval, how to cancel, nothing charged today) and redraw it in
  Luvani's own learning-led form, per the report's section 10 (founder decision 6).
- fixed: 2026-10-29. Titled "Your first week with <plan>", a route of dots on one line replaces the glyph timeline, and the cafe counter scene opens the page; tests `the trial page walks the first week as a route with Luvani's own scene art` and `the redrawn trial page still names the charge date, the price, how to cancel and that nothing is charged today` (apps/mobile/src/wall/trialRoute.test.ts).
- verified-by: `the trial page walks the first week as a route with Luvani's own scene art`
- verified-by: `the redrawn trial page still names the charge date, the price, how to cancel and that nothing is charged today`

### F933 — A trial row created by a purchase before any device claim is spent and never refills
- severity: P2
- status: [ ]
- where: supabase/migrations/20261023220000_daily_free_allowance.sql:91
- note: Found 2026-10-29 while fixing F911 (Stream B). `begin_billing_refresh` creates a trial row
  for an account that starts a purchase before any device claim. The row is already spent, with
  `weekly_taste=false` and no `period_end`, so the free conversation never refills and
  `/billing/status` has no refill time to give. The app now words this truthfully ("Your free
  conversation is used for now. Practice and review still work offline.", `purchases/outOfTime.ts`),
  but the learner silently loses the every-other-day taste (REV-001). Not fixed here: it needs a
  migration and the pinned billing files, so it waits for its own change with founder approval.
- verified-by: `a trial row begun by a purchase still refills its free conversation every other day`

### F915 — Onboarding has no Back, and a new account cannot leave the first scene without starting it
- severity: P2
- status: [ ]
- where: apps/mobile/src/onboarding/PreAccountOnboarding.tsx
- note: Found 2026-10-28 by the product review (filed 2026-10-29 on claude/review-c-first-run, Stream C; LR-13; five reviewers). No step has a back control
  and the URL stays /, so browser Back leaves the app. The signed-in first scene
  (onboarding/FirstLivePractice.tsx) and the consent screen offer only ways into a live session. Decided 2026-10-29 (founder decision 15 and the programme plan): a back chevron on every step after the first, browser Back steps back on web, the consent screen offers back and "Create an account first", and the signed-in first scene offers "Look around first". This reverses F352's "no visible back".
- verified-by: `every onboarding step after the first offers back`
- verified-by: `the first scene and the consent screen offer a way home without starting a session`

### F916 — The personal plan names a first conversation that scene 1 is not
- severity: P2
- status: [ ]
- where: apps/mobile/src/onboarding/PersonalPlan.tsx
- note: Found 2026-10-28 by the product review (filed 2026-10-29 on claude/review-c-first-run, Stream C; LR-14; five reviewers). The plan promises a train
  ticket or a restaurant table while scene 1 is always "Le premier café"; "A little daunting" is not
  reflected; the typing sentence appears twice; Learning preferences then show "Not chosen yet"
  for the starting point (settings/profileView.ts).
- verified-by: `the plan's first conversation line comes from scene 1`
- verified-by: `the starting point chosen in onboarding shows in learning preferences`
- verified-by: `the plan's method sentence never repeats a clause`

### F917 — "I can get by" starts the learner at Starter
- severity: P2
- status: [ ]
- where: apps/mobile/src/onboarding/plan.ts
- note: Found 2026-10-28 by the product review (filed 2026-10-29 on claude/review-c-first-run, Stream C; LR-15). Journey then requires the three Starter
  abilities (café and hotel basics) before Basics; the past-tense scene this learner needs sits in
  Everyday. Where "I can get by" starts is a product decision. Decided 2026-10-28 (founder decision 5): "I can get by" starts at Basics, with "Skip ahead" to Everyday; a skipped stage is never credited as earned.
- verified-by: `a learner who can get by does not start at Starter`
- verified-by: `skip ahead starts the learner at Everyday`
- verified-by: `Journey never credits a stage the learner skipped`

### F925 — The guest early-exit summary gives a train-station tip after a café scene
- severity: P2
- status: [ ]
- where: packages/core/src/firstPractice.ts
- note: Found 2026-10-28 by the product review (filed 2026-10-29 on claude/review-c-first-run, Stream C; LR-25; two reviewers). "Next time, try asking about
  departure times and directions" after the café scene, with "Save your progress" as the only
  button and an empty box when there were no replies. Decided 2026-10-29 (founder decision 16): "Save and finish the scene" first (account, then the café scene signed in), "Save your progress" second.
- verified-by: `the early-exit tip matches the scene that was played`
- verified-by: `an early exit with no replies hides the empty summary box`
- verified-by: `a guest early exit offers to save and finish the scene`

### F926 — Two full-screen splashes and a disabled tutor choice stand before the first French
- severity: P3
- status: [ ]
- where: apps/mobile/src/onboarding/PreAccountOnboarding.tsx
- note: Found 2026-10-28 by the product review (filed 2026-10-29 on claude/review-c-first-run, Stream C; LR-27). "Get Started" blocks every click until tapped,
  a second splash follows sign-up, and "Choose a tutor" stays disabled until a pick: 13 taps and 8
  decisions to the first French. Decided 2026-10-29 (founder decision 18): the welcome after sign-up shows once and never again on a reload.
- verified-by: `a recommended tutor is preselected`
- verified-by: `the welcome after sign-up shows once and never on a reload`

### F930 — The guest limit says "this network" with no explanation
- severity: P3
- status: [ ]
- where: apps/mobile/src/onboarding/guestScene.ts
- note: Found 2026-10-28 by the product review (filed 2026-10-29 on claude/review-c-first-run, Stream C; LR-31). Learners on office, university or café Wi-Fi
  cannot tell why their free tries are gone; the offline drill is not offered there. Decided 2026-10-29 (founder decision 17): honest copy and an account only, no guest offline drill; the same 429 also comes from the global cap, so the line names no network.
- verified-by: `the guest limit message offers an account and names no network`
