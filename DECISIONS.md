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
- Status: accepted
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
  in `apps/mobile/src/scenes/scenePreview.ts`.
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
  quote prices no scoring). Free conversation (missions) is still unscored.
- Sources: [pedagogy](docs/PEDAGOGY.md), F623 and F805 in
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
