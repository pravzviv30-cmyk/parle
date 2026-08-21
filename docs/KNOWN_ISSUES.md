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
  provider serves a call is wiring, not routing.
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
