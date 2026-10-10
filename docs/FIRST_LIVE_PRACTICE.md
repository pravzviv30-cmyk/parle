# First live practice implementation, 10 October 2026

Status: **Source merge explicitly authorized by the user; production guest activation remains disabled.**
Production guest admission is deliberately refused in both the token server and worker. The existing paid-operation ledger requires an authenticated account and does not support a guest principal. The normal paid runtime, quotes, per-provider budgets, account entitlement gates and auth checks remain enabled. A new guest principal/admission contract, reviewed worst-case quotes (including the selected 20-minute duration), deployment configuration and live acceptance are required before removing this refusal. A flag cannot bypass it.

## Journey and presentation

The new route is plan → chosen tutor → live practice → completion celebration (successful sessions only) → achievements with Save your progress → existing signup → durable welcome → prepared Home. Home presents the existing darker-green streak screen 1.5 seconds after its data has loaded and the welcome is dismissed. That presentation reads recorded qualifying finish dates and awards no activity. Its durable account-scoped receipt prevents repeat presentation; existing guest handoff prevents duplicate streak credit.

New practice uses the existing LiveKit hook, conversation worker, responsive audio orb, transcript, hint support, safety surfaces and microphone controls. Typing releases the microphone track while leaving the same room, voice and spoken tutor replies running. Switching back republishes the microphone. Unsent text and partial recognition do not enter achievements. Final worker messages have input attribution and stable turn IDs; tutor text IDs prevent reconnect replay duplicates. Existing transcript scrolling preserves a reader's position.

The completion screen combines one existing confetti burst with the original account Rive illustration, a success haptic, a short whole-surface fade and an immediately usable continuation. The summary reserves full accessible text while revealing short word groups. Reduced-motion settings reach the shared animation primitives. Welcome prepares Home under an inaccessible overlay and fades out after its durable presentation receipt is saved. A failed storage read or write stays retryable.

## Personalisation

The current onboarding UI collects **one** reason; it does not collect multiple topics. The closed brief supports multiple goals for compatible future input without fabricating extra selections.

| Real answer | Effect |
|---|---|
| Reason | Concrete restaurant, train, family visit, neighbourhood, work meeting or shared-activity scenario and next practice |
| Compatible food + travel | One restaurant visit during a trip; unrelated goals remain supporting context |
| Self-reported level | Initial A0/A1/A2/B1 teaching estimate with low evidential confidence, never a certified attainment claim |
| Speaking confidence | Hesitant learners receive slow, short, supported prompts; comfortable learners can receive a small realistic complication |
| Listening / speaking / words | Listening detail checks, natural turn-taking, or situation-specific vocabulary hints |
| 5 / 10 / 15 / 20 minutes | Exact target in the prompt, elapsed-time closing guidance, plus a bounded 60-second grace period; next-step copy preserves the chosen duration |
| Choose each time / unanswered duration | No invented daily target; local guest room has a five-minute safety budget plus grace |
| Tutor catalogue key | The same chosen key is signed into LiveKit metadata and resolved by the existing worker voice catalogue |

Reminder settings and analytics consent do not alter teaching. No uncollected dietary needs, travel details or preferences are invented. The scenario generator receives the whole brief; its output must remain actionable rather than a generic greeting. Duration is a pacing target, not a guarantee: the conversation can finish when its goals are reached. The existing hard lease remains a safety ceiling.

## Completion and persistence

A full completion requires worker-confirmed learner participation and evidence for every scene goal. Forced beat advancement, the turn ceiling, an empty session, an End tap, a service failure or an expired connection cannot award full completion. Partial and interrupted summaries use separate copy. Exact typed phrase matches can be described as “You said … by typing.” Uncertain speech recognition is not quoted; voice participation is described without pronunciation or mastery claims. Tutor-only vocabulary is excluded.

Local guest admission reuses the existing opaque guest capability and installation binding. One room is assigned before token issuance, then one worker nonce claims its CAS-backed lease. Checkpoints are monotonic, digested and acknowledged before evidence becomes authoritative. A plan change before claim replaces the unclaimed room; an already-claimed room cannot restart. Heartbeats and the hard deadline stop abandoned workers. Consumer calls cannot provide completion evidence.

