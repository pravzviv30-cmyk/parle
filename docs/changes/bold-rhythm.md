# C · Bold rhythm implementation

## C2 implementation — 14 October 2026

- Status: implementation ready for review; independent reviews, full-flow browser retakes, final full gate, production web export and generic iOS compilation passed. The disclosure/footer follow-up, policy-opening repair, signup-footer follow-up, tutor-colour follow-up, tutor-portrait motion follow-up, question-palette follow-up, question-illustration/structure follow-up, premium illustration redraft and natural-gesture follow-up also pass their final full gates. Native device operation and production release acceptance remain separate.
- Checkout: `/Users/pravz_07/.codex/worktrees/fe5e/Luvani`, starting HEAD `dad81566`, branch `codex/c2-redesign`.
- Owner / integrator: this Codex session, with four implementation agents and four independent read-only reviewers across C2 and the disclosure follow-up.
- Current follow-up (15 October): full onboarding audit and integration repairs are implemented; independent code, production-flow and visual reviews are green. Root owns browser QA, shared repairs and verification; implementation agents repaired restart cleanup and result reveals in disjoint source files before independent cross-review. F826–F831 cover the six findings. The final full gate passes 5,220 repository tests, 92 shared proofs and eight SQL proofs replaying 39 migrations. The 8096 guarded component preview verifies the setup-to-disclosure journey and separate live/results/account/welcome fixtures with inert auth/practice. The actual App/Gate runs on 8099 in explicit supported local-development mode; all six setup questions through disclosure and durable resume are checked there. Production web export passes, but its runtime correctly refuses this checkout's missing Supabase configuration. Generic iOS compilation passes with zero errors; real provider/live-service, authenticated Home and physical-device acceptance remain separate holds.
- Latest real-service follow-up (15 October): existing isolated staging configuration, real password/JWT/RLS proofs, installed physical iPhone account restoration and three bounded live rooms were exercised. The human confirmed voice and typing respond in a fresh room, with a response-speed concern retained. F832–F840 repair entry, ownership, transcript focus, repeated support reopening, empty-room teardown and zero-reply wording. All fixes are independently reviewed; latest gate passes 5,269 workspace tests, 92 shared proofs and eight database proofs. Admission is restored off. Source is accepted for the authorised main push; hosted HTTPS/readiness, native provider and complete audible-latency acceptance remain open. Detailed evidence follows below.
- Reference: [C2 page](https://www.figma.com/design/sjAwoGinWQKvhGrWbgMO18?node-id=58-364), [prototype](https://www.figma.com/proto/sjAwoGinWQKvhGrWbgMO18/Luvani?node-id=61-364&starting-point-node-id=61%3A364).

### Outcome and existing seams

The approved C2 presentation is implemented through the existing Expo navigation
and service owners: exact exported illustrations, closed local loops, shared
300 ms page transitions, real selections and form interactions. C2 bundles 127
SVG layers with hashes and dimensions; each scene uses one Reanimated clock for
4.8-second Rest/Float cycles under screen-activity, AppState and live reduced-motion guards.
Welcome retains an explicit Continue and a still page/wordmark, with only its
logo ring spinning after 800 ms over an 8.8-second cycle. No SDK upgrade or new
navigation, auth, grading, progress or admission owner was introduced.

Four visible progress stages derive from the pages the actual journey asks.
Loading, focus and error states preserve their parent stage; Sign in, Welcome
and Home omit onboarding progress. The shared live room supplies the orb,
left/right transcript, bottom composer, compact Speaking/Typing controls and
End session. Focus/keyboard state hides mode/end controls, repeated keyboard
layouts retain the last-tutor anchor, and older-message reading suspends
following until the reader returns to the latest message. A text-only grant
cannot gain a speech pipeline through the presentation toggle.

Installed React Native Web ScrollView behavior caused compact programmatic
scrolling to blur both composer and account fields. Transcript and shared
onboarding/account frames now use `none` on web; real wheel/touch intent owns
dismissal, while native keyboard modes remain unchanged. Transcript wheel intent
at an unchanged end stop preserves following until an actual scroll position
decides. Layout changes cannot pull an upward reader down during that decision.
Regression proofs execute the installed vendor callback and production controller.

Cloud/flame results use real saved records and one earned entry confetti burst;
partial/interrupted sessions do not invent a completed conversation or spoken
French. Account, service recovery, safety-stop, ownership and durable-completion
rules remain in their existing owners. The prototype's names, transcripts and
sample form values are visual examples; the isolated development preview uses
synthetic fixtures and inert auth behind its explicit development guards.

The age UX uses linked Terms/Privacy notices before guest practice, account
creation/provider actions and repair Continue. The deliberate action owns the
13+ declaration; reading a policy, arriving or typing does not accept it.
Acceptance is not age verification. Known underage/refusal cleanup and existing
server eligibility/admission remain enforced; professional legal review remains
a release hold.

### Screens and states

- Opening; goals/interests/level/confidence/focus/duration; personalised plan and
  editing; all six tutors and loading/playing/paused/failed/retry previews.
- Practice disclosures, optional opt-ins, Terms/privacy, permissions and denial.
- Guest and authenticated tutor sessions: connecting/ready/listening/processing/
  speaking/typing/sending/paused/reconnecting/error/ending, transcript hidden,
  keyboard focus, latest-message anchoring and older-history reading.
- Earned completion and achievements, partial/interrupted practice, save/retry,
  account creation/sign-in/reset/verification/provider/cancellation states.
- Welcome with explicit Continue and logo-only delayed ring spin; Home arrival,
  settled/loading/failed/offline/empty/resume, earned streak, reminder/denial.
- The browser acceptance matrix includes 320 × 568, 390 × 844 and tablet layouts.
  Native keyboard, permission, audio, large-text and accessibility acceptance are
  separate device checks, never inferred from browser screenshots or the gate.

### Dependency-ordered agent ownership

| Task | Owner | Dependencies | Allowed files | Acceptance / status |
|---|---|---|---|---|
| C2-1 foundations / legal / integration | root | none | theme, palette, components, shared layout, motion tokens/policy, legal, this plan | Integrated; Figma tokens, action-owned declaration and shared web-focus behavior covered by passing checks |
| C2-2 exact assets / local loops | visuals implementation agent | C2-1 seam | onboarding/motion, BoldVoiceOrb, C2Visuals, art/flat/c2 registry, assets/c2 | Integrated; 127 local unchanged exports, finite geometry, namespaced SVG definitions and activity/reduced-motion policy checked |
| C2-3 onboarding / auth | onboarding implementation agent | C2-1, C2-2 APIs | setup/tutor/plan/onboarding chrome/progress/welcome, auth forms/provider controls | Integrated; real route/input/recovery, deliberate tutor choice and restored progress checked |
| C2-4 live sessions | live implementation agent | C2-1, C2-2 orb | FirstLivePractice, ConvoScreen, LiveSessionScreen, tutor/Transcript, live presentation + prompt history | Integrated; one room/history across modes, keyboard callbacks and pinned-follow policy checked |
| C2-5 results / Home / progress / consistency | root | C2-1, C2-2 | FirstSessionResult, HomeTab, TodayHero, streak/progress, shared rest-app chrome, dev preview | Integrated; record-derived completion/evidence, C2 cloud/flame and explicit welcome checked |
| C2-6 independent review / verification | four read-only reviewers + root; two independent premium-art reviewers | C2-2–C2-5 | tests, existing domain docs, this plan | F810–F831 named proofs pass; no actionable findings within reviewed source/browser scope. Full-flow retakes and latest 5,220-test gate with 92 shared proofs, typechecks and SQL proofs passed; final C2 web export passes. Device/service acceptance remains separate |

Workers used disjoint write sets. Root owns shared interfaces, integration,
verification and disposition; existing core/server rules remain authoritative.
Independent source/Figma reviews and browser follow-up produced the fixes in
[KNOWN_ISSUES F810–F825](../KNOWN_ISSUES.md#f810--c2-keyboard-resizing-loses-the-last-tutor-message),
with named regression evidence for keyboard anchoring, duplicate prompts,
truthful completion copy, admission/back races, field geometry, selection paint,
transition coverage, recovery keyboard actions, web selected/hidden states and
account-first resume progress, the complete welcome accessible heading, installed
web ScrollView focus retention, scroll-intent/geometry races and policy pages
outside navigation.

### Review path groups

| Area | Existing owners and new presentation seams |
|---|---|
| Foundations and legal | [theme](../../apps/mobile/src/theme.ts), [shared controls](../../apps/mobile/src/components.tsx), [Terms acceptance](../../apps/mobile/src/legal/TermsAcceptance.tsx) |
| Exact artwork and motion | [asset manifest](../../apps/mobile/assets/c2/manifest.json), [C2 layer host](../../apps/mobile/src/onboarding/motion/C2Scene.tsx), [shared motion tokens](../../apps/mobile/src/motion/tokens.ts) |
| Setup, tutor and accounts | [pre-account owner](../../apps/mobile/src/onboarding/PreAccountOnboarding.tsx), [progress model](../../apps/mobile/src/onboarding/onboardingProgress.ts), [auth flow](../../apps/mobile/src/auth/AuthFlow.tsx), [welcome](../../apps/mobile/src/onboarding/AccountWelcome.tsx) |
| Live sessions | [shared room](../../apps/mobile/src/live/C2LiveRoom.tsx), [transcript](../../apps/mobile/src/tutor/Transcript.tsx), [scroll policy/callbacks](../../apps/mobile/src/live/c2TranscriptPolicy.ts) |
| Earned results and Home | [first-session results](../../apps/mobile/src/onboarding/FirstSessionResult.tsx), [Home](../../apps/mobile/src/tabs/HomeTab.tsx), [streak presentation](../../apps/mobile/src/onboarding/firstRun/StreakCelebrationScreen.tsx) |
| Domain memory | [design](../../DESIGN.md), [onboarding](../ONBOARDING.md), [live voice](../LIVE_VOICE.md), [privacy/safety](../PRIVACY_AND_SAFETY.md), [UI-002 decision](../../DECISIONS.md#ui-002--render-c2s-exact-figma-layers-through-the-shared-motion-engine) |

### C2 execution log

| Date | Attempt | Actual result | Disposition |
|---|---|---|---|
| 2026-10-14 | Checkout/worktree/status established; branch created | `dad81566`; pre-existing untracked `.codex/` preserved | All implementation stays in this checkout |
| 2026-10-14 | Locked dependencies installed | `npm ci`: 902 packages, exit 0; Node 24.16.0 | This worktree's own install used |
| 2026-10-14 | Expo v57 docs, Figma design/motion contexts and agent scopes | Three implementation agents integrated exact C2 through existing seams | No SDK/runtime replacement |
| 2026-10-14 | Independent source/Figma review and browser follow-up | F810–F824 fixed with named passing regression checks | Findings recorded in the existing defect ledger |
| 2026-10-14 | Earlier integrated gate, before F822–F824 | Green: workspace TypeScript checks, 5,184 repository tests including 2,828 mobile tests, 92 release/provider proofs, and eight disposable SQL scripts each replaying all 39 migrations | Historical checkpoint: `/tmp/c2-welcome-final-gate.log`; not the final late-fix gate |
| 2026-10-14 | Earlier production web export, before F822–F824 | Passed; Expo emitted `dist` | Historical checkpoint: `/tmp/c2-welcome-final-web-export.log`; no deployment |
| 2026-10-14 | Earlier source graph, before F822–F824 | 16,615 nodes, 43,707 edges, 785 communities; 78 SQL files lack the SQL parser; 257 non-code files yielded no nodes; hub labels only | Historical checkpoint: `/tmp/c2-welcome-final-graph.log`; final graph still required |
| 2026-10-14 | Third independent review after late web-focus fixes | No actionable findings; 37 live tests in 6 suites and 49 form tests in 13 suites passed, along with typecheck and diff checks | Installed vendor/controller proofs cover F822–F824; no native acceptance inferred |
| 2026-10-14 | Final full gate after F822–F824 | Green, exit 0: all workspace TypeScript checks, 5,189 repository tests including 2,833 mobile tests, 92 shared release/provider proofs; all eight SQL scripts replayed 39 migrations | `/tmp/c2-landing-gate.log`; no floors lowered, assertions weakened or suites skipped |
| 2026-10-14 | Final production web export | Passed, exit 0; Expo emitted `dist` | `/tmp/c2-landing-web-export.log`; isolated dev preview restarted with a cleared cache afterward |
| 2026-10-14 | Final source graph refresh | 16,625 nodes, 43,720 edges, 772 communities; 78 SQL files still lack the SQL parser, 257 non-code files yielded no nodes; hub names only, no semantic-label refresh | `/tmp/c2-landing-graph.log`; executable SQL proofs are the database acceptance evidence |
| 2026-10-14 | Running browser component QA at 390 × 844 | Goals; Well done → achievements; typing focus hides controls; Enter sends once, clears the composer and restores controls; speaking switch retains history; hidden transcript absent from accessibility navigation | Synthetic/inert development preview; native and live-service behavior not certified |
| 2026-10-14 | Compact browser QA at 320 × 568 | Live mode controls/composer fit with scroll width 320; all six tutor rows scroll; selecting Émilie exposes checked state independently of Listen/Pause; Practise with Émilie opens Before we start with Terms and off-by-default opt-ins; preview Start remains disabled | Capture: `tutor-selected-320.png`; no claim of heard or native audio |
| 2026-10-14 | Compact live focus retake after F822–F824 | At 320, both actual mouse and accessibility touch input retain focus; mode/end controls disappear and the complete last tutor bubble sits above the composer; mouse/touch heading clicks dismiss and restore controls | Corrected `live-typing-focused-320.png` replaces the earlier unfocused capture |
| 2026-10-14 | Setup and plan browser QA at 390 × 844 | Trip, Food & cafés, few words, ready to try, speaking and 10 minutes carry into the restaurant plan; progress advances 0 → 4 → 7 → 11 → 14 → 18 → 21 → 25; editing duration to 15 and Done preserves the other answers | Actual setup/plan components; no service session started |
| 2026-10-14 | Tablet and compact account browser QA | At 768 × 1024 the plan stays within its 560-point column without overflow; at 320 × 568 sign-in/signup scroll and 52-point provider buttons fit; returning Sign in is clean, with the rounded focus ring and no square browser outline | Captures: `plan-768.png`, `signin-320.png`, `signin-focus-320.png`, `signup-320.png`, `signup-providers-320.png`; no account submitted |
| 2026-10-14 | Account browser retake after F823 | At 320, an actual accessibility touch on Confirm password triggers natural form scrolling and retains DOM focus; the complete input stays within y=365–411 of the viewport with no square browser outline | Capture: `signup-confirm-focus-320.png`; no auth submission |
| 2026-10-14 | Welcome browser behavior/accessibility | The heading announces “Welcome to Luvani”; only Continue is present, with no progress or Skip; logo sits left of the wordmark; only the ring wrapper rotates while the remaining layers stay still; Continue returns to the inert fixture selector | Capture: `welcome-390.png`; no real account handoff claimed |
| 2026-10-14 | Earned streak browser QA at 390 and 320 | Cloud/flame and actual day-one badge/tick shown; compact CTA is 52 points high at y=500–552 with scroll width 320; cloud/flame float and badge pulse continue changing 42.8 seconds later | Captures: `streak-390.png`, `streak-320.png`; `streak-loop-observation.json` proves ongoing motion, not frame pacing |
| 2026-10-14 | Founder follow-up: simplify Before we start | Removed the main provider paragraph; existing Privacy details/full policy retain processing facts. Centred the practice-only agreement and policy buttons. AI, retention and separate off-by-default opt-ins remain visible | 61 focused disclosure/privacy checks passed; default/320-pixel browser layout and both policy links checked; `/tmp/c2-disclosure-followup-tests.log` |
| 2026-10-14 | Policy-link browser check exposed F825 | Opening Terms outside navigation threw before its Android guard. Shared hardware Back now uses optional navigation context, focus/blur for routed views and mounted lifetime for direct policy views | Six executable hook regressions and mobile typecheck passed; independent hook/surface review: 90 tests in 43 suites passed; browser Terms opens after repair |
| 2026-10-14 | First post-repair gate | One Android-only source guard failed because it required a directly adjacent guard, while the focus callback is inside an already guarded effect | The F791 test now checks the preceding Android-only return through the AST; independent review passed 10 positive/adversarial cases and eight focused tests. No assertion, floor or platform barrier weakened |
| 2026-10-14 | Final disclosure/policy gate | Green: 5,195 repository tests including 2,839 mobile tests, 92 shared proofs, all workspace typechecks and eight SQL proofs replaying 39 migrations | `/tmp/c2-disclosure-accepted-gate.log`; `git diff --check` passed; graph refreshed with existing SQL-parser/semantic-label limitations, no further topology change after 16,632 nodes / 43,725 edges / 793 communities |
| 2026-10-14 | Founder follow-up: signup agreement in bottom footer | The single account agreement and Terms/Privacy links are centred immediately above Create account. The footer retains its existing keyboard-hidden behavior; email/provider acceptance handlers, errors, validation and confirmation resend remain in their current owners | Root owns `SignUpScreen.tsx`, `TermsAcceptance.tsx`, the existing surface guard and current design/onboarding docs. Independent read-only review found no source issues. The first guard used an arrow-unsafe regex; the existing tag parser now proves one notice and immediate footer order. All 133 focused tests and mobile typecheck pass: `/tmp/c2-signup-footer-tests.log`, `/tmp/c2-signup-footer-typecheck.log` |
| 2026-10-14 | Signup footer browser and graph checks | 390 × 844 and 320 × 568 keep the notice, both 44-point links and the 52-point primary fully reachable. Compact fields/providers scroll above the footer; Confirm retains focus, and both policy sheets open and return without a request | Captures: `signup-footer-centred-390.png`, `signup-footer-centred-320.png`, `signup-footer-centred.png`. No signup was submitted. Graph refresh passed at 16,632 nodes / 43,725 edges / 793 communities, with 12 hub-name changes and the existing 78 SQL-parser / 257 noncode empty-file / semantic-label limitations: `/tmp/c2-signup-footer-graph.log` |
| 2026-10-14 | Final signup-footer gate | Green: 5,195 repository tests, 92 shared proofs, all workspace typechecks and eight SQL proofs replaying 39 migrations | `/tmp/c2-signup-footer-gate.log`; local documentation links and `git diff --check` passed. Changes remain uncommitted on `codex/c2-redesign`; local signup preview stays open for review |
| 2026-10-14 | Founder follow-up: bolder Meet your tutor | C2 sage, peach, lavender and butter cards use larger names; selected cards become violet with a gold check. Listen is an integrated violet/gold pill with shared press feedback, active speaker/loading icons and actual media progress. Choice and playback remain independent | Root owns `TutorSelection.tsx`, shared `boldType` tokens in `theme.ts`, the existing selected-paint guard and current docs. The read-only tutor reviewer found no remaining issues. Loading, error/Retry, paused/Resume, replay and returning selection retain the existing preview controller; no service or audio owner changed |
| 2026-10-14 | Tutor control geometry and browser checks | Listen/Pause/Resume remain 106 × 48 at normal size. The width scales with font size until full-width stacking; bundled Outfit metrics put Loading… at 61.7 points within the 66-point normal text allocation. Selection changes paint only. At 390 × 844 and 320 × 568 names remain readable, all six tutors are reachable and no horizontal overflow occurs | Listen left all choices unselected; Pause/Resume retained observed progress, switching previews replaced the previous sample, and selection did not reset playback. Final browser captures include `tutor-colour-390.png`, `tutor-colour-selected-390.png`, `tutor-colour-loading-390.png`, `tutor-colour-playing-390.png`, `tutor-colour-320.png` and `tutor-colour-320-bottom.png`. Bundled previews only; no live session started |
| 2026-10-14 | Tutor-colour verification and graph | First gate caught F341 because the component defined raw font sizes; the same typography now lives in shared theme tokens, with the guard unchanged. Final focused run passed 183 tests; full gate is green with 5,195 tests, 92 shared proofs, all workspace typechecks and eight SQL proofs across 39 migrations | `/tmp/c2-tutor-colour-gate.log` records the repaired first attempt; accepted logs: `/tmp/c2-tutor-colour-accepted-tests.log`, `/tmp/c2-tutor-colour-accepted-gate.log`. Graph refresh passed with 16,633 nodes / 43,726 edges / 793 communities and 213 hub-name changes; existing 78 missing SQL-parser / 257 noncode empty-file / semantic-label limitations remain: `/tmp/c2-tutor-colour-graph.log`. Changes remain uncommitted in this task checkout |
| 2026-10-14 | Founder follow-up: continuous tutor portrait motion | All six unmodified portrait SVGs use module-stable scene definitions with a 1.25-point source lift and 0.8-degree sway in the existing closed 4.8-second loop. Rendered lift is 1.1–1.4 points at 44/56-point sizes. Only the art layer moves; card, name, selected check and controls retain their slots | Root owns `C2Visuals.tsx` and the current design/onboarding/change docs; no animation engine, timer, key, asset or service owner added. Existing C2 memo, activity, AppState and reduced-motion handling applies. Independent read-only review found no issues; 60 focused checks and mobile typecheck passed: `/tmp/c2-tutor-portrait-tests.log`, `/tmp/c2-tutor-portrait-typecheck.log` |
| 2026-10-14 | Tutor portrait browser, gate and graph evidence | Eight actual DOM snapshots spanning 164.6 seconds show all six transforms continuing, with stable SVG instance IDs and unchanged 342 × 84 cards through selection, Listen, Pause, Resume and switching previews. At 320 × 568 all six remain reachable and the 1.1-point motion is clear of the controls | `tutor-portrait-loops-390.json`, `tutor-portraits-animated-390.png`, `tutor-portraits-animated-320.png`, `tutor-portraits-animated-320-bottom.png`. These show continuity and layout, not native frame pacing. Full gate green: 5,195 repository tests, 92 shared proofs, all workspace typechecks and eight SQL proofs replaying 39 migrations: `/tmp/c2-tutor-portrait-gate.log`. Graph refresh passed at 16,634 nodes / 43,727 edges / 787 communities, with existing parser/semantic-label limitations and 202 hub-name changes: `/tmp/c2-tutor-portrait-graph.log`. Changes remain uncommitted for review |
| 2026-10-14 | Founder follow-up: colourful setup answers and plan editing | All six question pages and their six plan-edit groups use explicit sage, peach, lavender and butter tones. Selected cards use violet, opaque white copy and gold checks; shared 18/24-point answer typography, 72-point minimum cards and 24-point corners give them the tutor page's boldness. The outer focus target matches the corners. Shared raised press feedback and selection glint remain in use; Continue/See your plan now includes the animated gold arrow, with active text allowed to shrink and wrap | Root owns `BoldChoice.tsx`, `NextButton.tsx`, `theme.ts`, the existing component guard and current docs. The implementation agent owns only palette wiring in `PreAccountOnboarding.tsx` and the presentation helper in `boldChoices.ts`; an independent read-only reviewer found no remaining issues, including the final text-sizing fix. Single/multiple roles, stable keys, callbacks, explicit Next and product rules remain in their existing owners. The two privacy opt-ins omit the colour tone and keep their quiet default. Existing loading, error and returning-answer behavior is retained |
| 2026-10-14 | Question and plan-edit browser acceptance | The actual complete setup journey preserves Travel, Music & films plus Food & cafés, A few words, Ready to try, Listening and 15 minutes into the personal plan. Single-choice controls stay on their page until Continue; interests toggle independently, and enabled keyboard Enter advances once. All six plan-edit groups open with the matching colours and checked values; cancelling each retains the plan. At 390 × 844 and 320 × 568 choices and fixed CTAs remain reachable, with no horizontal overflow. Daily-time cards measure 72 points; keyboard focus retains the visible auto outline on the 24-point rounded target | Captures: `questions-purpose-390.png`, `questions-interests-390.png`, `questions-level-390.png`, `questions-confidence-390.png`, `questions-confidence-320.png`, `questions-focus-320.png`, `questions-time-390.png`, `questions-time-320.png`, `questions-plan-edit-purpose-320.png`, `questions-plan-edit-time-320.png`; measured six-group evidence in `questions-plan-edit-checks.json`. Synthetic development fixtures only; no account or live service submitted. Illustration motion is unchanged; these observations do not certify native large-font layout or frame pacing |
| 2026-10-14 | Question-palette checks and first full-gate attempt | 225 focused tests passed, mobile typecheck passed, and a final CTA/source-focused run passed 126 tests after the active-text sizing fix. The first full gate passed all 5,195 workspace tests and 92 shared proofs, but `verifyDataBoundaries.mjs:182` reported a missing expected learner-write-quota rejection, the existing open F796. Source inspection supports minute-bucket rollover as an explanation, without captured bucket timestamps proving this attempt's cause | `/tmp/c2-questions-tests.log`, `/tmp/c2-questions-typecheck.log`, `/tmp/c2-questions-final-focus.log`, `/tmp/c2-questions-gate.log`. Followed F796's instruction for one rerun on an unrelated change. F796 remains open; no SQL proof, migration, assertion, floor or quota policy was changed |
| 2026-10-14 | Accepted question-palette gate, graph and disposition | Final full gate green, exit 0: 5,195 repository tests including 2,839 mobile tests, 92 shared release/provider proofs, all workspace typechecks and eight SQL proofs each replaying 39 migrations. Graph refresh passed at 16,637 nodes / 43,732 edges / 788 communities; the final CTA fix caused no topology change. Existing 78 missing SQL-parser / 257 noncode empty-file / semantic-label limitations remain | `/tmp/c2-questions-accepted-gate.log`, `/tmp/c2-questions-graph.log`, `/tmp/c2-questions-accepted-graph.log`. Local documentation links and `git diff --check` passed. Changes remain uncommitted in the attached task checkout on `codex/c2-redesign`, ready for local review |
| 2026-10-14 | Founder follow-up: improve question illustrations, continuous loops and reference structure | The attached `IMG_5432.AVIF` informed a colour illustration band above the question, curved paper edge, answer stack and fixed bottom action. Six distinct compositions reuse the existing cloud/map, book/coffee, growing plant, listening bubble, café conversation and clock/calendar/cup vectors. Complete rotated groups fit rigidly into stable 280 × 180 scenes, with a 2.4-source-point whole-scene lift on the existing closed 4.8-second clock. The 168-point band shrinks to 118 in shared compact/large-text mode; the native SVG rings/curve are static. The existing exported shapes/hashes remain unchanged | Root writes `C2QuestionHero.tsx`, the frame-owned `hero` slot in `OnboardingLayout.tsx`, question integration and web heading `preventScroll` in `PreAccountOnboarding.tsx`, and current docs. The implementation agent writes only `C2QuestionArtwork.tsx`, `c2QuestionScenes.ts` and meaningful geometry proofs in `c2QuestionScenes.test.ts`. Independent initial and final read-only reviews found no remaining issues. The same reading-column/safe-area/scroll/heading/footer owners remain; only decoration bleeds. All question body grounds match the paper curve. Answer values, keys, callbacks, deliberate Next, progress and service rules are untouched |
| 2026-10-14 | Question-hero browser acceptance and motion evidence | All six actual question components render their distinct artwork above the title. The complete setup journey preserves Travel, Food & cafés plus Music & films, A few words, Ready to try, Listening and 15 minutes into the correct restaurant plan; keyboard Enter advances once. At 390 × 844 daily time shows all five answers and the 52-point CTA, both 342 points wide. At 320 × 568 the six purpose and five time answers remain reachable through normal scrolling, with the CTA fixed. At 768 × 1024 the body and action align at 560 points; 844 × 390 landscape keeps every answer reachable without horizontal overflow. Fresh page headings stay at the intended top position and do not auto-scroll away from the hero | Captures: `question-hero-purpose-390.png`, `question-hero-purpose-320-bottom.png`, `question-hero-interests-390.png`, `question-hero-level-390.png`, `question-hero-confidence-390.png`, `question-hero-focus-390.png`, `question-hero-time-390.png`, `question-hero-time-320-bottom.png`, `question-hero-time-768.png`, `question-hero-time-landscape.png`. Actual DOM records in `question-hero-motion-and-layout.json` show varying transforms, stable art IDs through selections/resizing and unchanged normal answer/action geometry. Repeated time-scene observations span over 22 minutes; this proves continuing motion and stable layout, not every frame or native frame pacing. Synthetic fixtures only; no account or live request submitted |
| 2026-10-14 | Question-hero focused checks, final gate, graph and disposition | 236 focused integration/source checks passed; two new bounds/rigidity proofs plus existing motion/assets pass in the agent's nine-test run. A 136-test layout-refinement run passed; mobile typechecks passed. Both the initial gate and the accepted gate after the final paper-ground correction are green: 5,197 repository tests including 2,841 mobile tests, 92 shared proofs, all workspace typechecks and eight SQL proofs each replaying 39 migrations. Final graph refresh passed at 16,654 nodes / 43,781 edges / 758 communities | Logs: `/tmp/c2-question-heroes-focused.log`, `/tmp/c2-question-art-tests.log`, `/tmp/c2-question-heroes-final-focus.log`, `/tmp/c2-question-heroes-typecheck.log`, `/tmp/c2-question-heroes-gate.log`, `/tmp/c2-question-heroes-accepted-gate.log`, `/tmp/c2-question-heroes-accepted-graph.log`. No assertion, floor, dependency, exported asset or production rule changed. Existing 78 missing SQL-parser / 257 noncode empty-file / semantic-label limitations remain; final graph renamed 38 hubs without LLM labels. Local documentation links and `git diff --check` passed. Local, uncommitted review disposition remains; native device and production release checks are separate |
| 2026-10-14 | Founder follow-up: genuine premium question-illustration redraft | Six newly drawn characters replace the earlier compositions: folded-map explorer, open-book character, expressive plant with watering can, peach speech character, connected conversation pair and gold clock holding a violet mug. Rounded navy features, restrained expressions and layered flat colour follow the cloud family's style without requiring a cloud on each page. All use a stable 280 × 180 canvas and the existing 2.4-source-point, closed 4.8-second float | One implementation agent writes only `c2QuestionDrawings.ts`; root owns the optional child-vector seam in `C2Artwork`, memoized/namespaced renderer, scene contract, actual painted-geometry proofs and current docs. No new dependency, animation runtime, product state, navigation or form owner. The 127 original Figma SVG exports and hashes remain unchanged |
| 2026-10-14 | Independent premium-art and motion review, actual browser evidence | Art review checked all six at 210- and 130-point widths and actual 390 × 844 pages. Feedback repaired book/speech expressions, plant contrast and stray conversation marks; final review approved the clock's page fit and the purpose/level/confidence compositions. Separate motion/code review found no remaining issues. All six phone pages have no horizontal overflow. Time selection/resizing retains the art ID; changing transforms show ongoing motion. At 320 × 568 the last answer scrolls fully above the fixed 52-point CTA, with 272-point aligned widths and no overflow | Correct phone evidence uses `premium-{page}-390.jpg`, verified against both DOM viewport and actual JPEG dimensions; wide captures are retained as desktop evidence. `premium-time-320.jpg`, `premium-time-320-bottom.jpg`, `premium-illustration-proof.png`, `premium-illustration-bounds.json` and `premium-illustration-observations.json` capture the current redraft. These are synthetic component fixtures; native frame pacing and physical-device acceptance are not inferred |
| 2026-10-14 | Premium-redraft focused checks, full gate, graph and disposition | Ten art/assets/motion checks and the final 184-test integration run passed; mobile typecheck passed after repairing explicit nullable geometry guards in the first test attempt. New proofs validate actual path/control/stroke bounds, closed-loop clearance, deterministic drawings, namespace isolation and rejection of unsupported/executable SVG content. Full gate green, exit 0: 5,198 repository tests including 2,842 mobile tests, 92 shared proofs, all workspace typechecks and eight SQL proofs each replaying 39 migrations. Source graph refresh passed at 16,653 nodes / 43,788 edges / 781 communities | `/tmp/c2-premium-art-accepted-typecheck.log`, `/tmp/c2-premium-art-accepted-tests.log`, `/tmp/c2-premium-art-gate.log`, `/tmp/c2-premium-art-graph.log`; initial typecheck result preserved in `/tmp/c2-premium-art-typecheck.log`. No assertions weakened, floors lowered or suites skipped. Graph renamed 184 hubs; existing 78 missing SQL-parser / 257 noncode empty-file / no semantic LLM-label limitations remain. Local documentation links and `git diff --check` passed. Uncommitted local review disposition remains |
| 2026-10-14 | Founder follow-up: natural gestures on all six new question illustrations | Stable semantic SVG groups add a compass offer −2.5°, welcoming book hands ±3°, leaves 2° and held can −1.5°, confidence arms ±3° and badge 1.2%, partner leans ±1°, and held cup −2° with steam lift −1.2 source points. Rear/front paint planes share source-coordinate joints; rigid faces, feet/clasp, paint order and authored Rest geometry are preserved. All shipped offsets are zero | Vector implementation agent writes only `c2QuestionDrawings.ts`; root owns `C2Scene.tsx`, `C2QuestionArtwork.tsx`, `c2QuestionScenes.ts`, motion policy/proofs and current docs. Optional `renderVectors` receives the existing phase; memoized part hosts are absolute on the same 280 × 180 canvas. No new engine, clock, dependency or product/navigation owner. Existing foreground/activity/sheet and live Reduce Motion guards remain authoritative |
| 2026-10-14 | Independent gesture review and running browser acceptance | Art reviewer approved normal 210 / compact 130 Rest/Gesture poses and actual 390 × 844 phone pairs for time, plant and confidence. Separate motion reviewer approved pivots, shared phase, identity and lifecycle. Continuous interval bounds include every angle/scale/lift plus float; tightest upper clearance is about 6.16 source points. Raster proof checks 126 poses, unchanged source geometry and exact current Rest reassembly; earlier monolithic rasters differ only at 4–86 antialiased edge pixels on four pages, with time/focus exact. Each of six actual 390 × 844 pages was sampled 17 times over 5.58–5.68 seconds: all gesture transforms change, static parts remain static, IDs and card geometry stay stable, no horizontal overflow | `question-gesture-observations.json` includes a further 27-sample, 5.605-second time cycle plus selection/resize checks. At 320 × 568, 130-point art retains its IDs and the final choice scrolls fully above the fixed 52-point CTA. Actual pose captures: `gestures-{page}-390-0.jpg`, `gestures-{page}-390-8.jpg`, `gestures-time-selected-390.jpg`, `gestures-time-320.jpg`, `gestures-time-320-bottom.jpg`. Synthetic components only. Pose/transform observations do not certify every frame or native frame pacing |
| 2026-10-14 | Gesture checks, final gate, graph and disposition | Initial strict offset seam proof exposed 14-step Bézier inversion quantization; 24 steps preserve the same curve/timing and pass the unchanged assertion. Initial typecheck caught TS2352 in the part-record factory; a complete typed six-key helper repaired it without `any`/`unknown` casts. Final mobile typecheck and 148 focused tests passed. Full gate green, exit 0: 5,202 repository tests including 2,846 mobile tests, 92 shared proofs, all workspace typechecks and eight SQL proofs each replaying 39 migrations. Graph refresh passed: 16,670 nodes / 43,818 edges / 774 communities | `/tmp/c2-gestures-typecheck.log` preserves the initial typecheck; accepted logs: `/tmp/c2-gestures-accepted-typecheck.log`, `/tmp/c2-gestures-motion-policy.log`, `/tmp/c2-gestures-accepted-focus.log`, `/tmp/c2-gestures-gate.log`, `/tmp/c2-gestures-graph.log`. No assertion weakened, floor lowered or suite skipped. Graph renamed 208 hubs; existing 78 missing SQL-parser / 257 noncode empty-file / no semantic LLM-label limitations remain. Local documentation links and `git diff --check` pass. The 4.8-second / 120-frame / 25-fps looping GIF is a generated motion study from production parts/functions, not a device-performance recording. Changes remain local and uncommitted |

### 15 October full-flow audit evidence

The existing production components already contain C2. This pass repaired six
integration findings through their current owners: plan motion beneath sheets,
the Remember opt-in's committed state, failed restart cleanup, an 18-point Next
footer jump, earned-result reveal rewinds and obsolete age-question policy
copy. Named regression proofs and closed entries live in
[KNOWN_ISSUES F826–F831](../KNOWN_ISSUES.md#f826--plan-artwork-keeps-moving-beneath-its-editor-sheet).
No original illustration geometry, gesture amplitudes, service guard or test
floor was changed by this audit.

| Check | Actual result and evidence |
|---|---|
| Setup through disclosure at 390 × 844 | Travel, Food & cafés/Music, few words, ready, Listening and 10 minutes carried through the six questions into the plan. Progress advanced 0/4/7/11/14/18/21/25. A double Continue advanced once. Editing the goal to 15 preserved the other answers. Listen/Pause/Resume remained independent of tutor selection; choosing Émilie opened disclosure. Both policy links opened and returned with the opt-in retained. Practice Start is intentionally disabled in this component host. |
| Fresh full-cycle observations | Interests, level, confidence, focus and time each yielded 11 samples over 5.18–5.36 seconds: stable SVG IDs, stable answer-card geometry, moving gesture parts and no horizontal overflow. Purpose was additionally observed for 5.26 seconds in the actual App/Gate on 8099, with the same properties. `full-onboarding-oct15-observations.json` and `full-app-purpose-loop.json` supplement the earlier all-six 17-sample evidence. These observations do not certify native frame pacing. |
| Repaired geometry and sheet activity | Unanswered Continue remains exactly y=776, height=52 before/after guidance at 390 × 844. In the actual app at 320 × 568, See your plan stays y=500, height=52, width=272 before/after guidance, with no horizontal overflow. The mounted plan scene's settled paused snapshots are equal under the sheet; closing preserves IDs and resumes changing transforms. Immediate opening/closing samples remain classified as transitions. `full-flow-nudge-fixed-390.jpg`, `full-app-compact-nudge-320.jpg`, `full-flow-plan-390.jpg`; `full-flow-plan-edited-390.jpg` captures the outgoing sheet. |
| Live and earned-result component chain | Microphone pause/resume, hide/show transcript and Speaking/Typing preserve the same history. Native browser accessibility inspection excludes hidden messages. Focus hides mode/end controls; Enter sends once, clears the input and restores controls. End session → Well done → achievements → Save your progress opens signup. `full-flow-live-speaking-390.jpg`, `full-flow-typing-focused-390.jpg`, `full-flow-well-done-390.jpg`, `full-flow-achievements-390.jpg`; `full-flow-typing-sent-390.jpg` includes the incoming bubble fade. This fixture cannot submit real audio or a live-service request. |
| Account and welcome component checks | Dummy `.invalid` email/password values remain in the inert adapter through failed email/provider requests, Sign in, recovery and returning signup. Email/Password Next advance focus without submitting. Busy actions lock competing controls. Returning Sign in is simple and has no exposed onboarding progress. Welcome announces its complete heading, retains logo-only motion and explicit Continue; Continue returns to the fixture selector. No real account or provider exchange occurred. |
| Independent final review | Cleanup cross-review: 37 focused tests, no finding. Result-reveal cross-review: 19 focused tests, no finding. Narrow policy review: 43 focused tests and five HTML parity checks, no finding. Art reviewer independently inspected fresh cross-surface captures and parsed the geometry/loop/pause evidence; no material visual issue. Authenticated Home was not exercised and is not covered by that runtime approval. |
| Actual App startup and return | `EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT=1`, screen preview off, port 8099: Get Started → Start your personal plan → all six questions → matching plan → Meet your tutor → Émilie → Before we start. After selecting Food & cafés, reload presents Pick up where you left off; Continue my plan restores the interests page and checked value. The resulting plan retains Travel, Food & cafés, a few words, ready to try, Listening and 10 minutes; disclosure has both optional choices off. Captures: `full-app-opening-390.jpg`, `full-app-purpose-390.jpg`, `full-app-resumed-interests-390.jpg`, `full-app-plan-390.jpg`, `full-app-tutor-390.jpg`, `full-app-disclosure-390.jpg`; `full-app-oct15-acceptance.json`. This is the real App/Gate using its supported local auth mode; practice/account submission was not performed. |
| Accepted verification | `npm run gate` exit 0: 5,220 repository tests including 2,864 mobile tests, all workspace typechecks, 92 shared release/provider proofs and eight SQL proofs each replaying 39 migrations. `/tmp/c2-oct15-accepted-gate.log`; the final repeat after ledger/domain-document changes also passes in `/tmp/c2-oct15-closeout-gate.log`. Initial red root/reveal regressions are preserved in `/tmp/c2-oct15-root-red.log` and `/tmp/c2-first-session-reveal-red.log`. Existing source contracts were migrated to await/check cancellation success and to prove guidance inside the reserved button, rather than weakened or skipped. |
| Production web build and configuration boundary | Final Expo web export exit 0, 4,302 modules: `/tmp/c2-oct15-final-web-export.log`. Serving that export without Supabase configuration correctly throws the existing production startup guard. Explicit local-development mode is permitted only outside production; no guard was relaxed and no backend secret was copied from another checkout. Actual provider auth/live admission require the configured environment. |
| Native build | Fresh iOS prebuild and CocoaPods install exit 0; package/app/lock metadata unchanged. Ignored generated `apps/mobile/ios` is local build output. `npm run ios --workspace=@luvani/mobile -- --device generic --no-bundler --no-install --output /tmp/luvani-c2-ios-review` succeeds, exit 0: zero errors, three generated-project warnings (duplicate `-lc++` and script dependency analysis). Binary: `/tmp/luvani-c2-ios-review/Luvani.app`. No simulator boot, installation or app launch occurred; this is compilation evidence. `/tmp/c2-oct15-ios-prebuild.log`, `/tmp/c2-oct15-pods.log`, `/tmp/c2-oct15-ios-build.log`. |
| Final graph and document checks | `graphify update .` exit 0: 16,688 nodes, 43,840 edges, 780 communities; existing 78 missing SQL-parser files, 257 noncode files without nodes and hub-name/semantic-label limitations remain. `/tmp/c2-oct15-final-graph.log`. All 115 local links across changed domain/decision/ledger/plan documents resolve and `git diff --check` passes. |

All fresh images and observations above are in the existing local `c2-runtime`
evidence directory linked below. Changes remain uncommitted for review; real
service and device acceptance are not inferred from fixtures.

### 15 October real-service and physical-iPhone follow-up

The owner authorised finishing real auth/live/device checks and a normal push to
main, while retaining the no-paid-hosting limit. This checkout owns the source,
build and tests. Existing isolated staging configuration was found before asking
for credentials; only ignored, mode-0600 local environment files were prepared.
No workload, domain, paid membership or hosting subscription was purchased.

| Task / owner | Allowed paths and dependency | Observable acceptance |
|---|---|---|
| Live entry repair / implementation agent | MissionHero, existing guest refusal, onboarding/account bootstrap and focused proofs | Reject duplicate/stale launches; preserve server admission; explicit account handoff keeps the current plan and opens normal authenticated first practice once |
| Independent review / reviewer agent | Read-only source and regression execution after implementation | Current-plan sign-in detour, typed-only refusal, ownership, Terms and durable completion retain their guards |
| Native startup cancellation / reviewer acting as repair owner | App.tsx and app startup proofs; follows physical test | Abandoned migration callbacks cannot access stores after teardown or account change; current-account errors remain visible |
| Real-service/device/landing / root and human | Ignored local config, existing build tools, this plan and explicit Git paths | Real auth/RLS, physical room connection, human voice/typing result, temporary admission restored off, full gate and normal main push |

The live entry repairs are recorded with exact passing proofs in
[F832–F835](../KNOWN_ISSUES.md#f832--a-pending-home-scene-tap-can-launch-twice-or-outlive-its-owner).
The server continues to refuse anonymous production live rooms. A disabled guest
deployment now deliberately offers the existing account flow, preserves the
completed plan/tutor and uses authenticated FirstScene entry after normal account
setup. A server without speaking capability reports that limitation separately.

| Check | Actual result and scope |
|---|---|
| Fresh real Supabase verification | All 12 existing password/JWT/RLS/replay/concurrency checks passed against the isolated staging project; disposable fixture accounts were cleaned up by the existing verifier. `/tmp/c2-fe5e-real-supabase.log`. This is service proof, separate from provider UI acceptance. |
| Provider configuration readback | Canonical project reports email, Google and Apple enabled. Isolated staging reports email enabled and Google/Apple disabled. No provider keys were requested or changed, and issuers were not mixed. |
| Current physical binary | This checkout's arm64 Debug build and strict deep code-sign verification passed, then developer installation succeeded without erasing app data. Receipt `/tmp/c2-oct15-fe5e-device-build-receipt.json`; build/install logs `/tmp/c2-oct15-fe5e-device-build.log`, `/tmp/c2-fe5e-iphone-install.log`. This development binary uses Metro 8099 and the existing Personal Team profile; Apple/push are omitted only from generated ignored local entitlements. Native Apple success is not certified by this binary. |
| Physical account return and tutor entry | The installed C2 app restored the real staging account into Home, then Speak. The initial server refusal was the deliberately disabled staging admission switch. The owner approved at most eight 120-second sessions; temporary limits are one concurrent session and 960 issued seconds globally/per account, with a private backup of the original configuration. No allowance counter or entitlement was reset. |
| Real native room | Native logs show HTTP 200 grant, WebRTC connected, tutor first message, session-opened and subscribed audio track. The physical display shows Alexandre's opening and the C2 orb/transcript. Switching to Typing and focusing the composer hides mode/End controls and expands transcript history. Direct physical Back returned from the earlier unavailable screen to Speak; failed remote taps were a Mirroring-input limitation. Human audible/microphone/typed-send acceptance is recorded separately when returned. |
| Direct human feedback and retest | The first human attempt reported no voice input and slow/no typed response; that room reached its 120-second server limit around the handoff. A fresh room started directly on the phone received the human's voice and typed replies, and the human confirmed both work, while reporting noticeable delay and repeated Practice support reopening. Those concerns remain explicit follow-ups, rather than an unconditional native green light. The approved issued budget readback is 240 seconds after these two rooms. |
| New focus and startup repairs | Composer focus now reveals the latest sent learner message, falling back to the tutor when none exists; repeated keyboard signals cannot rearm a manually cancelled anchor. Independent 31-test review and mobile typecheck passed. Native startup logs exposed a real abandoned-migration/store-scope race; the account owner now establishes scope in layout before passive focus reads and rejects stale recovery work before reading. Seven startup regressions, 125 related checks and independent 12-test review passed. F836/F837 retain named proofs. |
| Practice support feedback | The support panel starts collapsed and only its explicit toggle changes the learner's choice; new tutor views and keyboard focus cannot force it open or reset that choice. Three actual-state/effect failures reproduced the old behavior; all four panel proofs, focused 28/21-test checks and mobile typecheck then passed. F839 records the named proofs. |
| Response-speed review | Independent read-only review found no added C2 wait before typed dispatch. The existing validated brain turn and durable checkpoint precede view/TTS publication; spoken endpointing retains its 400 ms floor. Across 46 mixed initialization/chunk metric events, TTS first-byte median is 371 ms (317–1,979), synthesis median 444 ms (350–2,404). These are not completed-turn samples. Scene timing has no complete per-turn sample, so the dominant wait and audible reply latency remain unmeasured. Thirty-two existing queue/timing checks passed; no model, endpointing, durability or admission policy was tuned from this sample. |
| Remote tutor departure | A worker deadline could remove the tutor while leaving the learner's WebRTC room connected. The client now checks its settled SDK state/roster and ownership after departure, closes an empty connected room and releases capture/audio. Authoritative recap text survives for its existing save choice; explicit leave/start/unmount still discard. Actual installed-SDK reconnect ordering and stale teardown are covered. Final 57 focused checks, independent 73 checks and mobile typecheck pass; F838 records all seven exact proofs. |
| Final physical reload | The final code was cold-launched through the phone's app switcher. Signed-in C2 Home restored; no storage-scope or startup-recovery error appears after this reload boundary. A transient staging admission timeout refused one attempt without issuing a grant; the next attempt connected normally. The real room starts with Practice support collapsed and keeps it collapsed through successive tutor replies and Typing/composer focus. Captures `iphone-c2-cold-start-home.png` and `iphone-live-support-collapsed.png` are local device evidence. Mirroring does not reliably forward text entry, so direct human typing confirmation above remains the input proof. |
| Test-window closure | Three rooms settled with 360 seconds issued against the approved 960-second/eight-room maximum. The third room reached its recap; no recording indicator remained. The original admission row was restored from its private backup and every field was verified against it: disabled, zero global/session-count exposure budgets. Existing issued counters, receipts and entitlements were preserved. `/tmp/c2-final-admission-restoration.json` contains only bounded aggregate configuration/settlement evidence. No further room was started after restoration. |
| Zero-reply recap wording | The third room recorded zero learner turns but its recap claimed a conversation was held. F840 repairs only that sentence: zero/invalid measured counts acknowledge time made for French; valid positive counts retain the existing assistance wording and never show a score. Two failures were reproduced first; 13 recap checks and mobile typecheck pass. Core XP/streak, completion and settlement policy are unchanged. |
| Final frozen verification and landing disposition | All source fixes have independent green reviews, including 13 recap checks after the last wording repair. Full gate exit 0: 5,269 workspace tests (2,912 mobile), all workspace typechecks, 92 shared proofs and eight database checks replaying 39 migrations. `/tmp/c2-real-final-landing-gate.log`. Frozen-source production export with dotenv loading disabled passes in `/tmp/c2-final-frozen-web.log`. Graph refresh passes at 16,738 nodes / 43,939 edges / 775 communities; the existing 78 missing SQL-parser / 257 empty noncode / semantic-label limitations remain. `/tmp/c2-final-accepted-graph.log`. Local document targets and whitespace pass. Explicit C2 paths are prepared for the owner-authorised normal main push, with hooks retained; ignored environment/build data and pre-existing `.codex/` are excluded. |
| Independent source acceptance | Both review findings (stale plan on sign-in detour and misleading typed-only account promise) were reproduced, fixed and independently cleared. Final independent run: 44 mobile tests across four suites and four server route tests, no failures/skips. `/tmp/c2-oct15-final-independent-handoff-mobile.log`, `/tmp/c2-oct15-final-independent-handoff-server.log`. |
| Integrated gate and web export | Full gate exit 0: 5,247 workspace tests, 92 shared proofs and eight SQL proofs replaying all 39 migrations. `/tmp/c2-real-services-accepted-gate.log`. Three obsolete source contracts first failed, then were migrated without lowering the link ceiling, skipping suites or weakening ownership/legal/scroll guards; focused 48 tests pass. Production web export with local dotenv loading disabled passed, `/tmp/c2-real-final-web-build.log`. |

### Native sign-in visual follow-up

After the first C2 landing (`fae6a3d3`), the human signed out and signed back into
the existing staging account directly on the iPhone and confirmed Home returned
without an error. They reported that entered email/password text sat too low.
F841 removes the inherited paragraph line height only on iOS, retaining native
font metrics, symmetric padding, growing minimum height, live font scaling and
password reveal/selection. Android/web retain their existing line height. The
actual-platform regression failed first, then 28 focused checks, mobile
typecheck and an independent 28-check review passed.

Root temporarily ran the existing guarded native component preview with its
inert auth adapter, preserving the real signed-in session. Entered `.invalid`
email and synthetic secure text now sit centrally in the actual iPhone fields;
no auth action was submitted. The preview also exposed literal JSX whitespace
in the sign-in footer as a native text warning; its narrow repair and proof are
tracked separately in F842. The local preview flag is restored after visual QA.
Actual footer AST/Babel execution reproduced the six-space raw child; the
whitespace-only repair passes 31 focused checks, mobile typecheck and independent
31-check review. Native Sign in → Create account → Sign in remount succeeds
without another raw-text warning (the earlier recorded warning count stays one,
with zero other native errors). Entered-text evidence is
`iphone-signin-centred-entered-text.png` in the existing local evidence folder.
The follow-up frozen full gate passes 5,271 workspace tests (2,914 mobile), all
workspace typechecks, 92 shared proofs and eight database checks replaying all
39 migrations: `/tmp/c2-signin-final-gate.log`. Frozen production web export
passes (`/tmp/c2-signin-final-web.log`). The final source graph refresh passes
with 16,742 nodes / 43,943 edges / 777 communities; the existing parser and
semantic-label limitations remain (`/tmp/c2-signin-final-graph.log`). Only the
field/footer repair, focused proofs, existing ledger/plan and refreshed graph
belong to this follow-up main commit; local environment files remain ignored.

GitHub verified the first landing on its exact SHA: [gate
38817112326](https://github.com/pravzviv30-cmyk/parle/actions/runs/38817112326)
passed 5,269 workspace tests, 92 shared proofs, eight SQL checks, dependency audit
and tracked/history secret scans; [release evidence
38817112296](https://github.com/pravzviv30-cmyk/parle/actions/runs/38817112296)
also passed. The derived [mobile preview
38819046443](https://github.com/pravzviv30-cmyk/parle/actions/runs/38819046443)
failed its existing hosted-service preflight: the app API must be a configured
HTTPS URL. Credential, exact checkout, latest-main and lockfile checks passed;
the workflow stopped before `eas update`, so it published no remote preview.
These CI results cover the first landing, independently of the subsequent native
field/footer correction and its follow-up gate.

Public live availability remains a separate hold under the owner's budget choice:
Railway staging has no services, there is no configured hosted HTTPS app API, and
the local readiness probe refuses ready while the required independent deletion
journal/maintenance role is missing. No heartbeat was fabricated and no readiness,
production guest or paid-operation guard was relaxed. The OCI-only decoder build
also remains blocked by its existing 128 MiB immutable-artifact bound. Local live
functionality does not certify these hosted prerequisites or native provider auth.

### C2 verification and disposition

Named late-fix proofs, independent reviews and compact live/account/policy
browser retakes passed. The latest full gate is green with 5,220 repository tests,
92 shared release/provider proofs, all workspace typechecks and eight SQL proofs
across 39 migrations. Production web export, generic iOS compilation and source graph refresh passed;
the parser/semantic-label limitations are recorded above. Current runtime evidence
is stored locally in
`/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime`:
[Well done](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/well-done-390.png),
[achievements](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/achievements-390.png),
[speaking](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/live-speaking-390.png),
[typing](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/live-typing-390.png),
[focused composer](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/live-typing-focused-390.png),
[corrected compact focused composer](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/live-typing-focused-320.png),
[compact tutor selection](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/tutor-selected-320.png),
[tablet plan](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/plan-768.png),
[compact Sign in](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/signin-320.png),
[compact signup/provider buttons](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/signup-providers-320.png),
[compact confirmation focus](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/signup-confirm-focus-320.png),
[Welcome](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/welcome-390.png),
[streak](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/streak-390.png),
[compact streak](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/streak-320.png),
[ongoing loop observation](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/streak-loop-observation.json).
The disclosure follow-up is captured in
[the centred practice page](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/before-practice-centred.png),
[its compact layout](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/before-practice-centred-320.png) and
[the working Terms sheet](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/before-practice-terms-320.png).
The account follow-up is captured in
[the centred signup footer](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/signup-footer-centred-390.png),
[its compact layout](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/signup-footer-centred-320.png) and
[the normal browser preview](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/signup-footer-centred.png).
The tutor-colour follow-up is captured in
[the bolder tutor page](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/tutor-colour-selected-390.png),
[its integrated playback control](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/tutor-colour-playing-390.png) and
[all six compact choices](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/tutor-colour-320-bottom.png).
The continuous portrait follow-up is captured in
[the animated tutor page](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/tutor-portraits-animated-390.png),
[compact portraits](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/tutor-portraits-animated-320-bottom.png) and
[the actual loop observations](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/tutor-portrait-loops-390.json).
The question-palette follow-up is captured in
[the bolder daily-time page](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/questions-time-390.png),
[multiple interests](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/questions-interests-390.png),
[compact daily-time answers](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/questions-time-320.png) and
[all six plan-edit measurements](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/questions-plan-edit-checks.json).
The question-illustration and structure follow-up is captured in
[all six illustration compositions](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/question-illustration-compositions.png),
[the new purpose header](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/question-hero-purpose-390.png),
[the book and coffee interests page](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/question-hero-interests-390.png),
[the refined daily-time page](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/question-hero-time-390.png) and
[the actual motion/layout observations](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/question-hero-motion-and-layout.json).
The latest premium redraft is captured in
[the six newly drawn illustrations at both sizes](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/premium-illustration-proof.png),
[the new daily-time clock](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/premium-time-390.jpg),
[the map explorer](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/premium-reason-390.jpg),
[the growing plant](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/premium-start-level-390.jpg),
[the speech character](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/premium-confidence-390.jpg),
[compact answer reachability](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/premium-time-320-bottom.jpg) and
[the current observations](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/premium-illustration-observations.json).
The natural-gesture follow-up is captured in
[the generated all-six motion study](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/question-gesture-study.gif),
[actual daily-time UI](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/gestures-time-selected-390.jpg),
[normal and compact gesture poses](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/question-gesture-poses.png),
[compact answer reachability](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/gestures-time-320-bottom.jpg) and
[actual loop and selection observations](/Users/pravz_07/.codex/visualizations/2026/10/13/01a13581-45d6-7113-909b-c02ddfa039f5/c2-runtime/question-gesture-observations.json).
The [running local C2 component preview](http://localhost:8096) opens the guarded
fixture selector for review. All browser observations used actual components
with synthetic/inert inputs; no signup or live paid-service request was submitted.

Landing is a reviewable, uncommitted change on `codex/c2-redesign` at `dad81566`.
No merge, push or deployment has occurred. Browser/component tests, a web
export and native compilation do not certify native frame pacing, physical keyboard/safe-area behavior,
OS large-font/reduced-motion behavior, permission dialogs, haptics,
VoiceOver/TalkBack, real Apple/Google exchanges, authenticated Home or paid/live
audio service admission. Those device/service checks, legal review and existing
release qualification remain separate holds.

The earlier C implementation and staging records below are historical evidence,
not evidence for this C2 revision.

- Status: implementation present; integration acceptance incomplete
- Updated: 2026-10-11
- Checkout: `/Users/pravz_07/.codex/worktrees/346f/Luvani`, starting `21c8bb49`
- Owner: current Codex session, sequential implementation
- Design: [C · Bold rhythm](https://www.figma.com/design/sjAwoGinWQKvhGrWbgMO18?node-id=2-4)
- Landing: implementation pushed to main as `281c5f97`. Staging verification follow-up
  is in progress locally. Production activation remains outside this change.

## Outcome and scope

C's typography, palette, six plan questions, plan editor, tutor selection, live
presentation, truthful results, account forms, saved-progress handoff, welcome,
Home and streak presentation use the existing Expo owners. The
[60-frame map](bold-rhythm-frames.md) distinguishes implementation from verification.

Interests persist in the existing draft and closed core first-practice brief.
Travel plus Food & cafés changes both the plan and actual worker scenario to a
restaurant visit during a trip. Level, confidence, focus, duration and voice keep
their existing teaching/voice owners. Plan editing commits all six answers.

There are 24 bundled Rive scenes and matching static vectors, including varied
cloud-led illustrations and the user's later soft-gradient sphere. Artwork loops
continuously while visible; reduced motion/background/hidden screens use stills.
Buttons have accepted-action haptics, press depth and glints. Progress, presses,
entrances and earned confetti follow events and do not reset with illustration loops.
See [asset provenance and rebuild](../../apps/mobile/assets/bold-rhythm/README.md).

Later user overrides are applied: remove the separate Voice preview block and
its rules, preserve each tutor's Listen action, colour the six tutor cards with
Luvani colours, and replace the ring/bar orb with state-coloured fluid motion.
Only actual input/output activity controls audio amplitude. Synthetic orb controls
are restricted to the development preview.

Loading, offline, empty, reconnect, failed save, provider cancellation and early
exit retain truthful state and recovery. Returning accounts do not replay earned
awards. Resume offers continuation or an explicit fresh plan. The reminder branch
uses the existing time/permission sheet. Hidden retained onboarding artwork stops.

Auth keeps Supabase, native Apple and browser OAuth/PKCE. Provider-approved assets
are used on both forms. Next is explicit, with no typing-triggered focus change.
Resend confirmation is guarded like other requests. Native email links use
`luvani://auth/email`, exact-destination PKCE code validation, the SDK flow slot,
deduplication and listener cleanup. Callback failure uses the existing sheet;
recovery establishes the identity required by the existing password-reset screen.
No callback tokens or provider error prose are logged or displayed.

## Tasks and ownership

| Task | Allowed files / owner | Dependencies | Acceptance and status |
|---|---|---|---|
| T1: design and assets | mobile art, build scripts, this plan / Codex | none | 60 states mapped; 54 design contexts inspected, 164 vector layers exported; six contexts and later motion calls blocked by Figma quota |
| T2: personalisation | core firstPractice, mobile draft/brief/plan / Codex | T1 | Closed interest validation, migration/repair, scenario and saved goals implemented; tests pass |
| T3: presentation | mobile onboarding/auth/Home/theme/assets / Codex | T1,T2 | C presentation and user overrides implemented; phone/tablet browser evidence; native accessibility/motion acceptance remains |
| T4: authentication/live | existing auth and live owners / Codex | T2,T3 | Real seams retained and callback gap fixed; local proofs pass; real guest-to-account provider and vendor sessions blocked below |
| T5: verification | tests, graph, domain docs, evidence / Codex | T4 | Full gate/typecheck/export and focused checks recorded below; no claim of production readiness |

## Verification record

- `npm ci` in this checkout: 902 locked packages installed. No borrowed dependency
  tree; prior untracked `.codex/` preserved.
- Full gate before final email-callback addition: green, 5,116 workspace tests,
  89 shared release/provider proofs, eight SQL verification scripts each replaying
  all 39 migrations. No floors lowered or suites skipped.
- Final gate after callback/plan-editor fixes: green, 5,122 workspace tests,
  89 shared release/provider proofs and all eight SQL scripts replaying 39 migrations.
  Unchanged test-count floors; no skipped suites.
- All six workspace TypeScript checks passed after callback changes. The final
  production web export passed. `git diff --check` and local documentation links pass.
- Focused native-email/parser/listener/settings/navigation checks: 30 passed.
  Plan/source-contract tests: four passed. New asset tests check 24 actual binaries,
  matching fallback vectors, state-machine presence and closed loop endpoints.
- Browser: actual onboarding components exercised with local synthetic service
  fixtures. Selected options, plan edits and travel+café scenario, six coloured
  tutor cards, separate sample playback, compact two-column grid, signup Next
  order, matching passwords, pending lock, failure/retry, confirmation and resend
  were checked. No real account was created in these checks.
- Viewports: 320 × 568, 390 × 844 and 768 × 1024. Tablet plan is centred with no
  horizontal overflow; compact forms scroll. Native keyboard and OS large-text
  scaling remain unverified.
- A 9.37-second browser recording covers the eight-second fluid-orb loop. State
  colours and Pause were checked; Pause removes the live canvas and shows its SVG.
  This is synthetic motion evidence, not a recording of a paid tutor session.
- Knowledge graph refreshed. SQL extraction is incomplete because `tree_sitter_sql`
  is not installed; 78 SQL files are absent. Semantic naming uses available hub
  fallback. Generated graph output is not a substitute for SQL gate proofs.

Earlier gate failures were resolved: initial sandbox socket restrictions; stale
presentation assertions; missing resend guard; complete plan-edit fields; and
callback failure presentation initially violating the existing no-native-alert
contract. The latter now uses the shared Sheet. A strict source contract also required keeping provider construction adjacent to
its prefetch call; the declaration order was restored without changing behavior.
Incoming email-link observation was added to the exact OS-access allowlist; other outbound/permission ownership
assertions remain unchanged.

## Evidence

Browser images and the orb recording are saved in the task's visualization folder;
these are local presentation evidence, not Figma pixel certification or service QA.

- [Tutor colours, 390px](/Users/pravz_07/.codex/visualizations/2026/10/11/01a12b3e-b02b-7e60-a41a-068777838e98/bold-rhythm/tutors-colour-390.jpg)
- [Compact tutor grid](/Users/pravz_07/.codex/visualizations/2026/10/11/01a12b3e-b02b-7e60-a41a-068777838e98/bold-rhythm/tutors-320.jpg)
- [Personalised plan, tablet](/Users/pravz_07/.codex/visualizations/2026/10/11/01a12b3e-b02b-7e60-a41a-068777838e98/bold-rhythm/plan-768.jpg)
- [Signup recovery, compact](/Users/pravz_07/.codex/visualizations/2026/10/11/01a12b3e-b02b-7e60-a41a-068777838e98/bold-rhythm/signup-error-320.jpg)
- [Verification/resend, compact](/Users/pravz_07/.codex/visualizations/2026/10/11/01a12b3e-b02b-7e60-a41a-068777838e98/bold-rhythm/signup-verification-320.jpg)
- [Continuous fluid-orb recording](/Users/pravz_07/.codex/visualizations/2026/10/11/01a12b3e-b02b-7e60-a41a-068777838e98/bold-rhythm/fluid-orb-loop.mp4)

 All 60 frame states are mapped,
but all-frame screenshot comparisons are **not complete**. Figma quota blocked
frames 54–59 and most follow-up motion calls; no plan/seat was upgraded.

## Exact remaining configuration and acceptance

Use an isolated staging Supabase project and local token-server/tutor-agent services.
The existing integration checkout points to the primary Parle project; read-only
checks found email, Google and Apple enabled, email auto-confirm enabled, and no
development branch. It was not used to create test accounts or change settings. Neither Docker nor the
Supabase CLI is available on this host’s PATH, so an isolated local Supabase stack is not
available as a fallback.

Staging setup progress (11 October): `wtexbzuyfersdtiekrvp` is the new
**Luvani Staging** project in `eu-west-1`. Read-only checks confirmed healthy
status and an initially empty database. The localhost and native callback
redirects were subsequently verified in the dashboard. This checkout has a Git-ignored,
mode-0600 `apps/mobile/.env` containing the staging URL, its public publishable
key (under the existing `EXPO_PUBLIC_SUPABASE_ANON_KEY` name) and localhost:8792
API address. An HTTPS Auth settings request with that key returned 200: email
enabled, confirmation required, signup enabled. This is connectivity evidence,
not completed sign-in acceptance. The app has since been restarted for real
authentication, with synthetic preview disabled.

The Git-ignored, mode-0600 `.env.staging.local` now contains the user-provided
staging Session pooler URI and database password. Both were saved and verified
without displaying their values; successful deployment verified connectivity.
All 39 migration files were applied through official Supabase CLI 2.120.0 after a
successful dry run, preserving the original versions. The authenticated connector
captured the complete hosted SQL catalog; the existing strict comparison matched
all migration versions, policies, functions, grants, defaults, indexes and constraints.
Security advisors reported no errors: the 43 service/private policy-less RLS tables
and two authenticated definer RPC warnings match the reviewed existing design.

Live verification initially refused the REST preflight despite that exact SQL
catalog match. F797 reproduces and fixes the search-path rendering mismatch without
ignoring schema fields or weakening ACL checks. All 12 disposable-account Supabase
proofs then passed, including real password sign-in/JWTs, RLS isolation, forged-owner
refusal, anonymous refusal, protected RPCs, concurrency, replay, trial races and
fixture deletion. These do not replace the user's signup/email-link UI acceptance.

The local app is restarted outside synthetic preview on port 8108, with the staging
API on 8792. The staging service-role key is saved only in its ignored server env.
The user approved the existing speech/AI credentials for one short test. A foreign
tutor worker was found, so a separate loopback LiveKit server (7892) and tutor worker
isolate this run. Unlimited development minutes were not copied. The user created
the account through the real Chrome signup form and followed the confirmation email.
Supabase records a confirmed email and one authenticated session after the user signed in.
The user then found a web sign-in focus defect (F798): the native background keyboard-dismiss wrapper immediately blurred clicked inputs. Restricting the wrapper to native platforms restores normal Chrome email typing and password pointer focus. The corrected form accepted real sign-in and the app reached the first coffee scene. The first tutor attempt exposed F799 (local verification discarded the signed session ID); its red/green regression now passes and the real browser obtained a durable 120-second reservation claimed by the isolated worker. The live session then settled with seven learner turns, 102 charged seconds (120 reserved), no checkpoint failure and one durable conversation pack. Chrome displayed the real completion screen with a saved phrase, XP and streak. The user confirmed audible playback. Returning Home and reloading restored the authenticated account and saved practice.

The verifier follow-up passes the full gate: 5,122 workspace tests, 90 shared
release/provider proofs and all eight database proofs replaying 39 migrations.

Main landing preparation: fetched `origin/main` and confirmed this checkout's
starting revision is its exact tip. Credentials, the editor swap file and local
Codex configuration are excluded from the commit. The existing main CI may publish
a gated iOS preview; no production channel or store release is authorised here.
The fresh pre-push gate passed with 5,122 workspace tests, 89 shared release/provider
tests and all eight database proofs replaying 39 migrations. The tracked-file
secret scan, known-password exclusion check, 36 local documentation links and
whitespace checks passed. Hosted CI and real staging acceptance remain separate.

Local staging app, token-server and isolated LiveKit/tutor-agent configuration is
prepared. Hosted Google/Apple providers remain unconfigured. The bounded staging tutor test is complete and all admission limits were restored
to their original disabled values. Production paid admission remains disabled.

Staging must allow the web origin, `luvani://auth/callback` for provider OAuth and
`luvani://auth/email` for confirmation/reset. Enable email confirmation to test it;
provide a test inbox and Google/Apple test identities on the device. Do not expose
service-role/vendor secrets through Expo public variables. The app uses Supabase's
[PKCE exchange](https://supabase.com/docs/guides/auth/sessions/pkce-flow) and
[Expo SDK 57 link delivery](https://docs.expo.dev/versions/v57.0.0/sdk/linking/).

Verified on staging web: email signup/confirmation/sign-in, authenticated reload,
LiveKit admission, microphone, STT, spoken replies in the chosen voice, durable
settlement, completion and returning Home. Remaining external acceptance includes
Google/Apple sign-in, native cold restoration and deep links, password reset,
guest-adoption failure retry, live typing/voice switching and interruption/reconnect. A physical iOS/Android build is needed for haptics, permission dialogs,
keyboard, large text, reduced motion, screen reader and background/resume checks.

Production guest admission is deliberately refused by the existing server and
worker because the paid ledger requires an account principal. Enabling it requires
a reviewed guest-principal billing/admission contract, quotes/budgets and release
acceptance. This UI change does not bypass that contract or activate production.

Context: [first live practice](../FIRST_LIVE_PRACTICE.md),
[onboarding](../ONBOARDING.md), [design](../../DESIGN.md), [testing](../TESTING.md).

Follow-up checks: 12 focused auth-flow tests and mobile typecheck passed. The first post-focus-fix gate attempt was sandboxed and failed the local-listener provider tests; the earlier full gate was green. The subsequent gate with loopback permissions passed after F799. The speech-refinement gate then passed 5,127 workspace tests, 90 shared proofs and eight database proofs, but refused the stale F39 named-test reference; this is being corrected before landing.

The isolated LiveKit server caused cloud turn/interruption detectors to reject local credentials (401); the SDK fell back to local turn detection and VAD. The test therefore verifies STT/model/TTS and durable settlement, not cloud adaptive-interruption acceptance.

## Live speech refinement — 11 October

The user confirmed audible speech, then requested faster replies and better
recognition of beginner French, explicitly keeping GPT-6 Luna on the OpenAI key.
The existing worker already uses `gpt-6-luna`; the observed eight model calls
spent 2,406 output tokens on reasoning. Improve the current path sequentially:

| Owner / allowed files | Dependency | Observable acceptance |
|---|---|---|
| Core recognition helper and tests | none | Context-bound near-sound French repair; unrelated speech, negation, numbers and ambiguous alternatives unchanged |
| Tutor worker conversation and recognition wiring | helper | Same interpreted text reaches screen and brain; current-scene vocabulary reaches recognizer; typed/topic inputs unchanged |
| Brain OpenAI routing and tests | none | Luna live turns omit reasoning work; explicit effort overrides and background activities remain supported; bounded real API probe reports latency and schema validity |
| Mobile transcript/protocol | worker | Interpreted speech is labelled, ordinary turns retain their presentation; browser checks and full gate |

The helper is recognition repair, not an audio pronunciation score or a shortcut
to lesson success. Existing grading, safety and progression owners still decide.


### Authorised parallel review and landing criteria

The user authorised a bounded review/fix loop with routine decisions delegated to
agents, followed by a normal push to main once the implementation checks pass.
The root agent owns shared interfaces, browser integration, this log, the final
gate and landing. Independent reviewers own mobile presentation, token-server
and schema verification, and speech/core recognition plus brain routing. They
must preserve existing changes and cannot authorise themselves to bypass a
credential, paid-service or release control.

Landing requires all reviewer findings resolved with focused proofs, a fresh full
gate, typecheck, web export, checked documentation links and whitespace, secret
scan, browser returning-account/error recovery checks, and a normal fast-forward
push from the current main tip. Production rollout and native/provider acceptance
remain separate; staging admission stays disabled after the bounded test.

The approved synthetic Luna comparison completed two valid requests after the
first four-request script failed during local result integration. The corrected
pair measured 4,696 ms at low effort versus 2,777 ms at none (about 41% lower);
both responses passed the real strict turn schema. This single pair is model
response timing, not phone-audible latency or a broad teaching-quality evaluation.
No additional paid comparison requests were sent in this review loop.


Review findings: mobile F800 resets the readiness shine on each question. The
mobile runtime harness also verifies that only interpreted spoken final messages
receive the interpretation caption, duplicates do not append and partial/typed
messages remain distinct. Backend review found no additional defect: 442 server
tests and 30 focused auth/reservation/catalog tests passed. Browser review checked
selected/disabled states across consecutive onboarding questions, returning Home,
tutor-unavailable recovery, saved practice, typing focus and resumable drill exit.
The speech reviewer rejected broad edit-distance substitution after demonstrating
that it could change valid words; repair now requires conservative sound-fold equivalence or a known current-context confusion.


Final review also replaced Rive’s deprecated plural state-machine option with the
installed runtime’s supported singular option. A transient development Fast
Refresh error (`useAuth outside AuthProvider`) occurred while two Metro previews
and an export were active. Source review found one shared context and a correctly
wrapped Gate; a full reload restored the signed-in account and saved practice.
The exact refresh cause is unproven; no speculative context workaround was added.
The clean reload is the browser acceptance evidence, not the stale hot-update state.


The installed SDK proof now passes against a local fake WebSocket vendor: the
same recognizer reconnects with language `fr`, then sends the current keyterms.
The fixture supplies synthetic silence and cleans up its session and sockets;
initial roomless/no-input and open-event race attempts were repaired before the
passing proof. No provider request or real recording is used by that test.
The active-language callback contains asynchronous failures and offers typing.
A clean final Chrome reload restored authenticated Home and resumable practice.
The final web export and workspace typecheck pass; all 29 changed-document local
links resolve. The final integrated gate is green: 5,135 workspace tests, 90 shared release/provider
proofs and all eight database proofs replaying 39 migrations. Tracked-file secret
scan and staged whitespace checks pass. Graph refresh completed with 15,937 nodes
and 42,819 edges; SQL parser support is unavailable (78 SQL files), so migration
proofs provide the SQL evidence.


All three reviewers have completed and frozen source changes. Speech has 193
focused passing tests, including the installed-SDK WebSocket proof in parallel;
frontend has 42 passing focused tests and a passing mobile typecheck; backend has
442 passing server tests plus 30 focused auth/catalog/admission proofs. Broad
mobile review initially caught a JSX prop-order contract assertion after the
shine fix; preserving the existing prop order fixed it without weakening the
assertion. No additional paid request or new human accent test was run. The
recognition changes have deterministic and SDK transport evidence; real accent
quality and phone-audible timing remain explicit follow-up acceptance.


Landing disposition: all implementation review findings F797–F803 are resolved
with named passing proofs. The user authorised a normal main push after checks;
only explicit reviewed source, tests, docs and generated graph files are staged.
Ignored credentials, the pre-existing editor swap and local Codex files are excluded.
The main pre-push hook will run the full gate again. Hosted CI, production rollout,
Google/Apple configuration and physical-device acceptance are separate outcomes;
none is represented as completed by this commit.


## Remaining acceptance preparation — 12 October

The user requested the remaining work, connected Railway and explicitly chose
“Prepare everything without paid hosting yet”. This authorises preparation and
verification; do not start hosted workloads or buy a plan. Root owns infrastructure
and evidence, the native reviewer owns only generated ignored iOS files and the
isolated build, and the backend reviewer owns the Docker/build workflow seam.

| Task / owner | Status | Acceptance |
|---|---|---|
| Railway project / root | prepared | Private empty Luvani Staging project, staging environment, no deployed service or consumed hosting credit |
| Immutable OCI build / backend and root | in progress | Actual pinned public image inputs, decoder hash, Linux nonroot/network-disabled decoder/native/model checks, provenance and SBOM; no registry publication |
| Native signing / mobile | prepared | This checkout's build succeeds and strict signature verification passes; renewed profile and current native fingerprint recorded |
| Native install and UI / root and human | pending | Install preserves app data; Rive/haptics, reduced motion, permissions and restoration observed on device |
| Updated speech / root and human | pending | Bounded current-worker session; accurate displayed meaning/interpretation, audible reply and truthful completion; admission restored off |
| Hosted API/OTA | held by user choice | Approved paid infrastructure, isolated service dependencies and quote/budget bindings, readiness acceptance, then Expo staging endpoints and native compatible update |

The Railway trial workspace was verified with no projects and $5 trial credit.
An empty private project and a staging environment are prepared; no service,
database, image deployment, public domain or secret upload was started.
The native build includes the installed Rive/Nitro/LiveKit/Haptics/Updates pods.
Automatic signing renewed the Personal Team profile through 19 October 15:11 UTC.
The arm64 Debug binary is signed at `/tmp/luvani-native-derived-346f/Build/Products/Debug-iphoneos/Luvani.app`,
fingerprint `37c2ea50d7d91f8aff5748893a11c8a3e6d18937`. It is a Metro development
build; Apple/push capabilities are omitted only in generated ignored entitlements.

Hosted readiness requires Redis, fresh tutor/practice/maintenance heartbeats and
both tutor and paid admission under production-mode configuration even for staging.
Loopback local env files cannot be published. Exact provider quotes, isolated
LiveKit/Redis/deletion journal, host secret injection, image/ingress acceptance
and native voice proof remain prerequisites; no readiness protection is relaxed.
The static decoder's documented source path is `/ffmpeg`, so the portable build
is being made executable with that layout while retaining digest/checksum checks.


The fresh signed binary installed without erasing app data. Initial launch was
refused by iOS; a second independent comparison found matching app/profile/device
and certificate/entitlements. After the user verified developer trust, launch
succeeded. The user signed in on the iPhone and confirmed that a forced process
restart restored signed-in Home without another password. This accepts native
password sign-in and returning-session restoration, not Google/Apple OAuth.

All five Railway startup configs passed the current official JSON schema using
an isolated pinned CLI validator; no root dependency/lockfile changed. Actual
public-registry Linux/amd64 manifests and the streamed decoder binary/layer hashes
are verified in the local evidence. Decoder executable bytes were inspected but
not executed on macOS. Linux execution remains the required OCI build check.


Preparation verification: full gate passed 5,135 workspace tests, 91 shared proofs
and eight database proofs replaying all 39 migrations. Thirteen changed-document
local links and whitespace checks pass. Graph refresh completed (15,982 nodes,
42,859 edges); SQL parser remains unavailable for 78 files, covered by the database
proofs. The next artifact is an OCI-only GitHub build on the exact review-branch
commit with the reviewed immutable inputs; it does not publish/deploy an image.
Native motion/haptic observation is pending the user's device report.

### Native interaction follow-up

The user reported choppy setup and tutor-preview controls, slow sample startup
and a jumping duration bar. The isolated presentation preview also left Start
practice disabled after eligibility confirmation. That preview deliberately
cannot start a network session; it now explains the limitation without removing
the eligibility or preview guards. Real start acceptance belongs in the main app.

| Task / owner | Allowed files | Observable acceptance |
|---|---|---|
| Press/artwork and practice recovery / frontend agent | Shared Press, native BoldScene, onboarding start/practice surfaces and focused tests | One raised release spring; stable native artwork callbacks; truthful failure caption and same-room typed recovery; terminal/settlement guards preserved |
| Sample startup and progress / audio agent | Tutor preview hook/controller/preloader, TutorSelection, media-progress primitive and focused tests | Six bundled clips warmed while visible; one active player; tap/switch/pause/replay/background cleanup; observed media position animates without parent media-tick renders |
| Independent UX review / reviewer agent | Read-only source and patch review | Selection never plays; Listen never selects; loading/error/reduced-motion/large-text states checked; no eligibility/admission guard relaxation |
| Device/browser acceptance and landing / root and human | Existing evidence/domain docs, verification and explicit Git paths | Running changed journey, human iPhone responsiveness report, focused checks and full gate before main landing |

The independent review also found misleading ready captions during a failed
first practice and no typing recovery despite the live hook keeping a recoverable
room open. Both are repaired through the existing failure/typed-door seams,
without requesting another grant or bypassing settlement. A second read-only pass
found inactive progress rows scheduling zero-value animations, stale nudges
replaying after a reduced-motion change and rejected sheet swipes ignoring the
current preference. Those are fixed with production-path regression coverage.

Browser acceptance at 390 × 844 verifies deliberate selection enables the next
action, Listen does not change selection, real sample playback reaches Pause,
Pause/Resume retain the position and the start sheet explains its isolated-preview
guard. Evidence: `tutor-preview-paused-390.png` under this task's existing local
evidence directory. The complete Welcome → purpose → interests → level →
confidence → practice style → daily goal → personal plan → tutor journey also
passed in that viewport, with the selected answers reflected in the plan.
The fresh iPhone reload attempt failed because its CoreDevice
connection was invalidated after the user left; no new native responsiveness,
audible latency or haptic acceptance is claimed. Prior sign-in/restoration proof
remains historical to this final UX patch.

Final integrated verification: full gate green with 5,153 workspace tests, 92
shared release/provider proofs and eight database proofs replaying 39 migrations.
Mobile typecheck and focused implementation/independent review checks passed.
Fifteen local documentation links and whitespace checks passed. The final graph
refresh completed (16,022 nodes, 42,949 edges); the SQL parser limitation remains.
No test floor or runtime protection was weakened. This patch is eligible for the
user-authorised main landing; hosted promotion and the disconnected-device checks
remain separate open acceptance items.

The first OCI-only build, run 38271932614 on `abaa4df8`, passed its source contract
but failed the immutable decoder guard: the reviewed 9.0.2-1 binary is 144,081,824
bytes, exceeding the existing 128 MiB bound. A read-only 8.1.2 candidate is also
too large (140,059,552 bytes). No runtime/build bound was raised, no image was
published and no Railway workload was started. A compatible reviewed decoder
artifact and successful Linux execution remain open acceptance items.
