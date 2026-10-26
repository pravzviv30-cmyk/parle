# Decision log

Record new lasting architecture and development-workflow choices here. This log
starts on 10 October 2026; it does not reconstruct the project's earlier history.
Existing product and technical decisions remain in [PRODUCT.md](PRODUCT.md),
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the domain documents.

Use a stable ID, date, status (`accepted`, `proposed` or `superseded`), decision,
reason, consequence and source. A proposal is not permission to implement it.
When a decision changes, add a superseding entry and link it from the old one.
Routine task progress belongs in its change plan.

## DEV-001 — Add a small shared agent entry point

- Date: 2026-10-10
- Status: accepted
- Decision: use root `AGENTS.md` for repository navigation and working rules,
  and `CONTEXT.md` as an index into the existing documents.
- Reason: Luvani already has detailed context, but its root instructions were
  centred on Claude Code. A root entry point makes the same structure discoverable
  to Codex without loading every document.
- Consequence: retain the current workspaces and domain sources of truth; keep
  Claude-specific commands and model pins in `CLAUDE.md` and `.claude/`.
- Sources: [change plan](docs/changes/agent-workflow.md),
  [official AGENTS.md guidance](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

## DEV-002 — Keep reusable change contracts in Git

- Date: 2026-10-10
- Status: accepted
- Decision: use a Markdown change plan with dependency-ordered tasks, allowed
  files, acceptance checks and an execution log for substantial work. Reuse
  an existing programme plan when it already supplies those fields.
- Reason: `.forge/` and `.loop/` contain ignored local run state. A small tracked
  contract lets another session resume work without reconstructing a chat.
- Consequence: [docs/changes/](docs/changes/README.md) holds reusable contracts;
  `KNOWN_ISSUES.md` remains the defect ledger. Tiny fixes do not need a ticket.
- Sources: [workflow](docs/changes/README.md), [forge](docs/FORGE.md),
  [loop](docs/LOOP.md).

## DEV-003 — Execute reviewed change plans sequentially on the local machine

- Date: 2026-10-10
- Status: accepted
- Decision: extend `scripts/loop.mjs` with one executable `luvani-loop` JSON
  block inside a tracked change plan. Use task dependencies, narrow write scopes,
  runner-owned checks, invocation deadlines and ignored local resume state.
- Reason: a green bug gate does not mean a feature plan is complete. The existing
  local CLI seam can perform planned changes without a VPS or a new scheduler.
- Consequence: no automatic staging, commits or destructive rollback. Failed
  patches survive for repair and review. Only a full green gate completes a run.
  Scope checks detect Git-visible violations after execution; they are not an
  OS sandbox. `/forge` and its pinned reviewers remain a separate workflow.
- Sources: [loop contract](docs/LOOP.md),
  [implementation and evidence](docs/changes/local-loop.md).

## UI-001 — Bundle C's vectors and keep motion tied to screen activity

- Date: 2026-10-11
- Status: superseded for C2 rendering by [UI-002](#ui-002--render-c2s-exact-figma-layers-through-the-shared-motion-engine); retained for the older C assets
- Decision: compile the original C illustration family to local Rive files with
  matching SVG stills. Reuse the existing native Rive runtime; pin the official
  web renderer and bundle its WASM. Ordinary UI transitions stay in Animated.
- Reason: the user requested continuous illustration movement, press depth and
  haptics, followed by a soft gradient sphere instead of the Figma ring/bar orb.
- Consequence: decorative loops run only on active foreground screens with
  reduced motion off. Confetti and UI events do not repeat independently.
  Measured input/output owns orb amplitude; actual session state owns its colour.
  Closed interests join the core first-practice brief and existing draft storage;
  no parallel navigator, policy, authentication service or progress store is added.
- Sources: [change plan](docs/changes/bold-rhythm.md),
  [asset provenance and rebuild](apps/mobile/assets/bold-rhythm/README.md).

## UI-002 — Render C2's exact Figma layers through the shared motion engine

- Date: 2026-10-14
- Status: accepted
- Decision: bundle C2's 127 exported SVG layers and assemble the authored
  compositions in one scoped `onboarding/motion/C2Scene.tsx` host. Use the
  existing Reanimated/`motion/drive.ts` path for closed 4.8-second Rest/Float
  cycles and the welcome logo's delayed 8.8-second ring rotation. Do not use
  older C Rive compositions as substitutes for the approved C2 artwork.
- Reason: C2 changed illustration geometry, mascot emotions, tutor portraits,
  the blue sphere and local motion variants. Exact layers preserve those shapes
  while a stable shared clock avoids whole-page loop transitions and resets.
- Consequence: no Expo SDK upgrade or additional motion runtime. Screen
  activity, AppState and live reduced motion guard each clock; reduced/unknown
  preference renders still art. Confetti and earned events remain one-shot.
  Existing navigation, draft/account storage, core learning policy and server
  admission remain authoritative. This decision does not establish native
  acceptance, legal review or production activation.
- Sources: [C2 design](DESIGN.md#14-october-2026--c2-bold-rhythm),
  [asset manifest](apps/mobile/assets/c2/manifest.json),
  [change plan](docs/changes/bold-rhythm.md).

The founder's 14 October question-illustration redraft extends this renderer
with an optional child-vector slot inside the same floated group. Custom local
question SVGs use stable geometry, memoized namespaced XML and the C2 palette;
they are explicitly distinguished from the original hashed Figma exports.
This reuses the existing clock, activity and Reduce Motion policy without a
new animation runtime, loader or presentation state owner. The cloud family
guides the new organic character style; a cloud is not required on every page.

The subsequent natural-gesture follow-up passes that same phase through an
optional `renderVectors` callback to reusable memoized semantic-part hosts inside
`C2Scene.tsx`. Absolute full-canvas parts rotate around source-coordinate joints;
held props and rear arms share a joint definition. This keeps the existing
lifecycle and motion import boundary while allowing purposeful gestures without
per-part clocks or rebuilding SVG XML. Baseline-corrected offsets preserve the
authored still pose; the shipped gestures use zero offsets. Continuous interval
geometry proofs cover rotation/scale/lift envelopes and the enclosing float.

The 15 October full-flow audit retains the same ownership: edit sheets suspend
their mounted parent scene, and disabled Next guidance uses the existing
button's reserved geometry. Earned-result reveal steps are monotonic across
motion-preference changes. Restart cleanup is awaited by its current auth or
bootstrap owner and preserves the draft until reminder cancellation succeeds;
no second cleanup queue, motion state store or navigation owner was introduced.


## UI-003 — Keep guest refusal and authenticated first practice in their existing owners

- Date: 2026-10-15
- Status: superseded for the guest first scene by [UI-011](#ui-011--guest-first-scene-one-scripted-café-exchange-before-sign-up) (2026-10-23); the guest conversation stays closed and the account handoff below remains the fallback
- Decision: preserve the closed production guest-live boundary and distinguish
  disabled anonymous admission from unsupported speaking. Offer the existing
  account flow deliberately for the former, retain the current answered draft,
  and complete authenticated setup through ProfileGate before the existing
  FirstScene entry. Actual guest completion, rather than accepted Terms,
  determines whether the first practice remains pending.
- Reason: connection retry alone cannot resolve an unsupported guest capability,
  and account creation cannot add a speech pipeline to a typed-only service.
- Consequence: no anonymous paid-admission implementation, new navigator,
  profile store or session policy. Existing profiles remain authoritative;
  completed guest adoption is retained. Runtime service activation and native
  acceptance remain separate from this source routing decision.
- Sources: [onboarding handoff](docs/ONBOARDING.md#account-handoff-when-guest-live-is-unavailable),
  [live entry](docs/LIVE_VOICE.md#c2-room-presentation),
  [change plan](docs/changes/bold-rhythm.md).

## VOICE-001 — Bound recognition repair to current conversational support

- Date: 2026-10-11
- Status: accepted
- Decision: interpret only close, unambiguous French sound-spelling matches to
  current support phrases; publish the same labelled interpretation to the learner
  and brain. Keep typed input, raw-input safety checks and grading ownership intact.
  Use no-reasoning GPT-6 Luna by default for live turns and frames, with explicit
  routing overrides retained.
- Reason: the user confirmed real speech but reported slow replies and beginner
  French recognition errors. Contextual repair adds no model round trip; a bounded
  synthetic comparison supports the latency setting without claiming broad quality.
- Consequence: this is not pronunciation assessment, certainty about intent or
  production voice acceptance. Conservative unmatched speech is left unchanged.
- Sources: [live voice](docs/LIVE_VOICE.md), [brain](docs/TUTOR_BRAIN.md),
  [verification plan](docs/changes/bold-rhythm.md).

## UI-004 — One design system: Bright Luvani (direction B)

- Date: 2026-10-19
- Status: accepted
- Decision: Luvani has one design system, direction B ("Bright Luvani"). It
  replaces the C2 "bold rhythm" look, the Luvani theme on the paywall and account
  screens, and the earlier revamp B composition. DESIGN.md is rewritten as that
  one system. Old token names (`boldRhythm`, `mainApp.light`, `boldType`,
  `paper.lineOnCard`) stay as aliases until their screens move (A2 parts, A3 nav).
- Reason: three systems running at once let the same role drift into several
  values, and the founder approved direction B as the single target.
- Consequence: screens are not restyled by this entry. Outfit stays the only
  face, the contrast floors stay, and dark mode stays off (`DARK_MODE_ENABLED`
  false, `mainApp.dark` kept). Superseded on dark mode by UI-008 (2026-10-20),
  which turns it on behind per-route pins. Learner-facing stages are Starter, Basics,
  Everyday, Chatting and Confident; CEFR stays internal.
- Sources: [DESIGN.md](DESIGN.md#one-system-bright-luvani), founder approval
  2026-10-19.

## UI-005 — Consolidate the tokens and allow one soft lift

- Date: 2026-10-19
- Status: accepted
- Decision: fold duplicate values into one each. Muted text #655F77 becomes
  `paper.inkSoft` #5C5A74. Hairlines #EADFCB and #DCD2C4 become one `paper.line`
  #F0E6D6. The C2 sand #EFE6D9 becomes `paper.inset` #F5EEE2. Add
  `paper.inkOnPastel` #4A4766, `colour.mintWash` #D4F5E5, `colour.mintWords`
  #1F7A52, `colour.bluePressed` #2A20B0 and the `pastel` table (butter, lavender,
  peach, sage). Add one shadow token, `shadow.lift` (y 12, blur 24, spread -16,
  ink at 0.45 via `liftInk`), for illustrated Explore cards only, reversing the
  no-shadow rule for that card. Type: `title` 34/38 ExtraBold, `heading` and
  `cardTitle` ExtraBold, new `eyebrow` 13/18 Bold. Radii unchanged.
- Reason: one value per role, and the B screens need a pastel secondary ink, a
  green that can letter words, a pressed blue and a lift for the Explore art.
- Consequence: every new text pair clears 4.5 (inkOnPastel 6.5 to 7.3 on the
  pastels, mintWords 5.3 on white and 4.5 on mintWash, inkSoft 5.8 on inset).
  The softer hairline sits a Delta-E of 5.8 off the ground, so the hairline's
  separation floor on the ground drops from 8 to 5; it is decorative and never a
  control's only edge. The French hero (34) may now equal the screen title
  rather than exceed it. `palette.test.ts`, `theme.test.ts` and `layout.test.ts`
  pin the new values.
- Sources: [DESIGN.md colour](DESIGN.md#colour), `apps/mobile/src/palette.ts`,
  `apps/mobile/src/theme.ts`.

## UI-006 — Five tabs: Today, Explore, Speak, Practice, Journey

- Date: 2026-10-19
- Status: accepted (lands in A3)
- Decision: the signed-in app moves from four tabs to five, labelled Today,
  Explore, Speak, Practice and Journey. Route names stay `Home`, `Explore`,
  `Tutor`, `Practice` and `MyFrench` so links and tests keep working.
- Reason: direction B gives exploring scenes its own home and names progress as
  a journey rather than a score.
- Consequence: the tab bar, its tests and the DESIGN.md tab table change in A3,
  not before. Profile still opens from the avatar and Friends stays a Profile
  route.
- Sources: [DESIGN.md composition rules](DESIGN.md#composition-rules).

## UI-007 — Phase B content honesty and the lock seam

- Date: 2026-10-20
- Status: accepted (Phase B, B0 to B6)
- Decision: a direction B artboard line with no data behind it is dropped or
  reworded, never filled. Today has no Coming up card until Phase C stores the
  event, its checklist and Not now. Speak's twist reads "Same scene, a bit less
  help" and is offered only when `replayRung` would really start with less help;
  authored twists wait for D2. "Comes up often" is hidden on Practice and Your
  fixes until Phase C stores a correction reason with each fix
  (`COMES_UP_OFTEN_ENABLED`). Explore's interest card says "picked for you",
  because interests are not stored. The scene preview says "might say" only
  over an authored opener bundled on the device, and "You could start with"
  everywhere else. Today's week says "minutes practised" (typed conversations
  have a length too) and "phrases saved" (a card added this week is not yet
  retained). A phrase says "Used n times" from its own counter, because nothing
  counts distinct conversations.
- Decision: lock badges come only from `access/featureAccess.ts`, which mirrors
  `purchases/featureLocks.ts` (`featureLockedNow`, failing open). No surface
  decides a lock inline; a route-less lock opens the Wall through `tapThrough`.
- Decision: stage words replace CEFR on learner surfaces. Starter (A0) and
  Basics (A1) name the stage on Journey, Speak and guided mission previews.
  "Starting out" stays only as Explore's tier filter and a daily scene's tier.
- Reason: Luvani never claims what it has not measured or stored, and a lock a
  learner meets must agree with the billing standing that decides it.
- Consequence: each Phase C store (events, correction reasons, interests) must
  bring its line back with a test, and a new lockable surface reads the seam.
  On 2026-10-22, Everyday (A2) joins Starter (A0) and Basics (A1) on Journey,
  Speak and guided mission previews, all read from `MISSION_LEVELS` and `stageOf`
  in `apps/mobile/src/scenes/scenePreview.ts`. On 2026-10-22 (mission spine B1),
  Chatting (B1) joins as the fourth mission stage; CEFR stays internal.
- Sources: [DESIGN.md composition rules](DESIGN.md#composition-rules),
  `apps/mobile/src/access/featureAccess.ts`.

## UI-008 — Canvas fidelity, dark mode from M3, and the Codex tab bar

- Date: 2026-10-20
- Status: accepted (fidelity rebuild, steps 0 to 13 on `claude/direction-b`)
- Decision: every direction B screen is rebuilt to its canvas artboard
  (https://claude.ai/artifact/KtAoFKnzU7SWjWq6fatA7A, version 1792530488-069b):
  layout, slots, type sizes, colours, radii, spacing and the canvas art. The
  artboard wins over DESIGN.md on layout; a slot with no data keeps its place
  and drops only the missing number. Phase B's reviewed wording stays
  ("saved", "practised", "Uses", relative days, commas for middots).
- Decision: dark mode returns for the main app (`DARK_MODE_ENABLED` true). The
  dark values are the Figma "M3 · Reviewed main app · Dark" page (file
  sjAwoGinWQKvhGrWbgMO18, node 307:364), already held in `mainApp.dark`: pastel
  tiles become M3's tints, the yellow hero becomes the M3 hero with a gold
  button, the ink primary becomes violet. Appearance follows the device, with a
  Settings row (Follow device, Light, Dark). Onboarding stays pinned light. The
  paywall keeps its current design and structure and only gains a dark variant.
- Decision: the tab bar is Codex's floating capsule (Figma `C2/Main2/Navigation`,
  node 292:1103): an ink capsule in both themes, a violet selected cell with a
  gold bulk glyph and a cream label, Codex's Iconsax icons, B's labels.
- Decision: three held cards show now with the data that exists. "Comes up
  often" uses error patterns with authored copy and never a count. Today's
  "Coming up" uses the latest remembered life event, with no countdown and no
  checklist; Not now hides it for the app session. Speak's topic chips use
  remembered interests and events, falling back to suggestions. Review keeps no
  count and no intervals. The live room's pill gives the scene's own length,
  never the allowance. A speaker on the learner's own line plays the tutor's
  voice, labelled "Hear it said". "Works offline once unlocked", "You asked for
  less help this time", "free" on Café basics and "free, offline" on live
  situations stay hidden until their data exists.
- Reason: the founder rejected Phase B because it did not look like the canvas,
  and asked for M3's dark mode and Codex's tab bar.
- Consequence: colours reach screens through `useB()` rather than static
  imports as each screen is rebuilt; every hex stays in `palette.ts`; contrast
  tests cover both themes; each step is proven by light and dark simulator
  screenshots beside its artboard before it is committed.
- Sources: founder answers 2026-10-20 (this session), canvas artboards, Figma M3.

## UI-009 — Direction B review decisions

- Date: 2026-10-21
- Status: accepted (founder answers to the fidelity review)
- Decision: Journey's "What you can do" shows no "n of 3 earned" count; abilities
  carry no count, as before. The live mic is green (mint, with ink on it), not
  the artboard's sun. Onboarding keeps no visible back button (F352); the
  phone's back gesture still works. The age check stays after sign-up and the
  AI-partner consent stays where it is; moving either before the first scene is
  an age-policy change for another round. Profile's plan card may name the free
  plan's "5 free minutes of speaking each week", the plan's fixed allowance.
  Review's "I said it" shows words only, with no microphone glyph, because
  nothing records. The onboarding line "Speak when you choose" is approved.
- Reason: each artboard detail was weighed against an existing rule; the
  founder kept the rule except where the plan's fixed allowance is honest.
- Consequence: the review page lists these as decided; `live/liveRoomView.test.ts`
  pins the green mic and `review/cardView.test.ts` pins the said-it button.
- Sources: founder answers 2026-10-21, https://claude.ai/artifact/LBjptRAoaNZRy9ESMb229a.

## VOICE-002 — Speak the expected paths without a model round trip

- Date: 2026-10-22
- Status: accepted
- Decision: a scripted lesson speaks its opening line, good and partial answers,
  rescues and skips straight from the lesson through `scriptedSpeech.ts`, and
  calls the pipeline LLM only for a missed answer. A free conversation's first
  rescue on an exchange renders the hint quietly with no model call; a second
  rescue still asks the brain. The app records reply latency on the device.
- Reason: the market review (October 2026) found reply speed and being talked
  over while thinking are among the most common complaints about AI tutors. A
  model round trip of three to five seconds sat in front of every scripted line
  and every rescue, and could only paraphrase lines the script already held.
- Consequence: scripted speech is exact and cache-warm, so it is near-instant
  and costs no LLM tokens. Free-conversation reply latency is unchanged by this
  decision; streaming the brain turn is the next step and is not claimed here.
  Phone-audible latency still needs a device run to measure.
- Sources: [pedagogy](docs/PEDAGOGY.md#the-rescue), [live voice](docs/LIVE_VOICE.md).

## VOICE-003 — Stream the conversation turn and speak its reply early

- Date: 2026-10-22
- Status: accepted
- Decision: on OpenAI, a live conversation turn streams. `TurnSchema` orders
  every field the spoken line depends on before `sceneReply`; once that field
  closes, the validated leading fields reach the worker, which runs the usual
  integration, recast and output guard on them and speaks. The full turn still
  drives state, profile, checkpoint and the published view, with the same words.
- Reason: free-conversation replies (every mission, so every new learner) waited
  for the whole structured turn, about 5 to 6 seconds, before any sound. The
  spoken fields are a fraction of the turn, and the rest is only shown or stored.
- Consequence: speech now begins before the durable checkpoint ACK, which
  reverses the "checkpoint before delivery" acceptance recorded in
  docs/changes/bold-rhythm.md. Safety validation of everything spoken still
  happens before delivery. A turn that fails after its reply was heard keeps the
  heard reply. Field order in `TurnSchema` is now part of the contract. Measured
  phone-audible latency still needs a device run.
- Sources: [live voice](docs/LIVE_VOICE.md), `packages/brain/src/llm/spokenFields.ts`,
  `services/tutor-agent/src/convo.ts` (`speakEarly`).

## VOICE-004 — Score pronunciation beside the turn, never in front of it

- Date: 2026-10-22
- Status: accepted
- Decision: a scripted lesson grades and answers a spoken turn on its words
  alone. Pronunciation is scored in the background, only when the learner said
  the lesson's reference line, and the result is added to the session's evidence
  with core's pure `addPronunciation`, read by the end card. A finishing lesson
  waits at most 2.5 s for scores in flight. Live audio for the paid Speechace
  route is converted in process (`services/shared/liveScoringAudio.ts`).
- Reason: trustworthy pronunciation feedback is the product's headline
  difference, and it was switched off because awaiting the score added up to
  ten seconds of silence per turn (F623) and the decoder it needed could not be
  deployed (F805). Words-right and sounds-right are separate questions
  (PRODUCT.md), so a score should never change a grade after the learner has
  been answered.
- Consequence: a low live score no longer holds the rung by turning a right
  answer into a partial one; it shows up as the end card's one focus sound
  instead. Scores that arrive late are reported as not assessed rather than
  awaited. `LUVANI_AUDIO_SCORING` stays off by default until a real-learner run
  is reviewed, and production activation is blocked on F863 (the paid lesson
  quote prices no scoring).
- Amended 2026-10-22 (F866): free conversation (missions) is scored the same
  way. The only reference text a mission has is the full line the tutor hands
  over on the second rescue (assistance depth 2), so a spoken turn is scored
  only while that line is shown and only when the learner said it (exact,
  fillers or one recognition slip). The brain answers without waiting, a
  finishing conversation waits at most the same 2.5 s (not after a safety stop,
  a terminal failure or near the hard limit), and the recap carries one focus sound. One flag
  covers both session kinds, so production startup refuses it unless the lesson
  and the convo quote bindings both declare a scoring component.
- Sources: [pedagogy](docs/PEDAGOGY.md), F623, F805 and F866 in
  [known issues](docs/KNOWN_ISSUES.md).

## VOICE-005 — Speak once the reply's French has streamed; priority tier is opt-in

- Date: 2026-10-22
- Status: accepted
- Decision: the streamed live turn hands over to speech when `sceneReply.fr`
  closes instead of the whole `sceneReply`. Its `frWritten` and `en` are display
  only and arrive with the full turn, which guards them before anything is shown.
  The early output guard now checks exactly what is spoken (the reply's French,
  the coach line and the narration). `OPENAI_LIVE_SERVICE_TIER` sends OpenAI's
  `service_tier` on the live turn and frame only, off by default.
  `scripts/measureLiveTurn.mjs` measures time to each spoken milestone.
- Reason: after VOICE-003 about 2 s still passed before the spoken fields
  arrived. Measured on gpt-6-luna over 24 synthetic mission turns per run
  (`docs/live-latency-evidence/`):
  - First token is about half the wait (p50 about 0.9 to 1.0 s).
  - Coaching costs 0.4 to 0.7 s on turns with an error.
  - The reply's unspoken English costs p50 97 to 116 ms per turn, now removed.
  - With the default tier, the spoken fields arrived at p50 2035 ms before the
    change and 1573 ms after. Most of that difference is a faster API window:
    measured within each run, the code change saves about 0.1 s.
  - `service_tier: priority` brought the spoken fields to p50 1247 to 1249 ms
    (p95 1583 to 2162) and the full turn to about 2.1 s, by decoding about twice
    as fast.
- Declined, with numbers:
  - Reasoning effort `low`: first token 4.6 s. Effort stays `none`.
  - Leaving verbosity unset: speech at 2.3 s, more output. It stays `low`.
  - `gpt-5.6-luna`: no faster and twice the price.
  - A tighter coach contract (at most two findings, shorter why): more coach
    output, not less.
  - Starting TTS on the reply's first sentence: p50 0 to 49 ms over the
    `fr` hand-over, for a recast and guard redesign.
  - Prompt trimming: the cache hit rate is 0.92 to 0.96.
  - `assessment` and `coach` stay before `sceneReply`: the coach line's
    speaking and the recast depend on them.
- Quality: the brain-playground eval was run before and after (16 cases,
  gpt-6-luna) and again with priority. All three runs had 0 hard failures. The
  priority run's one expectation miss is a typographic apostrophe in
  "T’as faim ?" against a straight-quote regex. The prompt did not change, and
  coach items per turn, coach lines and reply length were unchanged across runs.
- Consequence: if the full turn's guard rejects the English after the French
  was heard, or the turn fails after early speech, the heard French is shown
  with no translation. Priority tier is billed at OpenAI's higher rate, so the
  founder decides whether to set it. These are model-side timings only.
  Recogniser, TTS first audio and phone playout still need a device run
  (`[luvani:live] reply-latency`).
- Sources: [live voice](docs/LIVE_VOICE.md), `packages/brain/src/llm/spokenFields.ts`,
  `packages/brain/src/llm/openaiResponses.ts`, `scripts/measureLiveTurn.mjs`.

## UI-010 — Beta report route by mail, and listen only on the voiced grant

- Date: 2026-10-22
- Status: accepted
- Decision: "Report this reply" on both end cards opens the learner's own mail
  app to the support address. The flag in the live room never leaves the app: it
  saves the report, and the recap or lesson summary opens the mail sheet by itself
  when the session ends, because opening Mail mid session drops the room (web
  unloads the page and LiveKit disconnects; iOS has no background-audio mode). The subject carries only the
  session id and app version (`settings/reportMail.ts`), and there is never a
  body. Listen only is the voiced `convo` or `lesson` grant with the microphone
  kept closed (`listenOnly` on the route and on `useLiveSession`), offered as a
  third choice on the Tutor tab and a third lesson tile on the Scenes screen. It
  is not a new `LiveMode`.
- Reason: the closed beta needs a way to flag a bad tutor reply, and Luvani
  keeps no transcript, so a report is only useful with a reference that matches
  it to the usage ledger and worker logs. That reference is the one exception to
  `openMail`'s no-prefilled-text rule. Learners in public cannot speak aloud
  (PRODUCT.md: never require it), and the typed grants also silence the tutor,
  while the room's Type control already keeps the voice on with the mic off.
- Consequence: the three rules for a reporting route in
  [PRIVACY_AND_SAFETY.md](docs/PRIVACY_AND_SAFETY.md) are met for the beta: no
  transcript, an on-screen "not an emergency line" and a two-working-day reply
  promise, and the founder as the accountable reader. A staffed in-app workflow
  is still owed before public launch. Listen only sends nothing new to the token
  server or agent; `live_session_finished.voice` stays true because the tutor
  spoke.
- Sources: [risk register](docs/RISK_REGISTER.md),
  [live voice](docs/LIVE_VOICE.md), founder answers of 22 October 2026.

## VOICE-006 — The onboarding goal colours the tutor's free choices only

- Date: 2026-10-22
- Status: accepted
- Decision: the learner's onboarding goal (`LearnerGoal`: food, trip, family,
  moving, work, because) rides `LearnerProfile.memory.goal`, beside `name` and
  outside the remembered facts. `snapshotFor` sets it on every path, so it is
  sent when memory is paused and on the free tier. The brain turns it into one
  fixed `LEARNER GOAL:` line in the turn context (none for `because`), which
  tells the tutor to take examples and small talk that are its own choice from
  that part of life, and never to steer a scene away from its own goal. Core's
  `nextScene` orders the suggested next scene by goal; it never gates a scene
  or changes the level.
- Reason: it is an onboarding answer, like the name, not something the tutor
  learned in a session, and the first-practice brief already sends it to every
  learner. Reusing the name's seam costs no new token field.
- Consequence: `repairProfile` keeps only a known goal tag. The line is the
  same bytes for the same state, so it does not disturb the frozen prefix.
  The token server passes the snapshot through unchanged.
- Sources: `packages/brain/src/prompt/turnContext.ts` (`GOAL_FRAMING`),
  `apps/mobile/src/profile/memory.ts` (`snapshotFor`).
- Amendment (2026-10-22): the goal can be changed or cleared from Learning
  preferences through `withOnboardingGoal`. It is clocked as the
  `onboardingGoal` preference field, so a newer change or clear wins across
  devices instead of the answer merge's non-null-beats-null. The seeded
  `learnerGoals` line (`SEEDED_GOAL`) is deliberately left alone: it is the
  learner's own sentence, editable on Tutor memory.

## VOICE-007 — Lay a consented speech dataset's groundwork, inert until legal review

- Date: 2026-10-22
- Status: accepted (groundwork only; collection is not decided)
- Decision: build, switched off, the parts of a consented, teacher-rated dataset
  of English speakers saying known French lines. A clip qualifies only where
  VOICE-004 already scores: a spoken lesson turn where the learner said the
  reference line. It is offered where the score settles, so vendor scores travel
  with it. The tutor agent offers a clip to a `ClipSink` only when
  `LUVANI_SPEECH_DATASET=1` and `LuvaniTutor.datasetConsent` are both true. The
  default sink does nothing, and no production code sets the consent bit, a
  readonly constructor option: the token server does not sign it, `agent.ts`
  does not pass it, and a source-scan test fails if anything does. The app's consent is
  separate from usage data, versioned, literal-true only, device-local for now,
  and its Settings switch is hidden behind `SPEECH_DATASET_ENABLED = false`.
  Migration 42 (`speech_dataset_clips`, metadata only, service role only, no
  transcript column, expiry at most 24 months) is prepared and not applied. A
  local, offline tool (`npm run rate:speech`) lets teachers rate clips and
  reports agreement (weighted kappa) and calibration (Spearman against the
  vendor).
- Reason: the market review of 2026-10-22 named this dataset as the most credible
  moat, and Microsoft says Azure struggles with French nasal vowels and liaison.
  The privacy doc promises that live audio is never stored and treats any kept
  recording as an escalation before a branch. So the design and the safe parts
  are built now, and the promise stays true until a legal review changes it.
- Consequence: activation needs, in order: legal review and a DPIA; the policy
  and privacy-doc changes with their pinned tests (and naming the scorer the
  notice already gets wrong, Speechace against the TonePerfect default); rater
  DPAs; a server consent record; clip inserts the database itself refuses
  without a live consent; the signed consent bit; an uploader that converts to
  16 kHz; a private bucket; withdrawal, expiry and erasure sweeps that delete
  the object before the row; a rater-export record; export; the migration
  applied live; then both flags on. The full list is in the change doc. Withdrawal will delete clips, and the disclosure must
  say that aggregate calibration already made is not unpicked.
- Sources: [speech dataset change](docs/changes/speech-dataset.md),
  [privacy and safety](docs/PRIVACY_AND_SAFETY.md), VOICE-004 above.

## VOICE-008 — Price a live minute from measurement; drills on Luna; never pay twice for a line

- Date: 2026-10-23
- Status: accepted
- Decision:
  - `DEFAULT_COST_MODEL` is re-priced from rates and usage measured on
    22 and 23 October 2026 (`docs/cogs-evidence/`). STT is $0.009 a minute,
    LLM $0.006, TTS $0.109 per minute of tutor speech, and tutor speaking
    share 0.25. Scoring is unchanged.
  - Post-session drills move from gpt-5.6-terra to gpt-6-luna
    (`OPENAI_DRILLS_MODEL`). Memory extraction stays on terra.
  - Free-conversation lines replay from a per-session memory memo instead of
    a second synthesis.
  - Authored voice-cache entries no longer expire.
  - Each session prints one numbers-only `[luvani:cost]` line.
- Reason:
  - The market review compared about $0.058 a minute with Duolingo's under
    $0.01 a call. That figure was stale in both directions:
    - The LLM line priced a Claude talker, but live turns on gpt-6-luna
      cost $0.0003 each.
    - STT priced a batch rate.
  - Measured, today's configuration cost about $0.064 a mission minute.
  - The largest LLM item was the drills call, $0.086 a session on terra.
    On Luna it costs $0.005, and the drill eval was 25/25 clean against
    23/23 on terra (`analyst-samples.md`).
  - Production also re-synthesized every Hear tap and started every
    container with an empty voice cache.
- Measured, per mission minute:

  | Component | Before (model) | Measured before | After |
  |---|---|---|---|
  | STT | $0.0043 | $0.0090 | $0.0090 |
  | LLM | $0.025 | $0.0219 | $0.0057 |
  | TTS | $0.0225 | $0.0273 | $0.0273 |
  | Scoring | $0.006 | $0.006 | $0.006 |
  | Total | $0.0578 | $0.0642 | $0.0480 |

  - A lesson minute comes to about $0.012 to $0.014 once the voice cache is
    on a volume.
  - The replay memo's saving is not modelled until beta tap rates exist.
- Declined, with numbers:
  - **Routing simple beginner turns to a cheaper model.** gpt-6-luna is
    already the cheapest model priced in `pricing.ts`. Live turns are
    $0.0014 a minute, so even a free turn saves less than that. It would
    also need a new activity and paid-quote bindings, and would lose Luna's
    verbosity and effort settings.
  - **Smaller live prompts.** The cache hit rate is 0.92 to 0.96 (VOICE-005),
    and the uncached input is about 290 tokens a turn.
  - **Pausing STT while the tutor speaks.** It would break barge-in.
- Founder decisions still open:
  - **Flash v2.5 for conversation lines only**, while scripted lines stay
    on v2. It halves TTS to about $0.0136 a minute, and a mission minute
    would come to $0.034. The blind check is at
    `~/Developer/StartUps/listening/tts-blind-check-2026-10-22/`, with its
    key in `docs/cogs-evidence/tts-blind-check/`.
  - **The Railway volume for `TTS_CACHE_DIR`**
    (`docs/changes/beta-launch.md`). It is a launch blocker for this cost
    model: the 0.25 speaking share assumes lessons replay authored lines.
    Without the volume a lesson minute costs about $0.075.
  - **Re-binding the paid drills quote to gpt-6-luna** before deploying.
  - **A Deepgram plan.** The $0.0048 promo has no end date.
  - **Under $0.02 a mission minute.** Flash alone does not get there. It
    takes Flash plus the promo on a 1× voice (about $0.022 without scoring),
    or a different TTS vendor, which would give scripted and conversation
    lines two different voices.
- Consequence:
  - The margin floors in `meter.test.ts` are re-baselined. Those that only
    held because costs were high now carry the new values, and no
    protective floor was lowered. `moneyUntouched.test.ts` is re-pinned
    for `meter.ts`.
  - The 2x voices (emilie, sarah) cost a third more than the roster mean
    on TTS.
  - Real-call spend for this work was about $0.53
    (`docs/cogs-evidence/spend.md`).
- Sources: `docs/cogs-evidence/` (`before-after.md`, `rates.md`,
  `analyst-samples.md`), `scripts/measureSessionLlm.mjs`,
  `scripts/ttsBlindCheck.mjs`, `services/tutor-agent/src/ttsCache.ts`,
  `packages/core/src/metering/meter.ts`. Founder answer of 23 October 2026.

## VOICE-009 — Flash for conversation lines is a switch, off until the founder has listened

- Date: 2026-10-23
- Status: accepted (the switch). Turning it on is still open.
- Decision: `LUVANI_CONVERSATION_TTS_MODEL=eleven_flash_v2_5` sends
  free-conversation tutor lines to ElevenLabs Flash v2.5. These are the lines
  the brain writes, which are not authored. Every authored or scripted line
  stays on `eleven_multilingual_v2` and its disk cache whatever the setting.
  Flash uses the same voice, settings, format and streaming latency. Unset
  means off, which is today's behaviour. Any other value refuses to start.
  The fish vendor ignores the setting.
- Reason: the conversation reply is the only TTS a mission pays for on every
  turn. Measured on 23 October 2026 on alexandre, Flash costs half as much
  and starts sooner:
  - First audio, 18 requests each, streaming at latency setting 3: Flash p50
    126 ms (p90 131) against v2 p50 350 ms (p90 401).
  - Credits: 174 for Flash against 348 for v2
    (`docs/cogs-evidence/flash-latency-2026-10-23.json`).
  - At the VOICE-008 rates, a mission minute falls from $0.048 to about
    $0.034.
  - What a beginner hears is the founder's call, so the switch ships off.
- Consequence:
  - **Before turning it on:** the founder runs the blind check at
    `~/Developer/StartUps/listening/tts-blind-check-2026-10-22/` (key in
    `docs/cogs-evidence/tts-blind-check/`).
  - **Paid quote:** the paid TTS quote needs an `eleven_flash_v2_5` component,
    or conversation lines are refused as quote-mismatch
    (`deployment/PAID_ADMISSION.md`).
  - **Cost model:** `ttsPerMin` in `meter.ts` gets re-priced through the
    money process.
  - **Two models in one session:** scripted and conversation lines then come
    from two models of the same voice.
  - **Tracking:** with the switch on, `[luvani:cost]` adds
    `ttsCharsBilledConversation`, so the beta can price each tier.
- Sources: `services/tutor-agent/src/ttsCache.ts` (`route`),
  `services/tutor-agent/src/voice.ts` (`buildTTS`),
  `services/tutor-agent/src/voiceConfiguration.ts`, VOICE-008.

## VOICE-010 — Give beginners time to finish a sentence before their turn ends

- Date: 2026-10-23
- Status: accepted
- Decision:
  - **Rung-based pause floor.** Rungs 1-2 (A0-A1) get an endpointing
    `minDelay` of 1,200 ms; rungs 3-4 keep 400 ms. A session with no signed
    `startRung` is a beginner. `maxDelay` is pinned at 2,500 ms.
  - **The floor rises after a cut-off.** A cut-off is the learner starting to
    speak within 1,500 ms of a committed turn, before the tutor began its reply.
    Each one adds 400 ms for the rest of the session, capped at 2,000 ms.
  - **"Give me a moment" also holds the end of the turn** at 2,500 ms until the
    learner's turn completes or the grace ends. No new UI or protocol tag.
  - **The hold is capped.** Taps on one exchange can defer the rescue for at
    most `MOMENT_HOLD_CAP_MS` (60 s) from the first tap. A tap past the cap only
    restarts the ordinary window, like a keystroke. "Aide-moi" during a hold
    still rescues at once, and the first conversation rescue stays quiet.
  - **A sound that never became a turn re-arms the rescue** when it ends,
    instead of switching the clock off for good.
  - Policy lives in `services/tutor-agent/src/thinkingTime.ts`. `agent.ts`
    applies changes with `session.updateOptions({ turnHandling: { endpointing } })`
    only when the value changes.
- Reason:
  - Being cut off mid-thought is a top complaint about AI tutors.
  - The 400 ms floor did nothing: Silero's 550 ms end-of-speech silence
    shadows it, so turns ended about 470 ms after the audio stopped.
  - SDK 1.9 builds a local audio turn detector by default. On six French
    clips with a 1 s mid-sentence pause it held 4 of 6. Without its native
    binding or a job executor it holds none. Its scores sat near the 0.285
    threshold, so the floor has to work without it.
- Measured (`docs/live-latency-evidence/2026-10-23-pause-endpointing.md`):
  - 1.0 s pauses: cut off today in 2 of 6 (model) or 6 of 6 (no model);
    at 1,200 ms, 0 of 6 either way.
  - 1.5 s pauses survive only from the 2,000 ms floor, and 2.0 s pauses only
    under a moment hold.
- Latency cost, last voiced audio to commit (p50 on the same clips):
  - Rungs 1-2: +624 ms (466 to 1,090 ms) when the turn really has ended.
  - +1,024 ms after one cut-off; +1,424 ms at the 2,000 ms cap.
  - 2,390 ms during a moment hold, which the learner asked for.
  - Unchanged at 2,500 ms when the audio model holds the turn.
  - Rungs 3-4: unchanged.
  - A lesson may run preemptive generation once more per held pause; the
    framework caps that at three a turn.
- Deferred:
  - Tap-to-send (manual turn mode with an auto-send cap). Built as VOICE-019.
  - Merging a fragment that was already cut off with its continuation.
  - Field calibration with real beginners in the beta. The clips are one
    sentence in synthetic voices.
- Consequence:
  - Tests: `thinkingTime.test.ts`, `pauseEndpointingSdk.test.ts` (a real
    `AgentSession`: one turn at rung 1, two at 400 ms), the VOICE-010 blocks in
    `convo.test.ts` and `tutor.test.ts`, and `agentWiring.test.ts`.
  - Founder steps: deploy the tutor agent (no app change, no migration), and
    grep the Railway worker logs for `local-inference native binding` to learn
    whether the audio detector is live.
- Sources: `scripts/measurePauseEndpointing.mjs`, `docs/LIVE_VOICE.md` "When the
  learner's turn ends", `docs/PEDAGOGY.md` "The rescue". Founder answers of
  23 October 2026.

## UI-011 — Guest first scene: one scripted café exchange before sign-up

- Date: 2026-10-23
- Status: accepted (reverses UI-003 for this scene only)
- Decision: before an account exists, a learner may do one five-turn scripted
  café exchange (`GUEST_CAFE_SCENE`, five reviewed `cafe-01` turns), by voice
  or by typing. Production opens it only with `LUVANI_GUEST_SCENE=1` on the API
  and the tutor roles. The rules:
  - No language model. A missed answer gets the scripted rescue, and the room
    builds no LLM client and no scoring.
  - A server-fixed 180-second ceiling.
  - Memory locked.
  - One scene per installation per 30 days, the existing three guest starts per
    address per day, and a service-wide daily ceiling,
    `LUVANI_GUEST_SCENE_DAILY` (default 24), booked when the worker claims the
    room.
  - Voice runs through the paid voice proxy behind a guest scene gate. The gate
    admits only Deepgram STT, capped at 180 s in total, and ElevenLabs TTS of
    the scene's exact scripted lines in the signed voice. Every other effect is
    refused.
  - On sign-up, the server returns the scene turn ids the learner answered, and
    the phone writes those lines to the phrasebook. The server record then
    shrinks to the owner binding and expires after 48 hours.
  The guest conversation (`convo`) stays closed in production. UI-003's
  account handoff is still what a learner sees when scenes are off, the day's
  places are spent, or this phone already had its scene.
- Reason: the market report (section 7, "Now") asks for the first French reply
  before account creation. UI-003 closed guest live for these reasons:
  - there was no guest principal in the paid ledger;
  - an LLM conversation of 5 to 20 minutes cost up to about $1 a guest, with no
    quote;
  - the only device signal is a forgeable installation id;
  - pre-account audio was not yet disclosed.
  A scripted scene removes the model and its cost, and the proxy gate bounds
  what the worker can spend. The daily ceiling, not the device claim, is the
  money limit. Read-only reviews by security-engineer and
  database-security-architect (2026-10-23) agreed with the shape and set the
  must-fix list that the change plan carries.
- Consequence:
  - The installation claim is a courtesy limit. A reinstall, cleared app data
    or a script gets past it. DeviceCheck or Play Integrity waits for the store
    accounts.
  - Worst case is about $0.50 a scene (a cold voice cache on all 48 allowed
    TTS calls in a voice that bills twice), so the default ceiling costs at
    most about $12 a day. With the voice cache warm, a scene costs about $0.03.
    It sits outside SQL paid admission, like guest speech (D13), and must be
    added to the launch exposure.
  - The `tokens.ts` money pin was re-pinned on 2026-10-23 for the scene
    signing. No allowance, debit, price or trial logic changed.
  - No Supabase migration.
  - The privacy notice names the pre-account processing.
- Sources: [change plan](docs/changes/guest-first-scene.md),
  [onboarding](docs/ONBOARDING.md),
  [runbook](docs/BACKEND_RELEASE_RUNBOOK.md#guest-first-scene-ui-011-23-october), founder approval
  of 23 October 2026.

## VOICE-011 — Quiet voice, not whisper: a soft voice is heard, a whisper is not

- Date: 2026-10-23
- Status: accepted
- Decision:
  - **The mode is "Quiet voice".** It is a switch in the live room, beside "Show
    transcript", shown while the learner is speaking to the tutor. It is the
    room's counterpart to Listen only (UI-010), which is chosen before the start.
  - **It is client-only.** Nothing new goes to the token server or the agent.
    Deepgram, Silero and the VOICE-010 floors stay at today's settings.
  - **While it is on:**
    - the transcript opens, so the tutor's line can be read;
    - the mic meter floor drops from 0.01 to 0.005 RMS (span 0.06), so a soft
      voice still moves the orb, and only a voice the tutor can still receive;
    - one note says "Speak softly, close to your phone. {Tutor} can hear a soft
      voice, but not a whisper."
  - **It persists on the device** (`@luvani/quiet-voice/v1`), off by default,
    because being on a train is about where the phone is, not the account.
  - **No change to the tutor's voice.** There is no proven slow-synthesis path,
    and the phone's volume buttons (or earphones) already make it quieter. A
    second in-app volume would make "I can't hear the tutor" harder to fix.
- Reason: learners in public cannot speak aloud (PRODUCT.md), and Listen only
  takes their voice away entirely. The report asked for whisper; the
  measurement says a soft voice works and a whisper does not, so the product
  says that.
- Measured (`docs/live-latency-evidence/2026-10-23-quiet-speech.md`, script
  `scripts/measureQuietSpeech.mjs`). The clips were six v2 and 18 v3 ElevenLabs
  French clips, plus 18 v3 clips tagged `[whispers]`, at 0, -10, -20 and -30 dB,
  clean and over a -50 dBFS pink-noise bed. They ran through the real Deepgram
  plugin stream (nova-3, fr) and Silero.
  - **Soft speech at -20 dB** (speech around -36 dBFS) passes: median word
    accuracy 1.00, worst 0.75 clean and 0.67 over noise. Silero fires on every
    clip at the default 0.5, every turn commits at the 1,200 ms floor, and
    there are no false starts on noise alone at any threshold.
  - **Whispers fail.**
    - Real whispers (the three tagged clips that lost their pitch) transcribe
      perfectly at 0 and -10 dB, but score 0.00 at -20 dB clean.
    - Over noise, Silero catches none of them at 0.5 and 0.35, and 2 of 3 at
      0.25.
    - The LiveKit Deepgram plugin runs every frame through `AudioEnergyFilter`
      (`@livekit/agents` 1.9), which drops audio under RMS 0.004 (about
      -48 dBFS) after a second of quiet. A whisper at a realistic distance sits
      below that, and Deepgram never receives it.
  - **Soft speech at -30 dB** (about -46 to -48 dBFS) starts to fail (worst clip
    0.00), which is why the note asks for the phone to be close.
- Caveats:
  - Every clip is synthetic, and the gain is digital attenuation, not a person
    speaking softly into a phone with iOS voice processing and AGC.
  - Only 3 of the 18 `[whispers]` clips actually lost their pitch.
  - Founder recordings dropped into `artifacts/quiet-speech-2026-10-23/real/`
    are the next check. A device test in the beta is the one after that.
- Deferred (needs founder approval, because it changes vendor plugin
  behaviour): true whisper. This would mean boosting the learner's audio before
  the energy filter, or bypassing the filter, plus a lower VAD threshold. The
  measurement suggests even that would miss whispers over train noise.
- Consequence:
  - Tests: `scripts/measureQuietSpeech.test.mjs` (helpers, in the gate's shared
    proofs), plus the mobile preference, meter and room tests.
  - Founder steps: none to deploy beyond the app build. There is no agent
    change and no migration.
- Sources: [live voice](docs/LIVE_VOICE.md) "Speaking quietly", market report
  section 7 "Next".

## REV-001 — A free conversation every other day; Core and Max repriced

- Date: 2026-10-23
- Status: accepted (supersedes D24's weekly window and D16's prices; D24 is in
  [docs/come-alive/README.md](docs/come-alive/README.md))
- Decision: the founder chose, after seeing the costs below:

  | Plan | Was | Now |
  |---|---|---|
  | Free (`trial`) | 300 s, refilled 7 days after first use | 600 s, refilled 44 hours after the window's first debit. Shown as "one free conversation every other day". |
  | Core (`starter`) | $19/mo, $149/yr, 180 min per 30 days | $14.99/mo, $99/yr, 300 min per 30 days ("about 10 minutes a day") |
  | Max (`regular`) | $29/mo, $229/yr, 300 min per 30 days | $24.99/mo, $169/yr, 600 min per 30 days ("up to 20 minutes a day", never "unlimited") |

  The shape is the smallest that does this. The free plan keeps D24's rolling
  window and device claim, and paid plans stay monthly pools. Only these change:
  - the free cap;
  - the free window;
  - two paid caps;
  - the prices in the margin model.

  The `weekly_taste` column keeps its name. Store trials follow the allowance
  (Core 70 min, Max 140 min). Migration 43
  (`20261023220000_daily_free_allowance.sql`) carries the SQL side. It requires
  40 and 41, and never 42.
- Reason: the market report (section 7) says five minutes a week is too little
  to build a habit, and recommends a more frequent free allowance and a cheaper
  Core and Max. These are per free user per month, at full use and at 40%, at
  the measured mission rate ($0.048 a minute, VOICE-008):
  - 3 min a day: $4.34 / $1.74.
  - 5 min a day: $7.24 / $2.90. It cuts every free mission in half, because
    missions run 9 to 11 minutes.
  - 10 min every 2 days: $7.24 / $2.90, chosen. The worst case at 44 hours is
    16.4 windows a month, about $7.89.
  - 10 min a day: $14.47 / $5.79. That is as many minutes as the new Core.

  Two options were ruled out:
  - A lesson-only allowance, because only one lesson is authored.
  - A separate mission counter, because it saves nothing.

  With Flash (VOICE-009) the chosen tier costs $5.10 / $2.04.
- Consequence:
  - Margins after the 15% store fee, at 40% use and at full use:
    - Core monthly: 55% / -14%.
    - Core yearly: 17% at 40%.
    - Max monthly: 45% / -36%.
    - Max yearly: about 3% at 40%.

    Full-use paid learners lose money until the cost of a minute falls. That is
    the same bet D16 accepted for yearly Max. `meter.test.ts` pins every figure.
  - At the standard 30% store fee, the figures are:
    - Core monthly: 44.8% at 40% use, -37.9% at full use.
    - Max monthly: 33.8% at 40% use, -65.5% at full use.
    - Core yearly: -0.3% at 40% use.
    - Max yearly: -17.5% at 40% use.

    Small Business enrolment with Apple and Google is therefore load-bearing.
    It is not a nicety.
  - A beta of 100 free testers costs about $724 to $789 a month at full use and
    $290 at 40%.
  - Prices live in App Store Connect, Play and RevenueCat. The founder sets
    them; the code holds them only for the margin model.
  - The 45-minute weekly Core product is unchanged, and is a follow-up.
- Sources: [market report](https://claude.ai/artifact/1TLMTEHTGdToCv8WDCqVAe)
  section 7, [beta launch](docs/changes/beta-launch.md), founder answers of 23
  October 2026.

## VOICE-012 — Curation on GPT-6 Luna, on its own setting

- Date: 2026-10-24
- Status: accepted
- Decision:
  - The brain's `curate` activity moves from gpt-5.6-luna to gpt-6-luna.
  - It has its own knob, `OPENAI_CURATION_MODEL` (config `curationModel`,
    default `DEFAULT_OPENAI_CURATION_MODEL`), exactly as drills have
    `OPENAI_DRILLS_MODEL` (VOICE-008).
  - `OPENAI_TURN_MODEL` no longer moves curation. It still moves the own-words
    judge, and still moves live turns when `OPENAI_LIVE_MODEL` is unset. Judge
    stays on gpt-5.6-luna and memory extraction on gpt-5.6-terra.
  - Curation keeps its routed reasoning effort (medium, 3,000 output tokens).
    `openAiEffortFor` only drops effort for turn and frame on gpt-6-luna.
  - Tutor preflight now names the curation model and refuses to start if the
    key cannot list it.
- Reason: the model gap between live turns (gpt-6-luna) and curation
  (gpt-5.6-luna) was written up in `docs/changes/vendor-comparison.md` and
  waited for the founder. gpt-6-luna is priced at $0.10 in and $0.50 out per
  million tokens against $0.20 and $1.20. Moving curation alone through
  `OPENAI_TURN_MODEL` would also have moved the judge and live turns, so it
  needed its own setting.
- Measured, `npm run eval:curation` (F193), two runs on gpt-6-luna and one
  same-day baseline on gpt-5.6-luna (`OPENAI_CURATION_MODEL=gpt-5.6-luna`), two
  fixtures each:

  | Run | Café: kept (worth reaching for), separation | Weekend: kept (worth reaching for), separation | Printed cost |
  |---|---|---|---|
  | gpt-6-luna, run 1 | 4 (4/5), 1.13 | 5 (5/5), 1.29 | about $0.001 |
  | gpt-6-luna, run 2 | 5 (5/5), 1.29 | 5 (5/5), 1.29 | about $0.001 |
  | gpt-5.6-luna, same day | 5 (5/5), 1.29 | 5 (5/5), 1.29 | about $0.003 |

  - The earlier recorded gpt-5.6-luna run (23 October) cost about $0.002.
  - The weekend fixture kept 5 of 5 on every run. The café fixture kept 4 once
    (run 1 left out "sur place, s'il vous plaît", a phrase worth reaching for,
    and did not replace it) and 5 on the rerun. Neither model's runs had a
    failing extension.
  - Run 1 is the one that triggered the stop rule (fewer than 5 of 5 per
    fixture). It was rerun once on gpt-6-luna, and once on gpt-5.6-luna for the
    baseline, to tell noise from a real drop.
  - This is a small sample: two gpt-6-luna runs and one gpt-5.6-luna run on
    two fixtures. It shows no systematic loss. It cannot show that the single
    miss will not recur, so treat it as a one-off, not as a measured rate. The
    run output printed no token counts, only the cost.
- Consequence:
  - Setting `OPENAI_CURATION_MODEL=gpt-5.6-luna` restores the old behaviour
    with no code change.
  - If curation quality is doubted later, re-run `npm run eval:curation`. The
    eval prices and labels the run from `openAiModelFor('curate')`, so it
    follows the setting.
  - Curation is not part of the paid practice quote (drills are), so no quote
    needs re-binding.
- Sources: [vendor comparison](docs/changes/vendor-comparison.md), VOICE-008
  above, F193 in [known issues](docs/KNOWN_ISSUES.md).

## VOICE-013 — A stuck beginner hears an English way back, on the second rescue

- Date: 2026-10-25
- Status: accepted
- Decision:
  - The ladder, the free-conversation depth table and the quiet first rescue
    are unchanged.
  - On the first rescue that reaches assistance depth 2 on an exchange (the
    second rescue, the one that already reveals the French line and asks the
    tutor to step in), the app speaks one authored English sentence before the
    tutor's own rephrased French. Conditions, all required: CEFR estimate A0 or
    A1, rung 1 or 2, and the learner has not already reached for English on
    this exchange. A third rescue does not repeat it.
  - The lines (`WAY_BACK_LINES`, rotating per exchange within a session):
    "You can say it in English. I'll give you the French." / "English is fine
    too. Say it your way, and I'll help with the French." / "Try it in English
    if you like. We'll find the French together."
  - Code decides (`wayBackDue` in `packages/brain/src/engine/conversation.ts`).
    The line becomes the turn's coach line, so a typed session reads what a
    voice session hears, and `spokenTurn` speaks it in the one English slot.
    The turn context tells the model the English is already said and to add
    none of its own. The flag never goes on the wire.
- Reason: learners across the market say AI tutors "break down for beginners":
  nobody lets them mix in English when stuck. The prompt already accepted and
  recast English replies, but a frozen A0 learner was never told so. VOICE-002
  still holds: the card's French is never read back.
- Consequence: a learner who then answers in English goes down the existing
  English-to-French recast path. The lines are in the TTS warm list. The
  session eval's `way-back` check scores it.
- Sources: [PEDAGOGY](docs/PEDAGOGY.md) "The rescue", [LIVE_VOICE](docs/LIVE_VOICE.md).

## VOICE-014 — Fresh openers on a session count, and no question asked twice

- Date: 2026-10-25
- Status: accepted
- Decision:
  - The opening question is one of five authored lines and the silence
    suggestion one of three (`CONVO_LINES` in
    `services/tutor-agent/src/authoredSpeech.ts`). Index 0 of each is the line
    every session used before.
  - The index is `profile.stats.sessions`, which gives strict rotation, so
    consecutive sessions never share an opener. A count of zero (a first
    session, or a profile that never arrived) falls back to an FNV-1a hash of
    the signed session id; an unsigned session gets index 0.
  - Each turn context lists the tutor's own questions so far this session, the
    last six as said, and tells the model not to ask any again in any wording
    (`askedQuestions`). The persona says the same once.
  - After each turn, `repeatsQuestion` checks the reply against that list. A
    hit logs `[luvani:conduct] repeated-question` with no learner or question
    text. There is no regeneration.
- Reason: "the same questions for weeks" is a top complaint about a
  competitor's tutor. A free learner heard one English opener every session.
- Why a session count is not memory: the `memoryLocked` promise is no saved
  memory brief, no remembered opener and no extraction. A count carries
  nothing the learner said, is already on every profile (`finishSession`), and
  is used here only to pick an authored line. The question guard reads the
  current session's history and stores nothing. No list of past questions is
  kept for anyone.
- Consequence: across sessions, repeats are covered by the strict rotation of
  authored lines, the existing per-session mission decks and the scene
  builder's recent-scene list. A model-written question from a previous
  session can still recur; nothing stores it, by design. A regenerated turn
  would cost the learner latency, so the log and the eval's
  `no-repeat-question` check are how repeats are seen.
- Sources: [LIVE_VOICE](docs/LIVE_VOICE.md), [PRIVACY_AND_SAFETY](docs/PRIVACY_AND_SAFETY.md).

## VOICE-015 — Sad news stays kind and in the scene; self-harm unchanged

- Date: 2026-10-25
- Status: accepted
- Decision:
  - `SAFETY_CONDUCT` gains WHEN THEY SHARE SAD NEWS: answer as yourself in one
    or two short kind sentences (plain English at A0 and A1), say sorry, do not
    probe or advise, offer the choice to take a moment or keep going, never end
    the conversation or say goodbye, and go back into the scene gently or
    follow them in simple French. The danger section says sad news on its own
    is not a crisis, and the crisis section still comes first.
  - The contract says `sceneDone` is never true on a sad-news turn, and code
    enforces it: a learner line matching `sharesSadNews`
    (`packages/brain/src/engine/sadNews.ts`) adds a SAD NEWS line to that
    turn's context, and `integrateTurn` lets neither `sceneDone` nor every beat
    done end the session on that turn. The turn ceiling stretches by at most
    one turn.
  - `sharesSadNews` is not a safety category. It never stops, redirects or
    logs learner text.
  - The input net is unchanged. Sixteen bereavement, illness and sad-news lines
    join the ORDINARY corpus in `safety.test.ts`, and a new test proves grief
    that also says the learner wants to die still stops as self-harm.
- Reason: a competitor's tutor hung up on a user who said their parents had
  died. Here, sad news passed the net untested, the crisis section told the
  model to drop the scene for anything "real and bad", and a model's
  `sceneDone` would have called `finish()`.
- Consequence: a false positive (a film plot) costs one context sentence and
  one deferred recap. Known and left alone: "my brother committed suicide"
  stops under `/suicid/`, which is deliberately broad; a kinder path for
  bereavement by suicide is a founder decision. The session eval's `grief`
  check scores the conduct.
- Sources: [PRIVACY_AND_SAFETY](docs/PRIVACY_AND_SAFETY.md), [LIVE_VOICE](docs/LIVE_VOICE.md).

## VOICE-016 — Beginners hear a slower voice, chosen once per session

- Date: 2026-10-25
- Status: accepted (founder chose "beginner default plus a switch" in the plan)
- Decision:
  - The live tutor voice speaks at ElevenLabs `speed` 0.85 (`BEGINNER_SPEED`
    in `voiceConfiguration.ts`) for scripted lessons, guest scenes and
    conversations while the profile estimate is A0 or A1 (or absent). From A2
    up it speaks at the vendor's normal speed.
  - A "Slower voice" switch in Learning preferences overrides that either way.
    It is stored on the device (`@luvani/voice-speed/v1`), sent as
    `voiceSpeed: 'slower' | 'normal'` on session start only when chosen,
    validated and signed by the token server, and read by the agent.
  - `tutorSpeedFor` decides the speed once at session start. It never changes
    mid-session, because it is part of the voice cache key. The scene's
    "Simpler" control still changes sentences only.
  - `VOICE_SETTINGS` stays as it was. The bundled daily and onboarding clips,
    the build scripts' manifest checks and saved-phrase Hear (whose database
    rates are keyed by that fingerprint) are untouched; Hear plays at normal
    speed.
  - Each speed is its own authored-line cache: `buildTTS({ speed })` folds the
    speed into `voiceKey` (`speed=85`). Normal speed keeps today's keys byte
    for byte. `LUVANI_WARM_SPEED=normal|slower|both` warms either copy.
  - Speed is not part of a paid quote component's identity: `describePaidHttp`
    removes `voice_settings.speed` from the hashed configuration when it is a
    finite number from 0.7 to 1.2 and refuses anything else. Existing quotes
    keep matching, so no SQL step is needed.
  - `[luvani:cost]` carries `ttsSpeed`.
- Reason: learners in the founder's market report ask for speech-speed
  control, and the "Simpler" pace only ever shortened sentences. Measured on
  25 October 2026 on alexandre, two lines (`scripts/measureVoiceSpeed.mjs`,
  `docs/cogs-evidence/voice-speed-2026-10-25.json`, about 200 credits):

  | Condition | Characters a second | Pace against 1.0 | Credits per character | Deepgram word accuracy (median) |
  |---|---|---|---|---|
  | v2 at 1.0 | 20.3 | 1.00 | 0.397 | 0.94 |
  | v2 at 0.9 | 19.3 | 0.95 | 0.397 | 1.00 |
  | v2 at 0.85 | 16.9 | 0.83 | 0.397 | 1.00 |
  | Flash v2.5 at 0.9 | 18.1 | 0.81 | 0.199 | 1.00 |

  - 0.9 is barely slower than 1.0. 0.85 is about 17% slower and Deepgram
    still recognised every word, so the French is not distorted to a
    recogniser. Whether it sounds natural is a listening call: clips are in
    `~/Developer/StartUps/listening/voice-speed-2026-10-25/`.
  - Billed credits were identical at every speed (the `character-cost`
    header), so speed is price-neutral.
  - Flash's pace at 0.9 was inconsistent between the two lines (22.3 and 13.9
    characters a second). It matters only if the VOICE-009 switch is turned
    on; listen to it before then.
  - Two lines on one voice is a small sample, and takes vary at stability 0.4.
- Consequence:
  - **Cost per minute:** unchanged or lower. TTS bills characters, and the
    same scene at 0.85 bills the same characters. Slower lines fill more of
    each minute, so per wall-clock minute the cost can only fall. A mission
    minute stays at about $0.048 at most ($0.034 with Flash), a warm lesson
    minute at about $0.012 to $0.014. `DEFAULT_COST_MODEL` is unchanged.
  - **Cache:** the slower copy of the authored lines is a second cold cache.
    Warming it costs 23,600 billed characters across the six voices (two bill
    2x), about $1.89 once; without a warm it fills lazily for the same total.
    `docs/changes/beta-launch.md` step 4 has the founder's warm command.
  - **Rejected:** authored lines at one speed only, which would mix slow and
    normal lines in one scene; a per-speed quote component, which would
    exceed the sixteen-component quote limit.
  - **Known gap:** with no choice, the switch shows the conversation default.
    An A2 learner who never touches it sees it off, yet a scripted lesson still
    plays slower, because lesson content is A0.
  - Hear at the slower speed needs new `phrase_audio_rates` rows; not done.
- Sources: `services/tutor-agent/src/voiceConfiguration.ts`
  (`BEGINNER_SPEED`, `tutorSpeedFor`), `voice.ts` (`buildTTS`),
  `services/shared/paidExecution.ts`, `apps/mobile/src/tutor/voiceSpeed.ts`,
  VOICE-008, VOICE-009.

## VOICE-017 — Scripted lessons give Deepgram their lines as keyterms, once

- Date: 2026-10-25
- Status: accepted. Production needs a keyterm STT quote component to turn it
  on; without one nothing changes.
- Decision:
  - Lessons and guest scenes build their Nova-3 recognizer with one fixed
    keyterm list, `lessonKeyterms(lesson)` (core): every turn's target first
    (a trailing `?` removed, since `recognitionPhrases` drops question lines),
    then short forms, then acceptable options, deduplicated, at most 16
    phrases and 400 bytes. The café lesson keeps all 12 targets. `accepts` is
    left out because it is lowercase and unaccented.
  - The list is set once, at construction, with and without the paid proxy.
    Per-turn updates are deliberately avoided: every keyterm change reopens
    the Deepgram socket, and under the proxy each socket is admitted as a full
    session of audio.
  - Conversations are unchanged: per-turn keyterms off the proxy, none under
    it. Production mission keyterms are a follow-up that needs reconnect
    pricing first.
  - The paid proxy accepts repeated `keyterm` parameters only with nova-3,
    within those caps and with no control characters or `;`, and forwards the
    re-encoded query it hashed. The values are input, not configuration: the
    descriptor carries the marker `keyterm: 'prompted'` instead, because
    Keyterm Prompting is a per-minute add-on ($0.0013 a minute on Pay As You
    Go, Deepgram pricing page, 25 October 2026).
  - If the bound quote has no keyterm component the gate refuses with
    `quote-mismatch` before any claim; the proxy then admits the plain
    descriptor and forwards the URL with no keyterms, which is today's
    behaviour. `PaidGate` documents that a gate may throw `quote-mismatch`
    only before any spend. The tutor logs `[luvani] keyterms: prompted` or
    `stripped`, never the values.
- Reason: the market report names recognising accented beginner speech as
  the riskiest technical piece and says to constrain recognition to the
  expected lines on scripted turns.
- Measured, `scripts/measureKeyterms.mjs`
  (`docs/live-latency-evidence/keyterms-2026-10-25.json`, 104 ElevenLabs
  credits and about 141 s of Deepgram audio): the 12 café targets read by an
  English ElevenLabs voice (Chris), at normal level and at -20 dB, with and
  without the keyterms. Every condition scored median word accuracy 1.00 and
  11 of 12 exact. The miss is a clip in which the voice repeated "beaucoup";
  at -20 dB the keyterms turned "Merci beau." into "Merci beaucoup." This is
  inconclusive, not a null result: the synthetic voice speaks near-native
  French, so plain recognition was already at the ceiling. It does show that
  the keyterms made no transcript worse. Real beginner recordings are needed
  to measure the gain.
- Consequence:
  - **Founder step (optional):** seed NEW `lesson` quotes with a keyterm STT
    component (hash from `keytermSttConfigurationSha256`, priced at Nova-3
    plus the add-on) and re-bind. `deployment/PAID_ADMISSION.md` has the
    detail. `sttPerMin: 0.009` in the cost model already includes the add-on.
  - The guest scene gate does not hash configuration, so guest scenes send
    keyterms now; the runbook's $0.027 per scene already prices the add-on.
  - The security review (read-only, 25 October) found nothing blocking; its
    two hardening points (re-encoded forwarding, the gate invariant) and test
    gaps were applied.
  - The 16-keyterm, 400-byte cap is Luvani's own, not checked against
    Deepgram's documented limits.
- Sources: `packages/core/src/lessons/keyterms.ts`,
  `services/tutor-agent/src/agent.ts`, `paidVoiceProxy.ts`,
  `services/shared/paidExecution.ts`, `docs/LIVE_VOICE.md`, VOICE-008.

## VOICE-018 — A heads-up a minute before the cap, then a warm close

- Date: 2026-10-25
- Status: accepted
- Decision:
  - About 60 s before a session's cap (`HEADS_UP_LEAD_MS`), at the first gap,
    the tutor says "We're nearly out of time. Let's finish this one together."
    and the worker sends a payload-free `wrap-up` frame. The room shows "Nearly
    time to finish. {Tutor} will wrap up after this."
  - No number, anywhere. The pill stays "About N min" and the room never shows
    minutes left: UI-008's "no left, no clock" is kept (founder, 2026-10-25).
    The `wrap-up` frame has no field to carry one, and the app rebuilds it from
    its tag alone.
  - After one more learner turn and the tutor's spoken reply, the tutor says
    "That's all for today. Thank you, à bientôt !" and the session ends through
    the tutor-owned close, a little before the cap instead of on it.
  - Backstop: at the cap minus 15 s (`CLOSE_BY_MARGIN_MS`), a silent learner
    with no turn held is closed at once. A learner still speaking meets the
    existing hard stop. The server-signed cap is never extended. The close
    line's playout wait is bounded at 6 s, the legacy timer's "time limit"
    notice stands down once the close begins, and safety still screens every
    turn while the session closes.
  - Kill switch: `LUVANI_SESSION_HEADS_UP=0` on the tutor role.
  - Skipped when a session starts with under 90 s left, and for guest scenes,
    which keep their own ceiling. Typed sessions get the frame and the note.
  - Policy in `services/tutor-agent/src/sessionEnd.ts`; the tutors expose
    `wrapUp()`, `closeForTime()` and `sessionEndView()`.
- Review: `voice-reliability-architect` (read-only, 2026-10-25) found six
  issues across VOICE-018 and VOICE-019; all are fixed with tests.
- Reason: "calls end on a hidden timer" is a top complaint about Duolingo's
  video calls in the founder's market report. Free sessions are now 10 minutes
  (REV-001), so more learners meet the cap.
- Consequence:
  - Metering unchanged; an early close bills fewer seconds.
  - Both lines are in `AUTHORED_SPEECH_LINES`. Until `npm run warm-cache` is run
    (paid), the first use of each line in each voice is synthesised live.
  - Tests: `sessionEnd.test.ts`, the session-end blocks in `convo.test.ts` and
    `tutor.test.ts`, `agentWiring.test.ts`, `ttsCache.test.ts`, the `wrap-up`
    cases in `protocol.test.ts`, and `liveRoomView.test.ts` (the note has no
    digit, no "left", no "min"; the pill test is unchanged).
  - Founder steps: deploy the tutor agent and the app together (no migration),
    run `warm-cache`, and hear a session reach its cap once on a device.
- Sources: founder answers of 25 October 2026, `docs/LIVE_VOICE.md` "Nearly time
  to finish", UI-008 above.

## VOICE-019 — Tap to send: the turn ends when the learner says so

- Date: 2026-10-25
- Status: accepted
- Decision:
  - An optional mode, off by default, offered in Settings (Practice) and from
    the live room's "Tap to send" switch, stored on the device
    (`@luvani/tap-to-send/v1`). Speak only; never in a guest scene.
  - The microphone stays open. With it on, the worker switches the session to
    the SDK's manual turn detection, and the turn ends only on Send
    (`session.commitUserTurn()`) or at the 60 s cap (`TAP_SEND_CAP_MS`), with a
    "Sending what you've said in a moment." note at 50 s.
  - No rescue while a turn is held; before the learner speaks, the stuck clock
    runs as usual. The cap bounds the dark time.
  - Switching off, or going to Type, sends what was said and restores turn
    detection to `null` (or a saved string mode). Restoring the saved detector
    object silently disables VAD end-of-speech in `@livekit/agents` 1.9.
  - Wire: client `tap-to-send` and `send`, server `held-turn`
    (`open`, `closing`, `sent`). The worker handles them, not the tutors, and
    applies the switch only once `session.start()` has resolved: switching to
    manual before the activity exists builds the session without its audio turn
    detector, for good.
  - A Send or cap that lands while the tutor speaks waits until it stops: the
    SDK drops a commit over uninterruptible speech. The heads-up never plays
    into a held turn. An empty commit re-arms the rescue.
  - Kill switch: `LUVANI_TAP_TO_SEND=0` on the tutor role.
- Reason: VOICE-010's floors still end a turn after 2.5 s at most, so slow
  speakers and people who stutter can be cut off. The market report says users
  want a mode that waits until they say they are done; Duolingo's push-to-talk
  was praised for it. Founder chose "talk freely, tap Send" over
  walkie-talkie, and a 60 s cap (2026-10-25).
- Tradeoffs:
  - Barge-in by voice is off while it is on; words said over the tutor wait for
    the held turn.
  - A lesson's preemptive generation does not run during a held turn (0 model
    calls in the SDK test), so a held turn costs no model calls.
  - A turn costs one tap. That is the point for those who choose it, and why it
    stays off by default.
- Consequence:
  - Tests: `tapToSend.test.ts` and `tapToSendSdk.test.ts` (a real
    `AgentSession`: a 3 s pause does not commit, Send does, and after switching
    off a pause commits again), `agentWiring.test.ts`, `runtimeInput.test.ts`,
    `protocol.test.ts` (and the SDK test also turns it on before
    `session.start` and checks the detector survives), and in the app
    `tapToSend.test.ts`,
    `liveRoomView.test.ts` and `useLiveSession.test.ts`.
  - Founder steps: deploy agent and app together; try it on a device with a
    long pause and with a 60 s ramble.
- Sources: founder answers of 25 October 2026, VOICE-010 "Deferred",
  `docs/LIVE_VOICE.md` "Tap to send".

## LEARN-001 — Help earns no independent use

- Date: 2026-10-26
- Status: accepted
- Decision: a phrase the model credits as `usedWell` on an exchange where the
  app had revealed the hint or the full line (`assistanceDepth > 0`, read before
  the turn is integrated) raises `timesAssisted`, not `timesUsedWell`. Only
  `timesUsedWell` feeds `convoUses` and the `mastered` projection.
- Reason: the master learning-loop brief asks to tell independent recall from
  assisted performance. Counting help as natural production let the "used" state
  and mastery be earned on lines the learner was shown.
- Consequence: "Phrases used in conversation" grows more slowly for learners who
  lean on help, which is the honest number. Existing counts are never lowered.
  `repairProfile` fills `timesAssisted: 0`; merges take the max. F871.

## LEARN-002 — A weakness is a pattern across sessions, not one slip

- Date: 2026-10-26
- Status: accepted
- Decision: error patterns carry `sessions` (distinct sessions seen) and
  `lastSession` (the `stats.sessions` ordinal). `patternStatus` projects
  `suspected` (one session) or `recurring` (`RECURRING_SESSIONS = 2` or more).
  `watchFor` takes recurring patterns first and fills from suspected ones, so a
  learner with nothing recurring keeps the old top three by count.
- Reason: one bad session is not a weakness; the tutor should press on what keeps
  coming back. Uncertain evidence stays labelled as uncertain.
- Consequence: repaired legacy patterns read `sessions: 1`, never invented
  recurrence. A cross-device merge takes the max, which can undercount, never
  overcount. `lastSession` is what a later "getting better at" view needs. F872.

## LEARN-003 — Right only after a miss comes back tomorrow, at the same stage

- Date: 2026-10-26
- Status: accepted
- Decision: a drill phrase answered right only after a miss in the sitting is
  reported `assisted`. `applyGrade('good', { assisted: true })` sets the next
  review to tomorrow, keeps ease and reps, and earns no evidence. A transfer
  exercise right only after a miss records no transfer. First-try `good`,
  `easy` and `again` are unchanged.
- Reason: a correct answer obtained with help should be followed by a chance at
  unaided recall, and should not move the learner up the drill ramp.
- Consequence: drills reach the scheduler on three paths (core
  `applyDrillResults`, the drill screen, the practice sitting's planned write);
  all three carry the flag. F873.

## LEARN-004 — A practice job completes only when generated drills arrive

- Date: 2026-10-26
- Status: accepted (migration prepared, not applied)
- Decision: `20261026090000_practice_completion_signal.sql` redefines
  `receive_conversation_practice` and `finish_conversation_practice`. Built-in
  translate exercises (the only `translate` kind; the generator cannot emit it)
  no longer count as completion. Finishing stores the worker's drills first,
  then the stored built-ins, de-duplicated by id, at most 24.
- Reason: every pack carries built-ins, so a session whose AI drills failed read
  as complete and was never retried, and finishing dropped the built-ins.
- Consequence: failed drills now retry under the existing lease, backoff and
  five-attempt cap: a few more bounded worker calls only for sessions that
  failed. Apply after 43 in `supabase/README.md` order; it changes no data and
  has a paired rollback. Packs already marked complete are not re-queued. Proof:
  `npm run verify:database:practice` (in the gate). F874.

## LEARN-005 — The session brief says what to ask of each phrase, and code decides it

- Date: 2026-10-26
- Status: accepted
- Decision: each review-focus item (at most three, still untrusted JSON) carries
  `ask: 'unaided' | 'new-situation'`, set in code from the phrase's evidence
  state: `used` asks for a new situation, `introduced` or `recalled` for an
  unaided go, and `transferred` items are left out. Phrases only ever said with
  help (`timesAssisted > 0`, `timesUsedWell == 0`) rank first, then a continued
  conversation's own phrases, then lapses, then due date. The scene frame aims
  at the same phrases first (`frameTargets`). An older app's item without `ask`
  reads as unaided.
- Reason: help followed by independent recall, success followed by a changed
  situation, without letting the model decide the policy.
- Consequence: the brief grows about 265 bytes with a full focus. The data stays
  pedagogy-only on the join token and never moves minutes. F879, F880.

## LEARN-006 — Wins earn a transfer exercise

- Date: 2026-10-26
- Status: accepted
- Decision: the post-session drill request asks for exactly one transfer-marked,
  changed-situation exercise for up to two of the session's wins
  (`MAX_TRANSFER_PHRASES`), never a corrected phrase, on the tutor and the worker
  path alike. Their keys join the grounded set.
- Reason: consistent success should lead to a harder task, and a right first
  answer to it is the transfer evidence `evidence.ts` already counts.
- Consequence: at most two more generated exercises per session, inside the cap
  of 24. F881.