At authenticated adoption, the server upserts only its acknowledged Conversation Pack into the existing account-owned store, keyed by the stable session ID. It removes the temporary guest learning copy only after that write succeeds. Existing usage transfer is idempotent. The app then fetches and banks the actual account-owned pack before recording success, retains guest recovery state on failure, and uses existing activity settlement. No new Supabase schema or RLS changes are included in this local implementation.

A safety stop clears the guest learning summary, prevents a debit/completion, and uses the existing dedicated safety screen. Guest raw audio is not stored. The guest capability, usage and temporary summary expire after 30 days; local confirmed contributions and the plan remain recoverable on-device. The privacy module and generated HTML describe this data path. Production release must include the matching guest deletion/export review.

## Rive source

The requested official repository was downloaded to `/Users/pravz_07/Downloads/awesome-rive`. It is a curated examples/resources repository and contains no `SKILL.md`; no Rive skill was installed. This change reuses Luvani's original `.riv` illustrations, existing native/web Rive renderer and shared animation primitives. It does not copy an unrelated community animation or claim an unavailable skill ran.

## Verification boundary

Tests exercise the actual worker lifecycle against the guest store, signed tutor metadata, foreign installation/account refusal, expired workers, response replay, storage failure/retry, safety stops, truthful phrase attribution and existing microphone/transcript behavior. Browser screenshots use explicitly synthetic records and the actual presentation components. They prove presentation and summary → signup navigation, not a paid vendor session or real account signup.

Remaining release acceptance: production guest paid admission, reviewed budgets and quotes, real LiveKit/STT/TTS session on a physical phone, allowed/denied microphone permission, network interruption and reconnect, actual Supabase signup/adoption, native keyboard/larger-text/VoiceOver checks, and full Home-arrival integration. The user explicitly requested this source replacement on main with these known constraints. Merging source does not enable guest production sessions or qualify a production release.

### Recorded local checks

- Final full repository gate: green, 5,067 tests passing with unchanged test-count floors. All 77 shared release/provider proofs pass; all eight database verification scripts replay 39 migrations. The actual onboarding component was driven through welcome, all five questions, plan, tutor selection and the processing disclosure; the preview guard prevents starting a paid session.
- Six workspace TypeScript checks pass; the mobile check also passes after the final safety-close retry-message change.
- Tutor-agent suite: 610 tests pass.
- Focused arrival, truthful summary, storage policy, launch and account-handoff checks: 43 tests pass.
- Independent revenue review approved the deliberate `tokens.ts` guest binding and validated brief metadata changes for source merge. The dated hash pin was updated after that review; its two protection checks pass. The reviewer ran 43 token/guest checks and verified the actual worker refuses production guest bindings before lifecycle/provider work. Prices, allowances, debit, paid admission, quotes and all other money pins are unchanged. This is not production activation approval.
- UI evidence: [completed summary](first-live-evidence/achievements-390.jpg), [signup after Save your progress](first-live-evidence/signup-390.jpg), [interrupted summary](first-live-evidence/interrupted-390.jpg). These are 390 × 844 browser previews with synthetic session records. The layout was also inspected at 320 × 568.

The implementation was prepared on `codex/first-live-practice` for the requested main merge. Git history and the final handoff record the resulting commit.

### Release review and rollback

The initial release review returned HOLD because production guest admission is unavailable. The user subsequently explicitly authorized the source merge with that known limitation. Production activation remains HOLD. The source replacement is one coherent revertable commit. Code rollback alone does not remove adopted learning/usage records, guest Redis state or device presentation receipts. Guest records still use version 2, while live records can exceed the old 360-second limit; an older client rejects those records. A compatible record version/upgrade and rollback plan must be agreed and tested before release.

### Replacement cleanup

The old recorder/typed starter, per-line feedback, finish handler, guest Home and reminder sheet were removed from `PreAccountOnboarding`. The unused `GuestRecording`, `MicMeter`, `WinCard`, `InvestmentList`, `ExchangeSteps` and `StreakCard` components were deleted. The live practice, authoritative outcome, achievements and account handoff are the single new route. Legacy record parsing and adoption remain so an update preserves old completed practice; they do not expose the old practice UI. New source checks explicitly forbid the retired paths. The development journey preview renders the actual onboarding component with guest admission disabled.
